import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  MAX_PUSH_PAYLOAD_CHARS,
  chunkWireItems,
  cursorAfterOwnPush,
  cursorSeq,
  isValidCursor,
  itemKey,
  planPush,
  remoteWinners,
  signatureOf
} from './syncDelta';
import type { SyncItem } from './syncMerge';

function note(id: string, updatedAt: number, extra: Record<string, unknown> = {}, deletedAt?: number): SyncItem {
  return {
    collection: 'notes',
    localId: id,
    payload: { id, ...extra },
    updatedAt,
    ...(deletedAt ? { deletedAt } : {})
  };
}

function acknowledge(items: SyncItem[]): Map<string, string> {
  return new Map(items.map((item) => [itemKey(item), signatureOf(item, JSON.stringify(item.payload))]));
}

describe('planPush', () => {
  it('sends everything the cloud has not acknowledged, with payloads as JSON text', () => {
    const items = [note('a', 1, { title: 'A' }), note('b', 2, {}, 3)];
    const plan = planPush(items, new Map());
    expect(plan.wire).toEqual([
      { collection: 'notes', localId: 'a', payload: '{"id":"a","title":"A"}', updatedAt: 1 },
      { collection: 'notes', localId: 'b', payload: '{"id":"b"}', updatedAt: 2, deletedAt: 3 }
    ]);
  });

  it('sends nothing for an idle device and only the edited record after a change', () => {
    const items = [note('a', 1, { title: 'A' }), note('b', 2)];
    const acked = acknowledge(items);
    expect(planPush(items, acked).wire).toEqual([]);

    // Same timestamp, different body (a running session edited in place).
    const edited = [note('a', 1, { title: 'A (edited)' }), note('b', 2)];
    expect(planPush(edited, acked).wire.map((item) => item.localId)).toEqual(['a']);
  });

  it('never sends records over the per-item limit', () => {
    const huge = note('big', 1, { body: 'x'.repeat(MAX_PUSH_PAYLOAD_CHARS) });
    const plan = planPush([huge, note('small', 1)], new Map());
    expect(plan.oversized).toEqual(['notes:big']);
    expect(plan.wire.map((item) => item.localId)).toEqual(['small']);
  });
});

describe('chunkWireItems', () => {
  it('keeps every item, in order, within the byte budget (unless a single item is larger)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5000 }), { maxLength: 60 }), (sizes) => {
        const items = sizes.map((size, index) => ({
          collection: 'notes',
          localId: `n${index}`,
          payload: 'x'.repeat(size),
          updatedAt: index
        }));
        const chunks = chunkWireItems(items, 10_000);
        expect(chunks.flat()).toEqual(items);
        for (const chunk of chunks) {
          const cost = chunk.reduce((sum, item) => sum + item.payload.length + item.localId.length + 96, 0);
          if (chunk.length > 1) expect(cost).toBeLessThanOrEqual(10_000);
        }
      })
    );
  });
});

describe('remoteWinners', () => {
  it('applies newer and same-timestamp remote copies, keeps newer local ones', () => {
    const local = [note('a', 10, { v: 'local' }), note('b', 10, { v: 'local' }), note('c', 10, { v: 'local' })];
    const remote = [note('a', 20, { v: 'remote' }), note('b', 5, { v: 'remote' }), note('c', 10, { v: 'remote' }), note('d', 1)];
    const winners = remoteWinners(local, remote);
    expect(winners.map((item) => item.localId).sort()).toEqual(['a', 'c', 'd']);
  });

  it('lets a newer tombstone delete and a newer edit resurrect', () => {
    const local = [note('a', 10), note('b', 10, {}, 15)];
    const remote = [note('a', 10, {}, 20), note('b', 30, { back: true })];
    const winners = remoteWinners(local, remote);
    expect(winners.find((item) => item.localId === 'a')?.deletedAt).toBe(20);
    expect(winners.find((item) => item.localId === 'b')?.payload).toEqual({ id: 'b', back: true });
  });
});

describe('cursors', () => {
  it('validates and reads cursors, and skips our own rows after a push', () => {
    expect(isValidCursor('12.34')).toBe(true);
    expect(isValidCursor('abc')).toBe(false);
    expect(cursorSeq('12.34')).toBe(12);
    expect(cursorSeq(null)).toBe(0);
    const own = cursorAfterOwnPush(7);
    expect(isValidCursor(own)).toBe(true);
    expect(cursorSeq(own)).toBe(7);
  });
});
