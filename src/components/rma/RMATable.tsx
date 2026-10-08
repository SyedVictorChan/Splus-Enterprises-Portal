import React, { useState, useMemo } from 'react';
import {
  Eye,
  Edit3,
  SearchCheck,
  CheckCircle2,
  DollarSign,
  Truck,
  MessageSquare,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Columns3,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { RMAItem, RMAStatus } from '../../types/rma';
import {
  RMA_STATUS_CONFIG,
  STANDARD_RETURN_REASONS,
  RMAService
} from '../../services/rmaService';

interface RMATableProps {
  rmas: RMAItem[];
  onViewRMA: (rma: RMAItem) => void;
  onUpdateStatus: (rma: RMAItem) => void;
  onInspect: (rma: RMAItem) => void;
  onProcessResolution: (rma: RMAItem) => void;
  onAddNote: (rma: RMAItem) => void;
}

type SortField =
  | 'rmaNumber'
  | 'orderNumber'
  | 'createdAt'
  | 'customer'
  | 'product'
  | 'quantity'
  | 'status'
  | 'refundAmount';

export const RMATable: React.FC<RMATableProps> = ({
  rmas,
  onViewRMA,
  onUpdateStatus,
  onInspect,
  onProcessResolution,
  onAddNote
}) => {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    rmaNumber: true,
    orderNumber: true,
    date: true,
    customer: true,
    marketplace: true,
    store: true,
    product: true,
    sku: true,
    quantity: true,
    reason: true,
    status: true,
    inspection: true,
    resolution: true,
    refundAmount: true,
    replacementStatus: true,
    actions: true
  });
  const [showColMenu, setShowColMenu] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedData = useMemo(() => {
    const list = [...rmas];
    list.sort((a, b) => {
      let aVal: any = a[sortField as keyof RMAItem];
      let bVal: any = b[sortField as keyof RMAItem];

      if (sortField === 'refundAmount') {
        aVal = a.refund?.refundAmount || 0;
        bVal = b.refund?.refundAmount || 0;
      }

      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    return list;
  }, [rmas, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">RMA Cases</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            {rmas.length} records
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Column Visibility */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg transition-colors"
            >
              <Columns3 size={14} />
              <span className="hidden sm:inline">Columns</span>
            </button>
            {showColMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-2 z-30 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 py-1 block">Toggle Columns</span>
                {Object.keys(visibleColumns).map(key => (
                  <label key={key} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="rounded border-zinc-700 text-sky-500 focus:ring-0"
                    />
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            onClick={() => RMAService.exportToCSV(rmas)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg transition-colors"
            title="Export CSV"
          >
            <Download size={14} />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={() => RMAService.exportToExcel(rmas)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 rounded-lg transition-colors"
            title="Export Excel"
          >
            <FileSpreadsheet size={14} />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      {/* Table Scroller */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {visibleColumns.rmaNumber && (
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('rmaNumber')}>
                  <div className="flex items-center gap-1">
                    <span>RMA Number</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.orderNumber && (
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('orderNumber')}>
                  <div className="flex items-center gap-1">
                    <span>Order #</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.date && (
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.customer && (
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.marketplace && <th className="px-4 py-3">Marketplace</th>}
              {visibleColumns.store && <th className="px-4 py-3">Store</th>}
              {visibleColumns.product && (
                <th className="px-4 py-3 cursor-pointer select-none min-w-[200px]" onClick={() => handleSort('product')}>
                  <div className="flex items-center gap-1">
                    <span>Product / SKU</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.quantity && (
                <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => handleSort('quantity')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Qty</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.reason && <th className="px-4 py-3">Return Reason</th>}
              {visibleColumns.status && (
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1">
                    <span>RMA Status</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.inspection && <th className="px-4 py-3">Inspection</th>}
              {visibleColumns.resolution && <th className="px-4 py-3">Resolution</th>}
              {visibleColumns.refundAmount && (
                <th className="px-4 py-3 cursor-pointer select-none text-right" onClick={() => handleSort('refundAmount')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Refund</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
              )}
              {visibleColumns.replacementStatus && <th className="px-4 py-3">Replacement</th>}
              {visibleColumns.actions && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 text-xs text-zinc-300">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-4 py-12 text-center text-zinc-400">
                  {rmas.length === 0 ? 'No data available.' : 'No RMA records found matching the current filters.'}
                </td>
              </tr>
            ) : (
              paginatedData.map(rma => {
                const statusCfg = RMA_STATUS_CONFIG[rma.status] || {
                  label: rma.status,
                  color: 'text-zinc-400',
                  bg: 'bg-zinc-800',
                  border: 'border-zinc-700'
                };
                const reasonLabel =
                  STANDARD_RETURN_REASONS.find(sr => sr.value === rma.reason)?.label || rma.reason;

                return (
                  <tr key={rma.id} className="hover:bg-zinc-850/50 transition-colors group">
                    {visibleColumns.rmaNumber && (
                      <td className="px-4 py-3 font-mono font-medium text-sky-400 whitespace-nowrap">
                        <button
                          onClick={() => onViewRMA(rma)}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          {rma.rmaNumber}
                        </button>
                      </td>
                    )}

                    {visibleColumns.orderNumber && (
                      <td className="px-4 py-3 font-mono text-zinc-400 whitespace-nowrap">
                        {rma.orderNumber}
                      </td>
                    )}

                    {visibleColumns.date && (
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                        {rma.createdAt.split('T')[0]}
                      </td>
                    )}

                    {visibleColumns.customer && (
                      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                        <div>{rma.customer}</div>
                        {rma.customerEmail && (
                          <div className="text-[10px] text-zinc-400">{rma.customerEmail}</div>
                        )}
                      </td>
                    )}

                    {visibleColumns.marketplace && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px] font-medium border border-zinc-700/60">
                          {rma.marketplace}
                        </span>
                      </td>
                    )}

                    {visibleColumns.store && (
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                        {rma.store}
                      </td>
                    )}

                    {visibleColumns.product && (
                      <td className="px-4 py-3">
                        <div className="text-zinc-200 line-clamp-1 font-medium">{rma.product}</div>
                        <div className="text-[10px] font-mono text-zinc-400">{rma.sku}</div>
                      </td>
                    )}

                    {visibleColumns.quantity && (
                      <td className="px-4 py-3 text-center font-mono font-semibold text-white">
                        {rma.quantity}
                      </td>
                    )}

                    {visibleColumns.reason && (
                      <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                        {reasonLabel}
                      </td>
                    )}

                    {visibleColumns.status && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                    )}

                    {visibleColumns.inspection && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rma.inspection?.result ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              rma.inspection.result === 'approved'
                                ? 'text-emerald-400'
                                : rma.inspection.result === 'rejected'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            <span className="capitalize">{rma.inspection.result.replace(/_/g, ' ')}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400 italic">Pending</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.resolution && (
                      <td className="px-4 py-3 capitalize whitespace-nowrap text-zinc-300 font-medium">
                        {rma.returnType.replace(/_/g, ' ')}
                      </td>
                    )}

                    {visibleColumns.refundAmount && (
                      <td className="px-4 py-3 text-right whitespace-nowrap font-mono">
                        {rma.refund ? (
                          <span
                            className={
                              rma.refund.refundStatus === 'completed'
                                ? 'text-emerald-400 font-medium'
                                : 'text-amber-400'
                            }
                          >
                            ${rma.refund.refundAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.replacementStatus && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rma.replacement ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium capitalize bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {rma.replacement.replacementStatus}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.actions && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Detail */}
                          <button
                            onClick={() => onViewRMA(rma)}
                            title="View Full RMA Case"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Quick Status Update */}
                          <button
                            onClick={() => onUpdateStatus(rma)}
                            title="Update Status"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 transition-colors"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Inspection */}
                          <button
                            onClick={() => onInspect(rma)}
                            title="Record Inspection"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-cyan-400 transition-colors"
                          >
                            <SearchCheck size={15} />
                          </button>

                          {/* Process Resolution */}
                          <button
                            onClick={() => onProcessResolution(rma)}
                            title="Process Resolution (Refund / Replacement / Exchange)"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                          >
                            <DollarSign size={15} />
                          </button>

                          {/* Add Note */}
                          <button
                            onClick={() => onAddNote(rma)}
                            title="Add Note"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
                          >
                            <MessageSquare size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-zinc-950 border border-zinc-700/80 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="ml-2">
            Showing {paginatedData.length ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 py-1 font-mono text-zinc-300">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 text-white transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
