import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  GoogleSheetsLiveService,
  LiveSheetTarget,
  LiveSheetConnectionConfig,
  LiveSyncResult
} from '../../services/googleSheetsLiveService';
import { GoogleSheetsConnectionModal } from './GoogleSheetsConnectionModal';

interface Props {
  target: LiveSheetTarget;
  title: string;
  onDataRefreshed?: () => void;
}

export const LiveConnectionBanner: React.FC<Props> = ({
  target,
  title,
  onDataRefreshed
}) => {
  const [config, setConfig] = useState<LiveSheetConnectionConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = GoogleSheetsLiveService.subscribeToConfig(target, conf => {
      setConfig(conf);
    });
    return () => unsub();
  }, [target]);

  const handleManualRefresh = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res: LiveSyncResult =
        target === 'purchasing'
          ? await GoogleSheetsLiveService.syncPurchasing(true)
          : await GoogleSheetsLiveService.syncRMA(true);

      if (res.success) {
        setSyncFeedback('Data updated successfully');
        if (onDataRefreshed) onDataRefreshed();
      } else {
        setSyncFeedback(`Sync note: ${res.message}`);
      }
    } catch (e: any) {
      setSyncFeedback(`Sync failed: ${e?.message || 'Network error'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const formatLastSync = (isoString?: string) => {
    if (!isoString) return 'Not yet synced';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getFullTimestamp = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const isConnected = config?.isConnected && Boolean(config?.spreadsheetId);
  const status = isSyncing ? 'syncing' : (config?.lastSyncStatus || (isConnected ? 'live' : 'disconnected'));

  return (
    <>
      <div className="bg-[#121624] border border-slate-800 rounded-xl p-3.5 mb-6 shadow-md transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Indicator & Details */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              {status === 'live' && (
                <div className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
                </div>
              )}
              {status === 'syncing' && (
                <div className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </div>
              )}
              {status === 'error' && (
                <span className="inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 shadow-sm shadow-rose-500/50"></span>
              )}
              {status === 'disconnected' && (
                <span className="inline-flex rounded-full h-3.5 w-3.5 bg-slate-500"></span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-semibold tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  Live Google Sheets Data Source:
                </span>
                {status === 'live' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    🟢 Live / Connected
                  </span>
                )}
                {status === 'syncing' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    🟡 Syncing...
                  </span>
                )}
                {status === 'error' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    🔴 Connection Error
                  </span>
                )}
                {status === 'disconnected' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    ⚪ Not Connected
                  </span>
                )}
              </div>

              <div className="text-sm font-medium text-slate-200 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                {isConnected ? (
                  <>
                    <span className="text-slate-100 font-semibold truncate max-w-[200px] sm:max-w-xs">
                      {config?.spreadsheetTitle || 'Connected Spreadsheet'}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs bg-slate-800 text-emerald-300 px-2 py-0.5 rounded border border-slate-700">
                      Tab: {config?.sheetName || 'Sheet1'}
                    </span>
                    {config?.rowCount !== undefined && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span className="text-xs text-slate-400">
                          {config.rowCount} synchronized records
                        </span>
                      </>
                    )}
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Last updated: <strong className="text-slate-300 font-medium">{formatLastSync(config?.lastSyncAt)}</strong>
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 text-xs">
                    Connect your {title} Google Sheet to stream live records, auto-sync modifications, and update metrics in real-time.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-center">
            {isConnected ? (
              <>
                <button
                  onClick={handleManualRefresh}
                  disabled={isSyncing}
                  title="Force an immediate check for newly added or edited Google Sheet rows"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/60 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>

                {config?.spreadsheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Open sheet in Google Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Sheet
                  </a>
                )}

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                  title="Configure sheet connection"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Connect Live Google Sheet
              </button>
            )}
          </div>
        </div>

        {/* Sync Feedback Alert */}
        {syncFeedback && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>{syncFeedback}</span>
              {config?.lastSyncAt && (
                <span className="text-slate-400 text-[11px] ml-2">
                  (Last synchronized: {getFullTimestamp(config.lastSyncAt)})
                </span>
              )}
            </div>
            <button
              onClick={() => setSyncFeedback(null)}
              className="text-slate-500 hover:text-slate-300 text-xs ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Details */}
        {status === 'error' && config?.lastSyncMessage && !syncFeedback && (
          <div className="mt-2.5 pt-2.5 border-t border-rose-900/40 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
              <span>{config.lastSyncMessage}</span>
            </div>
            <button
              onClick={handleManualRefresh}
              className="underline text-rose-300 hover:text-rose-200 font-medium ml-2"
            >
              Retry Sync
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <GoogleSheetsConnectionModal
          target={target}
          title={title}
          currentConfig={config}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            if (onDataRefreshed) onDataRefreshed();
          }}
        />
      )}
    </>
  );
};
