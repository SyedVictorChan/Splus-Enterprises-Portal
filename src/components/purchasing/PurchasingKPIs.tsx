import React from 'react';
import {
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Boxes,
  TrendingDown
} from 'lucide-react';
import { PurchasingKPIs as KPIsType } from '../../types/purchasing';

interface Props {
  kpis: KPIsType;
  currencySymbol?: string;
}

export const PurchasingKPIs: React.FC<Props> = ({ kpis, currencySymbol = '$' }) => {
  const cards = [
    {
      id: 'kpi-total-value',
      label: 'Total Purchase Value',
      value: `${currencySymbol}${kpis.totalPurchaseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: 'Gross purchase orders in period',
      icon: DollarSign,
      color: 'text-zinc-100',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    },
    {
      id: 'kpi-total-pos',
      label: 'Total Purchase Orders',
      value: kpis.totalPurchaseOrders.toString(),
      description: 'Total active PO contracts',
      icon: FileText,
      color: 'text-blue-400',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    },
    {
      id: 'kpi-pending-purchases',
      label: 'Pending Purchases',
      value: kpis.pendingPurchases.toString(),
      description: 'Awaiting delivery or partial',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    },
    {
      id: 'kpi-received-purchases',
      label: 'Received Purchases',
      value: kpis.receivedPurchases.toString(),
      description: 'Fully delivered & inspected',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    },
    {
      id: 'kpi-pending-payment',
      label: 'Pending Payment',
      value: `${currencySymbol}${kpis.pendingPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: 'Payable balance to suppliers',
      icon: AlertCircle,
      color: 'text-rose-400',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    },
    {
      id: 'kpi-active-suppliers',
      label: 'Suppliers',
      value: kpis.activeSuppliers.toString(),
      description: 'Active authorized vendors',
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    },
    {
      id: 'kpi-items-purchased',
      label: 'Items Purchased',
      value: kpis.totalItemsPurchased.toLocaleString(),
      description: 'Total units procured',
      icon: Boxes,
      color: 'text-cyan-400',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    },
    {
      id: 'kpi-outstanding-value',
      label: 'Outstanding Value',
      value: `${currencySymbol}${kpis.outstandingPurchaseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      description: 'Unreceived PO value',
      icon: TrendingDown,
      color: 'text-yellow-400',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            id={card.id}
            className={`p-4 rounded-xl border ${card.border} ${card.bg} text-white transition-all duration-200 hover:border-zinc-700 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400">{card.label}</span>
              <div className={`p-1.5 rounded-lg bg-zinc-800/80 ${card.color}`}>
                <Icon size={16} />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-white mb-1">
              {card.value}
            </div>
            <p className="text-[11px] text-zinc-500 line-clamp-1">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
};
