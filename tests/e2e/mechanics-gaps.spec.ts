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

function textFile(name: string, content: string, mimeType = 'text/plain'): FilePayload {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8'),
  };
}

function topbar(page: Page): Locator {
  return page.locator('header.topbar');
}

async function openTopbarImportMenu(page: Page): Promise<Locator> {
  await topbar(page).getByRole('button', { name: 'Import', exact: true }).click();
  const menu = page.locator('.menu.open .menu-popover').first();
  await expect(menu).toBeVisible();
  return menu;
}

async function importClasses(page: Page, classes: string[]): Promise<void> {
  const menu = await openTopbarImportMenu(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await menu.getByRole('button', { name: 'Import classes', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles([textFile('classes.txt', `${classes.join('\n')}\n`)]);
}

async function canvasBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const canvas = page.locator('.canvas-container canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box unavailable.');
  }
  return box;
}

async function clickCanvas(page: Page, xFrac: number, yFrac: number): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width * xFrac, box.y + box.height * yFrac);
}

async function focusCanvas(page: Page): Promise<void> {
  await clickCanvas(page, 0.5, 0.5);
}

type MinimapViewport = { left: number; top: number; width: number; height: number };

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value.replace('px', '').trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Could not parse pixel value: "${value}"`);
  }
  return parsed;
}

async function readMinimapViewport(page: Page): Promise<MinimapViewport> {
  const viewport = page.locator('.workspace-minimap-viewport');
  await expect(viewport).toBeVisible();
  const style = await viewport.getAttribute('style');
  if (!style) {
    throw new Error('Missing minimap viewport style.');
  }
  const capture = (name: string): number => {
    const match = style.match(new RegExp(`${name}:\\s*([^;]+)`));
    if (!match) {
      throw new Error(`Missing ${name} in minimap viewport style: "${style}"`);
    }
    return parsePx(match[1]);
  };
  return {
    left: capture('left'),
    top: capture('top'),
    width: capture('width'),
    height: capture('height'),
  };
}

function imageRowByName(page: Page, imageName: string): Locator {
  return page
    .locator('.image-list-row')
    .filter({ has: page.locator('.image-name-btn', { hasText: imageName }) })
    .first();
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

function annotationRowByDisplayId(page: Page, displayId: number): Locator {
  return annotationItems(page)
    .filter({ has: page.locator('.annotation-title-btn', { hasText: `#${displayId} ` }) })
    .first();
}

function modalByHeading(page: Page, heading: string): Locator {
  return page
    .locator('.modal-card:visible')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
    .first();
}

async function zoomCanvas(page: Page, deltaY: number): Promise<void> {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, deltaY);
  await page.keyboard.up('Control');
}

async function zoomCanvasSteps(page: Page, steps: number): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    await zoomCanvas(page, -120);
  }
}

test.describe('Mechanical interaction gaps', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('minimap click and viewport drag both pan the canvas viewport', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('minimap-mechanics.bmp', 1400, 1000, { r: 110, g: 120, b: 170 })]);
    await zoomCanvasSteps(page, 8);

    const minimap = page.locator('.workspace-minimap');
    await expect(minimap).toBeVisible();

    const initial = await readMinimapViewport(page);
    const minimapBox = await minimap.boundingBox();
    if (!minimapBox) {
      throw new Error('Minimap bounding box unavailable.');
    }

    const targetX =
      initial.left + initial.width + 12 < minimapBox.width
        ? initial.left + initial.width + 12
        : Math.max(6, initial.left - 12);
    const targetY =
      initial.top + initial.height + 12 < minimapBox.height
        ? initial.top + initial.height + 12
        : Math.max(6, initial.top - 12);
    await page.mouse.click(minimapBox.x + targetX, minimapBox.y + targetY);
    await expect
      .poll(() => readMinimapViewport(page))
      .toEqual(expect.objectContaining({ left: expect.any(Number), top: expect.any(Number) }));
    const afterClick = await readMinimapViewport(page);
    const clickDelta = Math.abs(afterClick.left - initial.left) + Math.abs(afterClick.top - initial.top);
    expect(clickDelta).toBeGreaterThan(4);

    const viewportEl = page.locator('.workspace-minimap-viewport');
    const viewportBox = await viewportEl.boundingBox();
    if (!viewportBox) {
      throw new Error('Minimap viewport bounding box unavailable.');
    }
    await page.mouse.move(viewportBox.x + viewportBox.width * 0.5, viewportBox.y + viewportBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(minimapBox.x + minimapBox.width * 0.18, minimapBox.y + minimapBox.height * 0.18, { steps: 10 });
    await page.mouse.up();

    const afterDrag = await readMinimapViewport(page);
    const dragDelta = Math.abs(afterDrag.left - afterClick.left) + Math.abs(afterDrag.top - afterClick.top);
    expect(dragDelta).toBeGreaterThan(4);
  });

  test('Escape cancels click-click draft before second-click finalization', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('escape-draft.bmp', 360, 240, { r: 120, g: 100, b: 160 })]);
    await setAddingMode(page, 'Click-Click');

    await clickCanvas(page, 0.25, 0.28); // Start draft.
    await page.keyboard.press('Escape'); // Cancel draft.

    await clickCanvas(page, 0.56, 0.50); // New draft starts.
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);

    await clickCanvas(page, 0.78, 0.72); // Finalize new draft.
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
  });

  test('Ctrl/Cmd+A selects all annotations and Delete removes selected after confirmation', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('annotation-shortcuts.bmp', 360, 240, { r: 95, g: 130, b: 175 })]);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.18, yFrac: 0.20 }, { xFrac: 0.38, yFrac: 0.46 });
    await drawByDragOnCanvas(page, { xFrac: 0.44, yFrac: 0.30 }, { xFrac: 0.66, yFrac: 0.58 });
    await drawByDragOnCanvas(page, { xFrac: 0.70, yFrac: 0.34 }, { xFrac: 0.90, yFrac: 0.64 });

    await focusCanvas(page);
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`);

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(3);
    await expect(page.locator('.annotation-item.selected')).toHaveCount(3);

    await focusCanvas(page);
    await page.keyboard.press('Delete');
    const dialog = modalByHeading(page, 'Delete annotation');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click({ force: true });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(3);

    await focusCanvas(page);
    await page.keyboard.press('Delete');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click({ force: true });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);
  });

  test('Delete key in Images tab deletes selected images after confirmation', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('kbd-img-a.bmp', 240, 160, { r: 160, g: 80, b: 90 }),
      bmpFile('kbd-img-b.bmp', 240, 160, { r: 80, g: 150, b: 120 }),
      bmpFile('kbd-img-c.bmp', 240, 160, { r: 90, g: 120, b: 180 }),
    ]);
    await openSidebarTab(page, 'Images');
    await expect(page.locator('.image-list-row')).toHaveCount(3);

    await selectImages(page, ['kbd-img-a.bmp', 'kbd-img-b.bmp']);
    await page.keyboard.press('Delete');
    const dialog = modalByHeading(page, 'Delete image');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.image-list-row')).toHaveCount(3);

    await selectImages(page, ['kbd-img-a.bmp', 'kbd-img-b.bmp']);
    await page.keyboard.press('Delete');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.locator('.image-list-row')).toHaveCount(1);
    await expect(imageRowByName(page, 'kbd-img-c.bmp')).toBeVisible();
  });

  test('Delete key in Classes tab opens bulk delete dialog and removes selected class', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('kbd-class-delete.bmp', 320, 220, { r: 110, g: 130, b: 165 })]);
    await importClasses(page, ['Vehicle']);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.30, yFrac: 0.32 }, { xFrac: 0.58, yFrac: 0.64 });

    await openSidebarTab(page, 'Annotations');
    await annotationRowByDisplayId(page, 1).locator('select.annotation-class-select').selectOption({ label: 'Vehicle' });

    await openSidebarTab(page, 'Classes');
    const vehicleCard = page
      .locator('.class-card')
      .filter({ has: page.locator('.class-name-btn', { hasText: 'Vehicle' }) })
      .first();
    await expect(vehicleCard).toBeVisible();
    await vehicleCard.locator('.class-name-btn').click();

    await page.keyboard.press('Delete');
    const dialog = modalByHeading(page, 'Delete classes');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(vehicleCard).toBeVisible();

    await vehicleCard.locator('.class-name-btn').click();
    await page.keyboard.press('Delete');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect(
      page
        .locator('.class-card')
        .filter({ has: page.locator('.class-name-btn', { hasText: 'Vehicle' }) })
    ).toHaveCount(0);

    await openSidebarTab(page, 'Annotations');
    await expect(annotationRowByDisplayId(page, 1).locator('.annotation-title-btn')).toContainText('Unassigned');
  });
});
