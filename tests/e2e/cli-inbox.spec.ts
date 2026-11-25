import { expect, test, type Page } from '@playwright/test';
import { dismissOnboarding, gotoAppRoute, seedDemoApp } from './helpers';

/**
 * The inbox only exists when the app is served by `npx huntflow`. Simulate
 * that server: mark pages as CLI-served and answer the local API.
 */
async function serveAsCli(page: Page, items: Array<Record<string, unknown>>) {
  const queue = [...items];
  const deleted: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    const body = (await response.text()).replace('<head>', '<head><meta name="huntflow-local" content="1" />');
    await route.fulfill({ response, body });
  });
  await page.route('**/api/huntflow/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/huntflow/status') {
      return json(200, { app: 'huntflow', version: 'test', backups: { enabled: false, dir: null, count: 0, keep: 30, latestAt: null }, inbox: { count: queue.length } });
    }
    if (url.pathname === '/api/huntflow/inbox' && method === 'GET') {
      return json(200, queue.map(({ text, ...summary }) => ({ ...summary, preview: String(text).split('\n')[0] })));
    }
    const id = url.pathname.split('/').pop() ?? '';
    const index = queue.findIndex((item) => item.id === id);
    if (method === 'GET') return index >= 0 ? json(200, queue[index]) : json(404, { error: 'not found' });
    if (method === 'DELETE') {
      if (index >= 0) queue.splice(index, 1);
      deleted.push(id);
      return json(200, { id });
    }
    return json(404, { error: 'unknown' });
  });
  return { deleted, queue };
}

const item = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  id,
  text,
  receivedAt: Date.now(),
  bytes: text.length,
  lines: text.split('\n').filter(Boolean).length,
  source: 'cli',
  ...extra
});

test.describe('terminal inbox (huntflow push)', () => {
  test('output piped from the terminal is reviewed and imported into the named program', async ({ page }) => {
    // No console check here: documents fulfilled by page.route lose their
    // local-network status, so Chrome blocks Vite's HMR websocket.
    await seedDemoApp(page);
    const server = await serveAsCli(page, [
      item('inbox-20261126T101500000Z-aaaaaaaa', 'pay.neonbank.test\nauth.neonbank.test\nevil.example.org', { program: 'neon', kind: 'hosts' }),
      item('inbox-20261126T101600000Z-bbbbbbbb', 'cdn.neonbank.test', { program: 'neon' })
    ]);
    await gotoAppRoute(page, '/dashboard');
    await dismissOnboarding(page);

    const pill = page.getByRole('status', { name: 'Output from your terminal' });
    await expect(pill).toContainText('From your terminal · 2 waiting');
    await expect(pill).toContainText('Host list · 3 lines · neon');
    await pill.getByRole('button', { name: 'Review' }).click();

    const sheet = page.getByRole('dialog', { name: 'Import' });
    await expect(sheet).toContainText('From your terminal · --program neon');
    await expect(sheet.getByLabel('Import into program')).toHaveValue(/.+/);
    await expect(sheet.getByLabel('Import into program').locator('option:checked')).toHaveText('NeonBank');
    await expect(sheet.getByLabel('Import summary')).toContainText(/New targets\s*2/);
    await expect(sheet.getByLabel('Import summary')).toContainText(/Out of scope\s*1/);
    await sheet.getByRole('button', { name: /^Import \d+ items?$/ }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    expect(server.deleted).toEqual(['inbox-20261126T101500000Z-aaaaaaaa']);
    await expect(pill).toContainText('From your terminal');
    await expect(pill).toContainText('1 line · neon');

    await pill.getByRole('button', { name: 'Discard terminal import' }).click();
    await expect(pill).toHaveCount(0);
    expect(server.deleted).toContain('inbox-20261126T101600000Z-bbbbbbbb');

    await gotoAppRoute(page, '/targets');
    await expect(page.getByText('pay.neonbank.test').first()).toBeVisible();
    await expect(page.getByText('evil.example.org')).toHaveCount(0);
  });

  test('closing without importing keeps the output queued', async ({ page }) => {
    await seedDemoApp(page);
    const server = await serveAsCli(page, [item('inbox-20261126T101500000Z-cccccccc', 'x.neonbank.test')]);
    await gotoAppRoute(page, '/dashboard');
    await dismissOnboarding(page);
    const pill = page.getByRole('status', { name: 'Output from your terminal' });
    await pill.getByRole('button', { name: 'Review' }).click();
    await page.getByRole('dialog', { name: 'Import' }).getByRole('button', { name: 'Cancel' }).click();
    await expect(pill).toBeVisible();
    expect(server.deleted).toEqual([]);
  });

  test('the hosted app never polls for an inbox', async ({ page }) => {
    let polled = false;
    await page.route('**/api/huntflow/**', (route) => {
      polled = true;
      return route.fulfill({ status: 404, body: '' });
    });
    await seedDemoApp(page);
    await gotoAppRoute(page, '/dashboard');
    await page.waitForTimeout(1500);
    expect(polled).toBe(false);
  });
});
