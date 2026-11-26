/**
 * Cloud sync engine for HuntFlow Pro users (Cloudflare backend).
 *
 * Pull — a change feed. The server keeps a per-user change counter and
 * the device keeps a cursor; each poll asks "what changed after my
 * cursor?" and gets back only those records, page by page. Polls run
 * while the tab is visible on an adaptive cadence (5s after activity,
 * easing off to 30s when nothing changes), and immediately when the
 * tab regains focus or the network comes back.
 *
 * Push — deltas. Local edits are pushed 1.5s after the stores flush.
 * The engine remembers a signature for every record the cloud already
 * has, so a push only carries records that actually changed. Records
 * go in bounded chunks so large workspaces never hit request limits.
 *
 * Both directions use the same last-writer-wins rule as the server
 * (`deletedAt ?? updatedAt`), so every device converges.
 *
 * Lifecycle: the root layout calls `startRealtimeSync()` once the user
 * is signed in, Pro, and the API has accepted their token; it calls
 * `stopRealtimeSync()` when any of those stop being true.
 */
import { browser } from '$app/environment';
import { get as storeGet, writable } from 'svelte/store';
import { CloudApiError, cloudConfigured, fetchSyncChanges, pushSyncItems } from './api';
import { authStore, refreshProEntitlement } from './firebase';
import {
  applyLocalSnapshot,
  getLocalItems,
  normalizeRemoteItem,
  purgeStaleTombstones,
  saveTombstone,
  uploadPendingEvidenceFiles,
  type SyncCollection,
  type SyncItem
} from './sync';
import {
  chunkWireItems,
  cursorAfterOwnPush,
  cursorSeq,
  isValidCursor,
  itemKey,
  planPush,
  remoteWinners,
  signatureOf
} from './syncDelta';
import {
  bookmarkStore,
  checklistInstanceStore,
  checklistTemplateStore,
  evidenceAssetStore,
  evidenceCanvasViewStore,
  evidenceLinkStore,
  noteStore,
  payloadStore,
  payoutStore,
  reconAssetStore,
  sessionStore,
  submissionStore,
  targetStore
} from '$lib/stores';
import type { PersistedArrayStore } from '$lib/stores/persistedArrayStore';

// ---------------------------------------------------------------------------
// Public store — UI components subscribe to this for status indicators
// ---------------------------------------------------------------------------

export interface RealtimeSyncState {
  /** Whether the sync engine is running. */
  active: boolean;
  /** Timestamp of the last successful round trip (push or pull). */
  lastSyncAt: number | null;
  /** Human-readable status label for the settings UI. */
  statusLabel: string;
  /** Number of push requests completed this session. */
  pushCount: number;
  /** Number of pulls that brought in changes this session. */
  pullCount: number;
  /** Last error message, cleared on the next success. */
  error: string;
}

const initialState: RealtimeSyncState = {
  active: false,
  lastSyncAt: null,
  statusLabel: 'Idle',
  pushCount: 0,
  pullCount: 0,
  error: ''
};

export const realtimeSyncStore = writable<RealtimeSyncState>(initialState);

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const PUSH_DEBOUNCE_MS = 1500;
const POLL_MIN_MS = 5_000;
const POLL_MAX_MS = 30_000;
const POLL_BACKOFF = 1.5;
const MAX_PAGES_PER_PULL = 50;
const LAST_SYNC_KEY = 'huntflow-cloud-last-sync-at';
const CURSOR_KEY_PREFIX = 'huntflow-sync-cursor:';

let running = false;
let activeUid = '';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollDelay = POLL_MIN_MS;
let pushPending = false;
let pullInFlight = false;

/** Signature of every record the cloud is known to hold, by `collection:id`. */
const acknowledged = new Map<string, string>();

// Serialises push/pull bodies so a debounced push can't interleave with
// a pull that is rewriting the same records.
let syncChain: Promise<unknown> = Promise.resolve();
function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = syncChain.then(fn, fn);
  syncChain = run.catch(() => undefined);
  return run;
}

function cursorKey(): string {
  return `${CURSOR_KEY_PREFIX}${activeUid}`;
}

function readCursor(): string | null {
  try {
    const value = localStorage.getItem(cursorKey());
    return isValidCursor(value) ? value : null;
  } catch {
    return null;
  }
}

function writeCursor(cursor: string): void {
  try {
    localStorage.setItem(cursorKey(), cursor);
  } catch {
    // Storage full or blocked: we simply re-pull from the old cursor.
  }
}

function markSynced(patch: Partial<RealtimeSyncState> = {}): void {
  const now = Date.now();
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(now));
  } catch {
    // ignore
  }
  realtimeSyncStore.update((state) => ({ ...state, lastSyncAt: now, statusLabel: 'Synced', error: '', ...patch }));
}

function reportError(label: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Cloud sync failed.';
  console.error(`[realtimeSync] ${label}:`, error);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  realtimeSyncStore.update((state) => ({
    ...state,
    statusLabel: offline ? 'Offline' : label,
    error: offline ? 'You are offline. Changes will sync when you reconnect.' : message
  }));
  if (error instanceof CloudApiError && error.status === 402) {
    // Subscription lapsed: refresh so the layout's gate stops the engine.
    void refreshProEntitlement();
  }
}

// Map collection names → their persisted stores so the onFlush hook can
// record deletions and schedule a push.
type StoreEntry = { collection: SyncCollection; store: PersistedArrayStore<{ id: string }> };

function allStores(): StoreEntry[] {
  return [
    { collection: 'sessions', store: sessionStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'notes', store: noteStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'targets', store: targetStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'payouts', store: payoutStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'evidenceAssets', store: evidenceAssetStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'evidenceLinks', store: evidenceLinkStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'evidenceCanvasViews', store: evidenceCanvasViewStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'reconAssets', store: reconAssetStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'payloads', store: payloadStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'checklistTemplates', store: checklistTemplateStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'checklistInstances', store: checklistInstanceStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'submissions', store: submissionStore as unknown as PersistedArrayStore<{ id: string }> },
    { collection: 'bookmarks', store: bookmarkStore as unknown as PersistedArrayStore<{ id: string }> }
  ];
}

function makeFlushHandler(collection: SyncCollection) {
  return (_dirtyIds: string[], deletedIds: string[]): void => {
    for (const id of deletedIds) saveTombstone(collection, id);
    schedulePush();
  };
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function pushChanges(options: { retryErrors?: boolean } = {}): Promise<void> {
  // Re-check the entitlement only when the cache still says Pro; a
  // just-cancelled subscription must not keep pushing.
  if (storeGet(authStore).isPro) await refreshProEntitlement();
  if (!storeGet(authStore).isPro) return;

  await uploadPendingEvidenceFiles(options);

  const localItems = await getLocalItems();
  const plan = planPush(localItems, acknowledged);
  if (plan.oversized.length > 0) {
    console.warn('[realtimeSync] records over the 1.8 MB sync limit were skipped:', plan.oversized);
  }
  if (plan.wire.length === 0) return;

  realtimeSyncStore.update((state) => ({ ...state, statusLabel: 'Syncing…' }));
  for (const chunk of chunkWireItems(plan.wire)) {
    const result = await pushSyncItems(chunk);
    for (const item of chunk) {
      const key = itemKey(item);
      const signature = plan.signatures.get(key);
      if (signature) acknowledged.set(key, signature);
    }
    // If nobody else wrote since our cursor and every record landed, the
    // rows stamped with this seq are exactly ours: skip pulling them back.
    if (cursorSeq(readCursor()) === result.prevSeq && result.changed === chunk.length && result.invalid === 0) {
      writeCursor(cursorAfterOwnPush(result.seq));
    }
    realtimeSyncStore.update((state) => ({ ...state, pushCount: state.pushCount + 1 }));
  }
  markSynced();
  // Local activity: keep polling briskly for a while.
  pollDelay = POLL_MIN_MS;
}

async function runPush(options: { retryErrors?: boolean } = {}): Promise<void> {
  pushPending = false;
  if (!running) return;
  await withSyncLock(async () => {
    try {
      await pushChanges(options);
    } catch (error) {
      reportError('Push error', error);
    }
  });
}

function schedulePush(): void {
  if (!running) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushPending = true;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void runPush();
  }, PUSH_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/** Pull every page after the cursor. Returns how many records were applied. */
async function pullChanges(): Promise<number> {
  let cursor = readCursor();
  let applied = 0;

  for (let page = 0; page < MAX_PAGES_PER_PULL; page++) {
    const response = await fetchSyncChanges(cursor);
    const remote = response.items
      .map(normalizeRemoteItem)
      .filter((item): item is SyncItem => Boolean(item));

    if (remote.length > 0) {
      const local = await getLocalItems();
      const winners = remoteWinners(local, remote);
      if (winners.length > 0) await applyLocalSnapshot(winners);
      applied += winners.length;
      for (const item of remote) acknowledged.set(itemKey(item), signatureOf(item, JSON.stringify(item.payload)));
      // Local copies that beat the cloud's need to go back up.
      if (winners.length < remote.length) schedulePush();
    }

    cursor = response.cursor;
    writeCursor(cursor);
    if (!response.hasMore) break;
  }
  return applied;
}

async function runPull(reason: string): Promise<void> {
  if (!running || pullInFlight) return;
  pullInFlight = true;
  try {
    await withSyncLock(async () => {
      try {
        const applied = await pullChanges();
        if (applied > 0) {
          pollDelay = POLL_MIN_MS;
          markSynced();
          realtimeSyncStore.update((state) => ({ ...state, pullCount: state.pullCount + 1 }));
        } else {
          pollDelay = Math.min(POLL_MAX_MS, Math.round(pollDelay * POLL_BACKOFF));
          const state = storeGet(realtimeSyncStore);
          if (state.statusLabel !== 'Synced' || state.error) markSynced();
        }
      } catch (error) {
        pollDelay = POLL_MAX_MS;
        reportError('Sync error', error);
        console.debug(`[realtimeSync] pull failed (${reason})`);
      }
    });
  } finally {
    pullInFlight = false;
  }
}

function schedulePoll(delay = pollDelay): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  if (!running || document.visibilityState !== 'visible') return;
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    await runPull('poll');
    schedulePoll();
  }, delay);
}

async function pollNow(reason: string): Promise<void> {
  if (!running) return;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  pollDelay = POLL_MIN_MS;
  await runPull(reason);
  schedulePoll();
}

// ---------------------------------------------------------------------------
// Event hooks
// ---------------------------------------------------------------------------

function handleVisibility(): void {
  if (document.visibilityState === 'visible') {
    void pollNow('tab-visible');
  } else if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function handleOnline(): void {
  void pollNow('online');
  schedulePush();
}

function handleOffline(): void {
  realtimeSyncStore.update((state) => ({ ...state, statusLabel: 'Offline' }));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startRealtimeSync(): void {
  if (!browser || !cloudConfigured || running) return;
  const uid = storeGet(authStore).uid;
  if (!uid) return;

  running = true;
  if (activeUid !== uid) acknowledged.clear();
  activeUid = uid;
  pollDelay = POLL_MIN_MS;

  purgeStaleTombstones();
  for (const entry of allStores()) entry.store.setOnFlush(makeFlushHandler(entry.collection));

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  let lastSync: number | null = null;
  try {
    lastSync = Number(localStorage.getItem(LAST_SYNC_KEY)) || null;
  } catch {
    lastSync = null;
  }
  realtimeSyncStore.set({ ...initialState, active: true, lastSyncAt: lastSync, statusLabel: 'Connecting…' });

  // Pull first so a fresh device merges the cloud before uploading.
  void (async () => {
    await runPull('start');
    await runPush();
    schedulePoll();
  })();

  console.debug('[realtimeSync] started (change feed + delta push)');
}

/**
 * Full reconcile on demand ("Sync now"): re-upload everything the
 * cloud may be missing, retry failed evidence uploads, and pull.
 */
export async function syncNow(): Promise<void> {
  if (!running) return;
  acknowledged.clear();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  await runPull('manual');
  await runPush({ retryErrors: true });
  schedulePoll();
}

export function stopRealtimeSync(): void {
  if (!running) {
    realtimeSyncStore.set(initialState);
    return;
  }
  document.removeEventListener('visibilitychange', handleVisibility);
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);

  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;

  // Flush a pending push while the token is still valid.
  if (pushPending) void runPush();
  pushPending = false;
  running = false;

  for (const entry of allStores()) entry.store.setOnFlush(undefined);

  pullInFlight = false;
  realtimeSyncStore.set(initialState);
  console.debug('[realtimeSync] stopped');
}
