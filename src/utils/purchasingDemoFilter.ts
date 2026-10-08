/**
 * Detection engine to identify and purge any residual demo or mock records in Purchasing.
 * Ensures strict isolation: genuine records from live Google Sheets and real user creations
 * are NEVER affected.
 */

export function isDemoPO(id?: string, data?: any): boolean {
  if (!id && !data) return false;
  const cleanId = String(id || data?.id || '').toLowerCase().trim();

  // Explicit demo/mock flags
  if (data?.isDemo === true || data?.isSeed === true) return true;
  if (cleanId.startsWith('po-seed') || cleanId.includes('seed')) return true;

  // Specific historical mock PO IDs from initial demo seed data
  const demoPoIds = ['po-2026-001', 'po-2026-002', 'po-2026-003', 'po-2026-004', 'po-2026-005'];
  if (demoPoIds.includes(cleanId)) return true;

  // Specific historical mock PO numbers from initial demo seed data
  const demoPoNumbers = ['PO-2026-0001', 'PO-2026-0002', 'PO-2026-0003', 'PO-2026-0004', 'PO-2026-0005'];
  const poNum = String(data?.poNumber || '').trim();
  if (poNum && demoPoNumbers.includes(poNum)) return true;

  return false;
}

export function isDemoSupplier(id?: string, data?: any): boolean {
  if (!id && !data) return false;
  const cleanId = String(id || data?.id || '').toLowerCase().trim();

  if (data?.isDemo === true || data?.isSeed === true) return true;
  if (cleanId.startsWith('sup-seed') || cleanId.includes('seed')) return true;

  // Specific historical mock supplier IDs
  const demoSupIds = ['sup-001', 'sup-002', 'sup-003', 'sup-004', 'sup-005'];
  if (demoSupIds.includes(cleanId)) return true;

  // Specific historical mock supplier codes
  const demoSupCodes = ['SUP-001', 'SUP-002', 'SUP-003', 'SUP-004', 'SUP-005'];
  const supCode = String(data?.code || '').trim().toUpperCase();
  if (supCode && demoSupCodes.includes(supCode)) return true;

  // Specific historical mock supplier company names
  const demoSupNames = [
    'TechSource Global Supplies',
    'Apex Audio & Dynamics',
    'Amoldar Apparel & Textiles',
    'Precision Parts & Hardware Corp',
    'Silicon Micro Logistics'
  ].map(s => s.toLowerCase());

  const supName = String(data?.name || '').trim().toLowerCase();
  if (supName && demoSupNames.includes(supName)) return true;

  return false;
}

export function isDemoReceipt(id?: string, data?: any): boolean {
  if (!id && !data) return false;
  const cleanId = String(id || data?.id || '').toLowerCase().trim();

  if (data?.isDemo === true || data?.isSeed === true) return true;
  if (cleanId.startsWith('rec-seed') || cleanId.includes('seed')) return true;

  // Specific historical mock receipt IDs
  const demoRecIds = ['rec-001', 'rec-002'];
  if (demoRecIds.includes(cleanId)) return true;

  // Associated with mock PO IDs
  const demoPoIds = ['po-2026-001', 'po-2026-002', 'po-2026-003', 'po-2026-004', 'po-2026-005'];
  const poId = String(data?.poId || '').toLowerCase().trim();
  if (poId && demoPoIds.includes(poId)) return true;

  const demoPoNumbers = ['PO-2026-0001', 'PO-2026-0002', 'PO-2026-0003', 'PO-2026-0004', 'PO-2026-0005'];
  const poNum = String(data?.poNumber || '').trim();
  if (poNum && demoPoNumbers.includes(poNum)) return true;

  return false;
}

export function isDemoPayment(id?: string, data?: any): boolean {
  if (!id && !data) return false;
  const cleanId = String(id || data?.id || '').toLowerCase().trim();

  if (data?.isDemo === true || data?.isSeed === true) return true;
  if (cleanId.startsWith('pay-seed') || cleanId.includes('seed')) return true;

  // Specific historical mock payment IDs
  const demoPayIds = ['pay-001', 'pay-002', 'pay-003'];
  if (demoPayIds.includes(cleanId)) return true;

  // Associated with mock PO IDs
  const demoPoIds = ['po-2026-001', 'po-2026-002', 'po-2026-003', 'po-2026-004', 'po-2026-005'];
  const poId = String(data?.poId || '').toLowerCase().trim();
  if (poId && demoPoIds.includes(poId)) return true;

  const demoPoNumbers = ['PO-2026-0001', 'PO-2026-0002', 'PO-2026-0003', 'PO-2026-0004', 'PO-2026-0005'];
  const poNum = String(data?.poNumber || '').trim();
  if (poNum && demoPoNumbers.includes(poNum)) return true;

  return false;
}
