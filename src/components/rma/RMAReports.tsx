import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  Calendar,
  Building2,
  HelpCircle
} from 'lucide-react';
import { RMAItem } from '../../types/rma';
import { SalesRecord } from '../../types';
import { RMAService, STANDARD_RETURN_REASONS } from '../../services/rmaService';

interface RMAReportsProps {
  rmas: RMAItem[];
  salesRecords?: SalesRecord[];
}

type ReportType =
  | 'summary'
  | 'financial'
  | 'reasons'
  | 'products'
  | 'vendors';

export const RMAReports: React.FC<RMAReportsProps> = ({
  rmas,
  salesRecords = []
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('summary');

  // Financial Impact Calculations
  const financialMetrics = useMemo(() => {
    let totalRefunds = 0;
    let replacementCostEstimate = 0;
    let restockedValueEstimate = 0;
    let scrapUnits = 0;

    rmas.forEach(r => {
      if (r.refund) {
        totalRefunds += r.refund.refundAmount || 0;
      }
      if (r.replacement) {
        // Estimated replacement unit cost
        const unitCost = r.originalCost || 20;
        replacementCostEstimate += unitCost * (r.replacement.replacementQuantity || 1);
      }
      if (r.inspection) {
        if (r.inspection.sellableUnits) {
          const unitPrice = r.originalSalePrice || 40;
          restockedValueEstimate += unitPrice * r.inspection.sellableUnits;
        }
        if (r.inspection.unsellableUnits) {
          scrapUnits += r.inspection.unsellableUnits;
        }
      }
    });

    const netLoss = totalRefunds + replacementCostEstimate - restockedValueEstimate;

    return {
      totalRefunds,
      replacementCostEstimate,
      restockedValueEstimate,
      scrapUnits,
      netLoss: Math.max(0, netLoss)
    };
  }, [rmas]);

  // Reason Distribution Table Data
  const reasonBreakdown = useMemo(() => {
    const map: Record<string, { label: string; count: number; units: number; refunds: number }> = {};

    rmas.forEach(r => {
      const reasonObj = STANDARD_RETURN_REASONS.find(sr => sr.value === r.reason);
      const label = reasonObj ? reasonObj.label : r.reason;
      if (!map[label]) {
        map[label] = { label, count: 0, units: 0, refunds: 0 };
      }
      map[label].count++;
      map[label].units += r.quantity || 1;
      if (r.refund) {
        map[label].refunds += r.refund.refundAmount || 0;
      }
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [rmas]);

  return (
    <div className="space-y-6">
      {/* Report Selector Header */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveReport('summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeReport === 'summary'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800'
            }`}
          >
            Executive Summary
          </button>

          <button
            onClick={() => setActiveReport('financial')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeReport === 'financial'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800'
            }`}
          >
            Financial Impact Report
          </button>

          <button
            onClick={() => setActiveReport('reasons')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeReport === 'reasons'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800'
            }`}
          >
            Reason Root-Cause Report
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => RMAService.exportToCSV(rmas)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg transition-colors"
          >
            <Download size={13} />
            <span>Export Report CSV</span>
          </button>
          <button
            onClick={() => RMAService.exportToExcel(rmas)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg transition-colors"
          >
            <FileSpreadsheet size={13} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Report 1: Executive Summary */}
      {activeReport === 'summary' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">RMA Operational Overview</h3>
            <p className="text-xs text-zinc-400">
              High-level overview of returns processing pipeline health and resolution turnarounds.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-[11px] text-zinc-400 block">Total RMA Cases</span>
                <span className="text-2xl font-bold font-mono text-white mt-1 block">
                  {rmas.length}
                </span>
                <span className="text-[11px] text-zinc-400 mt-1 block">All registered returns</span>
              </div>

              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-[11px] text-zinc-400 block">Open / In-Flight</span>
                <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
                  {rmas.filter(r => r.status !== 'completed' && r.status !== 'rejected').length}
                </span>
                <span className="text-[11px] text-zinc-400 mt-1 block">Requires staff attention</span>
              </div>

              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-[11px] text-zinc-400 block">Inspection Approval</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                  {rmas.length
                    ? Math.round(
                        (rmas.filter(r => r.inspection?.result === 'approved').length /
                          rmas.length) *
                          100
                      )
                    : 0}
                  %
                </span>
                <span className="text-[11px] text-zinc-400 mt-1 block">Valid return claim rate</span>
              </div>

              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                <span className="text-[11px] text-zinc-400 block">Settled / Closed</span>
                <span className="text-2xl font-bold font-mono text-sky-400 mt-1 block">
                  {rmas.filter(r => r.status === 'completed').length}
                </span>
                <span className="text-[11px] text-zinc-400 mt-1 block">Completed lifecycle</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Financial Impact Report */}
      {activeReport === 'financial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-xs text-zinc-400 block">Total Customer Refunds</span>
              <span className="text-2xl font-bold font-mono text-rose-400 block">
                ${financialMetrics.totalRefunds.toFixed(2)}
              </span>
              <span className="text-[11px] text-zinc-400 block">Direct revenue surrendered</span>
            </div>

            <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-xs text-zinc-400 block">Replacement Units Outlay</span>
              <span className="text-2xl font-bold font-mono text-violet-400 block">
                ${financialMetrics.replacementCostEstimate.toFixed(2)}
              </span>
              <span className="text-[11px] text-zinc-400 block">Cost of replacement inventory</span>
            </div>

            <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-xs text-zinc-400 block">Restocked Value Recovered</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 block">
                ${financialMetrics.restockedValueEstimate.toFixed(2)}
              </span>
              <span className="text-[11px] text-zinc-400 block">Value returned to sellable stock</span>
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Net RMA Cost Burden
            </h4>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold font-mono text-white">
                ${financialMetrics.netLoss.toFixed(2)}
              </span>
              <span className="text-xs text-zinc-400">
                (Refunds + Replacement Costs - Restocked Inventory Recovery)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Report 3: Reasons Root-Cause Report */}
      {activeReport === 'reasons' && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white">Return Reasons & Root Cause Analysis</h3>
            <p className="text-xs text-zinc-400">Frequency and cost liability broken down by reason category</p>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <th className="px-4 py-3">Return Reason Category</th>
                <th className="px-4 py-3 text-center">Incidents</th>
                <th className="px-4 py-3 text-center">Units Impacted</th>
                <th className="px-4 py-3 text-right">Refund Total</th>
                <th className="px-4 py-3 text-right">% of All Returns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {reasonBreakdown.map((item, idx) => (
                <tr key={idx} className="hover:bg-zinc-850/50">
                  <td className="px-4 py-3 font-medium text-white">{item.label}</td>
                  <td className="px-4 py-3 text-center font-mono">{item.count}</td>
                  <td className="px-4 py-3 text-center font-mono text-amber-400">{item.units}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">
                    ${item.refunds.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-400">
                    {rmas.length ? ((item.count / rmas.length) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
