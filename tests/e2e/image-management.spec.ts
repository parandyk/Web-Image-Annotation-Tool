import { expect, test, type Locator, type Page } from '@playwright/test';
import { bmpFile, bootstrapEmptyWorkspace, openImagesViaTopbar, openSidebarTab } from './helpers/app';

function imageRowByName(page: Page, imageName: string): Locator {
  return page
    .locator('.image-list-row')
    .filter({ has: page.locator('.image-name-btn', { hasText: imageName }) })
    .first();
}

function imageFlyout(page: Page): Locator {
  return page
    .locator('.annotation-menu')
    .filter({ has: page.getByRole('button', { name: 'Bookmark selected', exact: true }) })
    .first();
}

function bookmarkButton(menu: Locator): Locator {
  return menu.getByRole('button', { name: 'Bookmark selected', exact: true });
}

function unbookmarkButton(menu: Locator): Locator {
  return menu.getByRole('button', { name: 'Remove bookmark from selected', exact: true });
}

function modalByHeading(page: Page, heading: string): Locator {
  return page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
    .first();
}

async function openImageContextMenu(page: Page, row: Locator): Promise<Locator> {
  await row.click({ button: 'right' });
  const menu = imageFlyout(page);
  await expect(menu).toBeVisible();
  return menu;
}

async function selectImages(page: Page, names: string[]): Promise<void> {
  if (names.length === 0) return;
  const [first, ...rest] = names;
  await imageRowByName(page, first).locator('.image-name-btn').click();
  const modifier: 'Meta' | 'Control' = process.platform === 'darwin' ? 'Meta' : 'Control';
  for (const name of rest) {
    await imageRowByName(page, name).locator('.image-name-btn').click({ modifiers: [modifier] });
  }
}

test.describe('Image management and flyouts', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('adding images appends to current workspace and inline bookmark toggle works', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('img-a.bmp', 240, 160, { r: 170, g: 80, b: 80 }),
      bmpFile('img-b.bmp', 240, 160, { r: 80, g: 160, b: 100 }),
    ]);

    await openSidebarTab(page, 'Images');
    await expect(page.locator('.image-list-row')).toHaveCount(2);

    await openImagesViaTopbar(page, [
      bmpFile('img-c.bmp', 220, 140, { r: 80, g: 110, b: 180 }),
    ]);

    await openSidebarTab(page, 'Images');
    await expect(page.locator('.image-list-row')).toHaveCount(3);
    await expect(imageRowByName(page, 'img-a.bmp')).toBeVisible();
    await expect(imageRowByName(page, 'img-b.bmp')).toBeVisible();
    await expect(imageRowByName(page, 'img-c.bmp')).toBeVisible();

    const firstRow = imageRowByName(page, 'img-a.bmp');
    await firstRow.locator('button[title="Bookmark image"]').click();
    await expect(firstRow.locator('button[title="Remove bookmark"]')).toBeVisible();

    await firstRow.locator('button[title="Remove bookmark"]').click();
    await expect(firstRow.locator('button[title="Bookmark image"]')).toBeVisible();
  });

  test('image flyout bookmark actions apply to selected rows and keep enable/disable states correct', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('flyout-1.bmp', 240, 160, { r: 130, g: 90, b: 170 }),
      bmpFile('flyout-2.bmp', 240, 160, { r: 80, g: 150, b: 120 }),
      bmpFile('flyout-3.bmp', 240, 160, { r: 95, g: 120, b: 180 }),
    ]);
    await openSidebarTab(page, 'Images');

    // Unbookmarked single selection: only bookmark should be enabled.
    {
      const menu = await openImageContextMenu(page, imageRowByName(page, 'flyout-1.bmp'));
      await expect(bookmarkButton(menu)).toBeEnabled();
      await expect(unbookmarkButton(menu)).toBeDisabled();
      await page.keyboard.press('Escape');
    }

    await selectImages(page, ['flyout-1.bmp', 'flyout-2.bmp']);

    {
      const menu = await openImageContextMenu(page, imageRowByName(page, 'flyout-1.bmp'));
      await bookmarkButton(menu).click();
    }

    await expect(imageRowByName(page, 'flyout-1.bmp').locator('button[title="Remove bookmark"]')).toBeVisible();
    await expect(imageRowByName(page, 'flyout-2.bmp').locator('button[title="Remove bookmark"]')).toBeVisible();
    await expect(imageRowByName(page, 'flyout-3.bmp').locator('button[title="Bookmark image"]')).toBeVisible();

    // Bookmarked single selection: only unbookmark should be enabled.
    {
      const menu = await openImageContextMenu(page, imageRowByName(page, 'flyout-1.bmp'));
      await expect(bookmarkButton(menu)).toBeDisabled();
      await expect(unbookmarkButton(menu)).toBeEnabled();
      await page.keyboard.press('Escape');
    }

    // Mixed multi-selection (bookmarked + unbookmarked): both should be enabled.
    await selectImages(page, ['flyout-1.bmp', 'flyout-3.bmp']);
    {
      const menu = await openImageContextMenu(page, imageRowByName(page, 'flyout-1.bmp'));
      await expect(bookmarkButton(menu)).toBeEnabled();
      await expect(unbookmarkButton(menu)).toBeEnabled();
      await page.keyboard.press('Escape');
    }

    await selectImages(page, ['flyout-1.bmp', 'flyout-2.bmp']);

    {
      const menu = await openImageContextMenu(page, imageRowByName(page, 'flyout-1.bmp'));
      await unbookmarkButton(menu).click();
    }

    await expect(imageRowByName(page, 'flyout-1.bmp').locator('button[title="Bookmark image"]')).toBeVisible();
    await expect(imageRowByName(page, 'flyout-2.bmp').locator('button[title="Bookmark image"]')).toBeVisible();
  });

  test('inline image delete supports cancel and confirm paths', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('delete-a.bmp', 240, 160, { r: 160, g: 80, b: 80 }),
      bmpFile('delete-b.bmp', 240, 160, { r: 80, g: 130, b: 170 }),
    ]);
    await openSidebarTab(page, 'Images');
    await expect(page.locator('.image-list-row')).toHaveCount(2);

    const rowA = imageRowByName(page, 'delete-a.bmp');
    await rowA.locator('button[title="Delete image"]').click();
    const dialog = modalByHeading(page, 'Delete image');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(page.locator('.image-list-row')).toHaveCount(2);
    await expect(imageRowByName(page, 'delete-a.bmp')).toBeVisible();

    await rowA.locator('button[title="Delete image"]').click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.locator('.image-list-row')).toHaveCount(1);
    await expect(imageRowByName(page, 'delete-a.bmp')).toHaveCount(0);
    await expect(imageRowByName(page, 'delete-b.bmp')).toBeVisible();
  });

  test('flyout delete selected removes multi-selection and can clear workspace', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('bulk-a.bmp', 240, 160, { r: 170, g: 70, b: 90 }),
      bmpFile('bulk-b.bmp', 240, 160, { r: 70, g: 150, b: 120 }),
      bmpFile('bulk-c.bmp', 240, 160, { r: 80, g: 110, b: 190 }),
    ]);
    await openSidebarTab(page, 'Images');
    await expect(page.locator('.image-list-row')).toHaveCount(3);

    await selectImages(page, ['bulk-a.bmp', 'bulk-b.bmp']);
    {
      const menu = await openImageContextMenu(page, imageRowByName(page, 'bulk-a.bmp'));
      await menu.getByRole('button', { name: 'Delete selected', exact: true }).click();
    }
    const dialog = modalByHeading(page, 'Delete image');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.locator('.image-list-row')).toHaveCount(1);
    await expect(imageRowByName(page, 'bulk-c.bmp')).toBeVisible();

    {
      const menu = await openImageContextMenu(page, imageRowByName(page, 'bulk-c.bmp'));
      await menu.getByRole('button', { name: 'Delete selected', exact: true }).click();
    }
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.locator('.workspace-empty')).toContainText('Open images');
  });
});
