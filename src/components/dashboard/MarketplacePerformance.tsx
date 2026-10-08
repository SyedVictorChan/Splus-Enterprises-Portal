import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { MarketplaceStat } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';
import { Globe, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';

interface MarketplacePerformanceProps {
  stats: MarketplaceStat[];
  currency: string;
}

const PALETTE = [
  '#09090b', // Pitch Black
  '#27272a', // Dark Zinc
  '#52525b', // Medium Zinc
  '#71717a', // Neutral Zinc
  '#a1a1aa', // Light Zinc
  '#d4d4d8'  // Pale Zinc
];

export const MarketplacePerformance: React.FC<MarketplacePerformanceProps> = ({ stats, currency }) => {
  const [viewMode, setViewMode] = useState<'donut' | 'bars'>('donut');

  const chartData = stats.map((m, idx) => ({
    name: m.marketplace,
    value: m.sales,
    percent: m.contributionPercent,
    orders: m.orders,
    color: PALETTE[idx % PALETTE.length]
  }));

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-black text-white rounded-lg shadow-xl p-2.5 border border-zinc-800 text-xs">
          <div className="font-bold">{item.name}</div>
          <div className="text-white font-mono font-bold mt-1">
            {formatCurrency(item.value, currency)}
          </div>
          <div className="text-zinc-400 text-[11px]">
            {item.percent}% share • {item.orders.toLocaleString()} orders
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Globe size={18} className="text-black dark:text-white" />
            Marketplace Performance & Channel Share
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Automatically identified {stats.length} active marketplace channels
          </p>
        </div>

        <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setViewMode('donut')}
            className={`px-3 py-1 rounded-md text-xs font-semibold ${
              viewMode === 'donut'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            Donut Share
          </button>
          <button
            onClick={() => setViewMode('bars')}
            className={`px-3 py-1 rounded-md text-xs font-semibold ${
              viewMode === 'bars'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            Bar Comparison
          </button>
        </div>
      </div>

      {/* Visual Chart & Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Left: Chart */}
        <div className="lg:col-span-5 h-64 flex items-center justify-center">
          {stats.length === 0 ? (
            <div className="text-zinc-400 text-xs">No marketplace records available.</div>
          ) : viewMode === 'donut' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={70} />
                <Tooltip content={<CustomPieTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right: Detailed Comparison Table */}
        <div className="lg:col-span-7 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-semibold border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="p-2.5">Marketplace</th>
                <th className="p-2.5 text-right">Sales</th>
                <th className="p-2.5 text-right">Orders</th>
                <th className="p-2.5 text-right">AOV</th>
                <th className="p-2.5 text-right">Share %</th>
                <th className="p-2.5 text-right">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
              {stats.map((m, idx) => {
                const color = PALETTE[idx % PALETTE.length];
                const isPositive = (m.growth || 0) >= 0;

                return (
                  <tr key={m.marketplace} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                    <td className="p-2.5 font-bold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                      <span className="truncate max-w-28 text-zinc-900 dark:text-white">{m.marketplace}</span>
                      <span className="text-[10px] text-zinc-400 font-normal">({m.storeCount} stores)</span>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(m.sales, currency)}
                    </td>
                    <td className="p-2.5 text-right font-mono">{m.orders.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-mono">{formatCurrency(m.aov, currency)}</td>
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-semibold">
                        <span className="font-mono">{m.contributionPercent}%</span>
                        <div className="w-10 bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, m.contributionPercent)}%`, backgroundColor: color }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5 text-right">
                      {m.growth !== null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold text-[11px] ${
                            isPositive ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {formatPercent(m.growth, true)}
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
    </div>
  );
};
