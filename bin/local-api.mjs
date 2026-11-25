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
        reject(Object.assign(new Error('Backup too large'), { status: 413 }));
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
export function createLocalApi({ backupDir = defaultBackupDir(), keep = DEFAULT_KEEP, version = '0.0.0', enabled = true } = {}) {
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
        }
      });
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
