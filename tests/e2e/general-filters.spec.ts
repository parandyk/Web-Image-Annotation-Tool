import { expect, test, type FilePayload, type Locator, type Page } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByDragOnCanvas,
  getCoordValue,
  openImagesViaTopbar,
  openSidebarTab,
  setAddingMode,
} from './helpers/app';

function topbar(page: Page): Locator {
  return page.locator('header.topbar');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function textFile(name: string, content: string, mimeType = 'text/plain'): FilePayload {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8'),
  };
}

async function openTopbarMenu(page: Page, menuName: 'Import'): Promise<Locator> {
  await topbar(page).getByRole('button', { name: menuName, exact: true }).click();
  const menu = page.locator('.menu.open .menu-popover').first();
  await expect(menu).toBeVisible();
  return menu;
}

async function importClasses(page: Page, classes: string[]): Promise<void> {
  const menu = await openTopbarMenu(page, 'Import');
  const chooserPromise = page.waitForEvent('filechooser');
  await menu.getByRole('button', { name: 'Import classes', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles([textFile('classes.txt', `${classes.join('\n')}\n`)]);
}

async function selectImageByName(page: Page, imageName: string): Promise<void> {
  await openSidebarTab(page, 'Images');
  const row = page
    .locator('.image-list-row')
    .filter({ has: page.locator('.image-name-btn', { hasText: imageName }) })
    .first();
  await expect(row).toBeVisible();
  await row.locator('.image-name-btn').click();
}

async function bookmarkImageByName(page: Page, imageName: string): Promise<void> {
  await openSidebarTab(page, 'Images');
  const row = page
    .locator('.image-list-row')
    .filter({ has: page.locator('.image-name-btn', { hasText: imageName }) })
    .first();
  await expect(row).toBeVisible();
  const bookmark = row.locator('button[title="Bookmark image"]');
  if (await bookmark.isVisible().catch(() => false)) {
    await bookmark.click();
  }
  await expect(row.locator('button[title="Remove bookmark"]')).toBeVisible();
}

async function setAnnotationClassByDisplayId(page: Page, displayId: number, classLabel: string): Promise<void> {
  await openSidebarTab(page, 'Annotations');
  const row = annotationItems(page)
    .filter({ has: page.locator('.annotation-title-btn', { hasText: `#${displayId} ` }) })
    .first();
  await expect(row).toBeVisible();
  await row.locator('select.annotation-class-select').selectOption({ label: classLabel });
}

async function imageNames(page: Page): Promise<string[]> {
  const nodes = page.locator('.image-list-row .image-name-btn');
  const raw = await nodes.allTextContents();
  return raw.map(normalizeText).filter(Boolean);
}

async function annotationTitles(page: Page): Promise<string[]> {
  const raw = await page.locator('.annotation-item .annotation-title-btn').allTextContents();
  return raw.map(normalizeText).filter(Boolean);
}

async function classNames(page: Page): Promise<string[]> {
  const raw = await page.locator('.class-card .class-name-btn').allTextContents();
  return raw.map(normalizeText).filter(Boolean);
}

async function seedSortFilterDataset(page: Page): Promise<void> {
  await openImagesViaTopbar(page, [
    bmpFile('alpha.bmp', 160, 120, { r: 90, g: 130, b: 170 }),
    bmpFile('beta.bmp', 400, 300, { r: 130, g: 95, b: 150 }),
    bmpFile('gamma.bmp', 240, 180, { r: 80, g: 150, b: 120 }),
  ]);
  await importClasses(page, ['Vehicle', 'Person', 'Zebra']);
  await setAddingMode(page, 'Drag');

  await selectImageByName(page, 'alpha.bmp');
  await drawByDragOnCanvas(page, { xFrac: 0.10, yFrac: 0.12 }, { xFrac: 0.62, yFrac: 0.72 }); // large
  await drawByDragOnCanvas(page, { xFrac: 0.68, yFrac: 0.16 }, { xFrac: 0.77, yFrac: 0.29 }); // small
  await drawByDragOnCanvas(page, { xFrac: 0.16, yFrac: 0.76 }, { xFrac: 0.36, yFrac: 0.92 }); // medium
  await setAnnotationClassByDisplayId(page, 1, 'Vehicle');
  await setAnnotationClassByDisplayId(page, 2, 'Person');

  await selectImageByName(page, 'beta.bmp');
  await drawByDragOnCanvas(page, { xFrac: 0.24, yFrac: 0.24 }, { xFrac: 0.52, yFrac: 0.58 });
  await setAnnotationClassByDisplayId(page, 1, 'Person');

  await bookmarkImageByName(page, 'alpha.bmp');
  await bookmarkImageByName(page, 'gamma.bmp');
}

test.describe('General section and tab filtering/sorting', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('General tab Selected annotation section renders and tracks selected annotation coordinates', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('selected-annotation.bmp', 320, 220, { r: 105, g: 120, b: 175 }),
    ]);
    await setAddingMode(page, 'Drag');

    await openSidebarTab(page, 'General');
    await expect(page.locator('section.general-coordinates-segment h4')).toHaveText('Selected annotation');
    await expect(page.locator('.coords-source')).toContainText('No active annotation');

    await drawByDragOnCanvas(page, { xFrac: 0.18, yFrac: 0.25 }, { xFrac: 0.33, yFrac: 0.43 });
    await drawByDragOnCanvas(page, { xFrac: 0.44, yFrac: 0.31 }, { xFrac: 0.79, yFrac: 0.72 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(2);

    await page.locator('.annotation-title-btn').filter({ hasText: '#1 ' }).first().click();
    await openSidebarTab(page, 'General');
    await expect(page.locator('.coords-source')).toContainText('Selected annotation');
    const width1 = await getCoordValue(page, 'Width');
    const height1 = await getCoordValue(page, 'Height');
    expect(width1).toBeGreaterThan(2);
    expect(height1).toBeGreaterThan(2);

    await openSidebarTab(page, 'Annotations');
    await page.locator('.annotation-title-btn').filter({ hasText: '#2 ' }).first().click();
    await openSidebarTab(page, 'General');
    const width2 = await getCoordValue(page, 'Width');
    const height2 = await getCoordValue(page, 'Height');
    expect(width2).toBeGreaterThan(width1 + 20);
    expect(height2).toBeGreaterThan(height1 + 20);
  });

  test('Images tab sorting and filtering apply correctly', async ({ page }) => {
    await seedSortFilterDataset(page);
    await openSidebarTab(page, 'Images');

    const sortSelect = page.locator('label', { hasText: 'Sort' }).locator('select').first();
    const filterSelect = page.locator('label', { hasText: 'Filter' }).locator('select').first();
    const classFilterModeSelect = page.locator('label', { hasText: 'Class filter' }).locator('select').first();
    const searchInput = page.getByPlaceholder('Filter by image name');

    await sortSelect.selectOption('alphabetical');
    expect(await imageNames(page)).toEqual(['alpha.bmp', 'beta.bmp', 'gamma.bmp']);

    await sortSelect.selectOption('reversedAlphabetical');
    expect(await imageNames(page)).toEqual(['gamma.bmp', 'beta.bmp', 'alpha.bmp']);

    await sortSelect.selectOption('largestFirst');
    expect(await imageNames(page)).toEqual(['beta.bmp', 'gamma.bmp', 'alpha.bmp']);

    await sortSelect.selectOption('mostAnnotations');
    expect(await imageNames(page)).toEqual(['alpha.bmp', 'beta.bmp', 'gamma.bmp']);

    await filterSelect.selectOption('hideAnnotated');
    await expect(page.locator('.image-list-row')).toHaveCount(1);
    expect(await imageNames(page)).toEqual(['gamma.bmp']);

    await filterSelect.selectOption('hideUnannotated');
    await expect(page.locator('.image-list-row')).toHaveCount(2);
    expect(await imageNames(page)).toEqual(['alpha.bmp', 'beta.bmp']);

    await filterSelect.selectOption('hideBookmarked');
    await expect(page.locator('.image-list-row')).toHaveCount(1);
    expect(await imageNames(page)).toEqual(['beta.bmp']);

    await filterSelect.selectOption('hideUnbookmarked');
    await expect(page.locator('.image-list-row')).toHaveCount(2);
    expect(await imageNames(page)).toEqual(['alpha.bmp', 'gamma.bmp']);

    await filterSelect.selectOption('none');
    await searchInput.fill('beta');
    await expect(page.locator('.image-list-row')).toHaveCount(1);
    expect(await imageNames(page)).toEqual(['beta.bmp']);
    await searchInput.fill('');

    const classFilterPicker = page.locator('.class-filter-picker-btn').first();
    await classFilterPicker.click();
    const classFilterMenu = page.locator('.annotation-menu.class-filter-menu').first();
    await expect(classFilterMenu).toBeVisible();
    await classFilterMenu.locator('.class-filter-option', { hasText: 'Person' }).click();
    await classFilterMenu.locator('.class-filter-option', { hasText: 'Vehicle' }).click();
    await page.keyboard.press('Escape');

    await classFilterModeSelect.selectOption('hasAll');
    await expect(page.locator('.image-list-row')).toHaveCount(1);
    expect(await imageNames(page)).toEqual(['alpha.bmp']);

    await classFilterModeSelect.selectOption('hasAny');
    await expect(page.locator('.image-list-row')).toHaveCount(2);
    expect(await imageNames(page)).toEqual(['alpha.bmp', 'beta.bmp']);

    await classFilterModeSelect.selectOption('hasNone');
    await expect(page.locator('.image-list-row')).toHaveCount(1);
    expect(await imageNames(page)).toEqual(['gamma.bmp']);
  });

  test('Annotations tab sorting and filtering apply correctly', async ({ page }) => {
    await seedSortFilterDataset(page);
    await selectImageByName(page, 'alpha.bmp');
    await openSidebarTab(page, 'Annotations');

    const sortSelect = page.locator('label', { hasText: 'Sort' }).locator('select').first();
    const filterSelect = page.locator('label', { hasText: 'Filter' }).locator('select').first();
    const searchInput = page.getByPlaceholder('Filter by annotation label');

    await sortSelect.selectOption('newest');
    await expect((await annotationTitles(page))[0]).toContain('#3 Unassigned');

    await sortSelect.selectOption('oldest');
    await expect((await annotationTitles(page))[0]).toContain('#1 Vehicle');

    await sortSelect.selectOption('alphabetical');
    {
      const titles = await annotationTitles(page);
      expect(titles[0]).toContain('Person');
      expect(titles[1]).toContain('Unassigned');
      expect(titles[2]).toContain('Vehicle');
    }

    await sortSelect.selectOption('reversedAlphabetical');
    await expect((await annotationTitles(page))[0]).toContain('Vehicle');

    await sortSelect.selectOption('largestFirst');
    {
      const titles = await annotationTitles(page);
      expect(titles[0]).toContain('#1 ');
      expect(titles[2]).toContain('#2 ');
    }

    await sortSelect.selectOption('smallestFirst');
    await expect((await annotationTitles(page))[0]).toContain('#2 ');

    await filterSelect.selectOption('hideAssigned');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect((await annotationTitles(page))[0]).toContain('Unassigned');

    await filterSelect.selectOption('hideUnassigned');
    await expect(annotationItems(page)).toHaveCount(2);
    const visibleTitles = await annotationTitles(page);
    expect(visibleTitles.some((t) => t.includes('Unassigned'))).toBeFalsy();

    await filterSelect.selectOption('none');
    await searchInput.fill('Person');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect((await annotationTitles(page))[0]).toContain('Person');
  });

  test('Classes tab sorting and filtering apply correctly', async ({ page }) => {
    await seedSortFilterDataset(page);
    await openSidebarTab(page, 'Classes');

    const sortSelect = page.locator('label', { hasText: 'Sort' }).locator('select').first();
    const filterSelect = page.locator('label', { hasText: 'Filter' }).locator('select').first();
    const searchInput = page.getByPlaceholder('Filter by class name');

    await sortSelect.selectOption('alphabetical');
    {
      const names = await classNames(page);
      expect(names[0]).toContain('Person');
      expect(names[names.length - 1]).toContain('Zebra');
    }

    await sortSelect.selectOption('reversedAlphabetical');
    {
      const names = await classNames(page);
      expect(names[0]).toContain('Zebra');
      expect(names[names.length - 1]).toContain('Person');
    }

    await sortSelect.selectOption('countDescending');
    {
      const names = await classNames(page);
      expect(names[0]).toContain('Person');
      expect(names[names.length - 1]).toContain('Zebra');
    }

    await sortSelect.selectOption('countAscending');
    await expect((await classNames(page))[0]).toContain('Zebra');

    await filterSelect.selectOption('hideUsed');
    await expect(page.locator('.class-card')).toHaveCount(1);
    await expect((await classNames(page))[0]).toContain('Zebra');

    await filterSelect.selectOption('hideUnused');
    await expect(page.locator('.class-card')).toHaveCount(3);
    expect((await classNames(page)).some((name) => name.includes('Zebra'))).toBeFalsy();

    await filterSelect.selectOption('none');
    await searchInput.fill('veh');
    await expect(page.locator('.class-card')).toHaveCount(1);
    await expect((await classNames(page))[0]).toContain('Vehicle');
  });
});
