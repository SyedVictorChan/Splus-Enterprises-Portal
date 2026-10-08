import React, { useState } from 'react';
import {
  X,
  SearchCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Package,
  Layers,
  Camera
} from 'lucide-react';
import {
  RMAItem,
  ProductCondition,
  PackagingCondition,
  InspectionResult,
  RMAStatus
} from '../../types/rma';
import { RMAService } from '../../services/rmaService';

interface InspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rma: RMAItem;
  onInspectionSaved: (updatedRma: RMAItem) => void;
  currentUser?: string;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  isOpen,
  onClose,
  rma,
  onInspectionSaved,
  currentUser = 'Authorized Inspector'
}) => {
  const existingInspection = rma.inspection;

  const [productCondition, setProductCondition] = useState<ProductCondition>(
    existingInspection?.productCondition || 'used'
  );
  const [packagingCondition, setPackagingCondition] = useState<PackagingCondition>(
    existingInspection?.packagingCondition || 'intact'
  );
  const [accessoriesIncluded, setAccessoriesIncluded] = useState<'yes' | 'partial' | 'no'>(
    existingInspection?.accessoriesIncluded || 'yes'
  );
  const [physicalDamage, setPhysicalDamage] = useState(
    existingInspection?.physicalDamage || ''
  );
  const [functionalCondition, setFunctionalCondition] = useState(
    existingInspection?.functionalCondition || ''
  );
  const [missingComponents, setMissingComponents] = useState(
    existingInspection?.missingComponents || ''
  );
  const [inspectionNotes, setInspectionNotes] = useState(
    existingInspection?.inspectionNotes || ''
  );
  const [result, setResult] = useState<InspectionResult>(
    existingInspection?.result || 'approved'
  );

  // Unit breakdown for Section 28 (Inventory connection)
  const totalQty = rma.quantity || 1;
  const [sellableUnits, setSellableUnits] = useState<number>(
    existingInspection?.sellableUnits ?? (productCondition === 'new' || productCondition === 'like_new' ? totalQty : 0)
  );
  const [damagedUnits, setDamagedUnits] = useState<number>(
    existingInspection?.damagedUnits ?? (productCondition === 'damaged' ? totalQty : 0)
  );
  const [unsellableUnits, setUnsellableUnits] = useState<number>(
    existingInspection?.unsellableUnits ?? (productCondition === 'defective' || productCondition === 'unsellable' ? totalQty : 0)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updated = await RMAService.recordInspection(
        rma.id,
        {
          inspectedAt: new Date().toISOString(),
          inspectedBy: currentUser,
          productCondition,
          packagingCondition,
          accessoriesIncluded,
          physicalDamage: physicalDamage.trim() || undefined,
          functionalCondition: functionalCondition.trim() || undefined,
          missingComponents: missingComponents.trim() || undefined,
          inspectionNotes: inspectionNotes.trim() || undefined,
          result,
          sellableUnits: Number(sellableUnits) || 0,
          damagedUnits: Number(damagedUnits) || 0,
          unsellableUnits: Number(unsellableUnits) || 0,
          restocked: existingInspection?.restocked || false
        },
        currentUser
      );

      if (updated) {
        onInspectionSaved(updated);
      }
      onClose();
    } catch (err) {
      console.warn('Failed to record inspection:', err);
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
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <SearchCheck size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Record Warehouse Inspection</h2>
              <p className="text-xs text-zinc-400">
                Case {rma.rmaNumber} • {rma.product} (SKU: {rma.sku})
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Top Inspection Result Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              Inspection Verdict / Decision
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setResult('approved')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  result === 'approved'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="mx-auto mb-1" size={18} />
                <span className="text-xs block">Approved</span>
              </button>

              <button
                type="button"
                onClick={() => setResult('rejected')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  result === 'rejected'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-400 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <XCircle className="mx-auto mb-1" size={18} />
                <span className="text-xs block">Rejected</span>
              </button>

              <button
                type="button"
                onClick={() => setResult('needs_further_review')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  result === 'needs_further_review'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="mx-auto mb-1" size={18} />
                <span className="text-xs block">Needs Review</span>
              </button>
            </div>
          </div>

          {/* Condition Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Product Condition</label>
              <select
                value={productCondition}
                onChange={(e) => setProductCondition(e.target.value as ProductCondition)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 capitalize"
              >
                <option value="new">New (Unopened)</option>
                <option value="like_new">Like New (Opened, pristine)</option>
                <option value="used">Used / Normal Wear</option>
                <option value="damaged">Damaged (Physical impact)</option>
                <option value="defective">Defective (Internal fault)</option>
                <option value="unsellable">Unsellable / Scrap</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Packaging Condition</label>
              <select
                value={packagingCondition}
                onChange={(e) => setPackagingCondition(e.target.value as PackagingCondition)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 capitalize"
              >
                <option value="intact">Intact / Original Sealed</option>
                <option value="opened">Opened but Complete</option>
                <option value="damaged">Damaged Box</option>
                <option value="missing">Missing Original Box</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Accessories Included</label>
              <select
                value={accessoriesIncluded}
                onChange={(e) => setAccessoriesIncluded(e.target.value as 'yes' | 'partial' | 'no')}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 capitalize"
              >
                <option value="yes">Yes (All accessories)</option>
                <option value="partial">Partial (Missing some)</option>
                <option value="no">No (None included)</option>
              </select>
            </div>
          </div>

          {/* Damage & Functional Observations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Physical Damage Observed</label>
              <input
                type="text"
                placeholder="e.g. Scratches on front bezel, dented corner"
                value={physicalDamage}
                onChange={(e) => setPhysicalDamage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-300">Functional Testing Result</label>
              <input
                type="text"
                placeholder="e.g. Powers on, USB port 2 is intermittent"
                value={functionalCondition}
                onChange={(e) => setFunctionalCondition(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Missing Components */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Missing Parts / Components</label>
            <input
              type="text"
              placeholder="e.g. USB-C charging cable and power brick missing"
              value={missingComponents}
              onChange={(e) => setMissingComponents(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Detailed Inspector Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Inspector Analysis & Notes</label>
            <textarea
              rows={2}
              placeholder="Summary of inspection findings and recommended resolution..."
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Inventory Breakdown Allocation (Section 28 Inventory Connection) */}
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">
                Inventory Disposition Allocation (Total: {totalQty})
              </span>
              <span className="text-[11px] text-zinc-400">Specify units per condition</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-emerald-400 block mb-1">Sellable (Restockable)</label>
                <input
                  type="number"
                  min="0"
                  max={totalQty}
                  value={sellableUnits}
                  onChange={(e) => setSellableUnits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-amber-400 block mb-1">Damaged (Refurbish)</label>
                <input
                  type="number"
                  min="0"
                  max={totalQty}
                  value={damagedUnits}
                  onChange={(e) => setDamagedUnits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-rose-400 block mb-1">Unsellable (Scrap)</label>
                <input
                  type="number"
                  min="0"
                  max={totalQty}
                  value={unsellableUnits}
                  onChange={(e) => setUnsellableUnits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>
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
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <SearchCheck size={14} />
              <span>{isSubmitting ? 'Saving...' : 'Save Inspection Evaluation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
