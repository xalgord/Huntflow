/**
 * Local companion API for `npx huntflow`.
 *
 * The browser keeps the workspace in IndexedDB, which browsers may evict
 * under storage pressure (Safari also clears it after weeks of inactivity).
 * When HuntFlow is served by this CLI, the app mirrors full backups to disk
 * so a cleared browser never means lost findings.
 *
 * Endpoints (all under /api/huntflow, all localhost-only):
 *   GET    /api/huntflow/status                  → { app, version, backups: {...} }
 *   GET    /api/huntflow/backups                 → [{ name, size, createdAt }]
 *   GET    /api/huntflow/backups/:name           → backup file
 *   POST   /api/huntflow/backups                 → write a backup, rotate old ones
 *   GET    /api/huntflow/inbox                   → items queued by `huntflow push`
 *   GET    /api/huntflow/inbox/:id               → one item, including its text
 *   POST   /api/huntflow/inbox                   → queue tool output for import
 *   DELETE /api/huntflow/inbox/:id               → remove an item once handled
 *
 * Security model:
 * - Requests must come from a loopback address.
 * - Every request must carry `X-HuntFlow-Client: 1`. Browsers can't send a
 *   custom header cross-origin without a CORS preflight, which we never
 *   approve — so other websites can't read or write backups.
 * - If an Origin header is present it must match the Host.
 * - File names are generated server-side; requested names are validated
 *   against a strict pattern (no path traversal).
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const API_PREFIX = '/api/huntflow';
export const CLIENT_HEADER = 'x-huntflow-client';
export const DEFAULT_KEEP = 30;
export const MAX_BODY_BYTES = 512 * 1024 * 1024;
const NAME_PATTERN = /^huntflow-backup-\d{8}T\d{6}(?:\d{3})?Z\.json$/;

export function defaultBackupDir() {
  return join(homedir(), '.huntflow', 'backups');
}

// ─── Inbox: tool output piped in with `huntflow push` ────────────────────

export const MAX_INBOX_BYTES = 25 * 1024 * 1024;
const INBOX_PATTERN = /^inbox-\d{8}T\d{9}Z-[0-9a-f]{8}$/;
export const IMPORT_KINDS = ['h1-scope-csv', 'scope-text', 'hosts', 'httpx', 'nuclei', 'nmap', 'burp'];

export function defaultInboxDir() {
  return join(homedir(), '.huntflow', 'inbox');
}

/** Validate and normalise an inbox submission. Returns null when invalid. */
export function normaliseInboxItem(value) {
  if (!value || typeof value !== 'object' || typeof value.text !== 'string' || !value.text.trim()) return null;
  const clip = (input, max) => (typeof input === 'string' && input.trim() ? input.trim().slice(0, max) : undefined);
  return {
    text: value.text,
    program: clip(value.program, 200),
    kind: IMPORT_KINDS.includes(value.kind) ? value.kind : undefined,
    fileName: clip(value.fileName, 200)?.replace(/[\\/]/g, '_'),
    source: clip(value.source, 40) ?? 'cli'
  };
}

/** Write an inbox item atomically and return its summary. */
export function writeInboxItem(dir, value, now = new Date()) {
  const item = normaliseInboxItem(value);
  if (!item) throw Object.assign(new Error('Nothing to import: the body has no text.'), { status: 400 });
  const id = `inbox-${now.toISOString().replace(/[-:]/g, '').replace('.', '')}-${randomBytes(4).toString('hex')}`;
  const record = { id, receivedAt: now.getTime(), bytes: Buffer.byteLength(item.text), lines: item.text.split('\n').filter((line) => line.trim()).length, ...item };
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const finalPath = join(dir, `${id}.json`);
  writeFileSync(`${finalPath}.partial`, JSON.stringify(record), { mode: 0o600 });
  renameSync(`${finalPath}.partial`, finalPath);
  return summarise(record);
}

function summarise(record) {
  const { text, ...rest } = record;
  const firstLine = text.split('\n').find((line) => line.trim()) ?? '';
  return { ...rest, preview: firstLine.slice(0, 160) };
}

export function readInboxItem(dir, id) {
  if (!INBOX_PATTERN.test(id)) return null;
  try {
    return JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

// The app polls the inbox; cache summaries so big items are parsed once.
const summaryCache = new Map();

export function listInbox(dir) {
  let names = [];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.json') && INBOX_PATTERN.test(name.slice(0, -5)));
  } catch {
    return [];
  }
  const items = [];
  for (const name of names.sort()) {
    const path = join(dir, name);
    const cached = summaryCache.get(path);
    if (cached) {
      items.push(cached);
      continue;
    }
    const record = readInboxItem(dir, name.slice(0, -5));
    if (!record) continue;
    const summary = summarise(record);
    summaryCache.set(path, summary);
    items.push(summary);
  }
  return items;
}

export function deleteInboxItem(dir, id) {
  if (!INBOX_PATTERN.test(id)) return false;
  try {
    summaryCache.delete(join(dir, `${id}.json`));
    unlinkSync(join(dir, `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

function isLoopback(address) {
  if (!address) return false;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address.startsWith('127.');
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(payload);
}

function timestampName(date = new Date()) {
  const iso = date.toISOString().replace(/[-:]/g, '').replace('.', '');
  // 20261126T031522123Z
  return `huntflow-backup-${iso}.json`;
}

export function listBackups(dir) {
  let names = [];
  try {
    names = readdirSync(dir).filter((name) => NAME_PATTERN.test(name));
  } catch {
    return [];
  }
  return names
    .map((name) => {
      const stats = statSync(join(dir, name));
      return { name, size: stats.size, createdAt: stats.mtimeMs };
    })
    // Names embed an ISO timestamp, so lexical order is chronological and
    // stable even when several backups share a filesystem mtime.
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

export function rotateBackups(dir, keep = DEFAULT_KEEP) {
  const backups = listBackups(dir);
  for (const stale of backups.slice(keep)) {
    try {
      unlinkSync(join(dir, stale.name));
    } catch {
      /* already gone */
    }
  }
}

/** Validate that a POSTed body looks like a HuntFlow backup bundle. */
export function isBackupBundle(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.magic === 'HUNTFLOW-BACKUP' &&
    typeof value.version === 'number' &&
    (typeof value.payload === 'object' || typeof value.ciphertext === 'string')
  );
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Returns a request handler, or `null` when backups are disabled. The
 * handler returns `true` when it handled the request.
 */
export function createLocalApi({
  backupDir = defaultBackupDir(),
  inboxDir = defaultInboxDir(),
  keep = DEFAULT_KEEP,
  version = '0.0.0',
  enabled = true
} = {}) {
  return async function handle(req, res) {
    const url = req.url?.split('?')[0] ?? '';
    if (!url.startsWith(API_PREFIX)) return false;

    if (!isLoopback(req.socket?.remoteAddress)) {
      json(res, 403, { error: 'HuntFlow local API only accepts connections from this machine.' });
      return true;
    }
    if (req.headers[CLIENT_HEADER] !== '1') {
      json(res, 403, { error: 'Missing HuntFlow client header.' });
      return true;
    }
    const origin = req.headers.origin;
    if (origin) {
      let originHost = '';
      try {
        originHost = new URL(origin).host;
      } catch {
        /* invalid origin */
      }
      if (originHost !== req.headers.host) {
        json(res, 403, { error: 'Cross-origin requests are not allowed.' });
        return true;
      }
    }

    const route = url.slice(API_PREFIX.length) || '/';

    if (req.method === 'GET' && route === '/status') {
      const backups = enabled ? listBackups(backupDir) : [];
      json(res, 200, {
        app: 'huntflow',
        version,
        backups: {
          enabled,
          dir: enabled ? backupDir : null,
          count: backups.length,
          keep,
          latestAt: backups[0]?.createdAt ?? null
        },
        inbox: { count: listInbox(inboxDir).length }
      });
      return true;
    }

    // The inbox works with or without disk backups.
    if (route === '/inbox' || route.startsWith('/inbox/')) {
      const id = route.startsWith('/inbox/') ? decodeURIComponent(route.slice('/inbox/'.length)) : '';
      if (req.method === 'GET' && !id) {
        json(res, 200, listInbox(inboxDir));
      } else if (req.method === 'GET') {
        const item = readInboxItem(inboxDir, id);
        if (item) json(res, 200, item);
        else json(res, 404, { error: 'Inbox item not found.' });
      } else if (req.method === 'DELETE' && id) {
        json(res, deleteInboxItem(inboxDir, id) ? 200 : 404, { id });
      } else if (req.method === 'POST' && !id) {
        try {
          const body = await readBody(req, MAX_INBOX_BYTES + 64 * 1024);
          let parsed;
          try {
            parsed = JSON.parse(body.toString('utf8'));
          } catch {
            json(res, 400, { error: 'Body is not valid JSON.' });
            return true;
          }
          if (typeof parsed?.text === 'string' && Buffer.byteLength(parsed.text) > MAX_INBOX_BYTES) {
            json(res, 413, { error: 'Output is larger than 25 MB. Filter it first.' });
            return true;
          }
          json(res, 201, writeInboxItem(inboxDir, parsed));
        } catch (error) {
          json(res, error?.status ?? 500, { error: error?.message ?? 'Could not queue the import.' });
        }
      } else {
        json(res, 405, { error: 'Method not allowed.' });
      }
      return true;
    }

    if (!enabled) {
      json(res, 404, { error: 'Disk backups are disabled (started with --no-backup).' });
      return true;
    }

    if (req.method === 'GET' && route === '/backups') {
      json(res, 200, listBackups(backupDir));
      return true;
    }

    if (req.method === 'GET' && route.startsWith('/backups/')) {
      const name = decodeURIComponent(route.slice('/backups/'.length));
      if (!NAME_PATTERN.test(name)) {
        json(res, 400, { error: 'Invalid backup name.' });
        return true;
      }
      try {
        const content = readFileSync(join(backupDir, name));
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': content.length,
          'Cache-Control': 'no-store'
        });
        res.end(content);
      } catch {
        json(res, 404, { error: 'Backup not found.' });
      }
      return true;
    }

    if (req.method === 'POST' && route === '/backups') {
      try {
        const body = await readBody(req, MAX_BODY_BYTES);
        let parsed;
        try {
          parsed = JSON.parse(body.toString('utf8'));
        } catch {
          json(res, 400, { error: 'Body is not valid JSON.' });
          return true;
        }
        if (!isBackupBundle(parsed)) {
          json(res, 400, { error: 'Body is not a HuntFlow backup bundle.' });
          return true;
        }
        mkdirSync(backupDir, { recursive: true, mode: 0o700 });
        const name = timestampName();
        const finalPath = join(backupDir, name);
        const tempPath = `${finalPath}.partial`;
        // Write-then-rename so a crash never leaves a truncated backup.
        writeFileSync(tempPath, body, { mode: 0o600 });
        renameSync(tempPath, finalPath);
        rotateBackups(backupDir, keep);
        json(res, 201, { name, size: body.length, createdAt: Date.now(), dir: backupDir });
      } catch (error) {
        json(res, error?.status ?? 500, { error: error?.message ?? 'Could not write backup.' });
      }
      return true;
    }

    json(res, 404, { error: 'Unknown HuntFlow API route.' });
    return true;
  };
}
