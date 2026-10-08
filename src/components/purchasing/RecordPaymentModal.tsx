import React, { useState } from 'react';
import {
  X,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { PurchaseOrder, SupplierPayment } from '../../types/purchasing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder | null;
  onRecordPayment: (payment: Omit<SupplierPayment, 'id' | 'createdAt'>) => Promise<void>;
  currencySymbol?: string;
  currentUser?: string;
}

export const RecordPaymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  po,
  onRecordPayment,
  currencySymbol = '$',
  currentUser = 'Finance Lead'
}) => {
  if (!isOpen || !po) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const maxPayable = po.outstandingAmount;

  const [amount, setAmount] = useState<number>(maxPayable);
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<SupplierPayment['paymentMethod']>('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [recordedBy, setRecordedBy] = useState<string>(currentUser);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please specify a valid payment amount greater than zero.');
      return;
    }

    if (numAmount > maxPayable + 0.01) {
      setError(`Payment amount cannot exceed the outstanding balance of ${currencySymbol}${maxPayable.toFixed(2)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onRecordPayment({
        poId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        amount: Number(numAmount.toFixed(2)),
        paymentDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        recordedBy
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record supplier payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const willBeFullyPaid = Number(amount) >= maxPayable - 0.01;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="record-payment-modal"
        className="relative w-full max-w-lg flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Record Supplier Payment</h2>
              <p className="text-xs text-zinc-400">Settle invoices against active purchase orders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* PO Context Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
              <span className="text-zinc-400">Purchase Order:</span>
              <span className="font-mono font-semibold text-white">{po.poNumber}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-400">Supplier:</span>
              <span className="font-medium text-white">{po.supplierName}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-400">Contract Total:</span>
              <span className="font-medium text-white">{currencySymbol}{po.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-400">Previously Paid:</span>
              <span className="font-medium text-emerald-400">{currencySymbol}{po.paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-zinc-800/80 font-medium">
              <span className="text-zinc-300">Outstanding Balance:</span>
              <span className="text-sm font-bold text-rose-400">
                {currencySymbol}{po.outstandingAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payment Inputs */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-zinc-300">Payment Amount ({currencySymbol}) *</label>
              <button
                type="button"
                onClick={() => setAmount(maxPayable)}
                className="text-[11px] text-purple-400 hover:text-purple-300 underline"
              >
                Pay Full Balance ({currencySymbol}{maxPayable.toFixed(2)})
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={maxPayable}
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              required
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Wire Transfer">Wire Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit Card">Corporate Card</option>
                <option value="Cash">Cash on Delivery</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Transaction Ref / Cheque #</label>
            <input
              type="text"
              placeholder="e.g. WIRE-89410 or CHK-4402"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Final settlement, early payment discount applied"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Summary Status Preview */}
          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-purple-400 shrink-0" />
            <span className="text-zinc-300">
              {willBeFullyPaid
                ? `Full settlement. PO payment status will become [Paid].`
                : `Remaining balance of ${currencySymbol}${(maxPayable - amount).toFixed(2)} will remain as [Partially Paid].`}
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-medium bg-purple-500 hover:bg-purple-400 text-zinc-950 font-semibold rounded-lg shadow transition-all disabled:opacity-50"
            >
              <CreditCard size={14} />
              <span>{isSubmitting ? 'Recording...' : `Record Payment ${currencySymbol}${amount.toFixed(2)}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
