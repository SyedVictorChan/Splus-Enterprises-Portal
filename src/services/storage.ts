import {
  AppSettings,
  DailyPurchasingRecord,
  DailyReportData,
  ImportBatch,
  MappingTemplate,
  SalesRecord
} from '../types';
import { CentralDataService } from './centralDataService';
import { DEFAULT_ORG_ID } from '../constants/org';
import { isQuotaExhausted } from './firebase';

const STORAGE_KEYS = {
  RECORDS: 'splus_sales_records_v1',
  BATCHES: 'splus_import_batches_v1',
  SETTINGS: 'splus_settings_v1',
  TEMPLATES: 'splus_mapping_templates_v1',
  PURCHASING: 'splus_daily_purchasing_v1',
  DAILY_REPORTS: 'splus_daily_reports_v1',
  INITIALIZED: 'splus_initialized_flag'
};

const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'Splus Enterprises',
  currency: 'USD',
  currencySymbol: '$',
  dateFormat: 'YYYY-MM-DD',
  darkMode: false,
  targets: {
    '2026-09': {
      monthKey: '2026-09',
      salesTarget: 50000,
      ordersTarget: 1200,
      profitTarget: 22000
    }
  },
  rememberMappings: true
};

export class StorageService {
  private static activeSyncPromise: Promise<{
    records: SalesRecord[];
    batches: ImportBatch[];
    settings: AppSettings;
    dailyReports: DailyReportData[];
    purchasingRecords: DailyPurchasingRecord[];
  }> | null = null;
  private static subscribers: (() => void)[] = [];
  private static unsubscribeCloudListener: (() => void) | null = null;
  private static syncDebounceTimer: any = null;

  /**
   * Initializes real-time listener to the central Splus Enterprises database.
   * All authenticated sessions stay continuously synchronized.
   */
  static initCentralSync(onRemoteChange?: () => void): () => void {
    if (onRemoteChange && !this.subscribers.includes(onRemoteChange)) {
      this.subscribers.push(onRemoteChange);
    }

    if (!this.unsubscribeCloudListener) {
      this.unsubscribeCloudListener = CentralDataService.subscribeToOrganizationUpdates(
        DEFAULT_ORG_ID,
        () => {
          if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
          }
          this.syncDebounceTimer = setTimeout(() => {
            this.subscribers.forEach(cb => {
              try {
                cb();
              } catch (e) {
                console.warn('Sync callback error:', e);
              }
            });
          }, 800);
        }
      );
    }

    return () => {
      if (onRemoteChange) {
        this.subscribers = this.subscribers.filter(cb => cb !== onRemoteChange);
      }
    };
  }

  /**
   * Synchronizes the latest data from the central Firestore cloud database.
   * Caches into local storage for fast zero-latency rendering.
   * Deduplicates concurrent calls so all callers await the true cloud result.
   */
  static async syncFromCloud(): Promise<{
    records: SalesRecord[];
    batches: ImportBatch[];
    settings: AppSettings;
    dailyReports: DailyReportData[];
    purchasingRecords: DailyPurchasingRecord[];
  }> {
    if (this.activeSyncPromise) {
      return await this.activeSyncPromise;
    }

    this.activeSyncPromise = (async () => {
      try {
        const cloudData = await CentralDataService.loadOrganizationData(DEFAULT_ORG_ID);

        // Always prioritize central cloud database
        if (cloudData.batches.length > 0 || cloudData.records.length > 0) {
          this.saveRecords(cloudData.records);
          this.saveBatches(cloudData.batches);
        } else {
          // If cloud has no records yet, keep local records if any exist
          const localRecords = this.getStoredRecords();
          const localBatches = this.getBatches();
          if (localRecords.length > 0 && cloudData.records.length === 0) {
            cloudData.records = localRecords;
            cloudData.batches = localBatches;
          }
        }

        if (cloudData.dailyReports.length > 0) {
          localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(cloudData.dailyReports));
        }
        if (cloudData.purchasingRecords.length > 0) {
          localStorage.setItem(STORAGE_KEYS.PURCHASING, JSON.stringify(cloudData.purchasingRecords));
        }
        if (cloudData.settings) {
          this.saveSettings(cloudData.settings);
        }

        return {
          records: cloudData.records,
          batches: cloudData.batches,
          settings: cloudData.settings || this.getSettings(),
          dailyReports: cloudData.dailyReports,
          purchasingRecords: cloudData.purchasingRecords
        };
      } catch (e) {
        console.warn('Using local cache for Splus Enterprises data:', e);
        return {
          records: this.getStoredRecords(),
          batches: this.getBatches(),
          settings: this.getSettings(),
          dailyReports: this.getDailyReports(),
          purchasingRecords: this.getPurchasingRecords()
        };
      } finally {
        this.activeSyncPromise = null;
      }
    })();

    return await this.activeSyncPromise;
  }

  static initialize() {
    try {
      this.purgeDemoData();

      const settings = this.getSettings();
      if (settings.currency === 'PKR' || !settings.currency) {
        settings.currency = 'USD';
        settings.currencySymbol = '$';
        settings.companyName = 'Splus Enterprises';
        settings.targets = DEFAULT_SETTINGS.targets;
        this.saveSettings(settings);
      }

      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      localStorage.setItem('splus_phase', 'testing_clean');
    } catch (e) {
      console.warn('Storage init notice:', e);
    }
  }

  static purgeDemoData(): { remainingRecords: SalesRecord[]; remainingBatches: ImportBatch[] } {
    try {
      const existing = this.getStoredRecords();
      const nonDemoRecords = existing.filter(
        r => r.importBatchId !== 'batch_demo_initial' && !r.id.startsWith('demo_') && !r.importBatchId?.toLowerCase().includes('demo') && !r.id.toLowerCase().includes('demo')
      );
      if (nonDemoRecords.length !== existing.length) {
        this.saveRecords(nonDemoRecords);
      }

      const existingBatches = this.getImportBatches();
      const nonDemoBatches = existingBatches.filter(
        b => b.id !== 'batch_demo_initial' && !b.id.startsWith('batch_demo') && !b.id.toLowerCase().includes('demo')
      );
      if (nonDemoBatches.length !== existingBatches.length) {
        this.saveBatches(nonDemoBatches);
      }

      return { remainingRecords: nonDemoRecords, remainingBatches: nonDemoBatches };
    } catch (e) {
      console.error('Failed to purge demo data', e);
      return { remainingRecords: [], remainingBatches: [] };
    }
  }

  static initializeSampleDataIfEmpty() {
    this.initialize();
  }

  static getStoredRecords(): SalesRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse records from storage', e);
    }
    return [];
  }

  static saveRecords(records: SalesRecord[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save records', e);
    }
  }

  /**
   * Persists newly imported sales records and import batch to both
   * the local cache and the central Firestore cloud database.
   */
  static async addRecords(
    newRecords: SalesRecord[],
    batch: ImportBatch,
    userEmailOrName?: string
  ): Promise<SalesRecord[]> {
    const existing = this.getStoredRecords();
    const taggedRecords = newRecords.map(r => ({
      ...r,
      organizationId: DEFAULT_ORG_ID
    }));
    const updated = [...existing, ...taggedRecords];
    this.saveRecords(updated);

    const taggedBatch: ImportBatch = {
      ...batch,
      organizationId: DEFAULT_ORG_ID,
      importedBy: userEmailOrName || batch.importedBy || 'Authorized Team Member'
    };
    const batches = this.getImportBatches();
    this.saveBatches([taggedBatch, ...batches]);

    // Persist to centralized cloud Firestore
    try {
      await CentralDataService.saveBatchAndRecords(taggedRecords, taggedBatch, userEmailOrName, DEFAULT_ORG_ID);
      console.info('⚡ [Splus Enterprise] Batch persisted to central Firestore database.');
    } catch (err) {
      console.error('Cloud persistence warning:', err);
    }

    return updated;
  }

  static getImportBatches(): ImportBatch[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BATCHES);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read batches', e);
    }
    return [];
  }

  static getBatches(): ImportBatch[] {
    return this.getImportBatches();
  }

  static saveBatches(batches: ImportBatch[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches));
    } catch (e) {
      console.error('Failed to save batches', e);
    }
  }

  static saveBatch(batch: ImportBatch) {
    this.saveBatches([batch, ...this.getImportBatches()]);
  }

  static appendRecords(newRecords: SalesRecord[]): SalesRecord[] {
    const existing = this.getStoredRecords();
    const updated = [...existing, ...newRecords];
    this.saveRecords(updated);
    return updated;
  }

  /**
   * Deletes a batch from local cache and removes it and its record chunks
   * from the central Firestore cloud database.
   */
  static deleteBatch(batchId: string): { remainingRecords: SalesRecord[]; remainingBatches: ImportBatch[] } {
    const records = this.getStoredRecords().filter(r => r.importBatchId !== batchId);
    this.saveRecords(records);

    const batches = this.getImportBatches().filter(b => b.id !== batchId);
    this.saveBatches(batches);

    // Async delete from central Firestore cloud database
    CentralDataService.deleteBatch(batchId, DEFAULT_ORG_ID).catch(err =>
      console.error('Background cloud batch deletion error:', err)
    );

    return { remainingRecords: records, remainingBatches: batches };
  }

  static getSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.currency === 'PKR' || !parsed.currency) {
          parsed.currency = 'USD';
          parsed.currencySymbol = '$';
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error('Failed to read settings', e);
    }
    return DEFAULT_SETTINGS;
  }

  static saveSettings(settings: AppSettings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      CentralDataService.saveSettings(settings, DEFAULT_ORG_ID).catch(err =>
        console.error('Cloud settings save error:', err)
      );
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  static getSavedTemplates(): MappingTemplate[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read templates', e);
    }
    return [];
  }

  static getMappingTemplates(): MappingTemplate[] {
    return this.getSavedTemplates();
  }

  static saveTemplate(template: MappingTemplate) {
    try {
      const templates = this.getSavedTemplates().filter(t => t.id !== template.id);
      templates.unshift(template);
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates.slice(0, 10)));
    } catch (e) {
      console.error('Failed to save template', e);
    }
  }

  static getPurchasingRecords(): DailyPurchasingRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PURCHASING);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read purchasing records', e);
    }
    return [];
  }

  static savePurchasingRecord(rec: DailyPurchasingRecord) {
    try {
      const all = this.getPurchasingRecords().filter(p => p.date !== rec.date);
      all.push(rec);
      localStorage.setItem(STORAGE_KEYS.PURCHASING, JSON.stringify(all));

      CentralDataService.savePurchasingRecord(rec, DEFAULT_ORG_ID).catch(err =>
        console.error('Cloud purchasing save error:', err)
      );
    } catch (e) {
      console.error('Failed to save purchasing record', e);
    }
  }

  static getPurchasingForDate(date: string): number {
    const records = this.getPurchasingRecords();
    const found = records.find(r => r.date === date);
    return found ? found.purchasingAmount : 0;
  }

  static getDailyReports(): DailyReportData[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DAILY_REPORTS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read daily reports', e);
    }
    return [];
  }

  static saveDailyReport(report: DailyReportData) {
    try {
      const all = this.getDailyReports().filter(r => r.date !== report.date);
      all.unshift(report);
      localStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(all.slice(0, 60)));
      if (report.totalPurchasingAmount > 0) {
        this.savePurchasingRecord({
          date: report.date,
          purchasingAmount: report.totalPurchasingAmount
        });
      }
      CentralDataService.saveDailyReport(report, DEFAULT_ORG_ID).catch(err =>
        console.error('Cloud daily report save error:', err)
      );
    } catch (e) {
      console.error('Failed to save daily report', e);
    }
  }

  static getDailyReportForDate(date: string): DailyReportData | null {
    const all = this.getDailyReports();
    return all.find(r => r.date === date) || null;
  }

  /**
   * Clears data locally and purges central organization data in cloud
   */
  static async clearAllData(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.RECORDS);
      localStorage.removeItem(STORAGE_KEYS.BATCHES);
      localStorage.removeItem(STORAGE_KEYS.PURCHASING);
      localStorage.removeItem(STORAGE_KEYS.DAILY_REPORTS);

      await CentralDataService.clearAllOrganizationData(DEFAULT_ORG_ID);
    } catch (e) {
      console.error('Failed to clear data', e);
    }
  }
}
