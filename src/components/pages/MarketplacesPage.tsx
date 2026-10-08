import React, { useState } from 'react';
import { Globe, Store, ArrowUpRight, TrendingUp, TrendingDown, Layers, Search } from 'lucide-react';
import { MarketplaceStat, SalesRecord, StoreStat } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';

interface MarketplacesPageProps {
  marketplaceStats: MarketplaceStat[];
  storeStats: StoreStat[];
  currency: string;
  onSelectStore: (storeName: string, marketplace: string) => void;
}

export const MarketplacesPage: React.FC<MarketplacesPageProps> = ({
  marketplaceStats,
  storeStats,
  currency,
  onSelectStore
}) => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(
    marketplaceStats[0]?.marketplace || null
  );

  const activeMarketplace = marketplaceStats.find(m => m.marketplace === selectedMarketplace) || marketplaceStats[0];

  const storesInMarketplace = activeMarketplace
    ? storeStats.filter(s => s.marketplace === activeMarketplace.marketplace)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
            <Globe size={18} />
          </div>
          Marketplaces & Channel Ecosystem
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Automatically detected channels from spreadsheet ingestion. Click any marketplace to view attached stores and order distribution.
        </p>
      </div>

      {/* Marketplace Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketplaceStats.map(m => {
          const isSelected = activeMarketplace?.marketplace === m.marketplace;
          const isPositive = (m.growth || 0) >= 0;

          return (
            <div
              key={m.marketplace}
              onClick={() => setSelectedMarketplace(m.marketplace)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-black dark:border-white shadow-md'
                  : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-extrabold text-base tracking-tight">
                  {m.marketplace}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isSelected
                    ? 'bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}>
                  {m.storeCount} stores
                </span>
              </div>

              <div className="text-xl font-extrabold font-mono tracking-tight">
                {formatCurrency(m.sales, currency)}
              </div>

              <div className={`flex items-center justify-between text-xs mt-3 pt-3 border-t ${
                isSelected ? 'border-zinc-800 dark:border-zinc-200 text-zinc-300 dark:text-zinc-700' : 'border-zinc-100 dark:border-zinc-800 text-zinc-500'
              }`}>
                <span>{m.contributionPercent}% share</span>
                {m.growth !== null && (
                  <span className="font-bold flex items-center gap-0.5">
                    {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {formatPercent(m.growth, true)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Marketplace Stores Breakdown */}
      {activeMarketplace && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Store size={18} className="text-black dark:text-white" />
                Stores Under {activeMarketplace.marketplace}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {storesInMarketplace.length} store front(s) operating on {activeMarketplace.marketplace}
              </p>
            </div>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3">Store Name</th>
                  <th className="p-3 text-right">Sales Revenue</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-right">Units</th>
                  <th className="p-3 text-right">AOV</th>
                  <th className="p-3 text-right">Profit</th>
                  <th className="p-3 text-right">Share of Marketplace</th>
                  <th className="p-3 text-right">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
                {storesInMarketplace.map(store => {
                  const marketplaceShare =
                    activeMarketplace.sales > 0
                      ? ((store.sales / activeMarketplace.sales) * 100).toFixed(1)
                      : '0';
                  const isPositive = (store.growth || 0) >= 0;

                  return (
                    <tr
                      key={store.store}
                      onClick={() => onSelectStore(store.store, store.marketplace)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Store size={14} className="text-zinc-400" />
                        <span>{store.store}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {formatCurrency(store.sales, currency)}
                      </td>
                      <td className="p-3 text-right font-mono">{store.orders.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">{store.units.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(store.aov, currency)}</td>
                      <td className="p-3 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {store.profit !== null ? formatCurrency(store.profit, currency) : 'N/A'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {marketplaceShare}%
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {store.growth !== null ? (
                          <span className="inline-flex items-center gap-0.5 font-bold text-zinc-900 dark:text-zinc-100">
                            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {formatPercent(store.growth, true)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
