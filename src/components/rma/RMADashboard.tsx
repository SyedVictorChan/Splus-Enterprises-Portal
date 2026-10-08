import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Plus,
  BarChart3,
  List,
  FileText,
  RefreshCw,
  SlidersHorizontal,
  Download,
  AlertCircle
} from 'lucide-react';
import { RMAItem, RMAFilterState, RMAKPIs as RMAKPIType } from '../../types/rma';
import { SalesRecord } from '../../types';
import { RMAService } from '../../services/rmaService';
import { RMAKPIs } from './RMAKPIs';
import { RMAFilterBar } from './RMAFilterBar';
import { RMATable } from './RMATable';
import { RMADetailView } from './RMADetailView';
import { RMAAnalytics } from './RMAAnalytics';
import { RMAReports } from './RMAReports';
import { CreateRMAModal } from './CreateRMAModal';
import { InspectionModal } from './InspectionModal';
import { ProcessResolutionModal } from './ProcessResolutionModal';
import { UpdateStatusModal } from './UpdateStatusModal';
import { RMAErrorBoundary } from './RMAErrorBoundary';
import { LiveConnectionBanner } from '../googleSheets/LiveConnectionBanner';
import { GoogleSheetsLiveService } from '../../services/googleSheetsLiveService';

interface RMADashboardProps {
  salesRecords?: SalesRecord[];
  currentUser?: string;
}

type ActiveTab = 'cases' | 'analytics' | 'reports';

export const RMADashboard: React.FC<RMADashboardProps> = ({
  salesRecords = [],
  currentUser = 'Authorized Agent'
}) => {
  const [rmas, setRmas] = useState<RMAItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('cases');

  // Selected RMA for Detail View
  const [selectedRMA, setSelectedRMA] = useState<RMAItem | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isInspectionOpen, setIsInspectionOpen] = useState<boolean>(false);
  const [isResolutionOpen, setIsResolutionOpen] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [activeTargetRMA, setActiveTargetRMA] = useState<RMAItem | null>(null);

  // Filter State
  const [filters, setFilters] = useState<RMAFilterState>({
    status: 'all',
    marketplace: 'all',
    store: 'all',
    reason: 'all',
    returnType: 'all',
    inspectionStatus: 'all',
    searchQuery: '',
    datePreset: 'all'
  });

  // Subscribe to real-time RMA collection & Live Google Sheets updates
  useEffect(() => {
    setLoading(true);
    const unsubscribeFirestore = RMAService.subscribeRMAs((items) => {
      setRmas(items);
      setLoading(false);

      // Keep active target or selected item in sync if updated
      setSelectedRMA(prev => (prev ? items.find(i => i.id === prev.id) || prev : null));
      setActiveTargetRMA(prev => (prev ? items.find(i => i.id === prev.id) || prev : null));
    });

    const unsubscribeLiveSheets = GoogleSheetsLiveService.subscribeToRMAs((liveItems) => {
      if (liveItems.length > 0) {
        setRmas(liveItems);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeFirestore();
      unsubscribeLiveSheets();
    };
  }, []);

  // Filter available marketplaces and stores dynamically
  const availableMarketplaces = useMemo(() => {
    const set = new Set<string>();
    rmas.forEach(r => {
      if (r.marketplace) set.add(r.marketplace);
    });
    salesRecords.forEach(s => {
      if (s.marketplace) set.add(s.marketplace);
    });
    return Array.from(set);
  }, [rmas, salesRecords]);

  const availableStores = useMemo(() => {
    const set = new Set<string>();
    rmas.forEach(r => {
      if (r.store) set.add(r.store);
    });
    salesRecords.forEach(s => {
      if (s.store) set.add(s.store);
    });
    return Array.from(set);
  }, [rmas, salesRecords]);

  // Apply filters to RMAs
  const filteredRMAs = useMemo(() => {
    return RMAService.filterRMAs(rmas, filters);
  }, [rmas, filters]);

  // Calculate KPIs
  const kpis: RMAKPIType = useMemo(() => {
    return RMAService.calculateKPIs(filteredRMAs, salesRecords);
  }, [filteredRMAs, salesRecords]);

  const handleResetFilters = () => {
    setFilters({
      status: 'all',
      marketplace: 'all',
      store: 'all',
      reason: 'all',
      returnType: 'all',
      inspectionStatus: 'all',
      searchQuery: '',
      datePreset: 'all'
    });
  };

  // Quick Action Handlers
  const handleViewRMA = (rma: RMAItem) => {
    setSelectedRMA(rma);
  };

  const handleOpenStatusModal = (rma: RMAItem) => {
    setActiveTargetRMA(rma);
    setIsStatusModalOpen(true);
  };

  const handleOpenInspect = (rma: RMAItem) => {
    setActiveTargetRMA(rma);
    setIsInspectionOpen(true);
  };

  const handleOpenResolution = (rma: RMAItem) => {
    setActiveTargetRMA(rma);
    setIsResolutionOpen(true);
  };

  const handleOpenAddNote = (rma: RMAItem) => {
    setSelectedRMA(rma);
  };

  return (
    <RMAErrorBoundary>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* If an RMA Detail view is open, render it standalone */}
        {selectedRMA ? (
          <RMADetailView
            rma={selectedRMA}
            onBack={() => setSelectedRMA(null)}
            onUpdateStatus={(rma) => handleOpenStatusModal(rma)}
            onInspect={(rma) => handleOpenInspect(rma)}
            onProcessResolution={(rma) => handleOpenResolution(rma)}
            currentUser={currentUser}
          />
        ) : (
          <>
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-white tracking-tight">RMA Dashboard</h1>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Returns Management
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Process, inspect, track, and resolve return merchandise authorizations across all sales channels.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  <Plus size={15} />
                  <span>Create RMA</span>
                </button>
              </div>
            </div>

            {/* Live Google Sheets Connection Status Bar */}
            <LiveConnectionBanner
              target="rma"
              title="RMA Dashboard"
              onDataRefreshed={() => setRmas(RMAService.getAllRMAs())}
            />

            {/* KPI Cards Strip */}
            <RMAKPIs kpis={kpis} />

            {/* Sub-Tab Navigation */}
            <div className="flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('cases')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'cases'
                      ? 'border-sky-500 text-sky-400 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <List size={15} />
                  <span>RMA Cases & Table</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
                    {filteredRMAs.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'analytics'
                      ? 'border-sky-500 text-sky-400 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <BarChart3 size={15} />
                  <span>Analytics & Product Trends</span>
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === 'reports'
                      ? 'border-sky-500 text-sky-400 font-semibold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileText size={15} />
                  <span>RMA Reports</span>
                </button>
              </div>
            </div>

            {/* Tab 1: RMA Cases Table & Filters */}
            {activeTab === 'cases' && (
              <div className="space-y-4">
                <RMAFilterBar
                  filters={filters}
                  onFilterChange={setFilters}
                  onResetFilters={handleResetFilters}
                  availableMarketplaces={availableMarketplaces}
                  availableStores={availableStores}
                />

                <RMATable
                  rmas={filteredRMAs}
                  onViewRMA={handleViewRMA}
                  onUpdateStatus={handleOpenStatusModal}
                  onInspect={handleOpenInspect}
                  onProcessResolution={handleOpenResolution}
                  onAddNote={handleOpenAddNote}
                />
              </div>
            )}

            {/* Tab 2: Analytics & Product Trends */}
            {activeTab === 'analytics' && (
              <RMAAnalytics rmas={filteredRMAs} salesRecords={salesRecords} />
            )}

            {/* Tab 3: Reports */}
            {activeTab === 'reports' && (
              <RMAReports rmas={filteredRMAs} salesRecords={salesRecords} />
            )}
          </>
        )}

        {/* Create RMA Modal */}
        <CreateRMAModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={(newRma) => {
            setSelectedRMA(newRma);
          }}
          salesRecords={salesRecords}
          currentUser={currentUser}
        />

        {/* Inspection Modal */}
        {activeTargetRMA && (
          <InspectionModal
            isOpen={isInspectionOpen}
            onClose={() => {
              setIsInspectionOpen(false);
              setActiveTargetRMA(null);
            }}
            rma={activeTargetRMA}
            onInspectionSaved={(updated) => {
              setSelectedRMA(prev => (prev?.id === updated.id ? updated : prev));
            }}
            currentUser={currentUser}
          />
        )}

        {/* Process Resolution Modal */}
        {activeTargetRMA && (
          <ProcessResolutionModal
            isOpen={isResolutionOpen}
            onClose={() => {
              setIsResolutionOpen(false);
              setActiveTargetRMA(null);
            }}
            rma={activeTargetRMA}
            onResolutionSaved={(updated) => {
              setSelectedRMA(prev => (prev?.id === updated.id ? updated : prev));
            }}
            currentUser={currentUser}
          />
        )}

        {/* Quick Status Update Modal */}
        {activeTargetRMA && (
          <UpdateStatusModal
            isOpen={isStatusModalOpen}
            onClose={() => {
              setIsStatusModalOpen(false);
              setActiveTargetRMA(null);
            }}
            rma={activeTargetRMA}
            onStatusUpdated={(updated) => {
              setSelectedRMA(prev => (prev?.id === updated.id ? updated : prev));
            }}
            currentUser={currentUser}
          />
        )}
      </div>
    </RMAErrorBoundary>
  );
};
