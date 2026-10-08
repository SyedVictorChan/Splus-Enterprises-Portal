export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'PKR' | 'AED' | 'SAR' | 'INR';

export interface SalesRecord {
  id: string; // unique internal ID
  organizationId?: string; // Enterprise organization identifier
  importBatchId: string;
  orderId: string;
  date: string; // YYYY-MM-DD
  marketplace: string;
  store: string;
  product: string;
  sku: string;
  category?: string;
  units: number;
  sales: number; // gross or total sales
  cost?: number;
  profit?: number;
  returns?: number; // quantity or count
  refunds?: number; // monetary amount
  orderStatus?: 'Completed' | 'Pending' | 'Cancelled' | 'Returned' | string;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Refunded' | string;
  channel?: string;
  customFields?: Record<string, string | number>;
}

export type StandardField = 
  | 'date'
  | 'orderId'
  | 'marketplace'
  | 'store'
  | 'product'
  | 'sku'
  | 'category'
  | 'units'
  | 'sales'
  | 'cost'
  | 'profit'
  | 'returns'
  | 'refunds'
  | 'orderStatus'
  | 'paymentStatus'
  | 'channel';

export interface ColumnMappingDefinition {
  field: StandardField;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date';
  aliases: string[];
}

export interface ImportBatch {
  id: string;
  organizationId?: string; // Enterprise organization identifier
  fileName: string;
  sheetName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  dateRange: {
    start: string;
    end: string;
  };
  marketplaces: string[];
  stores: string[];
  status: 'Successful' | 'Warning' | 'Failed';
}

export interface OrganizationData {
  orgId: string;
  name: string;
  totalRecords: number;
  totalBatches: number;
  lastUpdated: string;
  lastUpdatedBy?: string;
  settings?: AppSettings;
}

export interface MappingTemplate {
  id: string;
  name: string;
  marketplaceHint?: string;
  mappings: Record<string, StandardField | 'ignore'>; // header -> standardField
  mapping?: Record<string, StandardField | 'ignore'>;
  createdAt?: string;
  updatedAt: string;
}

export interface ValidationIssue {
  rowNumber: number;
  rawRecord: Record<string, any>;
  issueType: 'missing_required' | 'invalid_date' | 'invalid_number' | 'duplicate';
  message: string;
}

export interface ParsedSheetData {
  sheetName: string;
  headers: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  rawRows: Record<string, any>[];
  rows?: Record<string, any>[];
  rowCount?: number;
}

export type DateRangePreset = 
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'previousMonth'
  | 'allTime'
  | 'custom';

export interface FilterState {
  datePreset: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  marketplace?: string; // 'all' or specific
  store?: string; // 'all' or specific
  product?: string;
  sku?: string;
  searchQuery?: string;
  orderStatus?: string;
}

export interface KPISummary {
  totalSales: number;
  totalOrders: number;
  totalUnits: number;
  averageOrderValue: number;
  totalProfit: number | null;
  profitMargin: number | null;
  totalReturns: number | null;
  totalRefunds: number | null;
  refundsGrowth?: number | null;
  hasRefundData?: boolean;
  // Growth against previous comparable period
  salesGrowth: number | null;
  ordersGrowth: number | null;
  unitsGrowth: number | null;
  profitGrowth: number | null;
  previousPeriodSales: number | null;
  hasProfitData: boolean;
  hasReturnData: boolean;
}

export interface DayTrendPoint {
  date: string; // YYYY-MM-DD
  formattedDate: string;
  sales: number;
  orders: number;
  units: number;
  profit: number;
  refunds?: number;
}

export interface MarketplaceStat {
  marketplace: string;
  sales: number;
  orders: number;
  units: number;
  aov: number;
  profit: number | null;
  margin: number | null;
  growth: number | null;
  contributionPercent: number;
  storeCount: number;
}

export interface StoreStat {
  store: string;
  marketplace: string;
  sales: number;
  orders: number;
  units: number;
  profit: number | null;
  margin: number | null;
  aov: number;
  growth: number | null;
  contributionPercent: number;
}

export interface ProductStat {
  product: string;
  sku: string;
  marketplace: string;
  store: string;
  units: number;
  sales: number;
  cost: number | null;
  profit: number | null;
  margin: number | null;
  asp: number; // Average Selling Price = Sales / Units
  returns: number;
  growth: number | null;
}

export interface MonthPerformance {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g., "Sep 2026"
  sales: number;
  orders: number;
  units: number;
  profit: number | null;
  aov: number;
  growth: number | null;
}

export interface SalesTarget {
  monthKey: string; // YYYY-MM
  salesTarget: number;
  ordersTarget: number;
  profitTarget: number;
}

export interface RegisteredStore {
  name: string;
  marketplace: string;
  shortName: string;
  fulfillment: string;
  categoryHint?: string;
}

export interface DailySummaryRow {
  companyName: string;
  store: string;
  marketplace: string;
  orders: number;
  totalSales: number;
  refunds: number;
  cancellation: number;
}

export interface DailyReportData {
  date: string; // YYYY-MM-DD
  rows: DailySummaryRow[];
  totalOrders: number;
  totalSales: number;
  totalRefunds: number;
  totalCancellations: number;
  totalPurchasingAmount: number;
}

export interface DailyPurchasingRecord {
  date: string; // YYYY-MM-DD
  purchasingAmount: number;
  notes?: string;
}

export const REGISTERED_STORES: RegisteredStore[] = [
  {
    name: 'Direct Sales',
    marketplace: 'Direct Sales',
    shortName: 'Direct Sales',
    fulfillment: 'Direct B2C',
    categoryHint: 'Direct Brand Portal & Inquiries'
  },
  {
    name: 'Amazon: ebid-dealz',
    marketplace: 'Amazon',
    shortName: 'ebid-dealz',
    fulfillment: 'FBM (Merchant Fulfilled)',
    categoryHint: 'Consumer Electronics & Audio'
  },
  {
    name: 'Amazon: ebid-dealz (FBA)',
    marketplace: 'Amazon',
    shortName: 'ebid-dealz (FBA)',
    fulfillment: 'FBA (Fulfillment by Amazon)',
    categoryHint: 'Prime Eligible Tech & Audio'
  },
  {
    name: 'Amazon: Amoldar',
    marketplace: 'Amazon',
    shortName: 'Amoldar (FBM)',
    fulfillment: 'FBM (Merchant Fulfilled)',
    categoryHint: 'Apparel, Home & Multi-Category'
  },
  {
    name: 'Amazon: Amoldar (FBA)',
    marketplace: 'Amazon',
    shortName: 'Amoldar (FBA)',
    fulfillment: 'FBA (Fulfillment by Amazon)',
    categoryHint: 'Prime Eligible Lifestyle & Apparel'
  },
  {
    name: 'Amazon: Ready2Tech',
    marketplace: 'Amazon',
    shortName: 'Ready2Tech (FBM)',
    fulfillment: 'FBM (Merchant Fulfilled)',
    categoryHint: 'Tech Accessories & Gadgets'
  },
  {
    name: 'Amazon: Ready2Tech (FBA)',
    marketplace: 'Amazon',
    shortName: 'Ready2Tech (FBA)',
    fulfillment: 'FBA (Fulfillment by Amazon)',
    categoryHint: 'Prime Eligible Fast-Ship Tech'
  },
  {
    name: 'eBay: Fast Parts n More',
    marketplace: 'eBay',
    shortName: 'Fast Parts n More',
    fulfillment: 'Merchant Fulfilled',
    categoryHint: 'Auto Parts, Replacement Hardware & Accessories'
  },
  {
    name: 'NewEgg',
    marketplace: 'NewEgg',
    shortName: 'NewEgg Standard',
    fulfillment: 'Seller Fulfilled',
    categoryHint: 'PC Hardware, Computing & Peripherals'
  },
  {
    name: 'NewEgg (SBN)',
    marketplace: 'NewEgg',
    shortName: 'NewEgg (SBN)',
    fulfillment: 'Shipped by NewEgg (SBN)',
    categoryHint: 'High-Velocity Components & Hubs'
  },
  {
    name: 'eBay: Refreshed Electronics',
    marketplace: 'eBay',
    shortName: 'Refreshed Electronics',
    fulfillment: 'Merchant Fulfilled',
    categoryHint: 'Certified Refurbished Tech, Displays & Audio'
  },
  {
    name: 'eBay: Amoldar Fashions',
    marketplace: 'eBay',
    shortName: 'Amoldar Fashions',
    fulfillment: 'Merchant Fulfilled',
    categoryHint: 'Apparel, Outerwear, Activewear & Belts'
  },
  {
    name: 'Walmart - Amoldar',
    marketplace: 'Walmart',
    shortName: 'Amoldar Standard',
    fulfillment: 'Seller Fulfilled',
    categoryHint: 'Multi-Category Home & Lifestyle Goods'
  },
  {
    name: 'Walmart - Amoldar (WFS)',
    marketplace: 'Walmart',
    shortName: 'Amoldar (WFS)',
    fulfillment: 'Walmart Fulfillment Services (WFS)',
    categoryHint: '2-Day WFS Guaranteed Fulfillment'
  }
];

export interface AppSettings {
  companyName: string;
  currency: CurrencyCode;
  currencySymbol: string;
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
  darkMode: boolean;
  targets: Record<string, SalesTarget>; // monthKey -> target
  rememberMappings: boolean;
}

export * from './rbac';

export type NavTab =
  | 'dashboard'
  | 'daily-sales'
  | 'analytics'
  | 'marketplaces'
  | 'stores'
  | 'products'
  | 'purchasing'
  | 'rma'
  | 'reports'
  | 'import'
  | 'settings'
  | 'team';

export * from './purchasing';
export * from './rma';
export * from './productCatalog';

