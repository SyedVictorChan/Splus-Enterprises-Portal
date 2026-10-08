import React, { useState } from 'react';
import { X, Edit3, ArrowRight, CheckCircle2 } from 'lucide-react';
import { RMAItem, RMAStatus } from '../../types/rma';
import { RMA_STATUS_CONFIG, RMAService } from '../../services/rmaService';

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  rma: RMAItem;
  onStatusUpdated: (updatedRma: RMAItem) => void;
  currentUser?: string;
}

export const UpdateStatusModal: React.FC<UpdateStatusModalProps> = ({
  isOpen,
  onClose,
  rma,
  onStatusUpdated,
  currentUser = 'Authorized Agent'
}) => {
  const [selectedStatus, setSelectedStatus] = useState<RMAStatus>(rma.status);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentCfg = RMA_STATUS_CONFIG[rma.status];
  const targetCfg = RMA_STATUS_CONFIG[selectedStatus];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === rma.status) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await RMAService.updateRMAStatus(
        rma.id,
        selectedStatus,
        currentUser,
        transitionNotes.trim() || undefined
      );

      if (updated) {
        onStatusUpdated(updated);
      }
      onClose();
    } catch (err) {
      console.warn('Error updating status:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-sky-400" />
            <h2 className="text-sm font-bold text-white">Update RMA Status</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase text-zinc-400 block">Current Status</span>
              <span className={`font-semibold ${currentCfg?.color}`}>{currentCfg?.label}</span>
            </div>
            <ArrowRight size={14} className="text-zinc-400" />
            <div className="text-right">
              <span className="text-[10px] uppercase text-zinc-400 block">New Status</span>
              <span className={`font-semibold ${targetCfg?.color}`}>{targetCfg?.label}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Select New Lifecycle State</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as RMAStatus)}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 capitalize"
            >
              {Object.entries(RMA_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-300">Transition Reason / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Returned parcel arrived at warehouse loading dock"
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg p-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedStatus === rma.status}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 size={13} />
              <span>Apply Status</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
