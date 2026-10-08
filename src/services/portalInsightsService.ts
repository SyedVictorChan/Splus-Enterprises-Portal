import {
  SalesRecord,
  KPISummary,
  MarketplaceStat,
  StoreStat,
  ProductStat
} from '../types';
import { PurchaseOrder, Supplier } from '../types/purchasing';
import { RMAItem } from '../types/rma';
import { PurchasingService } from './purchasingService';
import { RMAService } from './rmaService';
import { GoogleSheetsLiveService } from './googleSheetsLiveService';

export type InsightCategory =
  | 'all'
  | 'sales'
  | 'purchasing'
  | 'inventory'
  | 'rma'
  | 'integrations'
  | 'financials';

export type InsightPriority = 'high' | 'medium' | 'info' | 'success';

export interface LivePortalInsight {
  id: string;
  category: InsightCategory;
  categoryLabel: string;
  title: string;
  description: string;
  priority: InsightPriority;
  metric?: string;
  metricLabel?: string;
  iconType: 'sales' | 'purchasing' | 'inventory' | 'rma' | 'sync' | 'financial';
  actionTab?: string;
  actionLabel?: string;
  timestamp: string;
}

export interface PortalLiveSummary {
  totalSales: number;
  totalOrders: number;
  totalUnits: number;
  activePOSpend: number;
  openPOCount: number;
  pendingDeliveries: number;
  reorderAlertsCount: number;
  lowStockCount: number;
  activeRMAsCount: number;
  healthyRMARate: number;
  connectedSheetsCount: number;
  activeStoresCount: number;
  activeMarketplacesCount: number;
  lastUpdated: string;
}

export interface PortalDataParams {
  salesRecords: SalesRecord[];
  kpi: KPISummary;
  marketplaceStats?: MarketplaceStat[];
  storeStats?: StoreStat[];
  productStats?: ProductStat[];
  pos?: PurchaseOrder[];
  suppliers?: Supplier[];
  rmas?: RMAItem[];
  currencySymbol?: string;
}

export class PortalInsightsService {
  /**
   * Generates live, factual, multi-module insights based on the entire enterprise portal.
   * Eliminates historical-only comparisons and extracts real-time operational status
   * across Sales, Purchasing, Inventory Reorders, RMA Returns, and Integrations.
   */
  static generateLiveInsights(params: PortalDataParams): LivePortalInsight[] {
    const {
      salesRecords = [],
      kpi,
      marketplaceStats = [],
      storeStats = [],
      productStats = [],
      pos = [],
      suppliers = [],
      rmas = [],
      currencySymbol = '$'
    } = params;

    const insights: LivePortalInsight[] = [];
    const nowIso = new Date().toISOString();

    // =========================================================================
    // 1. LIVE SALES & CHANNEL INSIGHTS
    // =========================================================================
    if (kpi && kpi.totalSales > 0) {
      insights.push({
        id: 'sales-volume-live',
        category: 'sales',
        categoryLabel: 'Sales & Revenue',
        title: 'Live Gross Revenue & Fulfillment',
        description: `Active portal sales total ${currencySymbol}${kpi.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${kpi.totalOrders.toLocaleString()} customer orders with ${kpi.totalUnits.toLocaleString()} units processed.`,
        priority: 'success',
        metric: `${currencySymbol}${kpi.totalSales.toLocaleString()}`,
        metricLabel: 'Gross Sales',
        iconType: 'sales',
        timestamp: nowIso
      });
    }

    if (kpi && kpi.averageOrderValue > 0) {
      insights.push({
        id: 'sales-aov-margin',
        category: 'sales',
        categoryLabel: 'Sales & Revenue',
        title: 'Average Order Value & Profitability',
        description: `Average customer order value stands at ${currencySymbol}${kpi.averageOrderValue.toFixed(2)}${kpi.profitMargin ? ` generating an operational profit margin of ${kpi.profitMargin.toFixed(1)}% (${currencySymbol}${kpi.totalProfit.toLocaleString()} gross profit)` : ''}.`,
        priority: 'info',
        metric: `${currencySymbol}${kpi.averageOrderValue.toFixed(2)}`,
        metricLabel: 'Average AOV',
        iconType: 'financial',
        timestamp: nowIso
      });
    }

    if (marketplaceStats.length > 0) {
      const topMkt = marketplaceStats[0];
      insights.push({
        id: 'sales-top-marketplace',
        category: 'sales',
        categoryLabel: 'Sales & Revenue',
        title: 'Primary Revenue Channel',
        description: `Marketplace "${topMkt.marketplace}" drives the largest share of live revenue with ${topMkt.contributionPercent}% (${currencySymbol}${topMkt.sales.toLocaleString()} across ${topMkt.orders.toLocaleString()} orders).`,
        priority: 'info',
        metric: `${topMkt.contributionPercent}% Share`,
        metricLabel: topMkt.marketplace,
        iconType: 'sales',
        timestamp: nowIso
      });
    }

    if (storeStats.length > 0) {
      const topStore = storeStats[0];
      insights.push({
        id: 'sales-top-store',
        category: 'sales',
        categoryLabel: 'Sales & Revenue',
        title: 'Leading Storefront Volume',
        description: `Storefront "${topStore.store}" (${topStore.marketplace}) is the top live performer, contributing ${topStore.contributionPercent}% of organization volume (${currencySymbol}${topStore.sales.toLocaleString()}).`,
        priority: 'success',
        metric: `${currencySymbol}${topStore.sales.toLocaleString()}`,
        metricLabel: topStore.store,
        iconType: 'sales',
        timestamp: nowIso
      });
    }

    if (productStats.length > 0) {
      const topVolumeProduct = [...productStats].sort((a, b) => b.units - a.units)[0];
      if (topVolumeProduct) {
        insights.push({
          id: 'sales-top-product',
          category: 'sales',
          categoryLabel: 'Sales & Revenue',
          title: 'Highest Velocity Product',
          description: `"${topVolumeProduct.product}" (SKU: ${topVolumeProduct.sku}) recorded highest live sales velocity with ${topVolumeProduct.units.toLocaleString()} units sold generating ${currencySymbol}${topVolumeProduct.sales.toLocaleString()}.`,
          priority: 'info',
          metric: `${topVolumeProduct.units.toLocaleString()} Units`,
          metricLabel: topVolumeProduct.sku,
          iconType: 'sales',
          timestamp: nowIso
        });
      }
    }

    // =========================================================================
    // 2. LIVE PURCHASING & PROCUREMENT INSIGHTS
    // =========================================================================
    const activePOs = pos.filter(p => p.status !== 'Cancelled');
    const totalPOSpend = Number(activePOs.reduce((acc, p) => acc + (p.totalAmount || 0), 0).toFixed(2));
    const totalUnpaidPO = Number(activePOs.reduce((acc, p) => acc + (p.outstandingAmount || 0), 0).toFixed(2));
    const pendingIntakePOs = activePOs.filter(p => p.receivingStatus !== 'Received');
    const partiallyReceivedPOs = activePOs.filter(p => p.receivingStatus === 'Partially Received');

    if (activePOs.length > 0) {
      insights.push({
        id: 'purchasing-commitments-live',
        category: 'purchasing',
        categoryLabel: 'Purchasing & POs',
        title: 'Active Procurement Commitments',
        description: `The procurement pipeline manages ${activePOs.length} active purchase orders totaling ${currencySymbol}${totalPOSpend.toLocaleString()} across ${suppliers.length || new Set(activePOs.map(p => p.supplierName)).size} authorized suppliers.`,
        priority: 'info',
        metric: `${currencySymbol}${totalPOSpend.toLocaleString()}`,
        metricLabel: `${activePOs.length} POs Active`,
        iconType: 'purchasing',
        actionTab: 'purchasing',
        actionLabel: 'View Purchasing',
        timestamp: nowIso
      });

      if (pendingIntakePOs.length > 0) {
        insights.push({
          id: 'purchasing-inbound-intake',
          category: 'purchasing',
          categoryLabel: 'Purchasing & POs',
          title: 'Inbound Deliveries in Progress',
          description: `${pendingIntakePOs.length} purchase orders are currently in-transit or awaiting full warehouse intake reconciliation (${partiallyReceivedPOs.length} partially received batches).`,
          priority: 'medium',
          metric: `${pendingIntakePOs.length} In Transit`,
          metricLabel: 'Inbound POs',
          iconType: 'purchasing',
          actionTab: 'purchasing',
          actionLabel: 'Inspect Deliveries',
          timestamp: nowIso
        });
      } else {
        insights.push({
          id: 'purchasing-all-received',
          category: 'purchasing',
          categoryLabel: 'Purchasing & POs',
          title: 'PO Fulfillment Status',
          description: `100% of open purchase order batches have completed warehouse receipt and inventory induction.`,
          priority: 'success',
          metric: '100% Received',
          metricLabel: 'Intake Complete',
          iconType: 'purchasing',
          timestamp: nowIso
        });
      }

      if (totalUnpaidPO > 0) {
        const unpaidCount = activePOs.filter(p => p.paymentStatus !== 'Paid').length;
        insights.push({
          id: 'purchasing-payables-balance',
          category: 'purchasing',
          categoryLabel: 'Purchasing & POs',
          title: 'Outstanding Supplier Payables',
          description: `Accounts payable records ${currencySymbol}${totalUnpaidPO.toLocaleString()} in pending liabilities to suppliers across ${unpaidCount} open purchase orders.`,
          priority: 'high',
          metric: `${currencySymbol}${totalUnpaidPO.toLocaleString()}`,
          metricLabel: 'Supplier Balance',
          iconType: 'financial',
          actionTab: 'purchasing',
          actionLabel: 'Manage Payables',
          timestamp: nowIso
        });
      }
    } else {
      insights.push({
        id: 'purchasing-baseline-clean',
        category: 'purchasing',
        categoryLabel: 'Purchasing & POs',
        title: 'Procurement Pipeline Status',
        description: 'Zero pending supplier liabilities or overdue POs. Supply chain contracts are clean with no outstanding procurement backlog.',
        priority: 'info',
        metric: '$0 PO Due',
        metricLabel: 'Clean Pipeline',
        iconType: 'purchasing',
        timestamp: nowIso
      });
    }

    // =========================================================================
    // 3. LIVE INVENTORY & WMS REORDER INTELLIGENCE
    // =========================================================================
    try {
      const inventoryConnection = PurchasingService.getInventoryStockConnection(salesRecords, pos);
      const reorderNeeded = inventoryConnection.filter(i => i.reorderStatus === 'Reorder Needed');
      const lowStock = inventoryConnection.filter(i => i.reorderStatus === 'Low Stock');
      const onOrderItems = inventoryConnection.filter(i => i.reorderStatus === 'On Order');

      if (reorderNeeded.length > 0) {
        const skuList = reorderNeeded.slice(0, 3).map(i => `${i.sku} (${i.currentStock} left)`).join(', ');
        insights.push({
          id: 'inventory-reorder-alert',
          category: 'inventory',
          categoryLabel: 'Inventory & Reorder',
          title: 'Critical Stock Reorder Warning',
          description: `${reorderNeeded.length} catalog SKU${reorderNeeded.length > 1 ? 's' : ''} have fallen below safe velocity thresholds and require immediate purchase replenishment: ${skuList}${reorderNeeded.length > 3 ? ` and ${reorderNeeded.length - 3} more` : ''}.`,
          priority: 'high',
          metric: `${reorderNeeded.length} Reorders Needed`,
          metricLabel: 'Stock Depleted',
          iconType: 'inventory',
          actionTab: 'purchasing',
          actionLabel: 'Create PO',
          timestamp: nowIso
        });
      }

      if (lowStock.length > 0) {
        const skuList = lowStock.slice(0, 3).map(i => `${i.sku} (${i.currentStock} left)`).join(', ');
        insights.push({
          id: 'inventory-low-stock-alert',
          category: 'inventory',
          categoryLabel: 'Inventory & Reorder',
          title: 'Low Stock Buffer Advisory',
          description: `${lowStock.length} SKU${lowStock.length > 1 ? 's' : ''} have reached low buffer levels based on current sales turnover: ${skuList}. Monitor inventory closely.`,
          priority: 'medium',
          metric: `${lowStock.length} Low Stock`,
          metricLabel: 'Buffer Warning',
          iconType: 'inventory',
          actionTab: 'purchasing',
          actionLabel: 'Review Inventory',
          timestamp: nowIso
        });
      }

      if (onOrderItems.length > 0) {
        insights.push({
          id: 'inventory-on-order-inbound',
          category: 'inventory',
          categoryLabel: 'Inventory & Reorder',
          title: 'Inbound Stock Protection',
          description: `${onOrderItems.length} SKUs currently have active purchase orders already placed with suppliers to replenish upcoming sales demand.`,
          priority: 'info',
          metric: `${onOrderItems.length} SKUs Inbound`,
          metricLabel: 'Scheduled POs',
          iconType: 'inventory',
          timestamp: nowIso
        });
      }

      if (reorderNeeded.length === 0 && lowStock.length === 0 && inventoryConnection.length > 0) {
        insights.push({
          id: 'inventory-all-healthy',
          category: 'inventory',
          categoryLabel: 'Inventory & Reorder',
          title: 'Warehouse Stock Stability',
          description: `All tracked product catalog SKUs maintain optimal inventory velocity buffers with zero stock-out risk across distribution nodes.`,
          priority: 'success',
          metric: '100% In Stock',
          metricLabel: 'Optimal Buffers',
          iconType: 'inventory',
          timestamp: nowIso
        });
      }
    } catch (e) {
      console.warn('Inventory connection derivation notice:', e);
    }

    // =========================================================================
    // 4. LIVE RMA & CUSTOMER RETURNS PIPELINE
    // =========================================================================
    const activeRMAs = rmas.filter(
      r => !['completed', 'cancelled', 'refunded'].includes(r.status?.toLowerCase() || '')
    );
    const inspectingRMAs = rmas.filter(r =>
      ['inspecting', 'item_received', 'pending_inspection', 'under_inspection'].includes(
        r.status?.toLowerCase() || ''
      )
    );
    const refundPendingRMAs = rmas.filter(r =>
      ['refund_pending', 'replacement_pending'].includes(r.status?.toLowerCase() || '')
    );

    if (activeRMAs.length > 0) {
      insights.push({
        id: 'rma-active-caseload',
        category: 'rma',
        categoryLabel: 'RMA & Returns',
        title: 'Active Returns in Processing',
        description: `${activeRMAs.length} customer return case${activeRMAs.length > 1 ? 's are' : ' is'} currently in progress (${inspectingRMAs.length} awaiting warehouse inspection, ${refundPendingRMAs.length} awaiting refund/replacement resolution).`,
        priority: 'medium',
        metric: `${activeRMAs.length} Open Cases`,
        metricLabel: 'RMA Caseload',
        iconType: 'rma',
        actionTab: 'rma',
        actionLabel: 'Process RMAs',
        timestamp: nowIso
      });
    } else {
      insights.push({
        id: 'rma-zero-backlog',
        category: 'rma',
        categoryLabel: 'RMA & Returns',
        title: 'Returns Backlog Fully Resolved',
        description: 'All recorded RMA claims have completed inspection and settlement. Zero backlog in returns processing.',
        priority: 'success',
        metric: '0 Pending RMAs',
        metricLabel: 'Backlog Clear',
        iconType: 'rma',
        timestamp: nowIso
      });
    }

    if (kpi && kpi.totalOrders > 0 && rmas.length > 0) {
      const returnRate = (rmas.length / kpi.totalOrders) * 100;
      const isHealthy = returnRate <= 3.0;
      insights.push({
        id: 'rma-rate-benchmark',
        category: 'rma',
        categoryLabel: 'RMA & Returns',
        title: 'Customer Return Rate Health',
        description: `Portal return rate stands at ${returnRate.toFixed(2)}% (${rmas.length} return claims against ${kpi.totalOrders.toLocaleString()} customer orders). ${isHealthy ? 'Operates well within healthy e-commerce quality thresholds (<3%).' : 'Elevated return volume detected; review inspection tags and customer reasons.'}`,
        priority: isHealthy ? 'success' : 'high',
        metric: `${returnRate.toFixed(2)}%`,
        metricLabel: 'RMA Return Rate',
        iconType: 'rma',
        timestamp: nowIso
      });
    }

    if (rmas.length > 0) {
      // Find top return reason
      const reasonCountMap = new Map<string, number>();
      rmas.forEach(r => {
        const rsn = r.reason ? r.reason.replace(/_/g, ' ') : 'General Return';
        reasonCountMap.set(rsn, (reasonCountMap.get(rsn) || 0) + 1);
      });
      const sortedReasons = Array.from(reasonCountMap.entries()).sort((a, b) => b[1] - a[1]);
      if (sortedReasons.length > 0) {
        const [topReason, topCount] = sortedReasons[0];
        const pct = Math.round((topCount / rmas.length) * 100);
        insights.push({
          id: 'rma-primary-reason',
          category: 'rma',
          categoryLabel: 'RMA & Returns',
          title: 'Primary Return Reason Driver',
          description: `"${topReason.toUpperCase()}" is the primary return factor, accounting for ${pct}% (${topCount} cases) of total customer claims.`,
          priority: 'info',
          metric: `${pct}%`,
          metricLabel: topReason,
          iconType: 'rma',
          timestamp: nowIso
        });
      }
    }

    // =========================================================================
    // 5. LIVE INTEGRATIONS & GOOGLE SHEETS FRESHNESS
    // =========================================================================
    try {
      const salesCfg = GoogleSheetsLiveService.getConnectionConfig('sales');
      const purchasingCfg = GoogleSheetsLiveService.getConnectionConfig('purchasing');
      const rmaCfg = GoogleSheetsLiveService.getConnectionConfig('rma');

      const connectedStreams: string[] = [];
      if (salesCfg?.isConnected) connectedStreams.push('Sales Orders');
      if (purchasingCfg?.isConnected) connectedStreams.push('Purchasing POs');
      if (rmaCfg?.isConnected) connectedStreams.push('RMA Returns');

      if (connectedStreams.length > 0) {
        insights.push({
          id: 'integrations-live-sync-active',
          category: 'integrations',
          categoryLabel: 'Live Integrations',
          title: 'Live Google Sheets Data Streaming',
          description: `Real-time synchronization is active for ${connectedStreams.join(', ')}. Connected to Google Sheets with automatic background polling and multi-user cross-sync enabled.`,
          priority: 'success',
          metric: '🟢 Live Sync Active',
          metricLabel: `${connectedStreams.length} Connected`,
          iconType: 'sync',
          actionTab: 'settings',
          actionLabel: 'Sync Settings',
          timestamp: nowIso
        });
      } else {
        insights.push({
          id: 'integrations-ready-to-stream',
          category: 'integrations',
          categoryLabel: 'Live Integrations',
          title: 'Google Sheets Live Sync Ready',
          description: 'The live integration engine is configured and ready. Connect your enterprise spreadsheets in Settings or section banners to activate automatic streaming.',
          priority: 'info',
          metric: 'Ready to Connect',
          metricLabel: 'Integrations',
          iconType: 'sync',
          actionTab: 'settings',
          actionLabel: 'Connect Sheets',
          timestamp: nowIso
        });
      }
    } catch (e) {
      console.warn('Live config check notice:', e);
    }

    // =========================================================================
    // 6. MULTI-STORE OPERATIONS & FINANCIAL VARIANCE
    // =========================================================================
    if (storeStats.length > 1) {
      insights.push({
        id: 'operations-multi-store-sync',
        category: 'financials',
        categoryLabel: 'Operations & Finance',
        title: 'Multi-Storefront Operations',
        description: `Unified operational monitoring across ${storeStats.length} active stores and ${marketplaceStats.length} online marketplaces with live reconciliation.`,
        priority: 'info',
        metric: `${storeStats.length} Stores`,
        metricLabel: `${marketplaceStats.length} Channels`,
        iconType: 'sales',
        timestamp: nowIso
      });
    }

    if (kpi && kpi.totalSales > 0 && totalPOSpend > 0) {
      const netVariance = kpi.totalSales - totalPOSpend;
      const isPositive = netVariance >= 0;
      insights.push({
        id: 'financials-commercial-balance',
        category: 'financials',
        categoryLabel: 'Operations & Finance',
        title: 'Commercial Operating Cash Variance',
        description: `Live revenue (${currencySymbol}${kpi.totalSales.toLocaleString()}) vs procurement spend (${currencySymbol}${totalPOSpend.toLocaleString()}) yields an operational cash variance of ${currencySymbol}${netVariance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        priority: isPositive ? 'success' : 'medium',
        metric: `${currencySymbol}${netVariance.toLocaleString()}`,
        metricLabel: isPositive ? 'Positive Net' : 'Procurement Deficit',
        iconType: 'financial',
        timestamp: nowIso
      });
    }

    return insights;
  }

  /**
   * Computes the high-level live summary metrics bar across all modules
   */
  static calculateLiveSummary(params: PortalDataParams): PortalLiveSummary {
    const {
      kpi,
      pos = [],
      rmas = [],
      storeStats = [],
      marketplaceStats = []
    } = params;

    const activePOs = pos.filter(p => p.status !== 'Cancelled');
    const activePOSpend = Number(activePOs.reduce((acc, p) => acc + (p.totalAmount || 0), 0).toFixed(2));
    const pendingDeliveries = activePOs.filter(p => p.receivingStatus !== 'Received').length;

    let reorderAlertsCount = 0;
    let lowStockCount = 0;
    try {
      const inv = PurchasingService.getInventoryStockConnection(params.salesRecords || [], pos);
      reorderAlertsCount = inv.filter(i => i.reorderStatus === 'Reorder Needed').length;
      lowStockCount = inv.filter(i => i.reorderStatus === 'Low Stock').length;
    } catch {}

    const activeRMAs = rmas.filter(
      r => !['completed', 'cancelled', 'refunded'].includes(r.status?.toLowerCase() || '')
    );

    let healthyRMARate = 0;
    if (kpi && kpi.totalOrders > 0) {
      healthyRMARate = Number(((rmas.length / kpi.totalOrders) * 100).toFixed(2));
    }

    let connectedSheetsCount = 0;
    try {
      if (GoogleSheetsLiveService.getConnectionConfig('sales')?.isConnected) connectedSheetsCount++;
      if (GoogleSheetsLiveService.getConnectionConfig('purchasing')?.isConnected) connectedSheetsCount++;
      if (GoogleSheetsLiveService.getConnectionConfig('rma')?.isConnected) connectedSheetsCount++;
    } catch {}

    return {
      totalSales: kpi?.totalSales || 0,
      totalOrders: kpi?.totalOrders || 0,
      totalUnits: kpi?.totalUnits || 0,
      activePOSpend,
      openPOCount: activePOs.length,
      pendingDeliveries,
      reorderAlertsCount,
      lowStockCount,
      activeRMAsCount: activeRMAs.length,
      healthyRMARate,
      connectedSheetsCount,
      activeStoresCount: storeStats.length,
      activeMarketplacesCount: marketplaceStats.length,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  }
}
