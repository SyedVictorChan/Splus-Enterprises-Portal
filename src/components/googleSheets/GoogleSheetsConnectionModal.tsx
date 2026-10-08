import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Radio,
  Sliders,
  Sparkles,
  Lock,
  ChevronDown
} from 'lucide-react';
import {
  GoogleSheetsLiveService,
  LiveSheetTarget,
  LiveSheetConnectionConfig
} from '../../services/googleSheetsLiveService';
import {
  getGoogleSheetsAccessToken,
  requestGoogleSheetsAccess
} from '../../services/firebase';

interface Props {
  target: LiveSheetTarget;
  title: string;
  currentConfig: LiveSheetConnectionConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GoogleSheetsConnectionModal: React.FC<Props> = ({
  target,
  title,
  currentConfig,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [urlInput, setUrlInput] = useState<string>(
    currentConfig?.spreadsheetUrl ||
      (currentConfig?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${currentConfig.spreadsheetId}/edit` : '')
  );
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>(currentConfig?.spreadsheetTitle || '');
  const [selectedSheet, setSelectedSheet] = useState<string>(currentConfig?.sheetName || 'Sheet1');
  const [availableSheets, setAvailableSheets] = useState<string[]>(currentConfig?.availableSheets || ['Sheet1']);
  const [syncInterval, setSyncInterval] = useState<number>(currentConfig?.autoSyncIntervalSec || 60);

  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    const token = await getGoogleSheetsAccessToken();
    setHasToken(Boolean(token));
  };

  const handleAuthorizeGoogle = async () => {
    setIsAuthenticating(true);
    setErrorMsg(null);
    try {
      await requestGoogleSheetsAccess();
      setHasToken(true);
      setSuccessMsg('Google account authorized successfully.');
      if (urlInput) {
        await handleFetchMetadata();
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to authorize Google Sheets account.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFetchMetadata = async () => {
    const id = GoogleSheetsLiveService.extractSpreadsheetId(urlInput);
    if (!id) {
      setErrorMsg('Please enter a valid Google Sheets URL or Spreadsheet ID.');
      return;
    }

    setIsLoadingMetadata(true);
    setErrorMsg(null);
    try {
      const meta = await GoogleSheetsLiveService.fetchSpreadsheetMetadata(id);
      setSpreadsheetTitle(meta.title);
      setAvailableSheets(meta.sheets);
      if (meta.sheets.length > 0 && !meta.sheets.includes(selectedSheet)) {
        setSelectedSheet(meta.sheets[0]);
      }

      // Also preview first sheet values
      const targetSheet = meta.sheets[0] || selectedSheet;
      try {
        const rows = await GoogleSheetsLiveService.fetchSheetValues(id, targetSheet);
        setPreviewRows(rows.slice(0, 5));
      } catch (err) {
        // Silent preview error, user might need to authorize
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Could not access sheet. You may need to click "Authorize Google Account".');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleConnectAndSave = async () => {
    const id = GoogleSheetsLiveService.extractSpreadsheetId(urlInput);
    if (!id) {
      setErrorMsg('Please provide a valid Google Sheet URL or ID.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const config: LiveSheetConnectionConfig = {
        target,
        spreadsheetId: id,
        spreadsheetUrl: urlInput,
        spreadsheetTitle: spreadsheetTitle || `${title} Spreadsheet`,
        sheetName: selectedSheet || 'Sheet1',
        availableSheets,
        isConnected: true,
        autoSyncIntervalSec: syncInterval,
        lastSyncStatus: 'syncing',
        lastSyncMessage: 'Connecting and performing initial sync...',
        connectedAt: new Date().toISOString()
      };

      await GoogleSheetsLiveService.saveConnectionConfig(config);

      // Perform initial sync immediately
      const syncRes =
        target === 'purchasing'
          ? await GoogleSheetsLiveService.syncPurchasing(true)
          : await GoogleSheetsLiveService.syncRMA(true);

      if (syncRes.success) {
        onSuccess();
      } else {
        setErrorMsg(`Connected, but initial sync had issues: ${syncRes.message}`);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to save connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to disconnect this Google Sheet from the ${title}? The dashboard will stop receiving live updates.`
    );
    if (!confirmed) return;

    await GoogleSheetsLiveService.disconnect(target);
    onSuccess();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Connect Live Google Sheet
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  {title}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Continuous real-time synchronization directly from your Google Drive spreadsheet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Google Authorization Status */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${hasToken ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {hasToken ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  {hasToken ? 'Google Account Authorized' : 'Google Sheets Permission'}
                </h4>
                <p className="text-xs text-slate-400">
                  {hasToken
                    ? 'Granted read-only access to synchronize spreadsheet data with permission.'
                    : 'Authorize access so the dashboard can read live spreadsheet updates.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleAuthorizeGoogle}
              disabled={isAuthenticating}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                hasToken
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              {isAuthenticating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : hasToken ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {hasToken ? 'Re-authorize Account' : 'Authorize Google Account'}
            </button>
          </div>

          {/* Spreadsheet Link Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Google Sheet URL or Spreadsheet ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleFetchMetadata}
                disabled={isLoadingMetadata || !urlInput.trim()}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoadingMetadata ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Inspect Sheet
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Paste the full browser link to your Google Spreadsheet.
            </p>
          </div>

          {/* Worksheet Tab Selection */}
          {availableSheets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Worksheet / Tab
                </label>
                <div className="relative">
                  <select
                    value={selectedSheet}
                    onChange={e => setSelectedSheet(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 appearance-none"
                  >
                    {availableSheets.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Automatic Sync Interval
                </label>
                <div className="relative">
                  <select
                    value={syncInterval}
                    onChange={e => setSyncInterval(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 appearance-none"
                  >
                    <option value={30}>Every 30 seconds (High Frequency)</option>
                    <option value={60}>Every 60 seconds (Recommended)</option>
                    <option value={120}>Every 2 minutes</option>
                    <option value={300}>Every 5 minutes</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Live Data Preview */}
          {previewRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Live Data Preview (First 5 Rows)
                </span>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Auto-columns detected
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto max-h-40">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800">
                    <tr>
                      {(previewRows[0] || []).map((col: any, i: number) => (
                        <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">
                          {String(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {previewRows.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/40">
                        {row.map((val: any, cIdx: number) => (
                          <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-300">
                            {String(val || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Architecture Guarantee Info */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              Live Continuous Data Architecture
            </div>
            <p>
              • <strong>New Rows:</strong> Adding rows to this Google Sheet automatically updates metrics, charts, and tables across all team members.
            </p>
            <p>
              • <strong>Edited Rows:</strong> Modifying existing amounts or statuses updates records in-place without creating duplicates.
            </p>
            <p>
              • <strong>Safe Retention:</strong> Rows removed from the sheet are safely archived from active metrics while keeping historical reporting intact.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div>
            {currentConfig?.isConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline"
              >
                Disconnect Google Sheet
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConnectAndSave}
              disabled={isSaving || !urlInput.trim()}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-900/30 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Connecting & Syncing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Save & Connect Live Source
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
