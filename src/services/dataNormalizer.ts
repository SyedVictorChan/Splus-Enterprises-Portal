import { SalesRecord, StandardField, ValidationIssue, REGISTERED_STORES } from '../types';

/**
 * Robust number parsing handling currency prefixes, commas, brackets for negative values, and dashes
 * e.g., "PKR 15,500" -> 15500, "$1,234.50" -> 1234.5, "(500)" -> -500, "-" -> 0
 */
export function parseCleanNumber(val: any, defaultValue: number = 0): number {
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === 'number') {
    return isNaN(val) ? defaultValue : val;
  }

  let str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') {
    return defaultValue;
  }

  // Check for negative in parentheses e.g. (1,500)
  const isParenthesesNegative = /^\(.*\)$/.test(str);
  // Remove currency words, symbols, and commas
  str = str.replace(/[^0-9.-]/g, '');

  if (!str) return defaultValue;

  let num = parseFloat(str);
  if (isNaN(num)) return defaultValue;
  if (isParenthesesNegative && num > 0) {
    num = -num;
  }
  return num;
}

/**
 * Robust date parser supporting Excel serial numbers, ISO strings, DD/MM/YYYY, MM/DD/YYYY, and month names
 * Returns YYYY-MM-DD format
 */
export function parseCleanDate(val: any): string | null {
  if (val === null || val === undefined) return null;

  // Handle Excel Serial Date numbers (e.g. 45180)
  if (typeof val === 'number') {
    // Excel base date is Dec 30 1899
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const days = Math.floor(val);
    const ms = Math.round((val - days) * 86400000);
    const date = new Date(excelEpoch.getTime() + days * 86400000 + ms);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Handle YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)) {
    const parts = str.split('/');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // Handle DD-MM-YYYY or DD/MM/YYYY vs MM/DD/YYYY
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    // If year is 4 digits at the end
    if (parts[2].length === 4) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const year = parts[2];

      // If p0 > 12, it MUST be DD/MM/YYYY
      if (p0 > 12 && p1 <= 12) {
        return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
      }
      // If p1 > 12, it MUST be MM/DD/YYYY
      if (p1 > 12 && p0 <= 12) {
        return `${year}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      }
      // Default standard assumption for reporting sheets: DD/MM/YYYY unless standard US
      return `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
    }
  }

  // Try standard Date parsing for "15 Sep 2026", "September 15, 2026", etc.
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Standardize marketplace names
 */
export function normalizeMarketplace(raw: any, storeHint?: string): string {
  if (storeHint) {
    const sLower = storeHint.toLowerCase();
    if (sLower.includes('amazon') || sLower.includes('ebid-dealz') || sLower.includes('fba')) return 'Amazon';
    if (sLower.includes('ebay') || sLower.includes('fast parts') || sLower.includes('refreshed') || sLower.includes('amoldar fashions') || sLower.includes('amoldar fashion')) return 'eBay';
    if (sLower.includes('walmart') || sLower.includes('wfs') || sLower.includes('amoldar (wfs)')) return 'Walmart';
    if (sLower.includes('newegg') || sLower.includes('sbn')) return 'NewEgg';
    if (sLower.includes('direct')) return 'Direct Sales';
  }

  if (!raw) return 'Direct Sales';
  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('amazon')) return 'Amazon';
  if (lower.includes('ebay')) return 'eBay';
  if (lower.includes('walmart')) return 'Walmart';
  if (lower.includes('newegg')) return 'NewEgg';
  if (lower.includes('direct')) return 'Direct Sales';
  if (lower.includes('shopify')) return 'Shopify';
  if (lower.includes('website') || lower.includes('web') || lower.includes('online store')) return 'Direct Sales';
  if (lower.includes('daraz')) return 'Daraz';
  if (lower.includes('tiktok')) return 'TikTok Shop';
  if (lower.includes('noon')) return 'Noon';
  if (lower.includes('lazada')) return 'Lazada';
  if (lower.includes('shopee')) return 'Shopee';

  // Capitalize first letter of each word
  return trimmed
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Standardize store names matching user's exact multi-channel catalog:
 * - Direct Sales
 * - Amazon: ebid-dealz
 * - Amazon: ebid-dealz (FBA)
 * - NewEgg
 * - NewEgg (SBN)
 * - eBay: Fast Parts n More
 * - eBay: Refreshed Electronics
 * - eBay: Amoldar Fashions
 * - Walmart - Amoldar
 * - Walmart - Amoldar (WFS)
 */
export function normalizeStore(raw: any, fallbackMarketplace: string = 'Direct Sales'): string {
  if (!raw) {
    if (fallbackMarketplace === 'Amazon') return 'Amazon: ebid-dealz';
    if (fallbackMarketplace === 'NewEgg') return 'NewEgg';
    if (fallbackMarketplace === 'Walmart') return 'Walmart - Amoldar';
    if (fallbackMarketplace === 'eBay') return 'eBay: Fast Parts n More';
    if (fallbackMarketplace === 'Direct Sales') return 'Direct Sales';
    return `${fallbackMarketplace} Main Store`;
  }

  const trimmed = String(raw).trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct match with registered stores list
  const exactMatch = REGISTERED_STORES.find(s => s.name.toLowerCase() === lower);
  if (exactMatch) return exactMatch.name;

  // 2. Intelligent pattern recognition
  if (lower.includes('ebid-dealz') || lower.includes('ebid dealz') || lower.includes('ebiddealz')) {
    if (lower.includes('fba') || lower.includes('afn') || lower.includes('fulfillment by amazon')) {
      return 'Amazon: ebid-dealz (FBA)';
    }
    return 'Amazon: ebid-dealz';
  }

  if (lower.includes('fast parts')) {
    return 'eBay: Fast Parts n More';
  }

  if (lower.includes('refreshed electronics') || lower.includes('refreshed tech') || lower === 'refreshed') {
    return 'eBay: Refreshed Electronics';
  }

  if (lower.includes('ready2tech') || lower.includes('ready 2 tech')) {
    if (lower.includes('fba') || lower.includes('afn')) {
      return 'Amazon: Ready2Tech (FBA)';
    }
    return 'Amazon: Ready2Tech';
  }

  if (lower.includes('amoldar')) {
    if (lower.includes('amazon')) {
      if (lower.includes('fba') || lower.includes('afn')) {
        return 'Amazon: Amoldar (FBA)';
      }
      return 'Amazon: Amoldar';
    }
    if (lower.includes('fashion') || lower.includes('apparel') || lower.includes('clothing') || fallbackMarketplace.toLowerCase().includes('ebay') || lower.includes('ebay')) {
      return 'eBay: Amoldar Fashions';
    }
    if (lower.includes('wfs') || lower.includes('walmart fulfillment')) {
      return 'Walmart - Amoldar (WFS)';
    }
    return 'Walmart - Amoldar';
  }

  if (lower.includes('newegg')) {
    if (lower.includes('sbn') || lower.includes('shipped by newegg')) {
      return 'NewEgg (SBN)';
    }
    return 'NewEgg';
  }

  if (lower.includes('direct sales') || lower === 'direct' || lower === 'b2c' || lower === 'website') {
    return 'Direct Sales';
  }

  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'n/a') {
    return `${fallbackMarketplace} Main Store`;
  }

  return trimmed;
}

/**
 * Generate a unique signature for duplicate checking
 */
export function createRecordSignature(rec: Partial<SalesRecord>): string {
  const date = rec.date || '';
  const orderId = (rec.orderId || '').trim().toLowerCase();
  const sku = (rec.sku || '').trim().toLowerCase();
  const store = (rec.store || '').trim().toLowerCase();
  const marketplace = (rec.marketplace || '').trim().toLowerCase();
  const product = (rec.product || '').trim().toLowerCase();

  // If orderId is present and unique
  if (orderId && orderId !== '-' && orderId !== 'n/a') {
    return `${date}::${orderId}::${sku || product}::${store}`;
  }

  // Otherwise signature based on date, marketplace, store, sku/product, and units
  return `${date}::${marketplace}::${store}::${sku || product}::${rec.units || 1}::${rec.sales || 0}`;
}

/**
 * Process and normalize raw rows according to column mappings
 */
export function normalizeRows(
  rawRows: Record<string, any>[],
  columnMapping: Record<string, StandardField | 'ignore'>,
  importBatchId: string,
  existingSignatures?: Set<string> | string
): {
  validRecords: SalesRecord[];
  duplicateRecords: SalesRecord[];
  issues: ValidationIssue[];
} {
  const validRecords: SalesRecord[] = [];
  const duplicateRecords: SalesRecord[] = [];
  const issues: ValidationIssue[] = [];
  const currentBatchSignatures = new Set<string>();
  const activeSignatures = existingSignatures instanceof Set ? existingSignatures : new Set<string>();

  // Invert mapping for fast lookup: field -> sourceColumn
  const fieldToSource: Partial<Record<StandardField, string>> = {};
  for (const [col, field] of Object.entries(columnMapping)) {
    if (field && field !== 'ignore') {
      fieldToSource[field] = col;
    }
  }

  rawRows.forEach((row, index) => {
    const rowNum = index + 1;

    // Check if entire row is empty
    const values = Object.values(row).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (values.length === 0) {
      return; // Skip completely empty rows silently
    }

    // Extract mapped values
    const rawDate = fieldToSource.date ? row[fieldToSource.date] : null;
    const cleanDate = parseCleanDate(rawDate) || new Date().toISOString().split('T')[0];

    // Validate date if date column was provided
    if (fieldToSource.date && !parseCleanDate(rawDate)) {
      issues.push({
        rowNumber: rowNum,
        rawRecord: row,
        issueType: 'invalid_date',
        message: `Invalid or unparseable date: "${rawDate}". Defaulted to today.`
      });
    }

    const rawStore = fieldToSource.store ? row[fieldToSource.store] : null;
    const rawMarketplace = fieldToSource.marketplace ? row[fieldToSource.marketplace] : null;
    const store = normalizeStore(rawStore, rawMarketplace ? String(rawMarketplace) : 'Direct Sales');
    const marketplace = normalizeMarketplace(rawMarketplace, store);

    const rawProduct = fieldToSource.product ? row[fieldToSource.product] : null;
    const product = rawProduct ? String(rawProduct).trim() : 'Standard Item';

    const rawSku = fieldToSource.sku ? row[fieldToSource.sku] : null;
    const sku = rawSku ? String(rawSku).trim() : (product ? product.substring(0, 8).toUpperCase().replace(/\s+/g, '-') : 'SKU-001');

    const rawOrderId = fieldToSource.orderId ? row[fieldToSource.orderId] : null;
    const orderId = rawOrderId ? String(rawOrderId).trim() : `ORD-${cleanDate.replace(/-/g, '')}-${rowNum}`;

    const rawUnits = fieldToSource.units ? row[fieldToSource.units] : 1;
    const units = Math.max(1, Math.round(parseCleanNumber(rawUnits, 1)));

    const rawSales = fieldToSource.sales ? row[fieldToSource.sales] : 0;
    const sales = parseCleanNumber(rawSales, 0);

    // Optional fields
    let cost: number | undefined = undefined;
    if (fieldToSource.cost && row[fieldToSource.cost] !== undefined) {
      cost = parseCleanNumber(row[fieldToSource.cost], 0);
    }

    let profit: number | undefined = undefined;
    if (fieldToSource.profit && row[fieldToSource.profit] !== undefined) {
      profit = parseCleanNumber(row[fieldToSource.profit], 0);
    } else if (cost !== undefined && sales > 0) {
      profit = sales - cost;
    }

    let returns: number | undefined = undefined;
    if (fieldToSource.returns && row[fieldToSource.returns] !== undefined) {
      returns = parseCleanNumber(row[fieldToSource.returns], 0);
    }

    let refunds: number | undefined = undefined;
    if (fieldToSource.refunds && row[fieldToSource.refunds] !== undefined) {
      refunds = parseCleanNumber(row[fieldToSource.refunds], 0);
    }

    const category = fieldToSource.category && row[fieldToSource.category] 
      ? String(row[fieldToSource.category]).trim() 
      : undefined;

    const orderStatus = fieldToSource.orderStatus && row[fieldToSource.orderStatus]
      ? String(row[fieldToSource.orderStatus]).trim()
      : 'Completed';

    const paymentStatus = fieldToSource.paymentStatus && row[fieldToSource.paymentStatus]
      ? String(row[fieldToSource.paymentStatus]).trim()
      : 'Paid';

    const channel = fieldToSource.channel && row[fieldToSource.channel]
      ? String(row[fieldToSource.channel]).trim()
      : marketplace;

    // Collect custom unmapped attributes
    const customFields: Record<string, string | number> = {};
    for (const [col, val] of Object.entries(row)) {
      if (!columnMapping[col] || columnMapping[col] === 'ignore') {
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          customFields[col] = typeof val === 'number' ? val : String(val).trim();
        }
      }
    }

    const record: SalesRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${rowNum}`,
      importBatchId,
      orderId,
      date: cleanDate,
      marketplace,
      store,
      product,
      sku,
      category,
      units,
      sales,
      cost,
      profit,
      returns,
      refunds,
      orderStatus,
      paymentStatus,
      channel,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined
    };

    const signature = createRecordSignature(record);

    // Duplicate protection check
    if (activeSignatures.has(signature) || currentBatchSignatures.has(signature)) {
      duplicateRecords.push(record);
      issues.push({
        rowNumber: rowNum,
        rawRecord: row,
        issueType: 'duplicate',
        message: `Possible duplicate record detected for Order "${orderId}" / SKU "${sku}" on ${cleanDate}.`
      });
    } else {
      currentBatchSignatures.add(signature);
      validRecords.push(record);
    }
  });

  return {
    validRecords,
    duplicateRecords,
    issues
  };
}
