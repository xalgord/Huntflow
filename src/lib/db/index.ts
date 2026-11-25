import { openDB, type IDBPDatabase } from 'idb';
import {
  classifyStorageError,
  clearStorageHealth,
  describeStorageError,
  reportStorageHealth
} from './health';
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

/**
 * Called by every DB helper when an IndexedDB operation fails.
 *
 * Policy (previously *every* error silently switched the whole app to an
 * in-memory store, so a single closed connection could make the workspace
 * look empty and quietly discard everything typed afterwards):
 *
 * - connection errors: drop the cached connection so the next call reopens
 *   it, and rethrow so the caller's write is retried instead of being
 *   parked in memory (persisted stores re-queue failed writes).
 * - quota errors: surface "storage full" and rethrow; nothing is lost from
 *   the live session, and the next flush retries.
 * - anything else: IndexedDB is unusable — switch to memory and tell the
 *   user loudly that changes are not being saved.
 */
export function enableMemoryFallback(reason?: unknown): void {
  const kind = reason === undefined ? 'fatal' : classifyStorageError(reason);

  if (kind === 'connection') {
    dbPromise = null;
    throw reason;
  }

  if (kind === 'quota') {
    reportStorageHealth('quota', describeStorageError(reason));
    throw reason;
  }

  switchToMemory(reason);
}

function switchToMemory(reason: unknown): void {
  if (!memoryFallback) {
    console.warn('IndexedDB failed, using memory fallback:', reason);
  }

  memoryFallback = true;
  fallbackReason = reason;
  dbPromise = null;
  reportStorageHealth('memory', describeStorageError(reason));
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

/** Promise-returning IDBPDatabase methods that are safe to retry once. */
const RETRYABLE_METHODS = new Set([
  'get',
  'getAll',
  'getAllKeys',
  'getKey',
  'count',
  'put',
  'add',
  'delete',
  'clear',
  'getFromIndex',
  'getAllFromIndex',
  'getAllKeysFromIndex',
  'getKeyFromIndex',
  'countFromIndex'
]);

/**
 * Wrap a connection so single-shot operations survive a dropped
 * connection: on a connection-class error the handle is reopened and the
 * call retried once. `transaction()` can't be retried synchronously, so it
 * just invalidates the cached handle for the caller's next attempt.
 */
function resilient(db: IDBPDatabase<HuntFlowDB>): IDBPDatabase<HuntFlowDB> {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      if (prop === 'transaction') {
        return (...args: unknown[]) => {
          try {
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          } catch (error) {
            if (classifyStorageError(error) === 'connection') dbPromise = null;
            throw error;
          }
        };
      }
      if (typeof prop === 'string' && RETRYABLE_METHODS.has(prop)) {
        return async (...args: unknown[]) => {
          try {
            return await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
          } catch (error) {
            if (classifyStorageError(error) !== 'connection') throw error;
            dbPromise = null;
            const fresh = await getHuntFlowDB();
            if (!fresh) throw error;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (fresh as any)[prop](...args);
          }
        };
      }
      return (value as (...a: unknown[]) => unknown).bind(target);
    }
  });
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
        // Another tab still has the previous version open. The open request
        // stays pending until it closes, so tell the user what to do.
        reportStorageHealth('blocked', 'Another HuntFlow tab is using an older version of your data.');
      },
      blocking() {
        // A newer HuntFlow in another tab wants to upgrade. Release our
        // handle so we never hold the user's data hostage, and ask this tab
        // to reload into the new version.
        void dbPromise?.then((db) => db.close()).catch(() => undefined);
        dbPromise = null;
        reportStorageHealth('version-changed', 'HuntFlow was updated in another tab.');
      },
      terminated() {
        // The browser closed the connection (storage pressure, crash
        // recovery). The data is still on disk: reconnect on next use.
        dbPromise = null;
      }
    }).then((db) => {
      clearStorageHealth('blocked');
      return resilient(db);
    });

    return await dbPromise;
  } catch (error) {
    dbPromise = null;
    // Opening failed outright: there is no connection to retry against.
    if ((error as { name?: string } | null)?.name === 'VersionError') {
      // Another tab already upgraded the schema past this build.
      reportStorageHealth('version-changed', 'HuntFlow was updated in another tab.');
    }
    switchToMemory(error);
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
