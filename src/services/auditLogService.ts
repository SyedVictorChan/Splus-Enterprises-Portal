import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, isQuotaExhausted } from './firebase';
import { DEFAULT_ORG_ID } from '../constants/org';
import {
  AuditLogEntry,
  AuditLogModule,
  AuditDeviceInfo,
  UserRole,
  DepartmentName
} from '../types/rbac';

const AUDIT_STORAGE_KEY = 'splus_enterprise_audit_log_v1';
const auditSubscribers = new Set<(logs: AuditLogEntry[]) => void>();

/**
 * Detect client browser, OS, device type, and client network origin
 */
export function detectDeviceInfo(): AuditDeviceInfo {
  if (typeof window === 'undefined') {
    return {
      browser: 'Server / Node',
      os: 'Linux',
      deviceType: 'Desktop'
    };
  }

  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';

  // Device detection
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/Mobile|Android|iPhone/i.test(ua)) {
    deviceType = 'Mobile';
  }

  // OS detection
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 11 / 10';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X 10[._](\d+)/i.test(ua)) os = 'macOS';
  else if (/Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser detection
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';

  const screenRes = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined;

  // Derive client origin or simulated internal IP tag for enterprise network tracking
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
  const ipSimulated = host === 'localhost' || host === '127.0.0.1' 
    ? '192.168.1.104 (Local Subnet)' 
    : `Cloud Gateway (${host.slice(0, 24)})`;

  return {
    browser,
    os,
    deviceType,
    userAgent: ua,
    ipAddress: ipSimulated,
    screenResolution: screenRes
  };
}

/**
 * Seed baseline enterprise audit logs so history is rich and informative
 */
const SEED_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud_seed_001',
    organizationId: DEFAULT_ORG_ID,
    timestamp: '2026-09-24T10:15:22.000Z',
    actorId: 'admin_faraz',
    actorEmail: 'farazrizvi2002@gmail.com',
    actorName: 'Faraz Rizvi',
    actorRole: 'super_admin',
    actorDepartment: 'Executive',
    action: 'SYSTEM_BOOTSTRAP',
    module: 'Team & Security',
    targetId: 'splus-org-central',
    targetType: 'Organization',
    description: 'Enterprise zero-trust access control and role-based permissions bootstrapped.',
    oldValue: null,
    newValue: {
      organization: 'Splus Enterprises',
      tier: 'Enterprise Super Admin',
      departmentsCount: 8,
      status: 'Active'
    },
    deviceInfo: {
      browser: 'Google Chrome',
      os: 'macOS',
      deviceType: 'Desktop',
      ipAddress: '192.168.1.10 (Executive Office)'
    }
  },
  {
    id: 'aud_seed_002',
    organizationId: DEFAULT_ORG_ID,
    timestamp: '2026-09-24T11:30:10.000Z',
    actorId: 'admin_dataprocessor',
    actorEmail: 'data.processor@splustech.com',
    actorName: 'Data Processor Admin',
    actorRole: 'admin',
    actorDepartment: 'IT & Engineering',
    action: 'WMS_IMPORT',
    module: 'Product Catalog',
    targetId: 'StockStatusReportTest.xls',
    targetType: 'WMSReport',
    description: 'Imported and normalized WMS Stock Status Report containing multi-warehouse inventory.',
    oldValue: { totalProducts: 0, totalStock: 0 },
    newValue: {
      fileName: 'StockStatusReportTest.xls',
      detectedFormat: 'Excel HTML / WMS Export',
      validProducts: 48,
      totalStockUnits: 3840
    },
    deviceInfo: {
      browser: 'Google Chrome',
      os: 'Windows 11',
      deviceType: 'Desktop',
      ipAddress: '10.0.4.15 (Data Processing Center)'
    }
  },
  {
    id: 'aud_seed_003',
    organizationId: DEFAULT_ORG_ID,
    timestamp: '2026-09-24T13:45:00.000Z',
    actorId: 'manager_support_splustech_com',
    actorEmail: 'manager.support@splustech.com',
    actorName: 'Operations Lead',
    actorRole: 'manager',
    actorDepartment: 'Purchasing & Procurement',
    action: 'PO_STATUS_CHANGED',
    module: 'Purchasing',
    targetId: 'PO-2026-1002',
    targetType: 'PurchaseOrder',
    description: 'Purchase Order #PO-2026-1002 status changed from Draft to Confirmed upon supplier verification.',
    oldValue: { status: 'Draft', totalAmount: 4850.00 },
    newValue: { status: 'Confirmed', supplier: 'TechSource Global', expectedDelivery: '2026-10-05' },
    deviceInfo: {
      browser: 'Mozilla Firefox',
      os: 'Windows 11',
      deviceType: 'Desktop',
      ipAddress: '10.0.2.88 (Procurement)'
    }
  },
  {
    id: 'aud_seed_004',
    organizationId: DEFAULT_ORG_ID,
    timestamp: '2026-09-24T15:20:18.000Z',
    actorId: 'orderprocessor_splustech_com',
    actorEmail: 'orderprocessor@splustech.com',
    actorName: 'Operations Associate',
    actorRole: 'team_member',
    actorDepartment: 'Warehouse & Inventory',
    action: 'RMA_STATUS_CHANGED',
    module: 'RMA',
    targetId: 'RMA-2026-0042',
    targetType: 'RMAItem',
    description: 'RMA claim #RMA-2026-0042 status updated to Under Inspection at primary warehouse.',
    oldValue: { status: 'Received' },
    newValue: { status: 'Under Inspection', inspectTech: 'orderprocessor' },
    deviceInfo: {
      browser: 'Google Chrome',
      os: 'Linux',
      deviceType: 'Tablet',
      ipAddress: '10.0.8.22 (Warehouse Bin A)'
    }
  }
];

export class AuditLogService {
  /**
   * Load audit logs from local cache or seed data
   */
  static getLocalLogs(): AuditLogEntry[] {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Error reading local audit logs:', e);
    }
    return SEED_AUDIT_LOGS;
  }

  /**
   * Persist logs to local storage and broadcast to subscribers
   */
  static saveLocalLogs(logs: AuditLogEntry[]): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 500)));
      }
    } catch (e) {
      console.warn('Error saving local audit logs:', e);
    }
    auditSubscribers.forEach(cb => {
      try {
        cb(logs);
      } catch {}
    });
  }

  /**
   * Main audit recording function. Call this on any important modification!
   */
  static async recordLog(params: {
    action: string;
    module: AuditLogModule;
    description: string;
    targetId?: string;
    targetType?: string;
    oldValue?: any;
    newValue?: any;
    actorOverride?: {
      id?: string;
      email?: string;
      name?: string;
      role?: UserRole;
      department?: DepartmentName | string;
    };
  }): Promise<AuditLogEntry> {
    let actorEmail = params.actorOverride?.email || 'admin@splustech.com';
    let actorName = params.actorOverride?.name || 'Administrator';
    let actorRole: UserRole = params.actorOverride?.role || 'admin';
    let actorDept = params.actorOverride?.department || 'Executive';
    let actorId = params.actorOverride?.id || 'admin_session';

    // Retrieve active session if available
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('splus_verified_user_session');
        if (raw) {
          const user = JSON.parse(raw);
          actorEmail = params.actorOverride?.email || user.email || actorEmail;
          actorName = params.actorOverride?.name || user.displayName || actorEmail.split('@')[0];
          actorRole = params.actorOverride?.role || user.role || actorRole;
          actorDept = params.actorOverride?.department || user.department || actorDept;
          actorId = params.actorOverride?.id || user.uid || actorId;
        }
      }
    } catch {}

    const entryId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const deviceInfo = detectDeviceInfo();

    const newLog: AuditLogEntry = {
      id: entryId,
      organizationId: DEFAULT_ORG_ID,
      timestamp: new Date().toISOString(),
      actorId,
      actorEmail,
      actorName,
      actorRole,
      actorDepartment: actorDept,
      action: params.action,
      module: params.module,
      targetId: params.targetId,
      targetType: params.targetType,
      description: params.description,
      oldValue: params.oldValue !== undefined ? params.oldValue : null,
      newValue: params.newValue !== undefined ? params.newValue : null,
      deviceInfo
    };

    // Prepend to local memory & storage
    const current = this.getLocalLogs();
    const updated = [newLog, ...current];
    this.saveLocalLogs(updated);

    // Asynchronously synchronize to Firestore cloud
    if (!isQuotaExhausted()) {
      try {
        const docRefOrg = doc(db, 'organizations', DEFAULT_ORG_ID, 'audit_logs', entryId);
        const docRefRoot = doc(db, 'audit_logs', entryId);
        await Promise.allSettled([
          setDoc(docRefOrg, newLog),
          setDoc(docRefRoot, newLog)
        ]);
      } catch (err) {
        console.warn('Could not mirror audit log to Firestore:', err);
      }
    }

    return newLog;
  }

  /**
   * Fetch all audit logs, querying Firestore and falling back to local
   */
  static async fetchAuditLogs(): Promise<AuditLogEntry[]> {
    if (isQuotaExhausted()) {
      return this.getLocalLogs();
    }

    try {
      const q = query(
        collection(db, 'organizations', DEFAULT_ORG_ID, 'audit_logs'),
        orderBy('timestamp', 'desc'),
        limit(200)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const cloudLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
        this.saveLocalLogs(cloudLogs);
        return cloudLogs;
      }
    } catch (err) {
      console.info('Audit log Firestore query note, using cached audit trail:', err);
    }

    return this.getLocalLogs();
  }

  /**
   * Subscribe to real-time audit log updates
   */
  static subscribe(callback: (logs: AuditLogEntry[]) => void): () => void {
    auditSubscribers.add(callback);
    callback(this.getLocalLogs());

    let unsubSnapshot: (() => void) | null = null;
    if (!isQuotaExhausted()) {
      try {
        const q = query(
          collection(db, 'organizations', DEFAULT_ORG_ID, 'audit_logs'),
          orderBy('timestamp', 'desc'),
          limit(150)
        );
        unsubSnapshot = onSnapshot(q, snap => {
          if (!snap.empty) {
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
            this.saveLocalLogs(logs);
          }
        }, err => {
          console.warn('Audit log snapshot notice:', err);
        });
      } catch {}
    }

    return () => {
      auditSubscribers.delete(callback);
      if (unsubSnapshot) unsubSnapshot();
    };
  }
}
