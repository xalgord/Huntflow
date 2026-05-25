import { describe, expect, it } from 'vitest';
import { mergeItems, normalizeRemoteItem, type SyncItem } from './syncMerge';

/**
 * Pure-logic tests for the sync merge algorithm. These deliberately
 * avoid touching IndexedDB, Convex, or the Svelte stores — `mergeItems`
 * is the kernel of last-writer-wins reconciliation and tombstone
 * handling, and that is what the rest of the sync engine depends on.
 *
 * A few semantics the tests pin down:
 *   1. Pure inserts on either side are preserved.
 *   2. The newer `updatedAt` wins; ties go to the incoming side
 *      (mirrors `mergeItems`'s `incomingTs >= existingTs` check, which
 *      is intentional so the latest push doesn't get masked by a
 *      same-millisecond local edit).
 *   3. A tombstone with `deletedAt` newer than the live row's
 *      `updatedAt` deletes; older tombstones are masked by the live row.
 *   4. `normalizeRemoteItem` rejects payloads whose `id` doesn't match
 *      the wrapper's `localId` — this is the field that the merge
 *      algorithm assumes is invariant.
 */

const TARGET_ID = '11111111-1111-4111-8111-111111111111';

function liveItem(id: string, updatedAt: number, payload: Record<string, unknown> = {}): SyncItem {
  return {
    collection: 'targets',
    localId: id,
    payload: { id, name: `target ${id.slice(0, 4)}`, updatedAt, ...payload } as never,
    updatedAt
  };
}

function tombstone(id: string, deletedAt: number): SyncItem {
  return {
    collection: 'targets',
    localId: id,
    payload: { id } as never,
    updatedAt: deletedAt,
    deletedAt
  };
}

describe('mergeItems', () => {
  it('returns both sides when there are no conflicts', () => {
    const local = [liveItem(TARGET_ID, 100)];
    const remote = [liveItem('22222222-2222-4222-8222-222222222222', 200)];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(2);
  });

  it('keeps the newer side on a conflict (remote wins)', () => {
    const local = [liveItem(TARGET_ID, 100)];
    const remote = [liveItem(TARGET_ID, 200)];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].updatedAt).toBe(200);
  });

  it('keeps the newer side on a conflict (local wins)', () => {
    const local = [liveItem(TARGET_ID, 300)];
    const remote = [liveItem(TARGET_ID, 200)];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].updatedAt).toBe(300);
  });

  it('breaks updatedAt ties in favour of the incoming side', () => {
    // The merge order in mergeItems is [...localItems, ...remoteItems],
    // so on a tie the *later* entry (remote here) replaces the earlier.
    const local = [liveItem(TARGET_ID, 100, { name: 'local' })];
    const remote = [liveItem(TARGET_ID, 100, { name: 'remote' })];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(1);
    expect((merged[0].payload as unknown as { name: string }).name).toBe('remote');
  });

  it('applies a newer tombstone over an older live row', () => {
    const local = [liveItem(TARGET_ID, 100)];
    const remote = [tombstone(TARGET_ID, 200)];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe(200);
  });

  it('keeps a newer live row over an older tombstone (resurrection)', () => {
    // This is how a user can "undo" a delete by editing the same row on
    // a different device that hadn't seen the tombstone yet.
    const local = [tombstone(TARGET_ID, 100)];
    const remote = [liveItem(TARGET_ID, 200)];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBeUndefined();
    expect(merged[0].updatedAt).toBe(200);
  });

  it('keeps a tombstone when both sides have the same delete', () => {
    const local = [tombstone(TARGET_ID, 100)];
    const remote = [tombstone(TARGET_ID, 100)];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe(100);
  });

  it('does not mix items from different collections under the same localId', () => {
    const local: SyncItem[] = [
      { collection: 'targets', localId: TARGET_ID, payload: { id: TARGET_ID } as never, updatedAt: 100 }
    ];
    const remote: SyncItem[] = [
      { collection: 'notes', localId: TARGET_ID, payload: { id: TARGET_ID } as never, updatedAt: 200 }
    ];
    const merged = mergeItems(local, remote);
    expect(merged).toHaveLength(2);
  });

  it('handles a mixed batch deterministically', () => {
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '22222222-2222-4222-8222-222222222222';
    const C = '33333333-3333-4333-8333-333333333333';

    const local = [liveItem(A, 100), liveItem(B, 50), tombstone(C, 100)];
    const remote = [liveItem(A, 50), tombstone(B, 100), liveItem(C, 200)];
    const merged = mergeItems(local, remote);

    expect(merged).toHaveLength(3);
    const byId = new Map(merged.map((item) => [item.localId, item]));
    expect(byId.get(A)?.updatedAt).toBe(100); // local wins
    expect(byId.get(B)?.deletedAt).toBe(100); // remote tombstone wins
    expect(byId.get(C)?.deletedAt).toBeUndefined(); // remote live row wins
    expect(byId.get(C)?.updatedAt).toBe(200);
  });
});

describe('normalizeRemoteItem', () => {
  it('accepts a well-formed wire item', () => {
    const result = normalizeRemoteItem({
      collection: 'targets',
      localId: TARGET_ID,
      payload: { id: TARGET_ID },
      updatedAt: 100
    });
    expect(result).not.toBeNull();
    expect(result!.collection).toBe('targets');
  });

  it('preserves deletedAt when present', () => {
    const result = normalizeRemoteItem({
      collection: 'targets',
      localId: TARGET_ID,
      payload: { id: TARGET_ID },
      updatedAt: 100,
      deletedAt: 200
    });
    expect(result?.deletedAt).toBe(200);
  });

  it('rejects unknown collection names', () => {
    expect(
      normalizeRemoteItem({
        collection: 'plot-twist',
        localId: TARGET_ID,
        payload: { id: TARGET_ID },
        updatedAt: 100
      })
    ).toBeNull();
  });

  it('rejects items whose payload id does not match localId', () => {
    expect(
      normalizeRemoteItem({
        collection: 'targets',
        localId: TARGET_ID,
        payload: { id: 'different-id' },
        updatedAt: 100
      })
    ).toBeNull();
  });

  it('rejects items missing required fields', () => {
    expect(normalizeRemoteItem(null)).toBeNull();
    expect(normalizeRemoteItem({})).toBeNull();
    expect(
      normalizeRemoteItem({
        collection: 'targets',
        localId: TARGET_ID,
        payload: { id: TARGET_ID }
        // updatedAt missing
      })
    ).toBeNull();
  });
});
