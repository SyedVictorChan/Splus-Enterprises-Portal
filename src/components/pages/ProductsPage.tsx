import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Boxes,
  Layers,
  BarChart3
} from 'lucide-react';
import { ProductStat, REGISTERED_STORES } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';
import { exportToCSV, exportToExcel } from '../../services/excelParser';
import { ProductCatalogView } from '../wms/ProductCatalogView';

interface ProductsPageProps {
  products: ProductStat[];
  currency: string;
}

type ProductsTab = 'wms_catalog' | 'sales_analytics';

type SortOption =
  | 'sales_desc'
  | 'sales_asc'
  | 'units_desc'
  | 'profit_desc'
  | 'margin_desc'
  | 'growth_desc'
  | 'growth_asc';

export const ProductsPage: React.FC<ProductsPageProps> = ({ products, currency }) => {
  const [activeProductsTab, setActiveProductsTab] = useState<ProductsTab>('wms_catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('all');
  const [selectedStore, setSelectedStore] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('sales_desc');

  const marketplaces = useMemo(() => {
    return Array.from(new Set(products.map(p => p.marketplace))).filter(Boolean);
  }, [products]);

  const stores = useMemo(() => {
    const list = selectedMarketplace === 'all'
      ? products
      : products.filter(p => p.marketplace === selectedMarketplace);
    const set = new Set(list.map(p => p.store));
    REGISTERED_STORES.forEach(s => {
      if (selectedMarketplace === 'all' || s.marketplace === selectedMarketplace) {
        set.add(s.name);
      }
    });
    return Array.from(set).filter(Boolean);
  }, [products, selectedMarketplace]);

  const sortedProducts = useMemo(() => {
    return products
      .filter(p => {
        if (selectedMarketplace !== 'all' && p.marketplace !== selectedMarketplace) return false;
        if (selectedStore !== 'all' && p.store !== selectedStore) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            p.product.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.marketplace.toLowerCase().includes(q) ||
            p.store.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case 'sales_desc':
            return b.sales - a.sales;
          case 'sales_asc':
            return a.sales - b.sales;
          case 'units_desc':
            return b.units - a.units;
          case 'profit_desc':
            return (b.profit || 0) - (a.profit || 0);
          case 'margin_desc':
            return (b.margin || 0) - (a.margin || 0);
          case 'growth_desc':
            return (b.growth || -999) - (a.growth || -999);
          case 'growth_asc':
            return (a.growth || 999) - (b.growth || 999);
          default:
            return b.sales - a.sales;
        }
      });
  }, [products, selectedMarketplace, selectedStore, searchQuery, sortOption]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    const exportData = sortedProducts.map(p => ({
      Product: p.product,
      SKU: p.sku,
      Marketplace: p.marketplace,
      Store: p.store,
      'Units Sold': p.units,
      'Sales Revenue': p.sales,
      'Total Cost': p.cost !== null ? p.cost : 'N/A',
      Profit: p.profit !== null ? p.profit : 'N/A',
      'Profit Margin %': p.margin !== null ? p.margin : 'N/A',
      'Average Selling Price (ASP)': p.asp,
      'Growth %': p.growth !== null ? p.growth : 'N/A'
    }));

    if (type === 'csv') {
      exportToCSV(exportData, `splus_products_${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      exportToExcel(exportData, `splus_products_${new Date().toISOString().split('T')[0]}.xlsx`, 'Products');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Level Section Switcher */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <button
          onClick={() => setActiveProductsTab('wms_catalog')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeProductsTab === 'wms_catalog'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Boxes size={15} />
          Central Product Catalog (WMS)
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeProductsTab === 'wms_catalog'
              ? 'bg-blue-500 text-white'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
          }`}>
            Master
          </span>
        </button>

        <button
          onClick={() => setActiveProductsTab('sales_analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeProductsTab === 'sales_analytics'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <BarChart3 size={15} />
          Marketplace Sales Performance
          <span className="text-[10px] text-zinc-400 font-mono">
            ({products.length} SKUs)
          </span>
        </button>
      </div>

      {activeProductsTab === 'wms_catalog' ? (
        <ProductCatalogView />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                  <Package size={18} />
                </div>
                Products & SKU Performance
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Analyzing {products.length} unique SKUs automatically tracked across sales channels
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('xlsx')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
              >
                <Download size={13} /> Export Excel
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

      {/* Filter & Sort Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search Product Name or SKU..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
        </div>

        {/* Marketplace */}
        <div>
          <select
            value={selectedMarketplace}
            onChange={e => {
              setSelectedMarketplace(e.target.value);
              setSelectedStore('all');
            }}
            className="w-full text-xs px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            <option value="all">All Marketplaces</option>
            {marketplaces.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Store */}
        <div>
          <select
            value={selectedStore}
            onChange={e => setSelectedStore(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            <option value="all">All Stores</option>
            {stores.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Presets */}
        <div>
          <select
            value={sortOption}
            onChange={e => setSortOption(e.target.value as SortOption)}
            className="w-full text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            <option value="sales_desc">Sort: Highest Sales Revenue</option>
            <option value="sales_asc">Sort: Lowest Sales Revenue</option>
            <option value="units_desc">Sort: Highest Units Sold</option>
            <option value="profit_desc">Sort: Highest Profit</option>
            <option value="margin_desc">Sort: Highest Profit Margin</option>
            <option value="growth_desc">Sort: Highest Growth %</option>
            <option value="growth_asc">Sort: Lowest Growth %</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-3.5 pl-6">Product Details</th>
                <th className="p-3.5">Channel / Store</th>
                <th className="p-3.5 text-right">Units</th>
                <th className="p-3.5 text-right">Revenue</th>
                <th className="p-3.5 text-right">Cost (COGS)</th>
                <th className="p-3.5 text-right">Profit</th>
                <th className="p-3.5 text-right">Margin %</th>
                <th className="p-3.5 text-right">ASP</th>
                <th className="p-3.5 pr-6 text-right">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-zinc-400">
                    No products matched your criteria.
                  </td>
                </tr>
              ) : (
                sortedProducts.map((p, idx) => {
                  const isPositive = (p.growth || 0) >= 0;
                  return (
                    <tr key={`${p.sku}-${idx}`} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/50">
                      <td className="p-3.5 pl-6 max-w-sm">
                        <div className="font-bold text-zinc-900 dark:text-white truncate" title={p.product}>
                          {p.product}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                          SKU: {p.sku}
                        </div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">{p.marketplace}</div>
                        <div className="text-[10px] text-zinc-400">{p.store}</div>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold">{p.units.toLocaleString()}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(p.sales, currency)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-zinc-500 whitespace-nowrap">
                        {p.cost !== null ? formatCurrency(p.cost, currency) : 'N/A'}
                      </td>
                      <td className="p-3.5 text-right font-mono text-zinc-900 dark:text-zinc-100 font-semibold whitespace-nowrap">
                        {p.profit !== null ? formatCurrency(p.profit, currency) : 'N/A'}
                      </td>
                      <td className="p-3.5 text-right font-mono whitespace-nowrap">
                        {p.margin !== null ? formatPercent(p.margin) : 'N/A'}
                      </td>
                      <td className="p-3.5 text-right font-mono text-zinc-500 whitespace-nowrap">
                        {formatCurrency(p.asp, currency)}
                      </td>
                      <td className="p-3.5 pr-6 text-right whitespace-nowrap">
                        {p.growth !== null ? (
                          <span className="inline-flex items-center gap-0.5 font-bold text-zinc-900 dark:text-zinc-100">
                            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {formatPercent(p.growth, true)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};
