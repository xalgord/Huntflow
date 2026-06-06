import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { gotoAppRoute, seedDemoApp, watchConsole } from './helpers';

test.describe('settings, data management, account, and PWA surfaces', () => {
  test('account and cloud entry points render configured or local-only state without crashing', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await gotoAppRoute(page, '/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Account|Optional account|Profile/i })).toBeVisible();

    await page.getByRole('link', { name: /Account|Optional account|Profile/i }).click();
    await expect(page).toHaveURL(/\/account\/?$/);
    await expect(
      page.getByRole('heading', { name: /Local workspace|Sign in to manage your account|Account/i }).first()
    ).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('export JSON, invalid import validation, and clear-data confirmation work', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await gotoAppRoute(page, '/settings');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^huntflow-export-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    const exported = await readFile(path as string, 'utf8');
    expect(exported).toContain('NeonBank');
    expect(exported).toContain('OAuth callback state reuse');

    await page.locator('label:has-text("Import JSON") input[type="file"]').setInputFiles({
      name: 'invalid-huntflow-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"not":"a valid export"}')
    });
    await expect(page.getByText(/meta must be an object|data must be an object|Invalid HuntFlow/i)).toBeVisible();

    await page.getByRole('button', { name: 'Clear Data' }).click();
    await expect(page.getByRole('button', { name: 'Clear Everything' })).toBeDisabled();
    await page.getByPlaceholder('CLEAR').fill('CLEAR');
    await page.getByRole('button', { name: 'Clear Everything' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();
    await gotoAppRoute(page, '/targets');
    await expect(page.getByText('No targets yet')).toBeVisible();
    await consoleWatcher.assertClean();
  });
});
