export interface WmsProductRecord {
  id: string;
  original_sku: string; // Preserved exactly as provided by WMS
  base_sku: string; // Part No. before '+' or full SKU if no '+'
  extension: string; // Extension code after '+', or 'none' / 'Master'
  product_name: string;
  description?: string;
  category?: string;
  warehouse?: string;
  location?: string; // Bin / aisle / rack
  available_qty: number;
  on_hand_qty?: number;
  reserved_qty?: number;
  unit_cost?: number;
  supplier?: string;
  manufacturer?: string;
  status?: string;
  raw_wms_data: Record<string, any>; // Preserved raw imported values
  importBatchId: string;
  importedAt: string;
  organizationId?: string;
}

export interface ProductFamilyGroup {
  base_sku: string;
  product_name: string;
  category: string;
  total_available_qty: number;
  total_on_hand_qty: number;
  total_reserved_qty: number;
  variants: WmsProductRecord[];
  warehouses: string[];
  hasMaster: boolean; // whether master (no extension) is in WMS data
  masterRecord?: WmsProductRecord;
}

export type WmsFileFormat =
  | 'Excel HTML / WMS Export'
  | 'Excel Workbook (XLSX)'
  | 'Binary Excel (XLS BIFF8)'
  | 'CSV Delimited'
  | 'HTML Table';

export type CatalogStandardField =
  | 'sku'
  | 'available_qty'
  | 'description'
  | 'category'
  | 'warehouse'
  | 'location'
  | 'on_hand_qty'
  | 'reserved_qty'
  | 'unit_cost'
  | 'supplier'
  | 'manufacturer'
  | 'status'
  | 'ignore';

export interface CatalogFieldDefinition {
  field: CatalogStandardField;
  label: string;
  required: boolean;
  type: 'string' | 'number';
  aliases: string[];
}

export interface WmsValidationIssue {
  rowNumber: number;
  sku?: string;
  issueType: 'missing_sku' | 'missing_qty' | 'duplicate_sku' | 'invalid_data' | 'footer_filtered';
  message: string;
  data: Record<string, any>;
}

export interface WmsImportValidationSummary {
  totalRowsDetected: number;
  validProducts: number;
  invalidRows: number;
  duplicateSkus: number;
  missingSkuCount: number;
  missingQtyCount: number;
  issues: WmsValidationIssue[];
}

export interface WmsReportAnalysis {
  fileName: string;
  fileSize: number;
  detectedFormat: WmsFileFormat;
  detectedSheetName: string;
  rawRowsCount: number;
  headerRowIndex: number;
  headers: string[];
  metadataRows: string[];
  productRowsCount: number;
  detectedSkuColumn: string;
  detectedQtyColumn: string;
  confidenceScores: Record<string, number>;
  mapping: Record<string, CatalogStandardField>;
  isFromMemory: boolean;
  sampleProducts: WmsProductRecord[];
  validation: WmsImportValidationSummary;
  parsedRecords: WmsProductRecord[];
}

export interface WmsMappingMemory {
  id: string; // Hash or header signature
  name: string;
  headerSignature: string;
  mapping: Record<string, CatalogStandardField>;
  savedAt: string;
  confidence: number;
}
