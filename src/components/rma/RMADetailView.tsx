import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  User,
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  SearchCheck,
  DollarSign,
  Send,
  Printer,
  Edit3,
  Layers,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { RMAItem, RMAStatus } from '../../types/rma';
import {
  RMA_STATUS_CONFIG,
  STANDARD_RETURN_REASONS,
  RMAService
} from '../../services/rmaService';

interface RMADetailViewProps {
  rma: RMAItem;
  onBack: () => void;
  onUpdateStatus: (rma: RMAItem) => void;
  onInspect: (rma: RMAItem) => void;
  onProcessResolution: (rma: RMAItem) => void;
  currentUser?: string;
}

export const RMADetailView: React.FC<RMADetailViewProps> = ({
  rma,
  onBack,
  onUpdateStatus,
  onInspect,
  onProcessResolution,
  currentUser = 'Authorized Agent'
}) => {
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [restockedFeedback, setRestockedFeedback] = useState<string | null>(null);

  const statusCfg = RMA_STATUS_CONFIG[rma.status] || {
    label: rma.status,
    color: 'text-zinc-400',
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    step: 0
  };

  const reasonLabel =
    STANDARD_RETURN_REASONS.find(sr => sr.value === rma.reason)?.label || rma.reason;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmittingNote(true);
    try {
      await RMAService.addNote(rma.id, newNote.trim(), currentUser);
      setNewNote('');
    } catch (err) {
      console.warn('Failed to save note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleRestockUnits = async () => {
    if (!rma.inspection || !rma.inspection.sellableUnits) return;
    const units = rma.inspection.sellableUnits;

    try {
      const updatedInspection = {
        ...rma.inspection,
        restocked: true,
        restockedAt: new Date().toISOString(),
        restockedBy: currentUser
      };

      await RMAService.recordInspection(rma.id, updatedInspection, currentUser, rma.status);
      setRestockedFeedback(`Successfully restocked ${units} sellable units of ${rma.sku}!`);
      setTimeout(() => setRestockedFeedback(null), 4000);
    } catch (err) {
      console.warn('Restock action error:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white font-mono">{rma.rmaNumber}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}
              >
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Order {rma.orderNumber} • Registered on {rma.createdAt.split('T')[0]} by {rma.createdBy}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
          >
            <Printer size={14} />
            <span>Print RMA Slip</span>
          </button>

          <button
            onClick={() => onUpdateStatus(rma)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition-colors"
          >
            <Edit3 size={14} />
            <span>Update Status</span>
          </button>

          <button
            onClick={() => onInspect(rma)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
          >
            <SearchCheck size={14} />
            <span>{rma.inspection?.result ? 'Review Inspection' : 'Start Inspection'}</span>
          </button>

          <button
            onClick={() => onProcessResolution(rma)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm"
          >
            <DollarSign size={14} />
            <span>Process Resolution</span>
          </button>
        </div>
      </div>

      {restockedFeedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
          <Sparkles size={16} />
          <span>{restockedFeedback}</span>
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Core Information Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Product & Order Information */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              <ShoppingBag size={15} />
              <span>Product & Purchase Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] text-zinc-400">Product Name</span>
                <p className="text-sm font-medium text-white">{rma.product}</p>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">SKU: {rma.sku}</p>
              </div>

              <div>
                <span className="text-[11px] text-zinc-400">Return Quantity</span>
                <p className="text-sm font-semibold text-white font-mono">{rma.quantity} unit(s)</p>
                {rma.originalSalePrice && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Original Price: ${rma.originalSalePrice.toFixed(2)}
                    {rma.originalCost ? ` (Cost: $${rma.originalCost.toFixed(2)})` : ''}
                  </p>
                )}
              </div>

              <div>
                <span className="text-[11px] text-zinc-400">Marketplace & Store</span>
                <p className="text-sm font-medium text-white">{rma.marketplace}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{rma.store}</p>
              </div>

              <div>
                <span className="text-[11px] text-zinc-400">Order ID & Date</span>
                <p className="text-sm font-mono font-medium text-sky-400">{rma.orderNumber}</p>
                <p className="text-xs text-zinc-400 mt-0.5">Ordered: {rma.orderDate || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Return Reason & Customer Note */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              <RotateCcw size={15} />
              <span>Return Information & Customer Request</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-[11px] text-zinc-400">Primary Reason</span>
                <p className="text-sm font-medium text-white">{reasonLabel}</p>
              </div>

              <div>
                <span className="text-[11px] text-zinc-400">Requested Return Type</span>
                <p className="text-sm font-medium text-amber-400 capitalize">{rma.returnType}</p>
              </div>

              <div>
                <span className="text-[11px] text-zinc-400">Customer Contact</span>
                <p className="text-sm font-medium text-white">{rma.customer}</p>
                <p className="text-xs text-zinc-400 truncate">{rma.customerEmail || rma.customerPhone || 'Direct'}</p>
              </div>
            </div>

            {rma.customerNotes && (
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800/80">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Customer Comments</span>
                <p className="text-xs text-zinc-300 italic">"{rma.customerNotes}"</p>
              </div>
            )}

            {/* Shipping Info */}
            <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] text-zinc-400">Return Carrier</span>
                <p className="text-xs font-medium text-white">{rma.returnShippingCarrier || 'Pending carrier assignment'}</p>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400">Tracking Number</span>
                <p className="text-xs font-mono font-medium text-sky-400">{rma.returnTrackingNumber || 'No tracking provided'}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Inspection Details & Inventory Restock */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <SearchCheck size={15} />
                <span>Warehouse Inspection Evaluation</span>
              </div>
              {rma.inspection?.result && (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                    rma.inspection.result === 'approved'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : rma.inspection.result === 'rejected'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {rma.inspection.result.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {rma.inspection ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-zinc-400 block">Condition</span>
                    <span className="font-medium text-white capitalize">{rma.inspection.productCondition || 'Unspecified'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block">Packaging</span>
                    <span className="font-medium text-white capitalize">{rma.inspection.packagingCondition || 'Intact'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block">Accessories</span>
                    <span className="font-medium text-white capitalize">{rma.inspection.accessoriesIncluded || 'Yes'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block">Inspected By</span>
                    <span className="font-medium text-zinc-300">{rma.inspection.inspectedBy || 'Warehouse Team'}</span>
                  </div>
                </div>

                {rma.inspection.inspectionNotes && (
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Inspector Notes</span>
                    <p className="text-xs text-zinc-300">{rma.inspection.inspectionNotes}</p>
                  </div>
                )}

                {/* Condition Breakdown & Restock Action (Section 28 Inventory Connection) */}
                <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">Inventory Condition Breakdown</span>
                    <span className="text-[11px] text-zinc-400">Total: {rma.quantity} unit(s)</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] uppercase font-semibold text-emerald-400 block">Potential Restock</span>
                      <span className="text-lg font-bold font-mono text-emerald-300">
                        {rma.inspection.sellableUnits ?? 0}
                      </span>
                      <span className="text-[10px] text-zinc-400 block">Sellable</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-[10px] uppercase font-semibold text-amber-400 block">Damaged</span>
                      <span className="text-lg font-bold font-mono text-amber-300">
                        {rma.inspection.damagedUnits ?? 0}
                      </span>
                      <span className="text-[10px] text-zinc-400 block">Refurbishable</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <span className="text-[10px] uppercase font-semibold text-rose-400 block">Unsellable</span>
                      <span className="text-lg font-bold font-mono text-rose-300">
                        {rma.inspection.unsellableUnits ?? 0}
                      </span>
                      <span className="text-[10px] text-zinc-400 block">Scrap / Vendor</span>
                    </div>
                  </div>

                  {/* Restock action */}
                  {(rma.inspection.sellableUnits ?? 0) > 0 && (
                    <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                      <div className="text-[11px] text-zinc-400">
                        {rma.inspection.restocked ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={13} />
                            <span>Restocked on {rma.inspection.restockedAt?.split('T')[0]}</span>
                          </span>
                        ) : (
                          <span>Eligible for automatic sellable inventory restock</span>
                        )}
                      </div>
                      {!rma.inspection.restocked && (
                        <button
                          onClick={handleRestockUnits}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Package size={13} />
                          <span>Restock Returned Items</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-zinc-400 space-y-2">
                <p>Physical inspection not yet recorded for this returned item.</p>
                <button
                  onClick={() => onInspect(rma)}
                  className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <SearchCheck size={14} />
                  <span>Start Inspection Now</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 4: Resolution Outcome */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              <DollarSign size={15} />
              <span>Resolution & Settlement Details</span>
            </div>

            {rma.refund && (
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Refund Details</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                    rma.refund.refundStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {rma.refund.refundStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Refund Amount</span>
                    <span className="font-mono font-bold text-white">${rma.refund.refundAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Method</span>
                    <span className="text-zinc-200 capitalize">{rma.refund.refundMethod.replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Date</span>
                    <span className="text-zinc-200">{rma.refund.refundDate || 'Pending'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Reference</span>
                    <span className="font-mono text-zinc-400 truncate block">{rma.refund.refundReference || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {rma.replacement && (
              <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Replacement Order</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-violet-500/10 text-violet-400">
                    {rma.replacement.replacementStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Replacement SKU</span>
                    <span className="font-mono text-white font-medium">{rma.replacement.replacementSku}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Qty</span>
                    <span className="font-mono text-white">{rma.replacement.replacementQuantity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Carrier</span>
                    <span className="text-zinc-200">{rma.replacement.shippingCarrier || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Tracking</span>
                    <span className="font-mono text-sky-400">{rma.replacement.trackingNumber || 'Pending'}</span>
                  </div>
                </div>
              </div>
            )}

            {!rma.refund && !rma.replacement && !rma.exchange && (
              <div className="text-center py-4 text-xs text-zinc-400">
                <span>No resolution processed yet. </span>
                <button
                  onClick={() => onProcessResolution(rma)}
                  className="text-emerald-400 font-medium hover:underline ml-1"
                >
                  Process Resolution Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline & Internal Notes */}
        <div className="space-y-6">
          {/* Chronological Timeline */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-2">
              <Clock size={15} />
              <span>Audit Timeline</span>
            </div>

            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
              {rma.timeline && rma.timeline.length > 0 ? (
                rma.timeline.map((event, idx) => (
                  <div key={event.id || idx} className="relative text-xs">
                    <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-sky-500 ring-4 ring-zinc-900" />
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{event.date} • {event.time}</span>
                      <span className="text-zinc-400">{event.user}</span>
                    </div>
                    <p className="font-semibold text-white mt-0.5">{event.action}</p>
                    {event.notes && (
                      <p className="text-zinc-400 mt-1 text-[11px] bg-zinc-950 p-2 rounded border border-zinc-850">
                        {event.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400">No timeline entries.</p>
              )}
            </div>
          </div>

          {/* Internal Notes & Comments */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Internal Notes</span>
              <span className="text-[10px] text-zinc-400">Private to Splus Team</span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {rma.notesList && rma.notesList.length > 0 ? (
                rma.notesList.map(note => (
                  <div key={note.id} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                      <span className="font-medium text-zinc-300">{note.user}</span>
                      <span>{note.date} {note.time}</span>
                    </div>
                    <p className="text-zinc-200">{note.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 italic">No notes recorded yet.</p>
              )}
            </div>

            {/* Note form */}
            <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t border-zinc-800">
              <textarea
                rows={2}
                placeholder="Add internal comment..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg p-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingNote || !newNote.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Send size={12} />
                  <span>Post Note</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
