import React from 'react';
import {
  RotateCcw,
  Clock,
  SearchCheck,
  CheckCircle2,
  XCircle,
  Archive,
  DollarSign,
  Truck,
  TrendingDown,
  Percent
} from 'lucide-react';
import { RMAKpiSummary } from '../../types/rma';

interface RMAKPIsProps {
  kpis: RMAKpiSummary;
  onFilterByStatus?: (status: string) => void;
}

export const RMAKPIs: React.FC<RMAKPIsProps> = ({ kpis, onFilterByStatus }) => {
  const cards = [
    {
      id: 'total',
      title: 'Total RMAs',
      value: kpis.totalRmas,
      icon: RotateCcw,
      accent: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      subtitle: `${kpis.totalReturnedUnits} total units returned`,
      statusFilter: 'all'
    },
    {
      id: 'open',
      title: 'Open RMAs',
      value: kpis.openRmas,
      icon: Clock,
      accent: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      subtitle: 'Currently in workflow',
      statusFilter: 'open'
    },
    {
      id: 'pending_inspection',
      title: 'Pending Inspection',
      value: kpis.pendingInspection,
      icon: SearchCheck,
      accent: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      subtitle: 'Awaiting technician evaluation',
      statusFilter: 'pending_inspection'
    },
    {
      id: 'approved',
      title: 'Approved RMAs',
      value: kpis.approvedRmas,
      icon: CheckCircle2,
      accent: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      subtitle: 'Authorized for return/resolution',
      statusFilter: 'approved'
    },
    {
      id: 'rejected',
      title: 'Rejected RMAs',
      value: kpis.rejectedRmas,
      icon: XCircle,
      accent: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      subtitle: 'Declined after review',
      statusFilter: 'rejected'
    },
    {
      id: 'completed',
      title: 'Completed RMAs',
      value: kpis.completedRmas,
      icon: Archive,
      accent: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      subtitle: 'Fully settled & closed',
      statusFilter: 'completed'
    },
    {
      id: 'pending_refund',
      title: 'Pending Refund',
      value: kpis.pendingRefund,
      icon: DollarSign,
      accent: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      subtitle: `$${kpis.pendingRefundAmount.toFixed(2)} outstanding`,
      statusFilter: 'refund_pending'
    },
    {
      id: 'pending_replacement',
      title: 'Pending Replacement',
      value: kpis.pendingReplacement,
      icon: Truck,
      accent: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      subtitle: 'Waiting for reshipment',
      statusFilter: 'replacement_pending'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Return Rate & Financial Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Return Rate (Units)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white font-mono">
                {kpis.returnRate !== null ? `${kpis.returnRate}%` : 'N/A'}
              </span>
              <span className="text-xs text-zinc-400">of total sold units</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">RMA Case Rate</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white font-mono">
                {kpis.rmaRate !== null ? `${kpis.rmaRate}%` : 'N/A'}
              </span>
              <span className="text-xs text-zinc-400">of total sales orders</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Percent size={20} />
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Refunds Volume</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-400 font-mono">
                ${kpis.totalRefundAmount.toFixed(2)}
              </span>
              <span className="text-xs text-zinc-400">(${kpis.completedRefundAmount.toFixed(2)} completed)</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* 8 Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onFilterByStatus && onFilterByStatus(card.statusFilter)}
              className="text-left bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 transition-all rounded-xl p-4 flex flex-col justify-between group focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              <div className="flex items-start justify-between w-full mb-2">
                <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-300">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg ${card.bg} ${card.accent} border ${card.border}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-mono tracking-tight">
                  {card.value}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1 truncate">
                  {card.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
