// Convenience wrapper that ensures Playwright's Chromium is installed
// before invoking the capture script. Useful in fresh sandboxes / CI.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env }
    });
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    proc.on('error', reject);
  });
}

function chromiumInstalled() {
  // Playwright caches browsers under ~/.cache/ms-playwright on Linux.
  const cacheDir = path.join(homedir(), '.cache', 'ms-playwright');
  return existsSync(cacheDir);
}

async function main() {
  if (!chromiumInstalled()) {
    console.log('[screenshots] Installing Playwright Chromium...');
    await run('npx', ['--yes', 'playwright', 'install', '--with-deps', 'chromium']);
  }

  console.log('[screenshots] Capturing screens...');
  await run('node', ['scripts/capture-readme-screenshots.mjs']);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
