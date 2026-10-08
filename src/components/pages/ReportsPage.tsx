import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Layers,
  Globe,
  Store,
  Package,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import {
  DayTrendPoint,
  KPISummary,
  MarketplaceStat,
  ProductStat,
  SalesRecord,
  StoreStat
} from '../../types';
import { formatCurrency, formatPercent } from '../../services/analytics';
import { exportToCSV, exportToExcel } from '../../services/excelParser';

interface ReportsPageProps {
  records: SalesRecord[];
  dailyTrend: DayTrendPoint[];
  marketplaceStats: MarketplaceStat[];
  storeStats: StoreStat[];
  productStats: ProductStat[];
  kpi: KPISummary;
  currency: string;
}

type ReportType =
  | 'daily_sales'
  | 'marketplace_summary'
  | 'store_performance'
  | 'product_performance'
  | 'profit_margin'
  | 'monthly_summary';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  records,
  dailyTrend,
  marketplaceStats,
  storeStats,
  productStats,
  kpi,
  currency
}) => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('daily_sales');

  const reportsList = [
    {
      id: 'daily_sales' as ReportType,
      title: 'Daily Sales Report',
      desc: 'Day-by-day revenue velocity, orders, and units tally',
      icon: Calendar
    },
    {
      id: 'marketplace_summary' as ReportType,
      title: 'Marketplace Comparison Report',
      desc: 'Channel share, volume, and order density by platform',
      icon: Globe
    },
    {
      id: 'store_performance' as ReportType,
      title: 'Store Performance Report',
      desc: 'Comprehensive multi-store P&L and contribution analysis',
      icon: Store
    },
    {
      id: 'product_performance' as ReportType,
      title: 'Product & SKU Performance Report',
      desc: 'Top revenue drivers, unit volume, and ASP metrics',
      icon: Package
    },
    {
      id: 'profit_margin' as ReportType,
      title: 'Profit & Economics Report',
      desc: 'Gross revenue, estimated COGS, net profit, and margins',
      icon: TrendingUp
    }
  ];

  // Prepare table data and export payload based on selected report
  const reportData = useMemo(() => {
    switch (selectedReport) {
      case 'daily_sales':
        return {
          title: 'Daily Sales Activity Log',
          headers: ['Date', 'Sales Revenue', 'Orders', 'Units Sold', 'Average Order Value (AOV)', 'Profit'],
          rows: dailyTrend.map(d => [
            d.date,
            formatCurrency(d.sales, currency),
            d.orders.toLocaleString(),
            d.units.toLocaleString(),
            formatCurrency(d.orders > 0 ? Math.round(d.sales / d.orders) : 0, currency),
            d.profit > 0 ? formatCurrency(d.profit, currency) : 'N/A'
          ]),
          raw: dailyTrend.map(d => ({
            Date: d.date,
            Sales: d.sales,
            Orders: d.orders,
            Units: d.units,
            AOV: d.orders > 0 ? Math.round(d.sales / d.orders) : 0,
            Profit: d.profit
          }))
        };

      case 'marketplace_summary':
        return {
          title: 'Marketplace Distribution Analysis',
          headers: ['Marketplace', 'Stores', 'Sales Revenue', 'Orders', 'Units', 'AOV', 'Share %', 'Growth %'],
          rows: marketplaceStats.map(m => [
            m.marketplace,
            m.storeCount,
            formatCurrency(m.sales, currency),
            m.orders.toLocaleString(),
            m.units.toLocaleString(),
            formatCurrency(m.aov, currency),
            `${m.contributionPercent}%`,
            m.growth !== null ? formatPercent(m.growth, true) : 'N/A'
          ]),
          raw: marketplaceStats.map(m => ({
            Marketplace: m.marketplace,
            'Store Count': m.storeCount,
            Sales: m.sales,
            Orders: m.orders,
            Units: m.units,
            AOV: m.aov,
            'Share %': m.contributionPercent,
            'Growth %': m.growth
          }))
        };

      case 'store_performance':
        return {
          title: 'Multi-Store Operations Audit',
          headers: ['Store Name', 'Marketplace', 'Sales Revenue', 'Orders', 'Units', 'AOV', 'Profit', 'Share %'],
          rows: storeStats.map(s => [
            s.store,
            s.marketplace,
            formatCurrency(s.sales, currency),
            s.orders.toLocaleString(),
            s.units.toLocaleString(),
            formatCurrency(s.aov, currency),
            s.profit !== null ? formatCurrency(s.profit, currency) : 'N/A',
            `${s.contributionPercent}%`
          ]),
          raw: storeStats.map(s => ({
            Store: s.store,
            Marketplace: s.marketplace,
            Sales: s.sales,
            Orders: s.orders,
            Units: s.units,
            AOV: s.aov,
            Profit: s.profit,
            'Share %': s.contributionPercent
          }))
        };

      case 'product_performance':
        return {
          title: 'Catalog SKU Breakdown',
          headers: ['Product Name', 'SKU', 'Marketplace', 'Store', 'Units Sold', 'Revenue', 'Profit', 'ASP'],
          rows: productStats.map(p => [
            p.product,
            p.sku,
            p.marketplace,
            p.store,
            p.units.toLocaleString(),
            formatCurrency(p.sales, currency),
            p.profit !== null ? formatCurrency(p.profit, currency) : 'N/A',
            formatCurrency(p.asp, currency)
          ]),
          raw: productStats.map(p => ({
            Product: p.product,
            SKU: p.sku,
            Marketplace: p.marketplace,
            Store: p.store,
            Units: p.units,
            Sales: p.sales,
            Profit: p.profit,
            ASP: p.asp
          }))
        };

      case 'profit_margin':
        return {
          title: 'Profit & Economics Summary',
          headers: ['Store Name', 'Marketplace', 'Sales', 'Cost (COGS)', 'Net Profit', 'Profit Margin %'],
          rows: storeStats.map(s => {
            const cost = s.profit !== null ? s.sales - s.profit : null;
            const margin = s.sales > 0 && s.profit !== null ? (s.profit / s.sales) * 100 : null;
            return [
              s.store,
              s.marketplace,
              formatCurrency(s.sales, currency),
              cost !== null ? formatCurrency(cost, currency) : 'N/A',
              s.profit !== null ? formatCurrency(s.profit, currency) : 'N/A',
              margin !== null ? formatPercent(margin) : 'N/A'
            ];
          }),
          raw: storeStats.map(s => ({
            Store: s.store,
            Marketplace: s.marketplace,
            Sales: s.sales,
            Cost: s.profit !== null ? s.sales - s.profit : 'N/A',
            Profit: s.profit !== null ? s.profit : 'N/A',
            Margin: s.sales > 0 && s.profit !== null ? (s.profit / s.sales) * 100 : 'N/A'
          }))
        };

      default:
        return { title: 'Report', headers: [], rows: [], raw: [] };
    }
  }, [selectedReport, dailyTrend, marketplaceStats, storeStats, productStats, currency]);

  const handleExport = (type: 'csv' | 'xlsx') => {
    const filename = `splus_${selectedReport}_${new Date().toISOString().split('T')[0]}`;
    if (type === 'csv') {
      exportToCSV(reportData.raw, `${filename}.csv`);
    } else {
      exportToExcel(reportData.raw, `${filename}.xlsx`, 'Report Data');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
              <FileText size={18} />
            </div>
            Executive Reports & Export Center
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Pre-compiled business intelligence summaries ready for stakeholder review, Excel download, or print.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-xs font-semibold shadow-xs"
          >
            <Download size={13} /> Export Excel
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {reportsList.map(rep => {
          const Icon = rep.icon;
          const isSelected = selectedReport === rep.id;

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-black dark:border-white shadow-md'
                  : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              <div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${
                  isSelected ? 'bg-white text-black dark:bg-black dark:text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}>
                  <Icon size={16} />
                </div>
                <div className="text-xs font-bold">
                  {rep.title}
                </div>
                <div className={`text-[11px] mt-1 leading-relaxed ${isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'}`}>
                  {rep.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Preview Document */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs p-6 space-y-4 print:border-none print:shadow-none">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Splus Analytics Report
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {reportData.title}
            </h3>
          </div>
          <div className="text-xs text-zinc-400">
            Generated on {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {reportData.headers.map((h, i) => (
                  <th
                    key={h}
                    className={`p-3 ${i >= 1 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-200">
              {reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportData.headers.length} className="p-8 text-center text-zinc-400">
                    No records available to compile this report.
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    {row.map((val, cellIdx) => (
                      <td
                        key={cellIdx}
                        className={`p-3 ${
                          cellIdx === 0
                            ? 'font-bold text-zinc-900 dark:text-white'
                            : 'text-right font-mono'
                        }`}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
