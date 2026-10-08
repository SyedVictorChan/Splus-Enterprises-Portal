import React, { useState, useMemo } from 'react';
import { Store, ArrowUpDown, ChevronRight, TrendingUp, TrendingDown, Search, Filter } from 'lucide-react';
import { StoreStat } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';

interface StorePerformanceProps {
  stores: StoreStat[];
  currency: string;
  onSelectStore?: (storeName: string, marketplace: string) => void;
}

type SortField = 'sales' | 'orders' | 'units' | 'profit' | 'growth' | 'contributionPercent';

export const StorePerformance: React.FC<StorePerformanceProps> = ({
  stores,
  currency,
  onSelectStore
}) => {
  const [sortField, setSortField] = useState<SortField>('sales');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [filterMarketplace, setFilterMarketplace] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const marketplaces = useMemo(() => {
    return Array.from(new Set(stores.map(s => s.marketplace)));
  }, [stores]);

  const sortedStores = useMemo(() => {
    return stores
      .filter(s => {
        if (filterMarketplace !== 'all' && s.marketplace !== filterMarketplace) return false;
        if (searchQuery && !s.store.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField] ?? -999999;
        let valB = b[sortField] ?? -999999;
        return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
  }, [stores, sortField, sortAsc, filterMarketplace, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Store size={18} className="text-black dark:text-white" />
            Store Performance Matrix
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Performance across {stores.length} multi-channel store fronts. Click any store to drill down.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Marketplace Filter */}
          <select
            value={filterMarketplace}
            onChange={e => setFilterMarketplace(e.target.value)}
            className="text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 py-1.5 px-2.5 text-zinc-800 dark:text-zinc-200 focus:outline-none"
          >
            <option value="all">All Marketplaces</option>
            {marketplaces.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Quick Search */}
          <div className="relative flex-1 sm:w-44">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search store..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-semibold border-b border-zinc-200 dark:border-zinc-800 select-none">
            <tr>
              <th className="p-3">Store Name</th>
              <th className="p-3">Marketplace</th>
              <th
                onClick={() => handleSort('sales')}
                className="p-3 text-right cursor-pointer hover:text-black dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Sales</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                onClick={() => handleSort('orders')}
                className="p-3 text-right cursor-pointer hover:text-black dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Orders</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                onClick={() => handleSort('units')}
                className="p-3 text-right cursor-pointer hover:text-black dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Units</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                onClick={() => handleSort('profit')}
                className="p-3 text-right cursor-pointer hover:text-black dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Profit</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="p-3 text-right">AOV</th>
              <th
                onClick={() => handleSort('contributionPercent')}
                className="p-3 text-right cursor-pointer hover:text-black dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Share %</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th
                onClick={() => handleSort('growth')}
                className="p-3 text-right cursor-pointer hover:text-black dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Growth</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="p-3 text-center w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
            {sortedStores.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-zinc-400">
                  No stores match the current filters.
                </td>
              </tr>
            ) : (
              sortedStores.map(st => {
                const isPositive = (st.growth || 0) >= 0;
                return (
                  <tr
                    key={`${st.marketplace}-${st.store}`}
                    onClick={() => onSelectStore?.(st.store, st.marketplace)}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer transition-colors group"
                  >
                    <td className="p-3 font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Store size={14} className="text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                      <span className="truncate max-w-xs">{st.store}</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {st.marketplace}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(st.sales, currency)}
                    </td>
                    <td className="p-3 text-right font-mono">{st.orders.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{st.units.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                      {st.profit !== null ? formatCurrency(st.profit, currency) : 'N/A'}
                    </td>
                    <td className="p-3 text-right font-mono">{formatCurrency(st.aov, currency)}</td>
                    <td className="p-3 text-right font-mono font-bold">{st.contributionPercent}%</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {st.growth !== null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isPositive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {formatPercent(st.growth, true)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <ChevronRight size={14} className="text-zinc-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
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
