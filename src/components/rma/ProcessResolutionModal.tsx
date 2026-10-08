import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Truck,
  RotateCcw,
  Wrench,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { RMAItem, ReturnType } from '../../types/rma';
import { RMAService } from '../../services/rmaService';

interface ProcessResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rma: RMAItem;
  onResolutionSaved: (updatedRma: RMAItem) => void;
  currentUser?: string;
}

export const ProcessResolutionModal: React.FC<ProcessResolutionModalProps> = ({
  isOpen,
  onClose,
  rma,
  onResolutionSaved,
  currentUser = 'Authorized Agent'
}) => {
  const [resolutionType, setResolutionType] = useState<ReturnType>(rma.returnType || 'refund');

  // Refund State
  const [refundAmount, setRefundAmount] = useState<number>(
    rma.refund?.refundAmount ?? (rma.originalSalePrice ? rma.originalSalePrice * rma.quantity : 0)
  );
  const [refundMethod, setRefundMethod] = useState<'original_payment' | 'bank_transfer' | 'store_credit' | 'cash' | 'other'>(
    rma.refund?.refundMethod || 'original_payment'
  );
  const [refundReference, setRefundReference] = useState(rma.refund?.refundReference || '');
  const [refundDate, setRefundDate] = useState(rma.refund?.refundDate || new Date().toISOString().split('T')[0]);
  const [refundStatus, setRefundStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>(
    rma.refund?.refundStatus || 'pending'
  );

  // Replacement State
  const [replacementSku, setReplacementSku] = useState(rma.replacement?.replacementSku || rma.sku);
  const [replacementQuantity, setReplacementQuantity] = useState<number>(rma.replacement?.replacementQuantity || rma.quantity);
  const [replacementCarrier, setReplacementCarrier] = useState(rma.replacement?.shippingCarrier || 'FedEx Express');
  const [replacementTracking, setReplacementTracking] = useState(rma.replacement?.trackingNumber || '');
  const [replacementStatus, setReplacementStatus] = useState<'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'>(
    rma.replacement?.replacementStatus || 'pending'
  );

  // Exchange State
  const [exchangeProduct, setExchangeProduct] = useState(rma.exchange?.replacementProduct || rma.product);
  const [exchangeQty, setExchangeQty] = useState(rma.exchange?.quantity || rma.quantity);

  // Repair State
  const [repairRequired, setRepairRequired] = useState(rma.repair?.repairRequired || 'Mainboard component rework');
  const [repairVendor, setRepairVendor] = useState(rma.repair?.repairVendor || 'TechFix Micro-Soldering Lab');
  const [repairCost, setRepairCost] = useState(rma.repair?.repairCost || 25);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let updated: RMAItem | null = null;

      if (resolutionType === 'refund') {
        updated = await RMAService.processRefund(
          rma.id,
          {
            refundAmount: Number(refundAmount) || 0,
            refundMethod,
            refundReference: refundReference.trim() || undefined,
            refundDate,
            refundStatus
          },
          currentUser
        );
      } else if (resolutionType === 'replacement') {
        updated = await RMAService.processReplacement(
          rma.id,
          {
            replacementSku: replacementSku.trim(),
            replacementProduct: rma.product,
            replacementQuantity: Number(replacementQuantity) || 1,
            shippingCarrier: replacementCarrier.trim() || undefined,
            trackingNumber: replacementTracking.trim() || undefined,
            replacementStatus
          },
          currentUser
        );
      } else {
        // Exchange / Repair / Other
        const now = new Date();
        const timelineEvent = {
          id: `t_${Date.now()}`,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0],
          user: currentUser,
          action: `Resolution Agreement: ${resolutionType.toUpperCase()}`,
          notes: resolutionType === 'exchange' ? `Exchanging for ${exchangeQty}x ${exchangeProduct}` : `Repair with ${repairVendor} ($${repairCost})`
        };

        const resolvedRMA = {
          ...rma,
          returnType: resolutionType,
          exchange: resolutionType === 'exchange' ? {
            originalProduct: rma.product,
            replacementProduct: exchangeProduct,
            quantity: exchangeQty,
            exchangeStatus: 'pending' as const
          } : rma.exchange,
          repair: resolutionType === 'repair' ? {
            repairRequired,
            repairVendor,
            repairCost: Number(repairCost) || 0,
            repairStatus: 'pending' as const
          } : rma.repair,
          timeline: [...rma.timeline, timelineEvent]
        };

        updated = await RMAService.saveRMA(resolvedRMA);
      }

      if (updated) {
        onResolutionSaved(updated);
      }
      onClose();
    } catch (err) {
      console.warn('Failed to process resolution:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Process RMA Resolution</h2>
              <p className="text-xs text-zinc-400">
                Case {rma.rmaNumber} • {rma.customer}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Resolution Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">Resolution Type</label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setResolutionType('refund')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  resolutionType === 'refund'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <DollarSign className="mx-auto mb-1" size={16} />
                <span className="text-[11px] block">Refund</span>
              </button>

              <button
                type="button"
                onClick={() => setResolutionType('replacement')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  resolutionType === 'replacement'
                    ? 'bg-violet-500/10 border-violet-500 text-violet-400 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Truck className="mx-auto mb-1" size={16} />
                <span className="text-[11px] block">Replacement</span>
              </button>

              <button
                type="button"
                onClick={() => setResolutionType('exchange')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  resolutionType === 'exchange'
                    ? 'bg-sky-500/10 border-sky-500 text-sky-400 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <RotateCcw className="mx-auto mb-1" size={16} />
                <span className="text-[11px] block">Exchange</span>
              </button>

              <button
                type="button"
                onClick={() => setResolutionType('repair')}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  resolutionType === 'repair'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <Wrench className="mx-auto mb-1" size={16} />
                <span className="text-[11px] block">Repair</span>
              </button>
            </div>
          </div>

          {/* Refund Resolution Form */}
          {resolutionType === 'refund' && (
            <div className="space-y-3 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Refund Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Refund Method</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 capitalize"
                  >
                    <option value="original_payment">Original Payment Gateway</option>
                    <option value="bank_transfer">Bank Wire Transfer</option>
                    <option value="store_credit">Store Credit Voucher</option>
                    <option value="cash">Cash / Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Reference / Transaction ID</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-991024-DARAZ"
                    value={refundReference}
                    onChange={(e) => setRefundReference(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Refund Status</label>
                  <select
                    value={refundStatus}
                    onChange={(e) => setRefundStatus(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 capitalize"
                  >
                    <option value="pending">Pending Approval</option>
                    <option value="processing">Processing with Bank</option>
                    <option value="completed">Completed & Disbursed</option>
                    <option value="failed">Failed / Rejected</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Replacement Resolution Form */}
          {resolutionType === 'replacement' && (
            <div className="space-y-3 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Replacement SKU</label>
                  <input
                    type="text"
                    required
                    value={replacementSku}
                    onChange={(e) => setReplacementSku(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={replacementQuantity}
                    onChange={(e) => setReplacementQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Courier / Carrier</label>
                  <input
                    type="text"
                    placeholder="e.g. FedEx Express, DHL, UPS"
                    value={replacementCarrier}
                    onChange={(e) => setReplacementCarrier(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Shipment Tracking #</label>
                  <input
                    type="text"
                    placeholder="Tracking number"
                    value={replacementTracking}
                    onChange={(e) => setReplacementTracking(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Replacement Order Status</label>
                <select
                  value={replacementStatus}
                  onChange={(e) => setReplacementStatus(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 capitalize"
                >
                  <option value="pending">Pending Warehouse Packing</option>
                  <option value="processing">Processing in Fulfillment</option>
                  <option value="shipped">Shipped with Tracking</option>
                  <option value="delivered">Delivered to Customer</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          )}

          {/* Exchange Form */}
          {resolutionType === 'exchange' && (
            <div className="space-y-3 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Exchange Replacement Product</label>
                <input
                  type="text"
                  value={exchangeProduct}
                  onChange={(e) => setExchangeProduct(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          {/* Repair Form */}
          {resolutionType === 'repair' && (
            <div className="space-y-3 p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Repair Task Description</label>
                <input
                  type="text"
                  value={repairRequired}
                  onChange={(e) => setRepairRequired(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Repair Vendor</label>
                  <input
                    type="text"
                    value={repairVendor}
                    onChange={(e) => setRepairVendor(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Repair Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={repairCost}
                    onChange={(e) => setRepairCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 size={14} />
              <span>{isSubmitting ? 'Processing...' : 'Apply Resolution'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
