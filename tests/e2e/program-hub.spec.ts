import { expect, test } from '@playwright/test';
import { waitForAppReady, watchConsole } from './helpers';

test.describe('program hub', () => {
  test('checklists and activity live on the program, and old links redirect there', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await page.goto('/demo?go=/programs');
    await page.waitForURL(/\/programs$/, { timeout: 30_000 });
    await waitForAppReady(page);

    await page.getByRole('link', { name: /Acme Bug Bounty/ }).first().click();
    await expect(page).toHaveURL(/\/programs\/[^/#?]+/);
    const programUrl = page.url().split('#')[0];
    const programId = programUrl.split('/').pop();

    // Old /targets/:id/methodology links land on the Checklists tab.
    await page.goto(`/targets/${programId}/methodology`);
    await expect(page).toHaveURL(new RegExp(`/programs/${programId}#checklists$`));
    const checklists = page.getByRole('region', { name: 'Checklists' });
    await expect(checklists).toContainText('OWASP Web Security (condensed)');
    await expect(checklists).toContainText('1 vulns found');

    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    const activity = page.getByRole('region', { name: 'Activity' });
    await expect(activity.getByRole('link').first()).toBeVisible();
    await activity.getByRole('radio', { name: 'Findings' }).click();
    await expect(activity).toContainText('IDOR on /v1/users/{id}/orders');

    // The retired program page and timeline redirect too.
    await page.goto(`/targets/${programId}/timeline`);
    await expect(page).toHaveURL(new RegExp(`/programs/${programId}#activity$`));
    await page.goto(`/targets/${programId}`);
    await expect(page).toHaveURL(new RegExp(`/programs/${programId}$`));
    await consoleWatcher.assertClean();
  });
});
