import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gotoAppRoute, seedDemoApp, seedIds, watchConsole } from './helpers';

test.describe('evidence assets workspace', () => {
  test('captures URL and file evidence, links assets, and renders graph canvas', async ({ page }, testInfo) => {
    const consoleWatcher = watchConsole(page);
    await seedDemoApp(page);
    const folderFixture = testInfo.outputPath('folder-evidence');
    await mkdir(folderFixture, { recursive: true });
    await writeFile(join(folderFixture, 'folder-proof.log'), 'folder upload proof');

    await gotoAppRoute(page, '/assets');
    await expect(page.getByRole('heading', { name: 'Evidence assets' })).toBeVisible();
    await expect(page.getByText('Replay proof screenshot')).toBeVisible();
    await page.getByRole('button', { name: 'Upload evidence', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'Evidence upload options' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Upload folder/i })).toBeVisible();

    const folderChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: /Upload folder/i }).click();
    const folderChooser = await folderChooserPromise;
    await folderChooser.setFiles(folderFixture);
    await expect(page.getByRole('button', { name: /folder-proof.*Unassigned/i })).toBeVisible();

    await page.getByPlaceholder('Optional label').fill('Callback endpoint');
    await page.getByPlaceholder('https://target.example/path').fill('https://app.neonbank.test/oauth/callback');
    await page.getByRole('button', { name: 'Save URL' }).click();
    await expect(page.getByRole('button', { name: /Callback endpoint/i })).toBeVisible();

    await page.getByLabel('Upload evidence files').setInputFiles({
      name: 'request.log',
      mimeType: 'text/plain',
      buffer: Buffer.from('GET /oauth/callback?state=reused HTTP/1.1\nHost: app.neonbank.test')
    });
    const requestAsset = page.getByRole('button', { name: /request Unassigned/i });
    await expect(requestAsset).toBeVisible();

    await requestAsset.click();
    await page.getByLabel('Relationship destination').selectOption(`target:${seedIds.target}`);
    await page.getByRole('button', { name: 'Add relationship' }).click();
    await expect(page.getByText('No explicit relationships yet.')).toHaveCount(0);

    const canvas = page.getByLabel('Interactive evidence graph canvas');
    await expect(canvas).toBeVisible();
    const nonBlank = await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement;
      const context = canvasElement.getContext('2d');
      if (!context) return false;
      const pixels = context.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] !== 0) return true;
      }
      return false;
    });
    expect(nonBlank).toBe(true);

    await consoleWatcher.assertClean();
  });
});
