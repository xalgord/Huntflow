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

    await expect(page.getByRole('heading', { name: /What needs attention today/i })).toBeVisible();
    await expect(page.getByText('NeonBank').first()).toBeVisible();
    await expect(page.getByText('api.neonbank.test').first()).toBeVisible();
    await expect(page.getByText('$8,400').first()).toBeVisible();

    await page.getByRole('link', { name: /Capture Note/i }).click();
    await expect(page).toHaveURL(/\/notes\/new\/?$/);
    await expect(page.getByRole('heading', { name: /New note/i })).toBeVisible();

    await gotoAppRoute(page, '/dashboard');
    await page.getByRole('link', { name: /New Session/i }).first().click();
    await expect(page).toHaveURL(/\/timer\/?$/);
    await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('target asset create, search, and detail status work', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await gotoAppRoute(page, '/targets');
    await dismissOnboarding(page);
    await page.getByRole('button', { name: /Add Target/i }).first().click();

    const form = page.locator('form').first();
    await form.getByPlaceholder('https://app.example.com or api.example.com').fill('https://qa.neonbank.test');
    await form.getByLabel('Program').selectOption(seedIds.target);
    await form.getByLabel('Type').selectOption('api');
    await form.getByLabel('Priority').selectOption('1');
    await form.getByLabel('Tech stack').fill('Next.js, GraphQL');
    await form.getByLabel('Ports').fill('443');
    await form.getByLabel('Tags').fill('auth, qa');
    await form.getByPlaceholder('Scope caveats, testing notes, credentials, blockers...').fill('OAuth and payment flows.');
    await page.getByRole('button', { name: 'Create Target' }).click();

    await expect(page.getByRole('button', { name: /qa\.neonbank\.test/i })).toBeVisible();
    await page.getByPlaceholder('URL, domain, tech, tags').fill('qa.neonbank');
    await expect(page.getByRole('button', { name: /qa\.neonbank\.test/i })).toBeVisible();

    await page.getByRole('button', { name: /qa\.neonbank\.test/i }).click();
    await expect(page.getByRole('heading', { name: 'https://qa.neonbank.test' })).toBeVisible();
    await page.locator('aside').getByLabel('Status', { exact: true }).selectOption('in-progress');
    await expect(page.getByText('Testing').first()).toBeVisible();

    await expect(page.getByRole('link', { name: 'New linked note' })).toHaveAttribute('href', new RegExp(`/notes/new\\?target=${seedIds.target}`));
    await expect(page.getByRole('link', { name: 'Capture finding' })).toHaveAttribute('href', new RegExp(`/findings\\?target=${seedIds.target}&new=1`));
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
