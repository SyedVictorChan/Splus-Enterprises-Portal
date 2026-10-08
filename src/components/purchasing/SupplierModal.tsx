import React, { useState } from 'react';
import {
  X,
  Building2,
  AlertCircle,
  Check
} from 'lucide-react';
import { Supplier } from '../../types/purchasing';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
  onSave: (supplier: Supplier) => Promise<void>;
}

export const SupplierModal: React.FC<Props> = ({
  isOpen,
  onClose,
  supplier,
  onSave
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(supplier);

  const [code, setCode] = useState(supplier?.code || `SUP-${Math.floor(100 + Math.random() * 900)}`);
  const [name, setName] = useState(supplier?.name || '');
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [country, setCountry] = useState(supplier?.country || 'United States');
  const [address, setAddress] = useState(supplier?.address || '');
  const [paymentTerms, setPaymentTerms] = useState(supplier?.paymentTerms || 'Net 30');
  const [status, setStatus] = useState<Supplier['status']>(supplier?.status || 'Active');
  const [notes, setNotes] = useState(supplier?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a supplier company name.');
      return;
    }
    if (!code.trim()) {
      setError('Please provide a supplier identification code.');
      return;
    }

    const payload: Supplier = {
      id: supplier?.id || `sup-${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      contactPerson: contactPerson.trim() || 'General Sales',
      phone: phone.trim() || 'N/A',
      email: email.trim() || 'sales@supplier.com',
      country: country.trim() || 'Global',
      address: address.trim() || undefined,
      paymentTerms,
      status,
      notes: notes.trim() || undefined,
      createdAt: supplier?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save supplier details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="supplier-modal"
        className="relative w-full max-w-lg flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {isEditing ? 'Edit Supplier' : 'Register New Supplier'}
              </h2>
              <p className="text-xs text-zinc-400">Maintain procurement vendor profile and credit terms</p>
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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-zinc-300 mb-1">Code *</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">Supplier Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="e.g. Apex Hardware Logistics Ltd"
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Contact Person</label>
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                placeholder="Account Manager / Rep"
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="e.g. United States, China, UK"
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="sales@supplier.com"
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Facility / Warehouse Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Suite, Street, City, State/Province"
              className="w-full px-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions, account contacts, warranty policies..."
              className="w-full p-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600 resize-none"
            />
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
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 text-xs font-medium bg-white hover:bg-zinc-200 text-zinc-950 rounded-lg shadow font-semibold transition-all disabled:opacity-50"
            >
              <Check size={14} />
              <span>{isSaving ? 'Saving...' : isEditing ? 'Update Supplier' : 'Add Supplier'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
