import * as XLSX from 'xlsx';
import {
  CatalogFieldDefinition,
  CatalogStandardField,
  WmsFileFormat,
  WmsMappingMemory,
  WmsProductRecord,
  WmsReportAnalysis,
  WmsValidationIssue
} from '../types/productCatalog';

export const CATALOG_STANDARD_FIELDS: CatalogFieldDefinition[] = [
  {
    field: 'sku',
    label: 'Part No. / SKU',
    required: true,
    type: 'string',
    aliases: [
      'part no.', 'part no', 'part number', 'part #', 'sku', 'sku code', 'item no',
      'item number', 'item #', 'item code', 'product code', 'product sku', 'material', 'material no'
    ]
  },
  {
    field: 'available_qty',
    label: 'Available Quantity',
    required: true,
    type: 'number',
    aliases: [
      'available qty', 'available quantity', 'available stock', 'avail qty', 'available',
      'stock available', 'qty available', 'free stock', 'allocatable qty', 'unreserved stock'
    ]
  },
  {
    field: 'description',
    label: 'Product Description / Name',
    required: false,
    type: 'string',
    aliases: [
      'product description', 'description', 'product name', 'item description', 'part description',
      'title', 'item name', 'product', 'item title'
    ]
  },
  {
    field: 'category',
    label: 'Category',
    required: false,
    type: 'string',
    aliases: [
      'category', 'product category', 'dept', 'department', 'family', 'product family', 'group', 'class'
    ]
  },
  {
    field: 'warehouse',
    label: 'Warehouse / Facility',
    required: false,
    type: 'string',
    aliases: [
      'warehouse', 'facility', 'whse', 'plant', 'site', 'warehouse code', 'dc', 'branch'
    ]
  },
  {
    field: 'location',
    label: 'Location / Bin',
    required: false,
    type: 'string',
    aliases: [
      'location', 'location / bin', 'bin', 'bin location', 'aisle', 'shelf', 'rack', 'storage location', 'loc'
    ]
  },
  {
    field: 'on_hand_qty',
    label: 'On Hand Quantity',
    required: false,
    type: 'number',
    aliases: [
      'on hand qty', 'on hand quantity', 'on hand', 'qty on hand', 'total on hand', 'physical qty', 'current stock'
    ]
  },
  {
    field: 'reserved_qty',
    label: 'Reserved Quantity',
    required: false,
    type: 'number',
    aliases: [
      'reserved qty', 'reserved quantity', 'allocated qty', 'committed qty', 'reserved', 'allocated', 'held qty'
    ]
  },
  {
    field: 'unit_cost',
    label: 'Unit Cost',
    required: false,
    type: 'number',
    aliases: [
      'unit cost', 'cost', 'item cost', 'standard cost', 'avg cost', 'purchase cost', 'cogs'
    ]
  },
  {
    field: 'supplier',
    label: 'Supplier / Vendor',
    required: false,
    type: 'string',
    aliases: [
      'supplier', 'vendor', 'manufacturer', 'source', 'vendor name', 'supplier name', 'mfg'
    ]
  },
  {
    field: 'status',
    label: 'Stock Status',
    required: false,
    type: 'string',
    aliases: [
      'status', 'stock status', 'item status', 'condition', 'active status', 'state'
    ]
  }
];

const WMS_MAPPING_STORAGE_KEY = 'splus_wms_mapping_memory_v1';

/**
 * Split SKU into base_sku and extension according to Splus specifications
 * E.g.:
 * 77Z32AA    => base: 77Z32AA, ext: 'Master' (or 'none')
 * 77Z32AA+AA => base: 77Z32AA, ext: 'AA'
 * 77Z32AA+BB => base: 77Z32AA, ext: 'BB'
 * 77Z32AA+CC => base: 77Z32AA, ext: 'CC'
 */
export function parseSkuHierarchy(originalSku: string): { base_sku: string; extension: string } {
  const trimmed = String(originalSku || '').trim();
  if (!trimmed) {
    return { base_sku: '', extension: 'Master' };
  }

  const plusIndex = trimmed.indexOf('+');
  if (plusIndex !== -1) {
    const base = trimmed.substring(0, plusIndex).trim();
    const ext = trimmed.substring(plusIndex + 1).trim();
    return {
      base_sku: base || trimmed,
      extension: ext || 'Master'
    };
  }

  return {
    base_sku: trimmed,
    extension: 'Master'
  };
}

/**
 * Generate a fingerprint for column headers to recall mappings across imports
 */
export function generateHeaderSignature(headers: string[]): string {
  return headers
    .map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .sort()
    .join('|');
}

/**
 * Load saved mapping from memory by header signature
 */
export function getSavedMapping(headers: string[]): Record<string, CatalogStandardField> | null {
  try {
    const sig = generateHeaderSignature(headers);
    const raw = localStorage.getItem(WMS_MAPPING_STORAGE_KEY);
    if (!raw) return null;
    const store: Record<string, WmsMappingMemory> = JSON.parse(raw);
    const entry = store[sig];
    return entry ? entry.mapping : null;
  } catch (err) {
    console.warn('Failed to load saved WMS mapping:', err);
    return null;
  }
}

/**
 * Save user mapping to memory for subsequent imports
 */
export function saveMappingToMemory(headers: string[], mapping: Record<string, CatalogStandardField>): void {
  try {
    const sig = generateHeaderSignature(headers);
    const raw = localStorage.getItem(WMS_MAPPING_STORAGE_KEY);
    const store: Record<string, WmsMappingMemory> = raw ? JSON.parse(raw) : {};
    store[sig] = {
      id: sig,
      name: `WMS Format (${headers.slice(0, 3).join(', ')})`,
      headerSignature: sig,
      mapping,
      savedAt: new Date().toISOString(),
      confidence: 100
    };
    localStorage.setItem(WMS_MAPPING_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Failed to save WMS mapping memory:', err);
  }
}

/**
 * Intelligently detect file format from raw bytes / text snippet
 */
export async function detectWmsFileFormat(file: File): Promise<{
  format: WmsFileFormat;
  isHtml: boolean;
  sampleText: string;
}> {
  const sliceSize = Math.min(file.size, 8192);
  const buffer = await file.slice(0, sliceSize).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for PK ZIP (XLSX)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { format: 'Excel Workbook (XLSX)', isHtml: false, sampleText: '' };
  }

  // Check for OLE2 BIFF8 (Compound Binary XLS)
  if (
    bytes[0] === 0xd0 && bytes[1] === 0xcf &&
    bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 &&
    bytes[6] === 0x1a && bytes[7] === 0xe1
  ) {
    return { format: 'Binary Excel (XLS BIFF8)', isHtml: false, sampleText: '' };
  }

  // Read as text
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(buffer);
  const lowerText = text.toLowerCase();

  const isExcelHtml =
    lowerText.includes('xmlns:x="urn:schemas-microsoft-com:office:excel"') ||
    lowerText.includes('xmlns:o="urn:schemas-microsoft-com:office:office"') ||
    lowerText.includes('progid" content="excel.sheet') ||
    lowerText.includes('<x:excelworkbook>') ||
    lowerText.includes('mso-number-format') ||
    (lowerText.includes('<html') && lowerText.includes('<table'));

  if (isExcelHtml) {
    return { format: 'Excel HTML / WMS Export', isHtml: true, sampleText: text };
  }

  if (lowerText.includes('<html') || lowerText.includes('<table')) {
    return { format: 'HTML Table', isHtml: true, sampleText: text };
  }

  return { format: 'CSV Delimited', isHtml: false, sampleText: text };
}

/**
 * Parse HTML content (from Excel HTML .xls export) into tabular rows
 */
function parseExcelHtmlToRows(htmlContent: string): {
  sheetName: string;
  rows: string[][];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  // Attempt to extract worksheet name from Excel XML or document title
  let sheetName = 'StockStatusReport';
  const worksheetTag = doc.querySelector('Worksheet, x\\:Worksheet, [Name]');
  if (worksheetTag && worksheetTag.getAttribute('Name')) {
    sheetName = worksheetTag.getAttribute('Name')!;
  } else {
    // Try regex on raw XML comment block: <x:Name>...</x:Name>
    const nameMatch = htmlContent.match(/<x:Name>([^<]+)<\/x:Name>/i);
    if (nameMatch && nameMatch[1]) {
      sheetName = nameMatch[1].trim();
    } else if (doc.title && doc.title.trim()) {
      sheetName = doc.title.trim();
    }
  }

  // Find all tables and pick the table that represents the stock report
  const tables = Array.from(doc.querySelectorAll('table'));
  if (tables.length === 0) {
    return { sheetName, rows: [] };
  }

  // Choose the table with the most rows/cells
  let bestTable = tables[0];
  let maxCells = 0;
  for (const t of tables) {
    const cellsCount = t.querySelectorAll('td, th').length;
    if (cellsCount > maxCells) {
      maxCells = cellsCount;
      bestTable = t;
    }
  }

  // Extract grid rows
  const trElements = Array.from(bestTable.querySelectorAll('tr'));
  const rows: string[][] = [];

  for (const tr of trElements) {
    const cells = Array.from(tr.querySelectorAll('th, td'));
    const rowValues: string[] = [];
    for (const cell of cells) {
      // Preserve innerText or textContent without stripping important formatting
      const text = (cell.textContent || '').trim();
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      rowValues.push(text);
      // For colspan, we can push empty cells to maintain column alignment
      for (let i = 1; i < colspan; i++) {
        rowValues.push('');
      }
    }
    // Only push if row has at least one non-empty value
    if (rowValues.some(v => v.length > 0)) {
      rows.push(rowValues);
    }
  }

  return { sheetName, rows };
}

/**
 * Score a row for being the actual stock catalog header row
 */
function scoreRowAsCatalogHeader(row: string[]): number {
  if (!row || row.length < 2) return 0;

  let score = 0;
  const normalizedCells = row.map(c => c.toLowerCase().trim());

  // SKU match is essential
  const hasSkuKeyword = normalizedCells.some(cell =>
    ['part no.', 'part no', 'part number', 'part #', 'sku', 'item code', 'item no', 'item #', 'material'].some(k => cell === k || cell.includes(k))
  );
  if (hasSkuKeyword) score += 50;

  // Quantity match
  const hasQtyKeyword = normalizedCells.some(cell =>
    ['qty', 'quantity', 'available qty', 'available quantity', 'on hand', 'stock'].some(k => cell === k || cell.includes(k))
  );
  if (hasQtyKeyword) score += 35;

  // Description / Product match
  const hasDescKeyword = normalizedCells.some(cell =>
    ['description', 'product', 'item name', 'title'].some(k => cell === k || cell.includes(k))
  );
  if (hasDescKeyword) score += 20;

  // Warehouse / Location match
  const hasWhseKeyword = normalizedCells.some(cell =>
    ['warehouse', 'facility', 'location', 'bin', 'loc'].some(k => cell === k || cell.includes(k))
  );
  if (hasWhseKeyword) score += 15;

  // Cost / Status match
  const hasCostOrStatus = normalizedCells.some(cell =>
    ['cost', 'unit cost', 'price', 'status', 'supplier', 'category'].some(k => cell === k || cell.includes(k))
  );
  if (hasCostOrStatus) score += 10;

  // Penalty if row looks like title (e.g. single cell with long text or contains report/summary/generated)
  const nonEmptyCells = normalizedCells.filter(Boolean);
  if (nonEmptyCells.length <= 2 && row.length > 4) {
    score -= 30;
  }
  if (normalizedCells.some(c => c.includes('report') && c.includes('system'))) {
    score -= 40;
  }

  return score;
}

/**
 * Check if a row is a footer, total, or disclaimer row that should NOT be imported as a product
 */
function isFooterOrTotalRow(row: string[], headers: string[]): boolean {
  if (!row || row.length === 0) return true;
  const joined = row.join(' ').toLowerCase().trim();

  // If entirely blank
  if (!joined || joined.replace(/[\s\xa0]/g, '').length === 0) return true;

  // Obvious footer keywords
  if (
    joined.startsWith('total') ||
    joined.startsWith('grand total') ||
    joined.startsWith('report summary') ||
    joined.startsWith('subtotal') ||
    joined.startsWith('***') ||
    joined.includes('end of') ||
    joined.includes('page ') ||
    joined.includes('confidential') ||
    joined.includes('total facility inventory') ||
    joined.includes('total records') ||
    joined.includes('records count')
  ) {
    return true;
  }

  // If first cell contains "total"
  const firstNonEmpty = row.find(c => c.trim().length > 0) || '';
  if (
    firstNonEmpty.toLowerCase().startsWith('total') ||
    firstNonEmpty.toLowerCase().startsWith('grand total') ||
    firstNonEmpty.toLowerCase().startsWith('sub total')
  ) {
    return true;
  }

  return false;
}

/**
 * Intelligent automatic mapping with confidence scoring
 */
export function autoDetectCatalogColumns(headers: string[]): {
  mapping: Record<string, CatalogStandardField>;
  confidenceScores: Record<string, number>;
  detectedSkuColumn: string;
  detectedQtyColumn: string;
} {
  const mapping: Record<string, CatalogStandardField> = {};
  const confidenceScores: Record<string, number> = {};
  const mappedFields = new Set<CatalogStandardField>();

  let detectedSkuColumn = '';
  let detectedQtyColumn = '';

  for (const header of headers) {
    const cleanHeader = header.toLowerCase().replace(/[_\W]+/g, ' ').trim();
    let bestField: CatalogStandardField | null = null;
    let bestScore = 0;

    for (const def of CATALOG_STANDARD_FIELDS) {
      if (mappedFields.has(def.field)) continue;

      for (const alias of def.aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[_\W]+/g, ' ').trim();
        if (cleanHeader === cleanAlias) {
          bestField = def.field;
          bestScore = 98;
          break;
        } else if (cleanHeader.includes(cleanAlias) || cleanAlias.includes(cleanHeader)) {
          // Calculate proportional confidence
          const score = 85;
          if (score > bestScore) {
            bestField = def.field;
            bestScore = score;
          }
        }
      }
      if (bestScore >= 98) break;
    }

    if (bestField && bestScore >= 75) {
      mapping[header] = bestField;
      confidenceScores[header] = bestScore;
      mappedFields.add(bestField);

      if (bestField === 'sku') detectedSkuColumn = header;
      if (bestField === 'available_qty') detectedQtyColumn = header;
    } else {
      mapping[header] = 'ignore';
      confidenceScores[header] = 20;
    }
  }

  // Fallback for SKU if not mapped
  if (!detectedSkuColumn) {
    for (const header of headers) {
      const lower = header.toLowerCase();
      if (lower.includes('sku') || lower.includes('part') || lower.includes('item')) {
        mapping[header] = 'sku';
        confidenceScores[header] = 78;
        detectedSkuColumn = header;
        break;
      }
    }
  }

  // Fallback for Available Quantity
  if (!detectedQtyColumn) {
    for (const header of headers) {
      const lower = header.toLowerCase();
      if (lower.includes('avail') || lower.includes('qty') || lower.includes('stock')) {
        mapping[header] = 'available_qty';
        confidenceScores[header] = 75;
        detectedQtyColumn = header;
        break;
      }
    }
  }

  return { mapping, confidenceScores, detectedSkuColumn, detectedQtyColumn };
}

/**
 * Main parser function: Analyzes WMS Stock Status Report
 * Inspects format, skips metadata/title rows, detects actual product table,
 * maps columns with memory support, extracts products and validates rows.
 */
export async function analyzeAndParseWmsReport(file: File): Promise<WmsReportAnalysis> {
  const { format, isHtml } = await detectWmsFileFormat(file);

  let rawSheetName = file.name.replace(/\.[^/.]+$/, '');
  let rawGrid: string[][] = [];

  if (isHtml) {
    const fileContent = await file.text();
    const result = parseExcelHtmlToRows(fileContent);
    rawGrid = result.rows;
    if (result.sheetName) rawSheetName = result.sheetName;
  } else {
    // Binary Excel or CSV via SheetJS
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      raw: false,
      cellDates: true
    });
    const firstSheetName = workbook.SheetNames[0] || 'Sheet1';
    rawSheetName = firstSheetName;
    const worksheet = workbook.Sheets[firstSheetName];
    // Convert to row arrays
    rawGrid = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      defval: '',
      raw: false
    });
  }

  // 1. Identify the actual column header row
  let headerRowIndex = -1;
  let highestScore = 0;

  // Scan top 25 rows
  const maxScanRows = Math.min(rawGrid.length, 25);
  for (let i = 0; i < maxScanRows; i++) {
    const score = scoreRowAsCatalogHeader(rawGrid[i]);
    if (score > highestScore && score >= 40) {
      highestScore = score;
      headerRowIndex = i;
    }
  }

  // If not detected with confidence, fallback to the first row with >= 3 non-empty cells
  if (headerRowIndex === -1) {
    for (let i = 0; i < maxScanRows; i++) {
      if (rawGrid[i] && rawGrid[i].filter(Boolean).length >= 3) {
        headerRowIndex = i;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  // Metadata rows before header row
  const metadataRows: string[] = [];
  for (let i = 0; i < headerRowIndex; i++) {
    const line = rawGrid[i].filter(Boolean).join(' | ').trim();
    if (line) metadataRows.push(line);
  }

  // Headers
  const rawHeadersRow = rawGrid[headerRowIndex] || [];
  const headers = rawHeadersRow.map((h, idx) => (h ? String(h).trim() : `Column_${idx + 1}`));

  // 2. Check saved mapping memory or auto-detect
  const savedMapping = getSavedMapping(headers);
  const isFromMemory = Boolean(savedMapping);

  const {
    mapping: detectedMapping,
    confidenceScores,
    detectedSkuColumn,
    detectedQtyColumn
  } = autoDetectCatalogColumns(headers);

  const activeMapping = savedMapping ? { ...savedMapping } : detectedMapping;

  // 3. Process data rows below header row
  const batchId = `wms_batch_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const parsedRecords: WmsProductRecord[] = [];
  const issues: WmsValidationIssue[] = [];

  let duplicateSkuCount = 0;
  let missingSkuCount = 0;
  let missingQtyCount = 0;
  let invalidRowCount = 0;

  // Reverse mapping: standardField -> headerName
  const fieldToHeader: Partial<Record<CatalogStandardField, string>> = {};
  for (const [hdr, fld] of Object.entries(activeMapping)) {
    if (fld !== 'ignore' && !fieldToHeader[fld]) {
      fieldToHeader[fld] = hdr;
    }
  }

  const skuHeader = fieldToHeader['sku'] || detectedSkuColumn;
  const qtyHeader = fieldToHeader['available_qty'] || detectedQtyColumn;
  const descHeader = fieldToHeader['description'];
  const catHeader = fieldToHeader['category'];
  const whseHeader = fieldToHeader['warehouse'];
  const locHeader = fieldToHeader['location'];
  const onHandHeader = fieldToHeader['on_hand_qty'];
  const reservedHeader = fieldToHeader['reserved_qty'];
  const costHeader = fieldToHeader['unit_cost'];
  const suppHeader = fieldToHeader['supplier'];
  const mfgHeader = fieldToHeader['manufacturer'];
  const statusHeader = fieldToHeader['status'];

  const seenSkuLocations = new Set<string>();

  for (let r = headerRowIndex + 1; r < rawGrid.length; r++) {
    const rowValues = rawGrid[r];
    if (!rowValues || rowValues.length === 0) continue;

    // Check footer / summary
    if (isFooterOrTotalRow(rowValues, headers)) {
      continue;
    }

    // Map row to raw object
    const rawData: Record<string, string> = {};
    headers.forEach((hdr, colIdx) => {
      rawData[hdr] = (rowValues[colIdx] || '').trim();
    });

    // Check SKU: MUST preserve exact SKU without character modification or number conversion!
    const rawSku = (rawData[skuHeader] || '').trim();
    if (!rawSku) {
      missingSkuCount++;
      invalidRowCount++;
      issues.push({
        rowNumber: r + 1,
        issueType: 'missing_sku',
        message: 'Missing SKU / Part Number',
        data: rawData
      });
      continue;
    }

    // Check Quantity
    const rawQtyStr = (rawData[qtyHeader] || '').replace(/[^0-9.-]/g, '');
    const availableQty = rawQtyStr ? parseFloat(rawQtyStr) : 0;
    if (isNaN(availableQty) && !rawData[qtyHeader]) {
      missingQtyCount++;
      issues.push({
        rowNumber: r + 1,
        sku: rawSku,
        issueType: 'missing_qty',
        message: 'Missing Available Quantity (defaulted to 0)',
        data: rawData
      });
    }

    // On Hand Qty
    const rawOnHandStr = onHandHeader ? (rawData[onHandHeader] || '').replace(/[^0-9.-]/g, '') : '';
    const onHandQty = rawOnHandStr ? parseFloat(rawOnHandStr) : availableQty;

    // Reserved Qty
    const rawReservedStr = reservedHeader ? (rawData[reservedHeader] || '').replace(/[^0-9.-]/g, '') : '';
    const reservedQty = rawReservedStr ? parseFloat(rawReservedStr) : 0;

    // Unit Cost
    const rawCostStr = costHeader ? (rawData[costHeader] || '').replace(/[^0-9.-]/g, '') : '';
    const unitCost = rawCostStr ? parseFloat(rawCostStr) : undefined;

    const warehouse = whseHeader ? (rawData[whseHeader] || 'WH-MAIN') : 'WH-MAIN';
    const location = locHeader ? (rawData[locHeader] || 'DEFAULT') : 'DEFAULT';

    // Duplicate check:
    // If exact same SKU + warehouse + location appears again, flag duplicate
    const skuLocKey = `${rawSku}:::${warehouse}:::${location}`.toLowerCase();
    if (seenSkuLocations.has(skuLocKey)) {
      duplicateSkuCount++;
      issues.push({
        rowNumber: r + 1,
        sku: rawSku,
        issueType: 'duplicate_sku',
        message: `Duplicate SKU '${rawSku}' in same warehouse '${warehouse}' and location '${location}'`,
        data: rawData
      });
    } else {
      seenSkuLocations.add(skuLocKey);
    }

    // SKU Hierarchy (Base + Extension)
    const { base_sku, extension } = parseSkuHierarchy(rawSku);

    // Build Product Record
    const record: WmsProductRecord = {
      id: `wms_prod_${rawSku}_${warehouse}_${location}_${r}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      original_sku: rawSku,
      base_sku,
      extension,
      product_name: descHeader ? (rawData[descHeader] || rawSku) : rawSku,
      description: descHeader ? rawData[descHeader] : undefined,
      category: catHeader ? rawData[catHeader] : 'General',
      warehouse,
      location,
      available_qty: isNaN(availableQty) ? 0 : availableQty,
      on_hand_qty: isNaN(onHandQty) ? availableQty : onHandQty,
      reserved_qty: isNaN(reservedQty) ? 0 : reservedQty,
      unit_cost: unitCost,
      supplier: suppHeader ? rawData[suppHeader] : undefined,
      manufacturer: mfgHeader ? rawData[mfgHeader] : undefined,
      status: statusHeader ? rawData[statusHeader] : 'Active',
      raw_wms_data: rawData,
      importBatchId: batchId,
      importedAt: nowIso
    };

    parsedRecords.push(record);
  }

  const totalRowsDetected = rawGrid.length - (headerRowIndex + 1);

  return {
    fileName: file.name,
    fileSize: file.size,
    detectedFormat: format,
    detectedSheetName: rawSheetName,
    rawRowsCount: rawGrid.length,
    headerRowIndex,
    headers,
    metadataRows,
    productRowsCount: parsedRecords.length,
    detectedSkuColumn: skuHeader || headers[0] || 'Part No.',
    detectedQtyColumn: qtyHeader || headers[1] || 'Available Qty',
    confidenceScores,
    mapping: activeMapping,
    isFromMemory,
    sampleProducts: parsedRecords.slice(0, 8),
    parsedRecords,
    validation: {
      totalRowsDetected,
      validProducts: parsedRecords.length,
      invalidRows: invalidRowCount,
      duplicateSkus: duplicateSkuCount,
      missingSkuCount,
      missingQtyCount,
      issues
    }
  };
}
