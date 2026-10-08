export type UserRole = 
  | 'super_admin'
  | 'SUPER_ADMIN'
  | 'admin'
  | 'manager'
  | 'team_member'
  | 'read_only';

export type DepartmentName =
  | 'Executive'
  | 'Sales & Marketplaces'
  | 'Purchasing & Procurement'
  | 'Warehouse & Inventory'
  | 'RMA & Customer Support'
  | 'Finance & Accounting'
  | 'IT & Engineering'
  | 'Operations'
  | 'General';

export type AppModule =
  | 'dashboard'
  | 'daily-sales'
  | 'analytics'
  | 'marketplaces'
  | 'stores'
  | 'products'
  | 'purchasing'
  | 'rma'
  | 'reports'
  | 'import'
  | 'team'
  | 'settings';

export type ActionType =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'admin_manage';

export interface ModulePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  admin_manage: boolean;
}

export type ModuleActionPermissions = Partial<Record<AppModule, ModulePermission>>;

export type UserAccountStatus = 'active' | 'inactive' | 'invited' | 'pending' | 'suspended' | 'deactivated';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: DepartmentName;
  status?: UserAccountStatus;
  isSuperAdmin?: boolean;
  photoURL?: string;
  createdAt?: string;
  lastLoginAt?: string;
  customPermissions?: ModuleActionPermissions;
  organizationId?: string;
  organizationName?: string;
}

export interface AuthorizedMember {
  id?: string;
  email: string;
  displayName?: string;
  role: UserRole;
  department?: DepartmentName;
  status: UserAccountStatus;
  password?: string;
  addedBy: string;
  addedAt: string;
  activatedAt?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
  inviteCode?: string;
  note?: string;
  customPermissions?: ModuleActionPermissions;
  organizationId?: string;
  organizationName?: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  department: DepartmentName;
  status: 'invited' | 'accepted' | 'expired' | 'revoked';
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  inviteCode: string;
  temporaryPassword?: string;
  customPermissions?: ModuleActionPermissions;
  note?: string;
}

export type AuditLogModule =
  | 'Purchasing'
  | 'Product Catalog'
  | 'RMA'
  | 'Team & Security'
  | 'Daily Sales'
  | 'Settings'
  | 'Auth'
  | 'Data Import'
  | 'Marketplaces';

export interface AuditDeviceInfo {
  browser: string;
  os: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  userAgent?: string;
  ipAddress?: string;
  screenResolution?: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId?: string;
  timestamp: string; // ISO 8601
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorRole: UserRole;
  actorDepartment?: DepartmentName | string;
  action: string; // e.g. "USER_INVITED", "USER_ACTIVATED", "PO_CREATED", etc.
  module: AuditLogModule;
  targetId?: string;
  targetType?: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  deviceInfo: AuditDeviceInfo;
}

export interface RoleDefinition {
  role: UserRole;
  label: string;
  badgeColor: string;
  description: string;
  level: number;
}
