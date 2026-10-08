import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  TrendingDown,
  ShoppingBag,
  Store,
  DollarSign,
  Truck,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { RMAItem } from '../../types/rma';
import { SalesRecord } from '../../types';
import {
  RMAService,
  STANDARD_RETURN_REASONS
} from '../../services/rmaService';

interface RMAAnalyticsProps {
  rmas: RMAItem[];
  salesRecords?: SalesRecord[];
}

const PALETTE = [
  '#38bdf8', // sky
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#a855f7'  // purple
];

export const RMAAnalytics: React.FC<RMAAnalyticsProps> = ({
  rmas,
  salesRecords = []
}) => {
  const [productSortKey, setProductSortKey] = useState<
    'returnRate' | 'unitsReturned' | 'refundAmount' | 'rmaCount'
  >('rmaCount');

  // Reason Distribution Chart Data
  const reasonData = useMemo(() => {
    const counts: Record<string, number> = {};
    rmas.forEach(r => {
      const reasonObj = STANDARD_RETURN_REASONS.find(sr => sr.value === r.reason);
      const label = reasonObj ? reasonObj.label : r.reason || 'Other';
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [rmas]);

  // Marketplace Distribution Data
  const marketplaceData = useMemo(() => {
    const map: Record<string, { name: string; rmas: number; refunds: number }> = {};
    rmas.forEach(r => {
      const mp = r.marketplace || 'Direct';
      if (!map[mp]) {
        map[mp] = { name: mp, rmas: 0, refunds: 0 };
      }
      map[mp].rmas++;
      if (r.refund) {
        map[mp].refunds += r.refund.refundAmount || 0;
      }
    });

    return Object.values(map).sort((a, b) => b.rmas - a.rmas);
  }, [rmas]);

  // Store Distribution Data
  const storeData = useMemo(() => {
    const map: Record<string, { name: string; rmas: number; units: number }> = {};
    rmas.forEach(r => {
      const st = r.store || 'Main Store';
      if (!map[st]) {
        map[st] = { name: st, rmas: 0, units: 0 };
      }
      map[st].rmas++;
      map[st].units += r.quantity || 1;
    });

    return Object.values(map).sort((a, b) => b.rmas - a.rmas);
  }, [rmas]);

  // Product Level Return Analysis (Section 18)
  const productAnalysis = useMemo(() => {
    const list = RMAService.getProductReturnAnalysis(rmas, salesRecords);
    list.sort((a, b) => {
      if (productSortKey === 'returnRate') {
        const aVal = a.returnRate ?? -1;
        const bVal = b.returnRate ?? -1;
        return bVal - aVal;
      }
      if (productSortKey === 'unitsReturned') {
        return b.unitsReturned - a.unitsReturned;
      }
      if (productSortKey === 'refundAmount') {
        return b.refundAmount - a.refundAmount;
      }
      return b.rmaCount - a.rmaCount;
    });
    return list;
  }, [rmas, salesRecords, productSortKey]);

  return (
    <div className="space-y-6">
      {/* Row 1: Charts (Reason Distribution & Marketplace Comparison) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Return Reason Breakdown */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Return Reason Distribution</h3>
              <p className="text-xs text-zinc-400">Primary customer return drivers</p>
            </div>
            <span className="text-xs font-mono text-zinc-400">{reasonData.length} reasons tracked</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={11}
                  width={140}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#38bdf8', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Marketplace RMA Comparison */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Returns by Marketplace</h3>
              <p className="text-xs text-zinc-400">RMA case distribution across sales channels</p>
            </div>
            <span className="text-xs font-mono text-zinc-400">{marketplaceData.length} channels</span>
          </div>

          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={marketplaceData}
                  dataKey="rmas"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={4}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {marketplaceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem' }}
                  itemStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Product Return Analysis Table (Section 18) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Product Return Analysis</h3>
            <p className="text-xs text-zinc-400">
              Cross-referencing RMA incident volume, return rates, and financial impact by SKU
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Sort by:</span>
            <select
              value={productSortKey}
              onChange={(e) => setProductSortKey(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="rmaCount">Most RMA Cases</option>
              <option value="unitsReturned">Most Units Returned</option>
              <option value="returnRate">Highest Return Rate (%)</option>
              <option value="refundAmount">Highest Refund Value ($)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <th className="px-4 py-3">Product Name & SKU</th>
                <th className="px-4 py-3 text-center">Units Sold</th>
                <th className="px-4 py-3 text-center">Units Returned</th>
                <th className="px-4 py-3 text-center">Return Rate</th>
                <th className="px-4 py-3 text-center">RMA Cases</th>
                <th className="px-4 py-3 text-right">Refund Value</th>
                <th className="px-4 py-3 text-center">Replacements</th>
                <th className="px-4 py-3">Top Return Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {productAnalysis.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                    No product return data available yet.
                  </td>
                </tr>
              ) : (
                productAnalysis.map((item, idx) => (
                  <tr key={item.sku || idx} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white line-clamp-1">{item.product}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{item.sku}</div>
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-zinc-400">
                      {item.unitsSold > 0 ? item.unitsSold : <span className="text-zinc-600">N/A</span>}
                    </td>

                    <td className="px-4 py-3 text-center font-mono font-semibold text-amber-400">
                      {item.unitsReturned}
                    </td>

                    <td className="px-4 py-3 text-center font-mono font-bold">
                      {item.returnRate !== null ? (
                        <span
                          className={
                            item.returnRate > 10
                              ? 'text-rose-400'
                              : item.returnRate > 5
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {item.returnRate}%
                        </span>
                      ) : (
                        <span className="text-zinc-600 font-normal">N/A</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-white">
                      {item.rmaCount}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-medium text-emerald-400">
                      ${item.refundAmount.toFixed(2)}
                    </td>

                    <td className="px-4 py-3 text-center font-mono text-violet-400">
                      {item.replacementCount}
                    </td>

                    <td className="px-4 py-3 text-zinc-300">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-[11px]">
                        {item.mainReturnReason}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
