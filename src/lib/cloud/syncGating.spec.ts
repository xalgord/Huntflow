import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  decideRealtimeSync,
  shouldStartRealtimeSync,
  type SyncGateInputs
} from './syncGating';

/**
 * Property 4 — Realtime-sync gating predicate.
 *
 * The layout starts the realtime sync engine iff
 * `(signedIn && isPro && convexAuthenticated)`. For arbitrary
 * transitions where any of those booleans flips from `true` to
 * `false`, the engine must stop on the next evaluation.
 *
 * The test exercises `shouldStartRealtimeSync` (the predicate) and
 * `decideRealtimeSync` (the transition decider). Together they cover
 * what the layout's reactive block does: re-evaluate on every change,
 * starting when the gate flips on, stopping when it flips off.
 *
 * Validates: Requirement 7.5, 7.6
 */

const stateArb: fc.Arbitrary<SyncGateInputs> = fc.record({
  signedIn: fc.boolean(),
  isPro: fc.boolean(),
  convexAuthenticated: fc.boolean()
});

// Feature: firebase-auth-migration, Property 4: Realtime-sync gating predicate
describe('Property 4 — Realtime-sync gating predicate', () => {
  it('returns true iff all three flags are true (enumerated truth table)', () => {
    // Exhaustive over the 8 boolean combinations.
    for (const signedIn of [false, true]) {
      for (const isPro of [false, true]) {
        for (const convexAuthenticated of [false, true]) {
          const expected = signedIn && isPro && convexAuthenticated;
          const result = shouldStartRealtimeSync({
            signedIn,
            isPro,
            convexAuthenticated
          });
          expect(result).toBe(expected);
        }
      }
    }
  });

  it('agrees with the reference predicate for arbitrary states', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const expected =
          state.signedIn && state.isPro && state.convexAuthenticated;
        return shouldStartRealtimeSync(state) === expected;
      }),
      { numRuns: 200 }
    );
  });

  it('emits a "stop" decision when any required flag flips true → false', () => {
    fc.assert(
      fc.property(stateArb, fc.constantFrom('signedIn', 'isPro', 'convexAuthenticated' as const), (
        prev,
        flag
      ) => {
        // Force the precondition: previous state must have had sync on.
        const liveBefore: SyncGateInputs = {
          signedIn: true,
          isPro: true,
          convexAuthenticated: true
        };
        // Build the next state by flipping only the chosen flag to false.
        const next: SyncGateInputs = { ...liveBefore, [flag]: false };
        return decideRealtimeSync(liveBefore, next) === 'stop';
        // `prev` is unused on purpose — kept in the signature so we can
        // generate noise if we later want to assert on edge cases that
        // don't satisfy the precondition.
        void prev;
      }),
      { numRuns: 100 }
    );
  });

  it('emits a "start" decision when the gate flips off → on', () => {
    fc.assert(
      fc.property(stateArb, (offState) => {
        // Coerce the off-state to one that fails the gate.
        const safeOff: SyncGateInputs = shouldStartRealtimeSync(offState)
          ? { ...offState, signedIn: false }
          : offState;
        const on: SyncGateInputs = {
          signedIn: true,
          isPro: true,
          convexAuthenticated: true
        };
        return decideRealtimeSync(safeOff, on) === 'start';
      }),
      { numRuns: 100 }
    );
  });

  it('emits a "noop" when the gate stays in the same on/off bucket', () => {
    fc.assert(
      fc.property(stateArb, stateArb, (a, b) => {
        const onA = shouldStartRealtimeSync(a);
        const onB = shouldStartRealtimeSync(b);
        if (onA !== onB) return true; // skip transitions
        return decideRealtimeSync(a, b) === 'noop';
      }),
      { numRuns: 200 }
    );
  });
});
