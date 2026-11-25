#!/usr/bin/env node

/**
 * HuntFlow CLI
 *
 * Usage:
 *   npx huntflow          # Start on default port 3000
 *   npx huntflow --port 8080
 *   npx huntflow -p 8080
 *   npx huntflow --help
 *
 * This serves the pre-built static SvelteKit app with a tiny HTTP server,
 * then opens the browser automatically.
 */

import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { createLocalApi, defaultBackupDir, DEFAULT_KEEP } from './local-api.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, '..', 'build');

// MIME types for common static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json'
};

function parseArgs() {
  const args = process.argv.slice(2);
  let port = 3000;
  // Undefined keeps Node's default dual-stack bind, so `localhost` works
  // whether it resolves to 127.0.0.1 or ::1. The backup API rejects any
  // non-loopback client regardless of this setting.
  let host;
  let help = false;
  let backups = true;
  let backupDir = defaultBackupDir();
  let keep = DEFAULT_KEEP;
  let open = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--port' || arg === '-p') {
      port = parseInt(args[++i], 10) || 3000;
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1], 10) || 3000;
    } else if (arg === '--host') {
      host = args[++i] || host;
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || host;
    } else if (arg === '--no-backup') {
      backups = false;
    } else if (arg === '--backup-dir') {
      backupDir = args[++i] || backupDir;
    } else if (arg.startsWith('--backup-dir=')) {
      backupDir = arg.slice('--backup-dir='.length) || backupDir;
    } else if (arg.startsWith('--keep=')) {
      keep = Math.max(1, parseInt(arg.split('=')[1], 10) || DEFAULT_KEEP);
    } else if (arg === '--no-open') {
      open = false;
    }
  }

  return { port, host, help, backups, backupDir, keep, open };
}

function readVersion() {
  try {
    return JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function showHelp() {
  console.log(`
HuntFlow - Pentest Workflow Companion

Usage:
  huntflow [options]

Options:
  -p, --port <number>     Port to run on (default: 3000)
      --host <address>    Interface to listen on (default: all; use
                          127.0.0.1 to keep the app off your network)
      --backup-dir <dir>  Where automatic backups are written
                          (default: ~/.huntflow/backups)
      --keep=<n>          Number of backups to keep (default: ${DEFAULT_KEEP})
      --no-backup         Don't write automatic backups to disk
      --no-open           Don't open a browser window
  -h, --help              Show this help message

Examples:
  npx huntflow              Start on http://localhost:3000
  npx huntflow -p 8080      Start on http://localhost:8080
  huntflow --port=4000      Start on http://localhost:4000

Your data is stored locally in your browser (IndexedDB) and, while
HuntFlow runs from this command, mirrored to rotating backup files on
disk. No account required. Works offline.
`);
}

function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    // Linux and others
    command = `xdg-open "${url}" || sensible-browser "${url}" || x-www-browser "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`  Open manually: ${url}`);
    }
  });
}

// Marks pages served by this CLI so the app knows the local backup API
// exists (and never probes for it on the hosted site).
const LOCAL_MARKER = '<meta name="huntflow-local" content="1" />';

function serveFile(res, filePath) {
  try {
    let content = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    if (ext === '.html') {
      content = Buffer.from(content.toString('utf8').replace('<head>', `<head>\n    ${LOCAL_MARKER}`));
    }
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

function startServer({ port, host, backups, backupDir, keep, open }) {
  if (!existsSync(BUILD_DIR)) {
    console.error(`
Error: Build directory not found at ${BUILD_DIR}

If you installed from npm, this shouldn't happen.
If running from source, run 'npm run build' first.
`);
    process.exit(1);
  }

  const localApi = createLocalApi({ backupDir, keep, version: readVersion(), enabled: backups });

  const server = createServer(async (req, res) => {
    try {
      if (await localApi(req, res)) return;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal error');
      console.error('[huntflow] local API error:', error);
      return;
    }

    let urlPath = req.url?.split('?')[0] || '/';

    // Decode URI components
    try {
      urlPath = decodeURIComponent(urlPath);
    } catch {
      // Invalid URL encoding
    }

    // Security: prevent directory traversal
    if (urlPath.includes('..')) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // Try exact path first
    let filePath = join(BUILD_DIR, urlPath);

    // If it's a directory, try index.html
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    // Try serving the exact file
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      if (serveFile(res, filePath)) return;
    }

    // Try adding .html extension
    if (existsSync(filePath + '.html')) {
      if (serveFile(res, filePath + '.html')) return;
    }

    // SPA fallback: only fall through to the static-adapter shell when
    // the request actually wants HTML. Otherwise we'd return an HTML
    // body for a missing /icons/foo.png with a 200 status, which would
    // poison the service-worker cache and break image rendering.
    const acceptHeader = req.headers['accept'] ?? '';
    const wantsHtml =
      typeof acceptHeader === 'string' && acceptHeader.includes('text/html');
    if (wantsHtml) {
      // Prefer the adapter-static fallback (200.html) when present, then
      // fall back to a prerendered index.html for older builds.
      const fallbackPath = join(BUILD_DIR, '200.html');
      if (existsSync(fallbackPath)) {
        if (serveFile(res, fallbackPath)) return;
      }
      const legacyFallbackPath = join(BUILD_DIR, 'index.html');
      if (existsSync(legacyFallbackPath)) {
        if (serveFile(res, legacyFallbackPath)) return;
      }
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const onListening = () => {
    const url = `http://localhost:${port}`;
    console.log(`
  ╭──────────────────────────────────────────────╮
  │                                              │
  │   HuntFlow is running!                       │
  │                                              │
  │   Local:   ${url.padEnd(30)}│
  │                                              │
  │   Press Ctrl+C to stop                       │
  │                                              │
  ╰──────────────────────────────────────────────╯
`);
    console.log(
      backups
        ? `  Backups: ${backupDir} (keeps last ${keep})\n`
        : '  Backups: disabled (--no-backup)\n'
    );
    if (open) openBrowser(url);
  };
  if (host) server.listen(port, host, onListening);
  else server.listen(port, onListening);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use.`);
      console.error(`Try: huntflow --port ${port + 1}`);
      process.exit(1);
    }
    throw err;
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => {
      process.exit(0);
    });
  });
}

// Main
const options = parseArgs();

if (options.help) {
  showHelp();
  process.exit(0);
}

startServer(options);
