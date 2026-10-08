import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  RotateCw,
  Upload,
  Sun,
  Moon,
  ChevronDown,
  User,
  ShieldCheck,
  LogOut,
  Sparkles,
  Download
} from 'lucide-react';
import { DateRangePreset, NavTab } from '../../types';
import { downloadDailyReportTemplate, getYesterdayDateString } from '../../services/dailySheetService';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  datePreset: DateRangePreset;
  onDatePresetChange: (preset: DateRangePreset) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDateChange?: (start: string, end: string) => void;
  onRefresh: () => void;
  onOpenImport: () => void;
  onOpenSearch: () => void;
  isRefreshing: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectTab?: (tab: NavTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  datePreset,
  onDatePresetChange,
  customStartDate,
  customEndDate,
  onCustomDateChange,
  onRefresh,
  onOpenImport,
  onOpenSearch,
  isRefreshing,
  darkMode,
  onToggleDarkMode,
  onSelectTab
}) => {
  const { user, isAdmin, isManager, signOut } = useAuth();
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [tempStart, setTempStart] = useState(customStartDate || new Date().toISOString().split('T')[0]);
  const [tempEnd, setTempEnd] = useState(customEndDate || new Date().toISOString().split('T')[0]);

  const dateMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
        setCustomRangeOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presetLabels: Record<DateRangePreset, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    last7days: 'Last 7 Days',
    last30days: 'Last 30 Days',
    thisMonth: 'This Month',
    previousMonth: 'Previous Month',
    allTime: 'All Time Records',
    custom: 'Custom Range'
  };

  const handleSelectPreset = (p: DateRangePreset) => {
    if (p === 'custom') {
      setCustomRangeOpen(true);
    } else {
      onDatePresetChange(p);
      setDateDropdownOpen(false);
      setCustomRangeOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (onCustomDateChange) {
      onCustomDateChange(tempStart, tempEnd);
    }
    onDatePresetChange('custom');
    setDateDropdownOpen(false);
    setCustomRangeOpen(false);
  };

  return (
    <header
      id="main-top-navbar"
      className="h-16 px-4 md:px-6 bg-[#FFFDF8] dark:bg-[#1A2228] border-b border-[#D9E0E2] dark:border-[#2C373E] flex items-center justify-between gap-3 sticky top-0 z-10 transition-colors shadow-2xs"
    >
      {/* Left side: Global Date Filter */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={dateMenuRef}>
          <button
            id="btn-date-filter-toggle"
            onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D9E0E2] dark:border-[#2C373E] bg-[#F8F6F0] dark:bg-[#222C33] hover:bg-[#F0ECE1] dark:hover:bg-[#28353D] text-[#263238] dark:text-[#E2E8F0] text-sm font-medium transition-all shadow-2xs"
          >
            <CalendarIcon size={16} className="text-[#6E93A9] dark:text-[#8FAFC2]" />
            <span className="font-semibold text-xs tracking-wider uppercase text-[#65747C] dark:text-[#94A3B8]">
              Period:
            </span>
            <span className="font-semibold">{presetLabels[datePreset]}</span>
            <ChevronDown size={14} className="text-[#65747C] ml-1" />
          </button>

          {/* Date Presets Dropdown */}
          {dateDropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl bg-[#FFFDF8] dark:bg-[#1F272C] border border-[#D9E0E2] dark:border-[#2C373E] shadow-xl py-2 z-30 text-sm animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-xs font-bold text-[#65747C] dark:text-[#94A3B8] uppercase tracking-wider">
                Select Reporting Period
              </div>
              {(['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'previousMonth', 'allTime'] as DateRangePreset[]).map(p => (
                <button
                  key={p}
                  onClick={() => handleSelectPreset(p)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                    datePreset === p
                      ? 'bg-[#DCEAF0] dark:bg-[#2B3B44] text-[#1E3A4B] dark:text-[#E6F0F5] font-bold'
                      : 'text-[#263238] dark:text-[#E2E8F0] hover:bg-[#F4F1EA] dark:hover:bg-[#28353D]'
                  }`}
                >
                  <span>{presetLabels[p]}</span>
                  {datePreset === p && <span className="w-2 h-2 rounded-full bg-[#6E93A9]"></span>}
                </button>
              ))}

              <div className="border-t border-[#D9E0E2] dark:border-[#2C373E] my-1 pt-1">
                <button
                  onClick={() => handleSelectPreset('custom')}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                    datePreset === 'custom'
                      ? 'bg-[#DCEAF0] dark:bg-[#2B3B44] text-[#1E3A4B] dark:text-[#E6F0F5] font-bold'
                      : 'text-[#263238] dark:text-[#E2E8F0] hover:bg-[#F4F1EA] dark:hover:bg-[#28353D]'
                  }`}
                >
                  <span>Custom Date Range...</span>
                </button>
              </div>

              {customRangeOpen && (
                <div className="p-3 bg-[#F8F6F0] dark:bg-[#222C33] border-t border-[#D9E0E2] dark:border-[#2C373E] space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#65747C] dark:text-[#94A3B8] mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={tempStart}
                      onChange={e => setTempStart(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded border border-[#D9E0E2] dark:border-[#384852] bg-[#FFFDF8] dark:bg-[#1A2228] text-[#263238] dark:text-[#E2E8F0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#65747C] dark:text-[#94A3B8] mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={tempEnd}
                      onChange={e => setTempEnd(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded border border-[#D9E0E2] dark:border-[#384852] bg-[#FFFDF8] dark:bg-[#1A2228] text-[#263238] dark:text-[#E2E8F0]"
                    />
                  </div>
                  <button
                    onClick={handleApplyCustom}
                    className="w-full mt-2 py-1.5 bg-[#7A9FB4] hover:bg-[#688FA5] text-white rounded text-xs font-semibold transition-colors"
                  >
                    Apply Range
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Search Bar Button */}
        <button
          id="btn-global-search-trigger"
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 w-48 md:w-64 rounded-lg bg-[#F8F6F0] dark:bg-[#222C33] border border-[#D9E0E2] dark:border-[#2C373E] text-[#65747C] hover:text-[#263238] dark:hover:text-[#E2E8F0] text-xs transition-colors"
          title="Search SKU, Product, Order ID, Store..."
        >
          <Search size={14} className="text-[#8FAFC2]" />
          <span className="truncate">Search SKU, Order, Product...</span>
          <kbd className="ml-auto text-[10px] bg-[#FFFDF8] dark:bg-[#1A2228] border border-[#D9E0E2] dark:border-[#384852] px-1.5 py-0.5 rounded text-[#65747C] dark:text-[#94A3B8] font-mono">
            /
          </kbd>
        </button>
      </div>

      {/* Right side: Action Buttons & User Menu */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Refresh Data button */}
        <button
          id="btn-refresh-data"
          onClick={onRefresh}
          className="p-2 rounded-lg border border-[#D9E0E2] dark:border-[#2C373E] text-[#65747C] dark:text-[#94A3B8] hover:bg-[#F2EFE9] dark:hover:bg-[#222C33] transition-colors"
          title="Refresh Data & Calculations"
        >
          <RotateCw size={16} className={isRefreshing ? 'animate-spin text-[#6E93A9]' : ''} />
        </button>

        {/* Download Daily Template button (Pre-set for yesterday) */}
        <button
          id="btn-navbar-download-template"
          onClick={() => downloadDailyReportTemplate(undefined, 'xlsx')}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#D9E0E2] dark:border-[#2C373E] bg-[#FFFDF8] dark:bg-[#222C33] text-[#263238] dark:text-[#E2E8F0] hover:bg-[#F2EFE9] dark:hover:bg-[#28353D] text-xs font-semibold shadow-2xs transition-colors"
          title={`Download Daily Sales Breakdown Template for yesterday (${getYesterdayDateString()})`}
        >
          <Download size={13} className="text-[#6E93A9]" />
          <span>Daily Template ({getYesterdayDateString()})</span>
        </button>

        {/* Quick Import Button */}
        <button
          id="btn-navbar-import"
          onClick={onOpenImport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A9FB4] hover:bg-[#688FA5] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Upload size={14} />
          <span className="hidden sm:inline">Import Daily Sheet</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          id="btn-toggle-dark-mode"
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg border border-[#D9E0E2] dark:border-[#2C373E] text-[#65747C] dark:text-[#94A3B8] hover:bg-[#F2EFE9] dark:hover:bg-[#222C33] transition-colors"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun size={16} className="text-[#8FAFC2]" /> : <Moon size={16} className="text-[#65747C]" />}
        </button>

        {/* User / Profile Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            id="btn-user-profile-menu"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-[#F2EFE9] dark:hover:bg-[#222C33] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#DCEAF0] dark:bg-[#25323A] text-[#2C5268] dark:text-[#DCEAF0] border border-[#BACFD9] dark:border-[#384852] flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
              {user?.displayName ? user.displayName.slice(0, 2) : (user?.email ? user.email.slice(0, 2) : 'US')}
            </div>
            <ChevronDown size={14} className="text-[#65747C] hidden sm:block" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#FFFDF8] dark:bg-[#1F272C] border border-[#D9E0E2] dark:border-[#2C373E] shadow-xl py-2 z-30 text-sm animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-[#D9E0E2] dark:border-[#2C373E]">
                <div className="font-bold text-[#263238] dark:text-[#E2E8F0] text-xs">
                  {user?.displayName || 'Authorized User'}
                </div>
                <div className="text-[11px] text-[#65747C] dark:text-[#94A3B8] truncate">
                  {user?.email}
                </div>
                <div className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-[#2C5268] dark:text-[#DCEAF0] font-bold bg-[#DCEAF0] dark:bg-[#2A3942] px-2 py-0.5 rounded-md border border-[#BACFD9] dark:border-[#384852]">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  <span>
                    {isAdmin ? 'Admin (Owner)' : isManager ? 'Operations Manager' : 'Team Member'}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <div className="px-4 py-1.5 text-[10px] text-[#8FAFC2] uppercase font-bold tracking-wider">
                  Organization Security
                </div>
                <div className="px-4 py-1 text-xs text-[#263238] dark:text-[#E2E8F0] font-medium">
                  Splus Enterprises (Central DB)
                </div>
                {onSelectTab && (
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onSelectTab('team');
                    }}
                    className="w-full text-left px-4 py-1.5 text-xs text-[#263238] dark:text-[#E2E8F0] hover:bg-[#F2EFE9] dark:hover:bg-[#28353D] font-semibold flex items-center gap-2"
                  >
                    <ShieldCheck size={14} className="text-[#6E93A9]" /> Team & Security Access
                  </button>
                )}
              </div>

              <div className="border-t border-[#D9E0E2] dark:border-[#2C373E] pt-1">
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    signOut();
                  }}
                  className="w-full text-left px-4 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium flex items-center gap-2"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
