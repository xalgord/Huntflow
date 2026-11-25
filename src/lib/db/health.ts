/**
 * Storage health.
 *
 * HuntFlow is local-first: if IndexedDB can't be written, the user's work
 * is at risk and they must be told immediately — never silently. Every
 * state other than `ok` is rendered by `StorageStatusBanner`.
 */
import { writable } from 'svelte/store';

export type StorageHealthState =
  /** Normal operation. */
  | 'ok'
  /** A database upgrade is waiting for other HuntFlow tabs to close. */
  | 'blocked'
  /** Another tab upgraded the database; this tab must reload. */
  | 'version-changed'
  /** The browser's storage quota is full; new writes fail. */
  | 'quota'
  /** IndexedDB is unavailable; changes live only in this tab's memory. */
  | 'memory';

export interface StorageHealth {
  state: StorageHealthState;
  /** Human-readable cause, safe to show in the UI. */
  detail?: string;
  since?: number;
}

export const storageHealth = writable<StorageHealth>({ state: 'ok' });

let current: StorageHealth = { state: 'ok' };
storageHealth.subscribe((value) => {
  current = value;
});

const severity: Record<StorageHealthState, number> = {
  ok: 0,
  blocked: 1,
  quota: 2,
  'version-changed': 3,
  memory: 4
};

/**
 * Raise the health state. Lower-severity reports never mask a more serious
 * one (e.g. a later "blocked" must not hide "memory").
 */
export function reportStorageHealth(state: StorageHealthState, detail?: string): void {
  if (state !== 'ok' && severity[state] < severity[current.state]) return;
  if (current.state === state && current.detail === detail) return;
  storageHealth.set({ state, detail, since: Date.now() });
}

/** Clear a transient state (e.g. the blocking tab was closed). */
export function clearStorageHealth(state: StorageHealthState): void {
  if (current.state === state) storageHealth.set({ state: 'ok' });
}

export type StorageErrorKind = 'connection' | 'quota' | 'fatal';

/**
 * Classify an IndexedDB failure.
 *
 * - `connection`: the connection closed or the transaction died
 *   (tab backgrounded, version change, browser recycled the handle). A
 *   fresh connection usually succeeds, so callers should reopen and retry.
 * - `quota`: storage is full; retrying won't help.
 * - `fatal`: IndexedDB itself is unusable (private mode, disabled, corrupt).
 */
export function classifyStorageError(error: unknown): StorageErrorKind {
  const name = (error as { name?: string } | null)?.name ?? '';
  const message = String((error as { message?: string } | null)?.message ?? error ?? '').toLowerCase();

  if (name === 'QuotaExceededError' || message.includes('quota')) return 'quota';
  if (
    name === 'InvalidStateError' ||
    name === 'TransactionInactiveError' ||
    name === 'AbortError' ||
    message.includes('connection is closing') ||
    message.includes('connection was closed') ||
    message.includes('database connection') ||
    message.includes('terminated')
  ) {
    return 'connection';
  }
  return 'fatal';
}

export function describeStorageError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  const message = (error as { message?: string } | null)?.message;
  if (name && message) return `${name}: ${message}`;
  return String(message ?? error ?? 'Unknown storage error');
}
