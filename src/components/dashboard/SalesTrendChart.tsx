import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { DayTrendPoint } from '../../types';
import { formatCurrency } from '../../services/analytics';
import { BarChart2, TrendingUp } from 'lucide-react';

interface SalesTrendChartProps {
  data: DayTrendPoint[];
  currency: string;
}

type MetricType = 'sales' | 'orders' | 'units' | 'refunds';

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ data, currency }) => {
  const [metric, setMetric] = useState<MetricType>('sales');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const metricConfig: Record<MetricType, { label: string; color: string; fill: string; format: (v: number) => string }> = {
    sales: {
      label: 'Sales Revenue',
      color: '#18181b', // pure charcoal black
      fill: '#27272a',
      format: (v: number) => formatCurrency(v, currency)
    },
    orders: {
      label: 'Total Orders',
      color: '#27272a',
      fill: '#3f3f46',
      format: (v: number) => `${v.toLocaleString()} orders`
    },
    units: {
      label: 'Units Sold',
      color: '#3f3f46',
      fill: '#52525b',
      format: (v: number) => `${v.toLocaleString()} units`
    },
    refunds: {
      label: 'Refunds Amount',
      color: '#09090b',
      fill: '#18181b',
      format: (v: number) => formatCurrency(v, currency)
    }
  };

  const currentCfg = metricConfig[metric];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point: DayTrendPoint = payload[0].payload;
      return (
        <div className="bg-black text-white rounded-lg shadow-xl p-3 border border-zinc-800 text-xs min-w-44">
          <div className="font-bold text-zinc-300 pb-1.5 mb-1.5 border-b border-zinc-800">
            {point.formattedDate} ({point.date})
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-zinc-200">
              <span className="text-zinc-400">Sales:</span>
              <span className="font-bold font-mono text-white">{formatCurrency(point.sales, currency)}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-200">
              <span className="text-zinc-400">Orders:</span>
              <span className="font-bold font-mono text-white">{point.orders.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-200">
              <span className="text-zinc-400">Units:</span>
              <span className="font-bold font-mono text-white">{point.units.toLocaleString()}</span>
            </div>
            {point.refunds !== undefined && point.refunds > 0 && (
              <div className="flex justify-between items-center text-zinc-200 pt-1 border-t border-zinc-850">
                <span className="text-zinc-400">Refunds:</span>
                <span className="font-bold font-mono text-white">{formatCurrency(point.refunds, currency)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <TrendingUp size={18} className="text-black dark:text-white" />
            Sales Trend & Daily Velocity
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Aggregated timeline performance across all connected stores
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric Switcher */}
          <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
            {(['sales', 'orders', 'units', 'refunds'] as MetricType[]).map(m => (
              <button
                key={m}
                id={`btn-trend-metric-${m}`}
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                  metric === m
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Chart visual toggle */}
          <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-md text-xs ${
                chartType === 'area'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                  : 'text-zinc-500'
              }`}
              title="Area Line Chart"
            >
              <TrendingUp size={14} />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-md text-xs ${
                chartType === 'bar'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                  : 'text-zinc-500'
              }`}
              title="Bar Chart"
            >
              <BarChart2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full pt-2">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
            No sales data recorded in the selected period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.6} />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  tickFormatter={val =>
                    val >= 1000000
                      ? `${(val / 1000000).toFixed(1)}M`
                      : val >= 1000
                      ? `${(val / 1000).toFixed(0)}k`
                      : val
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="#18181b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#trendGradient)"
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2, fill: '#000000' }}
                />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.6} />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  tickFormatter={val =>
                    val >= 1000000
                      ? `${(val / 1000000).toFixed(1)}M`
                      : val >= 1000
                      ? `${(val / 1000).toFixed(0)}k`
                      : val
                  }
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={metric}
                  fill="#18181b"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
