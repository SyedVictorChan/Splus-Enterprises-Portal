import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  PackageCheck,
  CreditCard,
  Building2,
  FileSpreadsheet,
  Layers,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Download,
  Printer,
  ChevronRight,
  Boxes,
  DollarSign,
  FileText,
  User,
  X,
  RefreshCw,
  ExternalLink,
  Edit2,
  Calendar
} from 'lucide-react';
import {
  Supplier,
  PurchaseOrder,
  PurchaseReceipt,
  SupplierPayment,
  PurchasingFilterState,
  POStatus,
  ProductPurchasingSummary,
  ProductCostChange,
  InventoryStockConnection
} from '../../types/purchasing';
import { SalesRecord } from '../../types';
import { PurchasingService, isDemoPO } from '../../services/purchasingService';
import { PurchasingKPIs } from './PurchasingKPIs';
import { PurchasingFilterBar } from './PurchasingFilterBar';
import { PurchasingTrendChart } from './PurchasingTrendChart';
import { CreatePOModal } from './CreatePOModal';
import { ReceivePOModal } from './ReceivePOModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { SupplierModal } from './SupplierModal';
import { SupplierDetailView } from './SupplierDetailView';
import { PurchasingErrorBoundary } from './PurchasingErrorBoundary';
import { useAuth } from '../../context/AuthContext';
import { LiveConnectionBanner } from '../googleSheets/LiveConnectionBanner';
import { GoogleSheetsLiveService } from '../../services/googleSheetsLiveService';
import { PurchasingQuickLookup } from './PurchasingQuickLookup';

interface Props {
  records?: SalesRecord[];
  currency?: string;
  currencySymbol?: string;
}

type PurchasingTab =
  | 'overview'
  | 'orders'
  | 'suppliers'
  | 'products'
  | 'costs'
  | 'inventory'
  | 'payments'
  | 'reports';

export const PurchasingDashboard: React.FC<Props> = ({
  records = [],
  currency = 'USD',
  currencySymbol = '$'
}) => {
  const { user } = useAuth();
  const currentUserName = user?.displayName || user?.email || 'Faraz Rizvi';

  // Data State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<PurchasingTab>('overview');

  // Supplier Detail View State
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Modals State
  const [isCreatePOOpen, setIsCreatePOOpen] = useState<boolean>(false);
  const [prefilledSupplierId, setPrefilledSupplierId] = useState<string | undefined>();
  const [receiveTargetPO, setReceiveTargetPO] = useState<PurchaseOrder | null>(null);
  const [paymentTargetPO, setPaymentTargetPO] = useState<PurchaseOrder | null>(null);
  const [supplierModalData, setSupplierModalData] = useState<{ isOpen: boolean; supplier?: Supplier | null }>({
    isOpen: false
  });
  const [selectedPODetail, setSelectedPODetail] = useState<PurchaseOrder | null>(null);

  // Filter State: defaults to 'all' so all records show if no filter is applied
  const [filters, setFilters] = useState<PurchasingFilterState>({
    datePreset: 'all',
    supplierId: 'all',
    platform: 'all',
    purchaser: 'all',
    paymentMethod: 'all',
    status: 'all',
    paymentStatus: 'all',
    receivingStatus: 'all',
    searchQuery: ''
  });

  // Sorting State for Products / Cost
  const [productSortBy, setProductSortBy] = useState<'value' | 'quantity' | 'cost' | 'frequency'>('value');
  const [ordersSortBy, setOrdersSortBy] = useState<'date' | 'total' | 'status'>('date');
  const [overviewRowLimit, setOverviewRowLimit] = useState<number | 'all'>(10);

  // Load all initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [supData, poData, recData, payData] = await Promise.all([
        PurchasingService.getSuppliers(),
        PurchasingService.getPurchaseOrders(),
        PurchasingService.getReceipts(),
        PurchasingService.getPayments()
      ]);
      setSuppliers(supData);
      setPos(poData);
      setReceipts(recData);
      setPayments(payData);
    } catch (e) {
      console.warn('Error loading purchasing data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick lookup filter integration
  const handleQuickLookupFilter = (poNumber: string, dateVal: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (poNumber.trim()) {
        next.searchQuery = poNumber.trim();
      } else {
        next.searchQuery = '';
      }

      if (dateVal.trim()) {
        next.datePreset = 'custom';
        next.customStartDate = dateVal.trim();
        next.customEndDate = dateVal.trim();
      } else if (!poNumber.trim()) {
        next.datePreset = 'all';
        next.customStartDate = undefined;
        next.customEndDate = undefined;
      }
      return next;
    });
  };

  useEffect(() => {
    loadData();
    // Subscribe to cloud updates for real-time multi-user synchronization
    const unsubCloud = PurchasingService.initSync(() => {
      loadData();
    });
    // Subscribe to live Google Sheets synchronized records (strictly excluding demo records)
    const unsubLive = GoogleSheetsLiveService.subscribeToPOs(livePOs => {
      const clean = (livePOs || []).filter(p => !isDemoPO(p.id, p) && !(p as any).isDeletedFromSource);
      setPos(clean);
    });
    return () => {
      unsubCloud();
      unsubLive();
    };
  }, []);

  // Distinct platforms and purchasers from current records for filter dropdowns
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>();
    pos.forEach(p => {
      if (p.buyingForPlatform && p.buyingForPlatform.trim()) {
        set.add(p.buyingForPlatform.trim());
      }
    });
    return Array.from(set).sort();
  }, [pos]);

  const availablePurchasers = useMemo(() => {
    const set = new Set<string>();
    pos.forEach(p => {
      const name = p.purchaser || p.createdBy;
      if (name && name.trim()) {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort();
  }, [pos]);

  // Filtered POs based on date preset & secondary criteria (platform, purchaser, supplier, etc.)
  const filteredPOs = useMemo(() => {
    // 1. Date filter: reads the date section from sheet; if 'all', shows all records
    let list = PurchasingService.filterPOsByDate(
      pos,
      filters.datePreset,
      filters.customStartDate,
      filters.customEndDate
    );

    // 2. Supplier / Vendor filter
    if (filters.supplierId && filters.supplierId !== 'all') {
      const target = filters.supplierId.toLowerCase();
      list = list.filter(
        po =>
          po.supplierId === filters.supplierId ||
          po.supplierName.toLowerCase() === target ||
          (po.buyingFromVendor && po.buyingFromVendor.toLowerCase() === target)
      );
    }

    // 3. Platform filter
    if (filters.platform && filters.platform !== 'all') {
      list = list.filter(po => po.buyingForPlatform === filters.platform);
    }

    // 4. Purchaser filter
    if (filters.purchaser && filters.purchaser !== 'all') {
      list = list.filter(
        po => po.purchaser === filters.purchaser || po.createdBy === filters.purchaser
      );
    }

    // 5. Payment method filter
    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      list = list.filter(po => po.paymentMethod === filters.paymentMethod);
    }

    // 6. Status filter
    if (filters.status && filters.status !== 'all') {
      list = list.filter(po => po.status === filters.status);
    }

    // 7. Payment status filter
    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      list = list.filter(po => po.paymentStatus === filters.paymentStatus);
    }

    // 8. Receiving status filter
    if (filters.receivingStatus && filters.receivingStatus !== 'all') {
      list = list.filter(po => po.receivingStatus === filters.receivingStatus);
    }

    // 9. Global Search across sheet columns: PO #, Supplier/Vendor, SKU, Product, Reason, Purchaser, Platform, Tracking #, Line Item, etc.
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      list = list.filter(po => {
        const matchesPo = po.poNumber.toLowerCase().includes(q);
        const matchesSupplier =
          po.supplierName.toLowerCase().includes(q) ||
          (po.buyingFromVendor || '').toLowerCase().includes(q);
        const matchesReason = (po.reason || '').toLowerCase().includes(q);
        const matchesPurchaser = (po.purchaser || po.createdBy || '').toLowerCase().includes(q);
        const matchesPlatform = (po.buyingForPlatform || '').toLowerCase().includes(q);
        const matchesPayMethod = (po.paymentMethod || '').toLowerCase().includes(q);
        const matchesTracking = (po.trackingNumber || '').toLowerCase().includes(q);
        const matchesLineItem = String(po.lineItem || '').toLowerCase().includes(q);
        const matchesDate = (po.rawDate || po.poDate || '').toLowerCase().includes(q);
        const matchesItem = po.items.some(
          i => i.sku.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q)
        );
        return (
          matchesPo ||
          matchesSupplier ||
          matchesReason ||
          matchesPurchaser ||
          matchesPlatform ||
          matchesPayMethod ||
          matchesTracking ||
          matchesLineItem ||
          matchesDate ||
          matchesItem
        );
      });
    }

    return list;
  }, [pos, filters]);

  // Derived KPIs based on filtered POs
  const kpis = useMemo(() => {
    return PurchasingService.calculateKPIs(filteredPOs, suppliers);
  }, [filteredPOs, suppliers]);

  // Derived Trend Chart points
  const trendData = useMemo(() => {
    return PurchasingService.generateTrendData(filteredPOs);
  }, [filteredPOs]);

  // Product Purchasing Analysis
  const productAnalysis = useMemo(() => {
    const data = PurchasingService.getProductPurchasingAnalysis(pos);
    return data.sort((a, b) => {
      if (productSortBy === 'value') return b.totalPurchaseValue - a.totalPurchaseValue;
      if (productSortBy === 'quantity') return b.quantityPurchased - a.quantityPurchased;
      if (productSortBy === 'cost') return b.lastPurchaseCost - a.lastPurchaseCost;
      if (productSortBy === 'frequency') return b.purchaseFrequency - a.purchaseFrequency;
      return 0;
    });
  }, [pos, productSortBy]);

  // Product Cost Changes over time
  const costChanges = useMemo(() => {
    return PurchasingService.getProductCostChanges(productAnalysis);
  }, [productAnalysis]);

  // Read-only Inventory Stock Connection
  const inventoryConnection = useMemo(() => {
    return PurchasingService.getInventoryStockConnection(records, pos);
  }, [records, pos]);

  // Existing SKUs from sales records for easy autocomplete
  const existingSkusList = useMemo(() => {
    const map = new Map<string, { sku: string; product: string; defaultCost?: number }>();
    records.forEach(r => {
      if (r.sku && !map.has(r.sku)) {
        map.set(r.sku, { sku: r.sku, product: r.product || r.sku, defaultCost: r.cost });
      }
    });
    return Array.from(map.values());
  }, [records]);

  // Handlers for PO & Supplier updates
  const handleSavePO = async (newPO: PurchaseOrder) => {
    await PurchasingService.savePurchaseOrder(newPO);
    await loadData();
  };

  const handleReceivePO = async (
    poId: string,
    receivedItems: { sku: string; quantityReceived: number }[],
    receivedBy: string,
    notes?: string
  ) => {
    await PurchasingService.receivePurchaseOrder(poId, receivedItems, receivedBy, notes);
    await loadData();
  };

  const handleRecordPayment = async (paymentData: Omit<SupplierPayment, 'id' | 'createdAt'>) => {
    await PurchasingService.recordPayment(paymentData);
    await loadData();
  };

  const handleSaveSupplier = async (supplier: Supplier) => {
    await PurchasingService.saveSupplier(supplier);
    await loadData();
  };

  const handleToggleSupplierStatus = async (supplierId: string) => {
    await PurchasingService.toggleSupplierStatus(supplierId);
    await loadData();
  };

  const handleStatusChange = async (poId: string, newStatus: POStatus) => {
    await PurchasingService.updatePurchaseOrderStatus(poId, newStatus);
    await loadData();
  };

  // Helper for Status Badge Styling
  const getPOStatusBadge = (status: POStatus | string) => {
    switch (status) {
      case 'Received':
      case 'Closed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Partially Received':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Ordered':
      case 'Approved':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Pending Approval':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Draft':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      case 'Cancelled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  // Sub-Navigation Tabs definition
  const tabs: { id: PurchasingTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Dashboard' },
    { id: 'orders', label: 'Purchase Orders', count: filteredPOs.length },
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length },
    { id: 'products', label: 'Product Purchasing' },
    { id: 'costs', label: 'Cost Analysis', count: costChanges.length },
    { id: 'inventory', label: 'Inventory & Stock' },
    { id: 'payments', label: 'Payment Ledger', count: payments.length },
    { id: 'reports', label: 'Reports' }
  ];

  return (
    <PurchasingErrorBoundary>
      <div id="purchasing-module" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
        {/* Module Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white shadow-sm">
                <ShoppingCart size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Purchasing & Procurement
                  <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Enterprise Cloud
                  </span>
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5">
                  End-to-end purchase orders, supplier management, receiving workflows, and inventory replenishment
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="header-create-po-btn"
              onClick={() => {
                setPrefilledSupplierId(undefined);
                setIsCreatePOOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl shadow transition-all hover:scale-[1.01]"
            >
              <Plus size={15} />
              <span>New Purchase Order</span>
            </button>

            <button
              id="header-add-supplier-btn"
              onClick={() => setSupplierModalData({ isOpen: true, supplier: null })}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl transition-colors"
            >
              <Building2 size={14} />
              <span>Add Supplier</span>
            </button>

            <button
              id="header-export-btn"
              onClick={() => PurchasingService.exportData('orders', 'xlsx', filteredPOs, suppliers, payments, currencySymbol)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl transition-colors"
              title="Export POs to Excel"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Live Google Sheets Connection Status Bar */}
        <LiveConnectionBanner
          target="purchasing"
          title="Purchasing Dashboard"
          onDataRefreshed={loadData}
        />

        {/* Quick PO Number & Date Lookup Card (Takes data from Purchasing Sheet and shows all 14 details) */}
        <PurchasingQuickLookup
          pos={pos}
          currencySymbol={currencySymbol}
          onSelectPO={po => setSelectedPODetail(po)}
          onReceivePO={po => setReceiveTargetPO(po)}
          onPayPO={po => setPaymentTargetPO(po)}
          onRefreshSheet={loadData}
          isLoading={isLoading}
          onApplyFilter={handleQuickLookupFilter}
        />

        {/* If viewing a single supplier's detail drill-down */}
        {selectedSupplier ? (
          <SupplierDetailView
            supplier={selectedSupplier}
            allPOs={pos}
            allPayments={payments}
            onBack={() => setSelectedSupplier(null)}
            onEditSupplier={sup => setSupplierModalData({ isOpen: true, supplier: sup })}
            onCreatePO={supId => {
              setPrefilledSupplierId(supId);
              setIsCreatePOOpen(true);
            }}
            onSelectPO={po => setSelectedPODetail(po)}
            currencySymbol={currencySymbol}
          />
        ) : (
          <>
            {/* Horizontal Module Sub-Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-zinc-800 scrollbar-thin">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  id={`purchasing-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
                      activeTab === tab.id ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-zinc-400'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW DASHBOARD */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Global Purchasing Filter Bar */}
                <PurchasingFilterBar
                  filters={filters}
                  suppliers={suppliers}
                  platforms={availablePlatforms}
                  purchasers={availablePurchasers}
                  onChange={setFilters}
                  onReset={() =>
                    setFilters({
                      datePreset: 'all',
                      supplierId: 'all',
                      platform: 'all',
                      purchaser: 'all',
                      paymentMethod: 'all',
                      status: 'all',
                      paymentStatus: 'all',
                      receivingStatus: 'all',
                      searchQuery: ''
                    })
                  }
                  onRefresh={loadData}
                  isLoading={isLoading}
                />

                {/* 8 Top KPI Cards */}
                <PurchasingKPIs kpis={kpis} currencySymbol={currencySymbol} />

                {/* Trend Chart with Metric Switcher */}
                <PurchasingTrendChart data={trendData} currencySymbol={currencySymbol} />

                {/* Supplier & Stock Reorder Quick Glance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Active Vendors Card */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Top Active Suppliers</h3>
                      <button
                        onClick={() => setActiveTab('suppliers')}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Directory
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {suppliers.slice(0, 4).map(sup => {
                        const supPOs = pos.filter(p => p.supplierId === sup.id && p.status !== 'Cancelled');
                        const supSpend = supPOs.reduce((acc, p) => acc + p.totalAmount, 0);

                        return (
                          <div
                            key={sup.id}
                            onClick={() => setSelectedSupplier(sup)}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-medium text-white truncate">{sup.name}</div>
                              <div className="text-[10px] text-zinc-400">{sup.country} • {sup.paymentTerms}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs font-semibold text-zinc-200">
                                {currencySymbol}{supSpend.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-zinc-500">{supPOs.length} orders</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stock Alert Summary from Inventory Connection */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Stock Reorder Alerts</h3>
                      <button
                        onClick={() => setActiveTab('inventory')}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Inventory View
                      </button>
                    </div>

                    <div className="space-y-2">
                      {inventoryConnection
                        .filter(i => i.reorderStatus === 'Reorder Needed' || i.reorderStatus === 'Low Stock')
                        .slice(0, 3)
                        .map((inv, idx) => (
                          <div key={`${inv.sku}-${idx}`} className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800 text-xs">
                            <div className="min-w-0 pr-2">
                              <div className="font-mono text-zinc-300 truncate">{inv.sku}</div>
                              <div className="text-[10px] text-zinc-400 truncate">{inv.product}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                              inv.reorderStatus === 'Reorder Needed'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                              {inv.reorderStatus} ({inv.currentStock} left)
                            </span>
                          </div>
                        ))}
                      {inventoryConnection.filter(i => i.reorderStatus === 'Reorder Needed' || i.reorderStatus === 'Low Stock').length === 0 && (
                        <div className="text-center py-3 text-xs text-zinc-500">
                          All catalog inventory levels are within nominal thresholds.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Purchasing Dashboard Orders Table (All 15 Google Sheet Columns) */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-950/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">Purchase Orders</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          15 Sheet Columns Live
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Displaying all procurement attributes synchronized with Google Sheets ({filteredPOs.length} total records)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Row limit selector */}
                      <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 text-xs text-zinc-400">
                        <span className="px-2 py-1 text-[11px] text-zinc-500">Show:</span>
                        <button
                          onClick={() => setOverviewRowLimit(10)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            overviewRowLimit === 10 ? 'bg-zinc-800 text-white font-semibold' : 'hover:text-zinc-200'
                          }`}
                        >
                          10
                        </button>
                        <button
                          onClick={() => setOverviewRowLimit(25)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            overviewRowLimit === 25 ? 'bg-zinc-800 text-white font-semibold' : 'hover:text-zinc-200'
                          }`}
                        >
                          25
                        </button>
                        <button
                          onClick={() => setOverviewRowLimit('all')}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                            overviewRowLimit === 'all' ? 'bg-zinc-800 text-white font-semibold' : 'hover:text-zinc-200'
                          }`}
                        >
                          All ({filteredPOs.length})
                        </button>
                      </div>

                      <button
                        onClick={() => setActiveTab('orders')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors border border-zinc-700"
                      >
                        <span>Manage Orders Tab</span>
                        <ChevronRight size={14} />
                      </button>

                      <button
                        onClick={() => {
                          setPrefilledSupplierId(undefined);
                          setIsCreatePOOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-zinc-200 text-zinc-950 rounded-lg shadow transition-colors"
                      >
                        <Plus size={14} />
                        <span>Create PO</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-medium">
                        <tr>
                          <th className="px-3 py-3">Date</th>
                          <th className="px-3 py-3">Reason</th>
                          <th className="px-3 py-3">Purchaser</th>
                          <th className="px-3 py-3">Platform</th>
                          <th className="px-3 py-3">Vendor</th>
                          <th className="px-3 py-3">Payment Method</th>
                          <th className="px-3 py-3 text-center">Qty</th>
                          <th className="px-3 py-3">Line Item</th>
                          <th className="px-3 py-3">PO Number</th>
                          <th className="px-3 py-3 text-right">PO Amount</th>
                          <th className="px-3 py-3 text-center">Payment Status</th>
                          <th className="px-3 py-3">Tracking No.</th>
                          <th className="px-3 py-3">Delivered Date</th>
                          <th className="px-3 py-3">Received Date</th>
                          <th className="px-3 py-3 text-center">Status</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {filteredPOs.length === 0 ? (
                          <tr>
                            <td colSpan={16} className="px-4 py-12 text-center text-zinc-500">
                              No purchase orders found matching current filters.
                            </td>
                          </tr>
                        ) : (
                          (overviewRowLimit === 'all' ? filteredPOs : filteredPOs.slice(0, overviewRowLimit)).map(po => {
                            const displayDate = po.rawDate || po.poDate;
                            const displayVendor = po.buyingFromVendor || po.supplierName;
                            const displayPurchaser = po.purchaser || po.createdBy || '—';
                            const displayPlatform = po.buyingForPlatform || 'All Platforms';
                            const displayQty = po.qtyPurchased ?? po.totalQuantity;
                            const displayLineItem = String(po.lineItem || (po.items[0]?.productName || '1'));
                            const displayAmount = po.poAmount ?? po.totalAmount;
                            const displayDelivered = po.deliveredDate || po.expectedDeliveryDate || '—';
                            const displayReceived = po.receivedDate || (po.status === 'Received' ? po.poDate : '—');

                            return (
                              <tr key={po.id} className="hover:bg-zinc-800/30 transition-colors">
                                {/* 1. Date */}
                                <td className="px-3 py-2.5 text-zinc-300 font-medium">
                                  {displayDate}
                                </td>

                                {/* 2. Reason */}
                                <td className="px-3 py-2.5 text-zinc-400 max-w-[160px] truncate" title={po.reason || ''}>
                                  {po.reason || '—'}
                                </td>

                                {/* 3. Purchaser */}
                                <td className="px-3 py-2.5 text-zinc-300">
                                  {displayPurchaser}
                                </td>

                                {/* 4. Buying for Platform */}
                                <td className="px-3 py-2.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {displayPlatform}
                                  </span>
                                </td>

                                {/* 5. Buying from Vendor */}
                                <td className="px-3 py-2.5 font-medium text-white max-w-[160px] truncate" title={displayVendor}>
                                  {displayVendor}
                                </td>

                                {/* 6. Payment Method */}
                                <td className="px-3 py-2.5 text-zinc-300">
                                  {po.paymentMethod || 'Payoneer'}
                                </td>

                                {/* 7. Qty Purchased */}
                                <td className="px-3 py-2.5 text-center font-mono font-medium text-white">
                                  {displayQty}
                                </td>

                                {/* 8. Line Item */}
                                <td className="px-3 py-2.5 text-zinc-300 max-w-[140px] truncate" title={displayLineItem}>
                                  {displayLineItem}
                                </td>

                                {/* 9. PO Number */}
                                <td className="px-3 py-2.5 font-mono font-semibold text-blue-400">
                                  {po.poNumber}
                                </td>

                                {/* 10. PO Amount */}
                                <td className="px-3 py-2.5 text-right font-semibold text-white">
                                  {currencySymbol}{displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                {/* 11. Payment Status */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    po.paymentStatus === 'Paid'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : po.paymentStatus === 'Partially Paid'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                  }`}>
                                    {po.paymentStatus}
                                  </span>
                                </td>

                                {/* 12. Tracking No. */}
                                <td className="px-3 py-2.5 font-mono text-zinc-400 max-w-[120px] truncate" title={po.trackingNumber || ''}>
                                  {po.trackingNumber || '—'}
                                </td>

                                {/* 13. Delivered Date */}
                                <td className="px-3 py-2.5 text-zinc-400">
                                  {displayDelivered}
                                </td>

                                {/* 14. Received Date */}
                                <td className="px-3 py-2.5 text-zinc-400">
                                  {displayReceived}
                                </td>

                                {/* 15. Status */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getPOStatusBadge(po.status)}`}>
                                    {po.status}
                                  </span>
                                </td>

                                {/* 16. Actions */}
                                <td className="px-3 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {po.receivingStatus !== 'Received' && po.status !== 'Cancelled' && (
                                      <button
                                        onClick={() => setReceiveTargetPO(po)}
                                        title="Receive Goods"
                                        className="px-2 py-1 text-[11px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded border border-emerald-500/30 transition-colors"
                                      >
                                        Receive
                                      </button>
                                    )}
                                    {po.outstandingAmount > 0 && po.status !== 'Cancelled' && (
                                      <button
                                        onClick={() => setPaymentTargetPO(po)}
                                        title="Pay Supplier"
                                        className="px-2 py-1 text-[11px] bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded border border-purple-500/30 transition-colors"
                                      >
                                        Pay
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setSelectedPODetail(po)}
                                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                                      title="View PO Details"
                                    >
                                      <Eye size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PURCHASE ORDERS MANAGEMENT TABLE */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {/* Filter bar */}
                <PurchasingFilterBar
                  filters={filters}
                  suppliers={suppliers}
                  platforms={availablePlatforms}
                  purchasers={availablePurchasers}
                  onChange={setFilters}
                  onReset={() =>
                    setFilters({
                      datePreset: 'all',
                      supplierId: 'all',
                      platform: 'all',
                      purchaser: 'all',
                      paymentMethod: 'all',
                      status: 'all',
                      paymentStatus: 'all',
                      receivingStatus: 'all',
                      searchQuery: ''
                    })
                  }
                  onRefresh={loadData}
                  isLoading={isLoading}
                />

                {/* Date Filter Status Banner (Reads date section & indicates range / all records) */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-900/70 border border-zinc-800 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className={filters.datePreset === 'all' ? 'text-emerald-400' : 'text-blue-400'} />
                    <div className="text-zinc-300">
                      {filters.datePreset === 'all' ? (
                        <span>
                          <span className="font-semibold text-emerald-400">All Records View:</span> Showing all records from Google Sheet without date restrictions (
                          <span className="font-semibold text-white">{filteredPOs.length}</span> records).
                        </span>
                      ) : filters.datePreset === 'custom' ? (
                        <span>
                          <span className="font-semibold text-blue-400">Custom Date Range:</span> {filters.customStartDate || 'Start'} to {filters.customEndDate || 'Present'} (
                          <span className="font-semibold text-white">{filteredPOs.length}</span> of {pos.length} records).
                        </span>
                      ) : (
                        <span>
                          <span className="font-semibold text-blue-400">Date Range Filter:</span> Preset &quot;{filters.datePreset}&quot; applied (
                          <span className="font-semibold text-white">{filteredPOs.length}</span> of {pos.length} records).
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {filters.datePreset !== 'all' && (
                      <button
                        onClick={() => setFilters(f => ({ ...f, datePreset: 'all' }))}
                        className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                      >
                        Show All Records
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setPrefilledSupplierId(undefined);
                        setIsCreatePOOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-zinc-200 text-zinc-950 rounded-lg shadow transition-colors"
                    >
                      <Plus size={14} />
                      <span>Create Purchase Order</span>
                    </button>
                  </div>
                </div>

                {/* Complete PO Table with 15 Google Sheet Columns */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-medium">
                        <tr>
                          <th className="px-3 py-3">Date</th>
                          <th className="px-3 py-3">Reason</th>
                          <th className="px-3 py-3">Purchaser</th>
                          <th className="px-3 py-3">Platform</th>
                          <th className="px-3 py-3">Vendor</th>
                          <th className="px-3 py-3">Payment Method</th>
                          <th className="px-3 py-3 text-center">Qty</th>
                          <th className="px-3 py-3">Line Item</th>
                          <th className="px-3 py-3">PO Number</th>
                          <th className="px-3 py-3 text-right">PO Amount</th>
                          <th className="px-3 py-3 text-center">Payment Status</th>
                          <th className="px-3 py-3">Tracking No.</th>
                          <th className="px-3 py-3">Delivered Date</th>
                          <th className="px-3 py-3">Received Date</th>
                          <th className="px-3 py-3 text-center">Status</th>
                          <th className="px-3 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {filteredPOs.length === 0 ? (
                          <tr>
                            <td colSpan={16} className="px-4 py-12 text-center text-zinc-500">
                              No purchase orders found matching current filters.
                            </td>
                          </tr>
                        ) : (
                          filteredPOs.map(po => {
                            const displayDate = po.rawDate || po.poDate;
                            const displayVendor = po.buyingFromVendor || po.supplierName;
                            const displayPurchaser = po.purchaser || po.createdBy || '—';
                            const displayPlatform = po.buyingForPlatform || 'All Platforms';
                            const displayQty = po.qtyPurchased ?? po.totalQuantity;
                            const displayLineItem = String(po.lineItem || (po.items[0]?.productName || '1'));
                            const displayAmount = po.poAmount ?? po.totalAmount;
                            const displayDelivered = po.deliveredDate || po.expectedDeliveryDate || '—';
                            const displayReceived = po.receivedDate || (po.status === 'Received' ? po.poDate : '—');

                            return (
                              <tr key={po.id} className="hover:bg-zinc-800/30 transition-colors">
                                {/* 1. Date */}
                                <td className="px-3 py-2.5 text-zinc-300 font-medium">
                                  {displayDate}
                                </td>

                                {/* 2. Reason */}
                                <td className="px-3 py-2.5 text-zinc-400 max-w-[160px] truncate" title={po.reason || ''}>
                                  {po.reason || '—'}
                                </td>

                                {/* 3. Purchaser */}
                                <td className="px-3 py-2.5 text-zinc-300">
                                  {displayPurchaser}
                                </td>

                                {/* 4. Buying for Platform */}
                                <td className="px-3 py-2.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {displayPlatform}
                                  </span>
                                </td>

                                {/* 5. Buying from Vendor */}
                                <td className="px-3 py-2.5 font-medium text-white max-w-[160px] truncate" title={displayVendor}>
                                  {displayVendor}
                                </td>

                                {/* 6. Payment Method */}
                                <td className="px-3 py-2.5 text-zinc-300">
                                  {po.paymentMethod || 'Payoneer'}
                                </td>

                                {/* 7. Qty Purchased */}
                                <td className="px-3 py-2.5 text-center font-mono font-medium text-white">
                                  {displayQty}
                                </td>

                                {/* 8. Line Item */}
                                <td className="px-3 py-2.5 text-zinc-300 max-w-[140px] truncate" title={displayLineItem}>
                                  {displayLineItem}
                                </td>

                                {/* 9. PO Number */}
                                <td className="px-3 py-2.5 font-mono font-semibold text-blue-400">
                                  {po.poNumber}
                                </td>

                                {/* 10. PO Amount */}
                                <td className="px-3 py-2.5 text-right font-semibold text-white">
                                  {currencySymbol}{displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                {/* 11. Payment Status */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    po.paymentStatus === 'Paid'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : po.paymentStatus === 'Partially Paid'
                                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                  }`}>
                                    {po.paymentStatus}
                                  </span>
                                </td>

                                {/* 12. Tracking No. */}
                                <td className="px-3 py-2.5 font-mono text-zinc-400 max-w-[120px] truncate" title={po.trackingNumber || ''}>
                                  {po.trackingNumber || '—'}
                                </td>

                                {/* 13. Delivered Date */}
                                <td className="px-3 py-2.5 text-zinc-400">
                                  {displayDelivered}
                                </td>

                                {/* 14. Received Date */}
                                <td className="px-3 py-2.5 text-zinc-400">
                                  {displayReceived}
                                </td>

                                {/* 15. Status */}
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getPOStatusBadge(po.status)}`}>
                                    {po.status}
                                  </span>
                                </td>

                                {/* 16. Actions */}
                                <td className="px-3 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {po.receivingStatus !== 'Received' && po.status !== 'Cancelled' && (
                                      <button
                                        onClick={() => setReceiveTargetPO(po)}
                                        title="Receive Goods"
                                        className="px-2 py-1 text-[11px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded border border-emerald-500/30 transition-colors"
                                      >
                                        Receive
                                      </button>
                                    )}
                                    {po.outstandingAmount > 0 && po.status !== 'Cancelled' && (
                                      <button
                                        onClick={() => setPaymentTargetPO(po)}
                                        title="Pay Supplier"
                                        className="px-2 py-1 text-[11px] bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded border border-purple-500/30 transition-colors"
                                      >
                                        Pay
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setSelectedPODetail(po)}
                                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                                      title="View PO Details"
                                    >
                                      <Eye size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SUPPLIER DIRECTORY */}
            {activeTab === 'suppliers' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Procurement Supplier Directory</h3>
                    <p className="text-xs text-zinc-400">Authorized manufacturing, vendor, and wholesale partners</p>
                  </div>
                  <button
                    onClick={() => setSupplierModalData({ isOpen: true, supplier: null })}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl shadow transition-colors"
                  >
                    <Plus size={14} />
                    <span>Register New Supplier</span>
                  </button>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Supplier Name</th>
                          <th className="px-4 py-3">Contact Person</th>
                          <th className="px-4 py-3">Contact Details</th>
                          <th className="px-4 py-3">Country</th>
                          <th className="px-4 py-3">Payment Terms</th>
                          <th className="px-4 py-3 text-right">Total Purchases</th>
                          <th className="px-4 py-3 text-right">Outstanding</th>
                          <th className="px-4 py-3 text-center">Orders</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {suppliers.map(sup => {
                          const supPOs = pos.filter(p => p.supplierId === sup.id && p.status !== 'Cancelled');
                          const totalSpend = supPOs.reduce((acc, p) => acc + p.totalAmount, 0);
                          const totalOutstanding = supPOs.reduce((acc, p) => acc + p.outstandingAmount, 0);

                          return (
                            <tr
                              key={sup.id}
                              className="hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                              onClick={() => setSelectedSupplier(sup)}
                            >
                              <td className="px-4 py-3 font-mono font-semibold text-white">{sup.code}</td>
                              <td className="px-4 py-3 font-medium text-white group-hover:text-blue-400 transition-colors">
                                {sup.name}
                              </td>
                              <td className="px-4 py-3 text-zinc-300">{sup.contactPerson}</td>
                              <td className="px-4 py-3 text-zinc-400">
                                <div>{sup.email}</div>
                                <div className="text-[10px] text-zinc-500">{sup.phone}</div>
                              </td>
                              <td className="px-4 py-3 text-zinc-300">{sup.country}</td>
                              <td className="px-4 py-3 font-medium text-zinc-200">{sup.paymentTerms}</td>
                              <td className="px-4 py-3 text-right font-semibold text-white">
                                {currencySymbol}{totalSpend.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-rose-400">
                                {currencySymbol}{totalOutstanding.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center text-zinc-300">{supPOs.length}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  sup.status === 'Active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                  {sup.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => setSelectedSupplier(sup)}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                                    title="View Supplier Dashboard"
                                  >
                                    <ExternalLink size={14} />
                                  </button>
                                  <button
                                    onClick={() => setSupplierModalData({ isOpen: true, supplier: sup })}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"
                                    title="Edit Supplier"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleToggleSupplierStatus(sup.id)}
                                    className="px-2 py-1 text-[10px] rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                    title="Toggle Status"
                                  >
                                    {sup.status === 'Active' ? 'Deactivate' : 'Activate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PURCHASING BY PRODUCT */}
            {activeTab === 'products' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Purchasing by Product Analysis</h3>
                    <p className="text-xs text-zinc-400">Historical procurement quantities, average costs, and purchase frequency</p>
                  </div>
                  {/* Sorting Buttons */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-zinc-400 mr-1">Sort by:</span>
                    {[
                      { id: 'value', label: 'Highest Value' },
                      { id: 'quantity', label: 'Highest Qty' },
                      { id: 'cost', label: 'Unit Cost' },
                      { id: 'frequency', label: 'Frequency' }
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => setProductSortBy(s.id as any)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          productSortBy === s.id
                            ? 'bg-zinc-800 text-white font-medium border border-zinc-700'
                            : 'bg-zinc-950 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3">Product Name</th>
                          <th className="px-4 py-3">Primary Supplier</th>
                          <th className="px-4 py-3 text-right">Total Qty Purchased</th>
                          <th className="px-4 py-3 text-right">Avg Unit Cost</th>
                          <th className="px-4 py-3 text-right">Last Unit Cost</th>
                          <th className="px-4 py-3 text-right">Total Purchase Value</th>
                          <th className="px-4 py-3 text-center">Frequency</th>
                          <th className="px-4 py-3 text-right">Last Purchase Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {productAnalysis.map((item, idx) => (
                          <tr key={`${item.sku}-${idx}`} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-medium text-white">{item.sku}</td>
                            <td className="px-4 py-3 font-medium text-zinc-200">{item.product}</td>
                            <td className="px-4 py-3 text-zinc-400">{item.supplier}</td>
                            <td className="px-4 py-3 text-right font-medium text-cyan-400">
                              {item.quantityPurchased.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-300">
                              {currencySymbol}{item.averagePurchaseCost.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-white">
                              {currencySymbol}{item.lastPurchaseCost.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-white">
                              {currencySymbol}{item.totalPurchaseValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-center text-zinc-300">{item.purchaseFrequency} POs</td>
                            <td className="px-4 py-3 text-right text-zinc-400">{item.lastPurchaseDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: COST ANALYSIS & CHANGES OVER TIME */}
            {activeTab === 'costs' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white">Purchasing Cost Analysis</h3>
                  <p className="text-xs text-zinc-400">
                    Track unit price volatility, price increases, and cost trends across replenishment batches
                  </p>
                </div>

                {/* Top Cost KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-xs text-zinc-400 mb-1">Total Procurement Cost</div>
                    <div className="text-xl font-bold text-white">
                      {currencySymbol}{productAnalysis.reduce((acc, i) => acc + i.totalPurchaseValue, 0).toLocaleString()}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Sum of all purchased items</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-xs text-zinc-400 mb-1">Highest Cost Item</div>
                    <div className="text-xl font-bold text-rose-400">
                      {currencySymbol}{Math.max(...productAnalysis.map(p => p.lastPurchaseCost), 0).toFixed(2)}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">Single highest unit purchase price</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="text-xs text-zinc-400 mb-1">Tracked Price Changes</div>
                    <div className="text-xl font-bold text-purple-400">{costChanges.length}</div>
                    <p className="text-[11px] text-zinc-500 mt-1">Products with fluctuating supplier quotes</p>
                  </div>
                </div>

                {/* Cost Changes Table */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-white mb-3">Cost Changes Over Time</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-2.5">SKU</th>
                          <th className="px-4 py-2.5">Product</th>
                          <th className="px-4 py-2.5">Supplier</th>
                          <th className="px-4 py-2.5 text-right">Previous Cost</th>
                          <th className="px-4 py-2.5 text-right">Current Cost</th>
                          <th className="px-4 py-2.5 text-right">Delta ($)</th>
                          <th className="px-4 py-2.5 text-right">Delta (%)</th>
                          <th className="px-4 py-2.5 text-right">Observed Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {costChanges.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                              No unit cost fluctuations detected across existing purchase orders.
                            </td>
                          </tr>
                        ) : (
                          costChanges.map((change, idx) => (
                            <tr key={`${change.sku}-${idx}`} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="px-4 py-3 font-mono font-medium text-white">{change.sku}</td>
                              <td className="px-4 py-3 text-zinc-200 font-medium">{change.product}</td>
                              <td className="px-4 py-3 text-zinc-400">{change.supplier}</td>
                              <td className="px-4 py-3 text-right text-zinc-300">
                                {currencySymbol}{change.previousCost.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-white">
                                {currencySymbol}{change.currentCost.toFixed(2)}
                              </td>
                              <td className={`px-4 py-3 text-right font-semibold flex items-center justify-end gap-1 ${
                                change.changeAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                {change.changeAmount > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                                <span>{change.changeAmount > 0 ? '+' : ''}{currencySymbol}{change.changeAmount.toFixed(2)}</span>
                              </td>
                              <td className={`px-4 py-3 text-right font-medium ${
                                change.changePercentage > 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                {change.changePercentage > 0 ? '+' : ''}{change.changePercentage.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 text-right text-zinc-400">{change.currentDate}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: INVENTORY & STOCK CONNECTION (READ-ONLY) */}
            {activeTab === 'inventory' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Inventory & Procurement Connection</h3>
                    <p className="text-xs text-zinc-400">
                      Live sync with existing catalog products, pending inbound PO shipments, and expected stock
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      Read-Only Integration (Zero Mutation of Sales)
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3">Product Name</th>
                          <th className="px-4 py-3 text-center">Estimated Stock</th>
                          <th className="px-4 py-3 text-center">On Purchase Order</th>
                          <th className="px-4 py-3 text-center">Expected Stock</th>
                          <th className="px-4 py-3 text-center">Reorder Status</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3 text-right">Quick Order</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {inventoryConnection.map((item, idx) => (
                          <tr key={`${item.sku}-${idx}`} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-medium text-white">{item.sku}</td>
                            <td className="px-4 py-3 font-medium text-zinc-200">{item.product}</td>
                            <td className="px-4 py-3 text-center font-semibold text-white">
                              {item.currentStock} units
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-blue-400">
                              {item.onPurchaseOrder > 0 ? `+${item.onPurchaseOrder}` : '0'}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-emerald-400">
                              {item.expectedStock} units
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-medium border ${
                                item.reorderStatus === 'Reorder Needed'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : item.reorderStatus === 'Low Stock'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : item.reorderStatus === 'On Order'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              }`}>
                                {item.reorderStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-400">{item.supplierName || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => {
                                  setPrefilledSupplierId(undefined);
                                  setIsCreatePOOpen(true);
                                }}
                                className="px-2.5 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
                              >
                                Reorder
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: PAYMENTS LEDGER */}
            {activeTab === 'payments' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Supplier Payment Tracking Ledger</h3>
                    <p className="text-xs text-zinc-400">Settlements, wire remittances, cheques, and outstanding supplier liabilities</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      Total Disbursed: <span className="font-semibold text-emerald-400">{currencySymbol}{payments.reduce((acc, p) => acc + p.amount, 0).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3">Payment Date</th>
                          <th className="px-4 py-3">PO Number</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3 text-right">Amount Paid</th>
                          <th className="px-4 py-3">Payment Method</th>
                          <th className="px-4 py-3">Reference # / Cheque</th>
                          <th className="px-4 py-3">Recorded By</th>
                          <th className="px-4 py-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {payments.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                              No payment transactions recorded yet.
                            </td>
                          </tr>
                        ) : (
                          payments.map(p => (
                            <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{p.paymentDate}</td>
                              <td className="px-4 py-3 font-mono font-medium text-white">{p.poNumber}</td>
                              <td className="px-4 py-3 font-medium text-zinc-200">{p.supplierName}</td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-400">
                                {currencySymbol}{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-zinc-300">{p.paymentMethod}</td>
                              <td className="px-4 py-3 font-mono text-zinc-400">{p.referenceNumber || '—'}</td>
                              <td className="px-4 py-3 text-zinc-400">{p.recordedBy}</td>
                              <td className="px-4 py-3 text-zinc-500 max-w-[200px] truncate">{p.notes || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: PURCHASING REPORTS */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white">Exportable Purchasing Reports</h3>
                  <p className="text-xs text-zinc-400">Generate executive procurement summaries, supplier audit sheets, and cost spreadsheets</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Report Card 1 */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-white font-medium text-sm mb-1">
                        <FileSpreadsheet size={16} className="text-emerald-400" />
                        <span>Purchase Orders Ledger</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Comprehensive list of all PO contracts, status, delivery timelines, and payable balances.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => PurchasingService.exportData('orders', 'xlsx', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium text-center"
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => PurchasingService.exportData('orders', 'csv', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors font-medium text-center"
                      >
                        CSV
                      </button>
                    </div>
                  </div>

                  {/* Report Card 2 */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-white font-medium text-sm mb-1">
                        <Building2 size={16} className="text-purple-400" />
                        <span>Supplier Performance Audit</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Vendor directory, credit terms, total spend volume, and active order counts.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => PurchasingService.exportData('suppliers', 'xlsx', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium text-center"
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => PurchasingService.exportData('suppliers', 'csv', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors font-medium text-center"
                      >
                        CSV
                      </button>
                    </div>
                  </div>

                  {/* Report Card 3 */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-white font-medium text-sm mb-1">
                        <Boxes size={16} className="text-cyan-400" />
                        <span>Product Purchasing & Cost</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Itemized SKU breakdown, average unit costs, total procurement capital, and order frequency.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => PurchasingService.exportData('products', 'xlsx', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium text-center"
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => PurchasingService.exportData('products', 'csv', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors font-medium text-center"
                      >
                        CSV
                      </button>
                    </div>
                  </div>

                  {/* Report Card 4 */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-white font-medium text-sm mb-1">
                        <CreditCard size={16} className="text-emerald-400" />
                        <span>Supplier Payments Ledger</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Record of all wire remittances, cheques, dates, transaction references, and approvals.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => PurchasingService.exportData('payments', 'xlsx', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium text-center"
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => PurchasingService.exportData('payments', 'csv', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors font-medium text-center"
                      >
                        CSV
                      </button>
                    </div>
                  </div>

                  {/* Report Card 5 */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-white font-medium text-sm mb-1">
                        <DollarSign size={16} className="text-yellow-400" />
                        <span>Executive Purchasing Summary</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        High-level KPI metrics sheet for management meetings, budgeting, and financial reporting.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => PurchasingService.exportData('summary', 'xlsx', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium text-center"
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => PurchasingService.exportData('summary', 'csv', filteredPOs, suppliers, payments, currencySymbol)}
                        className="flex-1 py-1.5 px-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors font-medium text-center"
                      >
                        CSV
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================= GLOBAL MODALS ================= */}

        {/* 1. Create PO Modal */}
        {isCreatePOOpen && (
          <CreatePOModal
            isOpen={isCreatePOOpen}
            onClose={() => setIsCreatePOOpen(false)}
            onSave={handleSavePO}
            suppliers={suppliers}
            existingSkus={existingSkusList}
            currencySymbol={currencySymbol}
            currentUser={currentUserName}
          />
        )}

        {/* 2. Receive PO Modal */}
        {receiveTargetPO && (
          <ReceivePOModal
            isOpen={Boolean(receiveTargetPO)}
            onClose={() => setReceiveTargetPO(null)}
            po={receiveTargetPO}
            onReceive={handleReceivePO}
            currentUser={currentUserName}
          />
        )}

        {/* 3. Record Payment Modal */}
        {paymentTargetPO && (
          <RecordPaymentModal
            isOpen={Boolean(paymentTargetPO)}
            onClose={() => setPaymentTargetPO(null)}
            po={paymentTargetPO}
            onRecordPayment={handleRecordPayment}
            currencySymbol={currencySymbol}
            currentUser={currentUserName}
          />
        )}

        {/* 4. Supplier Add/Edit Modal */}
        {supplierModalData.isOpen && (
          <SupplierModal
            isOpen={supplierModalData.isOpen}
            onClose={() => setSupplierModalData({ isOpen: false })}
            supplier={supplierModalData.supplier}
            onSave={handleSaveSupplier}
          />
        )}

        {/* 5. PO Detail & Print Invoice View Modal */}
        {selectedPODetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-zinc-800 text-white">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Purchase Order: {selectedPODetail.poNumber}
                    </h2>
                    <p className="text-xs text-zinc-400">Issued to {selectedPODetail.supplierName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-800"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => setSelectedPODetail(null)}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs scrollbar-thin">
                {/* Google Sheet & Order Meta Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Date</span>
                    <span className="font-semibold text-white">{selectedPODetail.rawDate || selectedPODetail.poDate}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Purchaser</span>
                    <span className="font-semibold text-white">{selectedPODetail.purchaser || selectedPODetail.createdBy || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Platform</span>
                    <span className="font-semibold text-white">{selectedPODetail.buyingForPlatform || 'All Platforms'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Vendor / Supplier</span>
                    <span className="font-semibold text-white">{selectedPODetail.buyingFromVendor || selectedPODetail.supplierName}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Payment Method</span>
                    <span className="font-semibold text-white">{selectedPODetail.paymentMethod || 'Payoneer'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Qty Purchased</span>
                    <span className="font-semibold text-white">{selectedPODetail.qtyPurchased ?? selectedPODetail.totalQuantity}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Line Item</span>
                    <span className="font-semibold text-white truncate block" title={String(selectedPODetail.lineItem || '')}>
                      {String(selectedPODetail.lineItem || '1')}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Reason</span>
                    <span className="font-semibold text-white truncate block" title={selectedPODetail.reason || ''}>
                      {selectedPODetail.reason || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Tracking Number</span>
                    <span className="font-mono font-semibold text-blue-400 truncate block">
                      {selectedPODetail.trackingNumber || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Delivered Date</span>
                    <span className="font-semibold text-white">{selectedPODetail.deliveredDate || selectedPODetail.expectedDeliveryDate || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Received Date</span>
                    <span className="font-semibold text-white">{selectedPODetail.receivedDate || (selectedPODetail.status === 'Received' ? selectedPODetail.poDate : '—')}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Payment Terms</span>
                    <span className="font-semibold text-white">{selectedPODetail.paymentTerms || 'Net 30'}</span>
                  </div>
                </div>

                {/* Status Badges Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${getPOStatusBadge(selectedPODetail.status)}`}>
                    Status: {selectedPODetail.status}
                  </span>
                  <span className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300">
                    Payment: {selectedPODetail.paymentStatus}
                  </span>
                  <span className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300">
                    Receiving: {selectedPODetail.receivingStatus}
                  </span>
                </div>

                {/* Line Items Table */}
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-3 py-2.5">SKU</th>
                        <th className="px-3 py-2.5">Product Title</th>
                        <th className="px-3 py-2.5 text-center">Qty Ordered</th>
                        <th className="px-3 py-2.5 text-center">Qty Received</th>
                        <th className="px-3 py-2.5 text-right">Unit Cost</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {selectedPODetail.items.map(item => (
                        <tr key={item.id} className="hover:bg-zinc-900/40">
                          <td className="px-3 py-2.5 font-mono text-zinc-300">{item.sku}</td>
                          <td className="px-3 py-2.5 font-medium text-white">{item.productName}</td>
                          <td className="px-3 py-2.5 text-center text-zinc-300">{item.quantity}</td>
                          <td className="px-3 py-2.5 text-center text-emerald-400 font-semibold">{item.quantityReceived || 0}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-300">{currencySymbol}{item.unitCost.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-white">{currencySymbol}{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Box */}
                <div className="flex justify-end">
                  <div className="w-64 bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Subtotal:</span>
                      <span className="text-white font-medium">{currencySymbol}{selectedPODetail.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Total Discount:</span>
                      <span className="text-emerald-400">-{currencySymbol}{selectedPODetail.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Total Tax:</span>
                      <span className="text-white">+{currencySymbol}{selectedPODetail.totalTax.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-zinc-800 pt-2 flex justify-between font-bold text-white text-sm">
                      <span>Grand Total:</span>
                      <span>{currencySymbol}{selectedPODetail.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 pt-1">
                      <span>Amount Paid:</span>
                      <span>{currencySymbol}{selectedPODetail.paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-400 font-semibold">
                      <span>Outstanding:</span>
                      <span>{currencySymbol}{selectedPODetail.outstandingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {selectedPODetail.notes && (
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                    <span className="text-zinc-400 block text-[11px] mb-1">Notes:</span>
                    <p className="text-zinc-300">{selectedPODetail.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  {selectedPODetail.status === 'Draft' && (
                    <button
                      onClick={() => {
                        handleStatusChange(selectedPODetail.id, 'Ordered');
                        setSelectedPODetail(null);
                      }}
                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
                    >
                      Issue / Order PO
                    </button>
                  )}
                  {selectedPODetail.status !== 'Cancelled' && selectedPODetail.status !== 'Closed' && (
                    <button
                      onClick={() => {
                        handleStatusChange(selectedPODetail.id, 'Cancelled');
                        setSelectedPODetail(null);
                      }}
                      className="px-3 py-1.5 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-lg font-medium border border-rose-500/30"
                    >
                      Cancel PO
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedPODetail.receivingStatus !== 'Received' && selectedPODetail.status !== 'Cancelled' && (
                    <button
                      onClick={() => {
                        const target = selectedPODetail;
                        setSelectedPODetail(null);
                        setReceiveTargetPO(target);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg shadow"
                    >
                      <PackageCheck size={14} />
                      <span>Receive Goods</span>
                    </button>
                  )}

                  {selectedPODetail.outstandingAmount > 0 && selectedPODetail.status !== 'Cancelled' && (
                    <button
                      onClick={() => {
                        const target = selectedPODetail;
                        setSelectedPODetail(null);
                        setPaymentTargetPO(target);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-purple-500 hover:bg-purple-400 text-zinc-950 rounded-lg shadow"
                    >
                      <CreditCard size={14} />
                      <span>Record Payment</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedPODetail(null)}
                    className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PurchasingErrorBoundary>
  );
};
