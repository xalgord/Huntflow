import { openDB, type IDBPDatabase } from 'idb';
import type { AppSettings, HuntFlowDB, Note, NoteTemplate, Payout, Session, Target } from './schema';

export const DB_NAME = 'huntflow';
export const DB_VERSION = 2;

interface MemoryHuntFlowDB {
  sessions: Map<string, Session>;
  notes: Map<string, Note>;
  targets: Map<string, Target>;
  payouts: Map<string, Payout>;
  templates: Map<string, NoteTemplate>;
  settings: Map<string, AppSettings>;
}

const memoryDB: MemoryHuntFlowDB = {
  sessions: new Map(),
  notes: new Map(),
  targets: new Map(),
  payouts: new Map(),
  templates: new Map(),
  settings: new Map()
};

let dbPromise: Promise<IDBPDatabase<HuntFlowDB>> | null = null;
let memoryFallback = false;
let fallbackReason: unknown;

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

  if (!db.objectStoreNames.contains('templates')) {
    const store = db.createObjectStore('templates', { keyPath: 'id' });
    store.createIndex('by-category', 'category', { unique: false });
  }

  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }
}

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
      upgrade(db) {
        createStores(db);
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
  memoryDB.templates.clear();
  memoryDB.settings.clear();
}
