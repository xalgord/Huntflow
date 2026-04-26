import { browser } from '$app/environment';
import { noteDB } from '$lib/db/notes';
import { payoutDB } from '$lib/db/payouts';
import { sessionDB } from '$lib/db/sessions';
import { targetDB } from '$lib/db/targets';
import { noteStore, payoutStore, sessionStore, targetStore } from '$lib/stores';
import type { Note, Payout, Session, Target } from '$lib/types';
import { cloudApi, cloudConfigured, getConvexClient } from './convex';

export type SyncCollection = 'sessions' | 'notes' | 'targets' | 'payouts';

export interface SyncItem {
  collection: SyncCollection;
  localId: string;
  payload: Session | Note | Target | Payout;
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
  return session.endedAt ?? session.startedAt;
}

function toSyncItem(collection: 'sessions', item: Session): SyncItem;
function toSyncItem(collection: 'notes', item: Note): SyncItem;
function toSyncItem(collection: 'targets', item: Target): SyncItem;
function toSyncItem(collection: 'payouts', item: Payout): SyncItem;
function toSyncItem(collection: SyncCollection, item: Session | Note | Target | Payout): SyncItem {
  const updatedAt =
    collection === 'sessions'
      ? sessionUpdatedAt(item as Session)
      : (item as Note | Target | Payout).updatedAt;

  return {
    collection,
    localId: item.id,
    payload: item,
    updatedAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRemoteItem(value: unknown): SyncItem | null {
  if (!isRecord(value)) return null;
  const { collection, localId, payload, updatedAt } = value;
  if (
    collection !== 'sessions' &&
    collection !== 'notes' &&
    collection !== 'targets' &&
    collection !== 'payouts'
  ) {
    return null;
  }
  if (typeof localId !== 'string' || !isRecord(payload) || typeof updatedAt !== 'number') return null;
  if (payload.id !== localId) return null;

  return {
    collection,
    localId,
    payload: payload as unknown as SyncItem['payload'],
    updatedAt
  };
}

async function getLocalItems(): Promise<SyncItem[]> {
  const [sessions, notes, targets, payouts] = await Promise.all([
    sessionDB.getAll(),
    noteDB.getAll(),
    targetDB.getAll(),
    payoutDB.getAll()
  ]);

  return [
    ...sessions.map((item) => toSyncItem('sessions', item)),
    ...notes.map((item) => toSyncItem('notes', item)),
    ...targets.map((item) => toSyncItem('targets', item)),
    ...payouts.map((item) => toSyncItem('payouts', item))
  ];
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
  const sessions = items
    .filter((item) => item.collection === 'sessions')
    .map((item) => item.payload as Session);
  const notes = items
    .filter((item) => item.collection === 'notes')
    .map((item) => item.payload as Note);
  const targets = items
    .filter((item) => item.collection === 'targets')
    .map((item) => item.payload as Target);
  const payouts = items
    .filter((item) => item.collection === 'payouts')
    .map((item) => item.payload as Payout);

  await Promise.all([
    sessionDB.putBatch(sessions),
    noteDB.putBatch(notes),
    targetDB.putBatch(targets),
    payoutDB.putBatch(payouts)
  ]);

  await Promise.all([
    sessionStore.refresh(),
    noteStore.refresh(),
    targetStore.refresh(),
    payoutStore.refresh()
  ]);
}

export async function syncNow(): Promise<CloudSyncResult> {
  if (!cloudConfigured) throw new Error('Missing VITE_CONVEX_URL.');

  const convex = getConvexClient();
  if (!convex) throw new Error('Convex is not available in this browser.');

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
