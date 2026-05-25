/**
 * Real-time cloud sync engine for HuntFlow Pro users.
 *
 * Strategy:
 *   - **Subscription** (primary): Convex `onUpdate` keeps every device
 *     converged within ~200ms whenever the WebSocket is healthy.
 *     We trust this channel and don't try to second-guess it.
 *   - **Event-driven recovery**: instead of polling on a fixed cadence,
 *     we kick a single bidirectional sync cycle whenever something
 *     plausibly broke convergence:
 *       · the user came back to the tab (`visibilitychange` → visible),
 *       · the Convex WebSocket finished reconnecting after a drop,
 *       · we just signed back in.
 *   - **Safety net** (last resort): a 60s interval that runs one cycle
 *     to catch the rare case where every event-driven trigger missed.
 *     This is a 6× reduction from the previous 10s cadence and removes
 *     the `suppressSubscription` hack that the tight loop required.
 *
 * Push behaviour (debounced 1.5s after store flush) is unchanged. We
 * still upload pending evidence files first so storageIds are current
 * in every snapshot.
 *
 * Lifecycle: root layout calls `startRealtimeSync()` when a Pro user is
 * detected. `stopRealtimeSync()` tears everything down.
 */
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { cloudApi, cloudConfigured, getConvexClient, getConvexHttpClient, getClerkToken } from './convex';
import {
  applyLocalSnapshot,
  getLocalItems,
  mergeItems,
  normalizeRemoteItem,
  purgeStaleTombstones,
  saveTombstone,
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
let unsubscribeConnectionState: (() => void) | null = null;
let safetyInterval: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushPending = false;
let recoveryInFlight = false;
const PUSH_DEBOUNCE_MS = 1500;
/**
 * Last-resort safety-net cadence. The Convex subscription should keep
 * every device converged on its own — this exists only to catch the
 * rare case where the subscription silently stops delivering updates
 * (browser bug, intermediate proxy, etc.) and the visibility/connection
 * triggers also missed. 60s is intentionally far longer than the
 * previous 10s loop; we trust the live channel by default.
 */
const SAFETY_NET_MS = 60_000;
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

/**
 * Build a per-collection onFlush handler that creates tombstones for any
 * IDs deleted from that collection, then schedules a push.
 */
function makeFlushHandler(collection: SyncCollection) {
  return (_dirtyIds: string[], deletedIds: string[]): void => {
    for (const id of deletedIds) {
      saveTombstone(collection, id);
    }
    schedulePush();
  };
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
      items: localItems.map(({ collection, localId, payload, updatedAt, deletedAt }) => ({
        collection,
        localId,
        payload,
        updatedAt,
        ...(deletedAt ? { deletedAt } : {})
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

// ---------------------------------------------------------------------------
// Pull: process incoming Convex snapshot update
// ---------------------------------------------------------------------------

/**
 * Live channel handler. Convex calls this whenever the `getSnapshot`
 * subscription transitions to a new value. We merge against local state
 * to honor any edits that happened locally between the last server
 * timestamp and now (last-writer-wins on `updatedAt`/`deletedAt`),
 * apply the result, and stop.
 *
 * We deliberately do NOT push here: any local-only changes from the
 * merge are already on disk via `applyLocalSnapshot`, and the next
 * onFlush will pick them up. The previous design pushed eagerly on
 * every subscription event and needed a `suppressSubscription` flag
 * to break the resulting feedback loop.
 */
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
// Recovery cycle: HTTP-based pull-merge-push, fired on real events
// ---------------------------------------------------------------------------

/**
 * Bidirectional sync cycle used as the recovery primitive. Runs at
 * most one at a time (`recoveryInFlight` gate). Fired by:
 *   - `visibilitychange` → visible (catch up after a backgrounded tab)
 *   - WebSocket reconnect (recover from a temporary outage)
 *   - 60s safety net (last-resort, in case the live channel silently
 *     stopped delivering updates)
 *
 * Uses the cache-free HTTP client for the pull so we never read a
 * stale value from the WebSocket client's optimistic cache.
 */
async function recoverNow(reason: string): Promise<void> {
  if (recoveryInFlight) return;
  const convex = getConvexClient();
  if (!convex) return;

  recoveryInFlight = true;
  try {
    realtimeSyncStore.update((s) => ({ ...s, statusLabel: 'Syncing…' }));

    await uploadPendingEvidenceFiles();

    const httpClient = getConvexHttpClient();
    const token = await getClerkToken();
    if (!httpClient || !token) {
      console.warn(`[realtimeSync] recovery skipped (${reason}): no HTTP client or Clerk token`);
      return;
    }
    httpClient.setAuth(token);

    const [localItems, rawRemote] = await Promise.all([
      getLocalItems(),
      httpClient.query(cloudApi.getSnapshot, {})
    ]);

    const remoteItems = Array.isArray(rawRemote)
      ? rawRemote.map(normalizeRemoteItem).filter((item): item is SyncItem => Boolean(item))
      : [];

    const merged = mergeItems(localItems, remoteItems);

    // Apply merged snapshot locally. As in handleRemoteUpdate(), this
    // refreshes stores via source.set rather than put/putBatch, so it
    // can't trigger an onFlush feedback loop.
    await applyLocalSnapshot(merged);

    // Push merged snapshot back so other devices receive any local-only
    // changes without waiting for the user's next edit.
    await convex.mutation(cloudApi.upsertSnapshot, {
      items: merged.map(({ collection, localId, payload, updatedAt, deletedAt }) => ({
        collection,
        localId,
        payload,
        updatedAt,
        ...(deletedAt ? { deletedAt } : {})
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
    console.debug(`[realtimeSync] recovery cycle completed (${reason})`);
  } catch (err) {
    console.error(`[realtimeSync] recovery cycle failed (${reason}):`, err);
    realtimeSyncStore.update((s) => ({ ...s, statusLabel: 'Sync error' }));
  } finally {
    recoveryInFlight = false;
  }
}

// ---------------------------------------------------------------------------
// Event hooks
// ---------------------------------------------------------------------------

/** Catch up immediately when the user returns to a backgrounded tab. */
function handleVisibilityForSync(): void {
  if (document.visibilityState === 'visible') {
    void recoverNow('tab-visible');
  }
}

let wasConnected = true;

/**
 * Run a recovery cycle on the falling/rising edge of the WebSocket
 * connection. We trigger on the rising edge (reconnect) so we catch up
 * any updates the server delivered during the outage. The falling edge
 * just updates the status label.
 */
function handleConnectionStateChange(state: { isWebSocketConnected: boolean }): void {
  const nowConnected = state.isWebSocketConnected;
  if (!wasConnected && nowConnected) {
    void recoverNow('ws-reconnect');
  } else if (wasConnected && !nowConnected) {
    realtimeSyncStore.update((s) => ({ ...s, statusLabel: 'Offline' }));
  }
  wasConnected = nowConnected;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startRealtimeSync(): void {
  if (!browser || !cloudConfigured) return;
  if (unsubscribeConvex) return; // already running

  const convex = getConvexClient();
  if (!convex) return;

  // Purge old tombstones on startup so they don't grow unbounded.
  purgeStaleTombstones();

  // Wire per-collection onFlush handlers into every store.
  for (const entry of allStores()) {
    entry.store.setOnFlush(makeFlushHandler(entry.collection));
  }

  // Subscribe to Convex live query (the primary channel).
  unsubscribeConvex = convex.onUpdate(
    cloudApi.getSnapshot,
    {},
    (result) => {
      void handleRemoteUpdate(result);
    }
  );

  // Subscribe to connection state so reconnects fire a single recovery
  // cycle instead of needing a fixed-cadence poll to notice we missed
  // updates while disconnected.
  const initialConnState = convex.connectionState();
  wasConnected = initialConnState.isWebSocketConnected;
  unsubscribeConnectionState = convex.subscribeToConnectionState(handleConnectionStateChange);

  // Visibility-driven catch-up for backgrounded tabs.
  document.addEventListener('visibilitychange', handleVisibilityForSync);

  // Safety-net interval: long enough to be cheap, short enough to
  // still feel "real-time" if the live channel ever falls silent.
  if (safetyInterval) clearInterval(safetyInterval);
  safetyInterval = setInterval(() => {
    void recoverNow('safety-net');
  }, SAFETY_NET_MS);

  const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY)) || null;
  realtimeSyncStore.set({
    active: true,
    lastSyncAt: lastSync,
    statusLabel: 'Connected',
    pushCount: 0,
    pullCount: 0
  });

  // Initial reconciliation so any offline edits are pushed and any
  // remote updates from before this session are pulled.
  void recoverNow('start');
  schedulePush();

  console.debug('[realtimeSync] started (subscription + event-driven recovery + 60s safety net)');
}

export function stopRealtimeSync(): void {
  document.removeEventListener('visibilitychange', handleVisibilityForSync);

  if (unsubscribeConvex) {
    unsubscribeConvex();
    unsubscribeConvex = null;
  }
  if (unsubscribeConnectionState) {
    unsubscribeConnectionState();
    unsubscribeConnectionState = null;
  }
  if (safetyInterval) {
    clearInterval(safetyInterval);
    safetyInterval = null;
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
