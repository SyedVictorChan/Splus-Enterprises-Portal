import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  Calendar,
  Layers,
  ArrowUpRight,
  UploadCloud,
  Download
} from 'lucide-react';
import { ImportBatch, SalesRecord } from '../../types';
import { StorageService } from '../../services/storage';
import { downloadDailyReportTemplate } from '../../services/dailySheetService';
import { useAuth } from '../../context/AuthContext';

interface ImportHistoryViewProps {
  batches: ImportBatch[];
  records: SalesRecord[];
  onOpenImport: () => void;
  onBatchesUpdated: () => void;
}

export const ImportHistoryView: React.FC<ImportHistoryViewProps> = ({
  batches,
  records,
  onOpenImport,
  onBatchesUpdated
}) => {
  const { isAdmin } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);

  const handleDeleteBatch = (batchId: string, fileName: string) => {
    if (!isAdmin) {
      alert('Access Denied: Only organization administrators are permitted to delete sales import batches.');
      return;
    }
    if (confirm(`Are you sure you want to remove import batch "${fileName}"? This will delete all associated sales records from the central organization database.`)) {
      StorageService.deleteBatch(batchId);
      onBatchesUpdated();
      if (selectedBatch?.id === batchId) setSelectedBatch(null);
    }
  };

  const batchRecords = selectedBatch
    ? records.filter(r => r.importBatchId === selectedBatch.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
              <FileSpreadsheet size={18} />
            </div>
            Data Import & History
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
            Audit trail of imported sales spreadsheets. Every ingested row is mapped, validated, and deduplicated before storing into the analytics engine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadDailyReportTemplate(undefined, 'xlsx')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold"
          >
            <Download size={14} /> Download Template
          </button>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-xs font-semibold shadow-xs"
          >
            <UploadCloud size={15} /> Import New Sheet
          </button>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="font-bold text-sm text-zinc-900 dark:text-white">
            Ingestion Log ({batches.length} files)
          </div>
          <div className="text-xs text-zinc-500">
            Click "Inspect" to view row-level normalized records
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-xs">
            No spreadsheets have been imported yet. Click "Import New Sheet" to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3.5 pl-6">File Name</th>
                  <th className="p-3.5">Import Date</th>
                  <th className="p-3.5">Rows Ingested</th>
                  <th className="p-3.5">Date Range</th>
                  <th className="p-3.5">Marketplaces</th>
                  <th className="p-3.5">Stores</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Imported By</th>
                  <th className="p-3.5 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
                {batches.map(batch => (
                  <tr key={batch.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
                    <td className="p-3.5 pl-6 font-semibold flex items-center gap-2">
                      <FileSpreadsheet size={16} className="text-zinc-400 shrink-0" />
                      <div className="truncate max-w-xs" title={batch.fileName}>
                        <div>{batch.fileName}</div>
                        <div className="text-[10px] text-zinc-400 font-normal">Sheet: {batch.sheetName}</div>
                      </div>
                    </td>
                    <td className="p-3.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(batch.importedAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="p-3.5 font-mono font-semibold">
                      {batch.validRows.toLocaleString()}
                      {batch.duplicateRows > 0 && (
                        <span className="ml-1 text-[10px] text-zinc-400">
                          ({batch.duplicateRows} skipped)
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] whitespace-nowrap text-zinc-500">
                      {batch.dateRange.start} → {batch.dateRange.end}
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {batch.marketplaces.slice(0, 3).map(m => (
                          <span key={m} className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                            {m}
                          </span>
                        ))}
                        {batch.marketplaces.length > 3 && (
                          <span className="text-[10px] text-zinc-400">+{batch.marketplaces.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-zinc-700 dark:text-zinc-300">
                      {batch.stores.length} stores
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                        {batch.status === 'Successful' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                        {batch.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-zinc-500 text-xs">{batch.importedBy}</td>
                    <td className="p-3.5 pr-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedBatch(batch)}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium"
                        title="Inspect batch records"
                      >
                        <Eye size={14} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteBatch(batch.id, batch.fileName)}
                          className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors"
                          title="Delete batch and remove records (Admin only)"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Inspection Drawer/Modal */}
      {selectedBatch && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-zinc-400 tracking-wider">
                Batch Details
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {selectedBatch.fileName} — {batchRecords.length} stored records
              </h3>
            </div>
            <button
              onClick={() => setSelectedBatch(null)}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white px-3 py-1 rounded bg-zinc-100 dark:bg-zinc-800"
            >
              Close Inspector
            </button>
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto max-h-72">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 sticky top-0">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Order ID</th>
                  <th className="p-2.5">Marketplace</th>
                  <th className="p-2.5">Store</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">SKU</th>
                  <th className="p-2.5 text-right">Units</th>
                  <th className="p-2.5 text-right">Sales</th>
                  <th className="p-2.5 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
                {batchRecords.slice(0, 50).map(r => (
                  <tr key={r.id}>
                    <td className="p-2.5 font-mono">{r.date}</td>
                    <td className="p-2.5 font-mono">{r.orderId}</td>
                    <td className="p-2.5">{r.marketplace}</td>
                    <td className="p-2.5">{r.store}</td>
                    <td className="p-2.5 truncate max-w-xs">{r.product}</td>
                    <td className="p-2.5 font-mono">{r.sku}</td>
                    <td className="p-2.5 text-right font-semibold">{r.units}</td>
                    <td className="p-2.5 text-right font-bold text-zinc-900 dark:text-white">
                      {r.sales.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right">
                      {r.profit !== undefined ? r.profit.toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batchRecords.length > 50 && (
            <div className="text-[11px] text-zinc-400 text-center">
              Showing first 50 records of {batchRecords.length.toLocaleString()} total in this batch.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
