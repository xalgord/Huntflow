import { expect, test } from '@playwright/test';
import { gotoAppRoute, seedFirstRunApp, waitForAppReady, watchConsole } from './helpers';

test.describe('first-run onboarding', () => {
  test('appears once on app routes, is skippable, and persists completion', async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    await seedFirstRunApp(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome to HuntFlow' })).toBeVisible();
    await expect(page.getByLabel(/Go to step/)).toHaveCount(6);

    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.reload({ waitUntil: 'load' });
    await waitForAppReady(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await consoleWatcher.assertClean();
  });

  test('supports clickable dots and final CTA routes to the timer', async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    await seedFirstRunApp(page);
    await page.getByLabel('Go to step 4: Take structured security notes').click();
    await expect(page.getByRole('heading', { name: 'Take structured security notes' })).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Start your first session' })).toBeVisible();

    await page.getByRole('button', { name: 'Start your first session', exact: true }).click();
    await expect(page).toHaveURL(/\/timer\/?$/);
    await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('does not show onboarding on the public landing page', async ({ page }) => {
    const consoleWatcher = watchConsole(page);

    // Marketing landing now lives at the root URL — the onboarding modal
    // is scoped to the app shell and must not appear on this public surface.
    await gotoAppRoute(page, '/');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'HuntFlow' })).toBeVisible();
    await consoleWatcher.assertClean();
  });
});
