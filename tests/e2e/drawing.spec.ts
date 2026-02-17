import { expect, test, type FilePayload } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByClickClickOnCanvas,
  drawByDragOnCanvas,
  dragOnCanvas,
  getCoordValue,
  openImagesViaTopbar,
  openSidebarTab,
  setAddingMode,
  setApplicationMode,
} from './helpers/app';

test.describe('Drawing and overlap interactions (combined smoke+regression)', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('drag drawing creates annotation and keeps bbox clamped to image bounds', async ({ page }) => {
    const files: FilePayload[] = [
      bmpFile('drag-draw.bmp', 200, 120, { r: 50, g: 120, b: 180 }),
    ];
    await openImagesViaTopbar(page, files);
    await setAddingMode(page, 'Drag');

    await drawByDragOnCanvas(page);

    await openSidebarTab(page, 'Annotations');
    const annRows = annotationItems(page);
    await expect(annRows).toHaveCount(1);

    const sizeChip = annRows.first().locator('.annotation-size-chip');
    await expect(sizeChip).toBeVisible();
    const sizeText = (await sizeChip.textContent())?.trim() ?? '';
    const match = sizeText.match(/^(\d+)x(\d+)$/);
    expect(match, `Unexpected annotation size format: ${sizeText}`).not.toBeNull();
    const width = Number(match?.[1] ?? 0);
    const height = Number(match?.[2] ?? 0);
    expect(width).toBeGreaterThanOrEqual(4);
    expect(height).toBeGreaterThanOrEqual(4);
    expect(width).toBeLessThanOrEqual(200);
    expect(height).toBeLessThanOrEqual(120);
  });

  test('click-click drawing finalizes annotation on second click', async ({ page }) => {
    const files: FilePayload[] = [
      bmpFile('click-click.bmp', 220, 160, { r: 130, g: 90, b: 210 }),
    ];
    await openImagesViaTopbar(page, files);
    await setAddingMode(page, 'Click-Click');

    await drawByClickClickOnCanvas(page);

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
  });

  test('selected overlapped annotation can be dragged with mouse in edit mode', async ({ page }) => {
    const files: FilePayload[] = [
      bmpFile('overlap-drag.bmp', 300, 220, { r: 100, g: 120, b: 140 }),
    ];
    await openImagesViaTopbar(page, files);
    await setAddingMode(page, 'Click-Click');

    // Draw two overlapping boxes.
    await drawByClickClickOnCanvas(
      page,
      { xFrac: 0.42, yFrac: 0.45 },
      { xFrac: 0.60, yFrac: 0.66 }
    );
    await drawByClickClickOnCanvas(
      page,
      { xFrac: 0.50, yFrac: 0.50 },
      { xFrac: 0.70, yFrac: 0.73 }
    );

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(2);

    // Select the first annotation explicitly.
    await page.locator('.annotation-title-btn').filter({ hasText: '#1 ' }).first().click();
    await setApplicationMode(page, 'Edit');
    await openSidebarTab(page, 'General');

    const beforeX1 = await getCoordValue(page, 'X1');

    // Drag from overlap area; selected annotation should move.
    await dragOnCanvas(page, { xFrac: 0.55, yFrac: 0.56 }, { xFrac: 0.70, yFrac: 0.66 });

    const afterX1 = await getCoordValue(page, 'X1');
    expect(afterX1).toBeGreaterThan(beforeX1 + 2);
  });
});
