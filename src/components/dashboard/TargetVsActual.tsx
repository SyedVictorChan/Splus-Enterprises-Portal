import React, { useState } from 'react';
import { Target, ChevronDown, ChevronUp, Edit2, Check, TrendingUp } from 'lucide-react';
import { SalesTarget } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';
import { StorageService } from '../../services/storage';

interface TargetVsActualProps {
  actualSales: number;
  actualOrders: number;
  actualProfit: number | null;
  currency: string;
  monthKey: string; // YYYY-MM
  targetConfig?: SalesTarget;
  onTargetUpdated: () => void;
}

export const TargetVsActual: React.FC<TargetVsActualProps> = ({
  actualSales,
  actualOrders,
  actualProfit,
  currency,
  monthKey,
  targetConfig,
  onTargetUpdated
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const defaultTarget: SalesTarget = targetConfig || {
    monthKey,
    salesTarget: 50000,
    ordersTarget: 1200,
    profitTarget: 22000
  };

  const [editSalesTarget, setEditSalesTarget] = useState(defaultTarget.salesTarget);
  const [editOrdersTarget, setEditOrdersTarget] = useState(defaultTarget.ordersTarget);
  const [editProfitTarget, setEditProfitTarget] = useState(defaultTarget.profitTarget);

  // Month progress calculation
  const now = new Date();
  const year = parseInt(monthKey.split('-')[0]) || now.getFullYear();
  const month = parseInt(monthKey.split('-')[1]) - 1 || now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);
  const remainingDays = Math.max(1, daysInMonth - currentDay);

  // Run-rate projection
  const dailyRunRate = currentDay > 0 ? actualSales / currentDay : 0;
  const projectedMonthEndSales = Math.round(actualSales + dailyRunRate * remainingDays);

  const salesAchievement = defaultTarget.salesTarget > 0 ? (actualSales / defaultTarget.salesTarget) * 100 : 0;
  const ordersAchievement = defaultTarget.ordersTarget > 0 ? (actualOrders / defaultTarget.ordersTarget) * 100 : 0;
  const remainingSalesTarget = Math.max(0, defaultTarget.salesTarget - actualSales);
  const requiredDailySales = remainingDays > 0 ? Math.round(remainingSalesTarget / remainingDays) : 0;

  const handleSaveTargets = () => {
    const settings = StorageService.getSettings();
    settings.targets[monthKey] = {
      monthKey,
      salesTarget: editSalesTarget,
      ordersTarget: editOrdersTarget,
      profitTarget: editProfitTarget
    };
    StorageService.saveSettings(settings);
    setIsEditing(false);
    onTargetUpdated();
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
            <Target size={17} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              Sales Targets vs. Actuals
              <span className="text-xs font-mono font-medium text-zinc-400">({monthKey})</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pacing analysis, daily required run-rates, and month-end projections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
          >
            <Edit2 size={12} /> {isEditing ? 'Cancel' : 'Edit Targets'}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Sales Revenue Target ({currency})
            </label>
            <input
              type="number"
              value={editSalesTarget}
              onChange={e => setEditSalesTarget(Number(e.target.value))}
              className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Orders Volume Target
            </label>
            <input
              type="number"
              value={editOrdersTarget}
              onChange={e => setEditOrdersTarget(Number(e.target.value))}
              className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSaveTargets}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold"
            >
              <Check size={14} /> Save Monthly Target
            </button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Sales Target Progress */}
          <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-zinc-600 dark:text-zinc-300">Sales Achievement</span>
              <span className="font-bold text-zinc-900 dark:text-white font-mono">
                {formatPercent(salesAchievement)}
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-black dark:bg-white transition-all duration-500"
                style={{ width: `${Math.min(100, salesAchievement)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 pt-1">
              <span>Actual: {formatCurrency(actualSales, currency)}</span>
              <span>Target: {formatCurrency(defaultTarget.salesTarget, currency)}</span>
            </div>
          </div>

          {/* Orders Target Progress */}
          <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-zinc-600 dark:text-zinc-300">Orders Achievement</span>
              <span className="font-bold text-zinc-900 dark:text-white font-mono">
                {formatPercent(ordersAchievement)}
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200 transition-all duration-500"
                style={{ width: `${Math.min(100, ordersAchievement)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 pt-1">
              <span>Actual: {actualOrders.toLocaleString()}</span>
              <span>Target: {defaultTarget.ordersTarget.toLocaleString()}</span>
            </div>
          </div>

          {/* Remaining Target & Required Daily Sales */}
          <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Required Daily Sales
            </span>
            <div className="my-1">
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono">
                {formatCurrency(requiredDailySales, currency)} / day
              </div>
              <div className="text-[11px] text-zinc-500">
                {remainingDays} days remaining to reach target
              </div>
            </div>
            <div className="text-[10px] text-zinc-400">
              Gap: {formatCurrency(remainingSalesTarget, currency)}
            </div>
          </div>

          {/* Projected Month-End */}
          <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
              <TrendingUp size={13} className="text-zinc-900 dark:text-white" /> Projected Month-End
            </span>
            <div className="my-1">
              <div className="text-base font-extrabold text-zinc-900 dark:text-white font-mono">
                {formatCurrency(projectedMonthEndSales, currency)}
              </div>
              <div className="text-[11px] text-zinc-500">
                Based on current daily velocity ({formatCurrency(dailyRunRate, currency)}/day)
              </div>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">
              {projectedMonthEndSales >= defaultTarget.salesTarget ? (
                <span>On track to reach monthly target</span>
              ) : (
                <span>Pacing slightly below target</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
