import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Building2,
  Boxes,
  Layers,
  ChevronDown,
  ChevronRight,
  Upload,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Tag,
  MapPin,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  FolderGit2
} from 'lucide-react';
import { ProductFamilyGroup, WmsProductRecord } from '../../types/productCatalog';
import { ProductCatalogService, SEED_WMS_PRODUCTS } from '../../services/productCatalogService';
import { WmsImportModal } from './WmsImportModal';
import { exportToCSV, exportToExcel } from '../../services/excelParser';

interface ProductCatalogViewProps {
  onSelectProductForModule?: (product: WmsProductRecord, module: 'purchasing' | 'rma') => void;
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({
  onSelectProductForModule
}) => {
  const [products, setProducts] = useState<WmsProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [inspectRecord, setInspectRecord] = useState<WmsProductRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load products
  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await ProductCatalogService.getProducts();
      setProducts(data);
      // Auto-expand first 5 families
      const families = ProductCatalogService.groupIntoFamilies(data);
      const initialExpanded: Record<string, boolean> = {};
      families.slice(0, 5).forEach(f => {
        initialExpanded[f.base_sku] = true;
      });
      setExpandedFamilies(initialExpanded);
    } catch (err) {
      console.error('Failed to load WMS product catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    const unsubscribe = ProductCatalogService.subscribeToCatalog(newProds => {
      setProducts(newProds);
    });
    return () => unsubscribe();
  }, []);

  // Compute all families
  const allFamilies = useMemo(() => {
    return ProductCatalogService.groupIntoFamilies(products);
  }, [products]);

  // Distinct warehouses and categories
  const warehouses = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.warehouse) set.add(p.warehouse);
    });
    return Array.from(set).sort();
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Overall catalog metrics
  const metrics = useMemo(() => {
    const totalVariants = products.length;
    const totalFamilies = allFamilies.length;
    const totalAvailable = products.reduce((acc, p) => acc + (p.available_qty || 0), 0);
    const totalOnHand = products.reduce((acc, p) => acc + (p.on_hand_qty || p.available_qty || 0), 0);
    const totalReserved = products.reduce((acc, p) => acc + (p.reserved_qty || 0), 0);
    const totalAssetValue = products.reduce((acc, p) => acc + ((p.available_qty || 0) * (p.unit_cost || 0)), 0);

    return {
      totalVariants,
      totalFamilies,
      totalAvailable,
      totalOnHand,
      totalReserved,
      totalAssetValue
    };
  }, [products, allFamilies]);

  // Filtered families based on Base Part Search, Warehouse, Category, and Stock Status
  const filteredFamilies = useMemo(() => {
    const cleanQ = searchQuery.toLowerCase().trim();

    return allFamilies.filter(family => {
      // 1. Warehouse filter
      if (selectedWarehouse !== 'all') {
        const matchesWarehouse = family.variants.some(v => v.warehouse === selectedWarehouse);
        if (!matchesWarehouse) return false;
      }

      // 2. Category filter
      if (selectedCategory !== 'all' && family.category !== selectedCategory) {
        return false;
      }

      // 3. Stock filter
      if (stockFilter === 'in_stock' && family.total_available_qty <= 0) return false;
      if (stockFilter === 'low_stock' && (family.total_available_qty <= 0 || family.total_available_qty > 25)) return false;
      if (stockFilter === 'out_of_stock' && family.total_available_qty > 0) return false;

      // 4. Base Part Search requirement:
      // When user searches 77Z32AA, it finds the family and all its variants (77Z32AA, +AA, +BB, +CC)
      if (cleanQ) {
        const matchesBase = family.base_sku.toLowerCase().includes(cleanQ);
        const matchesName = family.product_name.toLowerCase().includes(cleanQ);
        const matchesCategory = family.category.toLowerCase().includes(cleanQ);
        const matchesAnyVariant = family.variants.some(v =>
          v.original_sku.toLowerCase().includes(cleanQ) ||
          v.extension.toLowerCase().includes(cleanQ) ||
          (v.warehouse && v.warehouse.toLowerCase().includes(cleanQ)) ||
          (v.location && v.location.toLowerCase().includes(cleanQ))
        );
        if (!matchesBase && !matchesName && !matchesCategory && !matchesAnyVariant) {
          return false;
        }
      }

      return true;
    });
  }, [allFamilies, searchQuery, selectedWarehouse, selectedCategory, stockFilter]);

  const toggleExpand = (baseSku: string) => {
    setExpandedFamilies(prev => ({
      ...prev,
      [baseSku]: !prev[baseSku]
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredFamilies.forEach(f => {
      next[f.base_sku] = true;
    });
    setExpandedFamilies(next);
  };

  const collapseAll = () => {
    setExpandedFamilies({});
  };

  const handleResetToSample = async () => {
    setLoading(true);
    try {
      const resetProds = await ProductCatalogService.resetToReferenceSample();
      setProducts(resetProds);
      showToast('Catalog reset to reference StockStatusReportTest.xls dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type: 'csv' | 'xlsx') => {
    const exportData = products.map(p => ({
      'Part No. (original_sku)': p.original_sku,
      'Base Part': p.base_sku,
      'Extension': p.extension,
      'Product Description': p.product_name,
      'Category': p.category,
      'Warehouse': p.warehouse,
      'Location / Bin': p.location,
      'Available Qty': p.available_qty,
      'On Hand Qty': p.on_hand_qty,
      'Reserved Qty': p.reserved_qty,
      'Unit Cost': p.unit_cost !== undefined ? p.unit_cost : '',
      'Supplier': p.supplier || '',
      'Status': p.status || 'Active'
    }));

    if (type === 'csv') {
      exportToCSV(exportData, `Splus_Product_Catalog_${Date.now()}.csv`);
    } else {
      exportToExcel(exportData, `Splus_Product_Catalog_${Date.now()}.xlsx`, 'ProductCatalog');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Central Master Database
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              WMS Synchronized
            </span>
          </div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            Central Product Catalog
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Unified master catalog with intelligent Base Part SKU hierarchy (e.g. 77Z32AA → +AA, +BB, +CC), multi-location stock tracking, and universal WMS report ingestion. Referenced directly by Purchasing, RMA, and Sales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all hover:shadow-lg"
          >
            <Upload size={14} />
            Import WMS Stock Report (.xls)
          </button>
          <button
            onClick={handleResetToSample}
            title="Reload the reference StockStatusReportTest.xls dataset"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Reset Reference Sample
          </button>
          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            <button
              onClick={() => handleExport('xlsx')}
              className="px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold border-r border-zinc-200 dark:border-zinc-700"
              title="Export as Excel .xlsx"
            >
              <Download size={13} className="inline mr-1" />
              XLSX
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold"
              title="Export as CSV"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Base Families</span>
            <FolderGit2 size={15} className="text-blue-500" />
          </div>
          <div className="text-xl font-black text-zinc-900 dark:text-white">
            {metrics.totalFamilies}
          </div>
          <span className="text-[10px] text-zinc-500">Master product groups</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">SKU Variants</span>
            <Layers size={15} className="text-purple-500" />
          </div>
          <div className="text-xl font-black text-zinc-900 dark:text-white">
            {metrics.totalVariants}
          </div>
          <span className="text-[10px] text-zinc-500">Individual location SKUs</span>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Available Qty</span>
            <Boxes size={15} />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {metrics.totalAvailable.toLocaleString()}
          </div>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-300">Ready for allocation</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Total On-Hand</span>
            <Package size={15} className="text-zinc-600 dark:text-zinc-300" />
          </div>
          <div className="text-xl font-black text-zinc-800 dark:text-zinc-200 font-mono">
            {metrics.totalOnHand.toLocaleString()}
          </div>
          <span className="text-[10px] text-zinc-500">{metrics.totalReserved} reserved</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Inventory Value</span>
            <Tag size={15} className="text-emerald-500" />
          </div>
          <div className="text-xl font-black text-zinc-900 dark:text-white font-mono">
            ${metrics.totalAssetValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <span className="text-[10px] text-zinc-500">Total WMS asset cost</span>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Active Facilities</span>
            <Building2 size={15} className="text-amber-500" />
          </div>
          <div className="text-xl font-black text-zinc-900 dark:text-white font-mono">
            {warehouses.length}
          </div>
          <span className="text-[10px] text-zinc-500">{warehouses.join(', ')}</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Base Part & SKU Search input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Base Part No. (e.g. 77Z32AA) or variant (+AA, +BB) to view related product family..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Warehouse Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Warehouses ({warehouses.length})</option>
              {warehouses.map(w => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Stock status filter */}
            <select
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock (&gt; 0)</option>
              <option value="low_stock">Low Stock (≤ 25)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>
        </div>

        {/* Quick Search Chips & Expand/Collapse */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400">Quick Base Part Lookups:</span>
            {['77Z32AA', '48T99BC', '99K14LM', '62M44RT'].map(sku => (
              <button
                key={sku}
                onClick={() => setSearchQuery(sku)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-colors ${
                  searchQuery.trim().toLowerCase() === sku.toLowerCase()
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {sku}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">
              Showing {filteredFamilies.length} of {allFamilies.length} families
            </span>
            <button
              onClick={expandAll}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Expand All
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <button
              onClick={collapseAll}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* PRODUCT FAMILIES LIST */}
      <div className="space-y-4">
        {filteredFamilies.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <Package size={40} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-1">
              No matching product families found
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
              Try adjusting your search query, clearing filters, or importing a WMS Stock Status Report.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedWarehouse('all');
                setSelectedCategory('all');
                setStockFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          filteredFamilies.map(family => {
            const isExpanded = Boolean(expandedFamilies[family.base_sku]);
            return (
              <div
                key={family.base_sku}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                {/* Family Header */}
                <div
                  onClick={() => toggleExpand(family.base_sku)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-zinc-50/50 dark:bg-zinc-850/50 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 mt-0.5 sm:mt-0"
                      onClick={e => {
                        e.stopPropagation();
                        toggleExpand(family.base_sku);
                      }}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          BASE PART: {family.base_sku}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {family.category}
                        </span>
                        {!family.hasMaster && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            Variants Only (No Master in WMS)
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                        {family.product_name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3 mt-1">
                        <span>{family.variants.length} inventory location record(s)</span>
                        <span>•</span>
                        <span>Facilities: {family.warehouses.join(', ') || 'WH-MAIN'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right side family summary */}
                  <div className="flex items-center gap-6 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                        Base Part Total Available
                      </span>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {family.total_available_qty.toLocaleString()} Units
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        On Hand: {family.total_on_hand_qty} | Reserved: {family.total_reserved_qty}
                      </span>
                    </div>

                    <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

                    <div className="text-right hidden lg:block">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                        Family Asset Value
                      </span>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                        ${family.variants.reduce((sum, v) => sum + (v.available_qty * (v.unit_cost || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Variants Table */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 overflow-x-auto bg-white dark:bg-zinc-900">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-100/70 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="p-3 pl-6">Part No. (original_sku)</th>
                          <th className="p-3">Extension</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Warehouse</th>
                          <th className="p-3">Location / Bin</th>
                          <th className="p-3 text-right">Available Qty</th>
                          <th className="p-3 text-right">On Hand</th>
                          <th className="p-3 text-right">Reserved</th>
                          <th className="p-3 text-right">Unit Cost</th>
                          <th className="p-3">Supplier</th>
                          <th className="p-3 text-center pr-6">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {family.variants.map((variant, vIdx) => {
                          const isMasterRow = variant.original_sku === family.base_sku || variant.extension === 'Master';
                          return (
                            <tr
                              key={variant.id || vIdx}
                              className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                                isMasterRow ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                              }`}
                            >
                              <td className="p-3 pl-6 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                {variant.original_sku}
                                {isMasterRow && (
                                  <span className="ml-2 text-[9px] uppercase px-1.5 py-0.2 rounded font-sans font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                    Master
                                  </span>
                                )}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                                    isMasterRow
                                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                      : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                                  }`}
                                >
                                  {variant.extension}
                                </span>
                              </td>
                              <td className="p-3 text-zinc-700 dark:text-zinc-300 max-w-xs truncate" title={variant.product_name}>
                                {variant.product_name}
                              </td>
                              <td className="p-3 whitespace-nowrap font-mono text-zinc-600 dark:text-zinc-300">
                                <span className="inline-flex items-center gap-1">
                                  <Building2 size={12} className="text-zinc-400" />
                                  {variant.warehouse || 'WH-MAIN'}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap font-mono text-zinc-600 dark:text-zinc-300">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={12} className="text-zinc-400" />
                                  {variant.location || '—'}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {variant.available_qty.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-zinc-600 dark:text-zinc-300">
                                {(variant.on_hand_qty || variant.available_qty).toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-zinc-500">
                                {(variant.reserved_qty || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                                {variant.unit_cost !== undefined ? `$${variant.unit_cost.toFixed(2)}` : '—'}
                              </td>
                              <td className="p-3 text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
                                {variant.supplier || '—'}
                              </td>
                              <td className="p-3 pr-6 text-center whitespace-nowrap">
                                <button
                                  onClick={() => setInspectRecord(variant)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                                  title="View Raw WMS Data & Source Attributes"
                                >
                                  <ExternalLink size={12} />
                                  Raw WMS
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Family Table Footer Total Summary */}
                      <tfoot className="bg-zinc-100/90 dark:bg-zinc-800/80 border-t border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold">
                        <tr>
                          <td colSpan={5} className="p-3 pl-6">
                            TOTAL AVAILABLE ({family.base_sku} Family Across All Warehouses):
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                            {family.total_available_qty.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                            {family.total_on_hand_qty.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-zinc-500">
                            {family.total_reserved_qty.toLocaleString()}
                          </td>
                          <td colSpan={3} className="p-3 pr-6 text-right text-zinc-500 font-normal">
                            Summed across {family.variants.length} variant row(s)
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Raw WMS Data Inspection Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-blue-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Raw WMS &amp; Normalized Stock Record
                </h3>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="text-zinc-400 hover:text-zinc-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <div className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                  {inspectRecord.original_sku}
                </div>
                <div className="text-zinc-600 dark:text-zinc-300 mt-1">
                  {inspectRecord.product_name}
                </div>
                <div className="text-zinc-400 text-[11px] mt-0.5">
                  Base Part: <span className="font-mono font-semibold">{inspectRecord.base_sku}</span> | Extension: <span className="font-mono font-semibold">{inspectRecord.extension}</span>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Preserved Raw WMS Source Fields
                </h4>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {Object.entries(inspectRecord.raw_wms_data || {}).map(([key, val]) => (
                        <tr key={key} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="p-2 font-semibold text-zinc-500 w-1/2">{key}</td>
                          <td className="p-2 font-mono text-zinc-800 dark:text-zinc-200 w-1/2">{String(val)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 block">Warehouse</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                    {inspectRecord.warehouse || 'WH-MAIN'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 block">Location / Bin</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                    {inspectRecord.location || '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 block">Unit Cost</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                    {inspectRecord.unit_cost !== undefined ? `$${inspectRecord.unit_cost.toFixed(2)}` : '—'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 block">Import Batch</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono truncate block">
                    {inspectRecord.importBatchId}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
              <button
                onClick={() => setInspectRecord(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WMS Import Modal */}
      {isImportModalOpen && (
        <WmsImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={(newRecords) => {
            loadCatalog();
            showToast(`Successfully imported ${newRecords.length} product records to Central Catalog!`);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-black text-white px-4 py-3 rounded-xl shadow-2xl border border-zinc-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
