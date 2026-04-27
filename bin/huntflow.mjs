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
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--port' || arg === '-p') {
      port = parseInt(args[++i], 10) || 3000;
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1], 10) || 3000;
    }
  }

  return { port, help };
}

function showHelp() {
  console.log(`
HuntFlow - Bug Bounty Hunting Companion

Usage:
  huntflow [options]

Options:
  -p, --port <number>   Port to run on (default: 3000)
  -h, --help            Show this help message

Examples:
  npx huntflow              Start on http://localhost:3000
  npx huntflow -p 8080      Start on http://localhost:8080
  huntflow --port=4000      Start on http://localhost:4000

Your data is stored locally in your browser (IndexedDB).
No account required. Works offline.
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

function serveFile(res, filePath) {
  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
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

function startServer(port) {
  if (!existsSync(BUILD_DIR)) {
    console.error(`
Error: Build directory not found at ${BUILD_DIR}

If you installed from npm, this shouldn't happen.
If running from source, run 'npm run build' first.
`);
    process.exit(1);
  }

  const server = createServer((req, res) => {
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

    // SPA fallback: serve index.html for client-side routing
    const fallbackPath = join(BUILD_DIR, 'index.html');
    if (existsSync(fallbackPath)) {
      if (serveFile(res, fallbackPath)) return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(port, () => {
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
    openBrowser(url);
  });

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
const { port, help } = parseArgs();

if (help) {
  showHelp();
  process.exit(0);
}

startServer(port);
