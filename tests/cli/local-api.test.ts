import { createServer, type Server } from 'node:http';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM module without types
import { createLocalApi, isBackupBundle, rotateBackups, listBackups } from '../../bin/local-api.mjs';

let dir: string;
let server: Server;
let base: string;

const bundle = { magic: 'HUNTFLOW-BACKUP', version: 1, encrypted: false, payload: { targets: [] }, meta: {} };

async function start(options: Record<string, unknown> = {}) {
  const api = createLocalApi({ backupDir: dir, keep: 3, version: '9.9.9', ...options });
  server = createServer(async (req, res) => {
    if (await api(req, res)) return;
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
}

const headers = { 'X-HuntFlow-Client': '1', 'Content-Type': 'application/json' };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'huntflow-backups-'));
});

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

describe('local backup API', () => {
  it('reports status', async () => {
    await start();
    const res = await fetch(`${base}/api/huntflow/status`, { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ app: 'huntflow', version: '9.9.9', backups: { enabled: true, count: 0, dir } });
  });

  it('rejects requests without the client header (blocks cross-site use)', async () => {
    await start();
    const res = await fetch(`${base}/api/huntflow/status`);
    expect(res.status).toBe(403);
  });

  it('rejects mismatched Origin headers', async () => {
    await start();
    const res = await fetch(`${base}/api/huntflow/status`, { headers: { ...headers, Origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });

  it('writes, lists and reads backups, rotating old ones', async () => {
    await start();
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${base}/api/huntflow/backups`, { method: 'POST', headers, body: JSON.stringify(bundle) });
      expect(res.status).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const list = await (await fetch(`${base}/api/huntflow/backups`, { headers })).json();
    expect(list).toHaveLength(3);
    expect(readdirSync(dir).filter((name) => name.endsWith('.partial'))).toHaveLength(0);

    const one = await fetch(`${base}/api/huntflow/backups/${list[0].name}`, { headers });
    expect(await one.json()).toEqual(bundle);
  });

  it('refuses non-backup bodies and traversal names', async () => {
    await start();
    const bad = await fetch(`${base}/api/huntflow/backups`, { method: 'POST', headers, body: JSON.stringify({ hello: 1 }) });
    expect(bad.status).toBe(400);
    const traversal = await fetch(`${base}/api/huntflow/backups/..%2F..%2Fetc%2Fpasswd`, { headers });
    expect(traversal.status).toBe(400);
  });

  it('can be disabled', async () => {
    await start({ enabled: false });
    const status = await (await fetch(`${base}/api/huntflow/status`, { headers })).json();
    expect(status.backups.enabled).toBe(false);
    const res = await fetch(`${base}/api/huntflow/backups`, { method: 'POST', headers, body: JSON.stringify(bundle) });
    expect(res.status).toBe(404);
  });
});

describe('helpers', () => {
  it('validates bundles', () => {
    expect(isBackupBundle(bundle)).toBe(true);
    expect(isBackupBundle({ magic: 'nope' })).toBe(false);
    expect(isBackupBundle(null)).toBe(false);
  });

  it('rotates by recency and ignores foreign files', () => {
    writeFileSync(join(dir, 'notes.txt'), 'keep me');
    for (const stamp of ['20260101T000000000Z', '20260102T000000000Z', '20260103T000000000Z']) {
      writeFileSync(join(dir, `huntflow-backup-${stamp}.json`), '{}');
    }
    rotateBackups(dir, 1);
    expect(listBackups(dir)).toHaveLength(1);
    expect(readdirSync(dir)).toContain('notes.txt');
  });
});
