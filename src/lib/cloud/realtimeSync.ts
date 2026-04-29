/**
 * Real-time cloud sync engine for HuntFlow Pro users.
 *
 * Subscribes to Convex's live `getSnapshot` query so remote mutations
 * from other devices propagate here within ~200ms. Local edits are
 * pushed to Convex after each store flush (debounced 1.5s) so the
 * round-trip feels snappy without hammering the backend on rapid typing.
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
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushPending = false;
const PUSH_DEBOUNCE_MS = 1500;
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

  // Suppress the refresh → onFlush → push cycle for this remote-initiated
  // write. Each store's `refresh()` will check this flag.
  for (const entry of allStores()) {
    entry.store.suppressRemoteRefresh = true;
  }

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

  // Subscribe to Convex live query.
  unsubscribeConvex = convex.onUpdate(
    cloudApi.getSnapshot,
    {},
    (result) => {
      void handleRemoteUpdate(result);
    }
  );

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

  console.debug('[realtimeSync] started');
}

export function stopRealtimeSync(): void {
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
