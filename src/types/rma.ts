export type RMAStatus =
  | 'requested'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'return_in_transit'
  | 'received'
  | 'pending_inspection'
  | 'under_inspection'
  | 'inspection_completed'
  | 'refund_pending'
  | 'replacement_pending'
  | 'replacement_shipped'
  | 'refunded'
  | 'completed'
  | 'cancelled';

export type ReturnReason =
  | 'defective_product'
  | 'damaged_in_transit'
  | 'wrong_product'
  | 'wrong_size'
  | 'missing_parts'
  | 'not_as_described'
  | 'customer_changed_mind'
  | 'quality_issue'
  | 'packaging_issue'
  | 'duplicate_order'
  | 'other';

export type ReturnType =
  | 'refund'
  | 'replacement'
  | 'exchange'
  | 'repair'
  | 'store_credit'
  | 'other';

export type ProductCondition =
  | 'new'
  | 'like_new'
  | 'used'
  | 'damaged'
  | 'defective'
  | 'unsellable';

export type PackagingCondition =
  | 'intact'
  | 'damaged'
  | 'missing'
  | 'opened';

export type InspectionResult =
  | 'approved'
  | 'rejected'
  | 'needs_further_review';

export interface InspectionDetails {
  inspectedAt?: string;
  inspectedBy?: string;
  productCondition?: ProductCondition;
  packagingCondition?: PackagingCondition;
  accessoriesIncluded?: 'yes' | 'partial' | 'no';
  physicalDamage?: string;
  functionalCondition?: string;
  missingComponents?: string;
  inspectionNotes?: string;
  photos?: string[];
  result?: InspectionResult;
  sellableUnits?: number;
  damagedUnits?: number;
  unsellableUnits?: number;
  restocked?: boolean;
  restockedAt?: string;
  restockedBy?: string;
}

export interface RefundResolution {
  refundAmount: number;
  refundMethod: 'original_payment' | 'bank_transfer' | 'store_credit' | 'cash' | 'other';
  refundDate?: string;
  refundReference?: string;
  refundStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ReplacementResolution {
  replacementSku: string;
  replacementProduct?: string;
  replacementQuantity: number;
  replacementOrderId?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  shipmentDate?: string;
  replacementStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
}

export interface ExchangeResolution {
  originalProduct: string;
  replacementProduct: string;
  quantity: number;
  exchangeDate?: string;
  exchangeStatus: 'pending' | 'processing' | 'completed' | 'cancelled';
}

export interface RepairResolution {
  repairRequired: string;
  repairVendor?: string;
  repairCost?: number;
  repairStatus: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  repairCompletionDate?: string;
}

export interface StoreCreditResolution {
  creditCode?: string;
  creditAmount: number;
  issuedDate?: string;
  creditStatus: 'pending' | 'issued' | 'used';
}

export interface RMATimelineEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  user: string;
  action: string;
  notes?: string;
  previousStatus?: RMAStatus;
  newStatus?: RMAStatus;
}

export interface RMAAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  uploadedAt: string;
  uploadedBy: string;
  type?: string;
}

export interface RMANote {
  id: string;
  user: string;
  date: string;
  time: string;
  message: string;
}

export interface RMAItem {
  id: string;
  organizationId?: string;
  rmaNumber: string; // e.g. RMA-2026-000001
  orderNumber: string;
  orderDate?: string;
  customer: string;
  customerContact?: string;
  customerEmail?: string;
  customerPhone?: string;
  marketplace: string;
  store: string;
  product: string;
  sku: string;
  quantity: number;
  originalSalePrice?: number;
  originalCost?: number;
  reason: ReturnReason;
  customReason?: string;
  returnType: ReturnType;
  status: RMAStatus;
  returnShippingCarrier?: string;
  returnTrackingNumber?: string;
  customerNotes?: string;
  internalNotes?: string;
  notesList?: RMANote[];
  attachments?: RMAAttachment[];
  inspection?: InspectionDetails;
  refund?: RefundResolution;
  replacement?: ReplacementResolution;
  exchange?: ExchangeResolution;
  repair?: RepairResolution;
  storeCredit?: StoreCreditResolution;
  timeline: RMATimelineEvent[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RMADatePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'previousMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'custom';

export interface RMAFilterState {
  datePreset: RMADatePreset;
  customStartDate?: string;
  customEndDate?: string;
  status?: string; // 'all' or specific status
  marketplace?: string; // 'all' or specific
  store?: string; // 'all' or specific
  product?: string;
  sku?: string;
  reason?: string; // 'all' or specific
  returnType?: string; // 'all' or specific
  resolution?: string; // 'all' or specific
  inspectionStatus?: string; // 'all' or specific
  refundStatus?: string; // 'all' or specific
  replacementStatus?: string; // 'all' or specific
  searchQuery?: string;
}

export interface RMAKpiSummary {
  totalRmas: number;
  openRmas: number;
  pendingInspection: number;
  approvedRmas: number;
  rejectedRmas: number;
  completedRmas: number;
  pendingRefund: number;
  pendingReplacement: number;
  totalRefundAmount: number;
  pendingRefundAmount: number;
  completedRefundAmount: number;
  totalReturnedUnits: number;
  returnRate: number | null; // Returned units / Sold units * 100
  rmaRate: number | null; // RMA cases / Orders * 100
}

export type RMAKPIs = RMAKpiSummary;

export interface ProductReturnAnalysis {
  product: string;
  sku: string;
  unitsSold: number;
  unitsReturned: number;
  returnRate: number | null;
  rmaCount: number;
  refundAmount: number;
  replacementCount: number;
  mainReturnReason: string;
}

export interface MarketplaceStoreRMAAnalysis {
  marketplace: string;
  store: string;
  orders: number;
  rmaCases: number;
  returnedUnits: number;
  returnRate: number | null;
  refundAmount: number;
  replacementCount: number;
}
