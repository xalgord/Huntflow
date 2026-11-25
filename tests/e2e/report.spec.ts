import { expect, test } from '@playwright/test';
import { waitForAppReady, watchConsole } from './helpers';

test.describe('engagement report', () => {
  test('builds a client-ready report from a program and remembers its settings', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await page.goto('/demo?go=/programs');
    await page.waitForURL(/\/programs$/, { timeout: 30_000 });
    await waitForAppReady(page);

    await page.getByRole('link', { name: /Acme Bug Bounty/ }).first().click();
    await page.getByRole('link', { name: 'Report', exact: true }).click();
    await expect(page).toHaveURL(/\/programs\/.+\/report$/);

    const paper = page.getByRole('article', { name: 'Report preview' });
    await expect(paper.getByRole('heading', { level: 1 })).toHaveText('Acme Bug Bounty Security Assessment');
    await expect(paper).toContainText('Executive Summary');
    await expect(paper).toContainText('ACME-01');
    await expect(paper.getByRole('table').first()).toContainText('IDOR on /v1/users/{id}/orders');

    await page.getByLabel('Report settings').getByPlaceholder('Your name or company').fill('Deepak Kumar');
    await expect(paper).toContainText('Prepared by');
    await expect(page.getByLabel('Executive summary')).toHaveValue(/^Deepak Kumar assessed Acme Bug Bounty/);
    await expect(paper).toContainText('Deepak Kumar assessed Acme Bug Bounty');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Markdown' }).click();
    expect((await download).suggestedFilename()).toMatch(/^acme-bug-bounty-security-assessment.*\.md$/);

    // Only the paper prints.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByLabel('Report settings')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeHidden();
    await expect(page.locator('aside').filter({ hasText: 'Programs' }).first()).toBeHidden();
    await expect(paper).toBeVisible();
    await page.emulateMedia({ media: 'screen' });

    // Settings are saved on the program.
    await page.waitForTimeout(700);
    await page.reload();
    await waitForAppReady(page);
    await expect(page.getByLabel('Report settings').getByPlaceholder('Your name or company')).toHaveValue('Deepak Kumar');
    await consoleWatcher.assertClean();
  });
});
