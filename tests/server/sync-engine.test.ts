// @vitest-environment jsdom
/**
 * End-to-end check of the browser sync engine against the real API
 * router: IndexedDB (fake-indexeddb) ⇄ realtimeSync ⇄ /api/* handlers ⇄
 * an in-memory D1. A second "device" is simulated by writing straight
 * to the API with the same account.
 */
import 'fake-indexeddb/auto';
import { get } from 'svelte/store';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { handleApiRequest } from '../../server/router';
import { installTestKeys, makeEnv, tokenFor } from './fakes';

vi.mock('$app/environment', () => ({ browser: true, dev: false, building: false, version: 'test' }));

const UID = 'user_int001';

vi.mock('$lib/cloud/firebase', async () => {
  const { writable } = await import('svelte/store');
  return {
    authStore: writable({ signedIn: true, isPro: true, cloudAuthenticated: true, uid: 'user_int001' }),
    refreshProEntitlement: async () => undefined,
    getFirebaseIdToken: async () => null
  };
});

const { env, db } = makeEnv({ FIREBASE_PROJECT_ID: 'huntflow-test' });

async function waitFor<T>(probe: () => T | Promise<T>, timeoutMs = 8000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function serverRow(localId: string) {
  return db.sqlite
    .prepare('SELECT payload, updated_at, deleted_at FROM sync_items WHERE uid = ? AND local_id = ?')
    .get(UID, localId) as { payload: string; updated_at: number; deleted_at: number | null } | undefined;
}

async function remotePush(items: unknown[]) {
  const response = await handleApiRequest(
    new Request('https://huntflow.test/api/sync/push', {
      method: 'POST',
      headers: { authorization: `Bearer ${await tokenFor(UID)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ items })
    }),
    env
  );
  expect(response.status).toBe(200);
}

function note(id: string, title: string, updatedAt: number) {
  return { id, title, content: '', targetId: 't1', tags: [], createdAt: 1, updatedAt };
}

let api: typeof import('$lib/cloud/api');
let engine: typeof import('$lib/cloud/realtimeSync');
let stores: typeof import('$lib/stores');

beforeAll(async () => {
  // jsdom has no matchMedia; the settings store listens for theme changes.
  window.matchMedia ??= ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  await installTestKeys();
  db.sqlite
    .prepare(`INSERT INTO entitlements (uid, is_pro, dodo_customer_id, updated_at) VALUES (?, 1, 'cus_x', 1)`)
    .run(UID);

  // Route the browser's same-origin /api calls into the Functions router.
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handleApiRequest(new Request(new URL(url, 'https://huntflow.test'), init), env);
  });

  api = await import('$lib/cloud/api');
  api.setCloudTokenProvider(async () => tokenFor(UID));
  stores = await import('$lib/stores');
  engine = await import('$lib/cloud/realtimeSync');
});

afterAll(() => {
  engine?.stopRealtimeSync();
  vi.unstubAllGlobals();
});

describe('cloud sync engine against the Cloudflare API', () => {
  it('pushes local work, pulls remote edits and propagates deletes both ways', async () => {
    await stores.noteStore.load();
    await stores.noteStore.put(note('n1', 'Local draft', 1000));
    await stores.noteStore.persistNow();

    engine.startRealtimeSync();

    // 1. Local → cloud.
    const pushed = await waitFor(() => serverRow('n1'));
    expect(JSON.parse(pushed.payload).title).toBe('Local draft');

    // 2. Another device edits n1 and creates n2; this device pulls both.
    await remotePush([
      { collection: 'notes', localId: 'n1', payload: JSON.stringify(note('n1', 'Edited elsewhere', 2000)), updatedAt: 2000 },
      { collection: 'notes', localId: 'n2', payload: JSON.stringify(note('n2', 'From my phone', 2000)), updatedAt: 2000 }
    ]);
    await engine.syncNow();
    const titles = () => Object.fromEntries(get(stores.noteStore).map((item) => [item.id, item.title]));
    expect(titles()).toEqual({ n1: 'Edited elsewhere', n2: 'From my phone' });

    // 3. A remote delete removes the note here.
    await remotePush([{ collection: 'notes', localId: 'n2', payload: '{"id":"n2"}', updatedAt: 2000, deletedAt: 3000 }]);
    await engine.syncNow();
    expect(Object.keys(titles())).toEqual(['n1']);

    // 4. A local delete reaches the cloud as a tombstone.
    await stores.noteStore.delete('n1');
    await stores.noteStore.persistNow();
    const tombstone = await waitFor(() => {
      const row = serverRow('n1');
      return row?.deleted_at ? row : null;
    });
    expect(tombstone.deleted_at).toBeGreaterThan(2000);

    expect(get(engine.realtimeSyncStore).statusLabel).toBe('Synced');
  }, 20_000);

  it('does not re-send unchanged records', async () => {
    const before = (db.sqlite.prepare('SELECT seq FROM sync_state WHERE uid = ?').get(UID) as { seq: number }).seq;
    await engine.syncNow(); // full re-upload: every record is already there
    const rows = db.sqlite.prepare('SELECT MAX(server_seq) AS top FROM sync_items WHERE uid = ?').get(UID) as {
      top: number;
    };
    // The push bumped the counter but changed no rows, so no device is woken.
    expect(rows.top).toBeLessThanOrEqual(before);
  });
});
