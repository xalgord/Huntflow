/**
 * Client for the CLI inbox: tool output sent with `huntflow push` waits on
 * disk until the app shows it for review in the Import sheet.
 */
import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { Target } from '$lib/types';
import type { ImportKind } from '$lib/utils/importers';

export interface InboxSummary {
  id: string;
  receivedAt: number;
  bytes: number;
  lines: number;
  program?: string;
  kind?: ImportKind;
  fileName?: string;
  source: string;
  preview: string;
}

export interface InboxItem extends InboxSummary {
  text: string;
}

const API = '/api/huntflow/inbox';
const HEADERS = { 'X-HuntFlow-Client': '1' };

async function call<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const response = await fetch(`${API}${path}`, { ...init, headers: HEADERS, cache: 'no-store' });
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const inboxItems = writable<InboxSummary[]>([]);

export async function refreshInbox(): Promise<InboxSummary[]> {
  const items = (await call<InboxSummary[]>('')) ?? [];
  inboxItems.set(Array.isArray(items) ? items : []);
  return items;
}

export const fetchInboxItem = (id: string) => call<InboxItem>(`/${encodeURIComponent(id)}`);

export async function removeInboxItem(id: string): Promise<void> {
  await call(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  inboxItems.update((items) => items.filter((item) => item.id !== id));
}

/**
 * Resolve `--program acme` to a program: exact id or name first, then a
 * name that starts with or contains it, then the program URL.
 */
export function matchProgram(query: string | undefined, programs: Target[]): Target | undefined {
  const needle = query?.trim().toLowerCase();
  if (!needle) return undefined;
  const active = programs.filter((program) => program.status !== 'archived');
  const pools = [active, programs];
  for (const pool of pools) {
    const found =
      pool.find((program) => program.id === query || program.name.toLowerCase() === needle) ??
      pool.find((program) => program.name.toLowerCase().startsWith(needle)) ??
      pool.find((program) => program.name.toLowerCase().includes(needle)) ??
      pool.find((program) => (program.programUrl ?? '').toLowerCase().includes(needle));
    if (found) return found;
  }
  return undefined;
}

/** Poll while the tab is visible; returns a stop function. */
export function startInboxPolling(intervalMs = 4000): () => void {
  if (!browser) return () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  const tick = () => {
    if (document.visibilityState === 'visible') void refreshInbox();
  };
  tick();
  timer = setInterval(tick, intervalMs);
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', tick);
  return () => {
    clearInterval(timer);
    window.removeEventListener('focus', tick);
    document.removeEventListener('visibilitychange', tick);
  };
}
