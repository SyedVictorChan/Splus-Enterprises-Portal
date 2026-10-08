import {
  UserRole,
  DepartmentName,
  AppModule,
  ActionType,
  ModulePermission,
  ModuleActionPermissions,
  UserProfile,
  RoleDefinition
} from '../types/rbac';

export const ALL_ROLES: RoleDefinition[] = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    description: 'Full unconstrained organizational ownership, security control, and user governance.',
    level: 100
  },
  {
    role: 'admin',
    label: 'Admin',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    description: 'Enterprise administration, member onboarding, and organizational settings management.',
    level: 80
  },
  {
    role: 'manager',
    label: 'Manager',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    description: 'Operational team lead with approvals, inventory oversight, and department access.',
    level: 50
  },
  {
    role: 'team_member',
    label: 'Team Member',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    description: 'Standard daily business operations, sales recording, PO drafting, and catalog lookups.',
    level: 20
  },
  {
    role: 'read_only',
    label: 'Read-only user',
    badgeColor: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    description: 'Audit & observation access only. Restricted from creating, editing, deleting, or modifying data.',
    level: 10
  }
];

export const ALL_DEPARTMENTS: DepartmentName[] = [
  'Executive',
  'Purchasing & Procurement',
  'Warehouse & Inventory',
  'Sales & Marketplaces',
  'RMA & Customer Support',
  'Finance & Accounting',
  'IT & Engineering',
  'Operations',
  'General'
];

export const ALL_MODULES: { id: AppModule; label: string; description: string; category: string }[] = [
  { id: 'dashboard', label: 'Executive Dashboard', description: 'High-level KPI metrics, sales velocity, and executive summaries', category: 'Analytics' },
  { id: 'daily-sales', label: 'Daily Sales & Ingestion', description: 'Store-by-store sales entries, refunds, and daily totals', category: 'Sales' },
  { id: 'analytics', label: 'Sales Analytics & Growth', description: 'Historical trends, store performance, and profitability analysis', category: 'Analytics' },
  { id: 'marketplaces', label: 'Marketplaces Overview', description: 'Channel breakdown across Amazon, eBay, Walmart, NewEgg, Direct', category: 'Sales' },
  { id: 'stores', label: 'Store Portfolios', description: 'Individual merchant store fulfillment and category tracking', category: 'Sales' },
  { id: 'products', label: 'Product Catalog & WMS', description: 'WMS Stock Status reports, Part No./SKU families, and stock on hand', category: 'Inventory' },
  { id: 'purchasing', label: 'Purchasing Dashboard', description: 'Purchase Orders, supplier directory, receiving, and procurement payments', category: 'Procurement' },
  { id: 'rma', label: 'RMA & Returns Management', description: 'Return Merchandise Authorizations, customer claims, and tracking', category: 'Operations' },
  { id: 'reports', label: 'Financial & Export Reports', description: 'Exportable spreadsheets, tax data, and executive performance reviews', category: 'Finance' },
  { id: 'import', label: 'Data Import & Parsing', description: 'Upload raw sales spreadsheets and WMS inventory exports', category: 'Data' },
  { id: 'team', label: 'Team & Security Access', description: 'User accounts, whitelist, RBAC permissions, and enterprise audit trail', category: 'Governance' },
  { id: 'settings', label: 'Organization Settings', description: 'Company details, currency, targets, and system configuration', category: 'Governance' }
];

export const ALL_ACTIONS: { id: ActionType; label: string; description: string }[] = [
  { id: 'view', label: 'View / Read', description: 'Access and view records in this module' },
  { id: 'create', label: 'Create / Add', description: 'Add new purchase orders, RMA items, or data entries' },
  { id: 'edit', label: 'Edit / Update', description: 'Modify existing records, status, and information' },
  { id: 'delete', label: 'Delete / Revoke', description: 'Delete records, remove files, or cancel contracts' },
  { id: 'export', label: 'Export / Download', description: 'Export records to CSV, Excel, or JSON' },
  { id: 'admin_manage', label: 'Administer', description: 'Configure settings, user permissions, and security policies' }
];

/**
 * Returns default accessible modules for a department
 */
export function getDepartmentDefaultModules(dept: DepartmentName): AppModule[] {
  switch (dept) {
    case 'Executive':
    case 'IT & Engineering':
      return [
        'dashboard',
        'daily-sales',
        'analytics',
        'marketplaces',
        'stores',
        'products',
        'purchasing',
        'rma',
        'reports',
        'import',
        'team',
        'settings'
      ];
    case 'Purchasing & Procurement':
      return ['dashboard', 'purchasing', 'products', 'reports', 'import', 'stores'];
    case 'Warehouse & Inventory':
      return ['dashboard', 'products', 'rma', 'purchasing', 'import'];
    case 'Sales & Marketplaces':
      return ['dashboard', 'daily-sales', 'analytics', 'marketplaces', 'stores', 'products', 'reports'];
    case 'RMA & Customer Support':
      return ['dashboard', 'rma', 'products', 'daily-sales'];
    case 'Finance & Accounting':
      return ['dashboard', 'daily-sales', 'purchasing', 'reports', 'analytics'];
    case 'Operations':
      return ['dashboard', 'daily-sales', 'products', 'purchasing', 'rma', 'stores', 'reports', 'import'];
    case 'General':
    default:
      return ['dashboard', 'daily-sales', 'products', 'rma'];
  }
}

/**
 * Returns default action permissions for a given role on a module
 */
export function getDefaultRoleModulePermissions(role: UserRole, module: AppModule): ModulePermission {
  const normRole = (role || '').toLowerCase();

  // Super Admin: unrestricted access to everything
  if (normRole === 'super_admin' || normRole === 'superadmin') {
    return {
      view: true,
      create: true,
      edit: true,
      delete: true,
      export: true,
      admin_manage: true
    };
  }

  // Admin: full access to all business modules and governance
  if (normRole === 'admin') {
    return {
      view: true,
      create: true,
      edit: true,
      delete: true,
      export: true,
      admin_manage: true
    };
  }

  // Manager: operational power without deleting critical system configs or admin management
  if (normRole === 'manager') {
    const isGovernance = module === 'team' || module === 'settings';
    return {
      view: true,
      create: !isGovernance,
      edit: !isGovernance,
      delete: false,
      export: true,
      admin_manage: false
    };
  }

  // Team Member: daily operational tasks
  if (normRole === 'team_member') {
    const isGovernance = module === 'team' || module === 'settings';
    return {
      view: !isGovernance,
      create: !isGovernance,
      edit: !isGovernance,
      delete: false,
      export: true,
      admin_manage: false
    };
  }

  // Read-only user: view only, strictly no modifications
  if (normRole === 'read_only') {
    const isGovernance = module === 'team' || module === 'settings';
    return {
      view: !isGovernance,
      create: false,
      edit: false,
      delete: false,
      export: false,
      admin_manage: false
    };
  }

  // Fallback safe default
  return {
    view: true,
    create: false,
    edit: false,
    delete: false,
    export: false,
    admin_manage: false
  };
}

/**
 * Checks whether a user has access to view a module
 */
export function canUserAccessModule(
  user: UserProfile | null | undefined,
  module: AppModule
): boolean {
  if (!user) return false;

  const role = (user.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'superadmin' || user.isSuperAdmin) {
    return true;
  }
  if (role === 'admin') {
    return true;
  }

  // Custom permission override takes top precedence
  if (user.customPermissions && user.customPermissions[module]) {
    return !!user.customPermissions[module]?.view;
  }

  // Department-based access check
  const dept = user.department || 'General';
  const deptModules = getDepartmentDefaultModules(dept);
  if (!deptModules.includes(module)) {
    return false;
  }

  // Role check
  const defaultPerms = getDefaultRoleModulePermissions(user.role, module);
  return defaultPerms.view;
}

/**
 * Checks whether a user can perform a specific action on a module
 */
export function canUserPerformAction(
  user: UserProfile | null | undefined,
  module: AppModule,
  action: ActionType
): boolean {
  if (!user) return false;

  const role = (user.role || '').toLowerCase();
  if (role === 'super_admin' || role === 'superadmin' || user.isSuperAdmin) {
    return true;
  }
  if (role === 'admin') {
    return true;
  }

  // Read-only users are strictly forbidden from mutation actions
  if (role === 'read_only' && action !== 'view') {
    return false;
  }

  // Check module access first
  if (!canUserAccessModule(user, module)) {
    return false;
  }

  // Custom permission override
  if (user.customPermissions && user.customPermissions[module]) {
    const modulePerms = user.customPermissions[module];
    if (modulePerms && modulePerms[action] !== undefined) {
      return !!modulePerms[action];
    }
  }

  // Role default
  const defaultPerms = getDefaultRoleModulePermissions(user.role, module);
  return !!defaultPerms[action];
}
