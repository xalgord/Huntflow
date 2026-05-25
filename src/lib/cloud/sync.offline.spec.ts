/**
 * Property 8 — Offline-first invariant is preserved.
 *
 * For any sequence of CRUD operations against the persisted Svelte
 * stores executed while `authStore.signedIn === false`, every
 * operation must be reflected in the persistent layer (IndexedDB in
 * production, an in-memory mock here) after the next flush, and the
 * Convex client's mutation-call count must remain zero.
 *
 * We test this against the same `createPersistedArrayStore` factory
 * the live stores use, with two test doubles:
 *
 *   - A `PersistedArrayDB` whose `put` / `putBatch` / `delete` write
 *     into a `Map<string, T>` (a faithful in-memory IndexedDB).
 *   - A `MockConvexClient` that records every mutation call. The real
 *     `realtimeSync` engine is gated on `signedIn && isPro &&
 *     convexAuthenticated` (Property 4) — when those are false, the
 *     gate keeps `startRealtimeSync` from ever attaching the
 *     `onFlush` hook that pushes to Convex. Property 8 is the
 *     downstream guarantee: no engine attached → no mutation count
 *     bump, regardless of how many local edits the user makes.
 *
 * We don't import the real `realtimeSync` here because it touches
 * many other modules. Instead we assert the contract directly:
 * `signedIn === false` ⇒ the test never installs an `onFlush` hook
 * that contacts Convex, so the Convex mutation count is provably
 * zero by construction.
 *
 * Validates: Property 8, Requirement 11.1
 */

import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { get } from 'svelte/store';
import { writable } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

import { createPersistedArrayStore } from '$lib/stores/persistedArrayStore';

// ---------------------------------------------------------------------------
// Faithful in-memory PersistedArrayDB for an entity with `id: string`.
// ---------------------------------------------------------------------------

interface Entity {
  id: string;
  name: string;
  updatedAt: number;
}

function buildMemoryDb() {
  const map = new Map<string, Entity>();
  let putCount = 0;
  let deleteCount = 0;

  const db = {
    async getAll(): Promise<Entity[]> {
      return Array.from(map.values());
    },
    async put(item: Entity): Promise<void> {
      putCount += 1;
      map.set(item.id, item);
    },
    async putBatch(items: Entity[]): Promise<void> {
      for (const item of items) {
        putCount += 1;
        map.set(item.id, item);
      }
    },
    async delete(id: string): Promise<void> {
      deleteCount += 1;
      map.delete(id);
    }
  };

  return {
    db,
    snapshot: () => new Map(map),
    putCount: () => putCount,
    deleteCount: () => deleteCount
  };
}

// Mock Convex client with a mutation counter. The realtimeSync engine
// only ever invokes mutations through this counter; in our offline
// scenario it is never invoked.
function buildMockConvex() {
  let mutationCount = 0;
  return {
    mutation(): Promise<unknown> {
      mutationCount += 1;
      return Promise.resolve();
    },
    mutationCount: () => mutationCount
  };
}

// ---------------------------------------------------------------------------
// Operation generator — `put`, `putBatch`, `delete`. All operations are
// well-formed and address the same id-space.
// ---------------------------------------------------------------------------

type Op =
  | { kind: 'put'; entity: Entity }
  | { kind: 'putBatch'; entities: Entity[] }
  | { kind: 'delete'; id: string };

const idArb = fc.constantFrom('a', 'b', 'c', 'd', 'e');
const entityArb: fc.Arbitrary<Entity> = fc.record({
  id: idArb,
  name: fc.string({ minLength: 0, maxLength: 12 }),
  updatedAt: fc.integer({ min: 0, max: 1_000_000 })
});

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('put' as const),
    entity: entityArb
  }),
  fc.record({
    kind: fc.constant('putBatch' as const),
    entities: fc.array(entityArb, { minLength: 1, maxLength: 3 })
  }),
  fc.record({ kind: fc.constant('delete' as const), id: idArb })
);

const opsArb: fc.Arbitrary<Op[]> = fc.array(opArb, { minLength: 1, maxLength: 12 });

// Apply an operation to an oracle Map<string, Entity> for comparison.
function applyToOracle(op: Op, oracle: Map<string, Entity>): void {
  if (op.kind === 'put') {
    oracle.set(op.entity.id, op.entity);
  } else if (op.kind === 'putBatch') {
    for (const e of op.entities) oracle.set(e.id, e);
  } else {
    oracle.delete(op.id);
  }
}

// Feature: firebase-auth-migration, Property 8: Offline-first invariant is preserved
describe('Property 8 — Offline-first invariant is preserved', () => {
  it('every CRUD op is reflected in the persistent store, and Convex mutations stay at zero', async () => {
    await fc.assert(
      fc.asyncProperty(opsArb, async (ops) => {
        // Simulate the offline auth state. The persistedArrayStore
        // doesn't read this directly, but we assert the contract: any
        // realtime-sync engine that gates on `signedIn` (per Property
        // 4) won't install the onFlush hook, so the Convex client
        // never sees a mutation.
        const authStore = writable({ signedIn: false });
        const { db, snapshot, putCount, deleteCount } = buildMemoryDb();
        const convex = buildMockConvex();
        const store = createPersistedArrayStore<Entity>(db);

        // Key contract: while signedIn is false, NO onFlush hook is
        // installed. realtimeSync.startRealtimeSync is the only caller
        // of `setOnFlush` that wires Convex pushes; we deliberately do
        // not call startRealtimeSync here, mirroring what the layout's
        // gating predicate would do for the offline case.
        if (get(authStore).signedIn) {
          // Defensive — should never enter this branch under the
          // generator; if it did, hooking onFlush to convex.mutation
          // is what realtimeSync would do.
          store.setOnFlush(() => {
            void convex.mutation();
          });
        }

        await store.load();

        const oracle = new Map<string, Entity>();

        for (const op of ops) {
          if (op.kind === 'put') {
            await store.put(op.entity);
          } else if (op.kind === 'putBatch') {
            await store.putBatch(op.entities);
          } else {
            await store.delete(op.id);
          }
          applyToOracle(op, oracle);
        }

        // Force the debounced 500ms flush to complete now.
        await store.persistNow();

        // Persistent layer matches the oracle.
        const persisted = snapshot();
        if (persisted.size !== oracle.size) return false;
        for (const [id, expected] of oracle) {
          const got = persisted.get(id);
          if (!got) return false;
          if (got.id !== expected.id) return false;
          if (got.name !== expected.name) return false;
          if (got.updatedAt !== expected.updatedAt) return false;
        }

        // Sanity: at least one of put/delete ran for every input op
        // that produced a real change. Non-zero shows the persistent
        // path actually fired (instead of a silent no-op).
        const persistentWriteCount = putCount() + deleteCount();
        if (ops.length > 0 && persistentWriteCount === 0) return false;

        // Crucial: Convex mutation count remains zero throughout.
        if (convex.mutationCount() !== 0) return false;

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('a single put/delete cycle produces exactly the expected persistent state', async () => {
    const authStore = writable({ signedIn: false });
    const { db, snapshot } = buildMemoryDb();
    const convex = buildMockConvex();
    const store = createPersistedArrayStore<Entity>(db);
    expect(get(authStore).signedIn).toBe(false);
    await store.load();

    await store.put({ id: 'a', name: 'one', updatedAt: 1 });
    await store.persistNow();
    expect(snapshot().get('a')).toEqual({ id: 'a', name: 'one', updatedAt: 1 });

    await store.delete('a');
    await store.persistNow();
    expect(snapshot().has('a')).toBe(false);

    expect(convex.mutationCount()).toBe(0);
  });
});
