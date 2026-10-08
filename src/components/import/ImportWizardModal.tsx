import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Download,
  Check,
  HelpCircle,
  X,
  Calendar,
  DollarSign,
  ShoppingCart,
  Receipt,
  Ban
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  autoMapHeaders,
  parseSpreadsheetFile,
  STANDARD_FIELDS,
  WorkbookSummary
} from '../../services/excelParser';
import { normalizeRows } from '../../services/dataNormalizer';
import { StorageService } from '../../services/storage';
import {
  DailyReportData,
  ImportBatch,
  SalesRecord,
  StandardField,
  ValidationIssue,
  REGISTERED_STORES
} from '../../types';
import {
  downloadDailyReportTemplate,
  isDailySummaryFormat,
  parseDailySummarySheet,
  convertDailyReportToSalesRecords,
  DAILY_STORES_ORDER,
  getYesterdayDateString
} from '../../services/dailySheetService';
import { useAuth } from '../../context/AuthContext';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (records: SalesRecord[], batch: ImportBatch) => void;
}

type Step = 'upload' | 'daily_summary' | 'sheets' | 'mapping' | 'validation' | 'complete';

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Daily Summary specific state
  const [dailyReport, setDailyReport] = useState<DailyReportData | null>(null);
  const [dailyReportDate, setDailyReportDate] = useState<string>(
    getYesterdayDateString()
  );
  const [purchasingAmountInput, setPurchasingAmountInput] = useState<string>('0');

  // Parsed workbook data for standard pipeline
  const [workbook, setWorkbook] = useState<WorkbookSummary | null>(null);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);

  // Mapping state: sheetName -> { header -> StandardField | 'ignore' }
  const [sheetMappings, setSheetMappings] = useState<Record<string, Record<string, StandardField | 'ignore'>>>({});
  const [activeMappingSheet, setActiveMappingSheet] = useState<string>('');

  // Validation results
  const [validationResult, setValidationResult] = useState<{
    validRecords: SalesRecord[];
    duplicateRecords: SalesRecord[];
    issues: ValidationIssue[];
    importBatchId: string;
  } | null>(null);

  // Duplicate resolution choice: 'skip' | 'include'
  const [duplicateOption, setDuplicateOption] = useState<'skip' | 'include'>('skip');
  const [showIssuesReview, setShowIssuesReview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setWorkbook(null);
    setDailyReport(null);
    setDailyReportDate(getYesterdayDateString());
    setSelectedSheets([]);
    setSheetMappings({});
    setValidationResult(null);
    setErrorMessage(null);
  };

  const handleFileProcess = async (uploadedFile: File) => {
    const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setErrorMessage('Please upload a valid Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Check if this is the user's structured Daily Sales Breakdown template
      const buffer = await uploadedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];
      const grid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (isDailySummaryFormat(grid)) {
        const parsedDaily = parseDailySummarySheet(wb);
        if (parsedDaily && parsedDaily.rows.length > 0) {
          setFile(uploadedFile);
          setDailyReport(parsedDaily);
          setDailyReportDate(parsedDaily.date);
          setPurchasingAmountInput(parsedDaily.totalPurchasingAmount.toString());
          setStep('daily_summary');
          setIsLoading(false);
          return;
        }
      }

      // 2. Standard multi-column transactional spreadsheet pipeline
      const summary = await parseSpreadsheetFile(uploadedFile);
      if (summary.sheetNames.length === 0) {
        throw new Error('No sheets found in workbook.');
      }

      setFile(uploadedFile);
      setWorkbook(summary);

      // Auto select first sheet by default
      setSelectedSheets([summary.sheetNames[0]]);

      // Generate initial mappings for all sheets
      const mappings: Record<string, Record<string, StandardField | 'ignore'>> = {};
      for (const sheetName of summary.sheetNames) {
        const headers = summary.sheetsData[sheetName].headers;
        mappings[sheetName] = autoMapHeaders(headers);
      }
      setSheetMappings(mappings);
      setActiveMappingSheet(summary.sheetNames[0]);

      if (summary.sheetNames.length > 1) {
        setStep('sheets');
      } else {
        setStep('mapping');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to read spreadsheet file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Confirm and ingest Daily Summary Report
  const handleConfirmDailySummary = async () => {
    if (!dailyReport) return;

    const purchasingNum = parseFloat(purchasingAmountInput) || 0;
    const finalReport: DailyReportData = {
      ...dailyReport,
      date: dailyReportDate,
      totalPurchasingAmount: purchasingNum
    };

    const batchId = `batch_daily_${Date.now()}`;
    const { records: generatedRecords, batch } = convertDailyReportToSalesRecords(finalReport, batchId);

    const userIdentifier = user?.displayName || user?.email || 'Operations Feed';
    batch.importedBy = userIdentifier;

    // Persist daily snapshot & purchasing
    StorageService.saveDailyReport(finalReport);
    if (purchasingNum > 0) {
      StorageService.savePurchasingRecord({
        date: dailyReportDate,
        purchasingAmount: purchasingNum
      });
    }

    // Persist sales records
    const updatedRecords = await StorageService.addRecords(generatedRecords, batch, userIdentifier);
    onImportComplete(updatedRecords, batch);
    setStep('complete');
  };

  // Transactional sheet helpers
  const handleToggleSheet = (sheetName: string) => {
    if (selectedSheets.includes(sheetName)) {
      if (selectedSheets.length === 1) return;
      setSelectedSheets(selectedSheets.filter(s => s !== sheetName));
    } else {
      setSelectedSheets([...selectedSheets, sheetName]);
    }
  };

  const handleMappingChange = (sheetName: string, header: string, field: StandardField | 'ignore') => {
    setSheetMappings(prev => ({
      ...prev,
      [sheetName]: {
        ...(prev[sheetName] || {}),
        [header]: field
      }
    }));
  };

  const handleProceedToValidation = () => {
    if (!workbook) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const batchId = `batch_${Date.now()}`;
      let allValid: SalesRecord[] = [];
      let allDuplicates: SalesRecord[] = [];
      let allIssues: ValidationIssue[] = [];

      for (const sheetName of selectedSheets) {
        const sheetData = workbook.sheetsData[sheetName];
        const mapping = sheetMappings[sheetName] || {};
        const { validRecords, duplicateRecords, issues } = normalizeRows(
          sheetData.rows,
          mapping,
          batchId,
          sheetName
        );

        allValid = [...allValid, ...validRecords];
        allDuplicates = [...allDuplicates, ...duplicateRecords];
        allIssues = [...allIssues, ...issues];
      }

      setValidationResult({
        validRecords: allValid,
        duplicateRecords: allDuplicates,
        issues: allIssues,
        importBatchId: batchId
      });

      setStep('validation');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred during data normalization.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmStore = async () => {
    if (!validationResult || !workbook) return;

    const { validRecords, duplicateRecords, issues, importBatchId } = validationResult;
    const recordsToSave = duplicateOption === 'include'
      ? [...validRecords, ...duplicateRecords]
      : validRecords;

    if (recordsToSave.length === 0) {
      setErrorMessage('No valid records to import.');
      return;
    }

    const allDates = recordsToSave.map(r => r.date).sort();
    const startDate = allDates[0] || new Date().toISOString().split('T')[0];
    const endDate = allDates[allDates.length - 1] || startDate;

    const marketplaces: string[] = Array.from(new Set(recordsToSave.map(r => r.marketplace)));
    const stores: string[] = Array.from(new Set(recordsToSave.map(r => r.store)));

    const userIdentifier = user?.displayName || user?.email || 'Operations Feed';

    const batch: ImportBatch = {
      id: importBatchId,
      fileName: workbook.fileName,
      sheetName: selectedSheets.join(', '),
      importedAt: new Date().toISOString(),
      importedBy: userIdentifier,
      totalRows: validRecords.length + duplicateRecords.length + (issues.length > 0 ? issues.length : 0),
      validRows: validRecords.length,
      duplicateRows: duplicateRecords.length,
      invalidRows: issues.filter(i => i.issueType === 'invalid_date').length,
      dateRange: { start: startDate, end: endDate },
      marketplaces,
      stores,
      status: issues.length > 0 ? 'Warning' : 'Successful'
    };

    setIsLoading(true);
    try {
      const updatedRecords = await StorageService.addRecords(recordsToSave, batch, userIdentifier);
      onImportComplete(updatedRecords, batch);
      setStep('complete');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to sync imported data to central database.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="text-black dark:text-white" size={18} />
              Import Daily Sales Sheet
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Automated recognition for daily store breakdowns & purchasing amounts
            </p>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Steps Indicator */}
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 'upload'
                  ? 'bg-black dark:bg-white text-white dark:text-black font-bold'
                  : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
              }`}
            >
              1
            </span>
            <span className={step === 'upload' ? 'text-black dark:text-white font-bold' : 'text-zinc-500'}>
              Upload Daily Sheet
            </span>
          </div>

          <div className="w-8 h-px bg-zinc-300 dark:bg-zinc-700"></div>

          {step === 'daily_summary' ? (
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-black dark:bg-white text-white dark:text-black font-bold">
                2
              </span>
              <span className="text-black dark:text-white font-bold">
                Review Daily Breakdown & Purchasing
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    step === 'sheets'
                      ? 'bg-black dark:bg-white text-white dark:text-black font-bold'
                      : ['mapping', 'validation', 'complete'].includes(step)
                      ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  2
                </span>
                <span className={step === 'sheets' ? 'text-black dark:text-white font-bold' : 'text-zinc-500'}>
                  Sheets
                </span>
              </div>

              <div className="w-8 h-px bg-zinc-300 dark:bg-zinc-700"></div>

              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    step === 'mapping'
                      ? 'bg-black dark:bg-white text-white dark:text-black font-bold'
                      : ['validation', 'complete'].includes(step)
                      ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                  }`}
                >
                  3
                </span>
                <span className={step === 'mapping' ? 'text-black dark:text-white font-bold' : 'text-zinc-500'}>
                  Map Columns
                </span>
              </div>
            </>
          )}

          <div className="w-8 h-px bg-zinc-300 dark:bg-zinc-700"></div>

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                step === 'complete'
                  ? 'bg-black dark:bg-white text-white dark:text-black font-bold'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              {step === 'daily_summary' ? '3' : '4'}
            </span>
            <span className={step === 'complete' ? 'text-black dark:text-white font-bold' : 'text-zinc-500'}>
              Done
            </span>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-black dark:text-white" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Daily Sample Template Download Banner */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Download size={15} />
                    <span>Download Daily Report Template (Excel / CSV)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                      Pre-set for Yesterday ({getYesterdayDateString()})
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">
                    Formatted with your exact 14 storefronts and Purchasing Breakdown table. Defaults to yesterday's closed day ({getYesterdayDateString()}) so you can reconcile figures one day in arrears.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => downloadDailyReportTemplate(undefined, 'xlsx')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white dark:bg-white dark:text-black text-xs font-semibold shadow-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                    title={`Download template dated for yesterday (${getYesterdayDateString()})`}
                  >
                    <Download size={13} /> Yesterday's Sheet (.XLSX)
                  </button>
                  <button
                    onClick={() => downloadDailyReportTemplate(undefined, 'csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Download size={13} /> .CSV
                  </button>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-black dark:hover:border-white rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/60 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform border border-zinc-200 dark:border-zinc-700 shadow-xs">
                  {isLoading ? (
                    <RefreshCw size={24} className="animate-spin" />
                  ) : (
                    <Upload size={24} />
                  )}
                </div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
                  Drag & drop your daily sheet here, or click to browse
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-sm mx-auto">
                  Automatically detects your daily <span className="font-semibold text-zinc-800 dark:text-zinc-200">Sales Breakdown</span> & <span className="font-semibold text-zinc-800 dark:text-zinc-200">Purchasing Amount</span>.
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs transition-colors"
                >
                  Select File from Computer
                </button>
              </div>

              {/* Supported Stores Grid */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-black dark:bg-white"></span>
                  Configured Active Storefronts (14 Stores):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                  {REGISTERED_STORES.map(s => (
                    <div
                      key={s.name}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium truncate"
                      title={s.name}
                    >
                      {s.shortName || s.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP: DAILY SUMMARY PREVIEW */}
          {step === 'daily_summary' && dailyReport && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Top Banner with Date input */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-black text-white dark:bg-white dark:text-black uppercase tracking-wider mb-1">
                    ✨ Daily Sheet Recognized
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Daily Sales Breakdown & Purchasing Ingestion
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    File: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{file?.name}</span> ({dailyReport.rows.length} stores mapped)
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                    <Calendar size={14} /> Report Date:
                  </label>
                  <input
                    type="date"
                    value={dailyReportDate}
                    onChange={e => setDailyReportDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-900 dark:text-white"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDailyReportDate(getYesterdayDateString())}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        dailyReportDate === getYesterdayDateString()
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                      }`}
                      title="Set to Yesterday (1-day arrears standard)"
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyReportDate(new Date().toISOString().split('T')[0])}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        dailyReportDate === new Date().toISOString().split('T')[0]
                          ? 'bg-black text-white dark:bg-white dark:text-black'
                          : 'bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                      }`}
                      title="Set to Today"
                    >
                      Today
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Orders</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-1">
                    {dailyReport.totalOrders.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Sales</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-1">
                    ${dailyReport.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Refunds</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-1">
                    ${dailyReport.totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Cancellation</div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-white mt-1">
                    ${dailyReport.totalCancellations.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black border border-zinc-900 dark:border-white">
                  <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Purchasing</div>
                  <div className="text-lg font-extrabold mt-1">
                    ${(parseFloat(purchasingAmountInput) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Table 1: Sales Breakdown */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 font-bold text-xs text-zinc-900 dark:text-white flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700">
                  <span>Sales Breakdown</span>
                  <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">14 Stores</span>
                </div>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Company Name</th>
                        <th className="py-2 px-3 text-right">No. of Orders</th>
                        <th className="py-2 px-3 text-right">Total Sales</th>
                        <th className="py-2 px-3 text-right">Refunds</th>
                        <th className="py-2 px-3 text-right">Cancellation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {dailyReport.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="py-2 px-3 font-semibold text-zinc-800 dark:text-zinc-200">
                            {r.companyName}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {r.orders}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-zinc-900 dark:text-white">
                            ${r.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                            ${r.refunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-zinc-600 dark:text-zinc-400">
                            {r.cancellation > 0
                              ? `$${r.cancellation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : 'NIL'}
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white border-t border-zinc-300 dark:border-zinc-700">
                        <td className="py-2.5 px-3">Total</td>
                        <td className="py-2.5 px-3 text-right">{dailyReport.totalOrders}</td>
                        <td className="py-2.5 px-3 text-right">
                          ${dailyReport.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          ${dailyReport.totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {dailyReport.totalCancellations > 0
                            ? `$${dailyReport.totalCancellations.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : 'NIL'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: Purchasing Breakdown */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Purchasing Breakdown
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Extracted from daily purchasing balance section
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Total Purchasing Amount ($):
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={purchasingAmountInput}
                    onChange={e => setPurchasingAmountInput(e.target.value)}
                    className="w-40 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-white text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT SHEETS (For transactional workbooks) */}
          {step === 'sheets' && workbook && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Select Sheets to Import
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Workbook contains multiple sheets. Choose which ones you want to ingest.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {workbook.sheetNames.map(sheetName => {
                  const sheetInfo = workbook.sheetsData[sheetName];
                  const isSelected = selectedSheets.includes(sheetName);
                  return (
                    <div
                      key={sheetName}
                      onClick={() => handleToggleSheet(sheetName)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-black dark:border-white bg-zinc-100/50 dark:bg-zinc-800'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 bg-white dark:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                          {sheetName}
                        </span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center ${
                            isSelected ? 'bg-black text-white dark:bg-white dark:text-black' : 'border border-zinc-300 dark:border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {sheetInfo.rowCount.toLocaleString()} rows • {sheetInfo.headers.length} columns
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: MAPPING */}
          {step === 'mapping' && workbook && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Map Spreadsheet Columns
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Verify that your spreadsheet headers match our standard fields.
                  </p>
                </div>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-4">Your Header</th>
                      <th className="py-2.5 px-4">Sample Values</th>
                      <th className="py-2.5 px-4">Maps To Standard Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {workbook.sheetsData[activeMappingSheet || selectedSheets[0]]?.headers.map(header => {
                      const currentField = sheetMappings[activeMappingSheet || selectedSheets[0]]?.[header] || 'ignore';
                      const samples = workbook.sheetsData[activeMappingSheet || selectedSheets[0]]?.sampleRows
                        ?.map(r => r[header])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(', ') || '—';

                      return (
                        <tr key={header} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <td className="py-2.5 px-4 font-bold text-zinc-800 dark:text-zinc-200">
                            {header}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-500 dark:text-zinc-400 truncate max-w-xs font-mono text-[11px]">
                            {samples}
                          </td>
                          <td className="py-2.5 px-4">
                            <select
                              value={currentField}
                              onChange={e =>
                                handleMappingChange(
                                  activeMappingSheet || selectedSheets[0],
                                  header,
                                  e.target.value as any
                                )
                              }
                              className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-medium"
                            >
                              <option value="ignore">Don't Import (Ignore)</option>
                              {STANDARD_FIELDS.map(f => (
                                <option key={f.field} value={f.field}>
                                  {f.label} {f.required ? '*' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: VALIDATION */}
          {step === 'validation' && validationResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">
                    Validation & Duplicate Detection
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {validationResult.validRecords.length.toLocaleString()} valid records ready to commit
                  </div>
                </div>
                {validationResult.duplicateRecords.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">Duplicates:</span>
                    <select
                      value={duplicateOption}
                      onChange={e => setDuplicateOption(e.target.value as any)}
                      className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-xs font-medium bg-white dark:bg-zinc-800"
                    >
                      <option value="skip">Skip ({validationResult.duplicateRecords.length})</option>
                      <option value="include">Include</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP: COMPLETE */}
          {step === 'complete' && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center mx-auto border border-zinc-300 dark:border-zinc-700 shadow-sm">
                <Check size={32} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Daily Sales Sheet Ingested Successfully!
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                Your daily store figures, sales, refunds, cancellations, and purchasing amounts have been saved. All dashboard metrics, trends, and store comparisons have dynamically refreshed.
              </p>
              <div className="pt-4">
                <button
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 font-semibold text-xs shadow-xs transition-colors"
                >
                  View Updated Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-850 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            {step !== 'upload' && step !== 'complete' && (
              <button
                onClick={() => {
                  if (step === 'daily_summary') setStep('upload');
                  else if (step === 'validation') setStep('mapping');
                  else if (step === 'mapping') {
                    if (workbook && workbook.sheetNames.length > 1) setStep('sheets');
                    else setStep('upload');
                  } else if (step === 'sheets') setStep('upload');
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 'daily_summary' && (
              <button
                onClick={handleConfirmDailySummary}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <Check size={15} /> Confirm & Ingest Daily Data
              </button>
            )}

            {step === 'sheets' && (
              <button
                onClick={() => setStep('mapping')}
                disabled={selectedSheets.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 text-xs font-semibold rounded-xl shadow-xs"
              >
                Configure Mapping ({selectedSheets.length} Sheets) <ArrowRight size={14} />
              </button>
            )}

            {step === 'mapping' && (
              <button
                onClick={handleProceedToValidation}
                className="flex items-center gap-1.5 px-5 py-2 bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 text-xs font-semibold rounded-xl shadow-xs"
              >
                Validate & Review <ArrowRight size={14} />
              </button>
            )}

            {step === 'validation' && (
              <button
                onClick={handleConfirmStore}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 text-xs font-semibold rounded-xl shadow-xs"
              >
                Confirm Import & Store <Check size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
