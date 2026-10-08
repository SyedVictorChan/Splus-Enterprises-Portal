import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Package,
  Layers,
  RotateCcw,
  Receipt
} from 'lucide-react';
import { KPISummary } from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';

interface KPICardsProps {
  kpi: KPISummary;
  currency: string;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpi, currency }) => {
  const cards = [
    {
      id: 'kpi-total-sales',
      title: 'Total Sales',
      value: formatCurrency(kpi.totalSales, currency),
      growth: kpi.salesGrowth,
      icon: DollarSign
    },
    {
      id: 'kpi-total-orders',
      title: 'Total Orders',
      value: kpi.totalOrders.toLocaleString(),
      growth: kpi.ordersGrowth,
      icon: ShoppingBag
    },
    {
      id: 'kpi-units-sold',
      title: 'Units Sold',
      value: kpi.totalUnits.toLocaleString(),
      growth: kpi.unitsGrowth,
      icon: Package
    },
    {
      id: 'kpi-aov',
      title: 'Average Order Value',
      value: formatCurrency(kpi.averageOrderValue, currency),
      growth: null,
      icon: Layers
    },
    {
      id: 'kpi-total-refunds',
      title: 'Total Refund Amount',
      value: formatCurrency(kpi.totalRefunds ?? 0, currency),
      growth: kpi.refundsGrowth ?? null,
      icon: Receipt
    },
    {
      id: 'kpi-total-returns',
      title: 'Total Returns',
      value: kpi.hasReturnData && kpi.totalReturns !== null ? `${kpi.totalReturns.toLocaleString()} units` : `${(kpi.totalReturns || 0).toLocaleString()} units`,
      growth: null,
      icon: RotateCcw
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        const hasGrowth = card.growth !== null && card.growth !== undefined;
        const isPositive = (card.growth || 0) >= 0;

        return (
          <div
            key={card.id}
            id={card.id}
            className="bg-[#FFFDF8] dark:bg-[#1A2228] rounded-xl p-4 border border-[#D9E0E2] dark:border-[#2C373E] shadow-2xs hover:border-[#8FAFC2] dark:hover:border-[#6E93A9] transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-[#65747C] dark:text-[#94A3B8] uppercase tracking-wider truncate">
                {card.title}
              </span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#D0DFE7] dark:border-[#384852] bg-[#EAF2F6] dark:bg-[#25323A] text-[#4F7B94] dark:text-[#A5C4D4] shrink-0 shadow-2xs">
                <Icon size={14} />
              </div>
            </div>

            <div className="my-1">
              <div className="text-lg sm:text-xl font-black text-[#263238] dark:text-white tracking-tight">
                {card.value}
              </div>
            </div>

            <div className="pt-2 border-t border-[#EAE6DD] dark:border-[#2C373E] flex items-center justify-between text-[11px]">
              {hasGrowth ? (
                <div className={`flex items-center gap-1 font-bold ${isPositive ? 'text-[#3E7D56] dark:text-[#6CC089]' : 'text-[#B84242] dark:text-[#E57373]'}`}>
                  {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span className="font-mono">{formatPercent(card.growth, true)}</span>
                  <span className="text-[10px] text-[#65747C] dark:text-[#94A3B8] font-normal">vs prev</span>
                </div>
              ) : (
                <span className="text-[#65747C] dark:text-[#94A3B8] text-[10px]">Current period</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
