/**
 * Real-time cloud sync engine for HuntFlow Pro users.
 *
 * Uses a dual-channel strategy to keep devices in sync:
 *   - **Subscription**: Convex `onUpdate` for near-instant pushes (~200ms).
 *   - **Polling**: A 10-second interval that actively queries the latest
 *     snapshot, guaranteeing eventual consistency even when the WebSocket
 *     drops, the browser throttles background tabs, or the Convex client
 *     caches stale results.
 *
 * Local edits are pushed to Convex after each store flush (debounced 1.5s)
 * so the round-trip feels snappy without hammering the backend on rapid typing.
 *
 * Lifecycle:
 *   1. Root layout calls `startRealtimeSync()` when a Pro user is detected.
 *   2. The engine opens a Convex `onUpdate` subscription and wires
 *      `onFlush` callbacks into every persisted store.
 *   3. `stopRealtimeSync()` tears down the subscription and callbacks.
 */
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { cloudApi, cloudConfigured, getConvexClient } from './convex';
import {
  applyLocalSnapshot,
  getLocalItems,
  mergeItems,
  normalizeRemoteItem,
  toSyncItem,
  uploadPendingEvidenceFiles,
  type SyncCollection,
  type SyncItem
} from './sync';
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
  /** Whether the real-time engine is currently connected. */
  active: boolean;
  /** Timestamp of the last successful Convex round-trip (push or pull). */
  lastSyncAt: number | null;
  /** Human-readable status label for the settings UI. */
  statusLabel: string;
  /** Number of push operations completed this session. */
  pushCount: number;
  /** Number of pull operations completed this session. */
  pullCount: number;
}

const initialState: RealtimeSyncState = {
  active: false,
  lastSyncAt: null,
  statusLabel: 'Idle',
  pushCount: 0,
  pullCount: 0
};

export const realtimeSyncStore = writable<RealtimeSyncState>(initialState);

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let unsubscribeConvex: (() => void) | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushPending = false;
let polling = false;
const PUSH_DEBOUNCE_MS = 1500;
const POLL_INTERVAL_MS = 10_000; // 10 seconds
const LAST_SYNC_KEY = 'huntflow-cloud-last-sync-at';

// Map collection names → their persisted stores so the onFlush hook can
// determine which collection changed and push only the delta.
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

// ---------------------------------------------------------------------------
// Push: debounced full-snapshot push to Convex after local edits
// ---------------------------------------------------------------------------

async function pushToConvex(): Promise<void> {
  pushPending = false;
  const convex = getConvexClient();
  if (!convex) return;

  try {
    realtimeSyncStore.update((s) => ({ ...s, statusLabel: 'Pushing…' }));

    // Upload any pending evidence files before the data push so storageIds
    // are current in the snapshot.
    await uploadPendingEvidenceFiles();

    const localItems = await getLocalItems();
    await convex.mutation(cloudApi.upsertSnapshot, {
      items: localItems.map(({ collection, localId, payload, updatedAt }) => ({
        collection,
        localId,
        payload,
        updatedAt
      }))
    });

    const now = Date.now();
    localStorage.setItem(LAST_SYNC_KEY, String(now));
    realtimeSyncStore.update((s) => ({
      ...s,
      lastSyncAt: now,
      statusLabel: 'Synced',
      pushCount: s.pushCount + 1
    }));
  } catch (err) {
    console.error('[realtimeSync] push failed:', err);
    realtimeSyncStore.update((s) => ({ ...s, statusLabel: 'Push error' }));
  }
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushPending = true;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushToConvex();
  }, PUSH_DEBOUNCE_MS);
}

// The onFlush callback installed into every persisted store.
function handleStoreFlush(_dirtyIds: string[], _deletedIds: string[]): void {
  schedulePush();
}

// ---------------------------------------------------------------------------
// Pull: process incoming Convex snapshot update
// ---------------------------------------------------------------------------

async function handleRemoteUpdate(rawRemote: unknown): Promise<void> {
  if (!Array.isArray(rawRemote)) return;

  const remoteItems = rawRemote
    .map(normalizeRemoteItem)
    .filter((item): item is SyncItem => Boolean(item));

  if (remoteItems.length === 0) return;

  const localItems = await getLocalItems();
  const merged = mergeItems(localItems, remoteItems);

  // applyLocalSnapshot writes to IndexedDB then calls store.refresh()
  // which re-reads via load(). The load() path sets the store value
  // directly (source.set) without going through put/putBatch, so no
  // dirtyIds are added, no scheduleSave fires, and onFlush never
  // triggers — there is no circular push-back to worry about.
  await applyLocalSnapshot(merged);

  const now = Date.now();
  localStorage.setItem(LAST_SYNC_KEY, String(now));
  realtimeSyncStore.update((s) => ({
    ...s,
    lastSyncAt: now,
    statusLabel: 'Synced',
    pullCount: s.pullCount + 1
  }));
}

// ---------------------------------------------------------------------------
// Polling: 10-second interval to guarantee cross-device sync
// ---------------------------------------------------------------------------

/**
 * Bidirectional sync cycle that runs every 10 seconds.
 *
 * 1. Pull the remote snapshot from Convex.
 * 2. Read all local items from IndexedDB.
 * 3. Merge (last-writer-wins by `updatedAt`).
 * 4. Apply the merged set locally (IndexedDB + Svelte stores).
 * 5. Push the merged set back to Convex so other devices converge.
 *
 * This guarantees that within ≤10 seconds, every device has the same
 * data — regardless of whether the Convex subscription fired or the
 * event-driven push succeeded.
 */
async function pollRemote(): Promise<void> {
  if (polling) return; // guard against overlapping cycles
  const convex = getConvexClient();
  if (!convex) return;

  polling = true;
  try {
    realtimeSyncStore.update((s) => ({ ...s, statusLabel: 'Syncing…' }));

    // Upload any pending evidence files so storageIds are current.
    await uploadPendingEvidenceFiles();

    // Pull remote + read local in parallel.
    const [localItems, rawRemote] = await Promise.all([
      getLocalItems(),
      convex.query(cloudApi.getSnapshot, {})
    ]);

    const remoteItems = Array.isArray(rawRemote)
      ? rawRemote.map(normalizeRemoteItem).filter((item): item is SyncItem => Boolean(item))
      : [];

    const merged = mergeItems(localItems, remoteItems);

    // Apply merged snapshot locally (updates IndexedDB + Svelte stores).
    // This goes through store.refresh() → source.set(), which does NOT
    // trigger onFlush, so no circular push-back occurs.
    await applyLocalSnapshot(merged);

    // Push merged snapshot back to Convex so other devices get our changes.
    await convex.mutation(cloudApi.upsertSnapshot, {
      items: merged.map(({ collection, localId, payload, updatedAt }) => ({
        collection,
        localId,
        payload,
        updatedAt
      }))
    });

    const now = Date.now();
    localStorage.setItem(LAST_SYNC_KEY, String(now));
    realtimeSyncStore.update((s) => ({
      ...s,
      lastSyncAt: now,
      statusLabel: 'Synced',
      pullCount: s.pullCount + 1,
      pushCount: s.pushCount + 1
    }));
  } catch (err) {
    console.error('[realtimeSync] sync cycle failed:', err);
    realtimeSyncStore.update((s) => ({ ...s, statusLabel: 'Sync error' }));
  } finally {
    polling = false;
  }
}

function startPolling(): void {
  stopPolling();
  // Poll immediately on start to catch anything missed while offline/sleeping.
  void pollRemote();
  pollInterval = setInterval(() => {
    void pollRemote();
  }, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

/**
 * When the user returns to the tab, poll immediately so stale data from
 * a background-throttled tab is refreshed without waiting the full 10s.
 */
function handleVisibilityForSync(): void {
  if (document.visibilityState === 'visible' && unsubscribeConvex) {
    void pollRemote();
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startRealtimeSync(): void {
  if (!browser || !cloudConfigured) return;
  if (unsubscribeConvex) return; // already running

  const convex = getConvexClient();
  if (!convex) return;

  // Wire onFlush into every store.
  for (const entry of allStores()) {
    entry.store.setOnFlush(handleStoreFlush);
  }

  // Subscribe to Convex live query (near-instant channel).
  unsubscribeConvex = convex.onUpdate(
    cloudApi.getSnapshot,
    {},
    (result) => {
      void handleRemoteUpdate(result);
    }
  );

  // Start 10-second polling (guaranteed-consistency channel).
  startPolling();

  // Poll immediately when the tab regains focus after being backgrounded.
  document.addEventListener('visibilitychange', handleVisibilityForSync);

  const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY)) || null;
  realtimeSyncStore.set({
    active: true,
    lastSyncAt: lastSync,
    statusLabel: 'Connected',
    pushCount: 0,
    pullCount: 0
  });

  // Do an initial push so any offline edits land immediately.
  schedulePush();

  console.debug('[realtimeSync] started (subscription + 10s polling)');
}

export function stopRealtimeSync(): void {
  // Tear down the polling channel.
  stopPolling();
  document.removeEventListener('visibilitychange', handleVisibilityForSync);

  if (unsubscribeConvex) {
    unsubscribeConvex();
    unsubscribeConvex = null;
  }

  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }

  // If there's a pending push, flush it synchronously-ish.
  if (pushPending) {
    void pushToConvex();
  }

  // Remove onFlush callbacks.
  for (const entry of allStores()) {
    entry.store.setOnFlush(undefined);
  }

  realtimeSyncStore.set(initialState);
  console.debug('[realtimeSync] stopped');
}
