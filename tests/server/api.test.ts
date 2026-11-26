import { Webhook } from 'standardwebhooks';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Env } from '../../server/env';
import { handleApiRequest } from '../../server/router';
import { MAX_ITEM_PAYLOAD_CHARS, chunkPushItems, parseCursor } from '../../server/sync';
import { FakeD1, FakeR2, installTestKeys, makeEnv, tokenFor } from './fakes';

const ORIGIN = 'https://huntflow.xalgorix.com';

function request(path: string, init: RequestInit & { token?: string } = {}): Request {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  // Browsers and the Workers runtime put Content-Length on the wire for
  // fixed bodies; Node's Request doesn't expose it, so mirror that here.
  if (!headers.has('content-length') && (typeof init.body === 'string' || init.body instanceof Uint8Array)) {
    const length = typeof init.body === 'string' ? new TextEncoder().encode(init.body).length : init.body.byteLength;
    headers.set('content-length', String(length));
  }
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
}

async function call(env: Env, path: string, init: RequestInit & { token?: string } = {}) {
  const response = await handleApiRequest(request(path, init), env);
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // plain-text bodies (webhook replies)
  }
  return { status: response.status, body, headers: response.headers };
}

function item(collection: string, id: string, updatedAt: number, extra: Record<string, unknown> = {}) {
  return {
    collection,
    localId: id,
    payload: JSON.stringify({ id, updatedAt, ...extra }),
    updatedAt
  };
}

async function grantPro(env: Env, uid: string, isPro = true) {
  const secret = env.DODO_WEBHOOK_SIGNING_SECRET as string;
  const payload = JSON.stringify({
    type: isPro ? 'subscription.active' : 'subscription.cancelled',
    data: {
      metadata: { uid },
      customer: { customer_id: `cus_${uid}` },
      subscription_id: `sub_${uid}`,
      next_billing_date: '2027-01-01T00:00:00Z'
    }
  });
  return sendWebhook(env, secret, payload, `msg_${uid}_${isPro}_${Math.random()}`);
}

async function sendWebhook(env: Env, secret: string, payload: string, id: string, date = new Date()) {
  const signature = new Webhook(secret).sign(id, date, payload);
  return call(env, '/api/webhooks/dodo', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(date.getTime() / 1000)),
      'webhook-signature': signature
    }
  });
}

beforeAll(async () => {
  await installTestKeys();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('health and routing', () => {
  it('reports service status without leaking secrets', async () => {
    const { env } = makeEnv({ RESEND_API_KEY: '' });
    const { status, body } = await call(env, '/api/health');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.services).toMatchObject({ database: true, auth: true, billing: true, webhooks: true, contact: false });
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('answers CORS preflight for the hosted origin only', async () => {
    const { env } = makeEnv();
    const allowed = await handleApiRequest(
      request('/api/sync/push', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }),
      env
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const denied = await handleApiRequest(
      request('/api/sync/push', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }),
      env
    );
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('returns JSON 404 for unknown endpoints and 405 for wrong methods', async () => {
    const { env } = makeEnv();
    expect((await call(env, '/api/nope')).status).toBe(404);
    expect((await call(env, '/api/me', { method: 'POST' })).status).toBe(405);
  });
});

describe('authentication', () => {
  it('rejects missing, forged, expired and wrong-project tokens', async () => {
    const { env } = makeEnv();
    expect((await call(env, '/api/me')).status).toBe(401);
    expect((await call(env, '/api/me', { token: 'not-a-jwt' })).status).toBe(401);
    expect((await call(env, '/api/me', { token: await tokenFor('user_abc123', { foreignKey: true }) })).status).toBe(401);
    expect((await call(env, '/api/me', { token: await tokenFor('user_abc123', { expired: true }) })).status).toBe(401);
    expect((await call(env, '/api/me', { token: await tokenFor('user_abc123', { audience: 'other' }) })).status).toBe(401);
    expect(
      (await call(env, '/api/me', { token: await tokenFor('user_abc123', { issuer: 'https://evil.example' }) })).status
    ).toBe(401);
  });

  it('returns the caller and a free-tier entitlement for a valid token', async () => {
    const { env } = makeEnv();
    const { status, body } = await call(env, '/api/me', { token: await tokenFor('user_abc123') });
    expect(status).toBe(200);
    expect(body).toEqual({ uid: 'user_abc123', email: 'user_abc123@example.com', isPro: false, currentPeriodEnd: null });
  });

  it('is unavailable (503) when the Firebase project is not configured', async () => {
    const { env } = makeEnv({ FIREBASE_PROJECT_ID: '' });
    expect((await call(env, '/api/me', { token: await tokenFor('user_abc123') })).status).toBe(503);
  });
});

describe('Dodo webhook', () => {
  it('rejects bad signatures and applies verified subscription events', async () => {
    const { env } = makeEnv();
    const bad = await sendWebhook(env, 'whsec_ZmFrZWZha2VmYWtlZmFrZWZha2VmYWtl', '{"type":"subscription.active"}', 'm1');
    expect(bad.status).toBe(401);

    const ok = await grantPro(env, 'user_pro001');
    expect(ok.status).toBe(200);
    const me = await call(env, '/api/me', { token: await tokenFor('user_pro001') });
    expect(me.body.isPro).toBe(true);
    expect(me.body.currentPeriodEnd).toBe(Date.parse('2027-01-01T00:00:00Z'));
    expect(JSON.stringify(me.body)).not.toContain('cus_');
  });

  it('dedupes deliveries, ignores stale events, and validates the uid', async () => {
    const { env } = makeEnv();
    const secret = env.DODO_WEBHOOK_SIGNING_SECRET as string;
    const active = JSON.stringify({ type: 'subscription.active', data: { metadata: { uid: 'user_lww001' } } });
    const cancelled = JSON.stringify({ type: 'subscription.cancelled', data: { metadata: { uid: 'user_lww001' } } });

    expect((await sendWebhook(env, secret, active, 'evt_1', new Date(Date.now() - 1000))).body).toBe('ok');
    expect((await sendWebhook(env, secret, active, 'evt_1', new Date(Date.now() - 1000))).body).toBe(
      'Duplicate webhook delivery'
    );
    // Newer cancellation wins…
    await sendWebhook(env, secret, cancelled, 'evt_2', new Date());
    // …and a late, older activation must not resurrect Pro.
    await sendWebhook(env, secret, active, 'evt_3', new Date(Date.now() - 60_000));
    const me = await call(env, '/api/me', { token: await tokenFor('user_lww001') });
    expect(me.body.isPro).toBe(false);

    const missing = JSON.stringify({ type: 'subscription.active', data: { metadata: { uid: 'x' } } });
    expect((await sendWebhook(env, secret, missing, 'evt_4')).status).toBe(400);
    const ignored = JSON.stringify({ type: 'payment.succeeded', data: {} });
    expect((await sendWebhook(env, secret, ignored, 'evt_5')).body).toBe('Ignored event type');
  });
});

describe('sync', () => {
  it('requires Pro to push', async () => {
    const { env } = makeEnv();
    const token = await tokenFor('user_free01');
    const { status, body } = await call(env, '/api/sync/push', {
      method: 'POST',
      token,
      body: JSON.stringify({ items: [item('notes', 'n1', 1)] })
    });
    expect(status).toBe(402);
    expect(body.code).toBe('pro_required');
  });

  it('round-trips items through the change feed with last-writer-wins', async () => {
    const { env } = makeEnv();
    await grantPro(env, 'user_sync01');
    const token = await tokenFor('user_sync01');
    const push = (items: unknown[]) =>
      call(env, '/api/sync/push', { method: 'POST', token, body: JSON.stringify({ items }) });

    const first = await push([
      item('notes', 'n1', 100, { title: 'one' }),
      item('targets', 't1', 100, { name: 'Acme' }),
      { collection: 'notes', localId: 'n2', payload: JSON.stringify({ id: 'n2' }), updatedAt: 90, deletedAt: 120 },
      // rejected: payload id mismatch, unknown collection, bad JSON
      { collection: 'notes', localId: 'n3', payload: JSON.stringify({ id: 'other' }), updatedAt: 1 },
      { collection: 'secrets', localId: 's1', payload: '{"id":"s1"}', updatedAt: 1 },
      { collection: 'notes', localId: 'n4', payload: '{not json', updatedAt: 1 }
    ]);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ changed: 3, invalid: 1, seq: 1, prevSeq: 0 });

    const page = await call(env, '/api/sync/changes', { token });
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(3);
    expect(page.body.items.find((entry: any) => entry.localId === 'n1').payload).toEqual({
      id: 'n1',
      updatedAt: 100,
      title: 'one'
    });
    expect(page.body.items.find((entry: any) => entry.localId === 'n2').deletedAt).toBe(120);
    expect(page.body.hasMore).toBe(false);

    // Nothing new after the cursor.
    const empty = await call(env, `/api/sync/changes?cursor=${page.body.cursor}`, { token });
    expect(empty.body.items).toEqual([]);
    expect(empty.body.cursor).toBe(page.body.cursor);

    // Re-pushing the same snapshot changes nothing and wakes nobody.
    const again = await push([item('notes', 'n1', 100, { title: 'one' }), item('targets', 't1', 100, { name: 'Acme' })]);
    expect(again.body.changed).toBe(0);
    expect((await call(env, `/api/sync/changes?cursor=${page.body.cursor}`, { token })).body.items).toEqual([]);

    // Older write loses, newer write wins, same-timestamp edit is accepted.
    await push([item('notes', 'n1', 50, { title: 'stale' })]);
    await push([item('targets', 't1', 200, { name: 'Acme Corp' })]);
    await push([item('notes', 'n1', 100, { title: 'one (edited in place)' })]);
    const delta = await call(env, `/api/sync/changes?cursor=${page.body.cursor}`, { token });
    const byId = Object.fromEntries(delta.body.items.map((entry: any) => [entry.localId, entry.payload]));
    expect(Object.keys(byId).sort()).toEqual(['n1', 't1']);
    expect(byId.t1.name).toBe('Acme Corp');
    expect(byId.n1.title).toBe('one (edited in place)');

    // A newer edit resurrects a tombstone.
    await push([item('notes', 'n2', 300, { title: 'back' })]);
    const resurrected = await call(env, `/api/sync/changes?cursor=${delta.body.cursor}`, { token });
    expect(resurrected.body.items[0]).toMatchObject({ localId: 'n2', updatedAt: 300 });
    expect(resurrected.body.items[0].deletedAt).toBeUndefined();
  });

  it('isolates users from each other', async () => {
    const { env } = makeEnv();
    await grantPro(env, 'user_alice1');
    await grantPro(env, 'user_bobby1');
    await call(env, '/api/sync/push', {
      method: 'POST',
      token: await tokenFor('user_alice1'),
      body: JSON.stringify({ items: [item('notes', 'secret', 1, { body: 'alice only' })] })
    });
    const bob = await call(env, '/api/sync/changes', { token: await tokenFor('user_bobby1') });
    expect(bob.body.items).toEqual([]);
  });

  it('pages large change sets and keeps cursors exact', async () => {
    const { env } = makeEnv();
    await grantPro(env, 'user_page01');
    const token = await tokenFor('user_page01');
    const items = Array.from({ length: 950 }, (_, index) => item('reconAssets', `r${index}`, 1000 + index));
    await call(env, '/api/sync/push', { method: 'POST', token, body: JSON.stringify({ items }) });

    const seen = new Set<string>();
    let cursor = '';
    let pages = 0;
    for (;;) {
      const page = await call(env, `/api/sync/changes${cursor ? `?cursor=${cursor}` : ''}`, { token });
      page.body.items.forEach((entry: any) => seen.add(entry.localId));
      cursor = page.body.cursor;
      pages += 1;
      if (!page.body.hasMore) break;
    }
    expect(seen.size).toBe(950);
    expect(pages).toBeGreaterThan(1);
  });

  it('resets a cursor that is ahead of the server and rejects malformed ones', async () => {
    const { env } = makeEnv();
    const token = await tokenFor('user_curs01');
    const ahead = await call(env, '/api/sync/changes?cursor=99.5', { token });
    expect(ahead.body.reset).toBe(true);
    expect(ahead.body.cursor).toBe('0.0');
    expect((await call(env, '/api/sync/changes?cursor=abc', { token })).status).toBe(400);
    expect(parseCursor('12.34')).toEqual({ seq: 12, rid: 34 });
  });

  it('splits oversized pushes into statements that fit D1 bound-parameter limits', () => {
    const big = 'x'.repeat(700_000);
    const items = [1, 2, 3, 4].map((n) => ({
      collection: 'notes',
      localId: `n${n}`,
      payload: JSON.stringify({ id: `n${n}`, body: big }),
      updatedAt: n
    }));
    const chunks = chunkPushItems(items);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThan(2_000_000);
    expect(MAX_ITEM_PAYLOAD_CHARS).toBeLessThan(2_000_000);
  });

  it('clear wipes records but keeps evidence still referenced by a live asset', async () => {
    const { env, bucket } = makeEnv();
    await grantPro(env, 'user_clear1');
    const token = await tokenFor('user_clear1');
    await call(env, '/api/sync/push', {
      method: 'POST',
      token,
      body: JSON.stringify({
        items: [
          item('evidenceAssets', 'live-asset', 10),
          { collection: 'evidenceAssets', localId: 'gone-asset', payload: '{"id":"gone-asset"}', updatedAt: 5, deletedAt: 9 },
          item('notes', 'n1', 10)
        ]
      })
    });
    for (const id of ['live-asset', 'gone-asset']) {
      await call(env, `/api/assets/${id}`, { method: 'PUT', token, body: 'evidence bytes', headers: { 'content-type': 'text/plain' } });
    }
    expect(bucket.objects.size).toBe(2);
    const before = await call(env, '/api/sync/changes', { token });

    const cleared = await call(env, '/api/sync/clear', { method: 'POST', token });
    expect(cleared.body).toEqual({ deleted: 4, skippedFiles: 1 });
    expect([...bucket.objects.keys()]).toEqual(['evidence/user_clear1/live-asset']);

    // Cursors issued before the wipe stay valid (sequence never resets).
    const after = await call(env, `/api/sync/changes?cursor=${before.body.cursor}`, { token });
    expect(after.body.reset).toBe(false);
    expect(after.body.items).toEqual([]);
  });
});

describe('evidence files', () => {
  it('uploads, downloads with metadata, enforces Pro, and deletes', async () => {
    const { env, bucket } = makeEnv();
    const token = await tokenFor('user_file01');
    const upload = () =>
      call(env, '/api/assets/asset-1', {
        method: 'PUT',
        token,
        body: new Uint8Array([1, 2, 3, 4]),
        headers: {
          'content-type': 'image/png',
          'x-hf-file-name': encodeURIComponent('screen shot.png'),
          'x-hf-relative-path': encodeURIComponent('poc/screen shot.png')
        }
      });

    expect((await upload()).status).toBe(402);
    await grantPro(env, 'user_file01');
    const stored = await upload();
    expect(stored.status).toBe(200);
    expect(stored.body).toEqual({ storageId: 'r2:asset-1', size: 4, usedBytes: 4 });

    const download = await handleApiRequest(request('/api/assets/asset-1', { token }), env);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('image/png');
    expect(decodeURIComponent(download.headers.get('x-hf-file-name') ?? '')).toBe('screen shot.png');
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));

    // Another user cannot read it.
    const other = await call(env, '/api/assets/asset-1', { token: await tokenFor('user_other1') });
    expect(other.status).toBe(404);

    expect((await call(env, '/api/assets/asset-1', { method: 'DELETE', token })).body).toEqual({ deleted: true });
    expect(bucket.objects.size).toBe(0);
    expect((await call(env, '/api/assets/asset-1', { token })).status).toBe(404);
    expect((await call(env, '/api/assets/bad%2Fid', { token })).status).toBe(400);
  });

  it('enforces the per-file size and per-user quota', async () => {
    const { env, db } = makeEnv();
    await grantPro(env, 'user_quota1');
    const token = await tokenFor('user_quota1');
    const tooBig = await call(env, '/api/assets/a1', {
      method: 'PUT',
      token,
      body: 'x',
      headers: { 'content-length': String(101 * 1024 * 1024) }
    });
    expect(tooBig.status).toBe(413);

    (db as FakeD1).sqlite
      .prepare(
        `INSERT INTO asset_files (uid, asset_id, object_key, mime_type, size, uploaded_at)
         VALUES ('user_quota1', 'existing', 'k', 'image/png', ?, 1)`
      )
      .run(1024 * 1024 * 1024 - 2);
    const overQuota = await call(env, '/api/assets/a2', { method: 'PUT', token, body: 'abcd' });
    expect(overQuota.status).toBe(413);
    expect(overQuota.body.code).toBe('quota_exceeded');
    // Re-uploading the same asset doesn't count its old size against the quota.
    const replace = await call(env, '/api/assets/existing', { method: 'PUT', token, body: 'ab' });
    expect(replace.status).toBe(200);
  });
});

describe('billing', () => {
  it('creates a checkout session tagged with the caller uid', async () => {
    const { env } = makeEnv();
    const fetchMock = vi.fn(async () => Response.json({ checkout_url: 'https://checkout.example/session' }));
    vi.stubGlobal('fetch', fetchMock);
    const { status, body } = await call(env, '/api/billing/checkout', {
      method: 'POST',
      token: await tokenFor('user_buy001'),
      body: JSON.stringify({ returnUrl: `${ORIGIN}/account?checkout=success`, cancelUrl: `${ORIGIN}/pricing` })
    });
    expect(status).toBe(200);
    expect(body).toEqual({ checkoutUrl: 'https://checkout.example/session' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://test.dodopayments.example/checkouts');
    const sent = JSON.parse(String(init.body));
    expect(sent.metadata).toEqual({ uid: 'user_buy001' });
    expect(sent.customer.email).toBe('user_buy001@example.com');
    expect(sent.product_cart).toEqual([{ product_id: 'pdt_test', quantity: 1 }]);
  });

  it('rejects non-http redirect targets and reports missing configuration', async () => {
    const token = await tokenFor('user_buy002');
    const { env } = makeEnv();
    const bad = await call(env, '/api/billing/checkout', {
      method: 'POST',
      token,
      body: JSON.stringify({ returnUrl: 'javascript:alert(1)', cancelUrl: `${ORIGIN}/pricing` })
    });
    expect(bad.status).toBe(400);

    const { env: unconfigured } = makeEnv({ DODO_API_KEY: '' });
    const missing = await call(unconfigured, '/api/billing/checkout', {
      method: 'POST',
      token,
      body: JSON.stringify({ returnUrl: `${ORIGIN}/a`, cancelUrl: `${ORIGIN}/b` })
    });
    expect(missing.status).toBe(503);
  });

  it('opens the customer portal only for subscribers', async () => {
    const { env } = makeEnv();
    const token = await tokenFor('user_port01');
    expect((await call(env, '/api/billing/portal', { method: 'POST', token })).status).toBe(404);

    await grantPro(env, 'user_port01');
    const fetchMock = vi.fn(async () => Response.json({ link: 'https://portal.example/x' }));
    vi.stubGlobal('fetch', fetchMock);
    const portal = await call(env, '/api/billing/portal', { method: 'POST', token });
    expect(portal.body).toEqual({ url: 'https://portal.example/x' });
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/customers/cus_user_port01/customer-portal/session');
  });
});

describe('contact form', () => {
  const valid = { name: 'Ada', email: 'ada@example.com', subject: 'Hi', message: 'I would like to know more.' };

  it('validates input, swallows honeypot hits and rate-limits per client', async () => {
    const { env } = makeEnv({ RESEND_API_KEY: 're_test' });
    const fetchMock = vi.fn(async () => Response.json({ id: 'email_1' }));
    vi.stubGlobal('fetch', fetchMock);
    const send = (body: unknown, ip = '203.0.113.7') =>
      call(env, '/api/contact', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': ip } });

    expect((await send({ ...valid, website: 'spam' })).body).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await send({ ...valid, email: 'nope' })).status).toBe(400);

    expect((await send(valid)).status).toBe(200);
    expect((await send(valid)).status).toBe(200);
    expect((await send(valid)).status).toBe(200);
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent.reply_to).toBe('ada@example.com');
    expect(sent.html).not.toContain('<script');

    const limited = await send(valid);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    // A different client is unaffected.
    expect((await send(valid, '198.51.100.1')).status).toBe(200);
  });

  it('says so when email delivery is not configured', async () => {
    const { env } = makeEnv({ RESEND_API_KEY: '' });
    const response = await call(env, '/api/contact', { method: 'POST', body: JSON.stringify(valid) });
    expect(response.status).toBe(503);
    expect(response.body.error).toContain('huntflow@xalgorix.com');
  });
});

describe('fakes sanity', () => {
  it('FakeR2 stores bytes', async () => {
    const r2 = new FakeR2();
    await r2.put('k', 'hello');
    expect((await r2.get('k'))?.size).toBe(5);
  });
});
