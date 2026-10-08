import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExhausted, markQuotaExhausted } from './firebase';
import {
  AppSettings,
  DailyPurchasingRecord,
  DailyReportData,
  ImportBatch,
  MappingTemplate,
  OrganizationData,
  SalesRecord
} from '../types';
import { DEFAULT_ORG_ID, DEFAULT_ORG_NAME } from '../constants/org';

export { DEFAULT_ORG_ID, DEFAULT_ORG_NAME };

export const DEFAULT_ORG_SETTINGS: AppSettings = {
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

const CHUNK_SIZE = 500;

export class CentralDataService {
  /**
   * Retrieves the centralized organization metadata and settings
   */
  static async getOrganizationMetadata(orgId: string = DEFAULT_ORG_ID): Promise<OrganizationData> {
    const orgRef = doc(db, 'organizations', orgId);
    try {
      const snap = await getDoc(orgRef);
      if (snap.exists()) {
        const data = snap.data() as OrganizationData;
        return {
          orgId: data.orgId || orgId,
          name: data.name || DEFAULT_ORG_NAME,
          totalRecords: data.totalRecords || 0,
          totalBatches: data.totalBatches || 0,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          lastUpdatedBy: data.lastUpdatedBy,
          settings: data.settings || DEFAULT_ORG_SETTINGS
        };
      } else {
        // Initialize central enterprise organization doc
        const initOrg: OrganizationData = {
          orgId,
          name: DEFAULT_ORG_NAME,
          totalRecords: 0,
          totalBatches: 0,
          lastUpdated: new Date().toISOString(),
          lastUpdatedBy: 'System Bootstrap',
          settings: DEFAULT_ORG_SETTINGS
        };
        await setDoc(orgRef, initOrg);
        return initOrg;
      }
    } catch (err: any) {
      console.warn('Central org metadata notice:', err);
      return {
        orgId,
        name: DEFAULT_ORG_NAME,
        totalRecords: 0,
        totalBatches: 0,
        lastUpdated: new Date().toISOString(),
        settings: DEFAULT_ORG_SETTINGS
      };
    }
  }

  /**
   * Subscribes to real-time changes in the central organization and import batches.
   * When any user in the company imports data or makes changes,
   * all connected user sessions across all PCs are notified immediately.
   */
  static subscribeToOrganizationUpdates(
    orgId: string = DEFAULT_ORG_ID,
    onUpdate: () => void
  ): () => void {
    const orgRef = doc(db, 'organizations', orgId);
    const batchesRef = collection(db, 'organizations', orgId, 'batches');

    let debounceTimer: any = null;
    const triggerDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onUpdate();
      }, 500);
    };

    const unsubOrg = onSnapshot(
      orgRef,
      () => {
        triggerDebounced();
      },
      (error) => {
        console.info('Organization snapshot notice:', error?.message || error);
      }
    );

    const unsubBatches = onSnapshot(
      batchesRef,
      () => {
        triggerDebounced();
      },
      (error) => {
        console.info('Batches snapshot notice:', error?.message || error);
      }
    );

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubOrg();
      unsubBatches();
    };
  }

  /**
   * Loads ALL shared sales records and import batches for Splus Enterprises
   * from the central Firestore cloud database.
   */
  static async loadOrganizationData(orgId: string = DEFAULT_ORG_ID): Promise<{
    records: SalesRecord[];
    batches: ImportBatch[];
    settings: AppSettings;
    dailyReports: DailyReportData[];
    purchasingRecords: DailyPurchasingRecord[];
  }> {
    try {
      const orgDoc = await this.getOrganizationMetadata(orgId);
      const settings = orgDoc.settings || DEFAULT_ORG_SETTINGS;

      // 1. Fetch all import batches
      const batchesRef = collection(db, 'organizations', orgId, 'batches');
      let batches: ImportBatch[] = [];
      try {
        const batchSnaps = await getDocs(batchesRef);
        batches = batchSnaps.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as ImportBatch[];
        // Sort newest first
        batches.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
      } catch (e: any) {
        console.warn('Could not fetch organization batches:', e?.message || e);
      }

      // 2. Fetch all record chunks
      const chunksRef = collection(db, 'organizations', orgId, 'record_chunks');
      let records: SalesRecord[] = [];
      try {
        const chunkSnaps = await getDocs(chunksRef);
        chunkSnaps.docs.forEach(docSnap => {
          const chunkData = docSnap.data();
          if (Array.isArray(chunkData.records)) {
            records.push(...chunkData.records);
          }
        });

        // Deduplicate records by unique key
        const recordMap = new Map<string, SalesRecord>();
        records.forEach(r => {
          const key = r.id || `${r.orderId || ''}_${r.sku || ''}_${r.marketplace || ''}_${r.date || ''}`;
          recordMap.set(key, r);
        });
        records = Array.from(recordMap.values());
      } catch (e: any) {
        console.warn('Could not fetch record chunks:', e?.message || e);
      }

      // 3. Fetch daily reports
      const reportsRef = collection(db, 'organizations', orgId, 'daily_reports');
      let dailyReports: DailyReportData[] = [];
      try {
        const reportSnaps = await getDocs(reportsRef);
        dailyReports = reportSnaps.docs.map(d => d.data() as DailyReportData);
      } catch (e: any) {
        console.warn('Could not fetch daily reports:', e?.message || e);
      }

      // 4. Fetch daily purchasing
      const purchasingRef = collection(db, 'organizations', orgId, 'daily_purchasing');
      let purchasingRecords: DailyPurchasingRecord[] = [];
      try {
        const purchSnaps = await getDocs(purchasingRef);
        purchasingRecords = purchSnaps.docs.map(d => d.data() as DailyPurchasingRecord);
      } catch (e: any) {
        console.warn('Could not fetch purchasing records:', e?.message || e);
      }

      return {
        records,
        batches,
        settings,
        dailyReports,
        purchasingRecords
      };
    } catch (error: any) {
      console.warn('Organization data fetch error:', error);
      return {
        records: [],
        batches: [],
        settings: DEFAULT_ORG_SETTINGS,
        dailyReports: [],
        purchasingRecords: []
      };
    }
  }

  /**
   * Persists newly imported sales records and import batch to the
   * central cloud database for Splus Enterprises.
   */
  static async saveBatchAndRecords(
    newRecords: SalesRecord[],
    batch: ImportBatch,
    userEmailOrName?: string,
    orgId: string = DEFAULT_ORG_ID
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const updater = userEmailOrName || batch.importedBy || 'Authorized Team Member';

    // 1. Tag with organizationId
    const taggedBatch: ImportBatch = {
      ...batch,
      organizationId: orgId,
      importedBy: updater
    };

    const taggedRecords: SalesRecord[] = newRecords.map(r => ({
      ...r,
      organizationId: orgId,
      importBatchId: batch.id
    }));

    try {
      // 2. Save batch document in cloud
      const batchDocRef = doc(db, 'organizations', orgId, 'batches', batch.id);
      await setDoc(batchDocRef, taggedBatch);

      // 3. Split records into chunks of CHUNK_SIZE for ultra-fast, safe storage
      const totalChunks = Math.ceil(taggedRecords.length / CHUNK_SIZE);
      const chunkPromises: Promise<void>[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkRecords = taggedRecords.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkId = `${batch.id}_chunk_${i}`;
        const chunkDocRef = doc(db, 'organizations', orgId, 'record_chunks', chunkId);
        
        const chunkPayload = {
          id: chunkId,
          organizationId: orgId,
          batchId: batch.id,
          chunkIndex: i,
          totalChunks,
          recordsCount: chunkRecords.length,
          records: chunkRecords,
          createdAt: timestamp
        };

        chunkPromises.push(setDoc(chunkDocRef, chunkPayload));
      }

      await Promise.all(chunkPromises);

      // 4. Update Organization Metadata so all connected users see the update
      const orgRef = doc(db, 'organizations', orgId);
      try {
        const currentOrg = await this.getOrganizationMetadata(orgId);
        await setDoc(
          orgRef,
          {
            orgId,
            name: DEFAULT_ORG_NAME,
            totalRecords: (currentOrg.totalRecords || 0) + taggedRecords.length,
            totalBatches: (currentOrg.totalBatches || 0) + 1,
            lastUpdated: timestamp,
            lastUpdatedBy: updater
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Could not update organization summary doc:', e);
      }
    } catch (err: any) {
      console.error('Central cloud persistence error:', err);
      throw err;
    }
  }

  /**
   * Persists live Google Sheets synchronized sales records to the central Firestore
   * database so all connected team members see the exact same shared live dataset.
   */
  static async saveLiveSalesToFirestore(
    salesRecords: SalesRecord[],
    orgId: string = DEFAULT_ORG_ID
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const batchId = 'batch_google_sheets_live';

    const dates = salesRecords.map(r => r.date).filter(Boolean).sort();
    const marketplaces = Array.from(new Set(salesRecords.map(r => r.marketplace).filter(Boolean)));
    const stores = Array.from(new Set(salesRecords.map(r => r.store).filter(Boolean)));

    const liveBatch: ImportBatch = {
      id: batchId,
      organizationId: orgId,
      fileName: 'Google Sheets Live Sync',
      sheetName: 'Live Sales Stream',
      importedAt: timestamp,
      importedBy: 'Google Sheets Live Sync',
      totalRows: salesRecords.length,
      validRows: salesRecords.length,
      duplicateRows: 0,
      invalidRows: 0,
      dateRange: {
        start: dates[0] || timestamp.split('T')[0],
        end: dates[dates.length - 1] || timestamp.split('T')[0]
      },
      marketplaces,
      stores,
      status: 'Successful'
    };

    const taggedRecords: SalesRecord[] = salesRecords.map(r => ({
      ...r,
      organizationId: orgId,
      importBatchId: batchId
    }));

    try {
      // 1. Save live batch document
      const batchDocRef = doc(db, 'organizations', orgId, 'batches', batchId);
      await setDoc(batchDocRef, liveBatch);

      // 2. Clear old live chunks if count reduced
      const chunksRef = collection(db, 'organizations', orgId, 'record_chunks');
      const existingSnaps = await getDocs(chunksRef);
      const oldLiveChunkDeletions: Promise<void>[] = [];
      existingSnaps.docs.forEach(d => {
        if (d.id.startsWith(`${batchId}_`)) {
          oldLiveChunkDeletions.push(deleteDoc(d.ref));
        }
      });
      await Promise.all(oldLiveChunkDeletions);

      // 3. Save new chunks
      const totalChunks = Math.max(1, Math.ceil(taggedRecords.length / CHUNK_SIZE));
      const chunkPromises: Promise<void>[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkRecords = taggedRecords.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkId = `${batchId}_chunk_${i}`;
        const chunkDocRef = doc(db, 'organizations', orgId, 'record_chunks', chunkId);

        const chunkPayload = {
          id: chunkId,
          organizationId: orgId,
          batchId,
          chunkIndex: i,
          totalChunks,
          recordsCount: chunkRecords.length,
          records: chunkRecords,
          createdAt: timestamp
        };

        chunkPromises.push(setDoc(chunkDocRef, chunkPayload));
      }

      await Promise.all(chunkPromises);

      // 4. Update organization summary doc to notify all listening sessions
      const orgRef = doc(db, 'organizations', orgId);
      const currentOrg = await this.getOrganizationMetadata(orgId);
      await setDoc(
        orgRef,
        {
          orgId,
          totalRecords: taggedRecords.length,
          lastUpdated: timestamp,
          lastUpdatedBy: 'Google Sheets Live Sync'
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Central live sales persistence note:', err);
    }
  }

  /**
   * Deletes an import batch and all of its record chunks from the central organization
   */
  static async deleteBatch(batchId: string, orgId: string = DEFAULT_ORG_ID): Promise<void> {
    try {
      // 1. Delete batch document
      const batchDocRef = doc(db, 'organizations', orgId, 'batches', batchId);
      await deleteDoc(batchDocRef);

      // 2. Query and delete all chunks for this batch
      const chunksRef = collection(db, 'organizations', orgId, 'record_chunks');
      const snaps = await getDocs(chunksRef);
      const deletePromises: Promise<void>[] = [];

      snaps.docs.forEach(d => {
        const data = d.data();
        if (data.batchId === batchId || d.id.startsWith(`${batchId}_`)) {
          deletePromises.push(deleteDoc(d.ref));
        }
      });

      await Promise.all(deletePromises);

      // 3. Bump organization lastUpdated timestamp
      const orgRef = doc(db, 'organizations', orgId);
      await setDoc(
        orgRef,
        {
          lastUpdated: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to delete batch from cloud:', err);
      throw err;
    }
  }

  /**
   * Persists company-wide settings to Splus Enterprises organization
   */
  static async saveSettings(settings: AppSettings, orgId: string = DEFAULT_ORG_ID): Promise<void> {
    try {
      const orgRef = doc(db, 'organizations', orgId);
      await setDoc(
        orgRef,
        {
          settings,
          lastUpdated: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to save settings to cloud:', e);
    }
  }

  /**
   * Persists daily report sheet snapshot
   */
  static async saveDailyReport(report: DailyReportData, orgId: string = DEFAULT_ORG_ID): Promise<void> {
    try {
      const reportRef = doc(db, 'organizations', orgId, 'daily_reports', report.date);
      await setDoc(reportRef, report);

      const orgRef = doc(db, 'organizations', orgId);
      await setDoc(orgRef, { lastUpdated: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error('Failed to save daily report to cloud:', e);
    }
  }

  /**
   * Persists daily purchasing record
   */
  static async savePurchasingRecord(
    rec: DailyPurchasingRecord,
    orgId: string = DEFAULT_ORG_ID
  ): Promise<void> {
    try {
      const purchRef = doc(db, 'organizations', orgId, 'daily_purchasing', rec.date);
      await setDoc(purchRef, rec);
    } catch (e) {
      console.error('Failed to save purchasing record to cloud:', e);
    }
  }

  /**
   * Completely clears all records, batches, and daily reports for Splus Enterprises (Admin action)
   */
  static async clearAllOrganizationData(orgId: string = DEFAULT_ORG_ID): Promise<void> {
    try {
      // 1. Delete all batches
      const batchesRef = collection(db, 'organizations', orgId, 'batches');
      const batchSnaps = await getDocs(batchesRef);
      const batchDeletes = batchSnaps.docs.map(d => deleteDoc(d.ref));
      await Promise.all(batchDeletes);

      // 2. Delete all record chunks
      const chunksRef = collection(db, 'organizations', orgId, 'record_chunks');
      const chunkSnaps = await getDocs(chunksRef);
      const chunkDeletes = chunkSnaps.docs.map(d => deleteDoc(d.ref));
      await Promise.all(chunkDeletes);

      // 3. Delete all daily reports
      const reportsRef = collection(db, 'organizations', orgId, 'daily_reports');
      const reportSnaps = await getDocs(reportsRef);
      const reportDeletes = reportSnaps.docs.map(d => deleteDoc(d.ref));
      await Promise.all(reportDeletes);

      // 4. Delete all purchasing records
      const purchRef = collection(db, 'organizations', orgId, 'daily_purchasing');
      const purchSnaps = await getDocs(purchRef);
      const purchDeletes = purchSnaps.docs.map(d => deleteDoc(d.ref));
      await Promise.all(purchDeletes);

      // 5. Reset organization summary doc
      const orgRef = doc(db, 'organizations', orgId);
      await setDoc(orgRef, {
        orgId,
        name: DEFAULT_ORG_NAME,
        totalRecords: 0,
        totalBatches: 0,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error('Failed to wipe organization data in cloud:', e);
      throw e;
    }
  }
}
