import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

/**
 * Tests for the focus-session timer store.
 *
 * The biggest risk in this code is "I paused, switched apps, came back —
 * did the clock keep ticking against me, or did it freeze fairly?". We
 * pin those behaviours down here by faking timers and stepping wall
 * clock manually.
 *
 * `$app/environment` is mocked so `browser` reads `true` and the
 * localStorage persistence path is exercised. This mirrors how the
 * store runs in real users' browsers without needing a JSDOM document.
 */

vi.mock('$app/environment', () => ({ browser: true }));

/**
 * Minimal in-memory localStorage shim for the node test environment.
 * The store only uses getItem/setItem/removeItem, so we don't need the
 * full Web Storage surface.
 */
function installLocalStorageShim(): void {
  const data = new Map<string, string>();
  const shim = {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    }
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: shim
  });
}

/**
 * Stub `document` so the timer store's visibilitychange listener
 * registration is a no-op instead of crashing in the node test
 * environment. The store's behaviour we care about (ticking against
 * `Date.now()`) doesn't depend on visibility events firing.
 */
function installDocumentShim(): void {
  if ('document' in globalThis) return;
  const noopListener = () => {};
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      visibilityState: 'visible',
      addEventListener: noopListener,
      removeEventListener: noopListener
    }
  });
}

let timerStore: typeof import('./timerStore').timerStore;

async function freshStore(): Promise<typeof timerStore> {
  // Clear the module cache so each test gets a clean closure (the store
  // tracks subscriberCount, ticker handles, etc. at module scope).
  vi.resetModules();
  const mod = await import('./timerStore');
  return mod.timerStore;
}

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  // Anchor "now" to a deterministic millisecond so timers are reproducible.
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z').getTime());
  // Install a fresh in-memory localStorage so each test starts clean.
  installLocalStorageShim();
  installDocumentShim();
  timerStore = await freshStore();
  // Real-app behaviour: every consumer subscribes via `$timerStore`,
  // which triggers `load()` and prevents the next `subscribe` cycle
  // from overwriting just-set state with a stale `initialState` read.
  // Calling load() once up front mirrors that.
  timerStore.load();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('timerStore.start', () => {
  it('moves to running with the requested duration', () => {
    timerStore.start(60_000);
    const state = get(timerStore);
    expect(state.status).toBe('running');
    expect(state.remainingMs).toBe(60_000);
    expect(state.totalMs).toBe(60_000);
    expect(state.endTime).toBeGreaterThan(0);
  });

  it('advances remainingMs as wall clock advances', () => {
    timerStore.start(60_000);
    vi.advanceTimersByTime(15_000);
    const state = get(timerStore);
    expect(state.status).toBe('running');
    expect(state.remainingMs).toBeLessThanOrEqual(45_000);
    expect(state.remainingMs).toBeGreaterThanOrEqual(44_000);
  });

  it('flips to completed when the duration elapses', () => {
    timerStore.start(5_000);
    vi.advanceTimersByTime(6_000);
    const state = get(timerStore);
    expect(state.status).toBe('completed');
    expect(state.remainingMs).toBe(0);
  });
});

describe('timerStore.pause / resume', () => {
  it('freezes remainingMs across a pause', () => {
    timerStore.start(60_000);
    vi.advanceTimersByTime(20_000);
    timerStore.pause();
    const paused = get(timerStore);
    expect(paused.status).toBe('paused');
    const frozen = paused.remainingMs;

    // Time passes while the user is doing other things — the timer
    // must not bleed seconds while paused.
    vi.advanceTimersByTime(120_000);
    const stillPaused = get(timerStore);
    expect(stillPaused.status).toBe('paused');
    expect(stillPaused.remainingMs).toBe(frozen);
  });

  it('resume restarts ticking from the frozen point', () => {
    timerStore.start(60_000);
    vi.advanceTimersByTime(15_000);
    timerStore.pause();
    const paused = get(timerStore);
    vi.advanceTimersByTime(5 * 60_000);

    timerStore.resume();
    const resumed = get(timerStore);
    expect(resumed.status).toBe('running');
    // The endTime should now be in the future, not in the past.
    expect(resumed.endTime).toBeGreaterThan(Date.now());

    vi.advanceTimersByTime(5_000);
    const after = get(timerStore);
    expect(after.remainingMs).toBeLessThan(paused.remainingMs);
    expect(after.status).toBe('running');
  });

  it('survives a backgrounded interval and credits real elapsed time', () => {
    // Browsers throttle setInterval to 1Hz on hidden tabs. The store
    // doesn't trust the interval; it computes remainingMs from
    // (endTime - Date.now()). Simulate that by advancing the clock
    // past the planned duration without firing intermediate ticks.
    timerStore.start(30_000);
    // Advance the wall clock 10 minutes — far past the 30s session.
    // setInterval would have only fired ~30 times in real life; here
    // we let only one tick happen via vi.advanceTimersByTime, but the
    // computation still resolves to 0 because endTime - now() <= 0.
    vi.advanceTimersByTime(10 * 60_000);
    const state = get(timerStore);
    expect(state.status).toBe('completed');
    expect(state.remainingMs).toBe(0);
  });
});

describe('timerStore.reset / complete', () => {
  it('reset restores the idle state with the requested total', () => {
    timerStore.start(60_000);
    vi.advanceTimersByTime(20_000);
    const FORTY_FIVE_MIN = 45 * 60_000;
    timerStore.reset(FORTY_FIVE_MIN);
    const state = get(timerStore);
    expect(state.status).toBe('idle');
    expect(state.totalMs).toBe(FORTY_FIVE_MIN);
    expect(state.remainingMs).toBe(FORTY_FIVE_MIN);
    expect(state.endTime).toBeUndefined();
  });

  it('complete forces remainingMs to 0 regardless of clock state', () => {
    timerStore.start(60_000);
    timerStore.complete();
    const state = get(timerStore);
    expect(state.status).toBe('completed');
    expect(state.remainingMs).toBe(0);
    expect(state.progress).toBe(100);
  });
});

describe('timerStore persistence', () => {
  it('writes the running state to localStorage so a refresh resumes', () => {
    timerStore.start(60_000, 'session-1');
    const raw = globalThis.localStorage.getItem('huntflow:timer-state');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { status: string; sessionId?: string };
    expect(parsed.status).toBe('running');
    expect(parsed.sessionId).toBe('session-1');
  });

  it('hydrates a paused state on a fresh module load', async () => {
    timerStore.start(60_000, 'session-1');
    vi.advanceTimersByTime(15_000);
    timerStore.pause();
    const raw = globalThis.localStorage.getItem('huntflow:timer-state');
    expect(raw).not.toBeNull();

    const reloaded = await freshStore();
    const state = reloaded.load();
    expect(state.status).toBe('paused');
    expect(state.remainingMs).toBeLessThanOrEqual(45_000);
  });

  it('flips a stale running state to completed if the endTime has passed', async () => {
    timerStore.start(10_000, 'session-1');
    // Simulate a closed tab: time keeps passing but the store can't tick.
    vi.advanceTimersByTime(60_000);

    const reloaded = await freshStore();
    const state = reloaded.load();
    expect(state.status).toBe('completed');
    expect(state.remainingMs).toBe(0);
  });

  it('clears localStorage when reset to idle', () => {
    timerStore.start(60_000);
    expect(globalThis.localStorage.getItem('huntflow:timer-state')).not.toBeNull();
    timerStore.reset();
    expect(globalThis.localStorage.getItem('huntflow:timer-state')).toBeNull();
  });
});
