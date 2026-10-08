import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Unlink,
  Layers,
  Clock,
  Check,
  Database
} from 'lucide-react';
import {
  GoogleSheetsLiveService,
  LiveSheetConnectionConfig,
  LiveSyncResult
} from '../../services/googleSheetsLiveService';

export const SalesGoogleSheetsIntegration: React.FC = () => {
  const [config, setConfig] = useState<LiveSheetConnectionConfig | null>(() =>
    GoogleSheetsLiveService.getConnectionConfig('sales')
  );

  const [spreadsheetUrl, setSpreadsheetUrl] = useState(config?.spreadsheetUrl || config?.spreadsheetId || '');
  const [sheetName, setSheetName] = useState(config?.sheetName || 'Sheet1');
  const [availableSheets, setAvailableSheets] = useState<string[]>(config?.availableSheets || ['Sheet1']);
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(config?.autoSyncIntervalSec || 30);

  const [isValidating, setIsValidating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<LiveSyncResult | null>(null);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  // Subscribe to live config updates (cross-tab and remote Firestore)
  useEffect(() => {
    const unsubscribe = GoogleSheetsLiveService.subscribeToConfig('sales', updatedConfig => {
      setConfig(updatedConfig);
      if (updatedConfig) {
        if (updatedConfig.spreadsheetUrl) setSpreadsheetUrl(updatedConfig.spreadsheetUrl);
        else if (updatedConfig.spreadsheetId) setSpreadsheetUrl(updatedConfig.spreadsheetId);
        if (updatedConfig.sheetName) setSheetName(updatedConfig.sheetName);
        if (updatedConfig.availableSheets && updatedConfig.availableSheets.length > 0) {
          setAvailableSheets(updatedConfig.availableSheets);
        }
        if (updatedConfig.autoSyncIntervalSec) {
          setAutoSyncInterval(updatedConfig.autoSyncIntervalSec);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleFetchTabs = async () => {
    const id = GoogleSheetsLiveService.extractSpreadsheetId(spreadsheetUrl);
    if (!id) {
      setFeedback({ type: 'error', text: 'Please enter a valid Google Spreadsheet URL or Spreadsheet ID.' });
      return;
    }

    setIsValidating(true);
    setFeedback({ type: 'info', text: 'Connecting to Google Sheets to discover worksheet tabs...' });

    try {
      const test = await GoogleSheetsLiveService.testSalesConnection(id);
      if (test.success && test.sheets.length > 0) {
        setAvailableSheets(test.sheets);
        if (!test.sheets.includes(sheetName)) {
          setSheetName(test.sheets[0]);
        }
        setFeedback({
          type: 'success',
          text: `Found ${test.sheets.length} worksheet tab(s) in "${test.title}". ${test.rowCount} rows detected.`
        });
      } else {
        setFeedback({
          type: 'error',
          text: test.message || 'Could not discover tabs. Ensure sheet is accessible or publicly viewable with link.'
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        text: e?.message || 'Failed to inspect spreadsheet tabs.'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = GoogleSheetsLiveService.extractSpreadsheetId(spreadsheetUrl);
    if (!id) {
      setFeedback({ type: 'error', text: 'Please provide a valid Google Spreadsheet URL or ID.' });
      return;
    }

    setIsValidating(true);
    setFeedback({ type: 'info', text: 'Validating spreadsheet data and column structure...' });

    try {
      const test = await GoogleSheetsLiveService.testSalesConnection(id, sheetName);
      if (!test.success) {
        setFeedback({
          type: 'error',
          text: test.message || 'Validation failed. Please verify sheet access.'
        });
        setIsValidating(false);
        return;
      }

      const newConfig: LiveSheetConnectionConfig = {
        target: 'sales',
        spreadsheetId: id,
        spreadsheetUrl: spreadsheetUrl.trim(),
        spreadsheetTitle: test.title,
        sheetName: sheetName.trim() || 'Sheet1',
        availableSheets: test.sheets.length > 0 ? test.sheets : [sheetName],
        isConnected: true,
        autoSyncIntervalSec: Number(autoSyncInterval) || 30,
        lastSyncStatus: 'syncing',
        lastSyncMessage: 'Initializing live sales synchronization...',
        rowCount: test.rowCount,
        columnMapping: test.detectedMapping,
        connectedAt: new Date().toISOString(),
        connectedBy: 'Super Admin'
      };

      await GoogleSheetsLiveService.saveConnectionConfig(newConfig);

      // Trigger initial live synchronization
      setFeedback({ type: 'info', text: 'Starting initial synchronization...' });
      const syncRes = await GoogleSheetsLiveService.syncSales(true);
      setLastSyncResult(syncRes);

      if (syncRes.success) {
        setFeedback({
          type: 'success',
          text: `Connected successfully to "${test.title}". Synchronized ${syncRes.totalActiveCount} sales orders across the organization.`
        });
      } else {
        setFeedback({
          type: 'error',
          text: `Connection saved, but sync notice: ${syncRes.message}`
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Failed to connect Google Sheet.'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsSyncing(true);
    setFeedback({ type: 'info', text: 'Checking connected Google Sheet for updates...' });
    try {
      const res = await GoogleSheetsLiveService.syncSales(true);
      setLastSyncResult(res);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Data updated successfully. ${res.totalActiveCount} active orders (${res.addedCount} new, ${res.updatedCount} updated).`
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.message || 'Synchronization failed.'
        });
      }
    } catch (e: any) {
      setFeedback({
        type: 'error',
        text: e?.message || 'Manual synchronization failed.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setShowConfirmDisconnect(false);
    try {
      await GoogleSheetsLiveService.disconnect('sales');
      setFeedback({
        type: 'info',
        text: 'Sales Google Sheet disconnected. Historical synchronized records remain safely preserved in the database.'
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        text: e?.message || 'Failed to disconnect sheet.'
      });
    }
  };

  const isConnected = !!config?.isConnected;
  const statusColor =
    config?.lastSyncStatus === 'live'
      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
      : config?.lastSyncStatus === 'syncing'
      ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
      : config?.lastSyncStatus === 'error'
      ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
      : 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700';

  const formatLastSync = (iso?: string) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' (' + d.toLocaleDateString() + ')';
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-6">
      {/* Header with Super Admin Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Settings → Integrations → Sales Data
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <ShieldCheck size={11} />
              SUPER ADMIN ONLY
            </span>
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 mt-1">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            Permanent Enterprise Google Sheets Live Data
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Configure once for the entire organization. All authorized team members and managers will automatically view live data without requiring individual Google accounts.
          </p>
        </div>

        {/* Live Status Badge */}
        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shrink-0 ${statusColor}`}>
          <span
            className={`w-2 h-2 rounded-full ${
              config?.lastSyncStatus === 'live'
                ? 'bg-emerald-500 animate-pulse'
                : config?.lastSyncStatus === 'syncing'
                ? 'bg-amber-500 animate-spin'
                : config?.lastSyncStatus === 'error'
                ? 'bg-rose-500'
                : 'bg-zinc-400'
            }`}
          />
          <span className="capitalize">
            {config?.lastSyncStatus === 'live'
              ? '● Live Connected'
              : config?.lastSyncStatus === 'syncing'
              ? 'Syncing...'
              : config?.lastSyncStatus === 'error'
              ? 'Connection Error'
              : 'Not Connected'}
          </span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800'
              : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <RefreshCw size={16} className="animate-spin text-zinc-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{feedback.text}</div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-zinc-600 text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Live Connection Stats Bar (when connected) */}
      {isConnected && config && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-850 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Connected Spreadsheet</div>
            <div className="font-semibold text-zinc-900 dark:text-white truncate mt-0.5" title={config.spreadsheetTitle}>
              {config.spreadsheetTitle || 'Google Spreadsheet'}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              Tab: <span className="font-medium text-zinc-800 dark:text-zinc-200">{config.sheetName}</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Last Data Sync</div>
            <div className="font-semibold text-zinc-900 dark:text-white mt-0.5">
              {formatLastSync(config.lastSyncAt)}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Auto: Every {config.autoSyncIntervalSec || 30}s
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Active Records</div>
            <div className="font-semibold text-zinc-900 dark:text-white mt-0.5">
              {config.rowCount !== undefined ? `${config.rowCount} rows` : 'Synchronized'}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Safe incremental merge
            </div>
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : '↻ Refresh Data'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmDisconnect(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors"
              title="Disconnect Google Sheet"
            >
              <Unlink size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      {showConfirmDisconnect && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs space-y-3">
          <div className="font-bold text-rose-900 dark:text-rose-200">
            Disconnect Sales Google Sheet?
          </div>
          <p className="text-rose-800 dark:text-rose-300">
            This will stop automatic synchronization for the organization. All previously synchronized historical records are safely retained in the database.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors"
            >
              Yes, Disconnect
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmDisconnect(false)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Connection Form */}
      <form onSubmit={handleConnectSheet} className="space-y-4">
        {/* Spreadsheet URL / ID */}
        <div>
          <label className="block text-xs font-bold text-zinc-900 dark:text-white mb-1.5">
            Google Spreadsheet Link or ID <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={spreadsheetUrl}
              onChange={e => setSpreadsheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white pr-24"
              required
            />
            <button
              type="button"
              onClick={handleFetchTabs}
              disabled={isValidating || !spreadsheetUrl}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {isValidating ? <RefreshCw size={12} className="animate-spin" /> : <Layers size={12} />}
              <span>Inspect</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Ensure the Google Sheet is shared with edit or view access, or set to "Anyone with the link can view".
          </p>
        </div>

        {/* Worksheet / Tab Name & Polling Interval */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-900 dark:text-white mb-1.5">
              Worksheet Tab Name <span className="text-rose-500">*</span>
            </label>
            {availableSheets && availableSheets.length > 0 ? (
              <select
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
              >
                {availableSheets.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                placeholder="Sheet1"
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                required
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-900 dark:text-white mb-1.5">
              Automatic Synchronization Interval
            </label>
            <select
              value={autoSyncInterval}
              onChange={e => setAutoSyncInterval(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            >
              <option value={15}>Every 15 seconds (High Frequency)</option>
              <option value={30}>Every 30 seconds (Recommended Default)</option>
              <option value={60}>Every 1 minute</option>
              <option value={120}>Every 2 minutes</option>
              <option value={300}>Every 5 minutes</option>
            </select>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isValidating || !spreadsheetUrl}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            {isValidating ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : isConnected ? (
              <Check size={14} />
            ) : (
              <Database size={14} />
            )}
            <span>
              {isValidating
                ? 'Validating & Connecting...'
                : isConnected
                ? 'Update Sheet Connection'
                : 'Connect Sheet'}
            </span>
          </button>

          {isConnected && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isSyncing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-850 text-zinc-900 dark:text-white text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>↻ Refresh Data</span>
            </button>
          )}
        </div>
      </form>

      {/* Explanatory Rule Footer */}
      <div className="p-3.5 bg-zinc-50 dark:bg-zinc-850/50 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
        <div className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-500" />
          Enterprise Connection Rules:
        </div>
        <p>• Only Super Admins configure the Google Sheet. Normal team members see the live dashboard directly.</p>
        <p>• Added rows appear automatically on dashboard refresh. Modified rows update in-place without creating duplicates.</p>
        <p>• Safely synchronized to organization cloud storage so all devices and members share the identical dataset.</p>
      </div>
    </div>
  );
};
