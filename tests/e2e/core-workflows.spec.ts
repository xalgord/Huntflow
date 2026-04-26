import { expect, test } from '@playwright/test';
import {
  dismissOnboarding,
  gotoAppRoute,
  seedDemoApp,
  seedEmptyApp,
  seedIds,
  waitForAppReady,
  watchConsole
} from './helpers';

test.describe('core product workflows', () => {
  test('dashboard reflects seeded store data and primary actions work', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await expect(page.getByRole('heading', { name: /Bug bounty work/i })).toBeVisible();
    await expect(page.getByText('NeonBank').first()).toBeVisible();
    await expect(page.getByText('1 evidence note attached').first()).toBeVisible();
    await expect(page.getByText(/\[\$\] paid \$0 · pending \$8,400/)).toBeVisible();

    await page.getByRole('button', { name: /Document & report/i }).click();
    await expect(page.getByRole('heading', { name: 'Document & report' })).toBeVisible();

    await page.getByRole('link', { name: /Start hunt room/i }).click();
    await expect(page).toHaveURL(/\/timer\/?$/);
    await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('target create, search, detail status, and target timer link work', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedEmptyApp(page);

    await gotoAppRoute(page, '/targets');
    await dismissOnboarding(page);
    await page.getByRole('button', { name: /Add Target/i }).first().click();

    const form = page.locator('form').first();
    await form.getByPlaceholder('Example Corp').fill('NeonBank QA');
    await form.getByLabel('Platform').selectOption('hackerone');
    await form.getByPlaceholder('https://hackerone.com/example').fill('https://hackerone.com/neonbank-qa');
    await form.getByLabel('Priority').selectOption('1');
    await form.getByPlaceholder('*.example.com').fill('*.neonbank-qa.test\napi.neonbank-qa.test');
    await form.getByPlaceholder('Program notes').fill('OAuth and payment flows.');
    await page.getByRole('button', { name: 'Create Target' }).click();

    await expect(page.getByRole('link', { name: /NeonBank QA/i })).toBeVisible();
    await page.getByPlaceholder('Search targets').fill('neonbank');
    await expect(page.getByRole('link', { name: /NeonBank QA/i })).toBeVisible();

    await page.getByRole('link', { name: /NeonBank QA/i }).click();
    await expect(page.getByRole('heading', { name: 'NeonBank QA' })).toBeVisible();
    await page.getByRole('button', { name: 'Testing' }).click();
    await expect(page.getByText('Testing').first()).toBeVisible();

    await page.getByRole('link', { name: /Start Session/i }).click();
    await expect(page).toHaveURL(/\/timer\?target=/);
    await expect(page.getByText('Target:')).toBeVisible();
    await expect(page.locator('section').getByText('NeonBank QA')).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('timer start, pause, resume, complete, and target session update work', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await gotoAppRoute(page, `/timer?target=${seedIds.target}`);
    await page.getByRole('button', { name: 'Start Hunting' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('button', { name: 'Complete Early' })).toBeVisible();
    await page.getByRole('button', { name: 'Complete Early' }).click();

    await expect(page.getByRole('dialog', { name: 'Session complete' })).toBeVisible();
    await page.getByPlaceholder('What did you find?').fill('Confirmed replay with stale state token.');
    await page.getByRole('button', { name: '#needs-report' }).click();
    await page.getByRole('button', { name: 'Save Session' }).click();
    await expect(page.getByRole('dialog', { name: 'Session complete' })).toHaveCount(0);

    await gotoAppRoute(page, `/targets/${seedIds.target}`);
    await expect(page.getByText('2 completed sessions')).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('notes template, markdown preview, save, search, and draft restore work', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await gotoAppRoute(page, `/notes/new?target=${seedIds.target}`);
    await expect(page.getByLabel('Template')).toContainText('IDOR');
    await page.getByLabel('Template').selectOption('idor');
    await expect(page.getByLabel('Title')).toHaveValue('IDOR');
    await expect(page.getByPlaceholder('Write markdown notes')).toHaveValue(/Insecure Direct Object Reference/);

    await page.getByLabel('Title').fill('IDOR on invoice export');
    await page.getByPlaceholder('Write markdown notes').fill('# IDOR on invoice export\n\n## Impact\nInvoices leak across accounts.');
    await page.getByLabel('Tags').fill('high,needs-report');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'preview' }).click();
    await expect(page.getByRole('heading', { name: 'IDOR on invoice export' })).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/);

    await page.getByRole('button', { name: 'write' }).click();
    await page.getByPlaceholder('Write markdown notes').fill('Unsaved draft marker');
    await page.waitForTimeout(3_200);
    await page.reload({ waitUntil: 'load' });
    await waitForAppReady(page);
    await expect(page.getByPlaceholder('Write markdown notes')).toHaveValue('Unsaved draft marker');

    await page.getByRole('button', { name: 'Save' }).click();
    await gotoAppRoute(page, '/notes');
    await page.getByPlaceholder('Search notes, content, tags').fill('draft marker');
    await expect(page.getByRole('link', { name: /IDOR on invoice export/i })).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('income status progression and tax CSV export work', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await gotoAppRoute(page, '/income');
    await expect(page.getByText('NeonBank').first()).toBeVisible();
    await expect(page.getByText('$8,400.00').first()).toBeVisible();

    await page.getByRole('button', { name: 'Mark Paid' }).click();
    await expect(page.getByText('Paid').first()).toBeVisible();
    await expect(page.getByText('Rows').locator('..')).toContainText('1');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^huntflow-payouts-\d{4}\.csv$/);
    await consoleWatcher.assertClean();
  });
});
