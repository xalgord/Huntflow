import { browser } from '$app/environment';
import { uploadEvidenceAssetFile } from '$lib/cloud/assets';
import { isRecord } from '$lib/utils/guards';
import { bookmarkDB } from '$lib/db/bookmarks';
import { checklistInstanceDB, checklistTemplateDB } from '$lib/db/checklists';
import { evidenceAssetDB, evidenceBlobDB, evidenceCanvasViewDB, evidenceLinkDB } from '$lib/db/evidence';
import { noteDB } from '$lib/db/notes';
import { payloadDB } from '$lib/db/payloads';
import { payoutDB } from '$lib/db/payouts';
import { reconAssetDB } from '$lib/db/recon';
import { sessionDB } from '$lib/db/sessions';
import { submissionDB } from '$lib/db/submissions';
import { targetDB } from '$lib/db/targets';
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
import type {
  Bookmark,
  ChecklistInstance,
  ChecklistTemplate,
  EvidenceAsset,
  EvidenceCanvasView,
  EvidenceLink,
  Note,
  Payload,
  Payout,
  ReconAsset,
  Session,
  Submission,
  Target
} from '$lib/types';
import { get } from 'svelte/store';
import { clerkAuthStore, refreshProEntitlement } from './clerk';
import { cloudApi, cloudConfigured, getConvexClient, getConvexHttpClient, getClerkToken } from './convex';
// Pure merge primitives live in `syncMerge.ts` so they can be unit-tested
// without dragging IndexedDB and Convex into the test environment.
// We re-export them so existing call sites stay untouched.
import {
  KNOWN_COLLECTIONS,
  mergeItems,
  normalizeRemoteItem,
  type SyncCollection,
  type SyncItem
} from './syncMerge';
export { KNOWN_COLLECTIONS, mergeItems, normalizeRemoteItem };
export type { SyncCollection, SyncItem };

// Thrown when a signed-in but non-Pro user tries to sync. The settings UI
// catches this and renders a paywall instead of an error toast.
export class ProRequiredError extends Error {
  constructor() {
    super('HuntFlow Pro is required to enable real-time cloud sync.');
    this.name = 'ProRequiredError';
  }
}

type SyncPayload =
  | Session
  | Note
  | Target
  | Payout
  | EvidenceAsset
  | EvidenceLink
  | EvidenceCanvasView
  | ReconAsset
  | Payload
  | ChecklistTemplate
  | ChecklistInstance
  | Submission
  | Bookmark;

// ---------------------------------------------------------------------------
// Tombstone management — localStorage-backed deletion markers
// ---------------------------------------------------------------------------

interface Tombstone {
  collection: SyncCollection;
  localId: string;
  deletedAt: number;
}

const TOMBSTONE_KEY = 'huntflow-sync-tombstones';
/** Tombstones older than 30 days are automatically purged. */
const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getTombstones(): Tombstone[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    return raw ? (JSON.parse(raw) as Tombstone[]) : [];
  } catch {
    return [];
  }
}

function setTombstones(tombstones: Tombstone[]): void {
  if (!browser) return;
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tombstones));
}

export function saveTombstone(collection: SyncCollection, localId: string): void {
  const tombstones = getTombstones();
  // Deduplicate: only one tombstone per collection:localId
  const key = `${collection}:${localId}`;
  const existing = tombstones.findIndex((t) => `${t.collection}:${t.localId}` === key);
  const entry: Tombstone = { collection, localId, deletedAt: Date.now() };
  if (existing !== -1) {
    tombstones[existing] = entry;
  } else {
    tombstones.push(entry);
  }
  setTombstones(tombstones);
}

/** Remove a tombstone (e.g. when an item is restored because a newer edit won). */
function removeTombstone(collection: SyncCollection, localId: string): void {
  const tombstones = getTombstones();
  const key = `${collection}:${localId}`;
  setTombstones(tombstones.filter((t) => `${t.collection}:${t.localId}` !== key));
}

/** Purge tombstones older than 30 days. Call on startup. */
export function purgeStaleTombstones(): void {
  const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
  const tombstones = getTombstones();
  const fresh = tombstones.filter((t) => t.deletedAt > cutoff);
  if (fresh.length !== tombstones.length) {
    setTombstones(fresh);
  }
}

export interface CloudSyncResult {
  pulled: number;
  pushed: number;
  merged: number;
  syncedAt: number;
}

const LAST_SYNC_KEY = 'huntflow-cloud-last-sync-at';

export function getLastCloudSyncAt(): number | null {
  if (!browser) return null;
  const value = Number(localStorage.getItem(LAST_SYNC_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function setLastCloudSyncAt(value: number): void {
  if (!browser) return;
  localStorage.setItem(LAST_SYNC_KEY, String(value));
}

function sessionUpdatedAt(session: Session): number {
  // Completed/abandoned sessions use endedAt as their last-modified marker.
  // Running/paused sessions have no endedAt; use Date.now() so mid-session
  // edits (tags, quickNote) are always newer than any cached remote snapshot.
  return session.endedAt ?? (session.status === 'running' || session.status === 'paused' ? Date.now() : session.startedAt);
}

export function toSyncItem(collection: SyncCollection, item: SyncPayload): SyncItem {
  const updatedAt =
    collection === 'sessions'
      ? sessionUpdatedAt(item as Session)
      : (item as { updatedAt: number }).updatedAt;

  return {
    collection,
    localId: item.id,
    // Cast through unknown: SyncPayload is a discriminated union of typed
    // entity shapes, while SyncItem.payload is the looser
    // `{ id: string } & Record<string, unknown>` shape that lives in
    // syncMerge.ts. The looser type lets the merge kernel stay
    // entity-agnostic and unit-testable.
    payload: item as unknown as SyncItem['payload'],
    updatedAt
  };
}

// isRecord is now imported at the top of this file

export async function getLocalItems(): Promise<SyncItem[]> {
  const [
    sessions,
    notes,
    targets,
    payouts,
    evidenceAssets,
    evidenceLinks,
    evidenceCanvasViews,
    reconAssets,
    payloads,
    checklistTemplates,
    checklistInstances,
    submissions,
    bookmarks
  ] = await Promise.all([
    sessionDB.getAll(),
    noteDB.getAll(),
    targetDB.getAll(),
    payoutDB.getAll(),
    evidenceAssetDB.getAll(),
    evidenceLinkDB.getAll(),
    evidenceCanvasViewDB.getAll(),
    reconAssetDB.getAll(),
    payloadDB.getAll(),
    checklistTemplateDB.getAll(),
    checklistInstanceDB.getAll(),
    submissionDB.getAll(),
    bookmarkDB.getAll()
  ]);

  const liveItems: SyncItem[] = [
    ...sessions.map((item) => toSyncItem('sessions', item)),
    ...notes.map((item) => toSyncItem('notes', item)),
    ...targets.map((item) => toSyncItem('targets', item)),
    ...payouts.map((item) => toSyncItem('payouts', item)),
    ...evidenceAssets.map((item) => toSyncItem('evidenceAssets', item)),
    ...evidenceLinks.map((item) => toSyncItem('evidenceLinks', item)),
    ...evidenceCanvasViews.map((item) => toSyncItem('evidenceCanvasViews', item)),
    ...reconAssets.map((item) => toSyncItem('reconAssets', item)),
    ...payloads.map((item) => toSyncItem('payloads', item)),
    ...checklistTemplates.map((item) => toSyncItem('checklistTemplates', item)),
    ...checklistInstances.map((item) => toSyncItem('checklistInstances', item)),
    ...submissions.map((item) => toSyncItem('submissions', item)),
    ...bookmarks.map((item) => toSyncItem('bookmarks', item))
  ];

  // Include tombstones so deletions propagate through the merge.
  const tombstoneItems: SyncItem[] = getTombstones().map((t) => ({
    collection: t.collection,
    localId: t.localId,
    // Stub payload — the real data is gone. Only the id field is needed
    // so normalizeRemoteItem() can validate `payload.id === localId`.
    payload: { id: t.localId } as unknown as SyncItem['payload'],
    updatedAt: t.deletedAt,
    deletedAt: t.deletedAt
  }));

  return [...liveItems, ...tombstoneItems];
}

export async function uploadPendingEvidenceFiles(): Promise<void> {
  const assets = await evidenceAssetDB.getAll();
  const uploadedBytes = assets
    .filter((asset) => asset.storageId)
    .reduce((sum, asset) => sum + (asset.source === 'url' ? 0 : asset.size), 0);
  let currentBytes = uploadedBytes;

  for (const asset of assets) {
    if (asset.source === 'url' || asset.storageId || !asset.localBlobId) continue;
    if (asset.syncState !== 'pending-upload' && asset.syncState !== 'local' && asset.syncState !== 'error') continue;

    const evidenceBlob = await evidenceBlobDB.get(asset.id);
    if (!evidenceBlob) continue;

    try {
      const storageId = await uploadEvidenceAssetFile(asset, evidenceBlob, currentBytes);
      currentBytes += evidenceBlob.size;
      await evidenceAssetDB.put({
        ...asset,
        storageId,
        syncState: 'synced',
        syncError: undefined,
        updatedAt: Date.now()
      });
    } catch (error) {
      await evidenceAssetDB.put({
        ...asset,
        syncState: 'error',
        syncError: error instanceof Error ? error.message : 'Evidence upload failed.',
        updatedAt: Date.now()
      });
    }
  }
}

export async function applyLocalSnapshot(items: SyncItem[]): Promise<void> {
  // Separate live items from soft-deleted tombstones.
  const liveItems = items.filter((item) => !item.deletedAt);
  const deletedItems = items.filter((item) => !!item.deletedAt);

  function pickPayloads<T>(collection: SyncCollection): T[] {
    return liveItems
      .filter((item) => item.collection === collection)
      .map((item) => item.payload as T);
  }

  function pickDeletedIds(collection: SyncCollection): string[] {
    return deletedItems
      .filter((item) => item.collection === collection)
      .map((item) => item.localId);
  }

  // DB handle map for deletions.
  const dbMap: Record<SyncCollection, { delete(id: string): Promise<void> }> = {
    sessions: sessionDB,
    notes: noteDB,
    targets: targetDB,
    payouts: payoutDB,
    evidenceAssets: evidenceAssetDB,
    evidenceLinks: evidenceLinkDB,
    evidenceCanvasViews: evidenceCanvasViewDB,
    reconAssets: reconAssetDB,
    payloads: payloadDB,
    checklistTemplates: checklistTemplateDB,
    checklistInstances: checklistInstanceDB,
    submissions: submissionDB,
    bookmarks: bookmarkDB
  };

  // 1. Upsert live items.
  const sessions = pickPayloads<Session>('sessions');
  const notes = pickPayloads<Note>('notes');
  const targets = pickPayloads<Target>('targets');
  const payouts = pickPayloads<Payout>('payouts');
  const evidenceAssets = pickPayloads<EvidenceAsset>('evidenceAssets');
  const evidenceLinks = pickPayloads<EvidenceLink>('evidenceLinks');
  const evidenceCanvasViews = pickPayloads<EvidenceCanvasView>('evidenceCanvasViews');
  const reconAssets = pickPayloads<ReconAsset>('reconAssets');
  const payloads = pickPayloads<Payload>('payloads');
  const checklistTemplates = pickPayloads<ChecklistTemplate>('checklistTemplates');
  const checklistInstances = pickPayloads<ChecklistInstance>('checklistInstances');
  const submissions = pickPayloads<Submission>('submissions');
  const bookmarks = pickPayloads<Bookmark>('bookmarks');

  await Promise.all([
    sessionDB.putBatch(sessions),
    noteDB.putBatch(notes),
    targetDB.putBatch(targets),
    payoutDB.putBatch(payouts),
    evidenceAssetDB.putBatch(evidenceAssets),
    evidenceLinkDB.putBatch(evidenceLinks),
    evidenceCanvasViewDB.putBatch(evidenceCanvasViews),
    reconAssetDB.putBatch(reconAssets),
    payloadDB.putBatch(payloads),
    checklistTemplateDB.putBatch(checklistTemplates),
    checklistInstanceDB.putBatch(checklistInstances),
    submissionDB.putBatch(submissions),
    bookmarkDB.putBatch(bookmarks)
  ]);

  // 2. Apply deletions — remove soft-deleted items from local IndexedDB.
  for (const collection of KNOWN_COLLECTIONS) {
    const ids = pickDeletedIds(collection);
    if (ids.length === 0) continue;
    const db = dbMap[collection];
    await Promise.all(ids.map((id) => db.delete(id)));
  }

  // 3. Refresh all Svelte stores so the UI reflects both upserts and deletions.
  await Promise.all([
    sessionStore.refresh(),
    noteStore.refresh(),
    targetStore.refresh(),
    payoutStore.refresh(),
    evidenceAssetStore.refresh(),
    evidenceLinkStore.refresh(),
    evidenceCanvasViewStore.refresh(),
    reconAssetStore.refresh(),
    payloadStore.refresh(),
    checklistTemplateStore.refresh(),
    checklistInstanceStore.refresh(),
    submissionStore.refresh(),
    bookmarkStore.refresh()
  ]);

  // 4. Clean up local tombstones for items that were restored (live item won
  //    over the tombstone during merge).
  for (const item of liveItems) {
    removeTombstone(item.collection, item.localId);
  }
}

export async function syncNow(): Promise<CloudSyncResult> {
  if (!cloudConfigured) throw new Error('Missing VITE_CONVEX_URL.');

  const convex = getConvexClient();
  if (!convex) throw new Error('Convex is not available in this browser.');

  // Pro gate: cloud sync is the paid feature. Re-check the live Clerk
  // entitlement before each sync (rather than trusting the cached store
  // value) so a just-cancelled subscription stops syncing immediately.
  await refreshProEntitlement();
  const auth = get(clerkAuthStore);
  if (!auth.isPro) {
    throw new ProRequiredError();
  }

  await uploadPendingEvidenceFiles();

  // Use the cache-free HTTP client for pulling the remote snapshot so
  // "Sync Now" always returns fresh data — the WebSocket client's
  // convex.query() can serve stale cached results on cross-device syncs.
  const httpClient = getConvexHttpClient();
  const token = await getClerkToken();
  if (!httpClient || !token) {
    throw new Error('Could not authenticate with Convex. Please sign in again.');
  }
  httpClient.setAuth(token);

  const [localItems, rawRemoteItems] = await Promise.all([
    getLocalItems(),
    httpClient.query(cloudApi.getSnapshot, {})
  ]);
  const remoteItems = Array.isArray(rawRemoteItems)
    ? rawRemoteItems.map(normalizeRemoteItem).filter((item): item is SyncItem => Boolean(item))
    : [];
  const merged = mergeItems(localItems, remoteItems);

  await applyLocalSnapshot(merged);

  // Push via the WebSocket client (faster, auth already configured).
  await convex.mutation(cloudApi.upsertSnapshot, {
    items: merged.map(({ collection, localId, payload, updatedAt, deletedAt }) => ({
      collection,
      localId,
      payload,
      updatedAt,
      ...(deletedAt ? { deletedAt } : {})
    }))
  });

  const syncedAt = Date.now();
  setLastCloudSyncAt(syncedAt);

  return {
    pulled: remoteItems.length,
    pushed: merged.length,
    merged: merged.length,
    syncedAt
  };
}

export async function clearCloudData(): Promise<number> {
  if (!cloudConfigured) throw new Error('Missing VITE_CONVEX_URL.');
  const convex = getConvexClient();
  if (!convex) throw new Error('Convex is not available in this browser.');
  const result = await convex.mutation(cloudApi.clearCloud, {});
  return isRecord(result) && typeof result.deleted === 'number' ? result.deleted : 0;
}
