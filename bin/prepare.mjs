#!/usr/bin/env node
/**
 * Conditional `prepare` script.
 *
 * `prepare` runs in three different scenarios with very different requirements:
 *
 * 1. `npm install` inside this repo (working copy) — devDependencies are
 *    available, but a build is unnecessary for everyday dev. Skip.
 * 2. `npm install -g <git-url>` or `npm install <git-url>` — npm clones the
 *    repo, installs both prod + dev deps, then runs `prepare`. We need to
 *    build so the `bin/huntflow.mjs` CLI has a `build/` directory to serve.
 * 3. `npm install <published-tarball>` — the tarball already contains
 *    `build/` (because it's in `files`), and devDependencies are NOT
 *    installed. We must skip; running `vite build` here would crash with
 *    "vite: command not found".
 *
 * Detection:
 * - If `build/index.html` already exists, do nothing (case 3 or rebuilt).
 * - If `node_modules/vite/package.json` is missing, do nothing (case 3).
 * - Otherwise, run `npm run build` (case 2 — and case 1 if user wants it).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const buildExists = existsSync(resolve(root, 'build', 'index.html'));
const viteInstalled = existsSync(resolve(root, 'node_modules', 'vite', 'package.json'));

if (buildExists) {
  // Already built (published tarball or previous local build). Nothing to do.
  process.exit(0);
}

if (!viteInstalled) {
  // devDependencies aren't available — this is a production install of a
  // published tarball. The tarball SHOULD have included a build, but if it
  // somehow didn't, we can't recover here. Exit cleanly so install succeeds.
  process.exit(0);
}

// Either a fresh git clone install or a working copy that hasn't been built
// yet. Run the production build so the CLI has assets to serve.
const result = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(result.status ?? 0);
