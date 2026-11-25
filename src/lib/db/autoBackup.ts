/**
 * Data-safety services:
 *
 * 1. Persistent storage — asks the browser not to evict HuntFlow's
 *    IndexedDB under storage pressure.
 * 2. Disk backups — when served by `npx huntflow`, mirrors full backups to
 *    ~/.huntflow/backups via the CLI's localhost-only API (bin/local-api.mjs).
 * 3. Emergency download — one click to save a full backup file, used by the
 *    storage warning banner.
 */
import { browser } from '$app/environment';
import { collectBackupPayload, totalsFromPayload } from '$lib/db/backupBundle';
import {
  bookmarkStore,
  checklistInstanceStore,
  evidenceAssetStore,
  noteStore,
  payloadStore,
  payoutStore,
  reconAssetStore,
  sessionStore,
  settingsStore,
  submissionStore,
  targetStore
} from '$lib/stores';
import { makePlainBackup, type PlainBackup } from '$lib/utils/cryptoBackup';
import { get, writable, type Readable } from 'svelte/store';

const API = '/api/huntflow';
const CLIENT_HEADERS = { 'X-HuntFlow-Client': '1' };
const FINGERPRINT_KEY = 'huntflow-disk-backup-fingerprint';
const MIN_INTERVAL_MS = 5 * 60_000;
const CHECK_INTERVAL_MS = 2 * 60_000;

export interface DiskBackupState {
  /** True when the page is served by the HuntFlow CLI with backups on. */
  available: boolean;
  checked: boolean;
  dir?: string | null;
  count: number;
  keep?: number;
  latestAt?: number | null;
  saving: boolean;
  error?: string;
}

export interface LocalBackupEntry {
  name: string;
  size: number;
  createdAt: number;
}

const diskBackupSource = writable<DiskBackupState>({ available: false, checked: false, count: 0, saving: false });
export const diskBackupState: Readable<DiskBackupState> = diskBackupSource;

export type PersistenceState = 'unsupported' | 'persisted' | 'best-effort' | 'unknown';
const persistenceSource = writable<PersistenceState>('unknown');
export const storagePersistence: Readable<PersistenceState> = persistenceSource;

// ─── Backup bundle ────────────────────────────────────────────────────────

export async function buildPlainBackup(): Promise<{ bundle: PlainBackup; totals: Record<string, number> }> {
  const payload = await collectBackupPayload();
  const totals = totalsFromPayload(payload);
  const bundle = makePlainBackup(payload, { exportedAt: Date.now(), appVersion: '1.0.0', totals });
  return { bundle, totals };
}

/** Save a full, unencrypted backup file through the browser's downloads. */
export async function downloadBackupNow(): Promise<Record<string, number>> {
  const { bundle, totals } = await buildPlainBackup();
  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `huntflow-backup-${new Date().toISOString().slice(0, 10)}.huntflow.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  try {
    await settingsStore.update((settings) => ({ ...settings, lastExportAt: Date.now() }));
  } catch {
    /* storage may be the very thing that's failing */
  }
  return totals;
}

// ─── Persistent storage ───────────────────────────────────────────────────

export async function refreshPersistence(): Promise<PersistenceState> {
  if (!browser || !navigator.storage?.persisted) {
    persistenceSource.set('unsupported');
    return 'unsupported';
  }
  const persisted = await navigator.storage.persisted().catch(() => false);
  const state: PersistenceState = persisted ? 'persisted' : 'best-effort';
  persistenceSource.set(state);
  return state;
}

/**
 * Ask the browser to keep HuntFlow's data even under storage pressure.
 * Chromium grants silently for engaged sites/installed PWAs; Firefox may
 * show a prompt, so callers should invoke this once there is real data.
 */
export async function requestPersistentStorage(): Promise<PersistenceState> {
  if (!browser || !navigator.storage?.persist) {
    persistenceSource.set('unsupported');
    return 'unsupported';
  }
  const current = await refreshPersistence();
  if (current === 'persisted') return current;
  const granted = await navigator.storage.persist().catch(() => false);
  const state: PersistenceState = granted ? 'persisted' : 'best-effort';
  persistenceSource.set(state);
  return state;
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!browser || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

// ─── Disk backups via the CLI ─────────────────────────────────────────────

async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...CLIENT_HEADERS, ...(init.headers ?? {}) },
      cache: 'no-store'
    });
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) return null;
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (init.method === 'POST') throw error;
    return null;
  }
}

/** True when this page was served by the `npx huntflow` CLI. */
export function isServedByCli(): boolean {
  return browser && Boolean(document.querySelector('meta[name="huntflow-local"]'));
}

export async function refreshDiskBackupStatus(): Promise<DiskBackupState> {
  if (!isServedByCli()) {
    const next: DiskBackupState = { ...get(diskBackupSource), checked: true, available: false };
    diskBackupSource.set(next);
    return next;
  }
  const status = await api<{
    app: string;
    backups: { enabled: boolean; dir: string | null; count: number; keep: number; latestAt: number | null };
  }>('/status');
  const next: DiskBackupState = {
    ...get(diskBackupSource),
    checked: true,
    available: Boolean(status?.app === 'huntflow' && status.backups?.enabled),
    dir: status?.backups?.dir,
    count: status?.backups?.count ?? 0,
    keep: status?.backups?.keep,
    latestAt: status?.backups?.latestAt ?? null
  };
  diskBackupSource.set(next);
  return next;
}

export async function listDiskBackups(): Promise<LocalBackupEntry[]> {
  return (await api<LocalBackupEntry[]>('/backups')) ?? [];
}

export async function fetchDiskBackup(name: string): Promise<unknown> {
  return api<unknown>(`/backups/${encodeURIComponent(name)}`);
}

export async function saveDiskBackupNow(): Promise<void> {
  diskBackupSource.update((state) => ({ ...state, saving: true, error: undefined }));
  try {
    const { bundle } = await buildPlainBackup();
    await api('/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle)
    });
    try {
      localStorage.setItem(FINGERPRINT_KEY, JSON.stringify({ fingerprint: workspaceFingerprint(), at: Date.now() }));
    } catch {
      /* ignore */
    }
    await refreshDiskBackupStatus();
  } catch (error) {
    diskBackupSource.update((state) => ({
      ...state,
      error: error instanceof Error ? error.message : 'Backup failed'
    }));
    throw error;
  } finally {
    diskBackupSource.update((state) => ({ ...state, saving: false }));
  }
}

/** Cheap change detector over the in-memory stores (no blob reads). */
export function workspaceFingerprint(): string {
  // Sessions have no updatedAt, so fall back to their end/start times.
  type Stamped = { updatedAt?: number; endedAt?: number; startedAt?: number };
  const stores = [
    targetStore,
    reconAssetStore,
    sessionStore,
    noteStore,
    submissionStore,
    payoutStore,
    evidenceAssetStore,
    checklistInstanceStore,
    payloadStore,
    bookmarkStore
  ] as unknown as Array<Readable<Stamped[]>>;
  return stores
    .map((store) => {
      const items = get(store);
      const latest = items.reduce(
        (max, item) => Math.max(max, item.updatedAt ?? item.endedAt ?? item.startedAt ?? 0),
        0
      );
      return `${items.length}:${latest}`;
    })
    .join('|');
}

function lastDiskBackup(): { fingerprint: string; at: number } | null {
  try {
    return JSON.parse(localStorage.getItem(FINGERPRINT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

async function maybeBackUp(): Promise<void> {
  const state = get(diskBackupSource);
  if (!state.available || state.saving) return;
  const fingerprint = workspaceFingerprint();
  if (fingerprint.split('|').every((part) => part.startsWith('0:'))) return; // empty workspace
  const previous = lastDiskBackup();
  if (previous?.fingerprint === fingerprint) return;
  if (previous && Date.now() - previous.at < MIN_INTERVAL_MS) return;
  await saveDiskBackupNow().catch(() => undefined);
}

let started = false;

/**
 * Start background data-safety services. Safe to call more than once;
 * returns a cleanup function.
 */
export function startDataSafety(): () => void {
  if (!browser || started) return () => undefined;
  started = true;

  const timers: Array<ReturnType<typeof setInterval>> = [];
  const onHidden = () => {
    if (document.visibilityState === 'hidden') void maybeBackUp();
  };

  void (async () => {
    await Promise.all([
      targetStore.load(),
      reconAssetStore.load(),
      sessionStore.load(),
      noteStore.load(),
      submissionStore.load(),
      payoutStore.load()
    ]).catch(() => undefined);

    const hasData = get(targetStore).length + get(noteStore).length + get(submissionStore).length > 0;
    if (hasData) void requestPersistentStorage();
    else void refreshPersistence();

    const status = await refreshDiskBackupStatus();
    if (!status.available) return;
    // First backup shortly after start, then whenever data changes.
    timers.push(setTimeout(() => void maybeBackUp(), 15_000) as unknown as ReturnType<typeof setInterval>);
    timers.push(setInterval(() => void maybeBackUp(), CHECK_INTERVAL_MS));
    document.addEventListener('visibilitychange', onHidden);
  })();

  return () => {
    for (const timer of timers) clearInterval(timer);
    document.removeEventListener('visibilitychange', onHidden);
    started = false;
  };
}
