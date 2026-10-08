import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db, getGoogleSheetsAccessToken, requestGoogleSheetsAccess } from './firebase';
import { CentralDataService } from './centralDataService';
import { DEFAULT_ORG_ID } from '../constants/org';
import { StorageService } from './storage';
import { SalesRecord } from '../types';
import { PurchaseOrder, PurchaseOrderItem, POStatus, POPaymentStatus, POReceivingStatus, Supplier } from '../types/purchasing';
import { RMAItem, RMAStatus, ReturnReason, ReturnType } from '../types/rma';
import { isDemoPO, isDemoSupplier } from '../utils/purchasingDemoFilter';
import firebaseConfig from '../../firebase-applet-config.json';

export type LiveSheetTarget = 'purchasing' | 'rma' | 'sales';

export interface LiveSheetConnectionConfig {
  target: LiveSheetTarget;
  spreadsheetId: string;
  spreadsheetUrl?: string;
  spreadsheetTitle?: string;
  sheetName: string;
  availableSheets?: string[];
  range?: string;
  isConnected: boolean;
  autoSyncIntervalSec: number; // default 30 for sales, 60 for purchasing/rma
  lastSyncAt?: string;
  lastSyncStatus: 'live' | 'syncing' | 'error' | 'disconnected';
  lastSyncMessage?: string;
  rowCount?: number;
  columnMapping?: Record<string, string>;
  connectedBy?: string;
  connectedAt?: string;
}

export interface LiveSyncResult {
  success: boolean;
  message: string;
  addedCount: number;
  updatedCount: number;
  archivedCount: number;
  totalActiveCount: number;
  timestamp: string;
  rawError?: string;
}

const STORAGE_KEYS = {
  CONFIG_PURCHASING: 'splus_live_sheet_config_purchasing_v1',
  CONFIG_RMA: 'splus_live_sheet_config_rma_v1',
  CONFIG_SALES: 'splus_live_sheet_config_sales_v1',
  LIVE_POS: 'splus_live_purchasing_pos_v1',
  LIVE_RMAS: 'splus_live_rma_records_v1',
  LIVE_SALES: 'splus_live_sales_records_v1',
};

// Listeners
type ConfigListener = (config: LiveSheetConnectionConfig | null) => void;
type POListener = (pos: PurchaseOrder[]) => void;
type RMAListener = (rmas: RMAItem[]) => void;
type SalesListener = (records: SalesRecord[]) => void;

class GoogleSheetsLiveManager {
  private configListeners: Map<LiveSheetTarget, Set<ConfigListener>> = new Map([
    ['purchasing', new Set()],
    ['rma', new Set()],
    ['sales', new Set()]
  ]);
  private poListeners = new Set<POListener>();
  private rmaListeners = new Set<RMAListener>();
  private salesListeners = new Set<SalesListener>();

  private pollingTimers: Map<LiveSheetTarget, any> = new Map();
  private isSyncingMap: Map<LiveSheetTarget, boolean> = new Map();

  constructor() {
    // Listen for tab focus/visibility change to trigger instant freshness checks
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncIfConnected('purchasing');
          this.syncIfConnected('rma');
          this.syncIfConnected('sales');
        }
      });
      // Start background pollers
      this.initAutoPolling('purchasing');
      this.initAutoPolling('rma');
      this.initAutoPolling('sales');
      this.initFirestoreRealtime('purchasing');
      this.initFirestoreRealtime('rma');
      this.initFirestoreRealtime('sales');
    }
  }

  /**
   * Extracts clean Google Spreadsheet ID from any full link or raw ID
   */
  public extractSpreadsheetId(input: string): string {
    if (!input) return '';
    const clean = input.trim();
    // Match docs.google.com/spreadsheets/d/([a-zA-Z0-9-_]+)
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // If it's already an ID
    if (/^[a-zA-Z0-9-_]{20,}$/.test(clean)) {
      return clean;
    }
    return clean;
  }

  /**
   * Fetches metadata (document title and tab sheet names) from Google Sheets API v4
   */
  public async fetchSpreadsheetMetadata(
    spreadsheetId: string,
    forcedToken?: string
  ): Promise<{ title: string; sheets: string[] }> {
    const id = this.extractSpreadsheetId(spreadsheetId);
    if (!id) throw new Error('Invalid Google Spreadsheet ID or URL.');

    let token = forcedToken || (await getGoogleSheetsAccessToken());

    // Try Google Sheets API v4
    if (token) {
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties.title`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        if (res.ok) {
          const data = await res.json();
          const title = data.properties?.title || 'Google Sheet';
          const sheets = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
          return { title, sheets: sheets.length > 0 ? sheets : ['Sheet1'] };
        }
      } catch (e) {
        console.warn('Google Sheets API token metadata fetch error:', e);
      }
    }

    // Fallback using public API key
    if (firebaseConfig.apiKey) {
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties.title&key=${firebaseConfig.apiKey}`
        );
        if (res.ok) {
          const data = await res.json();
          const title = data.properties?.title || 'Google Sheet';
          const sheets = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
          return { title, sheets: sheets.length > 0 ? sheets : ['Sheet1'] };
        }
      } catch (e) {
        console.warn('API key metadata fetch error:', e);
      }
    }

    // Default return
    return { title: 'Google Sheet', sheets: ['Sheet1'] };
  }

  /**
   * Fetches values from the specified sheet tab
   */
  public async fetchSheetValues(
    spreadsheetId: string,
    sheetName: string,
    range?: string,
    forcedToken?: string
  ): Promise<any[][]> {
    const id = this.extractSpreadsheetId(spreadsheetId);
    if (!id) throw new Error('Invalid Spreadsheet ID.');

    const sheetRange = range || encodeURIComponent(sheetName);
    let token = forcedToken || (await getGoogleSheetsAccessToken());

    // 1. Primary: Google Sheets API v4 with Bearer OAuth Token
    if (token) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${sheetRange}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.values)) {
          return json.values;
        }
        return [];
      } else if (res.status === 401 || res.status === 403) {
        // Token might have expired, try requesting fresh or fallback
        console.warn(`Sheets API returned status ${res.status}`);
      }
    }

    // 2. Secondary: Google Sheets API v4 with Firebase Project API Key (works for shared/public sheets)
    if (firebaseConfig.apiKey) {
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${sheetRange}?key=${firebaseConfig.apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.values)) {
            return json.values;
          }
        }
      } catch (e) {
        console.warn('API Key Sheets fetch failed:', e);
      }
    }

    // 3. Fallback: Google Sheets gviz CSV export (supported for published/viewable sheets)
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      const res = await fetch(csvUrl);
      if (res.ok) {
        const csvText = await res.text();
        const workbook = XLSX.read(csvText, { type: 'string' });
        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
          const sheet = workbook.Sheets[firstSheetName];
          const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (rawRows && rawRows.length > 0) {
            return rawRows;
          }
        }
      }
    } catch (e) {
      console.warn('GViz CSV export fetch failed:', e);
    }

    // 4. Fallback: Direct export CSV (supported when public or shared with link)
    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
      const res = await fetch(exportUrl);
      if (res.ok) {
        const csvText = await res.text();
        if (csvText && !csvText.includes('<!DOCTYPE html>')) {
          const workbook = XLSX.read(csvText, { type: 'string' });
          const firstSheetName = workbook.SheetNames[0];
          if (firstSheetName) {
            const sheet = workbook.Sheets[firstSheetName];
            const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (rawRows && rawRows.length > 0) {
              return rawRows;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Direct CSV export fallback notice:', e);
    }

    throw new Error(
      'Could not read Google Sheet data. Please click "Authorize Google Account" to grant permission, or ensure the spreadsheet is accessible.'
    );
  }

  // ==========================================
  // NORMALIZATION: PURCHASING SPREADSHEET ROWS
  // ==========================================
  // Detect column mapping for Purchasing sheet
  public detectPurchasingColumnMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (
        !mapping.date &&
        (lower === 'date' ||
          lower.includes('podate') ||
          lower.includes('orderdate') ||
          lower.includes('purchasedate') ||
          lower.includes('createdat'))
      ) {
        mapping.date = h;
      } else if (
        !mapping.reason &&
        (lower.includes('reason') || lower.includes('purpose') || lower === 'why' || lower === 'remarks')
      ) {
        mapping.reason = h;
      } else if (
        !mapping.purchaser &&
        (lower.includes('purchaser') ||
          lower.includes('buyer') ||
          lower.includes('purchasedby') ||
          lower.includes('createdby') ||
          lower === 'agent')
      ) {
        mapping.purchaser = h;
      } else if (
        !mapping.buyingForPlatform &&
        (lower.includes('buyingforplatform') ||
          lower.includes('forplatform') ||
          lower.includes('platform') ||
          lower.includes('marketplace') ||
          lower.includes('channel') ||
          lower.includes('saleschannel'))
      ) {
        mapping.buyingForPlatform = h;
      } else if (
        !mapping.buyingFromVendor &&
        (lower.includes('buyingfromvendor') ||
          lower.includes('fromvendor') ||
          lower.includes('vendor') ||
          lower.includes('supplier') ||
          lower.includes('manufacturer'))
      ) {
        mapping.buyingFromVendor = h;
      } else if (
        !mapping.paymentMethod &&
        (lower.includes('paymentmethod') ||
          lower.includes('paymethod') ||
          lower.includes('paymenttype') ||
          lower.includes('paidvia') ||
          lower === 'method')
      ) {
        mapping.paymentMethod = h;
      } else if (
        !mapping.qtyPurchased &&
        (lower.includes('qtypurchased') ||
          lower.includes('quantitypurchased') ||
          lower.includes('purchasedqty') ||
          lower === 'quantity' ||
          lower === 'qty' ||
          lower === 'units' ||
          lower === 'pieces')
      ) {
        mapping.qtyPurchased = h;
      } else if (
        !mapping.lineItem &&
        (lower.includes('lineitem') ||
          lower.includes('lineitems') ||
          lower === 'line' ||
          lower === 'item' ||
          lower.includes('itemname') ||
          lower.includes('product') ||
          lower.includes('sku') ||
          lower.includes('description'))
      ) {
        mapping.lineItem = h;
      } else if (
        !mapping.poNumber &&
        (lower.includes('ponumber') ||
          lower.includes('pono') ||
          lower.includes('po#') ||
          lower.includes('purchaseorderno') ||
          lower.includes('purchaseorder') ||
          lower.includes('orderid') ||
          lower.includes('orderno') ||
          lower.includes('order#') ||
          lower === 'po')
      ) {
        mapping.poNumber = h;
      } else if (
        !mapping.poAmount &&
        (lower.includes('poamount') ||
          lower.includes('purchaseamount') ||
          lower.includes('totalamount') ||
          lower.includes('grandtotal') ||
          lower === 'amount' ||
          lower === 'total' ||
          lower.includes('cost') ||
          lower.includes('totalcost'))
      ) {
        mapping.poAmount = h;
      } else if (
        !mapping.paymentStatus &&
        (lower.includes('paymentstatus') || lower.includes('paidstatus') || lower === 'payment' || lower === 'paid')
      ) {
        mapping.paymentStatus = h;
      } else if (
        !mapping.trackingNumber &&
        (lower.includes('trackingno') ||
          lower.includes('trackingnumber') ||
          lower.includes('tracking#') ||
          lower.includes('tracking') ||
          lower.includes('carrier') ||
          lower.includes('awb'))
      ) {
        mapping.trackingNumber = h;
      } else if (
        !mapping.deliveredDate &&
        (lower.includes('delivereddate') ||
          lower.includes('deliverydate') ||
          lower.includes('eta') ||
          lower.includes('expecteddelivery') ||
          lower.includes('duedate'))
      ) {
        mapping.deliveredDate = h;
      } else if (
        !mapping.receivedDate &&
        (lower.includes('receiveddate') ||
          lower.includes('receiptdate') ||
          lower.includes('warehousedate') ||
          lower.includes('intakedate'))
      ) {
        mapping.receivedDate = h;
      } else if (
        !mapping.status &&
        (lower.includes('postatus') || lower.includes('orderstatus') || lower === 'status' || lower === 'state')
      ) {
        mapping.status = h;
      }
    });
    return mapping;
  }

  public normalizePurchasingRows(rows: any[][]): PurchaseOrder[] {
    if (!rows || rows.length < 2) return [];

    // Find header row: look for row containing 'po', 'date', 'reason', 'vendor', 'purchaser', 'platform', etc.
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = (rows[i] || []).map(cell => String(cell || '').toLowerCase().trim());
      const hasPO = row.some(c => c.includes('po') || c.includes('order') || c.includes('purchase'));
      const hasVendorOrDate = row.some(
        c =>
          c.includes('supplier') ||
          c.includes('vendor') ||
          c.includes('date') ||
          c.includes('reason') ||
          c.includes('purchaser') ||
          c.includes('amount') ||
          c.includes('price') ||
          c.includes('platform')
      );
      if (hasPO || hasVendorOrDate) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    const headers = (rows[headerRowIdx] || []).map(h => String(h || '').trim());
    const headerLower = headers.map(h => h.toLowerCase());
    const detected = this.detectPurchasingColumnMapping(headers);

    // Helper to find column index with mapping fallback
    const findCol = (mappedKey: string, keywords: string[]): number => {
      if (detected[mappedKey]) {
        const exact = headers.findIndex(h => h.toLowerCase().trim() === detected[mappedKey].toLowerCase().trim());
        if (exact >= 0) return exact;
      }
      return headerLower.findIndex(h => keywords.some(k => h.includes(k)));
    };

    // 15 Sheet Columns:
    // 1. Date
    const dateCol = findCol('date', ['date', 'po date', 'order date', 'purchase date']);
    // 2. Reason
    const reasonCol = findCol('reason', ['reason', 'purpose', 'why', 'remarks', 'order reason']);
    // 3. Purchaser
    const purchaserCol = findCol('purchaser', ['purchaser', 'buyer', 'purchased by', 'created by', 'agent']);
    // 4. Buying for Platform
    const platformCol = findCol('buyingForPlatform', [
      'buying for platform',
      'for platform',
      'platform',
      'marketplace',
      'channel'
    ]);
    // 5. Buying from Vendor
    const vendorCol = findCol('buyingFromVendor', [
      'buying from vendor',
      'from vendor',
      'vendor',
      'supplier name',
      'supplier',
      'manufacturer'
    ]);
    // 6. Payment Method
    const paymentMethodCol = findCol('paymentMethod', [
      'payment method',
      'pay method',
      'payment type',
      'method',
      'paid via'
    ]);
    // 7. Qty Purchased
    const qtyCol = findCol('qtyPurchased', ['qty purchased', 'quantity purchased', 'quantity', 'qty', 'units', 'count']);
    // 8. Line Item
    const lineItemCol = findCol('lineItem', ['line item', 'lineitem', 'item', 'item name', 'product', 'sku']);
    // 9. PO Number
    const poCol = findCol('poNumber', [
      'po number',
      'po #',
      'po#',
      'po no',
      'purchase order #',
      'purchase order',
      'order #',
      'order id',
      'po'
    ]);
    // 10. PO Amount
    const poAmountCol = findCol('poAmount', [
      'po amount',
      'total amount',
      'amount',
      'purchase amount',
      'total cost',
      'total',
      'cost'
    ]);
    // 11. Payment Status
    const paymentStatusCol = findCol('paymentStatus', ['payment status', 'paid status', 'payment', 'paid']);
    // 12. Tracking No.
    const trackingCol = findCol('trackingNumber', ['tracking no.', 'tracking no', 'tracking number', 'tracking #', 'tracking', 'carrier']);
    // 13. Delivered Date
    const deliveredDateCol = findCol('deliveredDate', ['delivered date', 'delivery date', 'eta', 'expected date', 'due date']);
    // 14. Received Date
    const receivedDateCol = findCol('receivedDate', ['received date', 'receipt date', 'warehouse date', 'intake date']);
    // 15. Status
    const statusCol = findCol('status', ['status', 'po status', 'order status', 'receiving status', 'state']);

    const unitCostCol = findCol('cost', ['unit cost', 'unit price', 'cost per unit', 'cost/unit', 'rate', 'price']);
    const notesCol = findCol('notes', ['notes', 'comments', 'remarks', 'memo']);
    const currencyCol = findCol('currency', ['currency', 'curr']);

    // Map to group items by PO Number
    const poMap = new Map<string, PurchaseOrder>();

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      // Extract raw values matching the sheet
      const rawDate = dateCol >= 0 ? String(row[dateCol] || '').trim() : '';
      const rawReason = reasonCol >= 0 ? String(row[reasonCol] || '').trim() : '';
      const rawPurchaser = purchaserCol >= 0 ? String(row[purchaserCol] || '').trim() : '';
      const rawPlatform = platformCol >= 0 ? String(row[platformCol] || '').trim() : '';
      const rawVendor = vendorCol >= 0 ? String(row[vendorCol] || '').trim() : '';
      const rawPayMethod = paymentMethodCol >= 0 ? String(row[paymentMethodCol] || '').trim() : '';
      const rawQty = qtyCol >= 0 ? this.parseNumber(row[qtyCol]) : 1;
      const rawLineItem = lineItemCol >= 0 ? String(row[lineItemCol] || '').trim() : '';
      const rawPO = poCol >= 0 ? String(row[poCol] || '').trim() : '';
      const rawUnitCost = unitCostCol >= 0 ? this.parseNumber(row[unitCostCol]) : 0;
      const rawTotalAmount =
        poAmountCol >= 0
          ? this.parseNumber(row[poAmountCol])
          : rawQty * (rawUnitCost > 0 ? rawUnitCost : 0);
      const rawPaymentStatus = paymentStatusCol >= 0 ? String(row[paymentStatusCol] || '').trim() : '';
      const rawTracking = trackingCol >= 0 ? String(row[trackingCol] || '').trim() : '';
      const rawDelivered = deliveredDateCol >= 0 ? String(row[deliveredDateCol] || '').trim() : '';
      const rawReceived = receivedDateCol >= 0 ? String(row[receivedDateCol] || '').trim() : '';
      const rawStatus = statusCol >= 0 ? String(row[statusCol] || '').trim() : '';
      const rawNotes = notesCol >= 0 ? String(row[notesCol] || '').trim() : '';
      const rawCurrency = currencyCol >= 0 ? String(row[currencyCol] || '').trim().toUpperCase() : 'USD';

      // Skip empty separator rows
      if (!rawPO && !rawVendor && rawTotalAmount === 0 && !rawLineItem && !rawDate && !rawReason) {
        continue;
      }

      // Generate clean PO number
      const poNumber = rawPO || `PO-GS-${r + 1000}`;
      const uniquePoKey = poNumber.toUpperCase();

      const normalizedDate = this.normalizeDate(rawDate);
      const normalizedStatus = this.normalizePOStatus(rawStatus);
      const normalizedPayment = this.normalizePOPaymentStatus(rawPaymentStatus);

      const itemQty = rawQty > 0 ? rawQty : 1;
      const itemCost =
        rawUnitCost > 0
          ? rawUnitCost
          : rawTotalAmount > 0
          ? Number((rawTotalAmount / itemQty).toFixed(2))
          : 0;
      const itemTotal = rawTotalAmount > 0 ? rawTotalAmount : Number((itemQty * itemCost).toFixed(2));

      let existingPO = poMap.get(uniquePoKey);

      const newItem: PurchaseOrderItem = {
        id: `item_${uniquePoKey}_${existingPO ? existingPO.items.length + 1 : 1}`,
        sku: rawLineItem && rawLineItem.length <= 15 ? rawLineItem.toUpperCase() : `SKU-${uniquePoKey}`,
        productName: rawLineItem || 'Procured Item',
        quantity: itemQty,
        unitCost: itemCost,
        discount: 0,
        tax: 0,
        total: itemTotal,
        quantityReceived:
          normalizedStatus === 'Received' || rawReceived
            ? itemQty
            : normalizedStatus === 'Partially Received'
            ? Math.floor(itemQty / 2)
            : 0
      };

      if (existingPO) {
        // Append item to existing PO
        existingPO.items.push(newItem);
        existingPO.totalQuantity += itemQty;
        existingPO.qtyPurchased = existingPO.totalQuantity;
        existingPO.totalAmount = Number((existingPO.totalAmount + itemTotal).toFixed(2));
        existingPO.poAmount = existingPO.totalAmount;
        existingPO.subtotal = existingPO.totalAmount;
        existingPO.outstandingAmount = existingPO.paymentStatus === 'Paid' ? 0 : existingPO.totalAmount;
        if (normalizedStatus === 'Received' || rawReceived) {
          existingPO.totalReceivedQuantity += itemQty;
        }
      } else {
        const id = `po_gs_${poNumber.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
        const newPO: PurchaseOrder = {
          id,
          poNumber,
          supplierId: `sup_${(rawVendor || 'General Vendor').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`,
          supplierName: rawVendor || 'General Vendor',
          poDate: normalizedDate,
          rawDate: rawDate || undefined,
          reason: rawReason || undefined,
          purchaser: rawPurchaser || 'Austin',
          buyingForPlatform: rawPlatform || 'All Platforms',
          buyingFromVendor: rawVendor || 'General Vendor',
          paymentMethod: rawPayMethod || 'Payoneer',
          qtyPurchased: itemQty,
          lineItem: rawLineItem || '1',
          poAmount: itemTotal,
          expectedDeliveryDate: rawDelivered ? this.normalizeDate(rawDelivered) : normalizedDate,
          deliveredDate: rawDelivered ? this.normalizeDate(rawDelivered) : undefined,
          receivedDate: rawReceived ? this.normalizeDate(rawReceived) : undefined,
          trackingNumber: rawTracking || undefined,
          currency: rawCurrency || 'USD',
          paymentTerms: 'Net 30',
          notes: rawNotes
            ? `[Google Sheets] ${rawNotes}`
            : rawReason
            ? `[Reason] ${rawReason}`
            : '[Google Sheets Live Sync]',
          items: [newItem],
          subtotal: itemTotal,
          totalDiscount: 0,
          totalTax: 0,
          totalAmount: itemTotal,
          paidAmount: normalizedPayment === 'Paid' ? itemTotal : 0,
          outstandingAmount: normalizedPayment === 'Paid' ? 0 : itemTotal,
          status: normalizedStatus,
          paymentStatus: normalizedPayment,
          receivingStatus:
            normalizedStatus === 'Received' || rawReceived
              ? 'Received'
              : normalizedStatus === 'Partially Received'
              ? 'Partially Received'
              : 'Pending',
          totalQuantity: itemQty,
          totalReceivedQuantity:
            normalizedStatus === 'Received' || rawReceived
              ? itemQty
              : normalizedStatus === 'Partially Received'
              ? Math.floor(itemQty / 2)
              : 0,
          createdBy: rawPurchaser || 'Google Sheets Live',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        poMap.set(uniquePoKey, newPO);
      }
    }

    return Array.from(poMap.values());
  }

  // ==========================================
  // NORMALIZATION: RMA SPREADSHEET ROWS
  // ==========================================
  public normalizeRMARows(rows: any[][]): RMAItem[] {
    if (!rows || rows.length < 2) return [];

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = (rows[i] || []).map(cell => String(cell || '').toLowerCase().trim());
      const hasRMA = row.some(c => c.includes('rma') || c.includes('return') || c.includes('refund'));
      const hasOrderOrCustomer = row.some(
        c => c.includes('order') || c.includes('customer') || c.includes('product') || c.includes('sku')
      );
      if (hasRMA || hasOrderOrCustomer) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const headers = (rows[headerRowIdx] || []).map(h => String(h || '').trim());
    const headerLower = headers.map(h => h.toLowerCase());

    const findCol = (keywords: string[]): number => {
      return headerLower.findIndex(h => keywords.some(k => h.includes(k)));
    };

    const rmaCol = findCol(['rma #', 'rma#', 'rma number', 'return #', 'return id', 'case #', 'rma']);
    const orderCol = findCol(['order #', 'order#', 'order number', 'order id', 'sales order', 'order']);
    const dateCol = findCol(['return date', 'rma date', 'order date', 'date', 'requested date']);
    const customerCol = findCol(['customer name', 'customer', 'buyer', 'client', 'name']);
    const emailCol = findCol(['customer email', 'email', 'buyer email']);
    const phoneCol = findCol(['phone', 'contact', 'mobile']);
    const marketplaceCol = findCol(['marketplace', 'channel', 'platform', 'source']);
    const storeCol = findCol(['store', 'store name', 'shop', 'account']);
    const productCol = findCol(['product name', 'product', 'item name', 'item', 'title', 'description']);
    const skuCol = findCol(['sku', 'item code', 'product code', 'model']);
    const qtyCol = findCol(['quantity', 'qty', 'units', 'count']);
    const priceCol = findCol(['sale price', 'price', 'original price', 'unit price', 'amount', 'refund amount']);
    const costCol = findCol(['cost', 'unit cost', 'item cost']);
    const reasonCol = findCol(['reason', 'return reason', 'issue', 'problem', 'cause']);
    const typeCol = findCol(['return type', 'type', 'resolution', 'action']);
    const statusCol = findCol(['status', 'rma status', 'return status', 'state']);
    const trackingCol = findCol(['tracking', 'tracking number', 'carrier']);
    const notesCol = findCol(['notes', 'comments', 'remarks']);

    const rmaItems: RMAItem[] = [];

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rawRMA = rmaCol >= 0 ? String(row[rmaCol] || '').trim() : '';
      const rawOrder = orderCol >= 0 ? String(row[orderCol] || '').trim() : '';
      const rawDate = dateCol >= 0 ? String(row[dateCol] || '').trim() : '';
      const rawCustomer = customerCol >= 0 ? String(row[customerCol] || '').trim() : '';
      const rawEmail = emailCol >= 0 ? String(row[emailCol] || '').trim() : '';
      const rawPhone = phoneCol >= 0 ? String(row[phoneCol] || '').trim() : '';
      const rawMarketplace = marketplaceCol >= 0 ? String(row[marketplaceCol] || '').trim() : 'Direct';
      const rawStore = storeCol >= 0 ? String(row[storeCol] || '').trim() : 'Splus Direct';
      const rawProduct = productCol >= 0 ? String(row[productCol] || '').trim() : '';
      const rawSku = skuCol >= 0 ? String(row[skuCol] || '').trim() : '';
      const rawQty = qtyCol >= 0 ? this.parseNumber(row[qtyCol]) : 1;
      const rawPrice = priceCol >= 0 ? this.parseNumber(row[priceCol]) : 0;
      const rawCost = costCol >= 0 ? this.parseNumber(row[costCol]) : 0;
      const rawReason = reasonCol >= 0 ? String(row[reasonCol] || '').trim() : '';
      const rawType = typeCol >= 0 ? String(row[typeCol] || '').trim() : '';
      const rawStatus = statusCol >= 0 ? String(row[statusCol] || '').trim() : '';
      const rawTracking = trackingCol >= 0 ? String(row[trackingCol] || '').trim() : '';
      const rawNotes = notesCol >= 0 ? String(row[notesCol] || '').trim() : '';

      if (!rawRMA && !rawOrder && !rawCustomer && !rawProduct) {
        continue;
      }

      const rmaNumber = rawRMA || `RMA-GS-${String(r + 1000).padStart(6, '0')}`;
      const id = `rma_gs_${rmaNumber.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

      const normalizedReason = this.normalizeRMAReason(rawReason);
      const normalizedType = this.normalizeRMAType(rawType);
      const normalizedStatus = this.normalizeRMAStatus(rawStatus);
      const normalizedDate = this.normalizeDate(rawDate);

      const rmaItem: RMAItem = {
        id,
        organizationId: DEFAULT_ORG_ID,
        rmaNumber,
        orderNumber: rawOrder || `ORD-${rmaNumber.replace('RMA-', '')}`,
        orderDate: normalizedDate,
        customer: rawCustomer || 'Verified Customer',
        customerEmail: rawEmail || undefined,
        customerPhone: rawPhone || undefined,
        marketplace: rawMarketplace || 'Direct',
        store: rawStore || 'Main Store',
        product: rawProduct || 'Returned Product',
        sku: rawSku || (rawProduct ? rawProduct.slice(0, 10).toUpperCase() : 'SKU-RET'),
        quantity: rawQty > 0 ? rawQty : 1,
        originalSalePrice: rawPrice > 0 ? rawPrice : undefined,
        originalCost: rawCost > 0 ? rawCost : undefined,
        reason: normalizedReason,
        customReason: rawReason || undefined,
        returnType: normalizedType,
        status: normalizedStatus,
        returnTrackingNumber: rawTracking || undefined,
        internalNotes: rawNotes ? `[Google Sheets] ${rawNotes}` : '[Google Sheets Live Sync]',
        timeline: [
          {
            id: `tl_${Date.now()}_${r}`,
            date: normalizedDate,
            time: '12:00:00',
            user: 'Google Sheets Live',
            action: 'Record Synchronized',
            newStatus: normalizedStatus
          }
        ],
        createdBy: 'Google Sheets Live Sync',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      rmaItems.push(rmaItem);
    }

    return rmaItems;
  }

  // ==========================================
  // SYNC ENGINE: PURCHASING (INCREMENTAL & CROSS-USER)
  // ==========================================
  public async syncPurchasing(force: boolean = false): Promise<LiveSyncResult> {
    const target: LiveSheetTarget = 'purchasing';
    if (this.isSyncingMap.get(target)) {
      return {
        success: false,
        message: 'Sync already in progress.',
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString()
      };
    }

    const config = this.getConnectionConfig(target);
    if (!config || !config.isConnected || !config.spreadsheetId) {
      return {
        success: false,
        message: 'Purchasing Google Sheet is not connected.',
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString()
      };
    }

    this.isSyncingMap.set(target, true);
    this.updateConfigStatus(target, 'syncing', 'Fetching latest data from Google Sheets...');

    try {
      const rows = await this.fetchSheetValues(config.spreadsheetId, config.sheetName, config.range);
      const incomingPOs = this.normalizePurchasingRows(rows);

      // Load existing POs (excluding any demo data)
      const existingPOs = this.getStoredPOs().filter(p => !isDemoPO(p.id, p));
      const existingMap = new Map<string, PurchaseOrder>();
      existingPOs.forEach(po => existingMap.set(po.poNumber.toUpperCase().trim(), po));

      let addedCount = 0;
      let updatedCount = 0;
      const incomingKeys = new Set<string>();

      const mergedPOs: PurchaseOrder[] = [];

      // Process incoming POs (Adds & In-Place Updates)
      for (const inc of incomingPOs) {
        const key = inc.poNumber.toUpperCase().trim();
        incomingKeys.add(key);

        const existing = existingMap.get(key);
        if (existing) {
          // Check if data changed
          const hasChanged =
            existing.totalAmount !== inc.totalAmount ||
            existing.status !== inc.status ||
            existing.paymentStatus !== inc.paymentStatus ||
            existing.supplierName !== inc.supplierName ||
            existing.totalQuantity !== inc.totalQuantity ||
            existing.items.length !== inc.items.length;

          if (hasChanged) {
            updatedCount++;
          }

          // Update existing record in-place preserving internal ID and applying sheet modifications
          const updated: PurchaseOrder = {
            ...existing,
            poNumber: inc.poNumber,
            totalAmount: inc.totalAmount,
            poAmount: inc.poAmount ?? inc.totalAmount,
            subtotal: inc.subtotal,
            supplierName: inc.supplierName,
            buyingFromVendor: inc.buyingFromVendor || inc.supplierName,
            status: inc.status,
            paymentStatus: inc.paymentStatus,
            receivingStatus: inc.receivingStatus,
            totalQuantity: inc.totalQuantity,
            qtyPurchased: inc.qtyPurchased ?? inc.totalQuantity,
            totalReceivedQuantity: inc.totalReceivedQuantity,
            items: inc.items,
            poDate: inc.poDate,
            rawDate: inc.rawDate || existing.rawDate,
            reason: inc.reason || existing.reason,
            purchaser: inc.purchaser || existing.purchaser,
            buyingForPlatform: inc.buyingForPlatform || existing.buyingForPlatform,
            paymentMethod: inc.paymentMethod || existing.paymentMethod,
            lineItem: inc.lineItem || existing.lineItem,
            trackingNumber: inc.trackingNumber || existing.trackingNumber,
            deliveredDate: inc.deliveredDate || existing.deliveredDate,
            receivedDate: inc.receivedDate || existing.receivedDate,
            expectedDeliveryDate: inc.expectedDeliveryDate || existing.expectedDeliveryDate,
            notes: inc.notes || existing.notes,
            updatedAt: new Date().toISOString()
          };
          (updated as any).isDeletedFromSource = false;
          (updated as any).source = 'google_sheets';
          mergedPOs.push(updated);
        } else {
          // New PO detected from Google Sheet
          addedCount++;
          (inc as any).isDeletedFromSource = false;
          (inc as any).source = 'google_sheets';
          mergedPOs.push(inc);
        }
      }

      // Safe Deletion Handling:
      // Rows removed from Google Sheet are kept in history but marked as deletedFromSource
      let archivedCount = 0;
      for (const [key, existing] of existingMap.entries()) {
        if (!incomingKeys.has(key)) {
          // Record was in previous sheet but removed in latest
          archivedCount++;
          const archived = {
            ...existing,
            updatedAt: new Date().toISOString(),
            isDeletedFromSource: true
          };
          mergedPOs.push(archived);
        }
      }

      // Active records count
      const activePOs = mergedPOs.filter(po => !(po as any).isDeletedFromSource);

      // Save to localStorage & Central Firestore
      this.saveStoredPOs(mergedPOs);
      await this.savePOsToFirestore(activePOs);

      // Extract suppliers from active POs and sync them too
      this.syncSuppliersFromPOs(activePOs);

      const timestamp = new Date().toISOString();
      const message = `Synchronized successfully: ${activePOs.length} active purchase orders (${addedCount} added, ${updatedCount} updated).`;

      // Update config status
      this.updateConfigStatus(target, 'live', message, timestamp, activePOs.length);

      // Notify UI listeners
      this.notifyPOListeners(activePOs);

      return {
        success: true,
        message,
        addedCount,
        updatedCount,
        archivedCount,
        totalActiveCount: activePOs.length,
        timestamp
      };
    } catch (error: any) {
      const errMsg = error?.message || 'Failed to sync with Google Sheet.';
      console.warn('Purchasing Google Sheet sync notice:', errMsg);
      this.updateConfigStatus(target, 'error', errMsg);
      return {
        success: false,
        message: errMsg,
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString(),
        rawError: String(error)
      };
    } finally {
      this.isSyncingMap.set(target, false);
    }
  }

  // ==========================================
  // SYNC ENGINE: RMA (INCREMENTAL & CROSS-USER)
  // ==========================================
  public async syncRMA(force: boolean = false): Promise<LiveSyncResult> {
    const target: LiveSheetTarget = 'rma';
    if (this.isSyncingMap.get(target)) {
      return {
        success: false,
        message: 'Sync already in progress.',
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString()
      };
    }

    const config = this.getConnectionConfig(target);
    if (!config || !config.isConnected || !config.spreadsheetId) {
      return {
        success: false,
        message: 'RMA Google Sheet is not connected.',
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString()
      };
    }

    this.isSyncingMap.set(target, true);
    this.updateConfigStatus(target, 'syncing', 'Fetching latest data from RMA Google Sheet...');

    try {
      const rows = await this.fetchSheetValues(config.spreadsheetId, config.sheetName, config.range);
      const incomingRMAs = this.normalizeRMARows(rows);

      const existingRMAs = this.getStoredRMAs();
      const existingMap = new Map<string, RMAItem>();
      existingRMAs.forEach(rma => existingMap.set(rma.rmaNumber.toUpperCase().trim(), rma));

      let addedCount = 0;
      let updatedCount = 0;
      const incomingKeys = new Set<string>();

      const mergedRMAs: RMAItem[] = [];

      for (const inc of incomingRMAs) {
        const key = inc.rmaNumber.toUpperCase().trim();
        incomingKeys.add(key);

        const existing = existingMap.get(key);
        if (existing) {
          const hasChanged =
            existing.status !== inc.status ||
            existing.originalSalePrice !== inc.originalSalePrice ||
            existing.reason !== inc.reason ||
            existing.returnType !== inc.returnType ||
            existing.quantity !== inc.quantity;

          if (hasChanged) {
            updatedCount++;
          }

          const updated: RMAItem = {
            ...existing,
            orderNumber: inc.orderNumber,
            customer: inc.customer,
            product: inc.product,
            sku: inc.sku,
            quantity: inc.quantity,
            originalSalePrice: inc.originalSalePrice,
            originalCost: inc.originalCost,
            reason: inc.reason,
            returnType: inc.returnType,
            status: inc.status,
            orderDate: inc.orderDate,
            returnTrackingNumber: inc.returnTrackingNumber || existing.returnTrackingNumber,
            internalNotes: inc.internalNotes || existing.internalNotes,
            updatedAt: new Date().toISOString()
          };
          (updated as any).isDeletedFromSource = false;
          (updated as any).source = 'google_sheets';
          mergedRMAs.push(updated);
        } else {
          addedCount++;
          (inc as any).isDeletedFromSource = false;
          (inc as any).source = 'google_sheets';
          mergedRMAs.push(inc);
        }
      }

      let archivedCount = 0;
      for (const [key, existing] of existingMap.entries()) {
        if (!incomingKeys.has(key)) {
          archivedCount++;
          const archived = {
            ...existing,
            updatedAt: new Date().toISOString(),
            isDeletedFromSource: true
          };
          mergedRMAs.push(archived);
        }
      }

      const activeRMAs = mergedRMAs.filter(r => !(r as any).isDeletedFromSource);

      this.saveStoredRMAs(mergedRMAs);
      await this.saveRMAsToFirestore(activeRMAs);

      const timestamp = new Date().toISOString();
      const message = `Synchronized successfully: ${activeRMAs.length} active RMA records (${addedCount} added, ${updatedCount} updated).`;

      this.updateConfigStatus(target, 'live', message, timestamp, activeRMAs.length);
      this.notifyRMAListeners(activeRMAs);

      return {
        success: true,
        message,
        addedCount,
        updatedCount,
        archivedCount,
        totalActiveCount: activeRMAs.length,
        timestamp
      };
    } catch (error: any) {
      const errMsg = error?.message || 'Failed to sync RMA Google Sheet.';
      console.warn('RMA Google Sheet sync notice:', errMsg);
      this.updateConfigStatus(target, 'error', errMsg);
      return {
        success: false,
        message: errMsg,
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString(),
        rawError: String(error)
      };
    } finally {
      this.isSyncingMap.set(target, false);
    }
  }

  // ==========================================
  // SYNC ENGINE: SALES (INCREMENTAL & LIVE)
  // ==========================================
  public async syncSales(force: boolean = false): Promise<LiveSyncResult> {
    const target: LiveSheetTarget = 'sales';
    if (this.isSyncingMap.get(target)) {
      return {
        success: false,
        message: 'Sync already in progress.',
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString()
      };
    }

    const config = this.getConnectionConfig(target);
    if (!config || !config.isConnected || !config.spreadsheetId) {
      return {
        success: false,
        message: 'Sales Google Sheet is not connected.',
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString()
      };
    }

    this.isSyncingMap.set(target, true);
    this.updateConfigStatus(target, 'syncing', 'Fetching latest data from Sales Google Sheet...');

    try {
      const rows = await this.fetchSheetValues(config.spreadsheetId, config.sheetName, config.range);
      const incomingSales = this.normalizeSalesRows(rows, config.columnMapping);

      const existingSales = this.getStoredSales();
      const existingMap = new Map<string, SalesRecord>();
      existingSales.forEach(s => {
        const key = (s.orderId || s.id).toUpperCase().trim();
        existingMap.set(key, s);
      });

      let addedCount = 0;
      let updatedCount = 0;
      const incomingKeys = new Set<string>();
      const mergedSales: SalesRecord[] = [];

      // Process incoming records (Adds & In-Place Updates)
      for (const inc of incomingSales) {
        const key = (inc.orderId || inc.id).toUpperCase().trim();
        incomingKeys.add(key);

        const existing = existingMap.get(key);
        if (existing) {
          const hasChanged =
            existing.sales !== inc.sales ||
            existing.units !== inc.units ||
            existing.cost !== inc.cost ||
            existing.profit !== inc.profit ||
            existing.orderStatus !== inc.orderStatus ||
            existing.date !== inc.date ||
            existing.marketplace !== inc.marketplace ||
            existing.store !== inc.store;

          if (hasChanged) {
            updatedCount++;
          }

          const updated: SalesRecord = {
            ...existing,
            date: inc.date || existing.date,
            marketplace: inc.marketplace || existing.marketplace,
            store: inc.store || existing.store,
            product: inc.product || existing.product,
            sku: inc.sku || existing.sku,
            category: inc.category || existing.category,
            units: inc.units,
            sales: inc.sales,
            cost: inc.cost !== undefined ? inc.cost : existing.cost,
            profit: inc.profit !== undefined ? inc.profit : existing.profit,
            orderStatus: inc.orderStatus || existing.orderStatus,
            paymentStatus: inc.paymentStatus || existing.paymentStatus,
            channel: inc.channel || existing.channel,
            customFields: { ...existing.customFields, ...inc.customFields }
          };
          (updated as any).isDeletedFromSource = false;
          (updated as any).source = 'google_sheets';
          mergedSales.push(updated);
        } else {
          addedCount++;
          (inc as any).isDeletedFromSource = false;
          (inc as any).source = 'google_sheets';
          mergedSales.push(inc);
        }
      }

      // Safe Deletion Handling:
      // Rows removed from Google Sheet are kept in history but marked as deletedFromSource
      let archivedCount = 0;
      for (const [key, existing] of existingMap.entries()) {
        if (!incomingKeys.has(key)) {
          if ((existing as any).source === 'google_sheets' || existing.importBatchId === 'batch_google_sheets_live') {
            archivedCount++;
            const archived: SalesRecord = {
              ...existing,
              ...({ isDeletedFromSource: true } as any)
            };
            mergedSales.push(archived);
          } else {
            // Keep manually uploaded records intact
            mergedSales.push(existing);
          }
        }
      }

      const activeSales = mergedSales.filter(s => !(s as any).isDeletedFromSource);

      // Save to localStorage & Central Firestore
      this.saveStoredSales(mergedSales);
      StorageService.saveRecords(activeSales);
      await CentralDataService.saveLiveSalesToFirestore(activeSales);

      const timestamp = new Date().toISOString();
      const message = `Synchronized successfully: ${activeSales.length} active orders (${addedCount} added, ${updatedCount} updated).`;

      this.updateConfigStatus(target, 'live', message, timestamp, activeSales.length);
      this.notifySalesListeners(activeSales);

      return {
        success: true,
        message,
        addedCount,
        updatedCount,
        archivedCount,
        totalActiveCount: activeSales.length,
        timestamp
      };
    } catch (error: any) {
      const errMsg = error?.message || 'Failed to sync Sales Google Sheet.';
      console.warn('Sales Google Sheet sync notice:', errMsg);
      this.updateConfigStatus(target, 'error', errMsg);
      return {
        success: false,
        message: errMsg,
        addedCount: 0,
        updatedCount: 0,
        archivedCount: 0,
        totalActiveCount: 0,
        timestamp: new Date().toISOString(),
        rawError: String(error)
      };
    } finally {
      this.isSyncingMap.set(target, false);
    }
  }

  // ==========================================
  // CONFIG MANAGEMENT & FIRESTORE PERSISTENCE
  // ==========================================
  public getConnectionConfig(target: LiveSheetTarget): LiveSheetConnectionConfig | null {
    if (typeof window === 'undefined') return null;
    const key =
      target === 'purchasing'
        ? STORAGE_KEYS.CONFIG_PURCHASING
        : target === 'rma'
        ? STORAGE_KEYS.CONFIG_RMA
        : STORAGE_KEYS.CONFIG_SALES;
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not read sheet config:', e);
    }
    return null;
  }

  public async saveConnectionConfig(config: LiveSheetConnectionConfig): Promise<void> {
    const key =
      config.target === 'purchasing'
        ? STORAGE_KEYS.CONFIG_PURCHASING
        : config.target === 'rma'
        ? STORAGE_KEYS.CONFIG_RMA
        : STORAGE_KEYS.CONFIG_SALES;
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(config));
    }

    // Save to shared Firestore organization document
    try {
      const ref = doc(db, 'organizations', DEFAULT_ORG_ID, 'live_sheets_config', config.target);
      await setDoc(ref, config, { merge: true });
    } catch (e) {
      console.warn('Firestore live sheets config save notice:', e);
    }

    this.notifyConfigListeners(config.target, config);
    this.initAutoPolling(config.target);
  }

  public async disconnect(target: LiveSheetTarget): Promise<void> {
    const existing = this.getConnectionConfig(target);
    const updated: LiveSheetConnectionConfig = {
      target,
      spreadsheetId: existing?.spreadsheetId || '',
      spreadsheetUrl: existing?.spreadsheetUrl || '',
      spreadsheetTitle: existing?.spreadsheetTitle || '',
      sheetName: existing?.sheetName || 'Sheet1',
      isConnected: false,
      autoSyncIntervalSec: target === 'sales' ? 30 : 60,
      lastSyncStatus: 'disconnected',
      lastSyncMessage: 'Disconnected from Google Sheets'
    };
    await this.saveConnectionConfig(updated);
  }

  private updateConfigStatus(
    target: LiveSheetTarget,
    status: 'live' | 'syncing' | 'error' | 'disconnected',
    message?: string,
    lastSyncAt?: string,
    rowCount?: number
  ) {
    const current = this.getConnectionConfig(target);
    if (!current) return;
    const updated: LiveSheetConnectionConfig = {
      ...current,
      lastSyncStatus: status,
      lastSyncMessage: message || current.lastSyncMessage,
      lastSyncAt: lastSyncAt || current.lastSyncAt,
      rowCount: rowCount !== undefined ? rowCount : current.rowCount
    };
    this.saveConnectionConfig(updated);
  }

  // ==========================================
  // REAL-TIME FIRESTORE SYNCHRONIZATION
  // ==========================================
  private initFirestoreRealtime(target: LiveSheetTarget) {
    try {
      // Listen to config changes
      const configRef = doc(db, 'organizations', DEFAULT_ORG_ID, 'live_sheets_config', target);
      onSnapshot(
        configRef,
        snap => {
          if (snap.exists()) {
            const remoteConfig = snap.data() as LiveSheetConnectionConfig;
            const localKey =
              target === 'purchasing'
                ? STORAGE_KEYS.CONFIG_PURCHASING
                : target === 'rma'
                ? STORAGE_KEYS.CONFIG_RMA
                : STORAGE_KEYS.CONFIG_SALES;
            localStorage.setItem(localKey, JSON.stringify(remoteConfig));
            this.notifyConfigListeners(target, remoteConfig);
          }
        },
        err => {
          // Silent notice
        }
      );

      if (target === 'sales') {
        // Sales records are streamed through CentralDataService organization snapshots
        return;
      }

      // Listen to central collection changes
      const colName = target === 'purchasing' ? 'purchasing_pos' : 'rma_records';
      const colRef = collection(db, 'organizations', DEFAULT_ORG_ID, colName);
      onSnapshot(
        colRef,
        snap => {
          if (target === 'purchasing') {
            const pos: PurchaseOrder[] = [];
            snap.docs.forEach(d => {
              const data = d.data() as PurchaseOrder;
              if (isDemoPO(d.id, data)) {
                deleteDoc(doc(db, 'organizations', DEFAULT_ORG_ID, 'purchasing_pos', d.id)).catch(() => {});
                return;
              }
              pos.push({ id: d.id, ...data });
            });
            this.saveStoredPOs(pos);
            this.notifyPOListeners(pos.filter(p => !(p as any).isDeletedFromSource));
          } else {
            const rmas: RMAItem[] = [];
            snap.docs.forEach(d => {
              const data = d.data() as RMAItem;
              if (data?.id?.toLowerCase().includes('seed') || (data as any)?.isDemo) {
                deleteDoc(doc(db, 'organizations', DEFAULT_ORG_ID, 'rma_records', d.id)).catch(() => {});
                return;
              }
              rmas.push({ id: d.id, ...data });
            });
            this.saveStoredRMAs(rmas);
            this.notifyRMAListeners(rmas.filter(r => !(r as any).isDeletedFromSource));
          }
        },
        err => {
          // Silent notice
        }
      );
    } catch (e) {
      console.warn('Realtime listener init notice:', e);
    }
  }

  private async savePOsToFirestore(pos: PurchaseOrder[]): Promise<void> {
    try {
      for (const po of pos) {
        const ref = doc(db, 'organizations', DEFAULT_ORG_ID, 'purchasing_pos', po.id);
        await setDoc(ref, po, { merge: true });
      }
    } catch (e) {
      console.warn('Could not save POs to central Firestore:', e);
    }
  }

  private async saveRMAsToFirestore(rmas: RMAItem[]): Promise<void> {
    try {
      for (const rma of rmas) {
        const ref = doc(db, 'organizations', DEFAULT_ORG_ID, 'rma_records', rma.id);
        await setDoc(ref, rma, { merge: true });
      }
    } catch (e) {
      console.warn('Could not save RMAs to central Firestore:', e);
    }
  }

  private syncSuppliersFromPOs(pos: PurchaseOrder[]): void {
    try {
      const supplierNames = Array.from(new Set(pos.map(p => p.supplierName).filter(Boolean)));
      if (supplierNames.length === 0) return;

      const storedRaw = localStorage.getItem('splus_purchasing_suppliers_v1');
      let suppliers: Supplier[] = storedRaw ? JSON.parse(storedRaw) : [];
      // Clean out any demo suppliers
      suppliers = suppliers.filter(s => !isDemoSupplier(s.id, s));
      const supMap = new Map<string, Supplier>();
      suppliers.forEach(s => supMap.set(s.name.toLowerCase().trim(), s));

      supplierNames.forEach((name, idx) => {
        const lower = name.toLowerCase().trim();
        if (!supMap.has(lower)) {
          const newSup: Supplier = {
            id: `sup_${lower.replace(/[^a-z0-9_-]/g, '_')}`,
            code: `SUP-GS-${idx + 1}`,
            name,
            contactPerson: 'Vendor Rep',
            phone: 'N/A',
            email: 'procurement@vendor.com',
            country: 'United States',
            paymentTerms: 'Net 30',
            status: 'Active',
            notes: 'Created via Google Sheets Live Sync',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          suppliers.push(newSup);
          supMap.set(lower, newSup);
        }
      });

      localStorage.setItem('splus_purchasing_suppliers_v1', JSON.stringify(suppliers));
    } catch (e) {
      console.warn('Supplier sync notice:', e);
    }
  }

  // ==========================================
  // STORAGE HELPERS
  // ==========================================
  public getStoredPOs(): PurchaseOrder[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LIVE_POS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            p =>
              !(p as any).isDeletedFromSource &&
              !isDemoPO(p.id, p)
          );
        }
      }
    } catch (e) {}
    return [];
  }

  public saveStoredPOs(pos: PurchaseOrder[]): void {
    if (typeof window === 'undefined') return;
    try {
      const clean = pos.filter(p => !isDemoPO(p.id, p));
      localStorage.setItem(STORAGE_KEYS.LIVE_POS, JSON.stringify(clean));
      localStorage.setItem('splus_purchasing_pos_v1', JSON.stringify(clean));
    } catch (e) {}
  }

  public getStoredRMAs(): RMAItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LIVE_RMAS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            r =>
              !(r as any).isDeletedFromSource &&
              !r.id?.toLowerCase().includes('seed') &&
              !(r as any).isDemo
          );
        }
      }
    } catch (e) {}
    return [];
  }

  public saveStoredRMAs(rmas: RMAItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.LIVE_RMAS, JSON.stringify(rmas));
      localStorage.setItem('splus_rma_records_v1', JSON.stringify(rmas));
    } catch (e) {}
  }

  public getStoredSales(): SalesRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LIVE_SALES) || localStorage.getItem('splus_sales_records_v1');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  public saveStoredSales(sales: SalesRecord[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.LIVE_SALES, JSON.stringify(sales));
    } catch (e) {}
  }

  // ==========================================
  // AUTO-POLLING INTERVAL ENGINE
  // ==========================================
  private initAutoPolling(target: LiveSheetTarget) {
    if (this.pollingTimers.has(target)) {
      clearInterval(this.pollingTimers.get(target));
    }

    const config = this.getConnectionConfig(target);
    const intervalSec =
      config?.autoSyncIntervalSec && config.autoSyncIntervalSec >= 10
        ? config.autoSyncIntervalSec
        : target === 'sales'
        ? 30
        : 60;

    const timer = setInterval(() => {
      this.syncIfConnected(target);
    }, intervalSec * 1000);

    this.pollingTimers.set(target, timer);
  }

  public async syncIfConnected(target: LiveSheetTarget) {
    const config = this.getConnectionConfig(target);
    if (config && config.isConnected && config.spreadsheetId) {
      // If previous attempt resulted in authentication requirement error and we don't have a token,
      // pause automatic background polling until user authorizes or triggers manual sync
      if (
        config.lastSyncStatus === 'error' &&
        config.lastSyncMessage?.includes('Authorize Google Account') &&
        !(await getGoogleSheetsAccessToken())
      ) {
        return;
      }
      if (target === 'purchasing') {
        await this.syncPurchasing();
      } else if (target === 'rma') {
        await this.syncRMA();
      } else if (target === 'sales') {
        await this.syncSales();
      }
    }
  }

  // ==========================================
  // SUBSCRIBERS
  // ==========================================
  public subscribeToConfig(target: LiveSheetTarget, listener: ConfigListener): () => void {
    const listeners = this.configListeners.get(target);
    listeners?.add(listener);
    listener(this.getConnectionConfig(target));
    return () => {
      listeners?.delete(listener);
    };
  }

  public subscribeToPOs(listener: POListener): () => void {
    this.poListeners.add(listener);
    const active = this.getStoredPOs().filter(p => !(p as any).isDeletedFromSource);
    listener(active);
    return () => {
      this.poListeners.delete(listener);
    };
  }

  public subscribeToRMAs(listener: RMAListener): () => void {
    this.rmaListeners.add(listener);
    const active = this.getStoredRMAs().filter(r => !(r as any).isDeletedFromSource);
    listener(active);
    return () => {
      this.rmaListeners.delete(listener);
    };
  }

  public subscribeToSales(listener: SalesListener): () => void {
    this.salesListeners.add(listener);
    const active = this.getStoredSales().filter(r => !(r as any).isDeletedFromSource);
    listener(active);
    return () => {
      this.salesListeners.delete(listener);
    };
  }

  private notifyConfigListeners(target: LiveSheetTarget, config: LiveSheetConnectionConfig) {
    this.configListeners.get(target)?.forEach(l => {
      try {
        l(config);
      } catch {}
    });
  }

  private notifySalesListeners(records: SalesRecord[]) {
    this.salesListeners.forEach(l => {
      try {
        l(records);
      } catch {}
    });
  }

  private notifyPOListeners(pos: PurchaseOrder[]) {
    this.poListeners.forEach(l => {
      try {
        l(pos);
      } catch {}
    });
  }

  private notifyRMAListeners(rmas: RMAItem[]) {
    this.rmaListeners.forEach(l => {
      try {
        l(rmas);
      } catch {}
    });
  }

  // ==========================================
  // VALUE PARSERS & ENUM NORMALIZERS
  // ==========================================
  private parseNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  public normalizeDate(val: any): string {
    if (val === null || val === undefined || val === '') {
      return new Date().toISOString().slice(0, 10);
    }
    const str = String(val).trim();
    if (!str) return new Date().toISOString().slice(0, 10);

    // 1. Check Excel serial number (e.g. 45659)
    if (/^\d{4,6}$/.test(str)) {
      const serial = parseInt(str, 10);
      const utcDays = Math.floor(serial - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }

    // 2. Format: D-MMM-YYYY or DD-MMM-YYYY or D/MMM/YYYY (e.g. "2-Jan-2026", "02-Jan-2026")
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const dMmmY = /^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/;
    const m1 = str.match(dMmmY);
    if (m1) {
      const day = m1[1].padStart(2, '0');
      const mKey = m1[2].toLowerCase().slice(0, 3);
      const m = monthMap[mKey];
      let y = m1[3];
      if (y.length === 2) y = `20${y}`;
      if (m) return `${y}-${m}-${day}`;
    }

    // 3. Format: MMM-D-YYYY (e.g. "Jan-2-2026", "Jan 02, 2026")
    const mmmDY = /^([A-Za-z]{3,9})[-/\s](\d{1,2})[-/,\s]+(\d{2,4})$/;
    const m2 = str.match(mmmDY);
    if (m2) {
      const mKey = m2[1].toLowerCase().slice(0, 3);
      const m = monthMap[mKey];
      const day = m2[2].padStart(2, '0');
      let y = m2[3];
      if (y.length === 2) y = `20${y}`;
      if (m) return `${y}-${m}-${day}`;
    }

    // 4. ISO format: YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    // 5. Slash/Dash format: DD/MM/YYYY or MM/DD/YYYY
    const slashMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (slashMatch) {
      const p1 = parseInt(slashMatch[1], 10);
      const p2 = parseInt(slashMatch[2], 10);
      let y = slashMatch[3];
      if (y.length === 2) y = `20${y}`;
      if (p1 > 12) {
        return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
      return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }

    // 6. Generic Date fallback
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    return new Date().toISOString().slice(0, 10);
  }

  private normalizePOStatus(val: string): POStatus | string {
    if (!val) return 'Ordered';
    const s = String(val || '').toLowerCase().trim();
    if (s.includes('receive') || s.includes('complete') || s.includes('delivered')) return 'Received';
    if (s.includes('part')) return 'Partially Received';
    if (s.includes('order') || s.includes('in transit') || s.includes('transit')) return 'Ordered';
    if (s.includes('cancel')) return 'Cancelled';
    if (s.includes('approv')) return 'Approved';
    if (s.includes('pend')) return 'Pending Approval';
    if (s.includes('close')) return 'Closed';
    if (s.includes('draft')) return 'Draft';
    return val.trim();
  }

  private normalizePOPaymentStatus(val: string): POPaymentStatus | string {
    if (!val) return 'Unpaid';
    const s = String(val || '').toLowerCase().trim();
    if (s.includes('paid') || s.includes('complete') || s.includes('settled')) return 'Paid';
    if (s.includes('part')) return 'Partially Paid';
    if (s.includes('cancel')) return 'Cancelled';
    if (s.includes('unpaid') || s.includes('due') || s.includes('pend')) return 'Unpaid';
    return val.trim();
  }

  private normalizeRMAStatus(val: string): RMAStatus {
    const s = String(val || '').toLowerCase().trim();
    if (s.includes('refunded')) return 'refunded';
    if (s.includes('complete') || s.includes('closed')) return 'completed';
    if (s.includes('reject')) return 'rejected';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('inspect') && s.includes('done')) return 'inspection_completed';
    if (s.includes('inspect')) return 'under_inspection';
    if (s.includes('transit')) return 'return_in_transit';
    if (s.includes('received')) return 'received';
    if (s.includes('approved')) return 'approved';
    return 'requested';
  }

  private normalizeRMAReason(val: string): ReturnReason {
    const s = String(val || '').toLowerCase().trim();
    if (s.includes('defect') || s.includes('broken') || s.includes('faulty') || s.includes('not working')) {
      return 'defective_product';
    }
    if (s.includes('transit') || s.includes('damage') || s.includes('crush')) {
      return 'damaged_in_transit';
    }
    if (s.includes('wrong item') || s.includes('wrong product') || s.includes('incorrect item')) {
      return 'wrong_product';
    }
    if (s.includes('size') || s.includes('fit')) {
      return 'wrong_size';
    }
    if (s.includes('missing') || s.includes('part') || s.includes('accessory')) {
      return 'missing_parts';
    }
    if (s.includes('describe') || s.includes('match') || s.includes('listing')) {
      return 'not_as_described';
    }
    if (s.includes('mind') || s.includes('remorse') || s.includes('unwanted')) {
      return 'customer_changed_mind';
    }
    if (s.includes('quality')) {
      return 'quality_issue';
    }
    return 'other';
  }

  private normalizeRMAType(val: string): ReturnType {
    const s = String(val || '').toLowerCase().trim();
    if (s.includes('replace')) return 'replacement';
    if (s.includes('exchange')) return 'exchange';
    if (s.includes('repair')) return 'repair';
    if (s.includes('credit')) return 'store_credit';
    return 'refund';
  }

  // ==========================================
  // SALES PARSING & NORMALIZATION HELPERS
  // ==========================================
  public detectSalesColumnMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    headers.forEach(h => {
      const lower = h.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (
        !mapping.orderId &&
        (lower.includes('orderid') ||
          lower === 'order' ||
          lower.includes('orderno') ||
          lower.includes('invoiceno') ||
          lower === 'id' ||
          lower.includes('transactionid'))
      ) {
        mapping.orderId = h;
      } else if (
        !mapping.date &&
        (lower.includes('orderdate') ||
          lower === 'date' ||
          lower.includes('saledate') ||
          lower.includes('purchasedate') ||
          lower.includes('createdat'))
      ) {
        mapping.date = h;
      } else if (
        !mapping.marketplace &&
        (lower.includes('marketplace') || lower.includes('platform') || lower === 'channel' || lower === 'source')
      ) {
        mapping.marketplace = h;
      } else if (
        !mapping.store &&
        (lower.includes('storename') || lower.includes('store') || lower.includes('shop') || lower.includes('account'))
      ) {
        mapping.store = h;
      } else if (
        !mapping.sku &&
        (lower.includes('sku') || lower.includes('itemcode') || lower.includes('productcode') || lower === 'code')
      ) {
        mapping.sku = h;
      } else if (
        !mapping.product &&
        (lower.includes('productname') ||
          lower.includes('product') ||
          lower.includes('itemname') ||
          lower.includes('item') ||
          lower.includes('title') ||
          lower.includes('description'))
      ) {
        mapping.product = h;
      } else if (
        !mapping.units &&
        (lower.includes('quantity') || lower === 'qty' || lower === 'units' || lower === 'pieces' || lower === 'count')
      ) {
        mapping.units = h;
      } else if (
        !mapping.sellingPrice &&
        (lower.includes('sellingprice') ||
          lower.includes('unitprice') ||
          lower.includes('itemprice') ||
          lower === 'price' ||
          lower === 'rate')
      ) {
        mapping.sellingPrice = h;
      } else if (
        !mapping.cost &&
        (lower.includes('unitcost') || lower.includes('cogs') || lower.includes('costprice') || lower === 'cost')
      ) {
        mapping.cost = h;
      } else if (
        !mapping.sales &&
        (lower.includes('revenue') ||
          lower.includes('totalsales') ||
          lower.includes('grosssales') ||
          lower.includes('totalamount') ||
          lower === 'sales' ||
          lower === 'total')
      ) {
        mapping.sales = h;
      } else if (
        !mapping.profit &&
        (lower.includes('profit') || lower.includes('netmargin') || lower.includes('margin'))
      ) {
        mapping.profit = h;
      } else if (
        !mapping.customer &&
        (lower.includes('customer') || lower.includes('buyer') || lower.includes('client'))
      ) {
        mapping.customer = h;
      } else if (
        !mapping.orderStatus &&
        (lower.includes('orderstatus') || lower === 'status' || lower.includes('state'))
      ) {
        mapping.orderStatus = h;
      } else if (
        !mapping.paymentStatus &&
        (lower.includes('paymentstatus') || lower.includes('payment') || lower.includes('paid'))
      ) {
        mapping.paymentStatus = h;
      }
    });
    return mapping;
  }

  private normalizeMarketplace(val: string): string {
    const s = String(val || '').toLowerCase();
    if (s.includes('amazon') || s.includes('amz') || s.includes('fba') || s.includes('fbm')) return 'Amazon';
    if (s.includes('tiktok') || s.includes('tt')) return 'TikTok Shop';
    if (s.includes('ebay')) return 'eBay';
    if (s.includes('shopify') || s.includes('direct')) return 'Shopify';
    if (s.includes('walmart')) return 'Walmart';
    if (s.includes('etsy')) return 'Etsy';
    if (val && val.trim().length > 0) {
      return val.trim();
    }
    return 'Amazon';
  }

  public normalizeSalesRows(rows: any[][], customMapping?: Record<string, string>): SalesRecord[] {
    if (!rows || rows.length < 2) return [];

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = (rows[i] || []).map(cell => String(cell || '').toLowerCase().trim());
      const hasOrder = row.some(
        c => c.includes('order') || c.includes('invoice') || c.includes('transaction') || c === 'id'
      );
      const hasSalesOrDate = row.some(
        c =>
          c.includes('date') ||
          c.includes('sales') ||
          c.includes('revenue') ||
          c.includes('price') ||
          c.includes('amount') ||
          c.includes('sku')
      );
      if (hasOrder || hasSalesOrDate) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    const headers = (rows[headerRowIdx] || []).map(h => String(h || '').trim());
    const headerLower = headers.map(h => h.toLowerCase());

    const detected = this.detectSalesColumnMapping(headers);
    const mapping = { ...detected, ...(customMapping || {}) };

    const getColIdx = (fieldName: string, keywords: string[]): number => {
      if (mapping[fieldName]) {
        const exact = headers.findIndex(h => h.toLowerCase().trim() === mapping[fieldName].toLowerCase().trim());
        if (exact >= 0) return exact;
      }
      return headerLower.findIndex(h => keywords.some(k => h.includes(k)));
    };

    const orderIdCol = getColIdx('orderId', [
      'order id',
      'order_id',
      'order #',
      'order#',
      'order no',
      'invoice',
      'sales id',
      'transaction id',
      'id'
    ]);
    const dateCol = getColIdx('date', ['order date', 'order_date', 'sale date', 'purchase date', 'date', 'created']);
    const marketplaceCol = getColIdx('marketplace', ['marketplace', 'platform', 'channel', 'source']);
    const storeCol = getColIdx('store', ['store name', 'store', 'shop name', 'shop', 'account']);
    const skuCol = getColIdx('sku', ['sku', 'item code', 'product code', 'model', 'code']);
    const productCol = getColIdx('product', [
      'product name',
      'product',
      'item name',
      'item title',
      'title',
      'item',
      'description'
    ]);
    const unitsCol = getColIdx('units', ['quantity', 'qty', 'units', 'pieces', 'count']);
    const priceCol = getColIdx('sellingPrice', ['selling price', 'unit price', 'item price', 'price', 'rate']);
    const costCol = getColIdx('cost', ['unit cost', 'cogs', 'cost price', 'cost per unit', 'cost']);
    const salesCol = getColIdx('sales', [
      'revenue',
      'total sales',
      'total revenue',
      'gross sales',
      'sales amount',
      'total amount',
      'sales',
      'total'
    ]);
    const profitCol = getColIdx('profit', ['profit', 'net profit', 'margin']);
    const customerCol = getColIdx('customer', ['customer name', 'customer', 'buyer name', 'buyer', 'client']);
    const statusCol = getColIdx('orderStatus', ['order status', 'status', 'state']);
    const paymentCol = getColIdx('paymentStatus', ['payment status', 'paid status', 'payment', 'paid']);

    const salesList: SalesRecord[] = [];

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rawOrderId = orderIdCol >= 0 ? String(row[orderIdCol] || '').trim() : '';
      const rawDate = dateCol >= 0 ? String(row[dateCol] || '').trim() : '';
      const rawMarketplace = marketplaceCol >= 0 ? String(row[marketplaceCol] || '').trim() : '';
      const rawStore = storeCol >= 0 ? String(row[storeCol] || '').trim() : '';
      const rawSku = skuCol >= 0 ? String(row[skuCol] || '').trim() : '';
      const rawProduct = productCol >= 0 ? String(row[productCol] || '').trim() : '';
      const rawUnits = unitsCol >= 0 ? this.parseNumber(row[unitsCol]) : 1;
      const rawPrice = priceCol >= 0 ? this.parseNumber(row[priceCol]) : 0;
      const rawCost = costCol >= 0 ? this.parseNumber(row[costCol]) : 0;
      let rawSales = salesCol >= 0 ? this.parseNumber(row[salesCol]) : 0;
      let rawProfit = profitCol >= 0 ? this.parseNumber(row[profitCol]) : 0;
      const rawCustomer = customerCol >= 0 ? String(row[customerCol] || '').trim() : '';
      const rawStatus = statusCol >= 0 ? String(row[statusCol] || '').trim() : 'Completed';
      const rawPayment = paymentCol >= 0 ? String(row[paymentCol] || '').trim() : 'Paid';

      // Skip blank rows
      if (!rawOrderId && !rawProduct && !rawSku && rawSales === 0 && rawUnits === 0) {
        continue;
      }

      const units = Math.max(1, rawUnits || 1);
      if (rawSales === 0 && rawPrice > 0) {
        rawSales = units * rawPrice;
      }
      if (rawProfit === 0 && rawCost > 0 && rawSales > 0) {
        rawProfit = rawSales - rawCost * units;
      }

      const cleanOrderId = rawOrderId || `ORD-GS-${r}`;
      const cleanDate = this.normalizeDate(rawDate) || new Date().toISOString().split('T')[0];
      const cleanMarketplace = this.normalizeMarketplace(rawMarketplace || rawStore);
      const cleanStore = rawStore || `${cleanMarketplace} Store 1`;
      const cleanProduct = rawProduct || (rawSku ? `Item ${rawSku}` : 'Product');
      const cleanSku = rawSku || cleanProduct.slice(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

      const record: SalesRecord = {
        id: `gs_sales_${cleanOrderId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        organizationId: DEFAULT_ORG_ID,
        importBatchId: 'batch_google_sheets_live',
        orderId: cleanOrderId,
        date: cleanDate,
        marketplace: cleanMarketplace,
        store: cleanStore,
        product: cleanProduct,
        sku: cleanSku,
        units,
        sales: Math.round(rawSales * 100) / 100,
        cost: Math.round(rawCost * 100) / 100,
        profit: Math.round(rawProfit * 100) / 100,
        orderStatus: rawStatus || 'Completed',
        paymentStatus: rawPayment || 'Paid',
        customFields: {
          customer: rawCustomer,
          source: 'Google Sheets Live Sync'
        }
      };

      salesList.push(record);
    }

    return salesList;
  }

  public async testSalesConnection(
    spreadsheetId: string,
    sheetName?: string
  ): Promise<{
    success: boolean;
    title: string;
    sheets: string[];
    rowCount: number;
    sampleHeaders: string[];
    sampleRows: any[][];
    detectedMapping: Record<string, string>;
    message: string;
  }> {
    const id = this.extractSpreadsheetId(spreadsheetId);
    if (!id) {
      return {
        success: false,
        title: '',
        sheets: [],
        rowCount: 0,
        sampleHeaders: [],
        sampleRows: [],
        detectedMapping: {},
        message: 'Invalid Google Spreadsheet URL or ID.'
      };
    }

    try {
      const meta = await this.fetchSpreadsheetMetadata(id);
      const targetSheet = sheetName || meta.sheets[0] || 'Sheet1';
      const rows = await this.fetchSheetValues(id, targetSheet);

      let headers: string[] = [];
      let detectedMapping: Record<string, string> = {};
      if (rows && rows.length > 0) {
        let hIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const r = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
          if (r.some(c => c.includes('order') || c.includes('date') || c.includes('sales') || c.includes('sku'))) {
            hIdx = i;
            break;
          }
        }
        headers = (rows[hIdx] || []).map(c => String(c || '').trim());
        detectedMapping = this.detectSalesColumnMapping(headers);
      }

      return {
        success: true,
        title: meta.title,
        sheets: meta.sheets,
        rowCount: Math.max(0, rows.length - 1),
        sampleHeaders: headers,
        sampleRows: rows.slice(1, 6),
        detectedMapping,
        message: `Successfully connected to '${meta.title}' (${rows.length > 0 ? rows.length - 1 : 0} rows found).`
      };
    } catch (err: any) {
      return {
        success: false,
        title: '',
        sheets: [],
        rowCount: 0,
        sampleHeaders: [],
        sampleRows: [],
        detectedMapping: {},
        message:
          err?.message || 'Unable to connect to Google Sheet. Ensure the spreadsheet is accessible or shared with link.'
      };
    }
  }

  public async testPurchasingConnection(
    spreadsheetId: string,
    sheetName?: string
  ): Promise<{
    success: boolean;
    title: string;
    sheets: string[];
    rowCount: number;
    sampleHeaders: string[];
    sampleRows: any[][];
    detectedMapping: Record<string, string>;
    message: string;
  }> {
    const id = this.extractSpreadsheetId(spreadsheetId);
    if (!id) {
      return {
        success: false,
        title: '',
        sheets: [],
        rowCount: 0,
        sampleHeaders: [],
        sampleRows: [],
        detectedMapping: {},
        message: 'Invalid Google Spreadsheet URL or ID.'
      };
    }

    try {
      const meta = await this.fetchSpreadsheetMetadata(id);
      const targetSheet = sheetName || meta.sheets[0] || 'Sheet1';
      const rows = await this.fetchSheetValues(id, targetSheet);

      let headers: string[] = [];
      let detectedMapping: Record<string, string> = {};
      if (rows && rows.length > 0) {
        let hIdx = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const r = (rows[i] || []).map(c => String(c || '').toLowerCase().trim());
          if (
            r.some(
              c =>
                c.includes('po') ||
                c.includes('date') ||
                c.includes('vendor') ||
                c.includes('supplier') ||
                c.includes('amount') ||
                c.includes('reason')
            )
          ) {
            hIdx = i;
            break;
          }
        }
        headers = (rows[hIdx] || []).map(c => String(c || '').trim());
        detectedMapping = this.detectPurchasingColumnMapping(headers);
      }

      return {
        success: true,
        title: meta.title,
        sheets: meta.sheets,
        rowCount: Math.max(0, rows.length - 1),
        sampleHeaders: headers,
        sampleRows: rows.slice(1, 6),
        detectedMapping,
        message: `Successfully connected to '${meta.title}' (${rows.length > 0 ? rows.length - 1 : 0} rows found).`
      };
    } catch (err: any) {
      return {
        success: false,
        title: '',
        sheets: [],
        rowCount: 0,
        sampleHeaders: [],
        sampleRows: [],
        detectedMapping: {},
        message:
          err?.message || 'Unable to connect to Google Sheet. Ensure the spreadsheet is accessible or shared with link.'
      };
    }
  }
}

export const GoogleSheetsLiveService = new GoogleSheetsLiveManager();
