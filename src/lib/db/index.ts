import { openDB, type IDBPDatabase } from 'idb';
import type {
  AppSettings,
  Bookmark,
  ChecklistInstance,
  ChecklistTemplate,
  EvidenceAsset,
  EvidenceBlob,
  EvidenceCanvasView,
  EvidenceLink,
  HuntFlowDB,
  Note,
  NoteTemplate,
  Payload,
  Payout,
  ReconAsset,
  Session,
  Submission,
  Target
} from './schema';

export const DB_NAME = 'huntflow';
export const DB_VERSION = 5;

interface MemoryHuntFlowDB {
  sessions: Map<string, Session>;
  notes: Map<string, Note>;
  targets: Map<string, Target>;
  payouts: Map<string, Payout>;
  evidenceAssets: Map<string, EvidenceAsset>;
  evidenceBlobs: Map<string, EvidenceBlob>;
  evidenceLinks: Map<string, EvidenceLink>;
  evidenceCanvasViews: Map<string, EvidenceCanvasView>;
  templates: Map<string, NoteTemplate>;
  reconAssets: Map<string, ReconAsset>;
  payloads: Map<string, Payload>;
  checklistTemplates: Map<string, ChecklistTemplate>;
  checklistInstances: Map<string, ChecklistInstance>;
  submissions: Map<string, Submission>;
  bookmarks: Map<string, Bookmark>;
  settings: Map<string, AppSettings>;
}

const memoryDB: MemoryHuntFlowDB = {
  sessions: new Map(),
  notes: new Map(),
  targets: new Map(),
  payouts: new Map(),
  evidenceAssets: new Map(),
  evidenceBlobs: new Map(),
  evidenceLinks: new Map(),
  evidenceCanvasViews: new Map(),
  templates: new Map(),
  reconAssets: new Map(),
  payloads: new Map(),
  checklistTemplates: new Map(),
  checklistInstances: new Map(),
  submissions: new Map(),
  bookmarks: new Map(),
  settings: new Map()
};

let dbPromise: Promise<IDBPDatabase<HuntFlowDB>> | null = null;
let memoryFallback = false;
let fallbackReason: unknown;

/**
 * Create all object stores from scratch (new installs or major rebuild).
 */
function createStores(db: IDBPDatabase<HuntFlowDB>) {
  if (!db.objectStoreNames.contains('sessions')) {
    const store = db.createObjectStore('sessions', { keyPath: 'id' });
    store.createIndex('by-target', 'targetId', { unique: false });
    store.createIndex('by-started', 'startedAt', { unique: false });
    store.createIndex('by-status', 'status', { unique: false });
  }

  if (!db.objectStoreNames.contains('notes')) {
    const store = db.createObjectStore('notes', { keyPath: 'id' });
    store.createIndex('by-target', 'targetId', { unique: false });
    store.createIndex('by-session', 'sessionId', { unique: false });
    store.createIndex('by-template', 'templateId', { unique: false });
    store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('targets')) {
    const store = db.createObjectStore('targets', { keyPath: 'id' });
    store.createIndex('by-platform', 'platform', { unique: false });
    store.createIndex('by-status', 'status', { unique: false });
    store.createIndex('by-priority', 'priority', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('payouts')) {
    const store = db.createObjectStore('payouts', { keyPath: 'id' });
    store.createIndex('by-platform', 'platform', { unique: false });
    store.createIndex('by-severity', 'severity', { unique: false });
    store.createIndex('by-status', 'status', { unique: false });
    store.createIndex('by-date', 'date', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('evidenceAssets')) {
    const store = db.createObjectStore('evidenceAssets', { keyPath: 'id' });
    store.createIndex('by-target', 'targetId', { unique: false });
    store.createIndex('by-session', 'sessionId', { unique: false });
    store.createIndex('by-note', 'noteId', { unique: false });
    store.createIndex('by-kind', 'kind', { unique: false });
    store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
    store.createIndex('by-sync-state', 'syncState', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('evidenceBlobs')) {
    const store = db.createObjectStore('evidenceBlobs', { keyPath: 'assetId' });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('evidenceLinks')) {
    const store = db.createObjectStore('evidenceLinks', { keyPath: 'id' });
    store.createIndex('by-from', 'fromKey', { unique: false });
    store.createIndex('by-to', 'toKey', { unique: false });
    store.createIndex('by-relationship', 'relationship', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('evidenceCanvasViews')) {
    const store = db.createObjectStore('evidenceCanvasViews', { keyPath: 'id' });
    store.createIndex('by-target', 'targetId', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('templates')) {
    const store = db.createObjectStore('templates', { keyPath: 'id' });
    store.createIndex('by-category', 'category', { unique: false });
  }

  if (!db.objectStoreNames.contains('reconAssets')) {
    const store = db.createObjectStore('reconAssets', { keyPath: 'id' });
    store.createIndex('by-target', 'targetId', { unique: false });
    store.createIndex('by-status', 'status', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('payloads')) {
    const store = db.createObjectStore('payloads', { keyPath: 'id' });
    store.createIndex('by-category', 'category', { unique: false });
    store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('checklistTemplates')) {
    const store = db.createObjectStore('checklistTemplates', { keyPath: 'id' });
    store.createIndex('by-kind', 'kind', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('checklistInstances')) {
    const store = db.createObjectStore('checklistInstances', { keyPath: 'id' });
    store.createIndex('by-target', 'targetId', { unique: false });
    store.createIndex('by-template', 'templateId', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('submissions')) {
    const store = db.createObjectStore('submissions', { keyPath: 'id' });
    store.createIndex('by-target', 'targetId', { unique: false });
    store.createIndex('by-status', 'status', { unique: false });
    store.createIndex('by-platform', 'platform', { unique: false });
    store.createIndex('by-severity', 'severity', { unique: false });
    store.createIndex('by-submittedAt', 'submittedAt', { unique: false });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('bookmarks')) {
    const store = db.createObjectStore('bookmarks', { keyPath: 'id' });
    store.createIndex('by-category', 'category', { unique: false });
    store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
    store.createIndex('by-updated', 'updatedAt', { unique: false });
  }

  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }
}

/**
 * Incremental migrations are handled inline in the `upgrade` callback of
 * `openDB` below (per-step, guarded by `oldVersion < N` checks). The v4→v5
 * step adds a `by-target` index on payouts for legacy users; the `Payout`
 * type has no `targetId` field, so that index is intentionally NOT created
 * for fresh installs (see `createStores` above).
 */

export function enableMemoryFallback(reason?: unknown): void {
  if (!memoryFallback) {
    console.warn('IndexedDB failed, using memory fallback:', reason);
  }

  memoryFallback = true;
  fallbackReason = reason;
  dbPromise = null;
}

export function isMemoryFallback(): boolean {
  return memoryFallback;
}

export function getMemoryFallbackReason(): unknown {
  return fallbackReason;
}

export function getMemoryDB(): MemoryHuntFlowDB {
  return memoryDB;
}

export async function getHuntFlowDB(): Promise<IDBPDatabase<HuntFlowDB> | null> {
  if (memoryFallback) return null;

  if (typeof indexedDB === 'undefined') {
    enableMemoryFallback(new Error('IndexedDB is not available in this environment'));
    return null;
  }

  try {
    dbPromise ??= openDB<HuntFlowDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Fresh install — create everything from scratch
        if (oldVersion === 0) {
          createStores(db);
          return;
        }

        // Incremental migrations: run each step the user hasn't applied yet.
        // New stores from createStores are only created when missing, so it's
        // safe to call it on every upgrade path.
        createStores(db);

        if (oldVersion < 5) {
          // v4 → v5: add by-target index on payouts
          if (db.objectStoreNames.contains('payouts')) {
            const payoutsStore = transaction.objectStore('payouts');
            if (!payoutsStore.indexNames.contains('by-target')) {
              payoutsStore.createIndex('by-target', 'targetId', { unique: false });
            }
          }
        }
      },
      blocked() {
        console.warn('HuntFlow IndexedDB upgrade is blocked by another open tab.');
      },
      blocking() {
        console.warn('HuntFlow IndexedDB connection is blocking a newer version.');
      },
      terminated() {
        enableMemoryFallback(new Error('HuntFlow IndexedDB connection terminated'));
      }
    });

    return await dbPromise;
  } catch (error) {
    enableMemoryFallback(error);
    return null;
  }
}

export async function initDB(): Promise<IDBPDatabase<HuntFlowDB> | null> {
  return getHuntFlowDB();
}

export function resetMemoryDB(): void {
  memoryDB.sessions.clear();
  memoryDB.notes.clear();
  memoryDB.targets.clear();
  memoryDB.payouts.clear();
  memoryDB.evidenceAssets.clear();
  memoryDB.evidenceBlobs.clear();
  memoryDB.evidenceLinks.clear();
  memoryDB.evidenceCanvasViews.clear();
  memoryDB.templates.clear();
  memoryDB.reconAssets.clear();
  memoryDB.payloads.clear();
  memoryDB.checklistTemplates.clear();
  memoryDB.checklistInstances.clear();
  memoryDB.submissions.clear();
  memoryDB.bookmarks.clear();
  memoryDB.settings.clear();
}
