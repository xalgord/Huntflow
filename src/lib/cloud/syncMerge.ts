/**
 * Pure reconciliation primitives for the HuntFlow cloud sync engine.
 *
 * These live in their own module — separate from `sync.ts` — because
 * `sync.ts` reaches into IndexedDB-backed stores at module load time,
 * which makes it impossible to unit-test the merge algorithm in
 * isolation without spinning up a real browser environment. By
 * extracting the math here we get a testable kernel that the rest of
 * the sync engine (and the cross-device convergence we depend on)
 * builds on top of.
 *
 * Anything in this file MUST stay free of side effects and IndexedDB,
 * fetch, or store imports. If you need to add stateful behaviour, put
 * it in `sync.ts` and call into the helpers here.
 */
import { isRecord } from '$lib/utils/guards';

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

export const KNOWN_COLLECTIONS: SyncCollection[] = [
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

/**
 * Wire shape for a single sync item. Covers both live rows (no
 * `deletedAt`) and tombstones (`deletedAt` set, `payload` is a stub).
 *
 * The `payload` is intentionally typed loosely. The discriminator
 * across collections is `collection`, not the payload type, and
 * collection-specific validation happens at the IndexedDB write step
 * (`applyLocalSnapshot`). Tightening this shape would force everyone
 * who builds a wire item to import all 13 entity types.
 */
export interface SyncItem {
  collection: SyncCollection;
  localId: string;
  payload: { id: string } & Record<string, unknown>;
  updatedAt: number;
  /** Set when the item was soft-deleted. Propagates deletions across devices. */
  deletedAt?: number;
}

/**
 * Validates a wire item that came over the network. Anything that fails
 * one of the checks below would corrupt the merge algorithm if let
 * through, so this gate is deliberately strict.
 *
 * Invariants we enforce:
 *   - `collection` is one of the known table names (foreign-key safety).
 *   - `localId` and `payload.id` agree (so `mergeItems` can group by id
 *     without disagreeing with `applyLocalSnapshot`).
 *   - `updatedAt` is a number (the merge depends on it as the LWW key).
 *
 * Anything else either survives normalization (`deletedAt`) or is
 * ignored as best-effort.
 */
export function normalizeRemoteItem(value: unknown): SyncItem | null {
  if (!isRecord(value)) return null;
  const { collection, localId, payload, updatedAt, deletedAt } = value;
  if (typeof collection !== 'string' || !KNOWN_COLLECTIONS.includes(collection as SyncCollection)) {
    return null;
  }
  if (typeof localId !== 'string' || !isRecord(payload) || typeof updatedAt !== 'number') return null;
  if (payload.id !== localId) return null;

  return {
    collection: collection as SyncCollection,
    localId,
    payload: payload as SyncItem['payload'],
    updatedAt,
    ...(typeof deletedAt === 'number' ? { deletedAt } : {})
  };
}

/**
 * Last-writer-wins merge of two snapshots, with tombstone awareness.
 *
 * The effective timestamp of an item is `deletedAt ?? updatedAt`, so a
 * tombstone competes against a live row using whichever is newer. This
 * gives us:
 *   - Newer live edit beats an older delete → resurrection.
 *   - Newer delete beats an older live edit → propagated removal.
 *   - Same-millisecond conflict: incoming side wins. This is intentional
 *     so a freshly-arriving remote update doesn't get masked by a local
 *     row that the merger encountered first.
 *
 * Items are grouped by `(collection, localId)`, so a target id colliding
 * with a note id is impossible.
 */
export function mergeItems(localItems: SyncItem[], remoteItems: SyncItem[]): SyncItem[] {
  const merged = new Map<string, SyncItem>();

  for (const item of [...localItems, ...remoteItems]) {
    const key = `${item.collection}:${item.localId}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }

    // Last-writer-wins: compare the effective timestamp of each side.
    // For soft-deleted items, deletedAt IS the effective timestamp.
    const existingTs = existing.deletedAt ?? existing.updatedAt;
    const incomingTs = item.deletedAt ?? item.updatedAt;
    if (incomingTs >= existingTs) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values());
}
