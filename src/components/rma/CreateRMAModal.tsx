import React, { useState } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Paperclip,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { RMAItem, ReturnReason, ReturnType, RMAStatus } from '../../types/rma';
import { SalesRecord } from '../../types';
import {
  STANDARD_RETURN_REASONS,
  RETURN_TYPES,
  RMAService
} from '../../services/rmaService';

interface CreateRMAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (rma: RMAItem) => void;
  salesRecords?: SalesRecord[];
  currentUser?: string;
}

export const CreateRMAModal: React.FC<CreateRMAModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  salesRecords = [],
  currentUser = 'Authorized Agent'
}) => {
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [customer, setCustomer] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [marketplace, setMarketplace] = useState('Amazon');
  const [store, setStore] = useState('Splus Prime Direct');
  const [product, setProduct] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [originalSalePrice, setOriginalSalePrice] = useState<number | undefined>(undefined);
  const [originalCost, setOriginalCost] = useState<number | undefined>(undefined);
  const [reason, setReason] = useState<ReturnReason>('defective_product');
  const [customReason, setCustomReason] = useState('');
  const [returnType, setReturnType] = useState<ReturnType>('refund');
  const [status, setStatus] = useState<RMAStatus>('requested');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [lookupFeedback, setLookupFeedback] = useState<{ found: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLookupOrder = () => {
    if (!orderNumber.trim()) return;
    const lookup = RMAService.lookupOrderInSales(orderNumber, salesRecords);
    if (lookup && lookup.found) {
      if (lookup.customer) setCustomer(lookup.customer);
      if (lookup.product) setProduct(lookup.product);
      if (lookup.sku) setSku(lookup.sku);
      if (lookup.quantity) setQuantity(lookup.quantity);
      if (lookup.orderDate) setOrderDate(lookup.orderDate);
      if (lookup.marketplace) setMarketplace(lookup.marketplace);
      if (lookup.store) setStore(lookup.store);
      if (lookup.price) setOriginalSalePrice(lookup.price);
      if (lookup.cost) setOriginalCost(lookup.cost);

      setLookupFeedback({
        found: true,
        message: `Found order ${lookup.orderNumber}! Product and customer details auto-populated.`
      });
    } else {
      setLookupFeedback({
        found: false,
        message: 'Order ID not found in current imported sales batch. You can enter details manually.'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.trim() || !customer.trim()) return;

    setIsSubmitting(true);
    try {
      const attachments = attachmentName.trim()
        ? [
            {
              id: `att_${Date.now()}`,
              name: attachmentName.trim(),
              url: '#',
              uploadedAt: new Date().toISOString(),
              uploadedBy: currentUser
            }
          ]
        : [];

      const newRMA = await RMAService.createRMA(
        {
          orderNumber: orderNumber.trim() || `ORD-${Date.now().toString().slice(-6)}`,
          orderDate: orderDate || new Date().toISOString().split('T')[0],
          customer: customer.trim(),
          customerEmail: customerEmail.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          marketplace: marketplace || 'Direct',
          store: store || 'Main Store',
          product: product.trim(),
          sku: sku.trim() || 'SKU-CUSTOM',
          quantity: Math.max(1, Number(quantity) || 1),
          originalSalePrice: originalSalePrice ? Number(originalSalePrice) : undefined,
          originalCost: originalCost ? Number(originalCost) : undefined,
          reason,
          customReason: customReason.trim() || undefined,
          returnType,
          status,
          returnShippingCarrier: carrier.trim() || undefined,
          returnTrackingNumber: trackingNumber.trim() || undefined,
          customerNotes: customerNotes.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
          attachments
        },
        currentUser
      );

      onCreated(newRMA);
      onClose();
    } catch (err) {
      console.warn('Error creating RMA:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create RMA Return Case</h2>
              <p className="text-xs text-zinc-400">Generate a new Return Merchandise Authorization</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Order Lookup Box */}
          <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              Order Number (Optional Auto-Fill)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. ORD-20260310-101 or 112-984..."
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleLookupOrder}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Search size={13} />
                <span>Fetch Order</span>
              </button>
            </div>

            {lookupFeedback && (
              <div
                className={`text-xs flex items-center gap-1.5 pt-1 ${
                  lookupFeedback.found ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {lookupFeedback.found ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{lookupFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Product & SKU Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium text-zinc-300">
                Product Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Wireless ANC Headphones"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">SKU</label>
              <input
                type="text"
                placeholder="e.g. AUDIO-ANC-001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Quantity & Price & Order Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Quantity Returned</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Original Price ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={originalSalePrice ?? ''}
                onChange={(e) => setOriginalSalePrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Order Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">
                Customer Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Full name"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Customer Email</label>
              <input
                type="email"
                placeholder="email@domain.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Customer Phone</label>
              <input
                type="text"
                placeholder="+1 (555) 000-0000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Marketplace & Store */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Marketplace</label>
              <input
                type="text"
                placeholder="e.g. Amazon, Daraz, Shopify"
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Store Name</label>
              <input
                type="text"
                placeholder="e.g. Wholly Mart, Splus Prime"
                value={store}
                onChange={(e) => setStore(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Reason & Return Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Reason for Return</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReturnReason)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {STANDARD_RETURN_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Return Type (Resolution)</label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as ReturnType)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                {RETURN_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Return Shipping Carrier & Tracking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Return Carrier</label>
              <input
                type="text"
                placeholder="e.g. UPS, FedEx, TCS, DHL"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Tracking Number</label>
              <input
                type="text"
                placeholder="Tracking / Waybill #"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Customer Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Customer Comments / Symptoms</label>
            <textarea
              rows={2}
              placeholder="What did the customer report regarding the issue?"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Attachments Simulation */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Paperclip size={13} />
              <span>Attachment / Damage Photo Proof</span>
            </label>
            <input
              type="text"
              placeholder="e.g. packaging_crack_photo.jpg, courier_receipt.pdf"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

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
              disabled={isSubmitting || !product.trim() || !customer.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              <span>{isSubmitting ? 'Creating Case...' : 'Create RMA Case'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
