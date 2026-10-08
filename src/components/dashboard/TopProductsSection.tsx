import React, { useState, useMemo } from 'react';
import { Package, TrendingUp, TrendingDown, ArrowUpDown, Award } from 'lucide-react';
import { ProductStat } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';

interface TopProductsSectionProps {
  products: ProductStat[];
  currency: string;
}

type TabType = 'sales' | 'units' | 'growth';

export const TopProductsSection: React.FC<TopProductsSectionProps> = ({ products, currency }) => {
  const [activeTab, setActiveTab] = useState<TabType>('sales');

  const topProducts = useMemo(() => {
    const list = [...products];
    switch (activeTab) {
      case 'sales':
        return list.sort((a, b) => b.sales - a.sales).slice(0, 10);
      case 'units':
        return list.sort((a, b) => b.units - a.units).slice(0, 10);
      case 'growth':
        return list
          .filter(p => p.growth !== null)
          .sort((a, b) => (b.growth || 0) - (a.growth || 0))
          .slice(0, 10);
      default:
        return list.slice(0, 10);
    }
  }, [products, activeTab]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Award size={18} className="text-black dark:text-white" />
            Top 10 Products Leaderboard
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Catalog velocity across all active SKUs
          </p>
        </div>

        {/* Tab switchers */}
        <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'sales'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            By Sales
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'units'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            By Units
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'growth'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            By Growth
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-semibold border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="p-3 w-10 text-center">#</th>
              <th className="p-3">Product Name</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Channel / Store</th>
              <th className="p-3 text-right">Units</th>
              <th className="p-3 text-right">Revenue</th>
              <th className="p-3 text-right">Avg Price (ASP)</th>
              <th className="p-3 text-right">Returns</th>
              <th className="p-3 text-right">Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
            {topProducts.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-zinc-400">
                  No products data available.
                </td>
              </tr>
            ) : (
              topProducts.map((p, index) => {
                const isPositive = (p.growth || 0) >= 0;
                return (
                  <tr key={`${p.sku}-${index}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-850">
                    <td className="p-3 text-center font-mono font-bold text-zinc-400">
                      {index + 1}
                    </td>
                    <td className="p-3 font-semibold text-zinc-900 dark:text-white max-w-xs">
                      <div className="truncate" title={p.product}>
                        {p.product}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                      {p.sku}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
                        {p.marketplace} • {p.store}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">{p.units.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(p.sales, currency)}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-500">
                      {formatCurrency(p.asp, currency)}
                    </td>
                    <td className="p-3 text-right font-mono text-zinc-600 dark:text-zinc-300">
                      {p.returns > 0 ? `${p.returns} units` : '0'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {p.growth !== null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isPositive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
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
  );
};
