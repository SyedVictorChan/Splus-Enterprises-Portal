import React from 'react';
import {
  Calendar,
  Search,
  Filter,
  X,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import {
  RMAFilterState,
  RMADatePreset
} from '../../types/rma';
import {
  STANDARD_RETURN_REASONS,
  RETURN_TYPES,
  RMA_STATUS_CONFIG
} from '../../services/rmaService';

interface RMAFilterBarProps {
  filters: RMAFilterState;
  onFilterChange: (filters: RMAFilterState) => void;
  onResetFilters: () => void;
  availableMarketplaces: string[];
  availableStores: string[];
}

const DATE_PRESETS: { value: RMADatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'previousMonth', label: 'Previous Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Date Range' }
];

export const RMAFilterBar: React.FC<RMAFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  availableMarketplaces,
  availableStores
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handlePresetChange = (preset: RMADatePreset) => {
    onFilterChange({
      ...filters,
      datePreset: preset
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      searchQuery: e.target.value
    });
  };

  const isFiltered =
    filters.status !== 'all' && filters.status !== undefined ||
    filters.marketplace !== 'all' && filters.marketplace !== undefined ||
    filters.store !== 'all' && filters.store !== undefined ||
    filters.reason !== 'all' && filters.reason !== undefined ||
    filters.returnType !== 'all' && filters.returnType !== undefined ||
    filters.inspectionStatus !== 'all' && filters.inspectionStatus !== undefined ||
    Boolean(filters.searchQuery);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3.5">
      {/* Top Bar: Search, Date Presets, Advanced Toggle, Reset */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Global RMA Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="Search RMA #, Order #, Customer, SKU, Tracking..."
            value={filters.searchQuery || ''}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950/80 border border-zinc-700/80 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Preset Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 shrink-0">
            <Calendar size={14} />
            <span className="font-medium">Period:</span>
          </div>
          <select
            value={filters.datePreset}
            onChange={(e) => handlePresetChange(e.target.value as RMADatePreset)}
            className="bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500 shrink-0"
          >
            {DATE_PRESETS.map(preset => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>

          {/* Custom Date Inputs if 'custom' is active */}
          {filters.datePreset === 'custom' && (
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="date"
                value={filters.customStartDate || ''}
                onChange={(e) => onFilterChange({ ...filters, customStartDate: e.target.value })}
                className="bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <span className="text-zinc-400 text-xs">to</span>
              <input
                type="date"
                value={filters.customEndDate || ''}
                onChange={(e) => onFilterChange({ ...filters, customEndDate: e.target.value })}
                className="bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          )}

          {/* Advanced Filters Button */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors shrink-0 ${
              showAdvanced || isFiltered
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'bg-zinc-950 text-zinc-300 border-zinc-700/80 hover:bg-zinc-800'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {isFiltered && <span className="w-2 h-2 rounded-full bg-sky-400"></span>}
          </button>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              onClick={onResetFilters}
              title="Reset all filters"
              className="flex items-center gap-1 px-2.5 py-2 text-xs text-zinc-400 hover:text-white bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors shrink-0"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Row */}
      {showAdvanced && (
        <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Status */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">RMA Status</label>
            <select
              value={filters.status || 'all'}
              onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(RMA_STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Marketplace */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">Marketplace</label>
            <select
              value={filters.marketplace || 'all'}
              onChange={(e) => onFilterChange({ ...filters, marketplace: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Marketplaces</option>
              {availableMarketplaces.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Store */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">Store</label>
            <select
              value={filters.store || 'all'}
              onChange={(e) => onFilterChange({ ...filters, store: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Stores</option>
              {availableStores.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Return Reason */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">Return Reason</label>
            <select
              value={filters.reason || 'all'}
              onChange={(e) => onFilterChange({ ...filters, reason: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Reasons</option>
              {STANDARD_RETURN_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Return Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">Return Type</label>
            <select
              value={filters.returnType || 'all'}
              onChange={(e) => onFilterChange({ ...filters, returnType: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Types</option>
              {RETURN_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Inspection Status */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">Inspection</label>
            <select
              value={filters.inspectionStatus || 'all'}
              onChange={(e) => onFilterChange({ ...filters, inspectionStatus: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700/80 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="all">All Inspection States</option>
              <option value="pending">Pending Inspection</option>
              <option value="approved">Inspection Approved</option>
              <option value="rejected">Inspection Rejected</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
