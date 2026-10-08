import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType, isQuotaExhausted, markQuotaExhausted } from './firebase';
import { DEFAULT_ORG_ID } from '../constants/org';
import {
  RMAItem,
  RMAStatus,
  ReturnReason,
  ReturnType,
  InspectionDetails,
  RefundResolution,
  ReplacementResolution,
  ExchangeResolution,
  RepairResolution,
  StoreCreditResolution,
  RMATimelineEvent,
  RMAFilterState,
  RMAKpiSummary,
  ProductReturnAnalysis,
  MarketplaceStoreRMAAnalysis,
  RMADatePreset
} from '../types/rma';
import { SalesRecord } from '../types';
import { GoogleSheetsLiveService } from './googleSheetsLiveService';

const RMA_STORAGE_KEYS = {
  RECORDS: 'splus_rma_records_v1',
  INITIALIZED: 'splus_rma_initialized_flag_v1'
};

export const STANDARD_RETURN_REASONS: { value: ReturnReason; label: string; description: string }[] = [
  { value: 'defective_product', label: 'Defective Product', description: 'Item does not power on or functions improperly' },
  { value: 'damaged_in_transit', label: 'Damaged in Transit', description: 'Shipping box or product crushed/broken during delivery' },
  { value: 'wrong_product', label: 'Wrong Product', description: 'Different model or item sent than what customer ordered' },
  { value: 'wrong_size', label: 'Wrong Size / Fit', description: 'Incompatible dimensions or incorrect size variation' },
  { value: 'missing_parts', label: 'Missing Parts / Accessories', description: 'Cables, manual, or modular attachments missing' },
  { value: 'not_as_described', label: 'Not as Described', description: 'Item specifications do not match marketplace listing' },
  { value: 'customer_changed_mind', label: 'Customer Changed Mind', description: 'Buyer remorse or no longer needed' },
  { value: 'quality_issue', label: 'Product Quality Issue', description: 'Build quality or materials below expected standard' },
  { value: 'packaging_issue', label: 'Packaging Issue', description: 'Broken seal or unbranded retail box' },
  { value: 'duplicate_order', label: 'Duplicate Order', description: 'Customer accidentally ordered twice' },
  { value: 'other', label: 'Other', description: 'Custom reason or special inquiry' }
];

export const RETURN_TYPES: { value: ReturnType; label: string; description: string }[] = [
  { value: 'refund', label: 'Refund', description: 'Return funds to buyer via original payment or transfer' },
  { value: 'replacement', label: 'Replacement', description: 'Ship brand-new replacement unit to buyer' },
  { value: 'exchange', label: 'Exchange', description: 'Swap for alternate SKU or upgraded variant' },
  { value: 'repair', label: 'Repair', description: 'Service or refurbish unit via authorized vendor' },
  { value: 'store_credit', label: 'Store Credit', description: 'Issue digital wallet voucher for future purchase' },
  { value: 'other', label: 'Other', description: 'Special resolution agreement' }
];

export const RMA_STATUS_CONFIG: Record<
  RMAStatus,
  { label: string; color: string; bg: string; border: string; step: number; isTerminal?: boolean }
> = {
  requested: { label: 'Requested', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', step: 1 },
  pending_approval: { label: 'Pending Approval', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', step: 2 },
  approved: { label: 'Approved', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', step: 3 },
  rejected: { label: 'Rejected', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', step: 3, isTerminal: true },
  return_in_transit: { label: 'In Transit', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', step: 4 },
  received: { label: 'Received at Dock', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', step: 5 },
  pending_inspection: { label: 'Pending Inspection', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', step: 6 },
  under_inspection: { label: 'Under Inspection', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', step: 7 },
  inspection_completed: { label: 'Inspection Done', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', step: 8 },
  refund_pending: { label: 'Refund Pending', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', step: 9 },
  replacement_pending: { label: 'Replacement Pending', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', step: 9 },
  replacement_shipped: { label: 'Replacement Shipped', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', step: 10 },
  refunded: { label: 'Refunded', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', step: 10 },
  completed: { label: 'Completed & Closed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', step: 11, isTerminal: true },
  cancelled: { label: 'Cancelled', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', step: 0, isTerminal: true }
};

/**
 * Helper to identify and purge any residual demo or seed RMA records
 */
export function isDemoRMA(id?: string, data?: any): boolean {
  if (!id && !data) return false;
  const cleanId = (id || data?.id || '').toLowerCase();
  if (cleanId.startsWith('rma-seed') || cleanId.includes('seed')) return true;
  if (data?.isDemo === true || data?.isSeed === true) return true;

  // Specific historical demo order IDs from initial mock seeds
  const demoOrders = ['ORD-20260310-101', 'ORD-20260308-442', 'ORD-20260305-883', 'ORD-20260228-319', 'ORD-20260312-520'];
  if (data?.orderNumber && demoOrders.includes(data.orderNumber)) return true;

  // Specific historical demo customer names from initial mock seeds
  const demoCustomers = ['Sarah Jenkins', 'Michael Chang', 'Elena Rostova', 'David Miller', 'Amanda Collins'];
  if (data?.customer && demoCustomers.includes(data.customer)) return true;

  return false;
}

export class RMAService {
  private static subscribers: (() => void)[] = [];
  private static isSyncInitialized: boolean = false;

  public static subscribe(callback: () => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  public static subscribeRMAs(callback: (items: RMAItem[]) => void): () => void {
    this.initSync();
    callback(this.getAllRMAs());
    return this.subscribe(() => {
      callback(this.getAllRMAs());
    });
  }

  private static notifySubscribers() {
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.warn('RMA subscriber error:', err);
      }
    });
  }

  /**
   * Purges all residual RMA demo/mock records from localStorage completely
   */
  public static purgeDemoRMAs(): void {
    if (typeof window === 'undefined') return;
    try {
      // 1. Purge splus_rma_records_v1
      const stored = localStorage.getItem(RMA_STORAGE_KEYS.RECORDS);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(item => !isDemoRMA(item?.id, item));
            localStorage.setItem(RMA_STORAGE_KEYS.RECORDS, JSON.stringify(clean));
          }
        } catch {
          localStorage.removeItem(RMA_STORAGE_KEYS.RECORDS);
        }
      }

      // 2. Purge splus_live_rma_records_v1
      const liveStored = localStorage.getItem('splus_live_rma_records_v1');
      if (liveStored) {
        try {
          const parsed = JSON.parse(liveStored);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(item => !isDemoRMA(item?.id, item));
            localStorage.setItem('splus_live_rma_records_v1', JSON.stringify(clean));
          }
        } catch {
          localStorage.removeItem('splus_live_rma_records_v1');
        }
      }

      localStorage.removeItem(RMA_STORAGE_KEYS.INITIALIZED);
    } catch (e) {
      console.warn('Notice while purging RMA demo records:', e);
    }
  }

  /**
   * Purges any residual RMA demo records from Firestore collection asynchronously
   */
  public static async purgeFirestoreDemoRMAs(): Promise<void> {
    if (isQuotaExhausted()) return;
    try {
      const orgRmasRef = collection(db, 'organizations', DEFAULT_ORG_ID, 'rma_records');
      const snapshot = await getDocs(orgRmasRef);
      snapshot.forEach(docSnap => {
        if (isDemoRMA(docSnap.id, docSnap.data())) {
          deleteDoc(doc(db, 'organizations', DEFAULT_ORG_ID, 'rma_records', docSnap.id)).catch(() => {});
        }
      });
    } catch (err) {
      console.info('RMA Firestore demo purge notice:', err);
    }
  }

  /**
   * Initializes real-time sync with organization collection in Firestore
   * Falls back seamlessly to offline / local cache
   */
  public static initSync() {
    if (this.isSyncInitialized) return;
    this.isSyncInitialized = true;

    // Immediately purge any local demo data
    this.purgeDemoRMAs();

    // Asynchronously delete any residual demo documents from Firestore
    this.purgeFirestoreDemoRMAs();

    if (isQuotaExhausted()) return;

    try {
      const orgRmasRef = collection(db, 'organizations', DEFAULT_ORG_ID, 'rma_records');
      onSnapshot(
        orgRmasRef,
        snapshot => {
          if (!snapshot.empty) {
            const remoteRmas: RMAItem[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as any;
              const id = docSnap.id;
              if (isDemoRMA(id, data)) {
                deleteDoc(doc(db, 'organizations', DEFAULT_ORG_ID, 'rma_records', id)).catch(() => {});
                return;
              }
              remoteRmas.push({ id, ...data });
            });
            // Update local cache without any demo data
            localStorage.setItem(RMA_STORAGE_KEYS.RECORDS, JSON.stringify(remoteRmas));
            this.notifySubscribers();
          } else {
            this.purgeDemoRMAs();
            this.notifySubscribers();
          }
        },
        error => {
          if (error?.code === 'resource-exhausted' || error?.message?.toLowerCase()?.includes('quota exceeded')) {
            markQuotaExhausted(error?.message);
            return;
          }
          if (error?.code === 'unavailable') {
            return;
          }
          console.info('RMA Firestore snapshot notice:', error?.message || error);
        }
      );
    } catch (err) {
      console.info('RMA real-time listener operating in local mode:', err);
    }
  }

  /**
   * Get all RMAs with live Google Sheets priority and ZERO mock data
   */
  public static getAllRMAs(): RMAItem[] {
    try {
      // 1. Live Google Sheets integration (excluding any demo data)
      const liveRMAs = GoogleSheetsLiveService.getStoredRMAs().filter(
        r => !(r as any).isDeletedFromSource && !isDemoRMA(r.id, r)
      );
      if (liveRMAs.length > 0) {
        return liveRMAs;
      }

      const stored = localStorage.getItem(RMA_STORAGE_KEYS.RECORDS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(r => !(r as any).isDeletedFromSource && !isDemoRMA(r.id, r));
        }
      }

      // Zero demo data: return clean empty list
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Generate next sequential RMA number (e.g. RMA-2026-000006)
   */
  public static generateRMANumber(): string {
    const currentYear = new Date().getFullYear();
    const all = this.getAllRMAs();
    const prefix = `RMA-${currentYear}-`;

    let maxSeq = 0;
    all.forEach(r => {
      if (r.rmaNumber && r.rmaNumber.startsWith(prefix)) {
        const numPart = parseInt(r.rmaNumber.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
    return `${prefix}${nextSeq}`;
  }

  /**
   * Save a single RMA to local cache and Firestore
   */
  public static async saveRMA(rma: RMAItem): Promise<RMAItem> {
    const all = this.getAllRMAs();
    const index = all.findIndex(r => r.id === rma.id);

    const updatedRma = {
      ...rma,
      organizationId: DEFAULT_ORG_ID,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) {
      all[index] = updatedRma;
    } else {
      all.unshift(updatedRma);
    }

    localStorage.setItem(RMA_STORAGE_KEYS.RECORDS, JSON.stringify(all));
    this.notifySubscribers();

    // Persist to Firestore asynchronously if healthy
    if (!isQuotaExhausted()) {
      try {
        await setDoc(doc(db, 'organizations', DEFAULT_ORG_ID, 'rma_records', rma.id), updatedRma);
      } catch (err: any) {
        if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase()?.includes('quota exceeded')) {
          markQuotaExhausted(err?.message);
        } else {
          console.info('RMA Firestore save offline notice:', err?.message || err);
        }
      }
    }

    return updatedRma;
  }

  /**
   * Create a brand new RMA
   */
  public static async createRMA(
    payload: Omit<RMAItem, 'id' | 'rmaNumber' | 'timeline' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    userName: string = 'Authorized Agent'
  ): Promise<RMAItem> {
    const id = `rma_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const rmaNumber = this.generateRMANumber();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const initialTimeline: RMATimelineEvent[] = [
      {
        id: `t_${Date.now()}`,
        date: dateStr,
        time: timeStr,
        user: userName,
        action: 'RMA Created & Authorized',
        notes: payload.customerNotes || 'Initial return case registered in Splus Portal.',
        newStatus: payload.status || 'requested'
      }
    ];

    const newRMA: RMAItem = {
      ...payload,
      id,
      rmaNumber,
      organizationId: DEFAULT_ORG_ID,
      status: payload.status || 'requested',
      timeline: initialTimeline,
      createdBy: userName,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    return this.saveRMA(newRMA);
  }

  /**
   * Transition status with validation and timeline logging
   */
  public static async updateRMAStatus(
    rmaId: string,
    newStatus: RMAStatus,
    userName: string,
    notes?: string
  ): Promise<RMAItem | null> {
    const all = this.getAllRMAs();
    const rma = all.find(r => r.id === rmaId);
    if (!rma) return null;

    const previousStatus = rma.status;
    if (previousStatus === newStatus) return rma;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const timelineEvent: RMATimelineEvent = {
      id: `t_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      user: userName,
      action: `Status changed to ${RMA_STATUS_CONFIG[newStatus]?.label || newStatus}`,
      notes: notes || undefined,
      previousStatus,
      newStatus
    };

    const updated: RMAItem = {
      ...rma,
      status: newStatus,
      timeline: [...rma.timeline, timelineEvent],
      updatedAt: now.toISOString()
    };

    return this.saveRMA(updated);
  }

  /**
   * Record Inspection
   */
  public static async recordInspection(
    rmaId: string,
    inspection: InspectionDetails,
    userName: string,
    resultingStatus?: RMAStatus
  ): Promise<RMAItem | null> {
    const all = this.getAllRMAs();
    const rma = all.find(r => r.id === rmaId);
    if (!rma) return null;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const nextStatus: RMAStatus =
      resultingStatus ||
      (inspection.result === 'approved'
        ? rma.returnType === 'refund'
          ? 'refund_pending'
          : rma.returnType === 'replacement'
          ? 'replacement_pending'
          : 'inspection_completed'
        : inspection.result === 'rejected'
        ? 'rejected'
        : 'under_inspection');

    const timelineEvent: RMATimelineEvent = {
      id: `t_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      user: userName,
      action: `Inspection Result: ${inspection.result ? inspection.result.toUpperCase() : 'COMPLETED'}`,
      notes: inspection.inspectionNotes || `Condition: ${inspection.productCondition || 'Unspecified'}`,
      previousStatus: rma.status,
      newStatus: nextStatus
    };

    const updated: RMAItem = {
      ...rma,
      status: nextStatus,
      inspection: {
        ...inspection,
        inspectedAt: inspection.inspectedAt || now.toISOString(),
        inspectedBy: userName
      },
      timeline: [...rma.timeline, timelineEvent],
      updatedAt: now.toISOString()
    };

    return this.saveRMA(updated);
  }

  /**
   * Process Refund Resolution
   */
  public static async processRefund(
    rmaId: string,
    refundData: RefundResolution,
    userName: string
  ): Promise<RMAItem | null> {
    const all = this.getAllRMAs();
    const rma = all.find(r => r.id === rmaId);
    if (!rma) return null;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const isCompleted = refundData.refundStatus === 'completed';
    const nextStatus: RMAStatus = isCompleted ? 'completed' : 'refund_pending';

    const timelineEvent: RMATimelineEvent = {
      id: `t_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      user: userName,
      action: isCompleted ? `Refund of $${refundData.refundAmount.toFixed(2)} Completed` : `Refund Processed ($${refundData.refundAmount.toFixed(2)})`,
      notes: `Method: ${refundData.refundMethod}. Ref: ${refundData.refundReference || 'N/A'}`,
      previousStatus: rma.status,
      newStatus: nextStatus
    };

    const updated: RMAItem = {
      ...rma,
      status: nextStatus,
      refund: refundData,
      timeline: [...rma.timeline, timelineEvent],
      updatedAt: now.toISOString()
    };

    return this.saveRMA(updated);
  }

  /**
   * Process Replacement Resolution
   */
  public static async processReplacement(
    rmaId: string,
    replacementData: ReplacementResolution,
    userName: string
  ): Promise<RMAItem | null> {
    const all = this.getAllRMAs();
    const rma = all.find(r => r.id === rmaId);
    if (!rma) return null;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const isShipped = replacementData.replacementStatus === 'shipped';
    const isDelivered = replacementData.replacementStatus === 'delivered';
    const nextStatus: RMAStatus = isDelivered ? 'completed' : isShipped ? 'replacement_shipped' : 'replacement_pending';

    const timelineEvent: RMATimelineEvent = {
      id: `t_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      user: userName,
      action: `Replacement ${replacementData.replacementStatus.toUpperCase()}: ${replacementData.replacementQuantity}x ${replacementData.replacementSku}`,
      notes: replacementData.trackingNumber ? `Carrier: ${replacementData.shippingCarrier || 'N/A'}, Tracking: ${replacementData.trackingNumber}` : undefined,
      previousStatus: rma.status,
      newStatus: nextStatus
    };

    const updated: RMAItem = {
      ...rma,
      status: nextStatus,
      replacement: replacementData,
      timeline: [...rma.timeline, timelineEvent],
      updatedAt: now.toISOString()
    };

    return this.saveRMA(updated);
  }

  /**
   * Add an internal note to an RMA
   */
  public static async addNote(
    rmaId: string,
    message: string,
    userName: string
  ): Promise<RMAItem | null> {
    const all = this.getAllRMAs();
    const rma = all.find(r => r.id === rmaId);
    if (!rma) return null;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];

    const newNote = {
      id: `note_${Date.now()}`,
      user: userName,
      date: dateStr,
      time: timeStr,
      message
    };

    const timelineEvent: RMATimelineEvent = {
      id: `t_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      user: userName,
      action: 'Internal Note Added',
      notes: message
    };

    const updated: RMAItem = {
      ...rma,
      notesList: [...(rma.notesList || []), newNote],
      timeline: [...rma.timeline, timelineEvent],
      updatedAt: now.toISOString()
    };

    return this.saveRMA(updated);
  }

  /**
   * Delete an RMA (Admin permission)
   */
  public static async deleteRMA(rmaId: string): Promise<boolean> {
    const all = this.getAllRMAs();
    const filtered = all.filter(r => r.id !== rmaId);
    localStorage.setItem(RMA_STORAGE_KEYS.RECORDS, JSON.stringify(filtered));
    this.notifySubscribers();

    if (!isQuotaExhausted()) {
      try {
        await deleteDoc(doc(db, 'organizations', DEFAULT_ORG_ID, 'rma_records', rmaId));
      } catch (err: any) {
        if (err?.code === 'resource-exhausted' || err?.message?.toLowerCase()?.includes('quota exceeded')) {
          markQuotaExhausted(err?.message);
        } else {
          console.info('RMA Firestore delete offline notice:', err?.message || err);
        }
      }
    }
    return true;
  }

  /**
   * Pre-fill lookup from existing SalesRecords (safe, read-only)
   */
  public static lookupOrderInSales(
    orderNumber: string,
    salesRecords: SalesRecord[]
  ): {
    found: boolean;
    orderNumber: string;
    orderDate?: string;
    customer?: string;
    marketplace?: string;
    store?: string;
    product?: string;
    sku?: string;
    quantity?: number;
    price?: number;
    cost?: number;
  } | null {
    if (!orderNumber || !orderNumber.trim()) return null;
    const cleanSearch = orderNumber.trim().toLowerCase();

    const matched = salesRecords.find(
      r => r.orderId && r.orderId.toLowerCase() === cleanSearch
    );

    if (!matched) return { found: false, orderNumber: orderNumber.trim() };

    return {
      found: true,
      orderNumber: matched.orderId,
      orderDate: matched.date,
      customer: (matched.customFields && (matched.customFields['Customer'] || matched.customFields['Customer Name'])) ? String(matched.customFields['Customer'] || matched.customFields['Customer Name']) : 'Verified Customer',
      marketplace: matched.marketplace,
      store: matched.store,
      product: matched.product,
      sku: matched.sku,
      quantity: matched.units || 1,
      price: matched.sales,
      cost: matched.cost
    };
  }

  /**
   * Filter RMAs by date preset and criteria
   */
  public static filterRMAs(rmas: RMAItem[], filters: RMAFilterState): RMAItem[] {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return rmas.filter(rma => {
      const rmaDate = rma.createdAt.split('T')[0];

      // Date Filtering
      if (filters.datePreset === 'today') {
        if (rmaDate !== todayStr) return false;
      } else if (filters.datePreset === 'yesterday') {
        if (rmaDate !== yesterdayStr) return false;
      } else if (filters.datePreset === 'last7days') {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        if (rmaDate < d.toISOString().split('T')[0]) return false;
      } else if (filters.datePreset === 'last30days') {
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        if (rmaDate < d.toISOString().split('T')[0]) return false;
      } else if (filters.datePreset === 'thisMonth') {
        const currentMonthPrefix = todayStr.substring(0, 7);
        if (!rmaDate.startsWith(currentMonthPrefix)) return false;
      } else if (filters.datePreset === 'previousMonth') {
        const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthStr = prevMonth.toISOString().split('T')[0].substring(0, 7);
        if (!rmaDate.startsWith(prevMonthStr)) return false;
      } else if (filters.datePreset === 'thisQuarter') {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const rmaMonth = parseInt(rmaDate.substring(5, 7), 10) - 1;
        const rmaQuarter = Math.floor(rmaMonth / 3);
        if (rmaDate.substring(0, 4) !== today.getFullYear().toString() || rmaQuarter !== currentQuarter) {
          return false;
        }
      } else if (filters.datePreset === 'thisYear') {
        if (!rmaDate.startsWith(today.getFullYear().toString())) return false;
      } else if (filters.datePreset === 'custom') {
        if (filters.customStartDate && rmaDate < filters.customStartDate) return false;
        if (filters.customEndDate && rmaDate > filters.customEndDate) return false;
      }

      // Status Filter
      if (filters.status && filters.status !== 'all') {
        if (rma.status !== filters.status) return false;
      }

      // Marketplace Filter
      if (filters.marketplace && filters.marketplace !== 'all') {
        if (rma.marketplace !== filters.marketplace) return false;
      }

      // Store Filter
      if (filters.store && filters.store !== 'all') {
        if (rma.store !== filters.store) return false;
      }

      // Reason Filter
      if (filters.reason && filters.reason !== 'all') {
        if (rma.reason !== filters.reason) return false;
      }

      // Return Type Filter
      if (filters.returnType && filters.returnType !== 'all') {
        if (rma.returnType !== filters.returnType) return false;
      }

      // Inspection Status Filter
      if (filters.inspectionStatus && filters.inspectionStatus !== 'all') {
        if (filters.inspectionStatus === 'pending') {
          if (rma.inspection?.result) return false;
        } else if (filters.inspectionStatus === 'approved') {
          if (rma.inspection?.result !== 'approved') return false;
        } else if (filters.inspectionStatus === 'rejected') {
          if (rma.inspection?.result !== 'rejected') return false;
        }
      }

      // Refund Status Filter
      if (filters.refundStatus && filters.refundStatus !== 'all') {
        if (filters.refundStatus === 'none') {
          if (rma.refund) return false;
        } else {
          if (rma.refund?.refundStatus !== filters.refundStatus) return false;
        }
      }

      // Search Query
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const match =
          rma.rmaNumber.toLowerCase().includes(q) ||
          rma.orderNumber.toLowerCase().includes(q) ||
          rma.customer.toLowerCase().includes(q) ||
          rma.sku.toLowerCase().includes(q) ||
          rma.product.toLowerCase().includes(q) ||
          (rma.returnTrackingNumber && rma.returnTrackingNumber.toLowerCase().includes(q)) ||
          rma.marketplace.toLowerCase().includes(q) ||
          rma.store.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }

  /**
   * Calculate RMA KPIs
   */
  public static calculateKPIs(rmas: RMAItem[], salesRecords: SalesRecord[] = []): RMAKpiSummary {
    const totalRmas = rmas.length;
    let openRmas = 0;
    let pendingInspection = 0;
    let approvedRmas = 0;
    let rejectedRmas = 0;
    let completedRmas = 0;
    let pendingRefund = 0;
    let pendingReplacement = 0;
    let totalRefundAmount = 0;
    let pendingRefundAmount = 0;
    let completedRefundAmount = 0;
    let totalReturnedUnits = 0;

    rmas.forEach(r => {
      totalReturnedUnits += r.quantity || 1;

      // Status categorization
      if (!['completed', 'rejected', 'cancelled'].includes(r.status)) {
        openRmas++;
      }

      if (['received', 'pending_inspection', 'under_inspection'].includes(r.status) || (r.status === 'approved' && !r.inspection?.result)) {
        pendingInspection++;
      }

      if (r.status === 'approved' || r.inspection?.result === 'approved') {
        approvedRmas++;
      }

      if (r.status === 'rejected' || r.inspection?.result === 'rejected') {
        rejectedRmas++;
      }

      if (r.status === 'completed') {
        completedRmas++;
      }

      if (r.status === 'refund_pending' || (r.refund && r.refund.refundStatus === 'pending')) {
        pendingRefund++;
      }

      if (r.status === 'replacement_pending' || (r.replacement && r.replacement.replacementStatus === 'pending')) {
        pendingReplacement++;
      }

      if (r.refund) {
        totalRefundAmount += r.refund.refundAmount || 0;
        if (r.refund.refundStatus === 'completed') {
          completedRefundAmount += r.refund.refundAmount || 0;
        } else if (r.refund.refundStatus === 'pending' || r.refund.refundStatus === 'processing') {
          pendingRefundAmount += r.refund.refundAmount || 0;
        }
      }
    });

    // Return Rate calculation against available sales data
    let returnRate: number | null = null;
    let rmaRate: number | null = null;

    if (salesRecords.length > 0) {
      const totalUnitsSold = salesRecords.reduce((sum, s) => sum + (s.units || 0), 0);
      const totalOrdersCount = new Set(salesRecords.map(s => s.orderId).filter(Boolean)).size || salesRecords.length;

      if (totalUnitsSold > 0) {
        returnRate = Number(((totalReturnedUnits / totalUnitsSold) * 100).toFixed(2));
      }
      if (totalOrdersCount > 0) {
        rmaRate = Number(((totalRmas / totalOrdersCount) * 100).toFixed(2));
      }
    }

    return {
      totalRmas,
      openRmas,
      pendingInspection,
      approvedRmas,
      rejectedRmas,
      completedRmas,
      pendingRefund,
      pendingReplacement,
      totalRefundAmount,
      pendingRefundAmount,
      completedRefundAmount,
      totalReturnedUnits,
      returnRate,
      rmaRate
    };
  }

  /**
   * Product Return Analysis
   */
  public static getProductReturnAnalysis(
    rmas: RMAItem[],
    salesRecords: SalesRecord[] = []
  ): ProductReturnAnalysis[] {
    const skuMap = new Map<string, {
      product: string;
      sku: string;
      unitsSold: number;
      unitsReturned: number;
      rmaCount: number;
      refundAmount: number;
      replacementCount: number;
      reasonsCount: Record<string, number>;
    }>();

    // Sum sales units if available
    salesRecords.forEach(s => {
      const sku = s.sku || 'SKU-UNKNOWN';
      if (!skuMap.has(sku)) {
        skuMap.set(sku, {
          product: s.product || 'Unknown Product',
          sku,
          unitsSold: 0,
          unitsReturned: 0,
          rmaCount: 0,
          refundAmount: 0,
          replacementCount: 0,
          reasonsCount: {}
        });
      }
      skuMap.get(sku)!.unitsSold += s.units || 0;
    });

    // Tally RMAs
    rmas.forEach(r => {
      const sku = r.sku || 'SKU-UNKNOWN';
      if (!skuMap.has(sku)) {
        skuMap.set(sku, {
          product: r.product || 'Unknown Product',
          sku,
          unitsSold: 0,
          unitsReturned: 0,
          rmaCount: 0,
          refundAmount: 0,
          replacementCount: 0,
          reasonsCount: {}
        });
      }

      const item = skuMap.get(sku)!;
      item.rmaCount++;
      item.unitsReturned += r.quantity || 1;
      if (r.refund) {
        item.refundAmount += r.refund.refundAmount || 0;
      }
      if (r.returnType === 'replacement' || r.replacement) {
        item.replacementCount += r.replacement?.replacementQuantity || r.quantity || 1;
      }
      const reasonKey = r.reason || 'other';
      item.reasonsCount[reasonKey] = (item.reasonsCount[reasonKey] || 0) + 1;
    });

    return Array.from(skuMap.values())
      .filter(item => item.rmaCount > 0 || item.unitsSold > 0)
      .map(item => {
        let topReason = 'N/A';
        let maxCount = 0;
        for (const [r, count] of Object.entries(item.reasonsCount)) {
          if (count > maxCount) {
            maxCount = count;
            topReason = STANDARD_RETURN_REASONS.find(sr => sr.value === r)?.label || r;
          }
        }

        const returnRate =
          item.unitsSold > 0
            ? Number(((item.unitsReturned / item.unitsSold) * 100).toFixed(2))
            : null;

        return {
          product: item.product,
          sku: item.sku,
          unitsSold: item.unitsSold,
          unitsReturned: item.unitsReturned,
          returnRate,
          rmaCount: item.rmaCount,
          refundAmount: item.refundAmount,
          replacementCount: item.replacementCount,
          mainReturnReason: topReason
        };
      })
      .sort((a, b) => b.rmaCount - a.rmaCount);
  }

  /**
   * Marketplace & Store RMA Analysis
   */
  public static getMarketplaceStoreAnalysis(
    rmas: RMAItem[],
    salesRecords: SalesRecord[] = []
  ): MarketplaceStoreRMAAnalysis[] {
    const keyMap = new Map<string, {
      marketplace: string;
      store: string;
      orders: number;
      rmaCases: number;
      returnedUnits: number;
      refundAmount: number;
      replacementCount: number;
    }>();

    // From sales records
    salesRecords.forEach(s => {
      const mp = s.marketplace || 'Direct';
      const st = s.store || 'Main Store';
      const key = `${mp}___${st}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, {
          marketplace: mp,
          store: st,
          orders: 0,
          rmaCases: 0,
          returnedUnits: 0,
          refundAmount: 0,
          replacementCount: 0
        });
      }
      keyMap.get(key)!.orders++;
    });

    // From RMAs
    rmas.forEach(r => {
      const mp = r.marketplace || 'Direct';
      const st = r.store || 'Main Store';
      const key = `${mp}___${st}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, {
          marketplace: mp,
          store: st,
          orders: 0,
          rmaCases: 0,
          returnedUnits: 0,
          refundAmount: 0,
          replacementCount: 0
        });
      }
      const item = keyMap.get(key)!;
      item.rmaCases++;
      item.returnedUnits += r.quantity || 1;
      if (r.refund) {
        item.refundAmount += r.refund.refundAmount || 0;
      }
      if (r.returnType === 'replacement' || r.replacement) {
        item.replacementCount += r.replacement?.replacementQuantity || r.quantity || 1;
      }
    });

    return Array.from(keyMap.values()).map(item => {
      const returnRate =
        item.orders > 0 ? Number(((item.rmaCases / item.orders) * 100).toFixed(2)) : null;
      return {
        ...item,
        returnRate
      };
    }).sort((a, b) => b.rmaCases - a.rmaCases);
  }

  /**
   * Export RMAs to XLSX
   */
  public static exportToExcel(rmas: RMAItem[], filename: string = 'Splus_RMA_Report.xlsx') {
    const data = rmas.map(r => ({
      'RMA Number': r.rmaNumber,
      'Order Number': r.orderNumber,
      'Order Date': r.orderDate || '',
      'Date Created': r.createdAt.split('T')[0],
      'Customer': r.customer,
      'Customer Email': r.customerEmail || '',
      'Customer Phone': r.customerPhone || '',
      'Marketplace': r.marketplace,
      'Store': r.store,
      'Product': r.product,
      'SKU': r.sku,
      'Quantity': r.quantity,
      'Original Price': r.originalSalePrice || '',
      'Return Reason': STANDARD_RETURN_REASONS.find(sr => sr.value === r.reason)?.label || r.reason,
      'Return Type': r.returnType,
      'Status': RMA_STATUS_CONFIG[r.status]?.label || r.status,
      'Carrier': r.returnShippingCarrier || '',
      'Tracking Number': r.returnTrackingNumber || '',
      'Inspection Result': r.inspection?.result || 'Pending',
      'Product Condition': r.inspection?.productCondition || '',
      'Refund Amount': r.refund?.refundAmount || '',
      'Refund Status': r.refund?.refundStatus || '',
      'Replacement Status': r.replacement?.replacementStatus || '',
      'Created By': r.createdBy,
      'Last Updated': r.updatedAt.split('T')[0]
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RMA_Records');
    XLSX.writeFile(workbook, filename);
  }

  /**
   * Export RMAs to CSV
   */
  public static exportToCSV(rmas: RMAItem[], filename: string = 'Splus_RMA_Report.csv') {
    const headers = [
      'RMA Number',
      'Order Number',
      'Created Date',
      'Customer',
      'Marketplace',
      'Store',
      'Product',
      'SKU',
      'Quantity',
      'Reason',
      'Return Type',
      'Status',
      'Inspection',
      'Refund Amount',
      'Refund Status'
    ];

    const rows = rmas.map(r => [
      `"${r.rmaNumber}"`,
      `"${r.orderNumber}"`,
      `"${r.createdAt.split('T')[0]}"`,
      `"${r.customer}"`,
      `"${r.marketplace}"`,
      `"${r.store}"`,
      `"${r.product.replace(/"/g, '""')}"`,
      `"${r.sku}"`,
      r.quantity,
      `"${STANDARD_RETURN_REASONS.find(sr => sr.value === r.reason)?.label || r.reason}"`,
      `"${r.returnType}"`,
      `"${RMA_STATUS_CONFIG[r.status]?.label || r.status}"`,
      `"${r.inspection?.result || 'Pending'}"`,
      r.refund ? r.refund.refundAmount : '',
      `"${r.refund?.refundStatus || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Immediately purge any local demo RMA records on load
if (typeof window !== 'undefined') {
  RMAService.purgeDemoRMAs();
}
