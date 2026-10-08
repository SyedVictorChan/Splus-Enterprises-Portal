import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExhausted, markQuotaExhausted } from './firebase';
import { DEFAULT_ORG_ID } from '../constants/org';
import { ProductFamilyGroup, WmsProductRecord } from '../types/productCatalog';
import { parseSkuHierarchy } from './wmsReportParser';
import { AuditLogService } from './auditLogService';

const STORAGE_KEYS = {
  CATALOG: 'splus_wms_product_catalog_v1',
  INITIALIZED: 'splus_wms_catalog_initialized_v1'
};

/**
 * Standard reference sample products matching StockStatusReportTest.xls
 */
export const SEED_WMS_PRODUCTS: WmsProductRecord[] = [
  {
    id: 'prod_77Z32AA_WH-CENTRAL_BIN-A1-04',
    original_sku: '77Z32AA',
    base_sku: '77Z32AA',
    extension: 'Master',
    product_name: 'HP Elite Mini PC Desktop Ultra Compact (Base Chassis)',
    description: 'HP Elite Mini PC Desktop Ultra Compact (Base Chassis)',
    category: 'Computing',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-A1-04',
    available_qty: 100,
    on_hand_qty: 110,
    reserved_qty: 10,
    unit_cost: 450.00,
    supplier: 'HP Inc',
    manufacturer: 'HP Inc',
    status: 'Active',
    raw_wms_data: { 'Part No.': '77Z32AA', 'Available Qty': '100' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_77Z32AA_AA_WH-CENTRAL_BIN-A1-05',
    original_sku: '77Z32AA+AA',
    base_sku: '77Z32AA',
    extension: 'AA',
    product_name: 'HP Elite Mini PC Desktop (16GB RAM / 512GB NVMe SSD)',
    description: 'HP Elite Mini PC Desktop (16GB RAM / 512GB NVMe SSD)',
    category: 'Computing',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-A1-05',
    available_qty: 25,
    on_hand_qty: 25,
    reserved_qty: 0,
    unit_cost: 520.00,
    supplier: 'HP Inc',
    manufacturer: 'HP Inc',
    status: 'Active',
    raw_wms_data: { 'Part No.': '77Z32AA+AA', 'Available Qty': '25' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_77Z32AA_BB_WH-CENTRAL_BIN-A1-06',
    original_sku: '77Z32AA+BB',
    base_sku: '77Z32AA',
    extension: 'BB',
    product_name: 'HP Elite Mini PC Desktop (32GB RAM / 1TB NVMe SSD)',
    description: 'HP Elite Mini PC Desktop (32GB RAM / 1TB NVMe SSD)',
    category: 'Computing',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-A1-06',
    available_qty: 40,
    on_hand_qty: 45,
    reserved_qty: 5,
    unit_cost: 610.00,
    supplier: 'HP Inc',
    manufacturer: 'HP Inc',
    status: 'Active',
    raw_wms_data: { 'Part No.': '77Z32AA+BB', 'Available Qty': '40' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_77Z32AA_CC_WH-WEST_BIN-W2-12',
    original_sku: '77Z32AA+CC',
    base_sku: '77Z32AA',
    extension: 'CC',
    product_name: 'HP Elite Mini PC Desktop (64GB RAM / 2TB NVMe Performance)',
    description: 'HP Elite Mini PC Desktop (64GB RAM / 2TB NVMe Performance)',
    category: 'Computing',
    warehouse: 'WH-WEST',
    location: 'BIN-W2-12',
    available_qty: 15,
    on_hand_qty: 15,
    reserved_qty: 0,
    unit_cost: 780.00,
    supplier: 'HP Inc',
    manufacturer: 'HP Inc',
    status: 'Active',
    raw_wms_data: { 'Part No.': '77Z32AA+CC', 'Available Qty': '15' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_77Z32AA_AA_WH-EAST_BIN-E3-02',
    original_sku: '77Z32AA+AA',
    base_sku: '77Z32AA',
    extension: 'AA',
    product_name: 'HP Elite Mini PC Desktop (16GB RAM / 512GB NVMe SSD)',
    description: 'HP Elite Mini PC Desktop (16GB RAM / 512GB NVMe SSD) - WH-EAST Facility',
    category: 'Computing',
    warehouse: 'WH-EAST',
    location: 'BIN-E3-02',
    available_qty: 10,
    on_hand_qty: 10,
    reserved_qty: 0,
    unit_cost: 520.00,
    supplier: 'HP Inc',
    manufacturer: 'HP Inc',
    status: 'Active',
    raw_wms_data: { 'Part No.': '77Z32AA+AA', 'Warehouse': 'WH-EAST', 'Available Qty': '10' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_48T99BC_WH-CENTRAL_BIN-B2-01',
    original_sku: '48T99BC',
    base_sku: '48T99BC',
    extension: 'Master',
    product_name: 'Dell OptiPlex Micro Form Factor Core i7',
    description: 'Dell OptiPlex Micro Form Factor Core i7',
    category: 'Computing',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-B2-01',
    available_qty: 80,
    on_hand_qty: 80,
    reserved_qty: 0,
    unit_cost: 380.00,
    supplier: 'Dell Technologies',
    manufacturer: 'Dell Technologies',
    status: 'Active',
    raw_wms_data: { 'Part No.': '48T99BC', 'Available Qty': '80' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_48T99BC_PRO_WH-CENTRAL_BIN-B2-02',
    original_sku: '48T99BC+PRO',
    base_sku: '48T99BC',
    extension: 'PRO',
    product_name: 'Dell OptiPlex Micro Form Factor Pro Dual Display Bundle',
    description: 'Dell OptiPlex Micro Form Factor Pro Dual Display Bundle',
    category: 'Computing',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-B2-02',
    available_qty: 30,
    on_hand_qty: 35,
    reserved_qty: 5,
    unit_cost: 490.00,
    supplier: 'Dell Technologies',
    manufacturer: 'Dell Technologies',
    status: 'Active',
    raw_wms_data: { 'Part No.': '48T99BC+PRO', 'Available Qty': '30' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_99K14LM_POE_WH-EAST_BIN-N1-08',
    original_sku: '99K14LM+POE',
    base_sku: '99K14LM',
    extension: 'POE',
    product_name: 'Cisco Catalyst Gigabit Managed Switch PoE+ 24-Port',
    description: 'Cisco Catalyst Gigabit Managed Switch PoE+ 24-Port',
    category: 'Networking',
    warehouse: 'WH-EAST',
    location: 'BIN-N1-08',
    available_qty: 45,
    on_hand_qty: 50,
    reserved_qty: 5,
    unit_cost: 850.00,
    supplier: 'Cisco Systems',
    manufacturer: 'Cisco Systems',
    status: 'Active',
    raw_wms_data: { 'Part No.': '99K14LM+POE', 'Available Qty': '45' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_99K14LM_SFP_WH-CENTRAL_BIN-N2-03',
    original_sku: '99K14LM+SFP',
    base_sku: '99K14LM',
    extension: 'SFP',
    product_name: 'Cisco Catalyst Gigabit Managed Switch 10G SFP+ Dual Uplink',
    description: 'Cisco Catalyst Gigabit Managed Switch 10G SFP+ Dual Uplink',
    category: 'Networking',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-N2-03',
    available_qty: 20,
    on_hand_qty: 20,
    reserved_qty: 0,
    unit_cost: 990.00,
    supplier: 'Cisco Systems',
    manufacturer: 'Cisco Systems',
    status: 'Active',
    raw_wms_data: { 'Part No.': '99K14LM+SFP', 'Available Qty': '20' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_62M44RT_WH-CENTRAL_BIN-P1-09',
    original_sku: '62M44RT',
    base_sku: '62M44RT',
    extension: 'Master',
    product_name: 'Logitech MX Master 3S Wireless Performance Mouse (Graphite)',
    description: 'Logitech MX Master 3S Wireless Performance Mouse (Graphite)',
    category: 'Peripherals',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-P1-09',
    available_qty: 150,
    on_hand_qty: 160,
    reserved_qty: 10,
    unit_cost: 75.00,
    supplier: 'Logitech',
    manufacturer: 'Logitech',
    status: 'Active',
    raw_wms_data: { 'Part No.': '62M44RT', 'Available Qty': '150' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_62M44RT_GRY_WH-WEST_BIN-P2-15',
    original_sku: '62M44RT+GRY',
    base_sku: '62M44RT',
    extension: 'GRY',
    product_name: 'Logitech MX Master 3S Wireless Performance Mouse (Space Grey)',
    description: 'Logitech MX Master 3S Wireless Performance Mouse (Space Grey)',
    category: 'Peripherals',
    warehouse: 'WH-WEST',
    location: 'BIN-P2-15',
    available_qty: 60,
    on_hand_qty: 60,
    reserved_qty: 0,
    unit_cost: 78.00,
    supplier: 'Logitech',
    manufacturer: 'Logitech',
    status: 'Active',
    raw_wms_data: { 'Part No.': '62M44RT+GRY', 'Available Qty': '60' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  },
  {
    id: 'prod_62M44RT_WHT_WH-CENTRAL_BIN-P1-10',
    original_sku: '62M44RT+WHT',
    base_sku: '62M44RT',
    extension: 'WHT',
    product_name: 'Logitech MX Master 3S Wireless Performance Mouse (Pale Grey)',
    description: 'Logitech MX Master 3S Wireless Performance Mouse (Pale Grey)',
    category: 'Peripherals',
    warehouse: 'WH-CENTRAL',
    location: 'BIN-P1-10',
    available_qty: 40,
    on_hand_qty: 40,
    reserved_qty: 0,
    unit_cost: 78.00,
    supplier: 'Logitech',
    manufacturer: 'Logitech',
    status: 'Active',
    raw_wms_data: { 'Part No.': '62M44RT+WHT', 'Available Qty': '40' },
    importBatchId: 'seed_stock_report_ref',
    importedAt: '2026-09-24T09:15:00.000Z'
  }
];

export class ProductCatalogService {
  /**
   * Group flat product records into base SKU families
   */
  static groupIntoFamilies(records: WmsProductRecord[]): ProductFamilyGroup[] {
    const familyMap = new Map<string, ProductFamilyGroup>();

    for (const record of records) {
      const baseSku = record.base_sku || record.original_sku;
      let family = familyMap.get(baseSku);

      if (!family) {
        family = {
          base_sku: baseSku,
          product_name: record.product_name,
          category: record.category || 'General',
          total_available_qty: 0,
          total_on_hand_qty: 0,
          total_reserved_qty: 0,
          variants: [],
          warehouses: [],
          hasMaster: false
        };
        familyMap.set(baseSku, family);
      }

      // Sum quantities accurately
      family.total_available_qty += (record.available_qty || 0);
      family.total_on_hand_qty += (record.on_hand_qty || record.available_qty || 0);
      family.total_reserved_qty += (record.reserved_qty || 0);

      // Add variant
      family.variants.push(record);

      // Distinct warehouses
      if (record.warehouse && !family.warehouses.includes(record.warehouse)) {
        family.warehouses.push(record.warehouse);
      }

      // Check if this record is master (exact base_sku without extension)
      if (record.original_sku === baseSku || record.extension === 'Master') {
        family.hasMaster = true;
        family.masterRecord = record;
        // Prioritize master product name
        if (record.product_name) {
          family.product_name = record.product_name;
        }
      }
    }

    return Array.from(familyMap.values());
  }

  /**
   * Initialize catalog with reference WMS sample if empty
   */
  static initializeIfEmpty(): void {
    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        const existing = localStorage.getItem(STORAGE_KEYS.CATALOG);
        if (!existing || JSON.parse(existing).length === 0) {
          localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(SEED_WMS_PRODUCTS));
          localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
        }
      }
    } catch (err) {
      console.warn('Error checking WMS catalog initial state:', err);
    }
  }

  /**
   * Get all product records from local cache + Firestore
   */
  static async getProducts(): Promise<WmsProductRecord[]> {
    this.initializeIfEmpty();

    let localProducts: WmsProductRecord[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CATALOG);
      if (raw) {
        localProducts = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Error reading local product catalog:', err);
    }

    // Try fetching from Firestore if online and quota allows
    if (!isQuotaExhausted()) {
      try {
        const colRef = collection(db, 'organizations', DEFAULT_ORG_ID, 'product_catalog');
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          const cloudProducts: WmsProductRecord[] = [];
          snapshot.forEach(docSnap => {
            cloudProducts.push(docSnap.data() as WmsProductRecord);
          });
          // Cache locally
          localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(cloudProducts));
          return cloudProducts;
        }
      } catch (err: any) {
        if (err?.code === 'resource-exhausted') {
          markQuotaExhausted();
        }
        // Fallback to local
      }
    }

    return localProducts.length > 0 ? localProducts : SEED_WMS_PRODUCTS;
  }

  /**
   * Get all product families
   */
  static async getProductFamilies(): Promise<ProductFamilyGroup[]> {
    const products = await this.getProducts();
    return this.groupIntoFamilies(products);
  }

  /**
   * Search base parts or SKUs
   * When user searches '77Z32AA', it returns all related SKUs in that family:
   * 77Z32AA, 77Z32AA+AA, 77Z32AA+BB, 77Z32AA+CC
   */
  static async searchProductFamilies(query: string): Promise<ProductFamilyGroup[]> {
    const families = await this.getProductFamilies();
    const cleanQ = (query || '').toLowerCase().trim();
    if (!cleanQ) return families;

    return families.filter(family => {
      // 1. Matches base SKU
      if (family.base_sku.toLowerCase().includes(cleanQ)) return true;
      // 2. Matches product name or category
      if (family.product_name.toLowerCase().includes(cleanQ)) return true;
      if (family.category.toLowerCase().includes(cleanQ)) return true;
      // 3. Matches any variant's exact SKU or extension
      return family.variants.some(v =>
        v.original_sku.toLowerCase().includes(cleanQ) ||
        v.extension.toLowerCase().includes(cleanQ) ||
        (v.warehouse && v.warehouse.toLowerCase().includes(cleanQ)) ||
        (v.location && v.location.toLowerCase().includes(cleanQ))
      );
    });
  }

  /**
   * Find single family by exact base SKU
   */
  static async findFamilyByBaseSku(baseSku: string): Promise<ProductFamilyGroup | null> {
    const cleanBase = (baseSku || '').trim().toLowerCase();
    const families = await this.getProductFamilies();
    return families.find(f => f.base_sku.toLowerCase() === cleanBase) || null;
  }

  /**
   * Save imported product records (merge or overwrite)
   */
  static async saveImportedProducts(
    newProducts: WmsProductRecord[],
    replaceExisting: boolean = false
  ): Promise<void> {
    let current = await this.getProducts();

    let combined: WmsProductRecord[];
    if (replaceExisting) {
      combined = [...newProducts];
    } else {
      // Merge by unique id / key (original_sku + warehouse + location)
      const map = new Map<string, WmsProductRecord>();
      current.forEach(p => {
        const key = `${p.original_sku}:::${p.warehouse || ''}:::${p.location || ''}`.toLowerCase();
        map.set(key, p);
      });
      newProducts.forEach(p => {
        const key = `${p.original_sku}:::${p.warehouse || ''}:::${p.location || ''}`.toLowerCase();
        map.set(key, p);
      });
      combined = Array.from(map.values());
    }

    // Save to localStorage immediately
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(combined));

    AuditLogService.recordLog({
      action: 'WMS_IMPORT',
      module: 'Product Catalog',
      targetId: `${newProducts.length} items`,
      targetType: 'WMSReport',
      description: `Imported ${newProducts.length} WMS product records (${replaceExisting ? 'Full Catalog Replacement' : 'Incremental Stock Merge'}).`,
      newValue: {
        recordsCount: newProducts.length,
        totalCatalogItems: combined.length,
        mode: replaceExisting ? 'replace' : 'merge'
      }
    }).catch(() => {});

    // Sync to Firestore in chunks if quota allows
    if (!isQuotaExhausted()) {
      try {
        const colRef = collection(db, 'organizations', DEFAULT_ORG_ID, 'product_catalog');
        for (const prod of newProducts) {
          const docRef = doc(colRef, prod.id);
          await setDoc(docRef, prod, { merge: true });
        }
      } catch (err: any) {
        if (err?.code === 'resource-exhausted') {
          markQuotaExhausted();
        }
        console.warn('WMS Catalog Firestore sync postponed, preserved locally:', err);
      }
    }
  }

  /**
   * Reset catalog to the reference StockStatusReportTest.xls dataset
   */
  static async resetToReferenceSample(): Promise<WmsProductRecord[]> {
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(SEED_WMS_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');

    if (!isQuotaExhausted()) {
      try {
        const colRef = collection(db, 'organizations', DEFAULT_ORG_ID, 'product_catalog');
        for (const prod of SEED_WMS_PRODUCTS) {
          const docRef = doc(colRef, prod.id);
          await setDoc(docRef, prod);
        }
      } catch (err) {
        // quota ignore
      }
    }

    return SEED_WMS_PRODUCTS;
  }

  /**
   * Real-time subscription to product catalog
   */
  static subscribeToCatalog(callback: (products: WmsProductRecord[]) => void): () => void {
    this.initializeIfEmpty();

    // Initial local dispatch
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CATALOG);
      if (raw) {
        callback(JSON.parse(raw));
      }
    } catch (err) {
      // ignore
    }

    if (isQuotaExhausted()) {
      return () => {};
    }

    try {
      const colRef = collection(db, 'organizations', DEFAULT_ORG_ID, 'product_catalog');
      const unsubscribe = onSnapshot(colRef, snapshot => {
        if (!snapshot.empty) {
          const prods: WmsProductRecord[] = [];
          snapshot.forEach(docSnap => prods.push(docSnap.data() as WmsProductRecord));
          localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(prods));
          callback(prods);
        }
      }, err => {
        if (err?.code === 'resource-exhausted') {
          markQuotaExhausted();
        }
      });
      return unsubscribe;
    } catch {
      return () => {};
    }
  }

  /**
   * Quick search catalog for Purchasing PO line items
   */
  static async searchCatalogForPO(query: string): Promise<Array<{
    sku: string;
    productName: string;
    base_sku: string;
    extension: string;
    available_qty: number;
    unit_cost: number;
    warehouse: string;
    supplier: string;
  }>> {
    const products = await this.getProducts();
    const cleanQ = (query || '').toLowerCase().trim();

    return products
      .filter(p => {
        if (!cleanQ) return true;
        return (
          p.original_sku.toLowerCase().includes(cleanQ) ||
          p.base_sku.toLowerCase().includes(cleanQ) ||
          p.product_name.toLowerCase().includes(cleanQ) ||
          (p.supplier && p.supplier.toLowerCase().includes(cleanQ))
        );
      })
      .map(p => ({
        sku: p.original_sku,
        productName: p.product_name,
        base_sku: p.base_sku,
        extension: p.extension,
        available_qty: p.available_qty,
        unit_cost: p.unit_cost || 0,
        warehouse: p.warehouse || 'WH-MAIN',
        supplier: p.supplier || 'Standard Supplier'
      }))
      .slice(0, 15);
  }

  /**
   * Quick search catalog for RMA items
   */
  static async searchCatalogForRMA(query: string): Promise<Array<{
    sku: string;
    productName: string;
    base_sku: string;
    extension: string;
    warehouse: string;
  }>> {
    const products = await this.getProducts();
    const cleanQ = (query || '').toLowerCase().trim();

    return products
      .filter(p => {
        if (!cleanQ) return true;
        return (
          p.original_sku.toLowerCase().includes(cleanQ) ||
          p.base_sku.toLowerCase().includes(cleanQ) ||
          p.product_name.toLowerCase().includes(cleanQ)
        );
      })
      .map(p => ({
        sku: p.original_sku,
        productName: p.product_name,
        base_sku: p.base_sku,
        extension: p.extension,
        warehouse: p.warehouse || 'WH-MAIN'
      }))
      .slice(0, 15);
  }
}
