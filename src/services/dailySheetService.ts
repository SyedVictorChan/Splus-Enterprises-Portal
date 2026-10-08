import * as XLSX from 'xlsx';
import { DailyReportData, DailySummaryRow, SalesRecord, ImportBatch, REGISTERED_STORES } from '../types';
import { parseCleanNumber, normalizeMarketplace, normalizeStore } from './dataNormalizer';

export interface DailyStoreSeed {
  companyName: string;
  store: string;
  marketplace: string;
  defaultOrders: number;
  defaultSales: number;
  defaultRefunds: number;
  defaultCancellation: number;
}

export const DAILY_STORES_ORDER: DailyStoreSeed[] = [
  {
    companyName: 'Direct Sales',
    store: 'Direct Sales',
    marketplace: 'Direct Sales',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Amazon: ebid-dealz',
    store: 'Amazon: ebid-dealz',
    marketplace: 'Amazon',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Amazon: ebid-dealz (FBA)',
    store: 'Amazon: ebid-dealz (FBA)',
    marketplace: 'Amazon',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Amazon: Amoldar',
    store: 'Amazon: Amoldar',
    marketplace: 'Amazon',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Amazon: Amoldar (FBA)',
    store: 'Amazon: Amoldar (FBA)',
    marketplace: 'Amazon',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Amazon: Ready2Tech',
    store: 'Amazon: Ready2Tech',
    marketplace: 'Amazon',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Amazon: Ready2Tech (FBA)',
    store: 'Amazon: Ready2Tech (FBA)',
    marketplace: 'Amazon',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'eBay: Fast Parts n More',
    store: 'eBay: Fast Parts n More',
    marketplace: 'eBay',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'NewEgg',
    store: 'NewEgg',
    marketplace: 'NewEgg',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'NewEgg (SBN)',
    store: 'NewEgg (SBN)',
    marketplace: 'NewEgg',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'eBay: Refreshed Electronics',
    store: 'eBay: Refreshed Electronics',
    marketplace: 'eBay',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'eBay: Amoldar Fashions',
    store: 'eBay: Amoldar Fashions',
    marketplace: 'eBay',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Walmart - Amoldar',
    store: 'Walmart - Amoldar',
    marketplace: 'Walmart',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  },
  {
    companyName: 'Walmart - Amoldar (WFS)',
    store: 'Walmart - Amoldar (WFS)',
    marketplace: 'Walmart',
    defaultOrders: 0,
    defaultSales: 0.00,
    defaultRefunds: 0.00,
    defaultCancellation: 0
  }
];

export const DEFAULT_SAMPLE_PURCHASING = 0.00;

/**
 * Returns yesterday's date in YYYY-MM-DD format.
 * In daily e-commerce operations, reporting is conducted 1 day behind (in arrears)
 * to reconcile the full closed previous day's sales, cancellations, and purchasing.
 */
export function getYesterdayDateString(refDate: Date = new Date()): string {
  const d = new Date(refDate);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Generates and downloads the exact daily spreadsheet template
 * matching the user's uploaded spreadsheet design.
 * Defaults to the previous day (yesterday) if no specific date is provided.
 */
export function downloadDailyReportTemplate(
  dateStr?: string,
  type: 'xlsx' | 'csv' = 'xlsx',
  customData?: {
    rows?: { companyName: string; orders: number; sales: number; refunds: number; cancellation: number }[];
    purchasingAmount?: number;
  }
) {
  // Default to yesterday (previous day) as sales reconciliation occurs 1 day in arrears
  const targetDate = dateStr || getYesterdayDateString();
  const workbook = XLSX.utils.book_new();

  // 2D Array layout matching user's image exactly
  const sheetData: any[][] = [];

  // Row 1: Merged Title "Sales Breakdown" + Date note
  sheetData.push(['Sales Breakdown', '', '', 'Report Date:', targetDate]);

  // Row 2: Table Columns
  sheetData.push(['Company Name', 'No. of Orders', 'Total Sales', 'Refunds', 'Cancellation']);

  let totalOrders = 0;
  let totalSales = 0;
  let totalRefunds = 0;
  let totalCancellations = 0;

  const sourceRows = customData?.rows || DAILY_STORES_ORDER.map(s => ({
    companyName: s.companyName,
    orders: s.defaultOrders,
    sales: s.defaultSales,
    refunds: s.defaultRefunds,
    cancellation: s.defaultCancellation
  }));

  sourceRows.forEach(r => {
    totalOrders += r.orders;
    totalSales += r.sales;
    totalRefunds += r.refunds;
    totalCancellations += r.cancellation;

    sheetData.push([
      r.companyName,
      r.orders,
      Number(r.sales.toFixed(2)),
      Number(r.refunds.toFixed(2)),
      r.cancellation > 0 ? Number(r.cancellation.toFixed(2)) : 'NIL'
    ]);
  });

  // Total Summary Row
  sheetData.push([
    'Total',
    totalOrders,
    Number(totalSales.toFixed(2)),
    Number(totalRefunds.toFixed(2)),
    totalCancellations > 0 ? Number(totalCancellations.toFixed(2)) : 'NIL'
  ]);

  // Blank row
  sheetData.push([]);

  // Table 2: Purchasing Breakdown
  sheetData.push(['', 'Purchasing Breakdown', '', '', '']);
  const purchasingAmount = customData?.purchasingAmount !== undefined 
    ? customData.purchasingAmount 
    : DEFAULT_SAMPLE_PURCHASING;
  sheetData.push(['', 'Total Purchasing Amount', Number(purchasingAmount.toFixed(2)), '', '']);

  // Blank row and metadata row
  sheetData.push([]);
  sheetData.push(['Report Date', targetDate, '', '', '']);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Styling / Merges
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // "Sales Breakdown" across A1:E1
    { s: { r: 18, c: 1 }, e: { r: 18, c: 3 } } // "Purchasing Breakdown" across B19:D19
  ];

  // Column Widths
  worksheet['!cols'] = [
    { wch: 30 }, // Company Name
    { wch: 16 }, // No. of Orders
    { wch: 18 }, // Total Sales
    { wch: 16 }, // Refunds
    { wch: 16 }  // Cancellation
  ];

  const fileName = `Daily_Sales_Breakdown_${targetDate}.${type}`;

  if (type === 'xlsx') {
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Breakdown');
    XLSX.writeFile(workbook, fileName);
  } else {
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Breakdown');
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Checks if a workbook or raw rows match the user's Daily Sales Breakdown format
 */
export function isDailySummaryFormat(data: any[][]): boolean {
  if (!data || data.length < 3) return false;

  let hasSalesBreakdown = false;
  let hasCompanyNameHeader = false;
  let hasKnownStore = false;

  const sampleText = data.slice(0, 10).flat().map(c => String(c || '').toLowerCase()).join(' ');

  if (sampleText.includes('sales breakdown')) hasSalesBreakdown = true;
  if (sampleText.includes('company name') || (sampleText.includes('orders') && sampleText.includes('total sales'))) {
    hasCompanyNameHeader = true;
  }

  // Check known store markers
  const knownMarkers = ['ebid-dealz', 'fast parts', 'refreshed electronics', 'amoldar', 'direct sales', 'newegg (sbn)'];
  for (const marker of knownMarkers) {
    if (sampleText.includes(marker)) {
      hasKnownStore = true;
      break;
    }
  }

  return (hasSalesBreakdown && hasCompanyNameHeader) || (hasCompanyNameHeader && hasKnownStore) || (hasSalesBreakdown && hasKnownStore);
}

/**
 * Parse the user's daily executive spreadsheet into structured DailyReportData
 */
export function parseDailySummarySheet(
  workbook: XLSX.WorkBook,
  fallbackDate?: string
): DailyReportData | null {
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return null;

  const grid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (grid.length < 3) return null;

  // Search for date metadata in the sheet
  let extractedDate: string | null = null;
  for (const row of grid) {
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim().toLowerCase();
      if (cellVal.includes('date') || cellVal === 'report date' || cellVal === 'reporting date') {
        const nextVal = row[c + 1] || row[c + 2];
        if (nextVal) {
          if (nextVal instanceof Date) {
            extractedDate = nextVal.toISOString().split('T')[0];
          } else {
            const clean = String(nextVal).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) extractedDate = clean;
            else if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(clean)) {
              const parts = clean.split(/[-/.]/);
              if (parts[2].length === 4) extractedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            }
          }
        }
      }
    }
  }

  // If no date was found in the sheet, default to yesterday's date (previous day)
  const reportDate = extractedDate || fallbackDate || getYesterdayDateString();

  // Find header row with "Company Name" or "Company" or "Store"
  let headerRowIndex = -1;
  let companyCol = 0;
  let ordersCol = 1;
  let salesCol = 2;
  let refundsCol = 3;
  let cancellationCol = 4;

  for (let r = 0; r < Math.min(10, grid.length); r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();
      if (cell.includes('company') || cell === 'store' || cell === 'store name') {
        headerRowIndex = r;
        companyCol = c;
        // Inspect surrounding columns
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const colName = String(row[colIdx] || '').toLowerCase().trim();
          if (colName.includes('order') || colName.includes('no.')) ordersCol = colIdx;
          else if (colName.includes('total sales') || colName.includes('sales')) salesCol = colIdx;
          else if (colName.includes('refund')) refundsCol = colIdx;
          else if (colName.includes('cancel')) cancellationCol = colIdx;
        }
        break;
      }
    }
    if (headerRowIndex !== -1) break;
  }

  if (headerRowIndex === -1) {
    // Default assumption: row 1 (0-indexed) has headers
    headerRowIndex = 1;
  }

  const rows: DailySummaryRow[] = [];
  let totalOrders = 0;
  let totalSales = 0;
  let totalRefunds = 0;
  let totalCancellations = 0;
  let totalPurchasingAmount = 0;

  // Read stores from headerRowIndex + 1 downwards
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.length === 0) continue;

    const companyRaw = String(row[companyCol] || '').trim();
    if (!companyRaw) continue;

    // Check if we hit the Total row
    if (companyRaw.toLowerCase() === 'total' || companyRaw.toLowerCase().startsWith('total:')) {
      // We can record or verify totals
      continue;
    }

    // Check if we hit the Purchasing section
    const fullRowText = row.map(v => String(v || '').toLowerCase()).join(' ');
    if (fullRowText.includes('purchasing breakdown') || fullRowText.includes('total purchasing amount')) {
      for (const cell of row) {
        const num = parseCleanNumber(cell, -1);
        if (num > 0) {
          totalPurchasingAmount = num;
          break;
        }
      }
      continue;
    }

    // Skip footer labels
    if (companyRaw.toLowerCase().includes('report date') || companyRaw.toLowerCase().includes('purchasing')) {
      continue;
    }

    const store = normalizeStore(companyRaw);
    const marketplace = normalizeMarketplace('', store);
    const orders = Math.max(0, Math.round(parseCleanNumber(row[ordersCol], 0)));
    const sales = parseCleanNumber(row[salesCol], 0);
    const refunds = parseCleanNumber(row[refundsCol], 0);
    const cancellation = parseCleanNumber(row[cancellationCol], 0);

    totalOrders += orders;
    totalSales += sales;
    totalRefunds += refunds;
    totalCancellations += cancellation;

    rows.push({
      companyName: companyRaw,
      store,
      marketplace,
      orders,
      totalSales: Math.round(sales * 100) / 100,
      refunds: Math.round(refunds * 100) / 100,
      cancellation: Math.round(cancellation * 100) / 100
    });
  }

  // Scan remaining grid rows for Purchasing Breakdown if not yet found
  if (totalPurchasingAmount === 0) {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').toLowerCase().trim();
        if (cell.includes('purchasing amount') || cell === 'total purchasing amount' || cell.includes('purchasing breakdown')) {
          // Look at next cells in row or cell below
          const candidate1 = row[c + 1];
          const candidate2 = row[c + 2];
          const candidate3 = grid[r + 1] ? grid[r + 1][c] : null;
          const candidate4 = grid[r + 1] ? grid[r + 1][c + 1] : null;

          const num = [candidate1, candidate2, candidate3, candidate4]
            .map(v => parseCleanNumber(v, 0))
            .find(v => v > 0);

          if (num && num > 0) {
            totalPurchasingAmount = num;
            break;
          }
        }
      }
      if (totalPurchasingAmount > 0) break;
    }
  }

  return {
    date: reportDate,
    rows,
    totalOrders,
    totalSales: Math.round(totalSales * 100) / 100,
    totalRefunds: Math.round(totalRefunds * 100) / 100,
    totalCancellations: Math.round(totalCancellations * 100) / 100,
    totalPurchasingAmount: Math.round(totalPurchasingAmount * 100) / 100
  };
}

/**
 * Converts structured daily report into SalesRecord array compatible with the app
 */
export function convertDailyReportToSalesRecords(
  report: DailyReportData,
  batchId: string
): { records: SalesRecord[]; batch: ImportBatch } {
  const records: SalesRecord[] = [];
  const date = report.date;

  report.rows.forEach((row, idx) => {
    // Only generate records for stores that have orders or sales or refunds
    if (row.orders === 0 && row.totalSales === 0 && row.refunds === 0) {
      return;
    }

    const units = Math.max(row.orders, 1);
    const storeObj = REGISTERED_STORES.find(s => s.name === row.store);
    const category = storeObj?.categoryHint || 'Multi-Category';
    const storeShort = storeObj?.shortName || row.store.split(':')[1]?.trim() || row.store;

    // Estimate realistic product cost for profit reporting (around 45-55% COGS)
    const cost = Math.round(row.totalSales * 0.48 * 100) / 100;
    const profit = Math.round((row.totalSales - cost - row.refunds) * 100) / 100;

    // If there are multiple orders, we create distributed realistic line items
    // or consolidated clean records so order count and units reflect reality
    if (row.orders > 1) {
      // Split into 2-4 representative orders that sum to the exact totals
      const count = Math.min(row.orders, 4);
      let remainingSales = row.totalSales;
      let remainingUnits = row.orders;
      let remainingRefunds = row.refunds;

      for (let i = 0; i < count; i++) {
        const isLast = i === count - 1;
        const subUnits = isLast ? remainingUnits : Math.max(1, Math.round(remainingUnits / (count - i)));
        const subSales = isLast ? remainingSales : Math.round((remainingSales / (count - i)) * 100) / 100;
        const subRefunds = isLast ? remainingRefunds : Math.round((remainingRefunds / (count - i)) * 100) / 100;
        const subCost = Math.round(subSales * 0.48 * 100) / 100;
        const subProfit = Math.round((subSales - subCost - subRefunds) * 100) / 100;

        remainingSales -= subSales;
        remainingUnits -= subUnits;
        remainingRefunds -= subRefunds;

        records.push({
          id: `rec_daily_${date}_${row.store.replace(/[^a-zA-Z0-9]/g, '_')}_${i + 1}`,
          importBatchId: batchId,
          orderId: `ORD-${date.replace(/-/g, '')}-${storeShort.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}-${i + 1}`,
          date,
          marketplace: row.marketplace,
          store: row.store,
          product: `${storeShort} Catalog Goods`,
          sku: `SKU-${storeShort.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}-${(i + 1).toString().padStart(2, '0')}`,
          category,
          units: subUnits,
          sales: Math.max(0, subSales),
          cost: subCost,
          profit: subProfit,
          returns: subRefunds > 0 ? 1 : 0,
          refunds: subRefunds,
          orderStatus: 'Completed',
          paymentStatus: 'Paid',
          channel: row.marketplace
        });
      }
    } else {
      records.push({
        id: `rec_daily_${date}_${row.store.replace(/[^a-zA-Z0-9]/g, '_')}_1`,
        importBatchId: batchId,
        orderId: `ORD-${date.replace(/-/g, '')}-${storeShort.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}-1`,
        date,
        marketplace: row.marketplace,
        store: row.store,
        product: `${storeShort} Item`,
        sku: `SKU-${storeShort.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}-01`,
        category,
        units: row.orders || 1,
        sales: row.totalSales,
        cost,
        profit,
        returns: row.refunds > 0 ? 1 : 0,
        refunds: row.refunds,
        orderStatus: 'Completed',
        paymentStatus: 'Paid',
        channel: row.marketplace
      });
    }
  });

  const marketplaces = Array.from(new Set(records.map(r => r.marketplace)));
  const stores = Array.from(new Set(records.map(r => r.store)));

  const batch: ImportBatch = {
    id: batchId,
    fileName: `Daily_Sales_Breakdown_${date}.xlsx`,
    sheetName: 'Sales Breakdown',
    importedAt: new Date().toISOString(),
    importedBy: 'Operations Daily Feed',
    totalRows: report.rows.length,
    validRows: records.length,
    duplicateRows: 0,
    invalidRows: 0,
    dateRange: {
      start: date,
      end: date
    },
    marketplaces,
    stores,
    status: 'Successful'
  };

  return { records, batch };
}
