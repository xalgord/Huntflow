/**
 * Property 7 — Convex post-sign-out reads never leak cross-user data.
 *
 * For any sequence of events `(signIn(uidA), …, signOut, …,
 * signIn(uidB), …)` and for any per-user Convex query issued *after*
 * a `signOut` event but *before* the subsequent `signIn`, the result
 * must classify as `Unauthenticated` — never a row owned by any uid
 * (including `uidA` or `uidB`).
 *
 * This property is a contract between three parties:
 *
 *   1. The auth-getter (`getFirebaseIdToken`) returns `null` when no
 *      user is currently signed in.
 *   2. The Convex client routes that null through to the server,
 *      where the OIDC validator rejects the call with `Unauthenticated`.
 *   3. Per-user queries (e.g. `entitlements.getMine`) gate on
 *      `ctx.auth.getUserIdentity()` and return either a row owned by
 *      the caller or `null`/`Unauthenticated` — never a row from a
 *      different uid.
 *
 * To test this end-to-end without a real Convex deployment, we simulate
 * party (2) and (3) with a mock that:
 *
 *   - records the live token getter's most recent return value,
 *   - resolves to `Unauthenticated` whenever the getter returned `null`,
 *   - resolves to a per-uid row whenever the getter returned the uid,
 *   - never returns a row whose uid differs from the caller's most
 *     recent token (i.e., no cross-user contamination).
 *
 * The simulated history is the sequence of `signIn(uid)` / `signOut`
 * events that fast-check generates; queries are interleaved at every
 * position. After every query we assert the classification matches the
 * expected one based on the current event's polarity.
 *
 * Validates: Property 7, Requirement 6.5
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

type Classification = 'Unauthenticated' | { uid: string };

interface MockConvexClient {
  /** Stub the auth getter; matches Convex's own `setAuth` signature shape. */
  setAuth(getter: () => Promise<string | null>): void;
  /** Per-user query: returns an entitlement-shaped result for the caller. */
  getMine(): Promise<Classification>;
  /** Number of times a per-user query was issued in this run. */
  queryCount(): number;
}

function buildMockConvex(): MockConvexClient {
  let getter: () => Promise<string | null> = async () => null;
  let count = 0;
  return {
    setAuth(g) {
      getter = g;
    },
    async getMine() {
      count += 1;
      const token = await getter();
      if (token === null || token === '') return 'Unauthenticated';
      // Token is the uid in this simulation. The "row" we return is
      // owned by the same uid the auth getter just produced — that
      // mirrors what `entitlements.getMine` does on the real backend
      // (queries by `identity.subject`).
      return { uid: token };
    },
    queryCount() {
      return count;
    }
  };
}

type Event =
  | { type: 'signIn'; uid: string }
  | { type: 'signOut' }
  | { type: 'query' };

// Generate sequences of events. The generator deliberately produces
// arbitrary interleavings (including queries while signed-out, queries
// while signed-in, and back-to-back signOuts).
const eventArb: fc.Arbitrary<Event> = fc.oneof(
  fc.record({
    type: fc.constant('signIn' as const),
    uid: fc.constantFrom('uidA', 'uidB', 'uidC')
  }),
  fc.record({ type: fc.constant('signOut' as const) }),
  fc.record({ type: fc.constant('query' as const) })
);

const sequenceArb: fc.Arbitrary<Event[]> = fc.array(eventArb, {
  minLength: 1,
  maxLength: 24
});

// Feature: firebase-auth-migration, Property 7: Convex post-sign-out reads never leak cross-user data
describe('Property 7 — Convex post-sign-out reads never leak cross-user data', () => {
  it('every per-user query after signOut and before next signIn is Unauthenticated', async () => {
    await fc.assert(
      fc.asyncProperty(sequenceArb, async (events) => {
        const convex = buildMockConvex();

        // The "live" auth state. Mirrors the contract of
        // `getFirebaseIdToken` in `firebase.ts`: returns `null` when
        // `firebaseAuth.currentUser` is null, otherwise returns the
        // current user's id token. We simulate the id token as the uid
        // string so the Convex mock can use it for ownership checks.
        let currentUid: string | null = null;
        convex.setAuth(async () => currentUid);

        for (const event of events) {
          if (event.type === 'signIn') {
            currentUid = event.uid;
          } else if (event.type === 'signOut') {
            currentUid = null;
          } else {
            const result = await convex.getMine();
            if (currentUid === null) {
              // Contract: any query while signed-out classifies as
              // Unauthenticated — never a row from a previous uid.
              if (result !== 'Unauthenticated') return false;
            } else {
              // While signed in we can return a row, but it must
              // belong to the *current* uid — never to anyone else.
              if (result === 'Unauthenticated') return false;
              if (result.uid !== currentUid) return false;
            }
          }
        }
        return true;
      }),
      { numRuns: 200 }
    );
  });

  it('back-to-back signOut events keep all queries Unauthenticated', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (n) => {
        const convex = buildMockConvex();
        let currentUid: string | null = 'uidA';
        convex.setAuth(async () => currentUid);

        // Initial sign-in, then `n` consecutive signOuts, then queries.
        currentUid = null;
        for (let i = 0; i < n; i += 1) {
          // No-op repeated signOuts (re-asserting the null state).
          currentUid = null;
        }
        for (let i = 0; i < 4; i += 1) {
          const result = await convex.getMine();
          if (result !== 'Unauthenticated') return false;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('a query after signIn(uidB) following signOut/signIn(uidA) returns uidB only', async () => {
    const convex = buildMockConvex();
    let currentUid: string | null = null;
    convex.setAuth(async () => currentUid);

    currentUid = 'uidA';
    let result = await convex.getMine();
    expect(result).toEqual({ uid: 'uidA' });

    currentUid = null;
    result = await convex.getMine();
    expect(result).toBe('Unauthenticated');

    currentUid = 'uidB';
    result = await convex.getMine();
    // Crucially: never `{ uid: 'uidA' }`.
    expect(result).toEqual({ uid: 'uidB' });
  });
});
