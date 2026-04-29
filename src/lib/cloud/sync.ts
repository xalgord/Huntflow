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
import { cloudApi, cloudConfigured, getConvexClient } from './convex';

// Thrown when a signed-in but non-Pro user tries to sync. The settings UI
// catches this and renders a paywall instead of an error toast.
export class ProRequiredError extends Error {
  constructor() {
    super('HuntFlow Pro is required to enable real-time cloud sync.');
    this.name = 'ProRequiredError';
  }
}

export type SyncCollection =
  | 'sessions'
  | 'notes'
  | 'targets'
  | 'payouts'
  | 'evidenceAssets'
  | 'evidenceLinks'
  | 'evidenceCanvasViews'
  | 'reconAssets'
  | 'payloads'
  | 'checklistTemplates'
  | 'checklistInstances'
  | 'submissions'
  | 'bookmarks';

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

export interface SyncItem {
  collection: SyncCollection;
  localId: string;
  payload: SyncPayload;
  updatedAt: number;
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

function toSyncItem(collection: SyncCollection, item: SyncPayload): SyncItem {
  const updatedAt =
    collection === 'sessions'
      ? sessionUpdatedAt(item as Session)
      : (item as { updatedAt: number }).updatedAt;

  return {
    collection,
    localId: item.id,
    payload: item,
    updatedAt
  };
}

const KNOWN_COLLECTIONS: SyncCollection[] = [
  'sessions',
  'notes',
  'targets',
  'payouts',
  'evidenceAssets',
  'evidenceLinks',
  'evidenceCanvasViews',
  'reconAssets',
  'payloads',
  'checklistTemplates',
  'checklistInstances',
  'submissions',
  'bookmarks'
];

// isRecord is now imported at the top of this file

function normalizeRemoteItem(value: unknown): SyncItem | null {
  if (!isRecord(value)) return null;
  const { collection, localId, payload, updatedAt } = value;
  if (typeof collection !== 'string' || !KNOWN_COLLECTIONS.includes(collection as SyncCollection)) {
    return null;
  }
  if (typeof localId !== 'string' || !isRecord(payload) || typeof updatedAt !== 'number') return null;
  if (payload.id !== localId) return null;

  return {
    collection: collection as SyncCollection,
    localId,
    payload: payload as unknown as SyncItem['payload'],
    updatedAt
  };
}

async function getLocalItems(): Promise<SyncItem[]> {
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

  return [
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
}

async function uploadPendingEvidenceFiles(): Promise<void> {
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

function mergeItems(localItems: SyncItem[], remoteItems: SyncItem[]): SyncItem[] {
  const merged = new Map<string, SyncItem>();

  for (const item of [...localItems, ...remoteItems]) {
    const key = `${item.collection}:${item.localId}`;
    const existing = merged.get(key);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values());
}

async function applyLocalSnapshot(items: SyncItem[]): Promise<void> {
  function pickPayloads<T>(collection: SyncCollection): T[] {
    return items
      .filter((item) => item.collection === collection)
      .map((item) => item.payload as T);
  }

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

  const [localItems, rawRemoteItems] = await Promise.all([
    getLocalItems(),
    convex.query(cloudApi.getSnapshot, {})
  ]);
  const remoteItems = Array.isArray(rawRemoteItems)
    ? rawRemoteItems.map(normalizeRemoteItem).filter((item): item is SyncItem => Boolean(item))
    : [];
  const merged = mergeItems(localItems, remoteItems);

  await applyLocalSnapshot(merged);
  await convex.mutation(cloudApi.upsertSnapshot, {
    items: merged.map(({ collection, localId, payload, updatedAt }) => ({
      collection,
      localId,
      payload,
      updatedAt
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
