import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  User,
  Users,
  UserPlus,
  UserX,
  UserMinus,
  Lock,
  Unlock,
  Mail,
  Key,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Trash2,
  Clock,
  Check,
  Copy,
  Eye,
  EyeOff,
  Edit3,
  History,
  FileSpreadsheet,
  Database,
  Search,
  Filter,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  UploadCloud,
  Download,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Building2,
  Sliders,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getTeamMembers,
  updateMemberRole,
  getAuthorizedMembers,
  getLocalAuthorizedMembers,
  addAuthorizedMember,
  inviteUser,
  setUserStatus,
  updateUserRoleAndDepartment,
  updateUserPermissions,
  resendInvitation,
  updateMemberPassword,
  removeAuthorizedMember,
  BOOTSTRAP_ADMIN_EMAIL,
  DATA_PROCESSOR_ADMIN_EMAIL,
  isSuperAdminEmail
} from '../../services/firebase';
import {
  UserProfile,
  UserRole,
  AuthorizedMember,
  ImportBatch,
  DepartmentName,
  AppModule,
  ActionType,
  ModulePermission,
  ModuleActionPermissions,
  AuditLogEntry,
  AuditLogModule
} from '../../types';
import {
  ALL_ROLES,
  ALL_DEPARTMENTS,
  ALL_MODULES,
  ALL_ACTIONS,
  getDepartmentDefaultModules,
  getDefaultRoleModulePermissions,
  canUserAccessModule,
  canUserPerformAction
} from '../../services/permissionService';
import { AuditLogService } from '../../services/auditLogService';
import { StorageService } from '../../services/storage';
import { CentralDataService } from '../../services/centralDataService';
import { DEFAULT_ORG_ID } from '../../constants/org';

export interface TeamManagementPageProps {
  batches?: ImportBatch[];
  onRefreshBatches?: () => void;
  onOpenImport?: () => void;
}

type TeamSubView = 'users' | 'roles_matrix' | 'enterprise_audit' | 'ingestion_audit';

export const TeamManagementPage: React.FC<TeamManagementPageProps> = ({
  batches: externalBatches,
  onRefreshBatches,
  onOpenImport
}) => {
  const { user, isSuperAdmin, isAdmin, isManager, isReadOnly } = useAuth();
  const [activeSubView, setActiveSubView] = useState<TeamSubView>('users');
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [authorizedList, setAuthorizedList] = useState<AuthorizedMember[]>(() => {
    return getLocalAuthorizedMembers().filter(m => (m.email || '').toLowerCase().trim() !== 'auditor@splustech.com');
  });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters for user list
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<AuthorizedMember | null>(null);
  const [deactivatingMember, setDeactivatingMember] = useState<AuthorizedMember | null>(null);
  const [permissionsMember, setPermissionsMember] = useState<AuthorizedMember | null>(null);
  const [editingPasswordMember, setEditingPasswordMember] = useState<AuthorizedMember | null>(null);

  // Password / credential copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Enterprise Audit Log state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => AuditLogService.getLocalLogs());
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>('all');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditUserFilter, setAuditUserFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isRefreshingAudit, setIsRefreshingAudit] = useState(false);

  // Ingestion Batches state (preserved)
  const [batchesList, setBatchesList] = useState<ImportBatch[]>(() => externalBatches || StorageService.getBatches());
  const [batchSearch, setBatchSearch] = useState('');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Load team users & authorized members
  const loadData = async () => {
    setLoading(true);
    try {
      const [membersResult, authResult, logsResult] = await Promise.allSettled([
        getTeamMembers(),
        getAuthorizedMembers(),
        AuditLogService.fetchAuditLogs()
      ]);

      if (membersResult.status === 'fulfilled' && membersResult.value && membersResult.value.length > 0) {
        const membersData = membersResult.value;
        if (user && !membersData.some(m => m.uid === user.uid)) {
          membersData.unshift(user);
        }
        setMembers(membersData);
      }
      if (authResult.status === 'fulfilled' && authResult.value) {
        const cleanAuth = authResult.value.filter(m => (m.email || '').toLowerCase().trim() !== 'auditor@splustech.com');
        setAuthorizedList(cleanAuth);
      } else {
        const local = getLocalAuthorizedMembers().filter(m => (m.email || '').toLowerCase().trim() !== 'auditor@splustech.com');
        setAuthorizedList(local);
      }
      if (logsResult.status === 'fulfilled' && logsResult.value && logsResult.value.length > 0) {
        setAuditLogs(logsResult.value);
      }
    } catch (e) {
      console.warn('Could not fetch members or authorized list:', e);
      setAuthorizedList(getLocalAuthorizedMembers().filter(m => (m.email || '').toLowerCase().trim() !== 'auditor@splustech.com'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubAudit = AuditLogService.subscribe(logs => {
      setAuditLogs(logs);
    });
    return () => unsubAudit();
  }, [user]);

  // Synchronize internal batches list
  useEffect(() => {
    if (externalBatches && externalBatches.length > 0) {
      setBatchesList(externalBatches);
    } else {
      const stored = StorageService.getBatches();
      if (stored.length > 0) {
        setBatchesList(stored);
      }
    }
  }, [externalBatches]);

  const handleCopyText = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Helper formatting
  const formatDateTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const getTimeAgo = (iso?: string) => {
    if (!iso) return '';
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  // User list calculations
  const filteredUsers = useMemo(() => {
    return authorizedList.filter(member => {
      // Role filter
      if (roleFilter !== 'all') {
        const norm = (member.role || '').toLowerCase();
        if (norm !== roleFilter.toLowerCase()) return false;
      }
      // Department filter
      if (deptFilter !== 'all') {
        if ((member.department || 'General') !== deptFilter) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        if ((member.status || 'active') !== statusFilter) return false;
      }
      // Search
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const matchesEmail = member.email.toLowerCase().includes(q);
        const matchesName = (member.displayName || '').toLowerCase().includes(q);
        const matchesNote = (member.note || '').toLowerCase().includes(q);
        const matchesDept = (member.department || '').toLowerCase().includes(q);
        if (!matchesEmail && !matchesName && !matchesNote && !matchesDept) {
          return false;
        }
      }
      return true;
    });
  }, [authorizedList, roleFilter, deptFilter, statusFilter, userSearch]);

  // Enterprise statistics
  const userStats = useMemo(() => {
    const total = authorizedList.length;
    const active = authorizedList.filter(m => (m.status || 'active') === 'active').length;
    const inactive = authorizedList.filter(m => m.status === 'inactive').length;
    const invited = authorizedList.filter(m => m.status === 'invited').length;
    const depts = Array.from(new Set(authorizedList.map(m => m.department || 'General'))).length;
    return { total, active, inactive, invited, depts };
  }, [authorizedList]);

  // Audit Logs filtering
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditModuleFilter !== 'all' && log.module !== auditModuleFilter) return false;
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
      if (auditUserFilter !== 'all' && log.actorEmail.toLowerCase() !== auditUserFilter.toLowerCase()) return false;

      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const matchesDesc = (log.description || '').toLowerCase().includes(q);
        const matchesActor = (log.actorName || '').toLowerCase().includes(q) || (log.actorEmail || '').toLowerCase().includes(q);
        const matchesTarget = (log.targetId || '').toLowerCase().includes(q);
        const matchesAction = (log.action || '').toLowerCase().includes(q);
        const matchesOld = JSON.stringify(log.oldValue || '').toLowerCase().includes(q);
        const matchesNew = JSON.stringify(log.newValue || '').toLowerCase().includes(q);
        if (!matchesDesc && !matchesActor && !matchesTarget && !matchesAction && !matchesOld && !matchesNew) {
          return false;
        }
      }
      return true;
    });
  }, [auditLogs, auditModuleFilter, auditActionFilter, auditUserFilter, auditSearch]);

  const auditUniqueUsers = useMemo(() => {
    return Array.from(new Set(auditLogs.map(l => l.actorEmail))).filter(Boolean);
  }, [auditLogs]);

  const auditUniqueActions = useMemo(() => {
    return Array.from(new Set(auditLogs.map(l => l.action))).filter(Boolean);
  }, [auditLogs]);

  const exportAuditLogsCSV = () => {
    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Actor Role', 'Department', 'Module', 'Action', 'Target ID', 'Description', 'Browser', 'OS', 'IP Address'];
    const rows = filteredAuditLogs.map(l => [
      l.timestamp,
      `"${l.actorName.replace(/"/g, '""')}"`,
      l.actorEmail,
      l.actorRole,
      l.actorDepartment || '',
      l.module,
      l.action,
      l.targetId || '',
      `"${l.description.replace(/"/g, '""')}"`,
      l.deviceInfo.browser,
      l.deviceInfo.os,
      l.deviceInfo.ipAddress || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Splus_Enterprise_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const roleBadge = (role: UserRole) => {
    const norm = (role || '').toLowerCase();
    switch (norm) {
      case 'super_admin':
      case 'superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
            <ShieldAlert size={12} /> Super Admin
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <ShieldCheck size={12} /> Admin
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <UserCheck size={12} /> Manager
          </span>
        );
      case 'team_member':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <User size={12} /> Team Member
          </span>
        );
      case 'read_only':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
            <Eye size={12} /> Read-only user
          </span>
        );
    }
  };

  const statusBadge = (status: string, member?: AuthorizedMember) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Active
          </span>
        );
      case 'inactive':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 cursor-help"
            title={`Deactivated: ${member?.deactivationReason || 'Suspended by admin'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Deactivated
          </span>
        );
      case 'invited':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Pending Invite
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Access Control & Enterprise Governance
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Lock size={11} /> Splus Organization
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-3xl">
            Zero-trust multi-role access control, department boundaries, user lifecycle (invitation, activation, deactivation),
            and immutable enterprise audit logging of every important action.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-xs"
            >
              <UserPlus size={14} />
              <span>Invite Team Member</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Notice Toast */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs font-medium animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSubView('users')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubView === 'users'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850'
          }`}
        >
          <Users size={14} className={activeSubView === 'users' ? 'text-emerald-400 dark:text-emerald-600' : 'text-zinc-400'} />
          <span>Team Members & Whitelist</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeSubView === 'users'
              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}>
            {userStats.total}
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('roles_matrix')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubView === 'roles_matrix'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850'
          }`}
        >
          <ShieldCheck size={14} className={activeSubView === 'roles_matrix' ? 'text-purple-400 dark:text-purple-600' : 'text-zinc-400'} />
          <span>Role & Permission Matrix</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
            5 Roles
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('enterprise_audit')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubView === 'enterprise_audit'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850'
          }`}
        >
          <History size={14} className={activeSubView === 'enterprise_audit' ? 'text-amber-400 dark:text-amber-600' : 'text-zinc-400'} />
          <span>Enterprise Audit Trail</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeSubView === 'enterprise_audit'
              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}>
            {auditLogs.length} events
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('ingestion_audit')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeSubView === 'ingestion_audit'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850'
          }`}
        >
          <FileSpreadsheet size={14} className="text-zinc-400" />
          <span>Ingestion History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {batchesList.length}
          </span>
        </button>
      </div>

      {/* TAB 1: USERS & ACCESS CONTROL */}
      {activeSubView === 'users' && (
        <div className="space-y-6">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Users</span>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{userStats.total}</div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Approved whitelist</span>
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Active Accounts</span>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{userStats.active}</div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Authorized to log in</span>
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-red-600 dark:text-red-400">Deactivated</span>
              <div className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">{userStats.inactive}</div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Login blocked</span>
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Pending Invites</span>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{userStats.invited}</div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Awaiting onboarding</span>
            </div>
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">Departments</span>
              <div className="text-xl font-bold text-purple-700 dark:text-purple-300 mt-1">{userStats.depts}</div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Department boundaries</span>
            </div>
          </div>

          {/* User Filtering & Search Toolbar */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name, email, department, or note..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="team_member">Team Member</option>
                <option value="read_only">Read-only user</option>
              </select>

              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <option value="all">All Departments</option>
                {ALL_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
                <option value="invited">Pending Invite</option>
              </select>

              {(userSearch || roleFilter !== 'all' || deptFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setUserSearch('');
                    setRoleFilter('all');
                    setDeptFilter('all');
                    setStatusFilter('all');
                  }}
                  className="px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* User Accounts Table */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-500 dark:text-zinc-400 font-semibold">
                    <th className="py-3 px-4">Team Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Module Permissions</th>
                    <th className="py-3 px-4">Invitation / Credentials</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-zinc-500 dark:text-zinc-400">
                        No team members matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(member => {
                      const isSuper = isSuperAdminEmail(member.email) || (member.role as any) === 'super_admin' || (member.role as any) === 'SUPER_ADMIN';
                      const isSelf = user?.email?.toLowerCase() === member.email.toLowerCase();
                      const memberDept = member.department || 'General';
                      const allowedModules = member.customPermissions
                        ? Object.keys(member.customPermissions).length
                        : getDepartmentDefaultModules(memberDept).length;

                      return (
                        <tr
                          key={member.email}
                          className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-850/30 transition-colors ${
                            member.status === 'inactive' ? 'opacity-65 bg-zinc-50/40 dark:bg-zinc-900/40' : ''
                          }`}
                        >
                          {/* Identity */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-700 dark:text-zinc-200 uppercase shrink-0">
                                {(member.displayName || member.email)[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                    {member.displayName || member.email.split('@')[0]}
                                  </span>
                                  {isSelf && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                      You
                                    </span>
                                  )}
                                  {isSuper && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                                      Owner
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {roleBadge(member.role)}
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              <Building2 size={12} className="text-zinc-400" />
                              {memberDept}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {statusBadge(member.status || 'active', member)}
                          </td>

                          {/* Permissions */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              onClick={() => setPermissionsMember(member)}
                              className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white underline decoration-dotted"
                              title="Click to view/edit custom permissions"
                            >
                              <Sliders size={12} className="text-zinc-400" />
                              <span>{isSuper ? 'Full Unrestricted' : `${allowedModules} modules enabled`}</span>
                            </button>
                          </td>

                          {/* Password / Credentials */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {member.inviteCode && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                  {member.inviteCode}
                                </span>
                              )}
                              <button
                                onClick={() => handleCopyText(
                                  `Splus Portal Access\nURL: ${window.location.origin}\nEmail: ${member.email}\nPassword: ${member.password || 'Splus2026!'}\nInvite Code: ${member.inviteCode || 'N/A'}`,
                                  member.email
                                )}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] transition-colors"
                                title="Copy login credentials"
                              >
                                {copiedKey === member.email ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                <span>{copiedKey === member.email ? 'Copied' : 'Credentials'}</span>
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Activate / Deactivate button */}
                              {isAdmin && !isSuper && (
                                <>
                                  {member.status === 'invited' && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          await setUserStatus(member.email, 'active', 'Activated by admin', user?.email);
                                          setStatusMessage({ type: 'success', text: `Activated account for ${member.email}. User can now sign in.` });
                                          loadData();
                                        } catch (err: any) {
                                          setStatusMessage({ type: 'error', text: err?.message || 'Could not activate account' });
                                        }
                                      }}
                                      className="p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                      title="Activate Account (Grant immediate login)"
                                    >
                                      <CheckCircle2 size={13} />
                                    </button>
                                  )}

                                  {member.status === 'inactive' && (
                                    <button
                                      onClick={async () => {
                                        await setUserStatus(member.email, 'active', 'Reactivated by admin', user?.email);
                                        setStatusMessage({ type: 'success', text: `Reactivated access for ${member.email}.` });
                                        loadData();
                                      }}
                                      className="p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                      title="Reactivate user account"
                                    >
                                      <Unlock size={13} />
                                    </button>
                                  )}

                                  {member.status === 'active' && (
                                    <button
                                      onClick={() => setDeactivatingMember(member)}
                                      className="p-1.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                      title="Deactivate user account"
                                    >
                                      <Lock size={13} />
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Edit Role & Department */}
                              {isAdmin && !isSuper && (
                                <button
                                  onClick={() => setEditingMember(member)}
                                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                  title="Edit Role & Department"
                                >
                                  <Edit3 size={13} />
                                </button>
                              )}

                              {/* Configure Permissions */}
                              {isAdmin && (
                                <button
                                  onClick={() => setPermissionsMember(member)}
                                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                  title="Configure Module & Action Permissions"
                                >
                                  <SlidersHorizontal size={13} />
                                </button>
                              )}

                              {/* Reset Password */}
                              {isAdmin && (
                                <button
                                  onClick={() => setEditingPasswordMember(member)}
                                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                  title="Update Password"
                                >
                                  <Key size={13} />
                                </button>
                              )}

                              {/* Resend Invite */}
                              {isAdmin && member.status === 'invited' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await resendInvitation(member.email);
                                      setStatusMessage({
                                        type: 'success',
                                        text: `Refreshed invitation code for ${member.email}: ${res.inviteCode}`
                                      });
                                      loadData();
                                    } catch (err: any) {
                                      setStatusMessage({ type: 'error', text: err?.message || 'Could not resend invite' });
                                    }
                                  }}
                                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                  title="Resend Invitation"
                                >
                                  <Mail size={13} />
                                </button>
                              )}

                              {/* Delete / Revoke */}
                              {isAdmin && !isSuper && (
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to revoke and permanently delete access for "${member.email}"?`)) {
                                      try {
                                        await removeAuthorizedMember(member.email);
                                        setStatusMessage({ type: 'success', text: `Revoked access for ${member.email}.` });
                                        loadData();
                                      } catch (err: any) {
                                        setStatusMessage({ type: 'error', text: err?.message || 'Could not revoke user' });
                                      }
                                    }
                                  }}
                                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                  title="Revoke access and delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
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

      {/* TAB 2: ROLE & PERMISSION MATRIX */}
      {activeSubView === 'roles_matrix' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck size={16} className="text-purple-600" />
              Role & Module Access Matrix
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Enterprise hierarchical role capabilities: Super Admin, Admin, Manager, Team Member, and Read-only user.
            </p>
          </div>

          {/* Matrix Table */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-500 dark:text-zinc-400 font-semibold">
                    <th className="py-3 px-4 min-w-[180px]">Enterprise Module</th>
                    {ALL_ROLES.map(r => (
                      <th key={r.role} className="py-3 px-4 min-w-[140px] text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{r.label}</span>
                          <span className="text-[10px] text-zinc-400 font-normal mt-0.5">Tier Level {r.level}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {ALL_MODULES.map(mod => (
                    <tr key={mod.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-850/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{mod.label}</div>
                        <div className="text-[11px] text-zinc-400">{mod.description}</div>
                      </td>

                      {ALL_ROLES.map(r => {
                        const perms = getDefaultRoleModulePermissions(r.role, mod.id);
                        return (
                          <td key={r.role} className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  perms.view
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {perms.view ? <Check size={10} /> : <X size={10} />}
                                {perms.view ? 'Accessible' : 'Restricted'}
                              </span>

                              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                {perms.create && <span className="text-blue-500 font-medium" title="Can Create">Create</span>}
                                {perms.edit && <span className="text-amber-500 font-medium" title="Can Edit">Edit</span>}
                                {perms.delete && <span className="text-red-500 font-medium" title="Can Delete">Delete</span>}
                                {perms.export && <span className="text-purple-500 font-medium" title="Can Export">Export</span>}
                                {!perms.create && !perms.edit && perms.view && (
                                  <span className="text-zinc-400 font-medium">View-Only</span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Access Boundaries */}
          <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Building2 size={16} className="text-zinc-600 dark:text-zinc-400" />
              Department-Based Access Policies
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Department assignment automatically filters and enforces default module boundaries for non-admin accounts:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {ALL_DEPARTMENTS.map(dept => {
                const defaultMods = getDepartmentDefaultModules(dept);
                return (
                  <div key={dept} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 space-y-1.5">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">{dept}</span>
                    <div className="flex flex-wrap gap-1">
                      {defaultMods.map(m => {
                        const modDef = ALL_MODULES.find(x => x.id === m);
                        return (
                          <span key={m} className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {modDef?.label || m}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENTERPRISE AUDIT TRAIL */}
      {activeSubView === 'enterprise_audit' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <History size={16} className="text-amber-500" />
                Enterprise Immutable Audit Trail
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Every important action across the portal is logged with performer identity, old & new values, module, and client device / IP origin.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={exportAuditLogsCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
              >
                <Download size={13} />
                <span>Export Audit CSV</span>
              </button>
            </div>
          </div>

          {/* Filtering Toolbar */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search audit trail by description, user, PO#, SKU, old or new values..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={auditModuleFilter}
                onChange={e => setAuditModuleFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <option value="all">All Modules</option>
                <option value="Purchasing">Purchasing</option>
                <option value="Product Catalog">Product Catalog</option>
                <option value="RMA">RMA</option>
                <option value="Team & Security">Team & Security</option>
                <option value="Daily Sales">Daily Sales</option>
                <option value="Settings">Settings</option>
                <option value="Auth">Auth & Login</option>
              </select>

              <select
                value={auditActionFilter}
                onChange={e => setAuditActionFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <option value="all">All Actions</option>
                {auditUniqueActions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <select
                value={auditUserFilter}
                onChange={e => setAuditUserFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 max-w-[180px] truncate"
              >
                <option value="all">All Performers</option>
                {auditUniqueUsers.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>

              {(auditSearch || auditModuleFilter !== 'all' || auditActionFilter !== 'all' || auditUserFilter !== 'all') && (
                <button
                  onClick={() => {
                    setAuditSearch('');
                    setAuditModuleFilter('all');
                    setAuditActionFilter('all');
                    setAuditUserFilter('all');
                  }}
                  className="px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Audit Log Feed */}
          <div className="space-y-3">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xs">
                No audit log records found for the current query.
              </div>
            ) : (
              filteredAuditLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                const hasDiff = log.oldValue !== null || log.newValue !== null;

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2.5 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Actor & Action */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {log.action}
                        </span>

                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {log.module}
                        </span>

                        {log.targetId && (
                          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                            Target: {log.targetId}
                          </span>
                        )}
                      </div>

                      {/* Timestamp & Device */}
                      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-zinc-400" />
                          <span>{formatDateTime(log.timestamp)}</span>
                          <span className="text-[10px] text-zinc-400">({getTimeAgo(log.timestamp)})</span>
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="text-xs text-zinc-900 dark:text-zinc-100 font-medium">
                      {log.description}
                    </div>

                    {/* Actor Details & Device Footer */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Who changed it:</span>
                        <span className="text-zinc-900 dark:text-zinc-100 font-medium">{log.actorName}</span>
                        <span className="font-mono text-zinc-400">&lt;{log.actorEmail}&gt;</span>
                        {roleBadge(log.actorRole)}
                        {log.actorDepartment && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {log.actorDepartment}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          {log.deviceInfo?.deviceType === 'Mobile' ? (
                            <Smartphone size={12} />
                          ) : log.deviceInfo?.deviceType === 'Tablet' ? (
                            <Tablet size={12} />
                          ) : (
                            <Laptop size={12} />
                          )}
                          <span>{log.deviceInfo?.browser} on {log.deviceInfo?.os}</span>
                        </span>

                        {log.deviceInfo?.ipAddress && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {log.deviceInfo.ipAddress}
                          </span>
                        )}

                        {hasDiff && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-100 hover:underline"
                          >
                            <span>{isExpanded ? 'Hide Values' : 'Inspect Old / New Values'}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Old vs New Value Inspection */}
                    {isExpanded && hasDiff && (
                      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-50/70 dark:bg-zinc-950/60 p-3 rounded-lg">
                        {/* Old Value */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Old Value
                          </span>
                          <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {log.oldValue !== null
                              ? typeof log.oldValue === 'object'
                                ? JSON.stringify(log.oldValue, null, 2)
                                : String(log.oldValue)
                              : 'None (Initial / Create Action)'}
                          </div>
                        </div>

                        {/* New Value */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            New Value
                          </span>
                          <div className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {log.newValue !== null
                              ? typeof log.newValue === 'object'
                                ? JSON.stringify(log.newValue, null, 2)
                                : String(log.newValue)
                              : 'None (Deleted Action)'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: SPREADSHEET INGESTION AUDIT TRAIL (Preserved) */}
      {activeSubView === 'ingestion_audit' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-zinc-500" />
                Spreadsheet Ingestion History
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                History of uploaded multi-marketplace Excel workbooks, parsed rows, and sync batch IDs.
              </p>
            </div>

            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-xs"
              >
                <UploadCloud size={13} />
                <span>Upload Spreadsheet</span>
              </button>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-500 dark:text-zinc-400 font-semibold">
                    <th className="py-3 px-4">Spreadsheet File</th>
                    <th className="py-3 px-4">Uploaded By</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Valid Rows</th>
                    <th className="py-3 px-4">Marketplaces</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {batchesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-zinc-400 text-xs">
                        No batch ingestion records yet.
                      </td>
                    </tr>
                  ) : (
                    batchesList.map(b => (
                      <tr key={b.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-850/30">
                        <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          {b.fileName}
                        </td>
                        <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                          {b.importedBy || 'Admin'}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                          {formatDateTime(b.importedAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100">
                          {b.validRows?.toLocaleString() || 0}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                          {(b.marketplaces || []).join(', ') || 'Multi-Marketplace'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 size={11} /> {b.status || 'Successful'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: INVITE USER MODAL */}
      {isInviteModalOpen && (
        <InviteUserModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={async (email, newMember) => {
            setStatusMessage({ type: 'success', text: `Invitation created and recorded in audit log for "${email}".` });
            setIsInviteModalOpen(false);
            // Clear any active search/filter so the new member is immediately visible at the top
            setUserSearch('');
            setRoleFilter('all');
            setDeptFilter('all');
            setStatusFilter('all');
            if (newMember) {
              setAuthorizedList(prev => {
                const filtered = prev.filter(m => m.email.toLowerCase() !== email.toLowerCase());
                return [newMember, ...filtered];
              });
            } else {
              setAuthorizedList(getLocalAuthorizedMembers().filter(m => (m.email || '').toLowerCase().trim() !== 'auditor@splustech.com'));
            }
            await loadData();
          }}
          currentAdminEmail={user?.email || BOOTSTRAP_ADMIN_EMAIL}
        />
      )}

      {/* MODAL 2: DEACTIVATE USER MODAL */}
      {deactivatingMember && (
        <DeactivateUserModal
          member={deactivatingMember}
          onClose={() => setDeactivatingMember(null)}
          onConfirm={async (reason) => {
            try {
              await setUserStatus(deactivatingMember.email, 'inactive', reason, user?.email);
              setStatusMessage({ type: 'success', text: `Deactivated access for "${deactivatingMember.email}".` });
              setDeactivatingMember(null);
              loadData();
            } catch (err: any) {
              setStatusMessage({ type: 'error', text: err?.message || 'Could not deactivate user' });
            }
          }}
        />
      )}

      {/* MODAL 3: EDIT ROLE & DEPARTMENT MODAL */}
      {editingMember && (
        <EditRoleDeptModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onConfirm={async (role, dept) => {
            try {
              await updateUserRoleAndDepartment(editingMember.email, role, dept);
              setStatusMessage({ type: 'success', text: `Updated role and department for "${editingMember.email}".` });
              setEditingMember(null);
              loadData();
            } catch (err: any) {
              setStatusMessage({ type: 'error', text: err?.message || 'Could not update user' });
            }
          }}
        />
      )}

      {/* MODAL 4: CUSTOM PERMISSIONS MODAL */}
      {permissionsMember && (
        <CustomPermissionsModal
          member={permissionsMember}
          onClose={() => setPermissionsMember(null)}
          onConfirm={async (perms) => {
            try {
              await updateUserPermissions(permissionsMember.email, perms);
              setStatusMessage({ type: 'success', text: `Permissions updated and audited for "${permissionsMember.email}".` });
              setPermissionsMember(null);
              loadData();
            } catch (err: any) {
              setStatusMessage({ type: 'error', text: err?.message || 'Could not update permissions' });
            }
          }}
        />
      )}

      {/* MODAL 5: EDIT PASSWORD MODAL */}
      {editingPasswordMember && (
        <EditPasswordModal
          member={editingPasswordMember}
          onClose={() => setEditingPasswordMember(null)}
          onConfirm={async (newPass) => {
            try {
              await updateMemberPassword(editingPasswordMember.email, newPass);
              setStatusMessage({ type: 'success', text: `Password credentials reset for "${editingPasswordMember.email}".` });
              setEditingPasswordMember(null);
              loadData();
            } catch (err: any) {
              setStatusMessage({ type: 'error', text: err?.message || 'Could not update password' });
            }
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// SUB-MODALS IMPLEMENTATIONS
// ==========================================

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string, member?: AuthorizedMember) => void;
  currentAdminEmail: string;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentAdminEmail
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('team_member');
  const [department, setDepartment] = useState<DepartmentName>('Purchasing & Procurement');
  const [tempPassword, setTempPassword] = useState('Splus2026!');
  const [accountStatus, setAccountStatus] = useState<'active' | 'invited'>('active');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const newMember = await inviteUser({
        email: email.trim(),
        displayName: name.trim() || undefined,
        role,
        department,
        status: accountStatus,
        temporaryPassword: tempPassword.trim() || 'Splus2026!',
        note: note.trim() || undefined,
        invitedBy: currentAdminEmail
      });
      onSuccess(email.trim(), newMember);
    } catch (err: any) {
      setError(err?.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-zinc-900 dark:text-zinc-100" />
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Invite Team Member</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. colleague@splustech.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Full Name
            </label>
            <input
              type="text"
              placeholder="e.g. Alexander Vance"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Assigned Role *
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
              >
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="team_member">Team Member</option>
                <option value="read_only">Read-only user</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Department *
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value as DepartmentName)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
              >
                {ALL_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Temporary Access Password
              </label>
              <input
                type="text"
                value={tempPassword}
                onChange={e => setTempPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Account Status
              </label>
              <select
                value={accountStatus}
                onChange={e => setAccountStatus(e.target.value as 'active' | 'invited')}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium"
              >
                <option value="active">Active (Immediate Login Permitted)</option>
                <option value="invited">Pending Invitation (Awaiting first login)</option>
              </select>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 -mt-2 block">
            Active accounts can sign in immediately through the login screen with their email and password.
          </span>

          <div>
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Onboarding Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Lead procurement specialist for auto parts"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Creating Invitation...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeactivateUserModalProps {
  member: AuthorizedMember;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

const DeactivateUserModal: React.FC<DeactivateUserModalProps> = ({ member, onClose, onConfirm }) => {
  const [reason, setReason] = useState('Employee offboarding / Role suspension');
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <Lock size={18} />
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Deactivate User Account</h3>
        </div>

        <p className="text-zinc-600 dark:text-zinc-300">
          Are you sure you want to deactivate account access for <strong className="text-zinc-900 dark:text-zinc-100">{member.email}</strong>?
          They will be immediately blocked from signing in until reactivated.
        </p>

        <div>
          <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
            Reason for Deactivation *
          </label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
          >
            <option value="Employee offboarding / Role suspension">Employee offboarding / Role suspension</option>
            <option value="Temporary leave of absence">Temporary leave of absence</option>
            <option value="Security precaution / Compromised credentials">Security precaution / Compromised credentials</option>
            <option value="Contract completed">Contract completed</option>
            <option value="Other administrative policy">Other administrative policy</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              await onConfirm(reason);
              setLoading(false);
            }}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 shadow-xs"
          >
            {loading ? 'Deactivating...' : 'Confirm Deactivation'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface EditRoleDeptModalProps {
  member: AuthorizedMember;
  onClose: () => void;
  onConfirm: (role: UserRole, department: DepartmentName) => Promise<void>;
}

const EditRoleDeptModal: React.FC<EditRoleDeptModalProps> = ({ member, onClose, onConfirm }) => {
  const [role, setRole] = useState<UserRole>(member.role || 'team_member');
  const [department, setDepartment] = useState<DepartmentName>(member.department || 'General');
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Edit Role & Department</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
        </div>

        <p className="text-zinc-500">
          Modifying privileges for <strong className="text-zinc-900 dark:text-zinc-100">{member.email}</strong>.
        </p>

        <div className="space-y-3">
          <div>
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Select Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="team_member">Team Member</option>
              <option value="read_only">Read-only user</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Select Department
            </label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value as DepartmentName)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
            >
              {ALL_DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">
            Cancel
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              await onConfirm(role, department);
              setLoading(false);
            }}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface CustomPermissionsModalProps {
  member: AuthorizedMember;
  onClose: () => void;
  onConfirm: (permissions: ModuleActionPermissions) => Promise<void>;
}

const CustomPermissionsModal: React.FC<CustomPermissionsModalProps> = ({ member, onClose, onConfirm }) => {
  const [permissions, setPermissions] = useState<ModuleActionPermissions>(() => {
    if (member.customPermissions) return { ...member.customPermissions };
    const initial: ModuleActionPermissions = {};
    const defaultMods = getDepartmentDefaultModules(member.department || 'General');
    ALL_MODULES.forEach(mod => {
      const isDeptAllowed = defaultMods.includes(mod.id);
      const def = getDefaultRoleModulePermissions(member.role, mod.id);
      initial[mod.id] = {
        ...def,
        view: isDeptAllowed && def.view
      };
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);

  const togglePermission = (modId: AppModule, action: ActionType) => {
    setPermissions(prev => {
      const currentMod = prev[modId] || { view: false, create: false, edit: false, delete: false, export: false, admin_manage: false };
      return {
        ...prev,
        [modId]: {
          ...currentMod,
          [action]: !currentMod[action]
        }
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 text-xs max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Module & Action Permissions Matrix
            </h3>
            <span className="text-zinc-400 text-xs">
              Custom granularity for {member.email} ({member.role} • {member.department || 'General'})
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 space-y-3">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-500 font-semibold">
                <th className="py-2 px-3">Module</th>
                {ALL_ACTIONS.map(act => (
                  <th key={act.id} className="py-2 px-3 text-center capitalize">{act.id}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {ALL_MODULES.map(mod => {
                const perms = permissions[mod.id] || { view: false, create: false, edit: false, delete: false, export: false, admin_manage: false };
                return (
                  <tr key={mod.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/40">
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 block">{mod.label}</span>
                      <span className="text-[10px] text-zinc-400">{mod.category}</span>
                    </td>
                    {ALL_ACTIONS.map(act => (
                      <td key={act.id} className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!perms[act.id]}
                          onChange={() => togglePermission(mod.id, act.id)}
                          className="w-4 h-4 rounded text-black dark:text-white focus:ring-0 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          <button onClick={onClose} className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-semibold">
            Cancel
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              await onConfirm(permissions);
              setLoading(false);
            }}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
          >
            {loading ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface EditPasswordModalProps {
  member: AuthorizedMember;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}

const EditPasswordModal: React.FC<EditPasswordModalProps> = ({ member, onClose, onConfirm }) => {
  const [newPass, setNewPass] = useState(member.password || 'Splus2026!');
  const [show, setShow] = useState(true);
  const [loading, setLoading] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Key size={16} /> Reset Password
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
        </div>

        <p className="text-zinc-500">
          Set access password for <strong className="text-zinc-900 dark:text-zinc-100">{member.email}</strong>.
        </p>

        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            className="w-full px-3 py-2 pr-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">
            Cancel
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              await onConfirm(newPass);
              setLoading(false);
            }}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold"
          >
            {loading ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  );
};
