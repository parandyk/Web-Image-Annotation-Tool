import { expect, test, type FilePayload, type Locator, type Page } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByDragOnCanvas,
  openImagesViaTopbar,
  openSidebarTab,
  setAddingMode,
} from './helpers/app';

function topbar(page: Page): Locator {
  return page.locator('header.topbar');
}

function modalByHeading(page: Page, heading: string): Locator {
  return page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: heading }) })
    .first();
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
  const row = page.locator('.image-list-row').filter({ has: page.locator('.image-name-btn', { hasText: imageName }) }).first();
  await expect(row).toBeVisible();
  await row.locator('.image-name-btn').click();
}

async function bookmarkImageByName(page: Page, imageName: string): Promise<void> {
  await openSidebarTab(page, 'Images');
  const row = page.locator('.image-list-row').filter({ has: page.locator('.image-name-btn', { hasText: imageName }) }).first();
  await expect(row).toBeVisible();
  const bookmark = row.locator('button[title="Bookmark image"]');
  if (await bookmark.isVisible().catch(() => false)) {
    await bookmark.click();
  }
  await expect(
    row.locator('button[title="Remove bookmark"]')
  ).toBeVisible();
}

async function setAnnotationClassByDisplayId(page: Page, displayId: number, classLabel: string): Promise<void> {
  await openSidebarTab(page, 'Annotations');
  const row = annotationItems(page)
    .filter({ has: page.locator('.annotation-title-btn', { hasText: `#${displayId} ` }) })
    .first();
  await expect(row).toBeVisible();
  await row.locator('select.annotation-class-select').selectOption({ label: classLabel });
}

async function openStatistics(page: Page): Promise<Locator> {
  await topbar(page).getByRole('button', { name: 'Statistics', exact: true }).click();
  const dialog = modalByHeading(page, 'Statistics');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function setStatisticsScope(dialog: Locator, scope: 'Current image' | 'Bookmarked images' | 'All images'): Promise<void> {
  await dialog.getByRole('button', { name: scope, exact: true }).click();
}

function summaryCard(dialog: Locator, label: string): Locator {
  return dialog.locator('.statistics-card', { hasText: label }).first();
}

async function expectSummary(
  dialog: Locator,
  expected: { images: number; classes: number; annotations: number; unassigned: number }
): Promise<void> {
  await expect(summaryCard(dialog, 'Images').locator('.statistics-card-value')).toHaveText(String(expected.images));
  await expect(summaryCard(dialog, 'Classes').locator('.statistics-card-value')).toHaveText(String(expected.classes));
  await expect(summaryCard(dialog, 'Annotations (total)').locator('.statistics-card-value')).toHaveText(String(expected.annotations));
  await expect(summaryCard(dialog, 'Unassigned annotations').locator('.statistics-card-value')).toHaveText(String(expected.unassigned));
}

async function expectClassStatsRow(
  dialog: Locator,
  classNameText: string,
  expected: { instances: number; percent: string }
): Promise<void> {
  const row = dialog.locator('.statistics-table-class tbody tr', { hasText: classNameText }).first();
  await expect(row).toBeVisible();
  const metrics = row.locator('td.statistics-num');
  await expect(metrics.nth(0)).toHaveText(String(expected.instances));
  await expect(metrics.nth(1)).toHaveText(expected.percent);
}

async function expectPerImageStatsRow(
  dialog: Locator,
  imageName: string,
  expected: { total: number; unassigned: number; assigned: number }
): Promise<void> {
  const row = dialog.locator('.statistics-table-image tbody tr', { hasText: imageName }).first();
  await expect(row).toBeVisible();
  const cells = row.locator('td.statistics-num');
  await expect(cells.nth(0)).toHaveText(String(expected.total));
  await expect(cells.nth(1)).toHaveText(String(expected.unassigned));
  await expect(cells.nth(2)).toHaveText(String(expected.assigned));
}

async function seedStatisticsDataset(page: Page): Promise<void> {
  await openImagesViaTopbar(page, [
    bmpFile('stats-a.bmp', 320, 220, { r: 90, g: 120, b: 160 }),
    bmpFile('stats-b.bmp', 320, 220, { r: 130, g: 95, b: 150 }),
    bmpFile('stats-c.bmp', 320, 220, { r: 80, g: 150, b: 120 }),
  ]);
  await importClasses(page, ['Vehicle', 'Person']);
  await setAddingMode(page, 'Drag');

  await selectImageByName(page, 'stats-a.bmp');
  await drawByDragOnCanvas(page, { xFrac: 0.18, yFrac: 0.24 }, { xFrac: 0.34, yFrac: 0.45 });
  await drawByDragOnCanvas(page, { xFrac: 0.40, yFrac: 0.33 }, { xFrac: 0.58, yFrac: 0.54 });
  await drawByDragOnCanvas(page, { xFrac: 0.62, yFrac: 0.30 }, { xFrac: 0.82, yFrac: 0.55 });
  await setAnnotationClassByDisplayId(page, 1, 'Vehicle');
  await setAnnotationClassByDisplayId(page, 2, 'Person');
  // Annotation #3 remains Unassigned by design.

  await selectImageByName(page, 'stats-b.bmp');
  await drawByDragOnCanvas(page, { xFrac: 0.22, yFrac: 0.28 }, { xFrac: 0.41, yFrac: 0.50 });
  await drawByDragOnCanvas(page, { xFrac: 0.56, yFrac: 0.34 }, { xFrac: 0.77, yFrac: 0.58 });
  await setAnnotationClassByDisplayId(page, 1, 'Vehicle');
  // Annotation #2 remains Unassigned.

  await selectImageByName(page, 'stats-c.bmp');
  await drawByDragOnCanvas(page, { xFrac: 0.30, yFrac: 0.31 }, { xFrac: 0.56, yFrac: 0.62 });
  await setAnnotationClassByDisplayId(page, 1, 'Person');

  await bookmarkImageByName(page, 'stats-a.bmp');
  await bookmarkImageByName(page, 'stats-c.bmp');
  await selectImageByName(page, 'stats-b.bmp');
}

test.describe('Statistics dialog data', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('statistics show correct summary cards and table data for all/current/bookmarked scopes', async ({ page }) => {
    await seedStatisticsDataset(page);

    const dialog = await openStatistics(page);

    await setStatisticsScope(dialog, 'All images');
    await expectSummary(dialog, { images: 3, classes: 3, annotations: 6, unassigned: 2 });
    await expectClassStatsRow(dialog, 'Person', { instances: 2, percent: '33.3%' });
    await expectClassStatsRow(dialog, 'Vehicle', { instances: 2, percent: '33.3%' });
    await expectClassStatsRow(dialog, 'Unassigned', { instances: 2, percent: '33.3%' });
    await expectPerImageStatsRow(dialog, 'stats-a.bmp', { total: 3, unassigned: 1, assigned: 2 });
    await expectPerImageStatsRow(dialog, 'stats-b.bmp', { total: 2, unassigned: 1, assigned: 1 });
    await expectPerImageStatsRow(dialog, 'stats-c.bmp', { total: 1, unassigned: 0, assigned: 1 });

    const allImageOrder = dialog.locator('.statistics-table-image tbody tr .statistics-name-text');
    await expect(allImageOrder.nth(0)).toHaveText('stats-a.bmp');
    await expect(allImageOrder.nth(1)).toHaveText('stats-b.bmp');
    await expect(allImageOrder.nth(2)).toHaveText('stats-c.bmp');

    await setStatisticsScope(dialog, 'Current image');
    await expectSummary(dialog, { images: 1, classes: 3, annotations: 2, unassigned: 1 });
    await expectClassStatsRow(dialog, 'Vehicle', { instances: 1, percent: '50.0%' });
    await expectClassStatsRow(dialog, 'Unassigned', { instances: 1, percent: '50.0%' });
    await expectClassStatsRow(dialog, 'Person', { instances: 0, percent: '0.0%' });
    await expectPerImageStatsRow(dialog, 'stats-b.bmp', { total: 2, unassigned: 1, assigned: 1 });

    await setStatisticsScope(dialog, 'Bookmarked images');
    await expectSummary(dialog, { images: 2, classes: 3, annotations: 4, unassigned: 1 });
    await expectClassStatsRow(dialog, 'Person', { instances: 2, percent: '50.0%' });
    await expectClassStatsRow(dialog, 'Vehicle', { instances: 1, percent: '25.0%' });
    await expectClassStatsRow(dialog, 'Unassigned', { instances: 1, percent: '25.0%' });
    await expectPerImageStatsRow(dialog, 'stats-a.bmp', { total: 3, unassigned: 1, assigned: 2 });
    await expectPerImageStatsRow(dialog, 'stats-c.bmp', { total: 1, unassigned: 0, assigned: 1 });
    await expect(dialog.locator('.statistics-table-image tbody tr .statistics-name-text')).toHaveCount(2);

    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
  });
});
