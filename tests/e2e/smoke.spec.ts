import { expect, test } from '@playwright/test';
import {
  dismissOnboarding,
  expectContrastAtLeast,
  expectNoHorizontalOverflow,
  expectSeoBasics,
  gotoAppRoute,
  routes,
  seedDemoApp,
  seedIds,
  watchConsole
} from './helpers';

test.describe('release smoke and responsive QA', () => {
  test('all primary routes render without app runtime errors and include SEO basics', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    for (const route of routes) {
      await gotoAppRoute(page, route);
      await dismissOnboarding(page);
      await expect(page.locator('body')).toBeVisible();
      await expectSeoBasics(page);
      await consoleWatcher.assertClean();
    }
  });

  test('seeded detail routes render without 500-style regressions', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);

    await gotoAppRoute(page, `/targets/${seedIds.target}`);
    await expect(page.getByRole('heading', { name: 'NeonBank' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Start Session/i })).toHaveAttribute('href', new RegExp(`/timer\\?target=${seedIds.target}`));

    await gotoAppRoute(page, `/notes/${seedIds.note}`);
    await expect(page.getByLabel('Title')).toHaveValue('OAuth callback state reuse');
    await consoleWatcher.assertClean();
  });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1100 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'narrow mobile', width: 360, height: 740 }
  ]) {
    test(`dashboard has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
      const consoleWatcher = watchConsole(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedDemoApp(page);

      await expect(page.getByRole('heading', { name: /Bug bounty work/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Start hunt room/i })).toBeVisible();
      await expect(page.getByText('NeonBank').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await consoleWatcher.assertClean();
    });
  }

  test('dashboard keeps accessible contrast for core text and actions', async ({ page }) => {
    await seedDemoApp(page);

    await expectContrastAtLeast(page, 'body');
    await expectContrastAtLeast(page, 'a:has-text("Start hunt room")', 4.5);
    await expectContrastAtLeast(page, 'p:has-text("HuntFlow keeps targets")', 4.5);
    await expectContrastAtLeast(page, 'p:has-text("[$] paid")', 4.5);
  });

  test('keyboard navigation reaches shell, dashboard CTAs, workflow, and settings links', async ({ page }) => {
    await seedDemoApp(page);

    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        return active?.innerText || active?.getAttribute('aria-label') || active?.getAttribute('href') || '';
      });
      if (/Start hunt room|Capture evidence|Dashboard|Timer|Targets|Notes|Evidence|Income|Settings/i.test(label)) return;
    }

    throw new Error('Keyboard focus did not reach expected interactive shell or dashboard controls.');
  });
});
