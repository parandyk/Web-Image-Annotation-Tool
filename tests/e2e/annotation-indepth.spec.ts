import { expect, test, type FilePayload, type Locator, type Page } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByDragOnCanvas,
  dragOnCanvas,
  getCoordValue,
  openImagesViaTopbar,
  openSidebarTab,
  setAddingMode,
  setApplicationMode,
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
  await chooser.setFiles([
    textFile(
      'classes.txt',
      `${classes.join('\n')}\n`
    ),
  ]);
}

async function canvasBox(page: Page): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const canvas = page.locator('.canvas-container canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box unavailable.');
  }
  return box;
}

async function rightClickCanvas(page: Page, at: { xFrac: number; yFrac: number }): Promise<void> {
  const box = await canvasBox(page);
  const x = box.x + box.width * at.xFrac;
  const y = box.y + box.height * at.yFrac;
  await page.mouse.click(x, y, { button: 'right' });
}

function canvasAnnotationMenu(page: Page): Locator {
  return page
    .locator('.annotation-menu')
    .filter({ has: page.getByRole('button', { name: 'Swap class', exact: true }) })
    .first();
}

async function openCanvasAnnotationMenu(page: Page, at: { xFrac: number; yFrac: number }): Promise<Locator> {
  await rightClickCanvas(page, at);
  const menu = canvasAnnotationMenu(page);
  await expect(menu).toBeVisible();
  return menu;
}

async function parseSizeChip(row: Locator): Promise<{ width: number; height: number }> {
  const text = ((await row.locator('.annotation-size-chip').textContent()) ?? '').trim();
  const match = text.match(/^(\d+)x(\d+)$/);
  expect(match, `Unexpected size chip format: ${text}`).not.toBeNull();
  return {
    width: Number(match?.[1] ?? 0),
    height: Number(match?.[2] ?? 0),
  };
}

function expectNear(actual: number, expected: number, tolerance: number, label: string): void {
  expect(Math.abs(actual - expected), `${label}: expected ${actual} ~ ${expected} ±${tolerance}`).toBeLessThanOrEqual(tolerance);
}

test.describe('Annotation behavior in-depth', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('annotation can be moved by drag and keyboard nudges while size remains stable', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('ann-move.bmp', 360, 240, { r: 90, g: 125, b: 165 }),
    ]);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.32 }, { xFrac: 0.52, yFrac: 0.60 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await annotationItems(page).first().locator('.annotation-title-btn').click();

    await setApplicationMode(page, 'Edit');
    await openSidebarTab(page, 'General');

    const beforeX1 = await getCoordValue(page, 'X1');
    const beforeY1 = await getCoordValue(page, 'Y1');
    const beforeWidth = await getCoordValue(page, 'Width');
    const beforeHeight = await getCoordValue(page, 'Height');

    await dragOnCanvas(page, { xFrac: 0.40, yFrac: 0.46 }, { xFrac: 0.57, yFrac: 0.58 });

    const afterDragX1 = await getCoordValue(page, 'X1');
    const afterDragY1 = await getCoordValue(page, 'Y1');
    const afterDragWidth = await getCoordValue(page, 'Width');
    const afterDragHeight = await getCoordValue(page, 'Height');

    expect(afterDragX1).toBeGreaterThan(beforeX1 + 2);
    expect(afterDragY1).toBeGreaterThan(beforeY1 + 2);
    expectNear(afterDragWidth, beforeWidth, 0.3, 'Width should not change during drag move');
    expectNear(afterDragHeight, beforeHeight, 0.3, 'Height should not change during drag move');

    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Alt+Shift+ArrowDown');

    const afterNudgeX1 = await getCoordValue(page, 'X1');
    const afterNudgeY1 = await getCoordValue(page, 'Y1');
    const afterNudgeWidth = await getCoordValue(page, 'Width');
    const afterNudgeHeight = await getCoordValue(page, 'Height');

    expectNear(afterNudgeX1, afterDragX1 + 1, 0.2, 'Alt+ArrowRight should move by one pixel');
    expectNear(afterNudgeY1, afterDragY1 + 10, 0.2, 'Alt+Shift+ArrowDown should move by ten pixels');
    expectNear(afterNudgeWidth, afterDragWidth, 0.3, 'Width should remain stable after nudges');
    expectNear(afterNudgeHeight, afterDragHeight, 0.3, 'Height should remain stable after nudges');

    await openSidebarTab(page, 'Annotations');
    const sizeChip = await parseSizeChip(annotationItems(page).first());
    expect(sizeChip.width).toBe(Math.round(afterNudgeWidth));
    expect(sizeChip.height).toBe(Math.round(afterNudgeHeight));
  });

  test('class, visibility, and anchoring toggles work and anchored annotation cannot be moved', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('ann-flags.bmp', 340, 220, { r: 130, g: 95, b: 145 }),
    ]);
    await importClasses(page, ['Vehicle', 'Person']);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.30, yFrac: 0.35 }, { xFrac: 0.53, yFrac: 0.62 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    const row = annotationItems(page).first();

    await row.locator('select.annotation-class-select').selectOption({ label: 'Vehicle' });
    await expect(row.locator('.annotation-title-btn')).toContainText('Vehicle');

    await row.locator('button[title="Hide annotation"]').click();
    await expect(row.locator('button[title="Show annotation"]')).toBeVisible();
    await row.locator('button[title="Show annotation"]').click();
    await expect(row.locator('button[title="Hide annotation"]')).toBeVisible();

    await row.locator('button[title="Anchor annotation"]').click();
    await expect(row.locator('button[title="Unanchor annotation"]')).toBeVisible();
    await row.locator('.annotation-title-btn').click();

    await setApplicationMode(page, 'Edit');
    await openSidebarTab(page, 'General');

    const anchoredX1 = await getCoordValue(page, 'X1');
    await page.keyboard.press('Alt+ArrowRight');
    expectNear(await getCoordValue(page, 'X1'), anchoredX1, 0.1, 'Anchored annotation should not nudge');

    await dragOnCanvas(page, { xFrac: 0.41, yFrac: 0.50 }, { xFrac: 0.62, yFrac: 0.62 });
    expectNear(await getCoordValue(page, 'X1'), anchoredX1, 0.3, 'Anchored annotation should not drag');

    await openSidebarTab(page, 'Annotations');
    await row.locator('button[title="Unanchor annotation"]').click();
    await expect(row.locator('button[title="Anchor annotation"]')).toBeVisible();

    await openSidebarTab(page, 'General');
    const unanchoredX1 = await getCoordValue(page, 'X1');
    await page.keyboard.press('Alt+ArrowRight');
    expect(await getCoordValue(page, 'X1')).toBeGreaterThan(unanchoredX1 + 0.6);
  });

  test('annotation can be resized with transformer handles and size stays clamped to image bounds', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('ann-resize.bmp', 320, 220, { r: 100, g: 140, b: 170 }),
    ]);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.30, yFrac: 0.33 }, { xFrac: 0.48, yFrac: 0.55 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await annotationItems(page).first().locator('.annotation-title-btn').click();

    await setApplicationMode(page, 'Edit');
    await openSidebarTab(page, 'General');

    const beforeX1 = await getCoordValue(page, 'X1');
    const beforeY1 = await getCoordValue(page, 'Y1');
    const beforeWidth = await getCoordValue(page, 'Width');
    const beforeHeight = await getCoordValue(page, 'Height');

    await dragOnCanvas(page, { xFrac: 0.48, yFrac: 0.55 }, { xFrac: 1.10, yFrac: 1.05 });

    const afterX1 = await getCoordValue(page, 'X1');
    const afterY1 = await getCoordValue(page, 'Y1');
    const afterX2 = await getCoordValue(page, 'X2');
    const afterY2 = await getCoordValue(page, 'Y2');
    const afterWidth = await getCoordValue(page, 'Width');
    const afterHeight = await getCoordValue(page, 'Height');

    expect(afterWidth).toBeGreaterThan(beforeWidth + 4);
    expect(afterHeight).toBeGreaterThan(beforeHeight + 4);
    expectNear(afterX1, beforeX1, 2.5, 'Resizing from bottom-right should keep X1 roughly stable');
    expectNear(afterY1, beforeY1, 2.5, 'Resizing from bottom-right should keep Y1 roughly stable');
    expect(afterX2).toBeLessThanOrEqual(320.1);
    expect(afterY2).toBeLessThanOrEqual(220.1);

    await openSidebarTab(page, 'Annotations');
    const sizeChip = await parseSizeChip(annotationItems(page).first());
    expect(sizeChip.width).toBe(Math.round(afterWidth));
    expect(sizeChip.height).toBe(Math.round(afterHeight));
  });

  test('canvas flyout exposes annotation actions for toggles, class swap, and deletion', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('ann-flyout.bmp', 320, 200, { r: 120, g: 100, b: 180 }),
    ]);
    await importClasses(page, ['Vehicle', 'Person']);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.31, yFrac: 0.34 }, { xFrac: 0.52, yFrac: 0.60 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    const row = annotationItems(page).first();
    await row.locator('select.annotation-class-select').selectOption({ label: 'Vehicle' });
    await expect(row.locator('.annotation-title-btn')).toContainText('Vehicle');

    {
      const menu = await openCanvasAnnotationMenu(page, { xFrac: 0.41, yFrac: 0.47 });
      await expect(menu.getByRole('button', { name: 'Toggle visibility', exact: true })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Toggle anchoring', exact: true })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Swap class', exact: true })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
      await expect(menu.locator('.annotation-menu-context')).toContainText('#1 Vehicle');
      await menu.getByRole('button', { name: 'Toggle anchoring', exact: true }).click();
    }
    await openSidebarTab(page, 'Annotations');
    await expect(row.locator('button[title="Unanchor annotation"]')).toBeVisible();

    {
      const menu = await openCanvasAnnotationMenu(page, { xFrac: 0.41, yFrac: 0.47 });
      await menu.getByRole('button', { name: 'Swap class', exact: true }).click();
      const swapDialog = modalByHeading(page, 'Swap class');
      await expect(swapDialog).toBeVisible();
      await swapDialog.locator('select').selectOption({ label: 'Person' });
      await swapDialog.getByRole('button', { name: 'Apply', exact: true }).click();
    }
    await openSidebarTab(page, 'Annotations');
    await expect(row.locator('.annotation-title-btn')).toContainText('Person');

    {
      const menu = await openCanvasAnnotationMenu(page, { xFrac: 0.41, yFrac: 0.47 });
      await menu.getByRole('button', { name: 'Toggle visibility', exact: true }).click();
    }
    await openSidebarTab(page, 'Annotations');
    await expect(row.locator('button[title="Show annotation"]')).toBeVisible();
    await row.locator('button[title="Show annotation"]').click();
    await expect(row.locator('button[title="Hide annotation"]')).toBeVisible();

    {
      const menu = await openCanvasAnnotationMenu(page, { xFrac: 0.41, yFrac: 0.47 });
      await menu.getByRole('button', { name: 'Delete', exact: true }).click();
      const deleteDialog = modalByHeading(page, 'Delete annotation');
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    }
    await expect(annotationItems(page)).toHaveCount(0);
  });
});
