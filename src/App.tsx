import React, { useState, useEffect, useMemo } from 'react';
import {
  AppSettings,
  DateRangePreset,
  FilterState,
  ImportBatch,
  MappingTemplate,
  NavTab,
  SalesRecord
} from './types';
import { StorageService } from './services/storage';
import {
  calculateKPISummary,
  calculateDailyTrend,
  calculateMarketplaceStats,
  calculateStoreStats,
  calculateProductStats,
  generateFactualInsights,
  filterRecords
} from './services/analytics';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { ImportWizardModal } from './components/import/ImportWizardModal';
import { ImportHistoryView } from './components/import/ImportHistoryView';
import { DashboardPage } from './components/pages/DashboardPage';
import { DailySalesPage } from './components/pages/DailySalesPage';
import { SalesAnalyticsPage } from './components/pages/SalesAnalyticsPage';
import { MarketplacesPage } from './components/pages/MarketplacesPage';
import { StoresPage } from './components/pages/StoresPage';
import { ProductsPage } from './components/pages/ProductsPage';
import { PurchasingDashboard } from './components/purchasing/PurchasingDashboard';
import { RMADashboard } from './components/rma/RMADashboard';
import { ReportsPage } from './components/pages/ReportsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { TeamManagementPage } from './components/pages/TeamManagementPage';
import { AuthScreen } from './components/auth/AuthScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoogleSheetsLiveService } from './services/googleSheetsLiveService';
import { ALL_MODULES } from './services/permissionService';
import { CheckCircle2, X, Shield, Lock } from 'lucide-react';

function AppContent() {
  const { user, loading, canAccess } = useAuth();

  // 1. Core State
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 2. Modals & Navigation Sub-state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedStoreDrillDown, setSelectedStoreDrillDown] = useState<{
    storeName: string;
    marketplace: string;
  } | null>(null);

  // 3. Global Filter State
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last30days');
  const [customStartDate, setCustomStartDate] = useState<string | undefined>();
  const [customEndDate, setCustomEndDate] = useState<string | undefined>();
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');

  // Load Central Organization Data
  useEffect(() => {
    StorageService.initializeSampleDataIfEmpty();
    refreshAllData(true);

    // Subscribe to cloud updates across all organization members in real-time
    const unsubscribe = StorageService.initCentralSync(() => {
      refreshAllData(true);
    });

    // Subscribe to live Google Sheet sales streaming
    const unsubLiveSales = GoogleSheetsLiveService.subscribeToSales(liveSales => {
      if (liveSales && liveSales.length > 0) {
        setRecords(liveSales);
      }
    });

    // Check saved dark mode
    const isDark = localStorage.getItem('splus_dark_mode') === 'true';
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      unsubscribe();
      unsubLiveSales();
    };
  }, []);

  // Re-fetch central organization dataset whenever user changes/logs in
  useEffect(() => {
    if (user) {
      refreshAllData(true);
      // Ensure user always lands on an authorized module upon login or user change
      if (!canAccess(activeTab as any)) {
        const allowedModule = ALL_MODULES.find(m => canAccess(m.id));
        if (allowedModule) {
          setActiveTab(allowedModule.id as NavTab);
        }
      }
    }
  }, [user]);

  // Keep active tab synced if role or permissions change
  useEffect(() => {
    if (user && !canAccess(activeTab as any)) {
      const allowedModule = ALL_MODULES.find(m => canAccess(m.id));
      if (allowedModule) {
        setActiveTab(allowedModule.id as NavTab);
      }
    }
  }, [user, activeTab, canAccess]);

  const refreshAllData = async (syncCloud: boolean = true) => {
    setIsRefreshing(true);
    const loadedRecords = StorageService.getStoredRecords();
    const loadedBatches = StorageService.getBatches();
    const loadedTemplates = StorageService.getMappingTemplates();
    const loadedSettings = StorageService.getSettings();

    if (loadedRecords.length > 0 || loadedBatches.length > 0) {
      setRecords(loadedRecords);
      setBatches(loadedBatches);
      setTemplates(loadedTemplates);
      setSettings(loadedSettings);
      setIsInitialSyncDone(true);
    }

    if (syncCloud) {
      try {
        const cloudData = await StorageService.syncFromCloud();
        setRecords(cloudData.records);
        setBatches(cloudData.batches);
        setSettings(cloudData.settings);
      } catch (err) {
        console.warn('Central sync note:', err);
      }
    }

    setIsInitialSyncDone(true);
    setIsRefreshing(false);
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('splus_dark_mode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 4. Analytics Derivation
  const currentFilters: FilterState = useMemo(() => ({
    datePreset,
    customStartDate,
    customEndDate,
    marketplace: selectedMarketplace,
    store: selectedStore,
    product: 'all'
  }), [datePreset, customStartDate, customEndDate, selectedMarketplace, selectedStore]);

  const { currentRecords, previousRecords } = useMemo(() => {
    return filterRecords(records, currentFilters);
  }, [records, currentFilters]);

  const kpiSummary = useMemo(() => {
    return calculateKPISummary(currentRecords, previousRecords);
  }, [currentRecords, previousRecords]);

  const dailyTrend = useMemo(() => {
    return calculateDailyTrend(currentRecords);
  }, [currentRecords]);

  const marketplaceStats = useMemo(() => {
    return calculateMarketplaceStats(currentRecords, previousRecords);
  }, [currentRecords, previousRecords]);

  const storeStats = useMemo(() => {
    return calculateStoreStats(currentRecords, previousRecords);
  }, [currentRecords, previousRecords]);

  const productStats = useMemo(() => {
    return calculateProductStats(currentRecords, previousRecords);
  }, [currentRecords, previousRecords]);

  const insights = useMemo(() => {
    return generateFactualInsights(
      kpiSummary,
      marketplaceStats,
      storeStats,
      productStats
    );
  }, [kpiSummary, marketplaceStats, storeStats, productStats]);

  // Current Month Key for targets
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const currentTarget = settings.targets[currentMonthKey];

  // Actions
  const handleImportCompleted = (newRecords: SalesRecord[], batch: ImportBatch) => {
    refreshAllData(true);
    setIsImportOpen(false);
    showToast(`Successfully ingested ${newRecords.length.toLocaleString()} sales records to central Splus database!`);
  };

  const handleSelectStore = (storeName: string, marketplace: string) => {
    setSelectedStoreDrillDown({ storeName, marketplace });
    setActiveTab('stores');
  };

  const handleClearData = async () => {
    await StorageService.clearAllData();
    await refreshAllData(true);
    showToast('All organization sales records and batches wiped.');
  };

  if (!user && !loading) {
    return <AuthScreen darkMode={darkMode} />;
  }

  if (loading || (!isInitialSyncDone && records.length === 0)) {
    return (
      <div className="min-h-screen w-full bg-[#F8F6F0] dark:bg-[#151D22] text-[#263238] dark:text-[#E2E8F0] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#DCEAF0] dark:bg-[#25323A] text-[#2C5268] dark:text-[#DCEAF0] border border-[#BACFD9] dark:border-[#384852] font-black text-xl flex items-center justify-center mb-4 shadow-sm animate-pulse">
          S+
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#556770] dark:text-[#9EABB3]">
          <Shield size={15} className="text-[#6E93A9] animate-spin" />
          <span>Synchronizing Central Splus Enterprise Database...</span>
        </div>
        <p className="text-[11px] text-[#65747C] dark:text-[#8FAFC2] mt-2 font-mono">
          Connecting to shared organization data repository
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen darkMode={darkMode} />;
  }

  return (
    <div className="flex h-screen bg-[#F8F6F0] dark:bg-[#151D22] text-[#263238] dark:text-[#E2E8F0] font-sans antialiased overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={tab => {
          setActiveTab(tab);
          if (tab !== 'stores') {
            setSelectedStoreDrillDown(null);
          }
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        totalRecordsCount={records.length}
        onOpenImportModal={() => setIsImportOpen(true)}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Navbar */}
        <Navbar
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomDateChange={(start, end) => {
            setCustomStartDate(start);
            setCustomEndDate(end);
          }}
          onRefresh={refreshAllData}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          isRefreshing={isRefreshing}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onSelectTab={setActiveTab}
        />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {!canAccess(activeTab as any) ? (
            <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl text-center space-y-4 animate-in fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lock size={26} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Department Access Restricted</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Your current role (<span className="font-semibold text-zinc-700 dark:text-zinc-300">{user?.role?.toUpperCase() || 'TEAM_MEMBER'}</span>) and department (<span className="font-semibold text-zinc-700 dark:text-zinc-300">{user?.department || 'General'}</span>) do not have authorization to access the <span className="font-bold text-zinc-900 dark:text-zinc-100">{activeTab.toUpperCase()}</span> module.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300">
                Please contact the organization administrator (<span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">farazrizvi2002@gmail.com</span>) to adjust your module permissions.
              </div>
              <button
                onClick={() => {
                  const firstAllowed = ALL_MODULES.find(m => canAccess(m.id));
                  if (firstAllowed) {
                    setActiveTab(firstAllowed.id as NavTab);
                  } else {
                    setActiveTab('dashboard');
                  }
                }}
                className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-xs"
              >
                Go to My Authorized Module
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardPage
                  records={records}
                  currentFilteredRecords={currentRecords}
                  kpi={kpiSummary}
                  dailyTrend={dailyTrend}
                  marketplaceStats={marketplaceStats}
                  storeStats={storeStats}
                  productStats={productStats}
                  insights={insights}
                  currency={settings.currency}
                  monthKey={currentMonthKey}
                  targetConfig={currentTarget}
                  onTargetUpdated={refreshAllData}
                  onOpenImport={() => setIsImportOpen(true)}
                  onSelectStore={handleSelectStore}
                  onNavigateToDailySales={() => setActiveTab('daily-sales')}
                  onNavigateTab={(tab) => setActiveTab(tab as any)}
                />
              )}

              {activeTab === 'daily-sales' && (
                <DailySalesPage
                  records={currentRecords}
                  currency={settings.currency}
                />
              )}

              {activeTab === 'analytics' && (
                <SalesAnalyticsPage
                  records={currentRecords}
                  dailyTrend={dailyTrend}
                  kpi={kpiSummary}
                  marketplaceStats={marketplaceStats}
                  currency={settings.currency}
                />
              )}

              {activeTab === 'marketplaces' && (
                <MarketplacesPage
                  marketplaceStats={marketplaceStats}
                  storeStats={storeStats}
                  currency={settings.currency}
                  onSelectStore={handleSelectStore}
                />
              )}

              {activeTab === 'stores' && (
                <StoresPage
                  stores={storeStats}
                  records={currentRecords}
                  currency={settings.currency}
                  selectedStoreDetail={selectedStoreDrillDown}
                  onClearStoreDetail={() => setSelectedStoreDrillDown(null)}
                />
              )}

              {activeTab === 'products' && (
                <ProductsPage
                  products={productStats}
                  currency={settings.currency}
                />
              )}

              {activeTab === 'purchasing' && (
                <PurchasingDashboard
                  records={records}
                  currency={settings.currency}
                  currencySymbol="$"
                />
              )}

              {activeTab === 'rma' && (
                <RMADashboard
                  salesRecords={records}
                  currentUser={user?.displayName || user?.email || 'Authorized Agent'}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsPage
                  records={currentRecords}
                  dailyTrend={dailyTrend}
                  marketplaceStats={marketplaceStats}
                  storeStats={storeStats}
                  productStats={productStats}
                  kpi={kpiSummary}
                  currency={settings.currency}
                />
              )}

              {activeTab === 'import' && (
                <ImportHistoryView
                  batches={batches}
                  records={records}
                  onOpenImport={() => setIsImportOpen(true)}
                  onBatchesUpdated={refreshAllData}
                />
              )}

              {activeTab === 'team' && (
                <TeamManagementPage
                  batches={batches}
                  onRefreshBatches={() => refreshAllData(true)}
                  onOpenImport={() => setIsImportOpen(true)}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsPage
                  settings={settings}
                  templates={templates}
                  onSettingsUpdated={refreshAllData}
                  onClearData={handleClearData}
                  darkMode={darkMode}
                  onToggleDarkMode={toggleDarkMode}
                  onNavigateToTab={setActiveTab}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* 3. Global Modals */}
      {isImportOpen && (
        <ImportWizardModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportComplete={handleImportCompleted}
        />
      )}

      {isSearchOpen && (
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          records={records}
          currency={settings.currency}
          onSelectRecord={(rec) => {
            setIsSearchOpen(false);
            setActiveTab('daily-sales');
          }}
          onSelectStore={(st, mp) => {
            setIsSearchOpen(false);
            handleSelectStore(st, mp);
          }}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-black text-white px-4 py-3 rounded-lg shadow-2xl border border-zinc-800 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 size={18} className="text-white shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
