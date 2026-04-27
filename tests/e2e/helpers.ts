import { expect, type Page } from '@playwright/test';

const DB_NAME = 'huntflow';
const DB_VERSION = 3;
export const seedIds = {
  target: '11111111-1111-4111-8111-111111111111',
  session: '22222222-2222-4222-8222-222222222222',
  note: '33333333-3333-4333-8333-333333333333',
  payout: '44444444-4444-4444-8444-444444444444',
  asset: '55555555-5555-4555-8555-555555555555'
};

// Public marketing root (`/`) and the in-app dashboard (`/dashboard`) are
// both smoke-tested. `/landing` is kept as a redirect for back-compat but
// not exercised here because Playwright would just chase the 302 to `/`.
export const routes = ['/', '/dashboard', '/timer', '/targets', '/notes', '/assets', '/stats', '/income', '/settings'];

export interface ConsoleWatcher {
  errors: string[];
  assertClean(): Promise<void>;
}

export function watchConsole(page: Page): ConsoleWatcher {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });

  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  return {
    errors,
    async assertClean() {
      await expect(page.locator('body')).not.toContainText(/Internal Error|500|Cannot access .* before initialization/i);
      expect(errors).toEqual([]);
    }
  };
}

export async function dismissOnboarding(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

export async function seedEmptyApp(page: Page): Promise<void> {
  await openStoragePage(page);
  await seedIndexedDB(page, { targets: [], sessions: [], notes: [], payouts: [], evidenceAssets: [], evidenceLinks: [], evidenceCanvasViews: [] });
  // After seeding, land on the app dashboard rather than the marketing
  // landing page, so subsequent assertions target the actual workspace.
  await gotoAppRoute(page, '/dashboard');
}

export async function seedDemoApp(page: Page): Promise<TestSeed> {
  const now = Date.now();
  const todayStartedAt = new Date();
  todayStartedAt.setHours(10, 15, 0, 0);

  const seed: TestSeed = {
    target: {
      id: seedIds.target,
      name: 'NeonBank',
      platform: 'hackerone',
      programUrl: 'https://hackerone.com/neonbank',
      scope: '*.neonbank.test\napi.neonbank.test',
      notes: 'OAuth and payments scope.',
      priority: 1,
      status: 'recon',
      createdAt: now - 86_400_000 * 5,
      updatedAt: now - 60_000,
      lastSessionAt: todayStartedAt.getTime(),
      sessionCount: 1
    },
    session: {
      id: seedIds.session,
      targetId: seedIds.target,
      durationPlanned: 1500,
      durationActual: 900,
      startedAt: todayStartedAt.getTime(),
      endedAt: todayStartedAt.getTime() + 900_000,
      status: 'completed',
      quickNote: 'PKCE state reuse is reproducible.',
      tags: ['high', 'needs-report']
    },
    note: {
      id: seedIds.note,
      title: 'OAuth callback state reuse',
      content:
        '# OAuth callback state reuse\n\n## Summary\nState token can be replayed between sessions.\n\n## Steps to Reproduce\n1. Start login.\n2. Reuse stale state.\n\n## Impact\nAccount takeover path for linked sessions.',
      targetId: seedIds.target,
      sessionId: seedIds.session,
      tags: ['high', 'needs-report'],
      createdAt: now - 3_600_000,
      updatedAt: now - 60_000
    },
    payout: {
      id: seedIds.payout,
      program: 'NeonBank',
      platform: 'hackerone',
      severity: 'high',
      amount: 8400,
      date: now,
      status: 'triaged',
      createdAt: now - 3_600_000,
      updatedAt: now - 60_000
    },
    asset: {
      id: seedIds.asset,
      title: 'Replay proof screenshot',
      kind: 'url',
      source: 'url',
      mimeType: 'text/uri-list',
      size: 0,
      url: 'https://example.com/replay-proof',
      description: 'Hosted proof showing stale state replay.',
      targetId: seedIds.target,
      sessionId: seedIds.session,
      noteId: seedIds.note,
      tags: ['high', 'needs-report'],
      syncState: 'synced',
      capturedAt: now - 30_000,
      createdAt: now - 30_000,
      updatedAt: now - 30_000
    }
  };

  await openStoragePage(page);
  await seedIndexedDB(page, {
    targets: [seed.target],
    sessions: [seed.session],
    notes: [seed.note],
    payouts: [seed.payout],
    evidenceAssets: [seed.asset],
    evidenceLinks: [],
    evidenceCanvasViews: []
  });
  await page.evaluate(() => localStorage.setItem('huntflow-cloud-last-sync-at', String(Date.now())));
  await gotoAppRoute(page, '/dashboard');
  return seed;
}

export async function seedFirstRunApp(page: Page): Promise<void> {
  await openStoragePage(page);
  await seedIndexedDB(page, { targets: [], sessions: [], notes: [], payouts: [], evidenceAssets: [], evidenceLinks: [], evidenceCanvasViews: [] }, false);
  // First-run flow lives inside the app shell, so land on the dashboard
  // (the onboarding modal opens there).
  await gotoAppRoute(page, '/dashboard');
}

export async function gotoAppRoute(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'load' });
  await waitForAppReady(page);
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.huntflowReady === 'true');
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function expectSeoBasics(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/\S/);
  const description = await page.locator('meta[name="description"]').last().getAttribute('content');
  expect(description?.trim().length ?? 0).toBeGreaterThan(20);
  await expect(page.locator('link[rel="canonical"]').last()).toHaveAttribute('href', /http:\/\/127\.0\.0\.1:5173/);
  await expect(page.locator('meta[name="robots"]').last()).toHaveAttribute('content', /index,follow/);
}

export async function expectContrastAtLeast(page: Page, selector: string, minimum = 4.5): Promise<void> {
  const contrast = await page.locator(selector).first().evaluate((element) => {
    function parseRgb(value: string): [number, number, number] | null {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    }

    function channel(value: number): number {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }

    function luminance([red, green, blue]: [number, number, number]): number {
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
    }

    function effectiveBackground(start: Element): [number, number, number] {
      let current: Element | null = start;
      while (current) {
        const background = getComputedStyle(current).backgroundColor;
        const parsed = parseRgb(background);
        if (parsed && !background.endsWith(', 0)') && background !== 'transparent') return parsed;
        current = current.parentElement;
      }
      return parseRgb(getComputedStyle(document.body).backgroundColor) ?? [0, 0, 0];
    }

    const styles = getComputedStyle(element);
    const foreground = luminance(parseRgb(styles.color) ?? [255, 255, 255]);
    const background = luminance(effectiveBackground(element));
    const lighter = Math.max(foreground, background);
    const darker = Math.min(foreground, background);
    return (lighter + 0.05) / (darker + 0.05);
  });

  expect(contrast).toBeGreaterThanOrEqual(minimum);
}

async function seedIndexedDB(
  page: Page,
  seed: {
    targets: unknown[];
    sessions: unknown[];
    notes: unknown[];
    payouts: unknown[];
    evidenceAssets?: unknown[];
    evidenceLinks?: unknown[];
    evidenceCanvasViews?: unknown[];
  },
  onboardingCompleted = true
): Promise<void> {
  await page.evaluate(
    async ({ dbName, dbVersion, seed, onboardingCompleted }) => {
      localStorage.clear();
      sessionStorage.clear();

      function openDatabase(): Promise<IDBDatabase> {
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
              db.createObjectStore('evidenceBlobs', { keyPath: 'assetId' }).createIndex('by-updated', 'updatedAt', {
                unique: false
              });
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
              db.createObjectStore('templates', { keyPath: 'id' }).createIndex('by-category', 'category', {
                unique: false
              });
            }
            if (!db.objectStoreNames.contains('settings')) {
              db.createObjectStore('settings', { keyPath: 'key' });
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }

      const settings = {
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
        onboardingCompleted
      };

      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          ['sessions', 'notes', 'targets', 'payouts', 'evidenceAssets', 'evidenceBlobs', 'evidenceLinks', 'evidenceCanvasViews', 'templates', 'settings'],
          'readwrite'
        );

        tx.objectStore('sessions').clear();
        tx.objectStore('notes').clear();
        tx.objectStore('targets').clear();
        tx.objectStore('payouts').clear();
        tx.objectStore('evidenceAssets').clear();
        tx.objectStore('evidenceBlobs').clear();
        tx.objectStore('evidenceLinks').clear();
        tx.objectStore('evidenceCanvasViews').clear();
        tx.objectStore('templates').clear();
        tx.objectStore('settings').clear();

        for (const item of seed.sessions) tx.objectStore('sessions').put(item);
        for (const item of seed.notes) tx.objectStore('notes').put(item);
        for (const item of seed.targets) tx.objectStore('targets').put(item);
        for (const item of seed.payouts) tx.objectStore('payouts').put(item);
        for (const item of seed.evidenceAssets ?? []) tx.objectStore('evidenceAssets').put(item);
        for (const item of seed.evidenceLinks ?? []) tx.objectStore('evidenceLinks').put(item);
        for (const item of seed.evidenceCanvasViews ?? []) tx.objectStore('evidenceCanvasViews').put(item);
        for (const [key, value] of Object.entries(settings)) tx.objectStore('settings').put({ key, value });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, seed, onboardingCompleted }
  );
}

async function openStoragePage(page: Page): Promise<void> {
  await page.goto('/manifest.json', { waitUntil: 'load' });
}

interface TestSeed {
  target: {
    id: string;
    name: string;
    platform: string;
    programUrl: string;
    scope: string;
    notes: string;
    priority: number;
    status: string;
    createdAt: number;
    updatedAt: number;
    lastSessionAt: number;
    sessionCount: number;
  };
  session: Record<string, unknown>;
  note: Record<string, unknown>;
  payout: Record<string, unknown>;
  asset: Record<string, unknown>;
}
