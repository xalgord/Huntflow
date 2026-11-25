import { expect, test } from '@playwright/test';
import { dismissOnboarding, gotoAppRoute, seedDemoApp, watchConsole } from './helpers';

test.describe('findings workspace', () => {
  test('template → evidence → platform export → submit, persisted across reloads', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);
    await gotoAppRoute(page, '/findings');
    await dismissOnboarding(page);

    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page).toHaveURL(/\/findings\?id=/);

    await page.getByRole('button', { name: /Start from a Template/ }).click();
    await page.getByPlaceholder('IDOR, SSRF, CWE-79, password reset…').fill('idor');
    await page.getByRole('button', { name: /Insecure Direct Object Reference/ }).click();
    await expect(page.locator('#finding-title')).toHaveValue('Insecure Direct Object Reference (IDOR)');

    await page.locator('#finding-title').fill('IDOR on invoice download');
    await page.getByRole('button', { name: 'Paste Request' }).click();
    await page
      .getByLabel('Raw HTTP request or curl command')
      .fill('GET /api/invoices/991/pdf HTTP/1.1\nHost: api.neonbank.test\nCookie: s=a\n\nHTTP/1.1 200 OK\nContent-Type: application/pdf\n\n%PDF');
    await page.getByRole('button', { name: 'Attach Request' }).click();
    await expect(page.getByText('GET http://api.neonbank.test/api/invoices/991/pdf')).toBeVisible();

    await page.getByRole('tab', { name: 'Submit' }).click();
    await expect(page.getByRole('radio', { name: 'HackerOne' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('CWE-639 — IDOR')).toBeVisible();
    await expect(page.getByText('CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N (7.1)')).toBeVisible();

    await page.getByRole('radio', { name: 'Bugcrowd' }).click();
    await expect(page.getByText(/Insecure Direct Object References \(IDOR\)$/)).toBeVisible();

    await page.getByRole('button', { name: 'Mark as Submitted' }).click();
    await expect(page.locator('#finding-status')).toHaveValue('submitted');

    await page.reload();
    await dismissOnboarding(page);
    await expect(page.locator('#finding-title')).toHaveValue('IDOR on invoice download');
    await expect(page.locator('#finding-status')).toHaveValue('submitted');
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.locator('ol').getByText('Submitted', { exact: true })).toBeVisible();
    await consoleWatcher.assertClean();
  });

  test('warns about likely duplicates in the same program', async ({ page }) => {
    await seedDemoApp(page);
    await gotoAppRoute(page, '/findings');
    await dismissOnboarding(page);

    for (const title of ['Stored XSS in profile bio', 'Stored XSS in profile bio field']) {
      // On phones the open finding covers the list; go back like a user would.
      const back = page.getByRole('button', { name: 'Back to findings' });
      if (await back.isVisible()) await back.click();
      await page.getByRole('button', { name: 'New', exact: true }).click();
      await page.locator('#finding-title').fill(title);
      await page.locator('#finding-title').blur();
      await page.waitForTimeout(500);
    }
    await expect(page.getByText('Possible duplicate')).toBeVisible();
  });

  test('the + menu creates a finding even when Findings is already open', async ({ page }) => {
    await seedDemoApp(page);
    await gotoAppRoute(page, '/findings');
    await dismissOnboarding(page);
    const before = await page.locator('.hf-finding-row').count();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('menuitem', { name: 'New Finding' }).click();
    await expect(page.locator('#finding-title')).toBeFocused();
    await expect(page.locator('.hf-finding-row')).toHaveCount(before + 1);
  });

  test('old report and submission URLs land in Findings', async ({ page }) => {
    await seedDemoApp(page);
    await gotoAppRoute(page, '/reports');
    await expect(page).toHaveURL(/\/findings/);
    await expect(page.getByRole('heading', { name: 'Findings', exact: true })).toBeVisible();
  });

  test('a pending retest shows on the finding and on Today', async ({ page }) => {
    await seedDemoApp(page);
    await gotoAppRoute(page, '/findings');
    await dismissOnboarding(page);
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.locator('#finding-title').fill('Open redirect on /logout');
    await page.locator('#finding-status').selectOption('resolved');
    await page.getByRole('tab', { name: 'Activity' }).click();
    await page.getByRole('radiogroup', { name: 'Retest status' }).getByRole('radio', { name: 'Pending' }).click();
    await page.waitForTimeout(600);

    await gotoAppRoute(page, '/dashboard');
    const retest = page.getByRole('link', { name: /Retest “Open redirect on \/logout”/ });
    await expect(retest).toBeVisible();
    await retest.click();
    await expect(page.locator('#finding-title')).toHaveValue('Open redirect on /logout');
  });
});
