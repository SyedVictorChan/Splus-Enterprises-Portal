import React, { useState } from 'react';
import {
  Settings,
  DollarSign,
  Calendar,
  Building,
  Layers,
  Database,
  Trash2,
  RotateCcw,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  Moon,
  Sun,
  Store,
  Check,
  Globe,
  Shield,
  ShieldCheck,
  Lock,
  Users
} from 'lucide-react';
import { AppSettings, MappingTemplate, REGISTERED_STORES, NavTab } from '../../types';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdminEmail } from '../../services/firebase';
import { SalesGoogleSheetsIntegration } from '../settings/SalesGoogleSheetsIntegration';

interface SettingsPageProps {
  settings: AppSettings;
  templates: MappingTemplate[];
  onSettingsUpdated: () => void;
  onClearData: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigateToTab?: (tab: NavTab) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  templates,
  onSettingsUpdated,
  onClearData,
  darkMode,
  onToggleDarkMode,
  onNavigateToTab
}) => {
  const { user, isSuperAdmin, isAdmin, isManager } = useAuth();
  const isSuperAdminUser = isSuperAdmin || isSuperAdminEmail(user?.email) || (user?.role as any) === 'SUPER_ADMIN';

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [currency, setCurrency] = useState(settings.currency);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppSettings = {
      ...settings,
      companyName,
      currency,
      dateFormat
    };
    StorageService.saveSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
    onSettingsUpdated();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
              <Settings size={18} />
            </div>
            System & Operations Settings
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Configure currency units, date conventions, mapping templates, and local storage.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold border border-zinc-300 dark:border-zinc-600">
            <CheckCircle2 size={14} /> Saved!
          </div>
        )}
      </div>

      {/* Super Admin Google Sheets Integration */}
      {isSuperAdminUser && (
        <SalesGoogleSheetsIntegration />
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-6">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
          General Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Building size={14} className="text-zinc-400" />
              Company / Brand Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className="w-full text-xs px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {/* Default Currency */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <DollarSign size={14} className="text-zinc-400" />
              Default Display Currency
            </label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as any)}
              className="w-full text-xs font-mono px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="USD">USD ($ United States Dollar - Default)</option>
              <option value="EUR">EUR (€ Euro)</option>
              <option value="GBP">GBP (£ British Pound)</option>
              <option value="CAD">CAD (CA$ Canadian Dollar)</option>
              <option value="AUD">AUD (A$ Australian Dollar)</option>
              <option value="PKR">PKR (Pakistani Rupee)</option>
              <option value="AED">AED (United Arab Emirates Dirham)</option>
              <option value="SAR">SAR (Saudi Riyal)</option>
              <option value="INR">INR (₹ Indian Rupee)</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-zinc-400" />
              Date Format
            </label>
            <select
              value={dateFormat}
              onChange={e => setDateFormat(e.target.value as any)}
              className="w-full text-xs font-mono px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-05-18 - ISO Standard)</option>
              <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 18-05-2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 05/18/2026)</option>
            </select>
          </div>

          {/* Theme Preference */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              {darkMode ? <Moon size={14} className="text-zinc-400" /> : <Sun size={14} className="text-zinc-400" />}
              Appearance Mode
            </label>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="w-full text-xs px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-between font-semibold"
            >
              <span>{darkMode ? 'Dark Mode' : 'Light Mode (Default)'}</span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Click to switch</span>
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-xs font-bold shadow-xs transition-colors"
          >
            <Save size={14} /> Save Changes
          </button>
        </div>
      </form>

      {/* Connected Storefronts & Fulfillment Channels */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Store size={16} />
              Connected Storefronts & Fulfillment Channels ({REGISTERED_STORES.length})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Active sales channels, marketplace storefronts, and fulfillment nodes configured for automatic recognition and multi-channel aggregation.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 self-start sm:self-auto">
            <Check size={12} /> All Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {REGISTERED_STORES.map((store) => {
            return (
              <div
                key={store.name}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 flex flex-col justify-between gap-2.5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100"></span>
                      <span>{store.name}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {store.categoryHint}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                    {store.marketplace}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-400 font-medium">Fulfillment:</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono text-[10.5px]">
                    {store.fulfillment}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saved Column Mapping Templates */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet size={16} />
            Saved Column Mapping Templates ({templates.length})
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Saved schemas allow one-click automated column matching whenever you upload recurring daily sheets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(tmpl => (
            <div
              key={tmpl.id}
              className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-900 dark:text-white">{tmpl.name}</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(tmpl.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-0.5">
                <div>Mapped fields: {Object.keys(tmpl.mapping).length} columns</div>
                <div className="text-[10px] text-zinc-700 dark:text-zinc-300 font-medium">
                  Auto-matches: {tmpl.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Organization Security & Encryption Overview */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-black dark:text-white" />
              Organization Security & Encryption
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Zero-trust access control, TLS 1.3 / AES-256 cloud encryption, and multi-tier organizational roles.
            </p>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('team')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-white dark:bg-white dark:text-black font-semibold text-xs transition-colors self-start sm:self-auto"
            >
              <Users size={13} />
              Manage Team Roles
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Active Identity
            </div>
            <div className="font-bold text-xs text-zinc-900 dark:text-white mt-1 truncate">
              {user?.email || 'Authenticated User'}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Role: <span className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase">{user?.role}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Data Encryption
            </div>
            <div className="font-bold text-xs text-zinc-900 dark:text-white mt-1 flex items-center gap-1.5">
              <Lock size={13} className="text-emerald-500" /> AES-256 Cloud Rest
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              TLS 1.3 Transport Ingress
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Access Governance
            </div>
            <div className="font-bold text-xs text-zinc-900 dark:text-white mt-1">
              Admin & Manager RBAC
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Validated Security Rules
            </div>
          </div>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Database size={16} />
            Data Storage & Maintenance
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Client-side data persistence actions. Sales records and import batches are securely maintained in your workspace.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to completely wipe all sales data, batches, and records?')) {
                  onClearData();
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-zinc-400 dark:border-zinc-600 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black text-zinc-900 dark:text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Trash2 size={14} /> Wipe All Records & History (Admin Only)
            </button>
          ) : (
            <span className="text-xs text-zinc-400 italic">
              Data purge restricted to Organization Admin.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
