import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Package, ShoppingBag, Store, Globe, ArrowRight } from 'lucide-react';
import { SalesRecord } from '../../types';
import { formatCurrency } from '../../services/analytics';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SalesRecord[];
  currency: string;
  onSelectRecord: (record: SalesRecord) => void;
  onSelectStore?: (storeName: string, marketplace: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  records,
  currency,
  onSelectRecord,
  onSelectStore
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const matches: SalesRecord[] = [];
    for (const r of records) {
      if (
        r.product.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.orderId.toLowerCase().includes(q) ||
        r.store.toLowerCase().includes(q) ||
        r.marketplace.toLowerCase().includes(q)
      ) {
        matches.push(r);
        if (matches.length >= 30) break; // limit to 30 results for crisp performance
      }
    }
    return matches;
  }, [query, records]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 gap-3">
          <Search size={20} className="text-black dark:text-white shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search by SKU, Product name, Order ID, Store, Marketplace..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-sm focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
              <X size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {query.trim().length < 2 ? (
            <div className="text-center py-12 text-zinc-400 text-xs">
              Type at least 2 characters to search across all orders, products, and channels.
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              No matching records found for "{query}".
            </div>
          ) : (
            searchResults.map(r => (
              <div
                key={r.id}
                onClick={() => {
                  onSelectRecord(r);
                  onClose();
                }}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs truncate">
                        {r.product}
                      </span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                        {r.sku}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <ShoppingBag size={11} /> {r.orderId}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Globe size={11} /> {r.marketplace}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Store size={11} /> {r.store}
                      </span>
                      <span>•</span>
                      <span>{r.date}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-4 flex items-center gap-3">
                  <div>
                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                      {formatCurrency(r.sales, currency)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {r.units} {r.units === 1 ? 'unit' : 'units'}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-850 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex justify-between items-center">
          <span>{searchResults.length} results displayed</span>
          <span>Press ESC to exit</span>
        </div>
      </div>
    </div>
  );
};
