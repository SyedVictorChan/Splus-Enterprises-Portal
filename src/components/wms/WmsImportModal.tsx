import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ArrowRight,
  ShieldCheck,
  Eye,
  Sliders,
  Layers,
  Database,
  Building2,
  RefreshCw,
  Download
} from 'lucide-react';
import {
  CatalogStandardField,
  WmsProductRecord,
  WmsReportAnalysis
} from '../../types/productCatalog';
import {
  analyzeAndParseWmsReport,
  CATALOG_STANDARD_FIELDS,
  saveMappingToMemory
} from '../../services/wmsReportParser';
import { ProductCatalogService } from '../../services/productCatalogService';

interface WmsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (records: WmsProductRecord[]) => void;
}

type ModalStep = 'upload' | 'preview' | 'mapping' | 'issues';

export const WmsImportModal: React.FC<WmsImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [currentStep, setCurrentStep] = useState<ModalStep>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [analysis, setAnalysis] = useState<WmsReportAnalysis | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tempMapping, setTempMapping] = useState<Record<string, CatalogStandardField>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await analyzeAndParseWmsReport(file);
      setAnalysis(result);
      setTempMapping(result.mapping);
      setCurrentStep('preview');
    } catch (err: any) {
      console.error('Error analyzing WMS report:', err);
      setErrorMessage(
        err?.message || 'Failed to inspect and parse the WMS Stock Status Report. Please ensure the file contains valid stock data.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleLoadSampleReference = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/StockStatusReportTest.xls');
      if (!response.ok) {
        throw new Error('Could not fetch sample reference file from server');
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], 'StockStatusReportTest.xls', {
        type: 'application/vnd.ms-excel'
      });
      await handleFileSelect(sampleFile);
    } catch (err: any) {
      console.error('Error loading reference sample:', err);
      setErrorMessage('Could not load StockStatusReportTest.xls sample file: ' + err.message);
      setIsProcessing(false);
    }
  };

  const handleConfirmMapping = async () => {
    if (!analysis) return;
    saveMappingToMemory(analysis.headers, tempMapping);
    // Re-apply mapping
    setIsProcessing(true);
    try {
      const currentFile = new File(
        [new Blob([''], { type: 'text/plain' })],
        analysis.fileName
      );
      // Update analysis state with confirmed mapping
      setAnalysis(prev => (prev ? { ...prev, mapping: tempMapping, isFromMemory: true } : null));
      setCurrentStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!analysis || !analysis.parsedRecords.length) return;
    setIsImporting(true);
    try {
      await ProductCatalogService.saveImportedProducts(analysis.parsedRecords, replaceExisting);
      onImportComplete(analysis.parsedRecords);
      onClose();
    } catch (err: any) {
      console.error('Error importing product catalog:', err);
      setErrorMessage('Failed to save products to database: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                WMS Stock Status Report Importer
                <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                  Universal Format Engine
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Supports Excel HTML exports (.xls), binary Excel (.xlsx/.xls), and CSV reports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-red-500" />
            <div className="flex-1">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: UPLOAD */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx,.csv,.html,.htm"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Upload size={28} />
                </div>
                <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                  Upload WMS Stock Status Report
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mb-4">
                  Drag & drop your <span className="font-semibold text-zinc-700 dark:text-zinc-300">StockStatusReportTest.xls</span> or browse from your computer. Our parser detects HTML-based Excel exports, ignores presentation frames, and isolates real product stock rows.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium">
                  Select File (.xls, .xlsx, .csv)
                </div>
              </div>

              {/* One-Click Reference Sample Option */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Database size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Test Reference Report: StockStatusReportTest.xls
                    </h4>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                      Inspect the exact WMS Excel HTML format including metadata, base SKU hierarchy (77Z32AA, +AA, +BB, +CC), and multi-warehouse distribution.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="/StockStatusReportTest.xls"
                    download="StockStatusReportTest.xls"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-50 transition-colors"
                  >
                    <Download size={13} />
                    Download .xls
                  </a>
                  <button
                    onClick={handleLoadSampleReference}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    {isProcessing ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <ArrowRight size={13} />
                    )}
                    Load Reference Sample
                  </button>
                </div>
              </div>

              {/* Format Handling Specs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    Format Signature Detection
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Inspects file byte headers. Never rejects files because "extension is .xls but content is HTML". Extracts DOM tables reliably.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    <Layers size={14} className="text-blue-500" />
                    Smart Table Identification
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Filters out company titles, run dates, filter criteria, and footer totals. Only actual product rows enter the catalog.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                    <Building2 size={14} className="text-purple-500" />
                    Exact SKU & Warehouse Logic
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Preserves exact Part Numbers (e.g. 77Z32AA+AA). Links Base Parts and preserves multi-warehouse locations.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {currentStep === 'preview' && analysis && (
            <div className="space-y-6">
              {/* Detection Summary Box */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">File Name</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block font-mono">
                    {analysis.fileName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Detected Format</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                    <CheckCircle2 size={12} />
                    {analysis.detectedFormat}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Detected Sheet</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                    {analysis.detectedSheetName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Data Rows</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {analysis.parsedRecords.length.toLocaleString()} valid rows
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Detected SKU Col</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                    {analysis.detectedSkuColumn}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Detected Qty Col</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400 truncate block">
                    {analysis.detectedQtyColumn}
                  </span>
                </div>
              </div>

              {/* Validation Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Total Detected Rows</span>
                  <span className="text-lg font-black text-zinc-800 dark:text-zinc-100">
                    {analysis.validation.totalRowsDetected}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">Valid Products</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {analysis.validation.validProducts}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300 block">Multi-Loc / Duplicates</span>
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                    {analysis.validation.duplicateSkus}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Metadata / Footers</span>
                  <span className="text-lg font-black text-zinc-600 dark:text-zinc-300">
                    {analysis.metadataRows.length} excluded
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-center items-center">
                  <button
                    onClick={() => setCurrentStep('mapping')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-colors"
                  >
                    <Sliders size={13} />
                    Review Mapping
                  </button>
                  {analysis.isFromMemory && (
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      Matched Saved Memory
                    </span>
                  )}
                </div>
              </div>

              {/* Sample Products Table Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <Eye size={14} className="text-blue-500" />
                    Product Catalog Extraction Preview (First 8 Rows)
                  </h4>
                  {analysis.validation.issues.length > 0 && (
                    <button
                      onClick={() => setCurrentStep('issues')}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
                    >
                      <AlertTriangle size={13} />
                      Review {analysis.validation.issues.length} Notes / Warnings
                    </button>
                  )}
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-100 dark:bg-zinc-800/70 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold">
                      <tr>
                        <th className="p-2.5">Part No. (original_sku)</th>
                        <th className="p-2.5">Base Part</th>
                        <th className="p-2.5">Extension</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right">Available Qty</th>
                        <th className="p-2.5">Warehouse</th>
                        <th className="p-2.5">Location / Bin</th>
                        <th className="p-2.5 text-right">Unit Cost</th>
                        <th className="p-2.5">Supplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {analysis.sampleProducts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40">
                          <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {p.original_sku}
                          </td>
                          <td className="p-2.5 font-mono text-zinc-600 dark:text-zinc-300">
                            {p.base_sku}
                          </td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {p.extension}
                            </span>
                          </td>
                          <td className="p-2.5 max-w-xs truncate text-zinc-700 dark:text-zinc-300" title={p.product_name}>
                            {p.product_name}
                          </td>
                          <td className="p-2.5 font-bold text-right text-emerald-600 dark:text-emerald-400 font-mono">
                            {p.available_qty.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-zinc-600 dark:text-zinc-300 font-mono text-[11px]">
                            {p.warehouse || '—'}
                          </td>
                          <td className="p-2.5 text-zinc-600 dark:text-zinc-300 font-mono text-[11px]">
                            {p.location || '—'}
                          </td>
                          <td className="p-2.5 text-right text-zinc-600 dark:text-zinc-300 font-mono">
                            {p.unit_cost !== undefined ? `$${p.unit_cost.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2.5 text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">
                            {p.supplier || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Exclusion Inspection */}
              {analysis.metadataRows.length > 0 && (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 text-xs">
                  <div className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                    <Info size={14} className="text-blue-500" />
                    Excluded WMS Presentation &amp; Filter Rows ({analysis.metadataRows.length} lines detected before table header)
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono space-y-0.5">
                    {analysis.metadataRows.map((line, i) => (
                      <div key={i} className="truncate">• {line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: MAPPING REVIEW */}
          {currentStep === 'mapping' && analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    WMS Column Mapping Configuration
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Splus remembers verified mappings for this WMS report structure for future automatic imports.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep('preview')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-semibold"
                >
                  Back to Preview
                </button>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-800/70 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold">
                    <tr>
                      <th className="p-3">WMS Report Column Header</th>
                      <th className="p-3">Target Splus Catalog Field</th>
                      <th className="p-3">Confidence / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {analysis.headers.map(header => {
                      const currentMapped = tempMapping[header] || 'ignore';
                      const confidence = analysis.confidenceScores[header] || 50;
                      return (
                        <tr key={header} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">
                            {header}
                          </td>
                          <td className="p-3">
                            <select
                              value={currentMapped}
                              onChange={e => {
                                setTempMapping(prev => ({
                                  ...prev,
                                  [header]: e.target.value as CatalogStandardField
                                }));
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                              <option value="ignore">— Ignore / Do Not Map —</option>
                              {CATALOG_STANDARD_FIELDS.map(f => (
                                <option key={f.field} value={f.field}>
                                  {f.label} {f.required ? '*(Required)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            {currentMapped !== 'ignore' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={12} />
                                {confidence}% confidence
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">Ignored</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleConfirmMapping}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors"
                >
                  Save Mapping &amp; Return to Preview
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ISSUES REVIEW */}
          {currentStep === 'issues' && analysis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    Import Validation Notes &amp; Warnings
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {analysis.validation.issues.length} notifications detected during WMS row analysis.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentStep('preview')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-xs font-semibold"
                >
                  Back to Preview
                </button>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-800/70 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold">
                    <tr>
                      <th className="p-2.5">Row #</th>
                      <th className="p-2.5">SKU / Item</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {analysis.validation.issues.map((iss, i) => (
                      <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2.5 font-mono text-zinc-500">{iss.rowNumber}</td>
                        <td className="p-2.5 font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {iss.sku || '—'}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              iss.issueType === 'duplicate_sku'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            }`}
                          >
                            {iss.issueType}
                          </span>
                        </td>
                        <td className="p-2.5 text-zinc-700 dark:text-zinc-300">{iss.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {analysis && (
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={e => setReplaceExisting(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Replace existing Product Catalog (otherwise merge new stock)</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            {currentStep === 'preview' && analysis && (
              <button
                onClick={handleExecuteImport}
                disabled={isImporting || analysis.parsedRecords.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Importing to Central Splus Catalog...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Import {analysis.parsedRecords.length.toLocaleString()} Valid Product Rows
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
