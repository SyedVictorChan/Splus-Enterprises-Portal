import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Sparkles,
  X,
  Check,
  Copy,
  ExternalLink,
  PackageCheck,
  CreditCard,
  Building2,
  Tag,
  Truck,
  User,
  Layers,
  ArrowRight,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { PurchaseOrder } from '../../types/purchasing';
import { GoogleSheetsLiveService } from '../../services/googleSheetsLiveService';

interface Props {
  pos: PurchaseOrder[];
  currencySymbol: string;
  onSelectPO: (po: PurchaseOrder) => void;
  onReceivePO: (po: PurchaseOrder) => void;
  onPayPO: (po: PurchaseOrder) => void;
  onRefreshSheet?: () => void;
  isLoading?: boolean;
  onApplyFilter?: (poNumber: string, date: string) => void;
}

export const PurchasingQuickLookup: React.FC<Props> = ({
  pos,
  currencySymbol,
  onSelectPO,
  onReceivePO,
  onPayPO,
  onRefreshSheet,
  isLoading,
  onApplyFilter
}) => {
  const [poNumberInput, setPoNumberInput] = useState<string>('');
  const [dateInput, setDateInput] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper to normalize strings for comparison
  const normalizeStr = (s?: string | number | null) =>
    String(s || '')
      .toLowerCase()
      .trim()
      .replace(/[\s\-_#]/g, '');

  // Normalize date comparison
  const matchesDate = (po: PurchaseOrder, selectedDate: string): boolean => {
    if (!selectedDate) return true;
    const normTarget = selectedDate.trim();

    // 1. Direct poDate comparison (YYYY-MM-DD)
    if (po.poDate && po.poDate === normTarget) return true;

    // 2. Normalized rawDate comparison
    if (po.rawDate) {
      const normalizedRaw = GoogleSheetsLiveService.normalizeDate(po.rawDate);
      if (normalizedRaw && normalizedRaw === normTarget) return true;
      if (po.rawDate.toLowerCase().includes(normTarget.toLowerCase())) return true;
    }

    return false;
  };

  // Matching records based on current PO number and Date inputs
  const matchedPOs = useMemo(() => {
    const hasPo = Boolean(poNumberInput.trim());
    const hasDate = Boolean(dateInput.trim());

    if (!hasPo && !hasDate) {
      return [];
    }

    const cleanPo = normalizeStr(poNumberInput);

    return pos.filter(po => {
      let poMatches = true;
      if (hasPo) {
        const normPO = normalizeStr(po.poNumber);
        const normTracking = normalizeStr(po.trackingNumber);
        const normSupplier = normalizeStr(po.supplierName);
        const normVendor = normalizeStr(po.buyingFromVendor);

        poMatches =
          normPO.includes(cleanPo) ||
          normTracking.includes(cleanPo) ||
          normSupplier.includes(cleanPo) ||
          normVendor.includes(cleanPo);
      }

      let dateMatches = true;
      if (hasDate) {
        dateMatches = matchesDate(po, dateInput);
      }

      return poMatches && dateMatches;
    });
  }, [pos, poNumberInput, dateInput]);

  // Handle setting today's date
  const setTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateInput(today);
    if (onApplyFilter) {
      onApplyFilter(poNumberInput, today);
    }
  };

  // Handle Clear
  const handleClear = () => {
    setPoNumberInput('');
    setDateInput('');
    if (onApplyFilter) {
      onApplyFilter('', '');
    }
  };

  // Apply to dashboard global filter
  const handleInputChange = (po: string, d: string) => {
    setPoNumberInput(po);
    setDateInput(d);
    if (onApplyFilter) {
      onApplyFilter(po, d);
    }
  };

  // Quick PO suggestion pills from recent records
  const recentPOSuggestions = useMemo(() => {
    const list: string[] = [];
    pos.forEach(p => {
      if (p.poNumber && !list.includes(p.poNumber)) {
        list.push(p.poNumber);
      }
    });
    return list.slice(0, 5);
  }, [pos]);

  const hasSearched = Boolean(poNumberInput.trim() || dateInput.trim());
  const singleMatch = matchedPOs.length === 1 ? matchedPOs[0] : null;

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Received':
      case 'Closed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Partially Received':
      case 'Ordered':
      case 'In Transit':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Draft':
      case 'Pending Approval':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Cancelled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Google Sheet PO Quick Lookup & Date Finder</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                14 Details Direct
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Enter PO Number & select Date to retrieve instant procurement details from the connected purchasing sheet
            </p>
          </div>
        </div>

        {/* Sync Sheet & Record Count */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400 font-medium">
            Sheet Records: <span className="font-semibold text-white">{pos.length}</span>
          </span>
          {onRefreshSheet && (
            <button
              onClick={onRefreshSheet}
              disabled={isLoading}
              title="Sync latest records from Google Sheet"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin text-blue-400' : ''} />
              <span>{isLoading ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inputs Form: PO Number & Date Picker */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4">
        {/* PO Number Input (7 cols on md) */}
        <div className="md:col-span-6 space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            1. Enter PO Number
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              id="quick-lookup-po-input"
              type="text"
              placeholder="e.g. PO-1049, PO0076, 1049..."
              value={poNumberInput}
              onChange={e => handleInputChange(e.target.value, dateInput)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-950 border border-zinc-700/80 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
            {poNumberInput && (
              <button
                onClick={() => handleInputChange('', dateInput)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 p-0.5"
                title="Clear PO Number"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Date Selector Input (4 cols on md) */}
        <div className="md:col-span-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              2. Select Date
            </label>
            <button
              onClick={setTodayDate}
              className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Set Today
            </button>
          </div>
          <div className="relative">
            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              id="quick-lookup-date-input"
              type="date"
              value={dateInput}
              onChange={e => handleInputChange(poNumberInput, e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-zinc-950 border border-zinc-700/80 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer font-mono"
            />
            {dateInput && (
              <button
                onClick={() => handleInputChange(poNumberInput, '')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 p-0.5"
                title="Clear Date"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls (2 cols on md) */}
        <div className="md:col-span-2 flex items-end">
          {hasSearched ? (
            <button
              onClick={handleClear}
              className="w-full py-2 px-3 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (recentPOSuggestions.length > 0) {
                  handleInputChange(recentPOSuggestions[0], '');
                }
              }}
              className="w-full py-2 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
            >
              <Search size={13} />
              <span>Lookup</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Suggestions Chips */}
      {!hasSearched && recentPOSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-3 text-[11px] text-zinc-500">
          <span>Quick pick from sheet:</span>
          {recentPOSuggestions.map(num => (
            <button
              key={num}
              onClick={() => handleInputChange(num, '')}
              className="font-mono px-2 py-0.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              {num}
            </button>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESULTS DISPLAY: THE EXACT 14 REQUESTED COLUMNS / DETAILS                 */}
      {/* Reason | Purchaser | Buying for Platform | Buying from Vendor |           */}
      {/* Payment Method | Qty Purchased | Line Item | PO Number | PO Amount |      */}
      {/* Payment Status | Tracking No. | Delivered Date | Received Date | Status    */}
      {/* ========================================================================= */}

      {hasSearched && (
        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          {matchedPOs.length === 0 ? (
            /* No match found feedback */
            <div className="p-5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-sm font-semibold text-white">No Matching Order Found</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                No record found in the purchasing sheet matching PO #{poNumberInput || 'any'}
                {dateInput ? ` on date ${dateInput}` : ''}.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
                >
                  Show All {pos.length} Sheet Records
                </button>
                {onRefreshSheet && (
                  <button
                    onClick={onRefreshSheet}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    Sync Live Sheet Now
                  </button>
                )}
              </div>
            </div>
          ) : singleMatch ? (
            /* SINGLE MATCH: Dedicated 14-Column Presentation Card */
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-lg animate-fadeIn">
              {/* Card Header Bar */}
              <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 font-mono text-sm font-bold flex items-center gap-1.5">
                    <span>{singleMatch.poNumber}</span>
                    <button
                      onClick={() => copyToClipboard(singleMatch.poNumber, 'po')}
                      className="text-zinc-500 hover:text-zinc-300"
                      title="Copy PO Number"
                    >
                      {copiedKey === 'po' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>

                  <span className="text-xs text-zinc-400 font-medium">
                    Order Date: <span className="font-semibold text-white">{singleMatch.rawDate || singleMatch.poDate}</span>
                  </span>

                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(singleMatch.status)}`}>
                    {singleMatch.status}
                  </span>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex items-center gap-2">
                  {singleMatch.receivingStatus !== 'Received' && singleMatch.status !== 'Cancelled' && (
                    <button
                      onClick={() => onReceivePO(singleMatch)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors"
                    >
                      <PackageCheck size={13} />
                      <span>Receive Goods</span>
                    </button>
                  )}

                  {singleMatch.outstandingAmount > 0 && singleMatch.status !== 'Cancelled' && (
                    <button
                      onClick={() => onPayPO(singleMatch)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg transition-colors"
                    >
                      <CreditCard size={13} />
                      <span>Record Payment</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectPO(singleMatch)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
                  >
                    <span>Full PO View</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* 14 Requested Details Grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {/* 1. Reason */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Reason
                  </span>
                  <span className="text-xs font-semibold text-white block truncate" title={singleMatch.reason || '—'}>
                    {singleMatch.reason || '—'}
                  </span>
                </div>

                {/* 2. Purchaser */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Purchaser
                  </span>
                  <span className="text-xs font-semibold text-zinc-200 block truncate">
                    {singleMatch.purchaser || singleMatch.createdBy || '—'}
                  </span>
                </div>

                {/* 3. Buying for Platform */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Buying for Platform
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-200 border border-zinc-700">
                    {singleMatch.buyingForPlatform || 'All Platforms'}
                  </span>
                </div>

                {/* 4. Buying from Vendor */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Buying from Vendor
                  </span>
                  <span className="text-xs font-semibold text-white block truncate" title={singleMatch.buyingFromVendor || singleMatch.supplierName}>
                    {singleMatch.buyingFromVendor || singleMatch.supplierName}
                  </span>
                </div>

                {/* 5. Payment Method */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Payment Method
                  </span>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    {singleMatch.paymentMethod || 'Payoneer'}
                  </span>
                </div>

                {/* 6. Qty Purchased */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Qty Purchased
                  </span>
                  <span className="text-xs font-bold text-white font-mono block">
                    {(singleMatch.qtyPurchased ?? singleMatch.totalQuantity).toLocaleString()} units
                  </span>
                </div>

                {/* 7. Line Item */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Line Item
                  </span>
                  <span className="text-xs font-medium text-zinc-300 block truncate" title={String(singleMatch.lineItem || '1')}>
                    {String(singleMatch.lineItem || (singleMatch.items[0]?.productName || '1'))}
                  </span>
                </div>

                {/* 8. PO Number */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    PO Number
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-400 block">
                    {singleMatch.poNumber}
                  </span>
                </div>

                {/* 9. PO Amount */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    PO Amount
                  </span>
                  <span className="text-xs font-bold text-emerald-400 block">
                    {currencySymbol}{(singleMatch.poAmount ?? singleMatch.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 10. Payment Status */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Payment Status
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                    singleMatch.paymentStatus === 'Paid'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : singleMatch.paymentStatus === 'Partially Paid'
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {singleMatch.paymentStatus}
                  </span>
                </div>

                {/* 11. Tracking No. */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Tracking No.
                  </span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-mono font-medium text-zinc-300 truncate" title={singleMatch.trackingNumber || '—'}>
                      {singleMatch.trackingNumber || '—'}
                    </span>
                    {singleMatch.trackingNumber && (
                      <button
                        onClick={() => copyToClipboard(singleMatch.trackingNumber!, 'trk')}
                        className="text-zinc-500 hover:text-zinc-300 shrink-0"
                        title="Copy Tracking #"
                      >
                        {copiedKey === 'trk' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* 12. Delivered Date */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Delivered Date
                  </span>
                  <span className="text-xs font-medium text-zinc-300 block">
                    {singleMatch.deliveredDate || singleMatch.expectedDeliveryDate || '—'}
                  </span>
                </div>

                {/* 13. Received Date */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Received Date
                  </span>
                  <span className="text-xs font-medium text-zinc-300 block">
                    {singleMatch.receivedDate || (singleMatch.status === 'Received' ? singleMatch.poDate : '—')}
                  </span>
                </div>

                {/* 14. Status */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                    Status
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${getStatusBadge(singleMatch.status)}`}>
                    {singleMatch.status}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* MULTIPLE MATCHES: Displaying clean matching table with the 14 columns */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>
                  Found <span className="font-semibold text-white">{matchedPOs.length}</span> matching records in purchasing sheet.
                </span>
                <span className="text-[11px] text-zinc-500">Click &quot;Inspect&quot; on any row for full card view.</span>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[360px] scrollbar-thin">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-zinc-900 text-zinc-400 sticky top-0 border-b border-zinc-800 z-10 font-medium">
                      <tr>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Reason</th>
                        <th className="px-3 py-2.5">Purchaser</th>
                        <th className="px-3 py-2.5">Buying for Platform</th>
                        <th className="px-3 py-2.5">Buying from Vendor</th>
                        <th className="px-3 py-2.5">Payment Method</th>
                        <th className="px-3 py-2.5 text-center">Qty Purchased</th>
                        <th className="px-3 py-2.5">Line Item</th>
                        <th className="px-3 py-2.5">PO Number</th>
                        <th className="px-3 py-2.5 text-right">PO Amount</th>
                        <th className="px-3 py-2.5 text-center">Payment Status</th>
                        <th className="px-3 py-2.5">Tracking No.</th>
                        <th className="px-3 py-2.5">Delivered Date</th>
                        <th className="px-3 py-2.5">Received Date</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {matchedPOs.map(po => (
                        <tr key={po.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="px-3 py-2 text-zinc-300 font-medium">{po.rawDate || po.poDate}</td>
                          <td className="px-3 py-2 text-zinc-400 max-w-[140px] truncate">{po.reason || '—'}</td>
                          <td className="px-3 py-2 text-zinc-300">{po.purchaser || po.createdBy || '—'}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {po.buyingForPlatform || 'All Platforms'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium text-white max-w-[140px] truncate">
                            {po.buyingFromVendor || po.supplierName}
                          </td>
                          <td className="px-3 py-2 text-zinc-300">{po.paymentMethod || 'Payoneer'}</td>
                          <td className="px-3 py-2 text-center font-mono font-medium text-white">
                            {po.qtyPurchased ?? po.totalQuantity}
                          </td>
                          <td className="px-3 py-2 text-zinc-300 max-w-[130px] truncate">
                            {String(po.lineItem || '1')}
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-blue-400">{po.poNumber}</td>
                          <td className="px-3 py-2 text-right font-semibold text-white">
                            {currencySymbol}{(po.poAmount ?? po.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                              po.paymentStatus === 'Paid'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}>
                              {po.paymentStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-400 max-w-[110px] truncate">
                            {po.trackingNumber || '—'}
                          </td>
                          <td className="px-3 py-2 text-zinc-400">{po.deliveredDate || '—'}</td>
                          <td className="px-3 py-2 text-zinc-400">{po.receivedDate || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => {
                                handleInputChange(po.poNumber, po.poDate || '');
                              }}
                              className="px-2 py-1 text-[11px] font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
