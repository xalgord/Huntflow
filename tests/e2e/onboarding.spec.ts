import { expect, test } from '@playwright/test';
import { gotoAppRoute, seedFirstRunApp, waitForAppReady, watchConsole } from './helpers';

test.describe('first-run onboarding', () => {
  test('appears once on app routes, is dismissable, and persists completion', async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    await seedFirstRunApp(page);
    const sheet = page.getByRole('dialog', { name: 'Welcome to HuntFlow' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Bring scope and recon in')).toBeVisible();
    await expect(sheet.getByText('Write reports triage accepts')).toBeVisible();

    await page.getByRole('button', { name: 'Not Now' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.reload({ waitUntil: 'load' });
    await waitForAppReady(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await consoleWatcher.assertClean();
  });

  test('goes straight to creating the first program', async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    await seedFirstRunApp(page);
    await page.getByRole('button', { name: 'Add Your First Program' }).click();
    await expect(page).toHaveURL(/\/programs\?new=1$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByPlaceholder('Example Corp')).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('does not show onboarding on the public landing page', async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    // Marketing landing now lives at the root URL — the onboarding modal
    // is scoped to the app shell and must not appear on this public surface.
    await gotoAppRoute(page, '/');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await consoleWatcher.assertClean();
  });
});
