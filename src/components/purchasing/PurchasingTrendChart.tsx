import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { PurchasingTrendPoint, PurchasingTrendMetric } from '../../types/purchasing';

interface Props {
  data: PurchasingTrendPoint[];
  currencySymbol?: string;
}

export const PurchasingTrendChart: React.FC<Props> = ({ data, currencySymbol = '$' }) => {
  const [metric, setMetric] = useState<PurchasingTrendMetric>('purchaseValue');

  const metricConfigs: Record<PurchasingTrendMetric, { label: string; color: string; fill: string; isCurrency: boolean }> = {
    purchaseValue: {
      label: 'Purchase Value',
      color: '#38bdf8', // sky-400
      fill: 'rgba(56, 189, 248, 0.15)',
      isCurrency: true
    },
    purchaseOrders: {
      label: 'Purchase Orders',
      color: '#a855f7', // purple-500
      fill: 'rgba(168, 85, 247, 0.15)',
      isCurrency: false
    },
    quantityPurchased: {
      label: 'Quantity Purchased',
      color: '#22c55e', // green-500
      fill: 'rgba(34, 197, 94, 0.15)',
      isCurrency: false
    },
    amountPaid: {
      label: 'Amount Paid',
      color: '#10b981', // emerald-500
      fill: 'rgba(16, 185, 129, 0.15)',
      isCurrency: true
    },
    outstandingAmount: {
      label: 'Outstanding Amount',
      color: '#f43f5e', // rose-500
      fill: 'rgba(244, 63, 94, 0.15)',
      isCurrency: true
    }
  };

  const currentConfig = metricConfigs[metric];

  const formatYAxis = (val: number) => {
    if (currentConfig.isCurrency) {
      if (val >= 1000000) return `${currencySymbol}${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${currencySymbol}${(val / 1000).toFixed(0)}k`;
      return `${currencySymbol}${val}`;
    }
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload as PurchasingTrendPoint;
      return (
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[170px]">
          <div className="font-semibold text-zinc-200 border-b border-zinc-800/80 pb-1">
            {point.date}
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-400">PO Value:</span>
            <span className="font-medium text-white">{currencySymbol}{point.purchaseValue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-400">POs Issued:</span>
            <span className="font-medium text-white">{point.purchaseOrders}</span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-400">Units:</span>
            <span className="font-medium text-white">{point.quantityPurchased.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-400">Paid:</span>
            <span className="font-medium text-emerald-400">{currencySymbol}{point.amountPaid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-zinc-300">
            <span className="text-zinc-400">Outstanding:</span>
            <span className="font-medium text-rose-400">{currencySymbol}{point.outstandingAmount.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="purchasing-trend-chart-card" className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
      {/* Header with metric toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Purchasing Activity Trend</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Timeline of procurement volume and cash commitments</p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          {(Object.keys(metricConfigs) as PurchasingTrendMetric[]).map(key => (
            <button
              key={key}
              id={`chart-metric-${key}`}
              onClick={() => setMetric(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                metric === key
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-800'
              }`}
            >
              {metricConfigs[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            No purchasing activity found for the selected time range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentConfig.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={currentConfig.color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="formattedDate"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#27272a' }}
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatYAxis}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={currentConfig.color}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#trendGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
