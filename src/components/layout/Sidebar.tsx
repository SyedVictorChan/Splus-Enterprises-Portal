import React from 'react';
import { NavTab, AppModule } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  UploadCloud,
  Users,
  RotateCcw,
  Lock
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  totalRecordsCount: number;
  onOpenImportModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  totalRecordsCount,
  onOpenImportModal
}) => {
  const { canAccess } = useAuth();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'daily-sales' as NavTab, label: 'Daily Sales', icon: Calendar },
    { id: 'analytics' as NavTab, label: 'Sales Analytics', icon: TrendingUp },
    { id: 'marketplaces' as NavTab, label: 'Marketplaces', icon: Globe },
    { id: 'stores' as NavTab, label: 'Stores', icon: Store },
    { id: 'products' as NavTab, label: 'Product Catalog', icon: Package },
    { id: 'purchasing' as NavTab, label: 'Purchasing', icon: ShoppingCart },
    { id: 'rma' as NavTab, label: 'RMA Dashboard', icon: RotateCcw },
    { id: 'reports' as NavTab, label: 'Reports', icon: FileSpreadsheet },
    { id: 'import' as NavTab, label: 'Data Import', icon: Database },
    { id: 'team' as NavTab, label: 'Team & Security', icon: ShieldCheck },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings }
  ];

  return (
    <aside
      id="main-sidebar"
      className={`relative flex flex-col bg-[#FFFDF8] dark:bg-[#1A2228] text-[#263238] dark:text-[#E2E8F0] border-r border-[#D9E0E2] dark:border-[#2C373E] transition-all duration-300 ease-in-out z-20 select-none shadow-xs ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#D9E0E2] dark:border-[#2C373E]">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => onSelectTab('dashboard')}>
          <div className="w-10 h-10 rounded-lg bg-[#DCEAF0] dark:bg-[#25323A] text-[#2C5268] dark:text-[#DCEAF0] border border-[#BACFD9] dark:border-[#384852] flex items-center justify-center font-black text-lg shrink-0 tracking-tighter shadow-2xs">
            S+
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="splus-portal-animated-text font-extrabold text-base tracking-wider">
                SPLUS Portal
              </span>
              <span className="text-[11px] font-medium text-[#65747C] dark:text-[#94A3B8] tracking-wide truncate">
                Enterprises
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          id="btn-collapse-sidebar"
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-[#65747C] hover:text-[#263238] dark:hover:text-white hover:bg-[#F2EFE9] dark:hover:bg-[#25323A] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Quick Action: Import Sheet */}
      <div className="p-3">
        <button
          id="btn-quick-import"
          onClick={onOpenImportModal}
          className={`w-full flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-lg font-semibold text-sm transition-all duration-200 shadow-xs ${
            collapsed
              ? 'bg-[#7A9FB4] hover:bg-[#688FA5] text-white justify-center'
              : 'bg-[#7A9FB4] hover:bg-[#688FA5] text-white'
          }`}
          title="Import Sheet Data"
        >
          <UploadCloud size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Import Sheet</span>}
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isPermitted = canAccess(item.id as AppModule);

          return (
            <button
              key={item.id}
              id={`nav-link-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#DCEAF0] dark:bg-[#2A3942] text-[#1E3A4B] dark:text-[#E6F0F5] font-bold border-l-2 border-[#6E93A9]'
                  : isPermitted
                  ? 'text-[#556770] dark:text-[#9EABB3] hover:bg-[#F4F1EA] dark:hover:bg-[#222D34] hover:text-[#263238] dark:hover:text-white'
                  : 'text-[#8FAFC2]/50 hover:bg-transparent opacity-60'
              }`}
              title={isPermitted ? item.label : `${item.label} (Access Restricted)`}
            >
              <Icon size={19} className={`shrink-0 ${isActive ? 'text-[#4F7B94] dark:text-[#8FAFC2]' : isPermitted ? 'text-[#7C8E96] dark:text-[#8FAFC2]' : 'text-[#A0B0B8]'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && !isPermitted && (
                <Lock size={12} className="ml-auto text-[#65747C] shrink-0" />
              )}
              {!collapsed && isPermitted && item.id === 'import' && (
                <span className="ml-auto text-[10px] font-semibold bg-[#EAF1F5] dark:bg-[#25323A] text-[#3D647A] dark:text-[#B4CAD6] px-2 py-0.5 rounded border border-[#D0DFE7] dark:border-[#384852]">
                  XLSX
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer info & Record count */}
      <div className="p-3 border-t border-[#D9E0E2] dark:border-[#2C373E] text-xs">
        {!collapsed ? (
          <div className="bg-[#F8F6F0] dark:bg-[#1E272D] rounded-lg p-2.5 border border-[#D9E0E2] dark:border-[#2C373E]">
            <div className="flex items-center justify-between text-[#65747C] dark:text-[#94A3B8] mb-1">
              <span>Organization</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#263238] dark:text-[#E2E8F0] font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Splus Central
              </span>
            </div>
            <div className="flex items-center justify-between text-[#556770] dark:text-[#CBD5E1] font-medium">
              <span>Central Records</span>
              <span className="font-mono text-[#263238] dark:text-white font-bold">{totalRecordsCount.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`Splus Enterprises: ${totalRecordsCount.toLocaleString()} central records`}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          </div>
        )}
      </div>
    </aside>
  );
};
