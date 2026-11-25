import { createServer, type Server } from 'node:http';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM module without types
import { createLocalApi, listInbox, normaliseInboxItem, writeInboxItem } from '../../bin/local-api.mjs';
// @ts-expect-error — plain ESM module without types
import { parsePushArgs, push } from '../../bin/push.mjs';

let backupDir: string;
let inboxDir: string;
let server: Server | undefined;
let base: string;

const headers = { 'X-HuntFlow-Client': '1', 'Content-Type': 'application/json' };

async function start(options: Record<string, unknown> = {}) {
  const api = createLocalApi({ backupDir, inboxDir, version: '9.9.9', ...options });
  server = createServer(async (req, res) => {
    if (await api(req, res)) return;
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
}

beforeEach(() => {
  backupDir = mkdtempSync(join(tmpdir(), 'huntflow-backups-'));
  inboxDir = mkdtempSync(join(tmpdir(), 'huntflow-inbox-'));
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = undefined;
  rmSync(backupDir, { recursive: true, force: true });
  rmSync(inboxDir, { recursive: true, force: true });
});

describe('inbox API', () => {
  it('queues, lists, reads and deletes items', async () => {
    await start();
    const created = await fetch(`${base}/api/huntflow/inbox`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'a.acme.com\nb.acme.com\n', program: 'acme', kind: 'hosts', fileName: '../../etc/passwd' })
    });
    expect(created.status).toBe(201);
    const summary = await created.json();
    expect(summary).toMatchObject({ program: 'acme', kind: 'hosts', lines: 2, preview: 'a.acme.com', fileName: '.._.._etc_passwd' });
    expect(summary.text).toBeUndefined();

    const list = await (await fetch(`${base}/api/huntflow/inbox`, { headers })).json();
    expect(list).toHaveLength(1);
    const status = await (await fetch(`${base}/api/huntflow/status`, { headers })).json();
    expect(status.inbox).toEqual({ count: 1 });

    const item = await (await fetch(`${base}/api/huntflow/inbox/${summary.id}`, { headers })).json();
    expect(item.text).toBe('a.acme.com\nb.acme.com\n');

    expect((await fetch(`${base}/api/huntflow/inbox/${summary.id}`, { method: 'DELETE', headers })).status).toBe(200);
    expect(await (await fetch(`${base}/api/huntflow/inbox`, { headers })).json()).toEqual([]);
  });

  it('works when disk backups are disabled', async () => {
    await start({ enabled: false });
    const res = await fetch(`${base}/api/huntflow/inbox`, { method: 'POST', headers, body: JSON.stringify({ text: 'x.acme.com' }) });
    expect(res.status).toBe(201);
  });

  it('rejects empty bodies, unknown ids and cross-site requests', async () => {
    await start();
    expect((await fetch(`${base}/api/huntflow/inbox`, { method: 'POST', headers, body: JSON.stringify({ text: '  ' }) })).status).toBe(400);
    expect((await fetch(`${base}/api/huntflow/inbox`, { method: 'POST', headers, body: 'nope' })).status).toBe(400);
    expect((await fetch(`${base}/api/huntflow/inbox/..%2F..%2Fsecret`, { headers })).status).toBe(404);
    expect((await fetch(`${base}/api/huntflow/inbox`, { method: 'POST', body: JSON.stringify({ text: 'x' }) })).status).toBe(403);
    expect(
      (await fetch(`${base}/api/huntflow/inbox`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: JSON.stringify({ text: 'x' }) })).status
    ).toBe(403);
  });

  it('ignores unknown formats and keeps known ones', () => {
    expect(normaliseInboxItem({ text: 'x', kind: 'rm -rf' }).kind).toBeUndefined();
    expect(normaliseInboxItem({ text: 'x', kind: 'nuclei' }).kind).toBe('nuclei');
    expect(normaliseInboxItem({ text: '' })).toBeNull();
  });

  it('lists items oldest first', () => {
    writeInboxItem(inboxDir, { text: 'first' }, new Date(Date.UTC(2026, 0, 1)));
    writeInboxItem(inboxDir, { text: 'second' }, new Date(Date.UTC(2026, 0, 2)));
    expect(listInbox(inboxDir).map((item: { preview: string }) => item.preview)).toEqual(['first', 'second']);
  });
});

describe('huntflow push', () => {
  it('parses options', () => {
    expect(parsePushArgs(['scan.jsonl', '-P', 'Acme Corp', '--format=nuclei', '--tee', '--port', '4000'])).toMatchObject({
      file: 'scan.jsonl',
      program: 'Acme Corp',
      kind: 'nuclei',
      tee: true,
      port: 4000
    });
    expect(() => parsePushArgs(['--format', 'xml'])).toThrow(/Unknown format/);
    expect(() => parsePushArgs(['--bogus'])).toThrow(/Unknown option/);
  });

  it('sends a file to a running HuntFlow', async () => {
    await start();
    const file = join(inboxDir, 'httpx.jsonl');
    writeFileSync(file, '{"url":"https://a.acme.com","status_code":200}\n');
    const logs: string[] = [];
    const code = await push([file, '--url', base, '-P', 'acme'], { log: (line: string) => logs.push(line), stdinIsTTY: true });
    expect(code).toBe(0);
    expect(logs[0]).toMatch(/^✓ Sent 1 line to HuntFlow for acme/);
    const [item] = await (await fetch(`${base}/api/huntflow/inbox`, { headers })).json();
    expect(item).toMatchObject({ program: 'acme', fileName: 'httpx.jsonl', source: 'cli' });
  });

  it('queues on disk when HuntFlow is not running', async () => {
    const file = join(backupDir, 'hosts.txt');
    writeFileSync(file, 'a.acme.com\n');
    const logs: string[] = [];
    const code = await push([file, '--url', 'http://127.0.0.1:9', '--inbox-dir', inboxDir], { log: (line: string) => logs.push(line), stdinIsTTY: true });
    expect(code).toBe(0);
    expect(logs[0]).toMatch(/Queued 1 line\. HuntFlow isn't running/);
    expect(readdirSync(inboxDir).filter((name) => name.endsWith('.json'))).toHaveLength(1);
  });

  it('refuses empty input', async () => {
    const file = join(backupDir, 'empty.txt');
    writeFileSync(file, '\n\n');
    await expect(push([file, '--url', 'http://127.0.0.1:9'], { log: () => {}, stdinIsTTY: true })).rejects.toThrow(/empty/);
  });
});
