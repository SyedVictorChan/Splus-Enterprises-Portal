import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Download,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckSquare,
  Square,
  FileSpreadsheet,
  ListFilter,
  DollarSign,
  ShoppingCart,
  Receipt,
  Ban,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { DailySummaryRow, SalesRecord, REGISTERED_STORES } from '../../types';
import { formatCurrency } from '../../services/analytics';
import { exportToCSV, exportToExcel } from '../../services/excelParser';
import { StorageService } from '../../services/storage';
import {
  downloadDailyReportTemplate,
  DAILY_STORES_ORDER,
  DEFAULT_SAMPLE_PURCHASING,
  getYesterdayDateString
} from '../../services/dailySheetService';

interface DailySalesPageProps {
  records: SalesRecord[];
  currency: string;
}

type ViewMode = 'daily_sheet' | 'transactions';

type ColumnKey =
  | 'date'
  | 'orderId'
  | 'marketplace'
  | 'store'
  | 'product'
  | 'sku'
  | 'units'
  | 'sales'
  | 'cost'
  | 'profit'
  | 'returns'
  | 'refunds'
  | 'orderStatus';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align?: 'left' | 'right' | 'center';
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Date', defaultVisible: true },
  { key: 'orderId', label: 'Order ID', defaultVisible: true },
  { key: 'marketplace', label: 'Marketplace', defaultVisible: true },
  { key: 'store', label: 'Store', defaultVisible: true },
  { key: 'product', label: 'Product Name', defaultVisible: true },
  { key: 'sku', label: 'SKU', defaultVisible: true },
  { key: 'units', label: 'Units', align: 'right', defaultVisible: true },
  { key: 'sales', label: 'Sales Revenue', align: 'right', defaultVisible: true },
  { key: 'cost', label: 'COGS / Cost', align: 'right', defaultVisible: true },
  { key: 'profit', label: 'Net Profit', align: 'right', defaultVisible: true },
  { key: 'returns', label: 'Returns', align: 'right', defaultVisible: false },
  { key: 'refunds', label: 'Refunds', align: 'right', defaultVisible: false },
  { key: 'orderStatus', label: 'Status', align: 'center', defaultVisible: true }
];

export const DailySalesPage: React.FC<DailySalesPageProps> = ({ records, currency }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('daily_sheet');

  const yesterdayStr = useMemo(() => getYesterdayDateString(), []);

  // Available unique dates
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(records.map(r => r.date))).sort().reverse();
    if (dates.length === 0) return [yesterdayStr];
    return dates;
  }, [records, yesterdayStr]);

  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const dates = Array.from(new Set(records.map(r => r.date))).sort().reverse();
    if (dates.includes(yesterdayStr)) return yesterdayStr;
    return dates[0] || yesterdayStr;
  });

  // Granular table filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('all');
  const [selectedStore, setSelectedStore] = useState('all');
  const [sortColumn, setSortColumn] = useState<ColumnKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
  );
  const [showColPicker, setShowColPicker] = useState(false);

  // Calculate or retrieve daily breakdown for selectedDay
  const dailySheetData = useMemo(() => {
    // 1. Check if an explicit imported daily report exists for this day
    const savedReport = StorageService.getDailyReportForDate(selectedDay);
    if (savedReport) {
      return savedReport;
    }

    // 2. Otherwise compute from sales records for this date across the 14 stores
    const dayRecords = records.filter(r => r.date === selectedDay);

    const rows: DailySummaryRow[] = DAILY_STORES_ORDER.map(storeDef => {
      const storeRecs = dayRecords.filter(r => r.store === storeDef.store);
      const orders = storeRecs.reduce((sum, r) => sum + (r.units || 1), 0);
      const totalSales = storeRecs.reduce((sum, r) => sum + r.sales, 0);
      const refunds = storeRecs.reduce((sum, r) => sum + (r.refunds || 0), 0);
      const cancellation = 0;

      return {
        companyName: storeDef.companyName,
        store: storeDef.store,
        marketplace: storeDef.marketplace,
        orders,
        totalSales: Math.round(totalSales * 100) / 100,
        refunds: Math.round(refunds * 100) / 100,
        cancellation
      };
    });

    const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
    const totalSales = rows.reduce((s, r) => s + r.totalSales, 0);
    const totalRefunds = rows.reduce((s, r) => s + r.refunds, 0);
    const totalCancellations = rows.reduce((s, r) => s + r.cancellation, 0);

    const purchasingAmount = StorageService.getPurchasingForDate(selectedDay) || (totalSales > 0 ? DEFAULT_SAMPLE_PURCHASING : 0);

    return {
      date: selectedDay,
      rows,
      totalOrders,
      totalSales: Math.round(totalSales * 100) / 100,
      totalRefunds: Math.round(totalRefunds * 100) / 100,
      totalCancellations: Math.round(totalCancellations * 100) / 100,
      totalPurchasingAmount: purchasingAmount
    };
  }, [records, selectedDay]);

  // Unique options for granular table
  const marketplaces = useMemo(() => {
    return Array.from(new Set(records.map(r => r.marketplace))).filter(Boolean);
  }, [records]);

  const stores = useMemo(() => {
    const list = selectedMarketplace === 'all'
      ? records
      : records.filter(r => r.marketplace === selectedMarketplace);
    const set = new Set(list.map(r => r.store));
    REGISTERED_STORES.forEach(s => {
      if (selectedMarketplace === 'all' || s.marketplace === selectedMarketplace) {
        set.add(s.name);
      }
    });
    return Array.from(set).filter(Boolean);
  }, [records, selectedMarketplace]);

  // Filtering & Sorting for granular table
  const filteredRecords = useMemo(() => {
    return records
      .filter(r => {
        if (selectedMarketplace !== 'all' && r.marketplace !== selectedMarketplace) return false;
        if (selectedStore !== 'all' && r.store !== selectedStore) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            r.product.toLowerCase().includes(q) ||
            r.sku.toLowerCase().includes(q) ||
            r.orderId.toLowerCase().includes(q) ||
            r.store.toLowerCase().includes(q) ||
            r.marketplace.toLowerCase().includes(q) ||
            r.date.includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortColumn];
        let valB: any = b[sortColumn];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
  }, [records, selectedMarketplace, selectedStore, searchQuery, sortColumn, sortDirection]);

  // Page slice
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleSort = (col: ColumnKey) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    const next = new Set(visibleColumns);
    if (next.has(key)) {
      if (next.size > 2) next.delete(key);
    } else {
      next.add(key);
    }
    setVisibleColumns(next);
  };

  // Export current daily breakdown
  const handleExportDailySheet = (type: 'xlsx' | 'csv') => {
    downloadDailyReportTemplate(selectedDay, type, {
      rows: dailySheetData.rows.map(r => ({
        companyName: r.companyName,
        orders: r.orders,
        sales: r.totalSales,
        refunds: r.refunds,
        cancellation: r.cancellation
      })),
      purchasingAmount: dailySheetData.totalPurchasingAmount
    });
  };

  // Export granular transactions
  const handleExportTransactions = (type: 'csv' | 'xlsx') => {
    const exportData = filteredRecords.map(r => ({
      Date: r.date,
      'Order ID': r.orderId,
      Marketplace: r.marketplace,
      Store: r.store,
      Product: r.product,
      SKU: r.sku,
      Units: r.units,
      'Sales (Revenue)': r.sales,
      Cost: r.cost !== undefined ? r.cost : 'N/A',
      Profit: r.profit !== undefined ? r.profit : 'N/A',
      Returns: r.returns !== undefined ? r.returns : 'N/A',
      Refunds: r.refunds !== undefined ? r.refunds : 'N/A',
      Status: r.orderStatus || 'Completed'
    }));

    if (type === 'csv') {
      exportToCSV(exportData, `splus_transaction_records_${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      exportToExcel(exportData, `splus_transaction_records_${new Date().toISOString().split('T')[0]}.xlsx`, 'Transactions');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Banner & View Mode Switcher */}
      <div className="bg-[#FFFDF8] dark:bg-[#1A2228] py-8 px-6 rounded-2xl border border-[#D9E0E2] dark:border-[#2C373E] shadow-2xs flex flex-col items-center justify-center text-center space-y-3 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-[#EAF1F5] dark:bg-[#25323A] text-[#3D647A] dark:text-[#B4CAD6] border border-[#D0DFE7] dark:border-[#384852]">
          <Calendar size={13} className="text-[#6E93A9]" />
          <span>Daily Store Operations</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#263238] dark:text-white flex flex-wrap items-center justify-center gap-2 sm:gap-3 leading-tight">
          <span className="font-extrabold text-[#263238] dark:text-white">Daily Sales</span>
          <span className="text-[#D9E0E2] dark:text-[#2C373E] font-light hidden sm:inline">|</span>
          <span className="text-[#556770] dark:text-[#CBD5E1] font-bold">
            Store Operations
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-[#65747C] dark:text-[#94A3B8] max-w-2xl font-normal leading-relaxed">
          Daily executive sheet breakdown across 14 stores & granular order transactions
        </p>

        {/* View Switcher Tabs */}
        <div className="pt-1 flex items-center justify-center">
          <div className="flex items-center p-1 rounded-xl bg-[#F8F6F0] dark:bg-[#222C33] border border-[#D9E0E2] dark:border-[#2C373E]">
            <button
              onClick={() => setViewMode('daily_sheet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'daily_sheet'
                  ? 'bg-[#7A9FB4] text-white shadow-xs'
                  : 'text-[#65747C] dark:text-[#94A3B8] hover:text-[#263238] dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>Daily Sheet View</span>
            </button>
            <button
              onClick={() => setViewMode('transactions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'transactions'
                  ? 'bg-[#7A9FB4] text-white shadow-xs'
                  : 'text-[#65747C] dark:text-[#94A3B8] hover:text-[#263238] dark:hover:text-white'
              }`}
            >
              <ListFilter size={14} />
              <span>Transactions List</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DAILY SHEET VIEW (Matches user's daily Excel sheet layout) */}
      {viewMode === 'daily_sheet' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Day Selector & Quick Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Calendar size={14} />
                Select Reporting Date:
              </label>
              <select
                value={selectedDay}
                onChange={e => setSelectedDay(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>
                    {d} {d === yesterdayStr ? '(Yesterday - Previous Day)' : d === new Date().toISOString().split('T')[0] ? '(Today)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleExportDailySheet('xlsx')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs transition-colors"
                title={`Download this exact daily breakdown for ${selectedDay} in Excel format`}
              >
                <Download size={13} /> Export Day Sheet (.XLSX)
              </button>
              <button
                onClick={() => downloadDailyReportTemplate(undefined, 'xlsx')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors"
                title={`Download template for yesterday (${yesterdayStr}) to fill in and upload`}
              >
                <Download size={13} /> Daily Template (Yesterday: {yesterdayStr})
              </button>
            </div>
          </div>

          {/* Daily KPI Snapshot Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Orders</div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                {dailySheetData.totalOrders.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Across 14 store channels</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Daily Sales</div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                ${dailySheetData.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Gross revenue</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Refunds</div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                ${dailySheetData.totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {dailySheetData.totalSales > 0 ? `${((dailySheetData.totalRefunds / dailySheetData.totalSales) * 100).toFixed(1)}% of sales` : '0%'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Cancellation</div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">
                ${dailySheetData.totalCancellations.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Canceled transactions</div>
            </div>

            <div className="p-4 rounded-2xl bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">Purchasing Breakdown</div>
              <div className="text-xl font-extrabold mt-1">
                ${dailySheetData.totalPurchasingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] opacity-75 mt-0.5">
                Net: ${(dailySheetData.totalSales - dailySheetData.totalPurchasingAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Table 1: Sales Breakdown (Exact reproduction of uploaded sheet) */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Sales Breakdown</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Daily figures per registered storefront for {selectedDay}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                14 Stores
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold border-b border-zinc-200 dark:border-zinc-700">
                  <tr>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4 text-right">No. of Orders</th>
                    <th className="py-3 px-4 text-right">Total Sales</th>
                    <th className="py-3 px-4 text-right">Refunds</th>
                    <th className="py-3 px-4 text-right">Cancellation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {dailySheetData.rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        {row.companyName}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-zinc-800 dark:text-zinc-200">
                        {row.orders}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-zinc-900 dark:text-white">
                        ${row.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right text-zinc-600 dark:text-zinc-400">
                        ${row.refunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right text-zinc-600 dark:text-zinc-400">
                        {row.cancellation > 0
                          ? `$${row.cancellation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : 'NIL'}
                      </td>
                    </tr>
                  ))}
                  {/* Total Summary Row */}
                  <tr className="bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white border-t-2 border-zinc-300 dark:border-zinc-600">
                    <td className="py-3 px-4 text-sm font-extrabold">Total</td>
                    <td className="py-3 px-4 text-right text-sm">{dailySheetData.totalOrders}</td>
                    <td className="py-3 px-4 text-right text-sm">
                      ${dailySheetData.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      ${dailySheetData.totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-sm">
                      {dailySheetData.totalCancellations > 0
                        ? `$${dailySheetData.totalCancellations.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'NIL'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Purchasing Breakdown */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Purchasing Breakdown
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Daily inventory procurement and purchasing balance
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Total Purchasing Amount
                  </span>
                  <span className="text-lg font-extrabold text-zinc-900 dark:text-white">
                    ${dailySheetData.totalPurchasingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DETAILED TRANSACTIONS LIST */}
      {viewMode === 'transactions' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                All Transactions & Order Records
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {filteredRecords.length.toLocaleString()} matching records found
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Column Visibility Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowColPicker(!showColPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100"
                >
                  <SlidersHorizontal size={13} /> Columns
                </button>

                {showColPicker && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-2 z-20 text-xs space-y-1">
                    <div className="px-2 py-1 font-bold text-zinc-400 text-[10px] uppercase">
                      Visible Columns
                    </div>
                    {ALL_COLUMNS.map(col => (
                      <button
                        key={col.key}
                        onClick={() => toggleColumn(col.key)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700/60"
                      >
                        {visibleColumns.has(col.key) ? (
                          <CheckSquare size={14} className="text-black dark:text-white" />
                        ) : (
                          <Square size={14} className="text-zinc-400" />
                        )}
                        <span>{col.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Export Buttons */}
              <button
                onClick={() => handleExportTransactions('xlsx')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
              >
                <Download size={13} /> Excel
              </button>
              <button
                onClick={() => handleExportTransactions('csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
              >
                <Download size={13} /> CSV
              </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search SKU, Product, Order ID..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
              />
            </div>

            {/* Marketplace select */}
            <div>
              <select
                value={selectedMarketplace}
                onChange={e => {
                  setSelectedMarketplace(e.target.value);
                  setSelectedStore('all');
                  setCurrentPage(1);
                }}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none"
              >
                <option value="all">All Marketplaces ({marketplaces.length})</option>
                {marketplaces.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Store select */}
            <div>
              <select
                value={selectedStore}
                onChange={e => {
                  setSelectedStore(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none"
              >
                <option value="all">All Stores ({stores.length})</option>
                {stores.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Page Size */}
            <div className="flex items-center justify-end gap-2 text-xs text-zinc-500">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800 select-none">
                  <tr>
                    {ALL_COLUMNS.filter(c => visibleColumns.has(c.key)).map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`p-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        <div
                          className={`inline-flex items-center gap-1 ${
                            col.align === 'right'
                              ? 'justify-end'
                              : col.align === 'center'
                              ? 'justify-center'
                              : 'justify-start'
                          }`}
                        >
                          <span>{col.label}</span>
                          <ArrowUpDown
                            size={12}
                            className={`transition-opacity ${
                              sortColumn === col.key ? 'text-black dark:text-white opacity-100' : 'opacity-30'
                            }`}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleColumns.size}
                        className="py-12 text-center text-zinc-400 dark:text-zinc-500"
                      >
                        No sales transactions match the active search or filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map(row => (
                      <tr
                        key={row.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        {visibleColumns.has('date') && (
                          <td className="p-3 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            {row.date}
                          </td>
                        )}
                        {visibleColumns.has('orderId') && (
                          <td className="p-3 font-mono font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                            {row.orderId}
                          </td>
                        )}
                        {visibleColumns.has('marketplace') && (
                          <td className="p-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                              {row.marketplace}
                            </span>
                          </td>
                        )}
                        {visibleColumns.has('store') && (
                          <td className="p-3 text-zinc-800 dark:text-zinc-200 whitespace-nowrap font-medium">
                            {row.store}
                          </td>
                        )}
                        {visibleColumns.has('product') && (
                          <td className="p-3 text-zinc-900 dark:text-zinc-100 font-medium max-w-xs truncate" title={row.product}>
                            {row.product}
                          </td>
                        )}
                        {visibleColumns.has('sku') && (
                          <td className="p-3 font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                            {row.sku}
                          </td>
                        )}
                        {visibleColumns.has('units') && (
                          <td className="p-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                            {row.units}
                          </td>
                        )}
                        {visibleColumns.has('sales') && (
                          <td className="p-3 text-right font-bold text-zinc-900 dark:text-white">
                            ${row.sales.toFixed(2)}
                          </td>
                        )}
                        {visibleColumns.has('cost') && (
                          <td className="p-3 text-right text-zinc-600 dark:text-zinc-400 font-mono">
                            {row.cost !== undefined ? `$${row.cost.toFixed(2)}` : '—'}
                          </td>
                        )}
                        {visibleColumns.has('profit') && (
                          <td className="p-3 text-right font-bold text-zinc-900 dark:text-white font-mono">
                            {row.profit !== undefined ? `$${row.profit.toFixed(2)}` : '—'}
                          </td>
                        )}
                        {visibleColumns.has('returns') && (
                          <td className="p-3 text-right text-zinc-600 dark:text-zinc-400">
                            {row.returns || 0}
                          </td>
                        )}
                        {visibleColumns.has('refunds') && (
                          <td className="p-3 text-right text-zinc-600 dark:text-zinc-400">
                            {row.refunds ? `$${row.refunds.toFixed(2)}` : '$0.00'}
                          </td>
                        )}
                        {visibleColumns.has('orderStatus') && (
                          <td className="p-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {row.orderStatus || 'Completed'}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-xs">
              <div className="text-zinc-500 dark:text-zinc-400">
                Showing{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {Math.min(currentPage * pageSize, filteredRecords.length)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {filteredRecords.length.toLocaleString()}
                </span>{' '}
                records
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
