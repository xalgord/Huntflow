import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.HUNTFLOW_SCREENSHOT_URL ?? 'http://127.0.0.1:5173';
// We write into both `docs/screenshots/` (kept for the README)
// and `static/screenshots/` so SvelteKit serves the files at
// `/screenshots/<id>.png` on the live marketing site.
const docsOutputDir = path.resolve('docs/screenshots');
const landingOutputDir = path.resolve('static/screenshots');
const DB_NAME = 'huntflow';
const DB_VERSION = 4;

const ids = {
  neonBank: '11111111-1111-4111-8111-111111111111',
  cloudCart: '22222222-2222-4222-8222-222222222222',
  meshId: '33333333-3333-4333-8333-333333333333',
  note: '44444444-4444-4444-8444-444444444444'
};

async function main() {
  await Promise.all([mkdir(docsOutputDir, { recursive: true }), mkdir(landingOutputDir, { recursive: true })]);

  const server = await ensureServer();
  const browser = await chromium.launch();

  try {
    // 16:10 viewport (1600x1000) keeps the captured pixels lined up with
    // the marketing carousel's `aspect-[16/10]` frame so the screenshots
    // never letterbox or crop.
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
      colorScheme: 'dark',
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();

    await seedApp(page);

    // Original README captures - kept so existing docs links still resolve.
    await captureBoth(page, '/dashboard', 'dashboard.png');
    await captureBoth(page, `/targets/${ids.neonBank}`, 'target-detail.png', { docsOnly: true });
    await captureBoth(page, `/notes/${ids.note}`, 'notes-preview.png', {
      docsOnly: true,
      setup: async () => {
        // The note detail toolbar exposes a Preview toggle for markdown.
        const previewButton = page.getByRole('button', { name: /^preview$/i });
        if (await previewButton.count()) {
          await previewButton.first().click();
        }
      }
    });
    await captureBoth(page, '/income', 'income.png', { docsOnly: true });

    // Landing-page carousel captures. Filenames must match the `id`
    // values in `src/lib/components/landing/ScreenshotShowcase.svelte`.
    await captureBoth(page, '/timer', 'timer.png');
    await captureBoth(page, '/targets', 'targets.png');
    await captureBoth(page, `/notes/${ids.note}`, 'notes.png');
    await captureBoth(page, '/assets', 'evidence.png');
    await captureBoth(page, '/stats', 'stats.png');

    await context.close();
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
}

async function ensureServer() {
  if (await isServerReady()) return null;

  // Start a dedicated dev server bound to 127.0.0.1 so the script can run
  // unattended in CI. `--strictPort` ensures we fail fast if 5173 is busy
  // rather than silently grabbing a different port.
  const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--strictPort'], {
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      // Force-disable Clerk so the layout's auth gate doesn't redirect
      // anonymous Playwright sessions to /sign-in. The screenshots only
      // need to render the local-first workspace.
      VITE_CLERK_PUBLISHABLE_KEY: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let logs = '';
  server.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });

  await waitForServer(() => logs);
  return server;
}

async function isServerReady() {
  try {
    const response = await fetch(`${baseURL}/manifest.json`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(getLogs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60_000) {
    if (await isServerReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${baseURL}\n${getLogs()}`);
}

async function captureBoth(page, route, filename, options = {}) {
  const { setup, docsOnly = false } = options;
  await page.goto(`${baseURL}${route}`, { waitUntil: 'load' });
  await waitForAppReady(page);
  await setup?.();
  // Give animations / charts / canvas layouts one more frame to settle.
  await page.waitForTimeout(750);

  const screenshotOptions = {
    fullPage: false,
    animations: 'disabled',
    type: 'png'
  };

  // Always write to docs (existing README contract).
  await page.screenshot({
    ...screenshotOptions,
    path: path.join(docsOutputDir, filename)
  });

  // Mirror to static/screenshots so SvelteKit serves the same image at
  // /screenshots/<filename> for the marketing carousel.
  if (!docsOnly) {
    await page.screenshot({
      ...screenshotOptions,
      path: path.join(landingOutputDir, filename)
    });
  }
}

async function seedApp(page) {
  await page.goto(`${baseURL}/manifest.json`, { waitUntil: 'load' });
  const seed = createScreenshotSeed();

  await page.evaluate(
    async ({ dbName, dbVersion, seed }) => {
      localStorage.clear();
      sessionStorage.clear();

      function openDatabase() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName, dbVersion);

          request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains('sessions')) {
              const store = db.createObjectStore('sessions', { keyPath: 'id' });
              store.createIndex('by-target', 'targetId', { unique: false });
              store.createIndex('by-started', 'startedAt', { unique: false });
              store.createIndex('by-status', 'status', { unique: false });
            }

            if (!db.objectStoreNames.contains('notes')) {
              const store = db.createObjectStore('notes', { keyPath: 'id' });
              store.createIndex('by-target', 'targetId', { unique: false });
              store.createIndex('by-session', 'sessionId', { unique: false });
              store.createIndex('by-template', 'templateId', { unique: false });
              store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('targets')) {
              const store = db.createObjectStore('targets', { keyPath: 'id' });
              store.createIndex('by-platform', 'platform', { unique: false });
              store.createIndex('by-status', 'status', { unique: false });
              store.createIndex('by-priority', 'priority', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('payouts')) {
              const store = db.createObjectStore('payouts', { keyPath: 'id' });
              store.createIndex('by-platform', 'platform', { unique: false });
              store.createIndex('by-severity', 'severity', { unique: false });
              store.createIndex('by-status', 'status', { unique: false });
              store.createIndex('by-date', 'date', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('evidenceAssets')) {
              const store = db.createObjectStore('evidenceAssets', { keyPath: 'id' });
              store.createIndex('by-target', 'targetId', { unique: false });
              store.createIndex('by-session', 'sessionId', { unique: false });
              store.createIndex('by-note', 'noteId', { unique: false });
              store.createIndex('by-kind', 'kind', { unique: false });
              store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
              store.createIndex('by-sync-state', 'syncState', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('evidenceBlobs')) {
              const store = db.createObjectStore('evidenceBlobs', { keyPath: 'assetId' });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('evidenceLinks')) {
              const store = db.createObjectStore('evidenceLinks', { keyPath: 'id' });
              store.createIndex('by-from', 'fromKey', { unique: false });
              store.createIndex('by-to', 'toKey', { unique: false });
              store.createIndex('by-relationship', 'relationship', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('evidenceCanvasViews')) {
              const store = db.createObjectStore('evidenceCanvasViews', { keyPath: 'id' });
              store.createIndex('by-target', 'targetId', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('templates')) {
              const store = db.createObjectStore('templates', { keyPath: 'id' });
              store.createIndex('by-category', 'category', { unique: false });
            }

            // The remaining stores (reconAssets, payloads, checklist*, submissions,
            // bookmarks) were added at DB v4. We declare them so the app's openDB
            // call doesn't have to upgrade after seeding.
            if (!db.objectStoreNames.contains('reconAssets')) {
              const store = db.createObjectStore('reconAssets', { keyPath: 'id' });
              store.createIndex('by-target', 'targetId', { unique: false });
              store.createIndex('by-status', 'status', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('payloads')) {
              const store = db.createObjectStore('payloads', { keyPath: 'id' });
              store.createIndex('by-category', 'category', { unique: false });
              store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('checklistTemplates')) {
              const store = db.createObjectStore('checklistTemplates', { keyPath: 'id' });
              store.createIndex('by-kind', 'kind', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('checklistInstances')) {
              const store = db.createObjectStore('checklistInstances', { keyPath: 'id' });
              store.createIndex('by-target', 'targetId', { unique: false });
              store.createIndex('by-template', 'templateId', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('submissions')) {
              const store = db.createObjectStore('submissions', { keyPath: 'id' });
              store.createIndex('by-target', 'targetId', { unique: false });
              store.createIndex('by-status', 'status', { unique: false });
              store.createIndex('by-platform', 'platform', { unique: false });
              store.createIndex('by-severity', 'severity', { unique: false });
              store.createIndex('by-submittedAt', 'submittedAt', { unique: false });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('bookmarks')) {
              const store = db.createObjectStore('bookmarks', { keyPath: 'id' });
              store.createIndex('by-category', 'category', { unique: false });
              store.createIndex('by-tags', 'tags', { unique: false, multiEntry: true });
              store.createIndex('by-updated', 'updatedAt', { unique: false });
            }

            if (!db.objectStoreNames.contains('settings')) {
              db.createObjectStore('settings', { keyPath: 'key' });
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }

      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const stores = [
          'sessions',
          'notes',
          'targets',
          'payouts',
          'evidenceAssets',
          'evidenceBlobs',
          'evidenceLinks',
          'evidenceCanvasViews',
          'templates',
          'reconAssets',
          'payloads',
          'checklistTemplates',
          'checklistInstances',
          'submissions',
          'bookmarks',
          'settings'
        ];
        const tx = db.transaction(stores, 'readwrite');

        for (const store of stores) {
          tx.objectStore(store).clear();
        }

        for (const item of seed.sessions) tx.objectStore('sessions').put(item);
        for (const item of seed.notes) tx.objectStore('notes').put(item);
        for (const item of seed.targets) tx.objectStore('targets').put(item);
        for (const item of seed.payouts) tx.objectStore('payouts').put(item);
        for (const item of seed.evidenceAssets) tx.objectStore('evidenceAssets').put(item);
        for (const item of seed.evidenceLinks) tx.objectStore('evidenceLinks').put(item);
        for (const item of seed.evidenceCanvasViews) tx.objectStore('evidenceCanvasViews').put(item);
        for (const item of seed.submissions ?? []) tx.objectStore('submissions').put(item);
        for (const [key, value] of Object.entries(seed.settings)) tx.objectStore('settings').put({ key, value });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });

      localStorage.setItem('huntflow-cloud-last-sync-at', String(Date.now() - 1000 * 60 * 12));
      db.close();
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, seed }
  );
}

async function waitForAppReady(page) {
  await page.waitForFunction(() => document.documentElement.dataset.huntflowReady === 'true');
}

function createScreenshotSeed() {
  const now = Date.now();
  const day = 86_400_000;
  const atHour = (daysAgo, hour, minute = 0) => {
    const date = new Date(now - daysAgo * day);
    date.setHours(hour, minute, 0, 0);
    return date.getTime();
  };

  const sessions = [
    session('s-001', ids.neonBank, 0, 10, 120, 'completed', 'idor', ['critical', 'needs-report']),
    session('s-002', ids.neonBank, 1, 19, 95, 'completed', 'auth-bypass', ['high', 'oauth']),
    session('s-003', ids.cloudCart, 2, 14, 70, 'completed', 'xss', ['medium', 'stored-xss']),
    session('s-004', ids.meshId, 3, 21, 105, 'completed', 'ssrf', ['high', 'ssrf']),
    session('s-005', ids.neonBank, 4, 9, 55, 'completed', 'business-logic', ['impact']),
    session('s-006', ids.cloudCart, 5, 16, 80, 'completed', 'sql-injection', ['high']),
    session('s-007', ids.meshId, 7, 20, 45, 'completed', 'info-disclosure', ['medium']),
    session('s-008', ids.neonBank, 8, 11, 60, 'completed', 'idor', ['critical']),
    session('s-009', ids.cloudCart, 10, 13, 50, 'abandoned', 'xss', ['recon'])
  ];

  const targets = [
    {
      id: ids.neonBank,
      name: 'NeonBank',
      platform: 'hackerone',
      programUrl: 'https://hackerone.com/neonbank',
      scope: '*.neonbank.test\napi.neonbank.test\nmobile.neonbank.test',
      notes: 'Priority account linking, OAuth, and payments scope. Watch duplicate state and invoice exports.',
      priority: 0,
      status: 'reported',
      createdAt: now - 18 * day,
      updatedAt: now - 18 * 60_000,
      lastSessionAt: atHour(0, 10),
      sessionCount: 4
    },
    {
      id: ids.cloudCart,
      name: 'CloudCart',
      platform: 'bugcrowd',
      programUrl: 'https://bugcrowd.com/cloudcart',
      scope: 'app.cloudcart.test\nadmin.cloudcart.test\n*.cdn.cloudcart.test',
      notes: 'Marketplace checkout and seller dashboard testing.',
      priority: 1,
      status: 'testing',
      createdAt: now - 24 * day,
      updatedAt: now - 3 * 60_000,
      lastSessionAt: atHour(2, 14),
      sessionCount: 2
    },
    {
      id: ids.meshId,
      name: 'MeshID',
      platform: 'intigriti',
      programUrl: 'https://intigriti.com/programs/meshid',
      scope: 'api.meshid.test\nidp.meshid.test',
      notes: 'Identity provider and SSO broker. Paid SSRF chain retained for regression checks.',
      priority: 2,
      status: 'paid',
      createdAt: now - 42 * day,
      updatedAt: now - day,
      lastSessionAt: atHour(3, 21),
      sessionCount: 2
    }
  ];

  const notes = [
    {
      id: ids.note,
      title: 'OAuth callback state reuse',
      content:
        '# OAuth callback state reuse\n\n## Summary\nThe OAuth callback accepts a stale `state` value after logout. A captured callback can be replayed into a fresh browser session and links the victim account to an attacker-controlled connector.\n\n## Steps to Reproduce\n1. Start an OAuth connection from Account A.\n2. Capture the `/oauth/callback?code=...&state=...` URL.\n3. Log out, sign into Account B, and replay the callback.\n4. Observe Account B receiving the Account A connector.\n\n## Impact\nAttackers can pivot across linked financial accounts and export invoices for another tenant.\n\n```http\nGET /oauth/callback?code=redacted&state=stale_state HTTP/2\nHost: api.neonbank.test\n```\n\n## Recommended Fix\nBind `state` to the authenticated session and expire it immediately after the first callback attempt.',
      targetId: ids.neonBank,
      sessionId: 's-001',
      templateId: 'auth-bypass',
      tags: ['critical', 'needs-report', 'oauth'],
      createdAt: now - 5 * day,
      updatedAt: now - 12 * 60_000
    },
    {
      id: 'note-cloudcart-xss',
      title: 'Stored XSS in seller receipt template',
      content: '## Summary\nSeller receipt names render without output encoding in the admin preview.',
      targetId: ids.cloudCart,
      sessionId: 's-003',
      templateId: 'xss',
      tags: ['medium', 'stored-xss'],
      createdAt: now - 2 * day,
      updatedAt: now - 2 * day
    },
    {
      id: 'note-meshid-ssrf',
      title: 'SSRF through avatar fetcher',
      content: '## Summary\nThe avatar fetcher follows internal redirects and exposes metadata responses.',
      targetId: ids.meshId,
      sessionId: 's-004',
      templateId: 'ssrf',
      tags: ['high', 'paid'],
      createdAt: now - 3 * day,
      updatedAt: now - day
    }
  ];

  const payouts = [
    payout('p-001', 'MeshID', 'intigriti', 'high', 7200, 12, 'paid'),
    payout('p-002', 'NeonBank', 'hackerone', 'critical', 12500, 1, 'triaged'),
    payout('p-003', 'CloudCart', 'bugcrowd', 'medium', 1800, 2, 'pending'),
    payout('p-004', 'NeonBank', 'hackerone', 'high', 4200, 18, 'paid'),
    payout('p-005', 'MeshID', 'intigriti', 'medium', 950, 31, 'paid')
  ];

  const evidenceAssets = [
    evidenceAsset(
      'e-001',
      'OAuth replay screenshot',
      'image',
      ids.neonBank,
      's-002',
      ids.note,
      ['critical', 'needs-report'],
      96_000
    ),
    evidenceAsset('e-002', 'Invoice export request', 'request', ids.neonBank, 's-001', ids.note, ['critical'], 1_240),
    evidenceAsset('e-003', 'Avatar metadata URL', 'url', ids.meshId, 's-004', 'note-meshid-ssrf', ['high', 'paid'], 0),
    evidenceAsset(
      'e-004',
      'Stored XSS payload preview',
      'image',
      ids.cloudCart,
      's-003',
      'note-cloudcart-xss',
      ['medium', 'stored-xss'],
      62_400
    ),
    evidenceAsset(
      'e-005',
      'IDOR account-link burp log',
      'request',
      ids.neonBank,
      's-008',
      ids.note,
      ['critical'],
      2_180
    )
  ];

  const evidenceLinks = [
    {
      id: 'el-001',
      fromType: 'asset',
      fromId: 'e-001',
      fromKey: 'asset:e-001',
      toType: 'note',
      toId: ids.note,
      toKey: `note:${ids.note}`,
      relationship: 'proves',
      label: 'primary proof',
      createdAt: now - day,
      updatedAt: now - day
    }
  ];

  // A small handful of submissions so the dashboard's "Bounty desk" panel
  // and any submissions chips show real-looking activity.
  const submissions = [
    {
      id: 'sub-001',
      title: 'OAuth callback state reuse',
      targetId: ids.neonBank,
      platform: 'hackerone',
      severity: 'critical',
      status: 'triaged',
      bounty: 12500,
      submittedAt: atHour(1, 11),
      lastStatusAt: atHour(0, 9),
      createdAt: atHour(1, 11),
      updatedAt: now - 12 * 60_000
    },
    {
      id: 'sub-002',
      title: 'SSRF through avatar fetcher',
      targetId: ids.meshId,
      platform: 'intigriti',
      severity: 'high',
      status: 'paid',
      bounty: 7200,
      submittedAt: atHour(12, 14),
      lastStatusAt: atHour(8, 10),
      createdAt: atHour(12, 14),
      updatedAt: now - 6 * 60 * 60 * 1000
    },
    {
      id: 'sub-003',
      title: 'Stored XSS in seller receipt template',
      targetId: ids.cloudCart,
      platform: 'bugcrowd',
      severity: 'medium',
      status: 'submitted',
      bounty: 1800,
      submittedAt: atHour(2, 16),
      lastStatusAt: atHour(2, 16),
      createdAt: atHour(2, 16),
      updatedAt: now - 30 * 60 * 1000
    }
  ];

  return {
    targets,
    sessions,
    notes,
    payouts,
    evidenceAssets,
    evidenceLinks,
    evidenceCanvasViews: [],
    submissions,
    settings: {
      defaultDuration: 1500,
      autoStartBreak: true,
      breakDuration: 300,
      sessionsBeforeLongBreak: 4,
      longBreakDuration: 900,
      soundEnabled: true,
      vibrationEnabled: true,
      theme: 'dark',
      accentColor: 'green',
      fontSize: 'medium',
      onboardingCompleted: true
    }
  };

  function session(id, targetId, daysAgo, hour, minutes, status, templateId, tags) {
    const startedAt = atHour(daysAgo, hour, 15);
    return {
      id,
      targetId,
      durationPlanned: 1500,
      durationActual: minutes * 60,
      startedAt,
      endedAt: startedAt + minutes * 60_000,
      status,
      templateId,
      quickNote: `${templateId} verification block for screenshot sample data.`,
      tags
    };
  }

  function evidenceAsset(id, title, kind, targetId, sessionId, noteId, tags, size) {
    const createdAt = now - day;
    const fileName = kind === 'url' ? undefined : `${id}.${kind === 'image' ? 'png' : 'txt'}`;
    const folderPath = kind === 'url' ? undefined : targetId === ids.neonBank ? 'neonbank/oauth' : 'meshid/recon';
    return {
      id,
      title,
      kind,
      source: kind === 'url' ? 'url' : 'upload',
      mimeType: kind === 'url' ? 'text/uri-list' : kind === 'image' ? 'image/png' : 'text/plain',
      size,
      fileName,
      relativePath: fileName && folderPath ? `${folderPath}/${fileName}` : undefined,
      folderPath,
      url: kind === 'url' ? 'https://metadata.meshid.test/latest' : undefined,
      description: 'Seeded evidence for README screenshots.',
      targetId,
      sessionId,
      noteId,
      tags,
      syncState: kind === 'url' ? 'synced' : 'pending-upload',
      capturedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    };
  }

  function payout(id, program, platform, severity, amount, daysAgo, status) {
    return {
      id,
      program,
      platform,
      severity,
      amount,
      date: atHour(daysAgo, 12),
      status,
      createdAt: atHour(daysAgo, 12),
      updatedAt: now - 15 * 60_000
    };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
