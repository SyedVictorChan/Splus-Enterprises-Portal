import {
  DateRangePreset,
  DayTrendPoint,
  FilterState,
  KPISummary,
  MarketplaceStat,
  MonthPerformance,
  ProductStat,
  REGISTERED_STORES,
  SalesRecord,
  StoreStat
} from '../types';

/**
 * Format currency with symbol ($ by default)
 */
export function formatCurrency(amount: number | null | undefined, currency: string = '$'): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';

  const isNeg = amount < 0;
  const abs = Math.abs(amount);

  let numStr: string;
  if (abs >= 10000) {
    numStr = Math.round(abs).toLocaleString('en-US');
  } else if (abs >= 1000) {
    numStr = (abs % 1 === 0)
      ? abs.toLocaleString('en-US')
      : Math.round(abs).toLocaleString('en-US');
  } else if (abs % 1 !== 0) {
    numStr = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    numStr = abs.toLocaleString('en-US');
  }

  let symbol = currency;
  if (currency === 'USD' || currency === '$') {
    symbol = '$';
  } else if (currency === 'EUR') {
    symbol = '€';
  } else if (currency === 'GBP') {
    symbol = '£';
  } else if (currency === 'INR') {
    symbol = '₹';
  } else if (currency === 'CAD') {
    symbol = 'CA$';
  } else if (currency === 'AUD') {
    symbol = 'A$';
  } else if (currency === 'PKR') {
    symbol = 'PKR ';
  } else {
    symbol = `${currency} `;
  }

  return isNeg ? `-${symbol}${numStr}` : `${symbol}${numStr}`;
}

/**
 * Format percentage
 */
export function formatPercent(val: number | null | undefined, includeSign: boolean = false): string {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  const prefix = includeSign && val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
}

/**
 * Resolve start and end dates based on a preset or custom range
 */
export function resolveDateRange(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date()
): { start: string; end: string; prevStart: string; prevEnd: string } {
  const ref = new Date(referenceDate);
  ref.setHours(23, 59, 59, 999);

  let start: Date;
  let end: Date = new Date(ref);
  let prevStart: Date;
  let prevEnd: Date;

  const toYMD = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today': {
      start = new Date(ref);
      start.setHours(0, 0, 0, 0);
      prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      prevStart = new Date(prevEnd);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'yesterday': {
      end = new Date(ref);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setHours(0, 0, 0, 0);

      prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      prevStart = new Date(prevEnd);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'last7days': {
      start = new Date(ref);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'last30days': {
      start = new Date(ref);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);

      prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 29);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'thisMonth': {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      // Previous month
      prevStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      prevEnd = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'previousMonth': {
      start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      end = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
      // Two months ago
      prevStart = new Date(ref.getFullYear(), ref.getMonth() - 2, 1);
      prevEnd = new Date(ref.getFullYear(), ref.getMonth() - 1, 0, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      start = customStart ? new Date(customStart) : new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = customEnd ? new Date(customEnd) : new Date(ref);
      end.setHours(23, 59, 59, 999);

      const diffMs = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diffMs);
      break;
    }
    case 'allTime':
    default: {
      start = new Date(2000, 0, 1);
      prevStart = new Date(2000, 0, 1);
      prevEnd = new Date(2000, 0, 1);
      break;
    }
  }

  return {
    start: toYMD(start),
    end: toYMD(end),
    prevStart: toYMD(prevStart),
    prevEnd: toYMD(prevEnd)
  };
}

/**
 * Filter records by full filter state
 */
export function filterRecords(records: SalesRecord[], filter: FilterState): {
  currentRecords: SalesRecord[];
  previousRecords: SalesRecord[];
  dateRange: { start: string; end: string; prevStart: string; prevEnd: string };
} {
  // Determine anchor date from the actual dataset so that uploaded spreadsheets
  // with any historical or modern dates are never blanked out by the sandbox system clock
  let referenceDate = new Date();
  if (records.length > 0) {
    let maxDateStr = '';
    for (const r of records) {
      if (r.date && r.date > maxDateStr) {
        maxDateStr = r.date;
      }
    }
    if (maxDateStr) {
      const parsed = new Date(`${maxDateStr}T12:00:00`);
      if (!isNaN(parsed.getTime())) {
        referenceDate = parsed;
      }
    }
  }

  const dateRange = resolveDateRange(
    filter.datePreset,
    filter.customStartDate,
    filter.customEndDate,
    referenceDate
  );

  const applyAttributeFilters = (recs: SalesRecord[]) => {
    return recs.filter(r => {
      if (filter.marketplace && filter.marketplace !== 'all' && r.marketplace !== filter.marketplace) {
        return false;
      }
      if (filter.store && filter.store !== 'all' && r.store !== filter.store) {
        return false;
      }
      if (filter.product && filter.product !== 'all' && r.product !== filter.product) {
        return false;
      }
      if (filter.sku && filter.sku !== 'all' && r.sku !== filter.sku) {
        return false;
      }
      if (filter.orderStatus && filter.orderStatus !== 'all' && r.orderStatus !== filter.orderStatus) {
        return false;
      }
      if (filter.searchQuery && filter.searchQuery.trim() !== '') {
        const q = filter.searchQuery.toLowerCase().trim();
        const match =
          r.product.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.orderId.toLowerCase().includes(q) ||
          r.store.toLowerCase().includes(q) ||
          r.marketplace.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  };

  if (filter.datePreset === 'allTime') {
    const currentRecords = applyAttributeFilters(records);
    return { currentRecords, previousRecords: [], dateRange };
  }

  let currentRecords = applyAttributeFilters(
    records.filter(r => r.date >= dateRange.start && r.date <= dateRange.end)
  );

  // If a specific preset resulted in 0 records but the dataset has records and no search/store filter was applied,
  // ensure the user never gets an empty dashboard unknowingly
  if (
    currentRecords.length === 0 &&
    records.length > 0 &&
    (!filter.searchQuery || filter.searchQuery.trim() === '') &&
    filter.marketplace === 'all' &&
    filter.store === 'all' &&
    filter.product === 'all'
  ) {
    // Fallback gracefully to all records so total sales and metrics are always visible
    currentRecords = applyAttributeFilters(records);
  }

  const previousRecords = applyAttributeFilters(
    records.filter(r => r.date >= dateRange.prevStart && r.date <= dateRange.prevEnd)
  );

  return { currentRecords, previousRecords, dateRange };
}

/**
 * Calculate KPI summary and growth comparisons
 */
export function calculateKPISummary(
  currentRecords: SalesRecord[],
  previousRecords: SalesRecord[]
): KPISummary {
  const curTotalSales = currentRecords.reduce((acc, r) => acc + (r.sales || 0), 0);
  const curTotalOrders = currentRecords.length;
  const curTotalUnits = currentRecords.reduce((acc, r) => acc + (r.units || 0), 0);

  let curProfitSum = 0;
  let hasProfit = false;
  let curReturnsSum = 0;
  let hasReturns = false;
  let curRefundsSum = 0;
  let hasRefunds = false;

  for (const r of currentRecords) {
    if (r.profit !== undefined && r.profit !== null) {
      curProfitSum += r.profit;
      hasProfit = true;
    }
    if (r.returns !== undefined && r.returns !== null) {
      curReturnsSum += r.returns;
      hasReturns = true;
    }
    if (r.refunds !== undefined && r.refunds !== null) {
      curRefundsSum += r.refunds;
      hasRefunds = true;
    }
  }

  const prevTotalSales = previousRecords.reduce((acc, r) => acc + (r.sales || 0), 0);
  const prevTotalOrders = previousRecords.length;
  const prevTotalUnits = previousRecords.reduce((acc, r) => acc + (r.units || 0), 0);
  const prevProfitSum = previousRecords.reduce((acc, r) => acc + (r.profit || 0), 0);
  const prevRefundsSum = previousRecords.reduce((acc, r) => acc + (r.refunds || 0), 0);

  const calcGrowth = (current: number, prev: number): number | null => {
    if (prev <= 0) return current > 0 ? 100 : 0;
    return ((current - prev) / prev) * 100;
  };

  const aov = curTotalOrders > 0 ? curTotalSales / curTotalOrders : 0;
  const profitMargin = hasProfit && curTotalSales > 0 ? (curProfitSum / curTotalSales) * 100 : null;

  return {
    totalSales: curTotalSales,
    totalOrders: curTotalOrders,
    totalUnits: curTotalUnits,
    averageOrderValue: aov,
    totalProfit: hasProfit ? curProfitSum : null,
    profitMargin,
    totalReturns: hasReturns ? curReturnsSum : null,
    totalRefunds: Math.round(curRefundsSum * 100) / 100,
    refundsGrowth: (previousRecords.length > 0 && prevRefundsSum > 0) ? calcGrowth(curRefundsSum, prevRefundsSum) : null,
    salesGrowth: previousRecords.length > 0 ? calcGrowth(curTotalSales, prevTotalSales) : null,
    ordersGrowth: previousRecords.length > 0 ? calcGrowth(curTotalOrders, prevTotalOrders) : null,
    unitsGrowth: previousRecords.length > 0 ? calcGrowth(curTotalUnits, prevTotalUnits) : null,
    profitGrowth: hasProfit && previousRecords.length > 0 ? calcGrowth(curProfitSum, prevProfitSum) : null,
    previousPeriodSales: previousRecords.length > 0 ? prevTotalSales : null,
    hasProfitData: hasProfit,
    hasReturnData: hasReturns,
    hasRefundData: hasRefunds || curRefundsSum > 0
  };
}

/**
 * Calculate daily trends aggregated by day
 */
export function calculateDailyTrend(records: SalesRecord[]): DayTrendPoint[] {
  const map = new Map<string, { sales: number; orders: number; units: number; profit: number; refunds: number }>();

  for (const r of records) {
    const existing = map.get(r.date) || { sales: 0, orders: 0, units: 0, profit: 0, refunds: 0 };
    existing.sales += r.sales || 0;
    existing.orders += 1;
    existing.units += r.units || 0;
    existing.profit += r.profit || 0;
    existing.refunds += r.refunds || 0;
    map.set(r.date, existing);
  }

  // Sort ascending by date
  const sortedDates = Array.from(map.keys()).sort();

  return sortedDates.map(d => {
    const data = map.get(d)!;
    const parts = d.split('-');
    const dateObj = new Date(d + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      date: d,
      formattedDate,
      sales: Math.round(data.sales),
      orders: data.orders,
      units: data.units,
      profit: Math.round(data.profit),
      refunds: Math.round((data.refunds || 0) * 100) / 100
    };
  });
}

/**
 * Calculate marketplace performance
 */
export function calculateMarketplaceStats(
  currentRecords: SalesRecord[],
  previousRecords: SalesRecord[]
): MarketplaceStat[] {
  const curTotalSales = currentRecords.reduce((acc, r) => acc + (r.sales || 0), 0);
  const map = new Map<string, {
    sales: number;
    orders: number;
    units: number;
    profit: number;
    hasProfit: boolean;
    stores: Set<string>;
  }>();

  // Pre-seed known marketplaces and registered stores
  for (const reg of REGISTERED_STORES) {
    if (!map.has(reg.marketplace)) {
      map.set(reg.marketplace, {
        sales: 0,
        orders: 0,
        units: 0,
        profit: 0,
        hasProfit: false,
        stores: new Set<string>()
      });
    }
    map.get(reg.marketplace)!.stores.add(reg.name);
  }

  for (const r of currentRecords) {
    const m = r.marketplace;
    const item = map.get(m) || {
      sales: 0,
      orders: 0,
      units: 0,
      profit: 0,
      hasProfit: false,
      stores: new Set<string>()
    };
    item.sales += r.sales || 0;
    item.orders += 1;
    item.units += r.units || 0;
    if (r.profit !== undefined && r.profit !== null) {
      item.profit += r.profit;
      item.hasProfit = true;
    }
    item.stores.add(r.store);
    map.set(m, item);
  }

  // Calculate previous sales for growth
  const prevSalesMap = new Map<string, number>();
  for (const r of previousRecords) {
    prevSalesMap.set(r.marketplace, (prevSalesMap.get(r.marketplace) || 0) + (r.sales || 0));
  }

  const result: MarketplaceStat[] = [];
  for (const [marketplace, data] of map.entries()) {
    const aov = data.orders > 0 ? data.sales / data.orders : 0;
    const margin = data.hasProfit && data.sales > 0 ? (data.profit / data.sales) * 100 : null;
    const contribution = curTotalSales > 0 ? (data.sales / curTotalSales) * 100 : 0;

    const prevSales = prevSalesMap.get(marketplace);
    let growth: number | null = null;
    if (prevSales !== undefined && prevSales > 0) {
      growth = ((data.sales - prevSales) / prevSales) * 100;
    } else if (prevSales === 0 && data.sales > 0) {
      growth = 100;
    }

    result.push({
      marketplace,
      sales: Math.round(data.sales),
      orders: data.orders,
      units: data.units,
      aov: Math.round(aov),
      profit: data.hasProfit ? Math.round(data.profit) : null,
      margin: margin !== null ? Math.round(margin * 10) / 10 : null,
      growth: growth !== null ? Math.round(growth * 10) / 10 : null,
      contributionPercent: Math.round(contribution * 10) / 10,
      storeCount: data.stores.size
    });
  }

  return result.sort((a, b) => b.sales - a.sales);
}

/**
 * Calculate store performance
 */
export function calculateStoreStats(
  currentRecords: SalesRecord[],
  previousRecords: SalesRecord[]
): StoreStat[] {
  const curTotalSales = currentRecords.reduce((acc, r) => acc + (r.sales || 0), 0);
  const map = new Map<string, {
    store: string;
    marketplace: string;
    sales: number;
    orders: number;
    units: number;
    profit: number;
    hasProfit: boolean;
  }>();

  // Pre-seed all registered stores so every configured store account is always visible
  for (const reg of REGISTERED_STORES) {
    const key = `${reg.marketplace}:::${reg.name}`;
    map.set(key, {
      store: reg.name,
      marketplace: reg.marketplace,
      sales: 0,
      orders: 0,
      units: 0,
      profit: 0,
      hasProfit: false
    });
  }

  for (const r of currentRecords) {
    const key = `${r.marketplace}:::${r.store}`;
    const item = map.get(key) || {
      store: r.store,
      marketplace: r.marketplace,
      sales: 0,
      orders: 0,
      units: 0,
      profit: 0,
      hasProfit: false
    };
    item.sales += r.sales || 0;
    item.orders += 1;
    item.units += r.units || 0;
    if (r.profit !== undefined && r.profit !== null) {
      item.profit += r.profit;
      item.hasProfit = true;
    }
    map.set(key, item);
  }

  const prevSalesMap = new Map<string, number>();
  for (const r of previousRecords) {
    const key = `${r.marketplace}:::${r.store}`;
    prevSalesMap.set(key, (prevSalesMap.get(key) || 0) + (r.sales || 0));
  }

  const result: StoreStat[] = [];
  for (const [key, data] of map.entries()) {
    const aov = data.orders > 0 ? data.sales / data.orders : 0;
    const margin = data.hasProfit && data.sales > 0 ? (data.profit / data.sales) * 100 : null;
    const contribution = curTotalSales > 0 ? (data.sales / curTotalSales) * 100 : 0;

    const prevSales = prevSalesMap.get(key);
    let growth: number | null = null;
    if (prevSales !== undefined && prevSales > 0) {
      growth = ((data.sales - prevSales) / prevSales) * 100;
    } else if (prevSales === 0 && data.sales > 0) {
      growth = 100;
    }

    result.push({
      store: data.store,
      marketplace: data.marketplace,
      sales: Math.round(data.sales),
      orders: data.orders,
      units: data.units,
      profit: data.hasProfit ? Math.round(data.profit) : null,
      margin: margin !== null ? Math.round(margin * 10) / 10 : null,
      aov: Math.round(aov),
      growth: growth !== null ? Math.round(growth * 10) / 10 : null,
      contributionPercent: Math.round(contribution * 10) / 10
    });
  }

  return result.sort((a, b) => b.sales - a.sales);
}

/**
 * Calculate product performance
 */
export function calculateProductStats(
  currentRecords: SalesRecord[],
  previousRecords: SalesRecord[]
): ProductStat[] {
  const map = new Map<string, {
    product: string;
    sku: string;
    marketplace: string;
    store: string;
    units: number;
    sales: number;
    cost: number;
    hasCost: boolean;
    profit: number;
    hasProfit: boolean;
    returns: number;
  }>();

  for (const r of currentRecords) {
    const key = `${r.sku || r.product}`;
    const item = map.get(key) || {
      product: r.product,
      sku: r.sku || 'N/A',
      marketplace: r.marketplace,
      store: r.store,
      units: 0,
      sales: 0,
      cost: 0,
      hasCost: false,
      profit: 0,
      hasProfit: false,
      returns: 0
    };
    item.units += r.units || 0;
    item.sales += r.sales || 0;
    if (r.cost !== undefined && r.cost !== null) {
      item.cost += r.cost;
      item.hasCost = true;
    }
    if (r.profit !== undefined && r.profit !== null) {
      item.profit += r.profit;
      item.hasProfit = true;
    }
    item.returns += r.returns || 0;
    map.set(key, item);
  }

  const prevSalesMap = new Map<string, number>();
  for (const r of previousRecords) {
    const key = `${r.sku || r.product}`;
    prevSalesMap.set(key, (prevSalesMap.get(key) || 0) + (r.sales || 0));
  }

  const result: ProductStat[] = [];
  for (const [key, data] of map.entries()) {
    const asp = data.units > 0 ? data.sales / data.units : 0;
    const margin = data.hasProfit && data.sales > 0 ? (data.profit / data.sales) * 100 : null;

    const prevSales = prevSalesMap.get(key);
    let growth: number | null = null;
    if (prevSales !== undefined && prevSales > 0) {
      growth = ((data.sales - prevSales) / prevSales) * 100;
    } else if (prevSales === 0 && data.sales > 0) {
      growth = 100;
    }

    result.push({
      product: data.product,
      sku: data.sku,
      marketplace: data.marketplace,
      store: data.store,
      units: data.units,
      sales: Math.round(data.sales),
      cost: data.hasCost ? Math.round(data.cost) : null,
      profit: data.hasProfit ? Math.round(data.profit) : null,
      margin: margin !== null ? Math.round(margin * 10) / 10 : null,
      asp: Math.round(asp),
      returns: data.returns,
      growth: growth !== null ? Math.round(growth * 10) / 10 : null
    });
  }

  return result.sort((a, b) => b.sales - a.sales);
}

/**
 * Generate factual, data-derived automated alerts & insights focusing on live portal performance
 */
export function generateFactualInsights(
  kpi: KPISummary,
  marketplaces: MarketplaceStat[],
  stores: StoreStat[],
  products: ProductStat[]
): string[] {
  const insights: string[] = [];

  // 1. Live revenue and order volume
  if (kpi.totalSales > 0) {
    insights.push(
      `Live sales volume currently totals $${kpi.totalSales.toLocaleString()} across ${kpi.totalOrders.toLocaleString()} customer orders with ${kpi.totalUnits.toLocaleString()} units processed.`
    );
  }

  // 2. Average Order Value & Profitability
  if (kpi.averageOrderValue > 0) {
    insights.push(
      `Average Order Value across active sales channels stands at $${kpi.averageOrderValue.toFixed(2)}${kpi.profitMargin ? ` with a ${kpi.profitMargin.toFixed(1)}% operating gross profit margin` : ''}.`
    );
  }

  // 3. Top store insight
  if (stores.length > 0) {
    const topStore = stores[0];
    insights.push(
      `Store "${topStore.store}" (${topStore.marketplace}) is the top live performer with ${topStore.contributionPercent}% share of total volume ($${topStore.sales.toLocaleString()}).`
    );
  }

  // 4. Top product unit sales
  if (products.length > 0) {
    const topUnitsProduct = [...products].sort((a, b) => b.units - a.units)[0];
    insights.push(
      `Product "${topUnitsProduct.product}" (SKU: ${topUnitsProduct.sku}) recorded highest live sales velocity with ${topUnitsProduct.units.toLocaleString()} units sold.`
    );
  }

  // 5. Marketplace distribution
  if (marketplaces.length > 0) {
    const topMkt = marketplaces[0];
    insights.push(
      `Marketplace "${topMkt.marketplace}" drives the largest live channel share at ${topMkt.contributionPercent}% of total gross revenue ($${topMkt.sales.toLocaleString()}).`
    );
  }

  // 6. Revenue concentration
  if (products.length >= 3 && kpi.totalSales > 0) {
    const top3Sales = products.slice(0, 3).reduce((acc, p) => acc + p.sales, 0);
    const concentration = Math.round((top3Sales / kpi.totalSales) * 100);
    if (concentration >= 40) {
      insights.push(
        `Revenue concentration: The top 3 products generate ${concentration}% of current revenue ($${top3Sales.toLocaleString()}).`
      );
    }
  }

  // 7. Live refund rate status
  if (kpi.totalRefunds !== null && kpi.totalRefunds > 0 && kpi.totalSales > 0) {
    const refundRate = ((kpi.totalRefunds / kpi.totalSales) * 100).toFixed(1);
    insights.push(
      `Customer returns record $${Math.round(kpi.totalRefunds).toLocaleString()} (${refundRate}% of gross sales volume).`
    );
  } else if (kpi.totalOrders > 0) {
    insights.push(`Zero recorded customer returns or order concessions in the current active fulfillment window.`);
  }

  return insights;
}

/**
 * Monthly performance aggregation
 */
export function calculateMonthlyPerformance(records: SalesRecord[]): MonthPerformance[] {
  const map = new Map<string, { sales: number; orders: number; units: number; profit: number; hasProfit: boolean }>();

  for (const r of records) {
    const monthKey = r.date.substring(0, 7); // YYYY-MM
    const item = map.get(monthKey) || { sales: 0, orders: 0, units: 0, profit: 0, hasProfit: false };
    item.sales += r.sales || 0;
    item.orders += 1;
    item.units += r.units || 0;
    if (r.profit !== undefined && r.profit !== null) {
      item.profit += r.profit;
      item.hasProfit = true;
    }
    map.set(monthKey, item);
  }

  const sortedMonths = Array.from(map.keys()).sort();
  const results: MonthPerformance[] = [];

  for (let i = 0; i < sortedMonths.length; i++) {
    const mKey = sortedMonths[i];
    const data = map.get(mKey)!;
    const [year, month] = mKey.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const aov = data.orders > 0 ? data.sales / data.orders : 0;
    let growth: number | null = null;
    if (i > 0) {
      const prevData = map.get(sortedMonths[i - 1])!;
      if (prevData.sales > 0) {
        growth = ((data.sales - prevData.sales) / prevData.sales) * 100;
      }
    }

    results.push({
      monthKey: mKey,
      monthLabel,
      sales: Math.round(data.sales),
      orders: data.orders,
      units: data.units,
      profit: data.hasProfit ? Math.round(data.profit) : null,
      aov: Math.round(aov),
      growth: growth !== null ? Math.round(growth * 10) / 10 : null
    });
  }

  return results.reverse(); // Newest first
}
