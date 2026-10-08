export type PurchasingDatePreset =
  | 'all'
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'previousMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'custom';

export type POStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Ordered'
  | 'Partially Received'
  | 'Received'
  | 'Cancelled'
  | 'Closed';

export type POPaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export type POReceivingStatus = 'Pending' | 'Partially Received' | 'Received';

export interface Supplier {
  id: string;
  code: string; // e.g. SUP-001
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  country: string;
  address?: string;
  paymentTerms: string; // e.g. Net 15, Net 30, Net 60, Advance, Due on Receipt
  status: 'Active' | 'Inactive';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  sku: string;
  productName: string;
  description?: string;
  quantity: number;
  unitCost: number;
  discount: number; // monetary discount amount
  tax: number; // monetary tax amount
  total: number; // (quantity * unitCost - discount + tax)
  quantityReceived: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g. PO0076 or PO-2026-0001
  supplierId: string;
  supplierName: string; // Buying from Vendor
  poDate: string; // Normalized YYYY-MM-DD for date filtering and sorting
  rawDate?: string; // Original sheet Date string (e.g. 2-Jan-2026)
  reason?: string; // Reason (e.g. Bulk, Restock, Sample)
  purchaser?: string; // Purchaser (e.g. Austin, Faraz)
  buyingForPlatform?: string; // Buying for Platform (e.g. Amazon, TikTok Shop, Walmart, All Platforms)
  buyingFromVendor?: string; // Buying from Vendor
  paymentMethod?: string; // Payment Method (e.g. Payoneer, Bank Transfer, PayPal, Credit Card)
  qtyPurchased?: number; // Qty Purchased
  lineItem?: string | number; // Line Item (description, sku, or line item count/index)
  poAmount?: number; // PO Amount
  trackingNumber?: string; // Tracking No.
  deliveredDate?: string; // Delivered Date
  receivedDate?: string; // Received Date
  expectedDeliveryDate: string; // YYYY-MM-DD
  currency: string;
  paymentTerms: string;
  notes?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: POStatus | string;
  paymentStatus: POPaymentStatus | string;
  receivingStatus: POReceivingStatus;
  totalQuantity: number;
  totalReceivedQuantity: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReceiptItem {
  sku: string;
  productName: string;
  quantityReceived: number;
}

export interface PurchaseReceipt {
  id: string;
  poId: string;
  poNumber: string;
  supplierName: string;
  receiptDate: string;
  receivedBy: string;
  notes?: string;
  items: PurchaseReceiptItem[];
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'Bank Transfer' | 'Cheque' | 'Credit Card' | 'Cash' | 'Wire Transfer' | 'Other';
  referenceNumber?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface PurchasingKPIs {
  totalPurchaseValue: number;
  totalPurchaseOrders: number;
  pendingPurchases: number; // not fully received
  receivedPurchases: number; // fully received
  pendingPayment: number; // total payable outstanding
  activeSuppliers: number; // count of active suppliers
  totalItemsPurchased: number; // sum of quantities
  outstandingPurchaseValue: number; // total value of POs still pending/partial
}

export interface ProductPurchasingSummary {
  product: string;
  sku: string;
  supplier: string;
  quantityPurchased: number;
  averagePurchaseCost: number;
  lastPurchaseCost: number;
  totalPurchaseValue: number;
  purchaseFrequency: number; // count of POs
  lastPurchaseDate: string;
  costHistory: {
    date: string;
    cost: number;
    poNumber: string;
    quantity: number;
  }[];
}

export interface ProductCostChange {
  sku: string;
  product: string;
  supplier: string;
  previousCost: number;
  currentCost: number;
  changeAmount: number;
  changePercentage: number;
  previousDate: string;
  currentDate: string;
}

export interface InventoryStockConnection {
  sku: string;
  product: string;
  currentStock: number;
  onPurchaseOrder: number;
  expectedStock: number;
  reorderStatus: 'In Stock' | 'Low Stock' | 'Reorder Needed' | 'On Order';
  lastPurchaseCost?: number;
  supplierName?: string;
}

export interface PurchasingFilterState {
  datePreset: PurchasingDatePreset;
  customStartDate?: string;
  customEndDate?: string;
  supplierId?: string; // 'all' or specific
  platform?: string; // 'all' or specific Buying for Platform
  purchaser?: string; // 'all' or specific Purchaser
  paymentMethod?: string; // 'all' or specific Payment Method
  status?: string; // 'all' or specific
  paymentStatus?: string; // 'all' or specific
  receivingStatus?: string; // 'all' or specific
  searchQuery?: string;
}

export type PurchasingTrendMetric =
  | 'purchaseValue'
  | 'purchaseOrders'
  | 'quantityPurchased'
  | 'amountPaid'
  | 'outstandingAmount';

export interface PurchasingTrendPoint {
  date: string;
  formattedDate: string;
  purchaseValue: number;
  purchaseOrders: number;
  quantityPurchased: number;
  amountPaid: number;
  outstandingAmount: number;
}
