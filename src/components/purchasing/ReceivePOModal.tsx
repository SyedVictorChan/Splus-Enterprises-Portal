import React, { useState } from 'react';
import {
  X,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
  Boxes
} from 'lucide-react';
import { PurchaseOrder } from '../../types/purchasing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder | null;
  onReceive: (
    poId: string,
    receivedItems: { sku: string; quantityReceived: number }[],
    receivedBy: string,
    notes?: string
  ) => Promise<void>;
  currentUser?: string;
}

export const ReceivePOModal: React.FC<Props> = ({
  isOpen,
  onClose,
  po,
  onReceive,
  currentUser = 'Warehouse Team'
}) => {
  if (!isOpen || !po) return null;

  // Initialize input quantities with remaining needed
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    po.items.forEach(item => {
      const remaining = Math.max(0, item.quantity - (item.quantityReceived || 0));
      initial[item.sku] = remaining; // default to receiving the rest
    });
    return initial;
  });

  const [receivedBy, setReceivedBy] = useState(currentUser);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQtyChange = (sku: string, val: number, maxAllowed: number) => {
    const validVal = Math.min(Math.max(0, val), maxAllowed);
    setQuantities(prev => ({
      ...prev,
      [sku]: validVal
    }));
  };

  const totalReceivingNow: number = (Object.values(quantities) as number[]).reduce((acc: number, q: number) => acc + (q || 0), 0);
  const totalRemainingBefore = po.items.reduce(
    (acc, i) => acc + Math.max(0, i.quantity - (i.quantityReceived || 0)),
    0
  );

  const willBeFullyReceived = totalReceivingNow === totalRemainingBefore && totalRemainingBefore > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (totalReceivingNow <= 0) {
      setError('Please specify at least 1 unit to receive.');
      return;
    }

    const receiptPayload = po.items
      .map(item => ({
        sku: item.sku,
        quantityReceived: quantities[item.sku] || 0
      }))
      .filter(item => item.quantityReceived > 0);

    setIsSubmitting(true);
    try {
      await onReceive(po.id, receiptPayload, receivedBy, notes);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record intake receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="receive-po-modal"
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <PackageCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Receive Goods Intake</h2>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-zinc-800 text-zinc-300">
                  {po.poNumber}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Supplier: <span className="text-white font-medium">{po.supplierName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Status summary banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <Boxes size={16} className="text-zinc-400" />
              <span className="text-zinc-400">Total Ordered:</span>
              <span className="font-semibold text-white">{po.totalQuantity} units</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Previously Received:</span>
              <span className="font-semibold text-emerald-400">{po.totalReceivedQuantity || 0} units</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Remaining to Receive:</span>
              <span className="font-semibold text-amber-400">{totalRemainingBefore} units</span>
            </div>
          </div>

          {/* Items Receiving Table */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
            <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center text-xs">
              <span className="font-medium text-zinc-200">Line Items Intake Verification</span>
              <button
                type="button"
                onClick={() => {
                  const maxAll: Record<string, number> = {};
                  po.items.forEach(i => {
                    maxAll[i.sku] = Math.max(0, i.quantity - (i.quantityReceived || 0));
                  });
                  setQuantities(maxAll);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Receive All Remaining
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2.5">SKU</th>
                    <th className="px-3 py-2.5">Product Title</th>
                    <th className="px-3 py-2.5 text-center">Ordered</th>
                    <th className="px-3 py-2.5 text-center">Prev. Received</th>
                    <th className="px-3 py-2.5 text-center">Balance Due</th>
                    <th className="px-3 py-2.5 text-right w-32">Receiving Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {po.items.map(item => {
                    const prevRec = item.quantityReceived || 0;
                    const maxAllowed = Math.max(0, item.quantity - prevRec);
                    const currentVal = quantities[item.sku] ?? maxAllowed;

                    return (
                      <tr key={item.id} className="hover:bg-zinc-900/30">
                        <td className="px-3 py-2.5 font-mono text-zinc-300">{item.sku}</td>
                        <td className="px-3 py-2.5 font-medium text-white">{item.productName}</td>
                        <td className="px-3 py-2.5 text-center text-zinc-400">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-400">{prevRec}</td>
                        <td className="px-3 py-2.5 text-center font-medium text-amber-400">
                          {maxAllowed}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            max={maxAllowed}
                            disabled={maxAllowed === 0}
                            value={currentVal}
                            onChange={e => handleQtyChange(item.sku, parseInt(e.target.value) || 0, maxAllowed)}
                            className="w-24 px-2.5 py-1 text-xs bg-zinc-950 border border-zinc-800 rounded text-right font-medium text-white focus:outline-none focus:border-zinc-600 disabled:opacity-40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Intake meta fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Received By Personnel *</label>
              <input
                type="text"
                value={receivedBy}
                onChange={e => setReceivedBy(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Delivery / Inspection Notes</label>
              <input
                type="text"
                placeholder="Bill of lading, seal verification, carrier note..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          {/* Outcome Indicator */}
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            willBeFullyReceived
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <CheckCircle2 size={16} className="shrink-0" />
            <span>
              {willBeFullyReceived
                ? 'All ordered units accounted for. PO status will be marked as [Received].'
                : `Partial delivery of ${totalReceivingNow} units. PO status will update to [Partially Received].`}
            </span>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || totalReceivingNow <= 0}
            className="flex items-center gap-2 px-5 py-2 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg font-semibold shadow transition-all disabled:opacity-50"
          >
            <PackageCheck size={14} />
            <span>{isSubmitting ? 'Recording Intake...' : `Receive ${totalReceivingNow} Units`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
