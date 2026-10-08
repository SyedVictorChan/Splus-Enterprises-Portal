import React from 'react';
import {
  Calendar,
  Search,
  Filter,
  X,
  RefreshCw,
  Building2,
  CheckCircle,
  Clock
} from 'lucide-react';
import {
  PurchasingDatePreset,
  PurchasingFilterState,
  Supplier,
  POStatus,
  POPaymentStatus,
  POReceivingStatus
} from '../../types/purchasing';

interface Props {
  filters: PurchasingFilterState;
  suppliers: Supplier[];
  platforms?: string[];
  purchasers?: string[];
  onChange: (filters: PurchasingFilterState) => void;
  onReset: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const PurchasingFilterBar: React.FC<Props> = ({
  filters,
  suppliers,
  platforms = [],
  purchasers = [],
  onChange,
  onReset,
  onRefresh,
  isLoading
}) => {
  const datePresets: { id: PurchasingDatePreset; label: string }[] = [
    { id: 'all', label: 'All Records' },
    { id: 'today', label: 'Today' },
    { id: 'thisWeek', label: 'This Week' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'previousMonth', label: 'Previous Month' },
    { id: 'thisQuarter', label: 'This Quarter' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'custom', label: 'Custom Range' }
  ];

  const poStatuses: { id: POStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All Statuses' },
    { id: 'Draft', label: 'Draft' },
    { id: 'Pending Approval', label: 'Pending Approval' },
    { id: 'Approved', label: 'Approved' },
    { id: 'Ordered', label: 'Ordered' },
    { id: 'Partially Received', label: 'Partially Received' },
    { id: 'Received', label: 'Received' },
    { id: 'Cancelled', label: 'Cancelled' },
    { id: 'Closed', label: 'Closed' }
  ];

  const paymentStatuses: { id: POPaymentStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All Payments' },
    { id: 'Unpaid', label: 'Unpaid' },
    { id: 'Partially Paid', label: 'Partially Paid' },
    { id: 'Paid', label: 'Paid' }
  ];

  const receivingStatuses: { id: POReceivingStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All Receiving' },
    { id: 'Pending', label: 'Pending Receipt' },
    { id: 'Partially Received', label: 'Partially Received' },
    { id: 'Received', label: 'Fully Received' }
  ];

  const hasActiveFilters =
    filters.datePreset !== 'all' ||
    Boolean(filters.supplierId && filters.supplierId !== 'all') ||
    Boolean(filters.platform && filters.platform !== 'all') ||
    Boolean(filters.purchaser && filters.purchaser !== 'all') ||
    Boolean(filters.status && filters.status !== 'all') ||
    Boolean(filters.paymentStatus && filters.paymentStatus !== 'all') ||
    Boolean(filters.receivingStatus && filters.receivingStatus !== 'all') ||
    Boolean(filters.searchQuery);

  return (
    <div id="purchasing-filter-bar" className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 mb-6 space-y-3">
      {/* Top Row: Search + Quick Date Preset Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
          <input
            id="purchasing-search-input"
            type="text"
            placeholder="Search PO #, supplier, SKU, product..."
            value={filters.searchQuery || ''}
            onChange={e => onChange({ ...filters, searchQuery: e.target.value })}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ ...filters, searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Date presets pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
          <Calendar size={13} className="text-zinc-500 shrink-0 mr-1" />
          {datePresets.map(preset => (
            <button
              key={preset.id}
              id={`preset-${preset.id}`}
              onClick={() => onChange({ ...filters, datePreset: preset.id })}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                filters.datePreset === preset.id
                  ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range picker if selected */}
      {filters.datePreset === 'custom' && (
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80 text-xs">
          <span className="text-zinc-400">Date Range:</span>
          <input
            type="date"
            value={filters.customStartDate || ''}
            onChange={e => onChange({ ...filters, customStartDate: e.target.value })}
            className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 focus:outline-none focus:border-zinc-600 text-xs"
          />
          <span className="text-zinc-500">to</span>
          <input
            type="date"
            value={filters.customEndDate || ''}
            onChange={e => onChange({ ...filters, customEndDate: e.target.value })}
            className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 focus:outline-none focus:border-zinc-600 text-xs"
          />
        </div>
      )}

      {/* Bottom Row: Secondary Dropdowns (Supplier, PO Status, Payment, Receiving) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-2">
          {/* Buying for Platform Dropdown */}
          {platforms.length > 0 && (
            <div className="relative">
              <select
                id="filter-platform-select"
                value={filters.platform || 'all'}
                onChange={e => onChange({ ...filters, platform: e.target.value })}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-zinc-600 cursor-pointer"
              >
                <option value="all">All Platforms ({platforms.length})</option>
                {platforms.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          )}

          {/* Purchaser Dropdown */}
          {purchasers.length > 0 && (
            <div className="relative">
              <select
                id="filter-purchaser-select"
                value={filters.purchaser || 'all'}
                onChange={e => onChange({ ...filters, purchaser: e.target.value })}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-zinc-600 cursor-pointer"
              >
                <option value="all">All Purchasers ({purchasers.length})</option>
                {purchasers.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>
          )}

          {/* Supplier Dropdown */}
          <div className="relative">
            <select
              id="filter-supplier-select"
              value={filters.supplierId || 'all'}
              onChange={e => onChange({ ...filters, supplierId: e.target.value })}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              <option value="all">All Suppliers / Vendors ({suppliers.length})</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
            <Building2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>

          {/* PO Status Dropdown */}
          <div className="relative">
            <select
              id="filter-po-status-select"
              value={filters.status || 'all'}
              onChange={e => onChange({ ...filters, status: e.target.value as any })}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              {poStatuses.map(st => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
            <Clock size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>

          {/* Payment Status Dropdown */}
          <div className="relative">
            <select
              id="filter-payment-status-select"
              value={filters.paymentStatus || 'all'}
              onChange={e => onChange({ ...filters, paymentStatus: e.target.value as any })}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              {paymentStatuses.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <CheckCircle size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>

          {/* Receiving Status Dropdown */}
          <div className="relative">
            <select
              id="filter-receiving-status-select"
              value={filters.receivingStatus || 'all'}
              onChange={e => onChange({ ...filters, receivingStatus: e.target.value as any })}
              className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-zinc-600 cursor-pointer"
            >
              {receivingStatuses.map(r => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        {/* Right action buttons: Clear Filters & Refresh */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              id="clear-purchasing-filters-btn"
              onClick={onReset}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800/70 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X size={12} />
              <span>Clear Filters</span>
            </button>
          )}

          {onRefresh && (
            <button
              id="refresh-purchasing-data-btn"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Purchasing Data"
              className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/70 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
