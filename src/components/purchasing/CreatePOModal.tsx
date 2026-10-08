import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileCheck,
  Building2,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import {
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  POStatus
} from '../../types/purchasing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => Promise<void>;
  suppliers: Supplier[];
  existingSkus?: { sku: string; product: string; defaultCost?: number }[];
  currencySymbol?: string;
  currentUser?: string;
}

export const CreatePOModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  suppliers,
  existingSkus = [],
  currencySymbol = '$',
  currentUser = 'Purchasing Team'
}) => {
  if (!isOpen) return null;

  const activeSuppliers = suppliers.filter(s => s.status === 'Active');
  const defaultSupplier = activeSuppliers[0] || suppliers[0];

  const todayStr = new Date().toISOString().split('T')[0];
  const deliveryStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const autoPoNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const [poNumber, setPoNumber] = useState(autoPoNumber);
  const [supplierId, setSupplierId] = useState(defaultSupplier?.id || '');
  const [poDate, setPoDate] = useState(todayStr);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(deliveryStr);
  const [currency, setCurrency] = useState('USD');
  const [paymentTerms, setPaymentTerms] = useState(defaultSupplier?.paymentTerms || 'Net 30');
  const [status, setStatus] = useState<POStatus>('Ordered');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<PurchaseOrderItem[]>([
    {
      id: `item-${Date.now()}-1`,
      sku: '',
      productName: '',
      description: '',
      quantity: 100,
      unitCost: 25,
      discount: 0,
      tax: 0,
      total: 2500,
      quantityReceived: 0
    }
  ]);

  const handleSupplierChange = (id: string) => {
    setSupplierId(id);
    const sup = suppliers.find(s => s.id === id);
    if (sup?.paymentTerms) {
      setPaymentTerms(sup.paymentTerms);
    }
  };

  const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    // Auto-calculate line total
    const qty = Number(current.quantity) || 0;
    const cost = Number(current.unitCost) || 0;
    const disc = Number(current.discount) || 0;
    const tax = Number(current.tax) || 0;
    current.total = Math.max(0, Number((qty * cost - disc + tax).toFixed(2)));

    updated[index] = current;
    setItems(updated);
  };

  const handleSkuSelect = (index: number, selectedSku: string) => {
    const match = existingSkus.find(e => e.sku === selectedSku);
    if (match) {
      const updated = [...items];
      updated[index] = {
        ...updated[index],
        sku: match.sku,
        productName: match.product,
        unitCost: match.defaultCost || updated[index].unitCost || 20
      };
      // Recalculate
      const qty = updated[index].quantity || 0;
      const cost = updated[index].unitCost || 0;
      const disc = updated[index].discount || 0;
      const tax = updated[index].tax || 0;
      updated[index].total = Math.max(0, Number((qty * cost - disc + tax).toFixed(2)));
      setItems(updated);
    } else {
      handleItemChange(index, 'sku', selectedSku);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}-${items.length + 1}`,
        sku: '',
        productName: '',
        description: '',
        quantity: 50,
        unitCost: 20,
        discount: 0,
        tax: 0,
        total: 1000,
        quantityReceived: 0
      }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unitCost) || 0), 0);
  const totalDiscount = items.reduce((acc, i) => acc + (Number(i.discount) || 0), 0);
  const totalTax = items.reduce((acc, i) => acc + (Number(i.tax) || 0), 0);
  const grandTotal = Number(Math.max(0, subtotal - totalDiscount + totalTax).toFixed(2));
  const totalQuantity = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!poNumber.trim()) {
      setError('Please enter a valid Purchase Order number.');
      return;
    }

    if (!supplierId) {
      setError('Please select an authorized supplier.');
      return;
    }

    const invalidItem = items.find(i => !i.productName.trim() || Number(i.quantity) <= 0 || Number(i.unitCost) < 0);
    if (invalidItem) {
      setError('Please ensure every line item has a product name, positive quantity, and non-negative unit cost.');
      return;
    }

    const chosenSupplier = suppliers.find(s => s.id === supplierId);

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: poNumber.trim().toUpperCase(),
      supplierId,
      supplierName: chosenSupplier?.name || 'Authorized Supplier',
      poDate,
      expectedDeliveryDate,
      currency,
      paymentTerms,
      notes,
      items,
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount: grandTotal,
      paidAmount: 0,
      outstandingAmount: grandTotal,
      status,
      paymentStatus: 'Unpaid',
      receivingStatus: 'Pending',
      totalQuantity,
      totalReceivedQuantity: 0,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onSave(newPO);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save purchase order.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="create-po-modal"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800 text-white">
              <FileCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Create Purchase Order</h2>
              <p className="text-xs text-zinc-400">Issue official procurement contract for inventory replenishment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: PO Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">PO Number *</label>
              <input
                type="text"
                value={poNumber}
                onChange={e => setPoNumber(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Supplier *</label>
              <select
                value={supplierId}
                onChange={e => handleSupplierChange(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="">Select Supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) - {s.country}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Initial Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as POStatus)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="Ordered">Ordered (Active)</option>
                <option value="Approved">Approved</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">PO Issue Date *</label>
              <input
                type="date"
                value={poDate}
                onChange={e => setPoDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={e => setExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
                <option value="Advance">Advance (100% Pre-payment)</option>
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="50% Advance / 50% Delivery">50% Advance / 50% Delivery</option>
              </select>
            </div>
          </div>

          {/* Section 2: Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Purchased Line Items</h3>
                <p className="text-[11px] text-zinc-400">Specify SKU, quantities, and negotiated unit costs</p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2.5 min-w-[140px]">SKU</th>
                      <th className="px-3 py-2.5 min-w-[200px]">Product Name *</th>
                      <th className="px-3 py-2.5 w-24">Qty</th>
                      <th className="px-3 py-2.5 w-28">Unit Cost</th>
                      <th className="px-3 py-2.5 w-24">Disc ($)</th>
                      <th className="px-3 py-2.5 w-24">Tax ($)</th>
                      <th className="px-3 py-2.5 w-28 text-right">Line Total</th>
                      <th className="px-2 py-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-zinc-900/30">
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="e.g. TECH-01"
                            value={item.sku}
                            onChange={e => handleSkuSelect(idx, e.target.value)}
                            list="sku-datalist"
                            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono focus:outline-none focus:border-zinc-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Product Title"
                            value={item.productName}
                            onChange={e => handleItemChange(idx, 'productName', e.target.value)}
                            required
                            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white focus:outline-none focus:border-zinc-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white text-right focus:outline-none focus:border-zinc-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitCost}
                            onChange={e => handleItemChange(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white text-right focus:outline-none focus:border-zinc-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.discount}
                            onChange={e => handleItemChange(idx, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 text-right focus:outline-none focus:border-zinc-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.tax}
                            onChange={e => handleItemChange(idx, 'tax', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 text-right focus:outline-none focus:border-zinc-600"
                          />
                        </td>
                        <td className="p-2 text-right font-medium text-white">
                          {currencySymbol}{item.total.toFixed(2)}
                        </td>
                        <td className="p-2 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-zinc-500 hover:text-rose-400 p-1"
                              title="Delete Item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Datalist for existing SKUs */}
            <datalist id="sku-datalist">
              {existingSkus.map((s, idx) => (
                <option key={`${s.sku}-${idx}`} value={s.sku}>
                  {s.product}
                </option>
              ))}
            </datalist>
          </div>

          {/* Section 3: Notes & Financial Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Procurement Notes / Instructions</label>
              <textarea
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Include shipping carrier requirements, delivery dock number, packaging labels..."
                className="w-full p-3 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600 resize-none"
              />
            </div>

            {/* Financial Totals Card */}
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Total Units:</span>
                <span className="text-white font-medium">{totalQuantity.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="text-white font-medium">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total Discount:</span>
                <span className="text-emerald-400">-{currencySymbol}{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Estimated Tax:</span>
                <span className="text-white">+{currencySymbol}{totalTax.toFixed(2)}</span>
              </div>
              <div className="border-t border-zinc-800 pt-2.5 flex justify-between items-center">
                <span className="text-sm font-semibold text-white">Grand Total:</span>
                <span className="text-lg font-bold text-white">
                  {currencySymbol}{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
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
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 text-xs font-medium bg-white hover:bg-zinc-200 text-zinc-950 rounded-lg shadow transition-all disabled:opacity-50"
          >
            <FileCheck size={14} />
            <span>{isSaving ? 'Issuing PO...' : 'Create Purchase Order'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
