import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Calendar,
  Layers,
  ArrowUpRight,
  DollarSign,
  Percent,
  ShoppingBag,
  Package,
  RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { DayTrendPoint, KPISummary, MarketplaceStat, SalesRecord } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';

interface SalesAnalyticsPageProps {
  records: SalesRecord[];
  dailyTrend: DayTrendPoint[];
  kpi: KPISummary;
  marketplaceStats: MarketplaceStat[];
  currency: string;
}

type MetricMode = 'revenue' | 'orders' | 'units' | 'aov' | 'refunds';

export const SalesAnalyticsPage: React.FC<SalesAnalyticsPageProps> = ({
  records,
  dailyTrend,
  kpi,
  marketplaceStats,
  currency
}) => {
  const [metricMode, setMetricMode] = useState<MetricMode>('revenue');

  // Compute period comparisons (e.g. today vs yesterday, last 7 days vs previous 7 days)
  const sortedDates = Array.from(new Set(records.map(r => r.date))).sort();
  const latestDate = sortedDates[sortedDates.length - 1] || '';
  const prevDate = sortedDates[sortedDates.length - 2] || '';

  const todayRecords = records.filter(r => r.date === latestDate);
  const yesterdayRecords = records.filter(r => r.date === prevDate);

  const todaySales = todayRecords.reduce((acc, r) => acc + r.sales, 0);
  const yesterdaySales = yesterdayRecords.reduce((acc, r) => acc + r.sales, 0);
  const dayGrowth = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;

  // Chart data formatting
  const chartData = dailyTrend.map(d => ({
    ...d,
    aov: d.orders > 0 ? Math.round(d.sales / d.orders) : 0,
    refunds: d.refunds || 0
  }));

  const CustomAnalyticsTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 text-white rounded-xl shadow-xl p-3 border border-zinc-700 text-xs min-w-44">
          <div className="font-bold text-zinc-300 pb-1 mb-1 border-b border-zinc-800">
            {data.formattedDate} ({data.date})
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Sales:</span>
              <span className="font-mono font-bold text-white">{formatCurrency(data.sales, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Orders:</span>
              <span className="font-mono font-bold text-zinc-200">{data.orders.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Units:</span>
              <span className="font-mono font-bold text-zinc-200">{data.units.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">AOV:</span>
              <span className="font-mono font-bold text-zinc-200">{formatCurrency(data.aov, currency)}</span>
            </div>
            {data.refunds > 0 && (
              <div className="flex justify-between pt-1 border-t border-zinc-800">
                <span className="text-zinc-400">Refunds:</span>
                <span className="font-mono font-bold text-white">{formatCurrency(data.refunds, currency)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-[#FFFDF8] dark:bg-[#1A2228] py-8 px-6 rounded-2xl border border-[#D9E0E2] dark:border-[#2C373E] shadow-2xs flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-[#EAF1F5] dark:bg-[#25323A] text-[#3D647A] dark:text-[#B4CAD6] border border-[#D0DFE7] dark:border-[#384852]">
          <TrendingUp size={13} className="text-[#6E93A9]" />
          <span>Velocity & Growth Analytics</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#263238] dark:text-white flex flex-wrap items-center justify-center gap-2 sm:gap-3 leading-tight">
          <span className="font-extrabold text-[#263238] dark:text-white">Sales Dashboard</span>
          <span className="text-[#D9E0E2] dark:text-[#2C373E] font-light hidden sm:inline">|</span>
          <span className="text-[#556770] dark:text-[#CBD5E1] font-bold">
            Performance Analytics
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-[#65747C] dark:text-[#94A3B8] max-w-2xl font-normal leading-relaxed">
          Multidimensional trends, period-over-period comparative analysis, and unit economics
        </p>

        {/* Period Comparisons */}
        <div className="pt-1 flex items-center justify-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-[#F8F6F0] dark:bg-[#222C33] border border-[#D9E0E2] dark:border-[#2C373E] text-xs">
            <div className="text-[10px] text-[#65747C] dark:text-[#94A3B8] font-bold uppercase tracking-wider">Latest Day ({latestDate}):</div>
            <div className="font-mono font-extrabold text-sm text-[#263238] dark:text-white">
              {formatCurrency(todaySales, currency)}
            </div>
            <div className={`flex items-center gap-0.5 text-[10px] font-bold ${dayGrowth >= 0 ? 'text-[#3E7D56] dark:text-[#6CC089]' : 'text-[#B84242] dark:text-[#E57373]'}`}>
              {dayGrowth >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {formatPercent(dayGrowth, true)} vs prev day
            </div>
          </div>
        </div>
      </div>

      {/* Metric Selector Bar */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'revenue', label: 'Revenue Trend', icon: DollarSign },
          { key: 'orders', label: 'Order Velocity', icon: ShoppingBag },
          { key: 'units', label: 'Units Sold', icon: Package },
          { key: 'aov', label: 'AOV Trend', icon: Layers },
          { key: 'refunds', label: 'Refunds Trend', icon: RotateCcw }
        ].map(tab => {
          const Icon = tab.icon;
          const active = metricMode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setMetricMode(tab.key as MetricMode)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                active
                  ? 'bg-[#7A9FB4] border-[#688FA5] text-white shadow-xs'
                  : 'bg-[#FFFDF8] dark:bg-[#1A2228] border-[#D9E0E2] dark:border-[#2C373E] text-[#556770] dark:text-[#94A3B8] hover:bg-[#F2EFE9] dark:hover:bg-[#25323A]'
              }`}
            >
              <Icon size={14} className={active ? 'text-white' : 'text-[#6E93A9]'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Analytics Chart */}
      <div className="bg-[#FFFDF8] dark:bg-[#1A2228] p-5 rounded-2xl border border-[#D9E0E2] dark:border-[#2C373E] shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
            {metricMode.toUpperCase()} Progression
          </h3>
          <span className="text-xs text-zinc-400">Granularity: Daily</span>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#71717a" opacity={0.25} />
              <XAxis dataKey="formattedDate" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={val =>
                  val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                    ? `${(val / 1000).toFixed(0)}k`
                    : val
                }
              />
              <Tooltip content={<CustomAnalyticsTooltip />} />
              <Line
                type="monotone"
                dataKey={metricMode === 'revenue' ? 'sales' : metricMode}
                stroke="#18181b"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#18181b' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Distribution by Channel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Marketplace Contribution Breakdown
          </h3>
          <div className="space-y-3 pt-2">
            {marketplaceStats.map(m => (
              <div key={m.marketplace} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-700 dark:text-zinc-300">{m.marketplace}</span>
                  <span className="font-mono text-zinc-900 dark:text-white font-bold">
                    {formatCurrency(m.sales, currency)} ({m.contributionPercent}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 dark:bg-white rounded-full"
                    style={{ width: `${Math.min(100, m.contributionPercent)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Key Health Indicators
          </h3>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Period Total Sales</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {formatCurrency(kpi.totalSales, currency)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Average Order Value</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {formatCurrency(kpi.averageOrderValue, currency)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Units per Order</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {kpi.totalOrders > 0 ? (kpi.totalUnits / kpi.totalOrders).toFixed(2) : '0.00'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[10px] uppercase font-bold text-zinc-400">Overall Margin</span>
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono mt-0.5">
                {kpi.profitMargin !== null ? formatPercent(kpi.profitMargin) : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
