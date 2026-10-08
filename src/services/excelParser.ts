import * as XLSX from 'xlsx';
import { ColumnMappingDefinition, ParsedSheetData, StandardField } from '../types';

export const STANDARD_FIELDS: ColumnMappingDefinition[] = [
  {
    field: 'date',
    label: 'Date',
    required: true,
    type: 'date',
    aliases: ['date', 'sale date', 'order date', 'transaction date', 'sold on', 'day', 'reporting date', 'order_date', 'sales_date']
  },
  {
    field: 'orderId',
    label: 'Order ID',
    required: false,
    type: 'string',
    aliases: ['order id', 'order no', 'order number', 'order #', 'invoice', 'invoice no', 'reference', 'order_id', 'order_no']
  },
  {
    field: 'marketplace',
    label: 'Marketplace',
    required: false,
    type: 'string',
    aliases: ['marketplace', 'platform', 'market', 'portal', 'channel', 'source', 'ecommerce']
  },
  {
    field: 'store',
    label: 'Store Name',
    required: false,
    type: 'string',
    aliases: ['store', 'store name', 'shop', 'shop name', 'account', 'seller', 'seller name', 'merchant', 'store_name']
  },
  {
    field: 'product',
    label: 'Product Name',
    required: false,
    type: 'string',
    aliases: ['product', 'product name', 'item', 'item name', 'title', 'product title', 'item title', 'description', 'product_name']
  },
  {
    field: 'sku',
    label: 'SKU / Item Code',
    required: false,
    type: 'string',
    aliases: ['sku', 'item code', 'product code', 'barcode', 'asin', 'sku code', 'product id', 'model']
  },
  {
    field: 'units',
    label: 'Units / Qty',
    required: true,
    type: 'number',
    aliases: ['units', 'qty', 'quantity', 'quantity sold', 'units sold', 'pcs', 'count', 'items', 'volume', 'qty sold']
  },
  {
    field: 'sales',
    label: 'Sales / Revenue',
    required: true,
    type: 'number',
    aliases: ['sales', 'revenue', 'sales amount', 'total sales', 'amount', 'gross sales', 'total amount', 'net sales', 'price total', 'turnover']
  },
  {
    field: 'cost',
    label: 'Product Cost (COGS)',
    required: false,
    type: 'number',
    aliases: ['cost', 'product cost', 'cogs', 'item cost', 'purchase cost', 'total cost', 'unit cost', 'buying price']
  },
  {
    field: 'profit',
    label: 'Profit',
    required: false,
    type: 'number',
    aliases: ['profit', 'net profit', 'gross profit', 'margin', 'margin amount', 'earnings', 'income']
  },
  {
    field: 'returns',
    label: 'Returns (Units)',
    required: false,
    type: 'number',
    aliases: ['returns', 'return qty', 'returned units', 'returned', 'return count', 'return items']
  },
  {
    field: 'refunds',
    label: 'Refunds (Amount)',
    required: false,
    type: 'number',
    aliases: ['refunds', 'refund amount', 'refund value', 'returned amount', 'refunded']
  },
  {
    field: 'category',
    label: 'Category',
    required: false,
    type: 'string',
    aliases: ['category', 'product category', 'dept', 'department', 'sub category', 'type']
  },
  {
    field: 'orderStatus',
    label: 'Order Status',
    required: false,
    type: 'string',
    aliases: ['order status', 'status', 'fulfillment status', 'delivery status']
  },
  {
    field: 'paymentStatus',
    label: 'Payment Status',
    required: false,
    type: 'string',
    aliases: ['payment status', 'payment', 'paid status', 'payment method']
  },
  {
    field: 'channel',
    label: 'Sales Channel',
    required: false,
    type: 'string',
    aliases: ['channel', 'sales channel', 'channel type']
  }
];

export interface WorkbookSummary {
  fileName: string;
  sheetNames: string[];
  sheetsData: Record<string, ParsedSheetData>;
}

/**
 * Parse an uploaded File object (XLSX, XLS, CSV)
 */
export async function parseSpreadsheetFile(file: File): Promise<WorkbookSummary> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false
  });

  const sheetNames = workbook.SheetNames;
  const sheetsData: Record<string, ParsedSheetData> = {};

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert to array of objects with raw headers
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false
    });

    // Extract headers
    let headers: string[] = [];
    if (rawRows.length > 0) {
      headers = Object.keys(rawRows[0]);
    } else {
      // Try to read header row directly if empty data
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
        if (cell && cell.v) headers.push(String(cell.v).trim());
      }
    }

    // Filter out completely blank headers or internal keys
    headers = headers.filter(h => h && !h.startsWith('__EMPTY'));

    sheetsData[sheetName] = {
      sheetName,
      headers,
      sampleRows: rawRows.slice(0, 5),
      totalRows: rawRows.length,
      rawRows
    };
  }

  return {
    fileName: file.name,
    sheetNames,
    sheetsData
  };
}

/**
 * Auto-suggest field mappings by fuzzy matching column headers against aliases
 */
export function autoMapHeaders(headers: string[]): Record<string, StandardField | 'ignore'> {
  const mapping: Record<string, StandardField | 'ignore'> = {};
  const mappedFields = new Set<StandardField>();

  for (const header of headers) {
    const cleanHeader = header.toLowerCase().replace(/[_\W]+/g, ' ').trim();
    let matchedField: StandardField | null = null;
    let bestScore = 0;

    for (const def of STANDARD_FIELDS) {
      if (mappedFields.has(def.field)) continue;

      for (const alias of def.aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[_\W]+/g, ' ').trim();
        if (cleanHeader === cleanAlias) {
          matchedField = def.field;
          bestScore = 100;
          break;
        } else if (cleanHeader.includes(cleanAlias) || cleanAlias.includes(cleanHeader)) {
          if (bestScore < 70) {
            matchedField = def.field;
            bestScore = 70;
          }
        }
      }
      if (bestScore === 100) break;
    }

    if (matchedField && bestScore >= 70) {
      mapping[header] = matchedField;
      mappedFields.add(matchedField);
    } else {
      mapping[header] = 'ignore';
    }
  }

  return mapping;
}

/**
 * Export data array to an Excel (.xlsx) file download
 */
export function exportToExcel(data: any[], fileName: string = 'export.xlsx', sheetTitle: string = 'Data') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
  XLSX.writeFile(workbook, fileName);
}

/**
 * Export data array to a CSV file download
 */
export function exportToCSV(data: any[], fileName: string = 'export.csv') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
