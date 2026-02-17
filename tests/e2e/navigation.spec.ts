import { expect, test, type FilePayload } from '@playwright/test';
import { bmpFile, bootstrapEmptyWorkspace, openImagesViaTopbar, openSidebarTab } from './helpers/app';

test.describe('Navigation (combined smoke+regression)', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('open multiple images and navigate via image controls', async ({ page }) => {
    const files: FilePayload[] = [
      bmpFile('nav-a.bmp', 240, 140, { r: 180, g: 60, b: 60 }),
      bmpFile('nav-b.bmp', 240, 140, { r: 60, g: 160, b: 90 }),
      bmpFile('nav-c.bmp', 240, 140, { r: 80, g: 90, b: 200 }),
    ];

    await openImagesViaTopbar(page, files);
    await openSidebarTab(page, 'Images');

    const navCount = page.locator('section:has-text("Image navigation") .nav-status-count');
    await expect(navCount).toHaveText('1/3');

    await page.getByTitle('Next image').click();
    await expect(navCount).toHaveText('2/3');

    await page.getByTitle('Next image').click();
    await expect(navCount).toHaveText('3/3');

    await page.getByTitle('Previous image').click();
    await expect(navCount).toHaveText('2/3');

    await page.getByTitle('First image').click();
    await expect(navCount).toHaveText('1/3');

    await page.getByTitle('Last image').click();
    await expect(navCount).toHaveText('3/3');
  });
});
