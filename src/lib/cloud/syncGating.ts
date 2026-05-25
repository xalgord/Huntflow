/**
 * Real-time sync gating predicate.
 *
 * Owns the "should the live sync engine be running right now?"
 * decision so the layout doesn't have to inline it (and so Wave 6
 * Property 4 can drive it directly without spinning up Svelte).
 *
 * The rule, restated from design.md:
 *
 *   sync runs ⇔ signedIn && isPro && convexAuthenticated
 *
 * No other inputs influence the gate. Callers feed in a snapshot of
 * the relevant `authStore` booleans; the predicate is pure and total.
 *
 * The companion `decideRealtimeSync` helper makes the transition
 * decision explicit (start | stop | noop) so a future caller can drive
 * the engine from a reducer-style transition record without inferring
 * whether the previous state already had sync running. The current
 * `+layout.svelte` consumer can keep using `shouldStartRealtimeSync`
 * directly with reactive `if`/`else` since Svelte's reactivity already
 * de-duplicates equal calls.
 *
 * Feature: firebase-auth-migration
 * Validates: Requirement 7.5, 7.6
 */

export interface SyncGateInputs {
  signedIn: boolean;
  isPro: boolean;
  convexAuthenticated: boolean;
}

/**
 * Pure predicate. Returns true iff every required flag is set. No
 * tolerance, no transitional state — when any flag falls, sync stops
 * on the next reactive evaluation.
 */
export function shouldStartRealtimeSync(state: SyncGateInputs): boolean {
  return Boolean(state.signedIn && state.isPro && state.convexAuthenticated);
}

/** Action emitted by `decideRealtimeSync`. */
export type SyncTransitionAction = 'start' | 'stop' | 'noop';

/**
 * Decide what action to take given a previous and next state. Useful
 * for callers that want to log/instrument transitions without
 * re-deriving them from the predicate.
 *
 *   prev=false, next=true  → 'start'
 *   prev=true,  next=false → 'stop'
 *   otherwise              → 'noop'
 */
export function decideRealtimeSync(
  prev: SyncGateInputs,
  next: SyncGateInputs
): SyncTransitionAction {
  const wasOn = shouldStartRealtimeSync(prev);
  const isOn = shouldStartRealtimeSync(next);
  if (!wasOn && isOn) return 'start';
  if (wasOn && !isOn) return 'stop';
  return 'noop';
}
