import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ShoppingCart,
  Boxes,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpRight,
  Activity,
  DollarSign,
  PackageCheck,
  Clock,
  Layers
} from 'lucide-react';
import {
  PortalInsightsService,
  LivePortalInsight,
  PortalLiveSummary,
  InsightCategory
} from '../../services/portalInsightsService';
import { PurchasingService } from '../../services/purchasingService';
import { RMAService } from '../../services/rmaService';
import { GoogleSheetsLiveService } from '../../services/googleSheetsLiveService';
import {
  SalesRecord,
  KPISummary,
  MarketplaceStat,
  StoreStat,
  ProductStat
} from '../../types';
import { PurchaseOrder, Supplier } from '../../types/purchasing';
import { RMAItem } from '../../types/rma';

interface DataInsightsProps {
  insights?: string[];
  salesRecords?: SalesRecord[];
  kpi?: KPISummary;
  marketplaceStats?: MarketplaceStat[];
  storeStats?: StoreStat[];
  productStats?: ProductStat[];
  currencySymbol?: string;
  onNavigateTab?: (tab: string) => void;
}

export const DataInsights: React.FC<DataInsightsProps> = ({
  insights: legacyInsights = [],
  salesRecords = [],
  kpi,
  marketplaceStats = [],
  storeStats = [],
  productStats = [],
  currencySymbol = '$',
  onNavigateTab
}) => {
  // Live Data State from other portal modules
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rmas, setRmas] = useState<RMAItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<InsightCategory>('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Load and subscribe to real-time data across the entire portal
  const loadPortalData = async () => {
    try {
      const [allPOs, allSuppliers, allRMAs] = await Promise.all([
        PurchasingService.getPurchaseOrders(),
        PurchasingService.getSuppliers(),
        Promise.resolve(RMAService.getAllRMAs())
      ]);
      setPos(allPOs);
      setSuppliers(allSuppliers);
      setRmas(allRMAs);
      setLastRefreshedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (e) {
      console.warn('Portal data fetch notice:', e);
    }
  };

  useEffect(() => {
    loadPortalData();

    // 1. Subscribe to Purchasing PO updates
    const unsubPurchasing = PurchasingService.initSync(() => {
      loadPortalData();
    });

    // 2. Subscribe to RMA return updates
    const unsubRMA = RMAService.subscribe(() => {
      loadPortalData();
    });

    // 3. Subscribe to Google Sheets live streaming events
    const unsubLivePOs = GoogleSheetsLiveService.subscribeToPOs(livePOs => {
      if (livePOs) {
        setPos(livePOs.filter(p => !(p as any).isDeletedFromSource));
      }
    });

    const unsubLiveRMAs = GoogleSheetsLiveService.subscribeToRMAs(liveRMAs => {
      if (liveRMAs) {
        setRmas(liveRMAs.filter(r => !(r as any).isDeletedFromSource));
      }
    });

    return () => {
      unsubPurchasing();
      unsubRMA();
      unsubLivePOs();
      unsubLiveRMAs();
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadPortalData();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  // Construct fallback KPI if not passed via props
  const computedKPI: KPISummary = useMemo(() => {
    if (kpi) return kpi;
    const totalSales = salesRecords.reduce((acc, r) => acc + (r.sales || 0), 0);
    const uniqueOrders = new Set(salesRecords.map(r => r.orderId || r.id)).size;
    const totalOrders = uniqueOrders || salesRecords.length;
    const totalUnits = salesRecords.reduce((acc, r) => acc + (r.units || 0), 0);
    const totalProfit = salesRecords.reduce((acc, r) => acc + (r.profit || 0), 0);
    const aov = totalOrders > 0 ? totalSales / totalOrders : 0;
    const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    return {
      totalSales,
      totalOrders,
      totalUnits,
      totalProfit,
      profitMargin: margin,
      averageOrderValue: aov,
      totalReturns: 0,
      totalRefunds: 0,
      salesGrowth: null,
      ordersGrowth: null,
      unitsGrowth: null,
      profitGrowth: null,
      previousPeriodSales: null,
      hasProfitData: true,
      hasReturnData: false
    };
  }, [kpi, salesRecords]);

  // Compute live multi-module portal insights
  const livePortalInsights = useMemo(() => {
    return PortalInsightsService.generateLiveInsights({
      salesRecords,
      kpi: computedKPI,
      marketplaceStats,
      storeStats,
      productStats,
      pos,
      suppliers,
      rmas,
      currencySymbol
    });
  }, [salesRecords, computedKPI, marketplaceStats, storeStats, productStats, pos, suppliers, rmas, currencySymbol]);

  // Compute live summary bar metrics
  const liveSummary: PortalLiveSummary = useMemo(() => {
    return PortalInsightsService.calculateLiveSummary({
      salesRecords,
      kpi: computedKPI,
      marketplaceStats,
      storeStats,
      productStats,
      pos,
      suppliers,
      rmas,
      currencySymbol
    });
  }, [salesRecords, computedKPI, marketplaceStats, storeStats, productStats, pos, suppliers, rmas, currencySymbol]);

  // Filter insights by category
  const filteredInsights = useMemo(() => {
    if (selectedCategory === 'all') return livePortalInsights;
    return livePortalInsights.filter(i => i.category === selectedCategory);
  }, [livePortalInsights, selectedCategory]);

  // Category counts for tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: livePortalInsights.length,
      sales: 0,
      purchasing: 0,
      inventory: 0,
      rma: 0,
      integrations: 0,
      financials: 0
    };
    livePortalInsights.forEach(i => {
      if (counts[i.category] !== undefined) {
        counts[i.category]++;
      }
    });
    return counts;
  }, [livePortalInsights]);

  const categories: { id: InsightCategory; label: string; icon: any }[] = [
    { id: 'all', label: 'All Portal Live', icon: Activity },
    { id: 'sales', label: 'Sales & Revenue', icon: ShoppingCart },
    { id: 'purchasing', label: 'Purchasing & POs', icon: PackageCheck },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'rma', label: 'RMA & Returns', icon: RotateCcw },
    { id: 'integrations', label: 'Live Integrations', icon: FileSpreadsheet },
    { id: 'financials', label: 'Operations & Cash', icon: DollarSign }
  ];

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      {/* Header with Live Status & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Automated Operations & Sales Insights
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE PORTAL INTELLIGENCE
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live operational intelligence synthesized across all portal modules (Sales, Purchasing, RMA, WMS Inventory & Google Sheets)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden md:inline">
            Synced: <span className="font-medium text-zinc-700 dark:text-zinc-300">{lastRefreshedAt}</span>
          </span>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
            title="Refresh cross-portal data streams"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Live'}</span>
          </button>
        </div>
      </div>

      {/* Live Cross-Portal Quick Snapshot Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* 1. Live Sales */}
        <div className="bg-white dark:bg-zinc-850 p-2.5 px-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">
            <span className="flex items-center gap-1">
              <ShoppingCart size={11} className="text-emerald-500" /> Live Revenue
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
            {currencySymbol}{liveSummary.totalSales.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {liveSummary.totalOrders.toLocaleString()} orders • {liveSummary.totalUnits.toLocaleString()} units
          </div>
        </div>

        {/* 2. Procurement */}
        <div className="bg-white dark:bg-zinc-850 p-2.5 px-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">
            <span className="flex items-center gap-1">
              <PackageCheck size={11} className="text-blue-500" /> Procurement
            </span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{liveSummary.openPOCount} POs</span>
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
            {currencySymbol}{liveSummary.activePOSpend.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {liveSummary.pendingDeliveries > 0 ? `${liveSummary.pendingDeliveries} inbound delivery` : 'All POs received'}
          </div>
        </div>

        {/* 3. Inventory Stock Alerts */}
        <div className="bg-white dark:bg-zinc-850 p-2.5 px-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">
            <span className="flex items-center gap-1">
              <Boxes size={11} className={liveSummary.reorderAlertsCount > 0 ? 'text-rose-500' : 'text-amber-500'} /> Stock Health
            </span>
            <span className={`font-semibold ${liveSummary.reorderAlertsCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {liveSummary.reorderAlertsCount > 0 ? `${liveSummary.reorderAlertsCount} Alert` : 'Optimal'}
            </span>
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
            {liveSummary.reorderAlertsCount > 0 ? `${liveSummary.reorderAlertsCount} Reorders` : '100% In Stock'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {liveSummary.lowStockCount > 0 ? `${liveSummary.lowStockCount} low stock SKUs` : 'Velocity nominal'}
          </div>
        </div>

        {/* 4. RMA Returns */}
        <div className="bg-white dark:bg-zinc-850 p-2.5 px-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">
            <span className="flex items-center gap-1">
              <RotateCcw size={11} className="text-violet-500" /> RMA Pipeline
            </span>
            <span className="text-violet-600 dark:text-violet-400 font-semibold">{liveSummary.activeRMAsCount} Active</span>
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
            {liveSummary.activeRMAsCount > 0 ? `${liveSummary.activeRMAsCount} Open Cases` : 'Zero Backlog'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {liveSummary.healthyRMARate > 0 ? `${liveSummary.healthyRMARate}% return rate` : '0 returns recorded'}
          </div>
        </div>

        {/* 5. Live Streams */}
        <div className="bg-white dark:bg-zinc-850 p-2.5 px-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">
            <span className="flex items-center gap-1">
              <FileSpreadsheet size={11} className="text-emerald-500" /> Google Sheets
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {liveSummary.connectedSheetsCount > 0 ? 'Streaming' : 'Ready'}
            </span>
          </div>
          <div className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
            {liveSummary.connectedSheetsCount > 0 ? `${liveSummary.connectedSheetsCount} Live Feeds` : 'Sheet Ready'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            Auto-sync every 30-60s
          </div>
        </div>
      </div>

      {/* Category Filter Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
        {categories.map(cat => {
          const count = categoryCounts[cat.id] || 0;
          const isSelected = selectedCategory === cat.id;
          const Icon = cat.icon;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'bg-white dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700/70'
              }`}
            >
              <Icon size={12} />
              <span>{cat.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected
                    ? 'bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Insight Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
        {filteredInsights.map(insight => {
          // Priority Styling
          const isHigh = insight.priority === 'high';
          const isMedium = insight.priority === 'medium';
          const isSuccess = insight.priority === 'success';

          return (
            <div
              key={insight.id}
              className={`flex flex-col justify-between p-4 rounded-xl bg-white dark:bg-zinc-850 border shadow-2xs transition-all hover:shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 ${
                isHigh
                  ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/10'
                  : isMedium
                  ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/10'
                  : isSuccess
                  ? 'border-emerald-200/80 dark:border-emerald-900/50'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="space-y-2">
                {/* Card Top: Category Badge & Metric Chip */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isHigh
                          ? 'bg-rose-500 animate-pulse'
                          : isMedium
                          ? 'bg-amber-500'
                          : isSuccess
                          ? 'bg-emerald-500'
                          : 'bg-zinc-400'
                      }`}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {insight.categoryLabel}
                    </span>
                  </div>

                  {insight.metric && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                        isHigh
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : isMedium
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : isSuccess
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {insight.metric}
                    </span>
                  )}
                </div>

                {/* Insight Title */}
                <div className="font-bold text-xs text-zinc-900 dark:text-white leading-snug">
                  {insight.title}
                </div>

                {/* Insight Description */}
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-normal">
                  {insight.description}
                </p>
              </div>

              {/* Card Footer: Action button or timestamp */}
              <div className="pt-3 mt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                {insight.metricLabel ? (
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">
                    {insight.metricLabel}
                  </span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">Live Sync</span>
                )}

                {insight.actionTab && onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab(insight.actionTab!)}
                    className="flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white transition-colors"
                  >
                    <span>{insight.actionLabel || 'Details'}</span>
                    <ArrowUpRight size={11} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredInsights.length === 0 && (
        <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
          No live insights found for category "{selectedCategory}". Switch tabs to view other active streams.
        </div>
      )}
    </div>
  );
};
