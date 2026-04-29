import { browser } from '$app/environment';
import type { TimerState } from '$lib/types';
import { writable, type Readable } from 'svelte/store';

interface TimerStore extends Readable<TimerState> {
  load(): TimerState;
  start(durationMs: number, sessionId?: string): void;
  startSeconds(durationSeconds: number, sessionId?: string): void;
  pause(): void;
  resume(): void;
  complete(): void;
  reset(totalMs?: number): void;
}

const STORAGE_KEY = 'huntflow:timer-state';
const DEFAULT_TOTAL_MS = 25 * 60 * 1000;

const initialState: TimerState = {
  status: 'idle',
  remainingMs: DEFAULT_TOTAL_MS,
  totalMs: DEFAULT_TOTAL_MS,
  progress: 0
};

const source = writable<TimerState>(initialState);
let value = initialState;
let loaded = false;
let subscriberCount = 0;
let tickTimer: ReturnType<typeof setInterval> | null = null;

source.subscribe((state) => {
  value = state;
});

function clamp(valueToClamp: number, min: number, max: number): number {
  return Math.min(Math.max(valueToClamp, min), max);
}

function progressFor(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return clamp(100 - (remainingMs / totalMs) * 100, 0, 100);
}

function persist(state: TimerState): void {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearPersisted(): void {
  if (!browser) return;
  localStorage.removeItem(STORAGE_KEY);
}

function setState(state: TimerState): void {
  source.set(state);
  if (state.status === 'idle') {
    clearPersisted();
  } else {
    persist(state);
  }
}

function stopTicker(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function tick(): void {
  if (value.status !== 'running' || !value.endTime) return;

  const remainingMs = Math.max(value.endTime - Date.now(), 0);
  const next: TimerState = {
    ...value,
    remainingMs,
    progress: progressFor(remainingMs, value.totalMs)
  };

  if (remainingMs <= 0) {
    stopTicker();
    setState({
      ...next,
      status: 'completed',
      remainingMs: 0,
      progress: 100
    });
    return;
  }

  setState(next);
}

function startTicker(): void {
  stopTicker();
  tick();
  tickTimer = setInterval(tick, 1000);
}

function hydrateTimerState(raw: string | null): TimerState {
  if (!raw) return initialState;

  try {
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    const totalMs = typeof parsed.totalMs === 'number' && parsed.totalMs > 0 ? parsed.totalMs : DEFAULT_TOTAL_MS;
    const remainingMs =
      typeof parsed.remainingMs === 'number' && parsed.remainingMs >= 0 ? parsed.remainingMs : totalMs;

    if (parsed.status === 'running' && typeof parsed.endTime === 'number') {
      const nextRemaining = Math.max(parsed.endTime - Date.now(), 0);
      return {
        status: nextRemaining <= 0 ? 'completed' : 'running',
        remainingMs: nextRemaining,
        totalMs,
        sessionId: parsed.sessionId,
        endTime: parsed.endTime,
        progress: nextRemaining <= 0 ? 100 : progressFor(nextRemaining, totalMs)
      };
    }

    if (parsed.status === 'paused' || parsed.status === 'completed') {
      return {
        status: parsed.status,
        remainingMs,
        totalMs,
        sessionId: parsed.sessionId,
        endTime: parsed.endTime,
        progress: parsed.status === 'completed' ? 100 : progressFor(remainingMs, totalMs)
      };
    }
  } catch {
    clearPersisted();
  }

  return initialState;
}

function load(): TimerState {
  if (!browser || loaded) return value;

  loaded = true;
  const state = hydrateTimerState(localStorage.getItem(STORAGE_KEY));
  source.set(state);
  if (state.status === 'running') startTicker();
  return state;
}

function handleVisibilityChange(): void {
  if (!browser || document.visibilityState !== 'visible') return;
  if (value.status === 'running') tick();
}

export const timerStore: TimerStore = {
  subscribe(run, invalidate) {
    subscriberCount += 1;
    load();

    if (browser && subscriberCount === 1) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      if (value.status === 'running') startTicker();
    }

    const unsubscribe = source.subscribe(run, invalidate);

    return () => {
      unsubscribe();
      subscriberCount -= 1;
      if (browser && subscriberCount === 0) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        stopTicker();
      }
    };
  },
  load,
  start(durationMs, sessionId) {
    const totalMs = Math.max(durationMs, 1000);
    const endTime = Date.now() + totalMs;
    setState({
      status: 'running',
      remainingMs: totalMs,
      totalMs,
      sessionId,
      endTime,
      progress: 0
    });
    startTicker();
  },
  startSeconds(durationSeconds, sessionId) {
    this.start(durationSeconds * 1000, sessionId);
  },
  pause() {
    if (value.status !== 'running') return;
    const remainingMs = value.endTime ? Math.max(value.endTime - Date.now(), 0) : value.remainingMs;
    stopTicker();
    setState({
      ...value,
      status: 'paused',
      remainingMs,
      progress: progressFor(remainingMs, value.totalMs)
    });
  },
  resume() {
    if (value.status !== 'paused') return;
    const endTime = Date.now() + value.remainingMs;
    setState({
      ...value,
      status: 'running',
      endTime
    });
    startTicker();
  },
  complete() {
    stopTicker();
    setState({
      ...value,
      status: 'completed',
      remainingMs: 0,
      progress: 100,
      endTime: undefined
    });
  },
  reset(totalMs = DEFAULT_TOTAL_MS) {
    stopTicker();
    setState({
      status: 'idle',
      remainingMs: totalMs,
      totalMs,
      progress: 0,
      endTime: undefined
    });
  }
};
