import { expect, test } from '@playwright/test';
import { dismissOnboarding, seedDemoApp } from './helpers';

test.describe('storage safety', () => {
  test('warns loudly when the browser refuses IndexedDB', async ({ page }) => {
    // Simulate private-mode / disabled storage: every open request errors.
    await page.addInitScript(() => {
      const failingOpen = () => {
        const request: Record<string, unknown> = {};
        setTimeout(() => {
          const error = new DOMException('Storage is disabled', 'UnknownError');
          Object.assign(request, { error });
          (request.onerror as ((event: unknown) => void) | undefined)?.({ target: request });
        }, 0);
        return request;
      };
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: { open: failingOpen, deleteDatabase: failingOpen, cmp: () => 0 }
      });
    });

    await page.goto('/dashboard');
    await dismissOnboarding(page);
    const banner = page.getByRole('alert').filter({ hasText: "Changes aren't being saved" });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button', { name: /Download Backup/ })).toBeVisible();
  });

  test('stays quiet when storage is healthy', async ({ page }) => {
    await seedDemoApp(page);
    await expect(page.getByText("Changes aren't being saved")).toHaveCount(0);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Storage & Backups' })).toBeVisible();
    await expect(page.getByText('Saving normally')).toBeVisible();
  });
});
