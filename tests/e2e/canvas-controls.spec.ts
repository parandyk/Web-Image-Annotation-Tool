import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByDragOnCanvas,
  openImagesViaTopbar,
  openSidebarTab,
  setAddingMode,
} from './helpers/app';

function toolbar(page: Page): Locator {
  return page.locator('.canvas-toolbar');
}

function toolbarStatus(page: Page): Locator {
  return toolbar(page).locator('> span');
}

function parseZoomPercent(statusText: string): number {
  const match = statusText.match(/Zoom:\s*(\d+)%/);
  if (!match) {
    throw new Error(`Unable to parse zoom from toolbar status: "${statusText}"`);
  }
  return Number(match[1]);
}

async function currentZoomPercent(page: Page): Promise<number> {
  const text = (await toolbarStatus(page).textContent()) ?? '';
  return parseZoomPercent(text);
}

type MinimapViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value.replace('px', '').trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse pixel value: "${value}"`);
  }
  return parsed;
}

async function minimapViewport(page: Page): Promise<MinimapViewport> {
  const viewport = page.locator('.workspace-minimap-viewport');
  await expect(viewport).toBeVisible();
  const style = await viewport.getAttribute('style');
  if (!style) {
    throw new Error('Minimap viewport style missing.');
  }
  const capture = (name: string): number => {
    const match = style.match(new RegExp(`${name}:\\s*([^;]+)`));
    if (!match) {
      throw new Error(`Missing "${name}" in minimap viewport style: "${style}"`);
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

async function dragCanvas(page: Page, from: { xFrac: number; yFrac: number }, to: { xFrac: number; yFrac: number }): Promise<void> {
  const canvas = page.locator('.canvas-container canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box unavailable.');
  }
  const x1 = box.x + box.width * from.xFrac;
  const y1 = box.y + box.height * from.yFrac;
  const x2 = box.x + box.width * to.xFrac;
  const y2 = box.y + box.height * to.yFrac;
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 12 });
  await page.mouse.up();
}

async function zoomCanvas(page: Page, deltaY: number): Promise<void> {
  const canvas = page.locator('.canvas-container canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box unavailable.');
  }
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, deltaY);
  await page.keyboard.up('Control');
}

test.describe('Canvas toolbar controls', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('Annotate and Pan buttons switch canvas mode and control drawing behavior', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('toolbar-mode.bmp', 360, 240, { r: 95, g: 130, b: 170 })]);
    await setAddingMode(page, 'Drag');

    const annotateButton = toolbar(page).getByRole('button', { name: 'Annotate', exact: true });
    const panButton = toolbar(page).getByRole('button', { name: 'Pan', exact: true });

    await expect(annotateButton).toHaveClass(/active/);
    await expect(toolbarStatus(page)).toContainText('Canvas: annotate');

    await panButton.click();
    await expect(panButton).toHaveClass(/active/);
    await expect(annotateButton).not.toHaveClass(/active/);
    await expect(toolbarStatus(page)).toContainText('Canvas: pan');

    await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.30 }, { xFrac: 0.56, yFrac: 0.64 });
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);

    await annotateButton.click();
    await expect(annotateButton).toHaveClass(/active/);
    await expect(toolbarStatus(page)).toContainText('Canvas: annotate');
    await toolbar(page).getByRole('button', { name: 'Reset view', exact: true }).click();

    await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.30 }, { xFrac: 0.56, yFrac: 0.64 });
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
  });

  test('Reset view restores zoom and viewport after zooming and panning', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('toolbar-reset.bmp', 1000, 700, { r: 120, g: 110, b: 165 })]);

    const panButton = toolbar(page).getByRole('button', { name: 'Pan', exact: true });
    const resetViewButton = toolbar(page).getByRole('button', { name: 'Reset view', exact: true });

    const initialZoom = await currentZoomPercent(page);
    const initialViewport = await minimapViewport(page);

    await zoomCanvas(page, -1600);
    await expect.poll(() => currentZoomPercent(page)).toBeGreaterThan(initialZoom);

    await panButton.click();
    await dragCanvas(page, { xFrac: 0.7, yFrac: 0.55 }, { xFrac: 0.3, yFrac: 0.45 });

    await expect.poll(() => minimapViewport(page)).toEqual(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      })
    );

    const zoomedViewport = await minimapViewport(page);
    expect(zoomedViewport.width).toBeLessThan(initialViewport.width - 2);
    expect(zoomedViewport.height).toBeLessThan(initialViewport.height - 2);

    await resetViewButton.click();

    await expect.poll(() => currentZoomPercent(page)).toBe(initialZoom);
    await expect.poll(() => minimapViewport(page)).toEqual(
      expect.objectContaining({
        width: expect.closeTo(initialViewport.width, 1.2),
        height: expect.closeTo(initialViewport.height, 1.2),
        left: expect.closeTo(initialViewport.left, 1.2),
        top: expect.closeTo(initialViewport.top, 1.2),
      })
    );
  });
});
