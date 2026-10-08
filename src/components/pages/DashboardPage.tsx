import React, { useState, useEffect } from 'react';
import {
  DayTrendPoint,
  KPISummary,
  MarketplaceStat,
  ProductStat,
  SalesRecord,
  SalesTarget,
  StoreStat
} from '../../types';
import { KPICards } from '../dashboard/KPICards';
import { SalesTrendChart } from '../dashboard/SalesTrendChart';
import { MarketplacePerformance } from '../dashboard/MarketplacePerformance';
import { StorePerformance } from '../dashboard/StorePerformance';
import { TopProductsSection } from '../dashboard/TopProductsSection';
import { TargetVsActual } from '../dashboard/TargetVsActual';
import { DataInsights } from '../dashboard/DataInsights';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';
import { downloadDailyReportTemplate, getYesterdayDateString } from '../../services/dailySheetService';
import {
  GoogleSheetsLiveService,
  LiveSheetConnectionConfig
} from '../../services/googleSheetsLiveService';

interface DashboardPageProps {
  records: SalesRecord[];
  currentFilteredRecords: SalesRecord[];
  kpi: KPISummary;
  dailyTrend: DayTrendPoint[];
  marketplaceStats: MarketplaceStat[];
  storeStats: StoreStat[];
  productStats: ProductStat[];
  insights: string[];
  currency: string;
  monthKey: string;
  targetConfig?: SalesTarget;
  onTargetUpdated: () => void;
  onOpenImport: () => void;
  onSelectStore: (storeName: string, marketplace: string) => void;
  onNavigateToDailySales?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  records,
  currentFilteredRecords,
  kpi,
  dailyTrend,
  marketplaceStats,
  storeStats,
  productStats,
  insights,
  currency,
  monthKey,
  targetConfig,
  onTargetUpdated,
  onOpenImport,
  onSelectStore,
  onNavigateToDailySales,
  onNavigateTab
}) => {
  const [liveConfig, setLiveConfig] = useState<LiveSheetConnectionConfig | null>(() =>
    GoogleSheetsLiveService.getConnectionConfig('sales')
  );
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = GoogleSheetsLiveService.subscribeToConfig('sales', cfg => {
      setLiveConfig(cfg);
    });
    return () => unsub();
  }, []);

  const handleRefreshData = async () => {
    setIsManualSyncing(true);
    setSyncFeedback('Checking Google Sheet for latest updates...');
    try {
      const res = await GoogleSheetsLiveService.syncSales(true);
      if (res.success) {
        setSyncFeedback(`Data updated successfully. ${res.totalActiveCount} orders live.`);
      } else {
        setSyncFeedback(`Sync note: ${res.message}`);
      }
    } catch (e: any) {
      setSyncFeedback(e?.message || 'Sync failed.');
    } finally {
      setIsManualSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const formatLastSync = (iso?: string) => {
    if (!iso) return 'Not yet synced';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto space-y-5">
        <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center shadow-xs border border-zinc-200 dark:border-zinc-700">
          <FileSpreadsheet size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            No Sales Data Available
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            {liveConfig?.isConnected
              ? `Connected to "${liveConfig.spreadsheetTitle || 'Google Sheet'}" (${liveConfig.sheetName}), but no active sales orders were found in the sheet. Add rows to the spreadsheet or click refresh.`
              : 'The Sales Dashboard is currently waiting for enterprise sales data. Connect a Google Sheet in Settings or upload an operations spreadsheet.'}
          </p>
        </div>

        {liveConfig?.isConnected ? (
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleRefreshData}
              disabled={isManualSyncing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isManualSyncing ? 'animate-spin' : ''} />
              <span>{isManualSyncing ? 'Checking Sheet...' : '↻ Refresh Data'}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={onOpenImport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs transition-colors"
            >
              <UploadCloud size={16} /> Import Reporting Sheet
            </button>
            <button
              onClick={() => downloadDailyReportTemplate(undefined, 'xlsx')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-semibold transition-colors border border-zinc-200 dark:border-zinc-700"
            >
              <Download size={15} className="text-black dark:text-white" /> Download Template (.XLSX)
            </button>
          </div>
        )}

        {syncFeedback && (
          <div className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
            {syncFeedback}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Home / Executive Dashboard Main Banner Heading */}
      <div className="bg-[#FFFDF8] dark:bg-[#1A2228] py-8 px-6 rounded-2xl border border-[#D9E0E2] dark:border-[#2C373E] shadow-2xs flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-[#EAF1F5] dark:bg-[#25323A] text-[#3D647A] dark:text-[#B4CAD6] border border-[#D0DFE7] dark:border-[#384852]">
          <LayoutDashboard size={13} className="text-[#6E93A9]" />
          <span>Enterprise Cloud Portal</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-center leading-tight">
          <span className="splus-portal-animated-text font-extrabold tracking-tight inline-flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="font-black tracking-wide">SPLUS Portal</span>
            <span className="font-light opacity-60 hidden sm:inline">|</span>
            <span>Executive Sales Dashboard</span>
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-[#65747C] dark:text-[#94A3B8] max-w-2xl font-normal leading-relaxed">
          Centralized multi-channel sales intelligence, operational KPIs, and enterprise cross-module overview
        </p>
      </div>

      {/* Live Google Sheets Connection Status Bar */}
      {liveConfig?.isConnected && (
        <div className="bg-[#FFFDF8] dark:bg-[#1A2228] px-4 py-2.5 rounded-xl border border-[#D9E0E2] dark:border-[#2C373E] flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  liveConfig.lastSyncStatus === 'live'
                    ? 'bg-emerald-500 animate-pulse'
                    : liveConfig.lastSyncStatus === 'syncing'
                    ? 'bg-amber-500 animate-spin'
                    : liveConfig.lastSyncStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-[#8FAFC2]'
                }`}
              />
              <span className="font-bold text-[#263238] dark:text-[#E2E8F0]">
                {liveConfig.lastSyncStatus === 'live'
                  ? '🟢 LIVE'
                  : liveConfig.lastSyncStatus === 'syncing'
                  ? '🟡 Syncing'
                  : liveConfig.lastSyncStatus === 'error'
                  ? '🔴 Connection Error'
                  : '⚪ Google Sheets Connected'}
              </span>
            </div>

            <span className="text-[#D9E0E2] dark:text-[#2C373E]">|</span>

            <span className="text-[#65747C] dark:text-[#94A3B8] truncate max-w-xs sm:max-w-md font-medium">
              {liveConfig.spreadsheetTitle || 'Google Sheets'} ({liveConfig.sheetName})
            </span>

            <span className="text-[#D9E0E2] dark:text-[#2C373E] hidden sm:inline">|</span>

            <span className="text-[11px] text-[#65747C] dark:text-[#94A3B8] hidden sm:inline">
              Last updated: <span className="font-semibold text-[#263238] dark:text-[#E2E8F0]">{formatLastSync(liveConfig.lastSyncAt)}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {syncFeedback && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> {syncFeedback}
              </span>
            )}
            <button
              onClick={handleRefreshData}
              disabled={isManualSyncing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EAF1F5] hover:bg-[#DCEAF0] dark:bg-[#25323A] dark:hover:bg-[#2E3F49] text-[#2C5268] dark:text-[#DCEAF0] text-xs font-semibold transition-colors disabled:opacity-50"
              title="Force check connected Google Sheet for latest changes"
            >
              <RefreshCw size={12} className={isManualSyncing ? 'animate-spin' : ''} />
              <span>{isManualSyncing ? 'Refreshing...' : '↻ Refresh Data'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Executive KPI Cards */}
      <KPICards kpi={kpi} currency={currency} />

      {/* Daily Operations Quick Bar */}
      <div className="bg-[#F8F6F0] dark:bg-[#1E272D] p-3.5 px-4 rounded-2xl border border-[#D9E0E2] dark:border-[#2C373E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#DCEAF0] dark:bg-[#25323A] text-[#2C5268] dark:text-[#DCEAF0] border border-[#BACFD9] dark:border-[#384852] flex items-center justify-center shrink-0 shadow-2xs">
            <FileSpreadsheet size={15} />
          </div>
          <div>
            <div className="font-bold text-[#263238] dark:text-[#E2E8F0]">
              Daily Reporting Workflow (Previous Day Reconcile)
            </div>
            <div className="text-[11px] text-[#65747C] dark:text-[#94A3B8]">
              Download 14-store template pre-set for yesterday ({getYesterdayDateString()}), update figures, and import in 1 click
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadDailyReportTemplate(undefined, 'xlsx')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9E0E2] dark:border-[#2C373E] bg-[#FFFDF8] dark:bg-[#222C33] hover:bg-[#F2EFE9] dark:hover:bg-[#28353D] text-[#263238] dark:text-[#E2E8F0] font-semibold shadow-2xs transition-colors"
            title={`Download template pre-set for yesterday (${getYesterdayDateString()})`}
          >
            <Download size={13} className="text-[#6E93A9]" /> Daily Template ({getYesterdayDateString()})
          </button>
          {onNavigateToDailySales && (
            <button
              onClick={onNavigateToDailySales}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A9FB4] hover:bg-[#688FA5] text-white font-semibold shadow-xs transition-colors"
            >
              <span>Daily Sheet View</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Target vs Actual Monthly Pacing */}
      <TargetVsActual
        actualSales={kpi.totalSales}
        actualOrders={kpi.totalOrders}
        actualProfit={kpi.totalProfit}
        currency={currency}
        monthKey={monthKey}
        targetConfig={targetConfig}
        onTargetUpdated={onTargetUpdated}
      />

      {/* 3. Sales Trend Timeline */}
      <SalesTrendChart data={dailyTrend} currency={currency} />

      {/* 4. Automated Live Operations & Sales Portal Insights */}
      <DataInsights
        insights={insights}
        salesRecords={records}
        kpi={kpi}
        marketplaceStats={marketplaceStats}
        storeStats={storeStats}
        productStats={productStats}
        currencySymbol={currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}
        onNavigateTab={onNavigateTab}
      />

      {/* 5. Marketplace Breakdown & Share */}
      <MarketplacePerformance stats={marketplaceStats} currency={currency} />

      {/* 6. Multi-Store Performance */}
      <StorePerformance
        stores={storeStats}
        currency={currency}
        onSelectStore={onSelectStore}
      />

      {/* 7. Top 10 Products Leaderboard */}
      <TopProductsSection products={productStats} currency={currency} />
    </div>
  );
};
