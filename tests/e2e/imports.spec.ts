import { expect, test } from '@playwright/test';
import { dismissOnboarding, gotoAppRoute, seedDemoApp, seedIds, watchConsole } from './helpers';

const subfinder = ['api.neonbank.test', 'pay.neonbank.test', 'auth.neonbank.test', 'cdn.thirdparty.test'].join('\n');

const nuclei = [
  {
    'template-id': 'git-config',
    info: {
      name: 'Git Configuration - Detect',
      severity: 'medium',
      description: 'Git configuration was detected.',
      classification: { 'cwe-id': ['cwe-200'], 'cvss-score': 5.3 }
    },
    host: 'https://pay.neonbank.test',
    'matched-at': 'https://pay.neonbank.test/.git/config',
    request: 'GET /.git/config HTTP/1.1\r\nHost: pay.neonbank.test\r\n\r\n',
    response: 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n[core]'
  }
]
  .map((line) => JSON.stringify(line))
  .join('\n');

test.describe('imports', () => {
  test('subfinder output adds in-scope hosts once and skips out-of-scope ones', async ({ page }) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);
    await gotoAppRoute(page, '/targets');
    await dismissOnboarding(page);

    await page.getByRole('button', { name: 'Import', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Import' });
    await sheet.getByLabel('Scope or tool output').fill(subfinder);
    await expect(sheet.getByLabel('Format')).toContainText('Auto · Host list');
    const summary = sheet.getByLabel('Import summary');
    await expect(summary).toContainText(/New targets\s*2/);
    await expect(summary).toContainText(/Out of scope\s*1/);
    await expect(sheet.getByLabel('Preview')).toContainText('pay.neonbank.test');
    await expect(sheet.getByLabel('Preview')).not.toContainText('cdn.thirdparty.test');

    await sheet.getByRole('button', { name: /^Import \d+ items?$/ }).click();
    await expect(page.getByRole('dialog', { name: 'Import complete' })).toContainText('2 new targets');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText('https://pay.neonbank.test').or(page.getByText('pay.neonbank.test')).first()).toBeVisible();

    // Same output again: nothing new, nothing duplicated.
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.getByRole('dialog', { name: 'Import' }).getByLabel('Scope or tool output').fill(subfinder);
    await expect(page.getByRole('dialog', { name: 'Import' })).toContainText('Everything here is already in NeonBank.');
    await expect(page.getByRole('button', { name: 'Import', exact: true }).last()).toBeDisabled();
    await consoleWatcher.assertClean();
  });

  test('nuclei results become draft findings with evidence and never duplicate', async ({ page }) => {
    await seedDemoApp(page);
    await gotoAppRoute(page, '/targets?import=1');
    await dismissOnboarding(page);

    const sheet = page.getByRole('dialog', { name: 'Import' });
    await sheet.getByTestId('import-file').setInputFiles({ name: 'nuclei.jsonl', mimeType: 'application/json', buffer: Buffer.from(nuclei) });
    await expect(sheet.getByRole('button', { name: 'nuclei.jsonl' })).toBeVisible();
    await expect(sheet.getByLabel('Import summary')).toContainText(/Draft findings\s*1/);
    await expect(sheet.getByLabel('Preview')).toContainText('Git Configuration - Detect on pay.neonbank.test');
    await sheet.getByRole('button', { name: /^Import \d+ items?$/ }).click();

    await page.getByRole('link', { name: 'Review Drafts' }).click();
    await expect(page).toHaveURL(/\/findings\?target=.*bucket=drafts/);
    await page.getByRole('button', { name: /Git Configuration - Detect on pay\.neonbank\.test/ }).first().click();
    await expect(page.locator('#finding-title')).toHaveValue('Git Configuration - Detect on pay.neonbank.test');
    await expect(page.getByText('GET http://pay.neonbank.test/.git/config')).toBeVisible();

    await gotoAppRoute(page, '/targets?import=1');
    const again = page.getByRole('dialog', { name: 'Import' });
    await again.getByLabel('Scope or tool output').fill(nuclei);
    await expect(again).toContainText('1 scanner result was imported before.');
  });

  test('HackerOne scope CSV updates program scope and the URL checker uses it', async ({ page }) => {
    await seedDemoApp(page);
    await gotoAppRoute(page, `/programs/${seedIds.target}#scope`);
    await dismissOnboarding(page);

    await page.getByRole('button', { name: 'Import…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Import' });
    await expect(sheet.getByLabel('Import into program')).toHaveCount(0);
    await sheet
      .getByLabel('Scope or tool output')
      .fill(
        [
          'identifier,asset_type,instruction,eligible_for_bounty,eligible_for_submission,max_severity',
          'pay.neonbank.test,URL,Payments,true,true,critical',
          'status.neonbank.test,URL,Third party,false,false,none'
        ].join('\n')
      );
    await expect(sheet.getByLabel('Format')).toContainText('HackerOne scope CSV');
    await expect(sheet.getByRole('switch', { name: /Add scope rules to NeonBank/ })).toHaveAttribute('aria-checked', 'true');
    await sheet.getByRole('button', { name: /^Import \d+ items?$/ }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();

    await expect(page.getByLabel('Scope rules')).toHaveValue(/pay\.neonbank\.test\n- status\.neonbank\.test/);
    await page.getByLabel('URL to check against scope').fill('https://status.neonbank.test/');
    await expect(page.getByRole('status').filter({ hasText: 'Out of scope.' })).toContainText('status.neonbank.test');
    await page.getByLabel('URL to check against scope').fill('https://pay.neonbank.test/checkout');
    await expect(page.getByRole('status').filter({ hasText: 'In scope.' })).toBeVisible();

    await page.reload();
    await dismissOnboarding(page);
    await expect(page.getByLabel('Scope rules')).toHaveValue(/- status\.neonbank\.test/);
  });
});
