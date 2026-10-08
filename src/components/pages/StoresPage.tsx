import React, { useState, useMemo } from 'react';
import {
  Store,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  X,
  Package,
  Calendar,
  Layers,
  ShoppingBag
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { SalesRecord, StoreStat, REGISTERED_STORES } from '../../types';
import { formatCurrency, formatPercent, calculateDailyTrend } from '../../services/analytics';

interface StoresPageProps {
  stores: StoreStat[];
  records: SalesRecord[];
  currency: string;
  selectedStoreDetail?: { storeName: string; marketplace: string } | null;
  onClearStoreDetail?: () => void;
}

export const StoresPage: React.FC<StoresPageProps> = ({
  stores,
  records,
  currency,
  selectedStoreDetail,
  onClearStoreDetail
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('all');
  const [activeStoreName, setActiveStoreName] = useState<string | null>(
    selectedStoreDetail?.storeName || null
  );

  const marketplaces = useMemo(() => {
    return Array.from(new Set(stores.map(s => s.marketplace)));
  }, [stores]);

  const filteredStores = useMemo(() => {
    return stores.filter(s => {
      if (selectedMarketplace !== 'all' && s.marketplace !== selectedMarketplace) return false;
      if (searchQuery && !s.store.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [stores, selectedMarketplace, searchQuery]);

  // If a store is clicked or pre-selected from another page
  const storeDetail = useMemo(() => {
    if (!activeStoreName) return null;
    const storeObj = stores.find(s => s.store === activeStoreName);
    if (!storeObj) return null;

    const storeRecords = records.filter(r => r.store === activeStoreName);
    const storeDailyTrend = calculateDailyTrend(storeRecords);

    // Top products in this store
    const prodMap = new Map<string, { product: string; sku: string; sales: number; units: number }>();
    storeRecords.forEach(r => {
      const prev = prodMap.get(r.sku) || { product: r.product, sku: r.sku, sales: 0, units: 0 };
      prev.sales += r.sales;
      prev.units += r.units;
      prodMap.set(r.sku, prev);
    });

    const topStoreProducts = Array.from(prodMap.values())
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    return {
      stat: storeObj,
      records: storeRecords,
      trend: storeDailyTrend,
      topProducts: topStoreProducts
    };
  }, [activeStoreName, stores, records]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
              <Store size={18} />
            </div>
            Stores Management & Performance
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Tracking {stores.length} multi-store accounts across marketplaces. Click a store row to view dedicated drill-down.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedMarketplace}
            onChange={e => setSelectedMarketplace(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            <option value="all">All Marketplaces</option>
            {marketplaces.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="relative flex-1 sm:w-48">
            <Search size={13} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search store name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
            />
          </div>
        </div>
      </div>

      {/* Main Stores Grid/Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="p-3.5 pl-6">Store Name</th>
                <th className="p-3.5">Marketplace</th>
                <th className="p-3.5 text-right">Revenue</th>
                <th className="p-3.5 text-right">Orders</th>
                <th className="p-3.5 text-right">Units</th>
                <th className="p-3.5 text-right">AOV</th>
                <th className="p-3.5 text-right">Profit</th>
                <th className="p-3.5 text-right">Contribution %</th>
                <th className="p-3.5 text-right pr-6">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
              {filteredStores.map(st => {
                const isPositive = (st.growth || 0) >= 0;
                const isSelected = activeStoreName === st.store;

                const regInfo = REGISTERED_STORES.find(r => r.name === st.store);

                return (
                  <tr
                    key={st.store}
                    onClick={() => setActiveStoreName(st.store)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-800 font-semibold'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <td className="p-3.5 pl-6 font-bold text-zinc-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Store size={15} className="text-zinc-400 shrink-0" />
                        <div>
                          <div>{st.store}</div>
                          {regInfo && (
                            <div className="text-[10px] text-zinc-400 font-normal mt-0.5">
                              {regInfo.fulfillment}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {st.marketplace}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(st.sales, currency)}
                    </td>
                    <td className="p-3.5 text-right font-mono">{st.orders.toLocaleString()}</td>
                    <td className="p-3.5 text-right font-mono">{st.units.toLocaleString()}</td>
                    <td className="p-3.5 text-right font-mono">{formatCurrency(st.aov, currency)}</td>
                    <td className="p-3.5 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {st.profit !== null ? formatCurrency(st.profit, currency) : 'N/A'}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold">{st.contributionPercent}%</td>
                    <td className="p-3.5 pr-6 text-right whitespace-nowrap">
                      {st.growth !== null ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-zinc-900 dark:text-zinc-100">
                          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {formatPercent(st.growth, true)}
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

      {/* Store Detailed Analytics Drill-Down */}
      {storeDetail && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-300 dark:border-zinc-700 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Store Deep Dive
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Store size={20} className="text-black dark:text-white" />
                {storeDetail.stat.store}
                <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  Channel: {storeDetail.stat.marketplace}
                </span>
              </h3>
            </div>

            <button
              onClick={() => {
                setActiveStoreName(null);
                onClearStoreDetail?.();
              }}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
            >
              <X size={16} />
            </button>
          </div>

          {/* Store Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Total Sales</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {formatCurrency(storeDetail.stat.sales, currency)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Orders & Units</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {storeDetail.stat.orders} orders ({storeDetail.stat.units} pcs)
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Average Order Value</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {formatCurrency(storeDetail.stat.aov, currency)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Total Profit</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {storeDetail.stat.profit !== null ? formatCurrency(storeDetail.stat.profit, currency) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Store Daily Velocity Chart */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Daily Revenue Velocity for {storeDetail.stat.store}
            </h4>
            <div className="h-56 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={storeDetail.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="storeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#27272a" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#27272a" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.6} />
                  <XAxis dataKey="formattedDate" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      borderRadius: '10px',
                      border: '1px solid #3f3f46',
                      color: '#ffffff',
                      fontSize: '11px'
                    }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#18181b" strokeWidth={2.5} fill="url(#storeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products in Store */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Top Selling Products in {storeDetail.stat.store}
            </h4>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 font-semibold">
                  <tr>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5">SKU</th>
                    <th className="p-2.5 text-right">Units Sold</th>
                    <th className="p-2.5 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
                  {storeDetail.topProducts.map(p => (
                    <tr key={p.sku}>
                      <td className="p-2.5 font-medium">{p.product}</td>
                      <td className="p-2.5 font-mono text-[11px] text-zinc-400">{p.sku}</td>
                      <td className="p-2.5 text-right font-mono font-semibold">{p.units}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                        {formatCurrency(p.sales, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
