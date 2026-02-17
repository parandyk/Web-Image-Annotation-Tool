import { expect, test, type Page } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByDragOnCanvas,
  openImagesViaTopbar,
  openSidebarTab,
  setAddingMode,
} from './helpers/app';
import { topbar } from './helpers/topbar';

async function focusCanvas(page: Page): Promise<void> {
  const canvas = page.locator('.canvas-container canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box unavailable.');
  }
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
}

test.describe('App keyboard interactions', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('arrow keys navigate images/annotations and shift jumps to first/last image', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('kbd-nav-a.bmp', 300, 200, { r: 170, g: 80, b: 90 }),
      bmpFile('kbd-nav-b.bmp', 300, 200, { r: 90, g: 150, b: 120 }),
      bmpFile('kbd-nav-c.bmp', 300, 200, { r: 80, g: 110, b: 180 }),
    ]);

    await openSidebarTab(page, 'Images');
    const imageNavCount = page.locator('section:has-text("Image navigation") .nav-status-count');
    await expect(imageNavCount).toHaveText('1/3');

    await focusCanvas(page);
    await page.keyboard.press('ArrowRight');
    await expect(imageNavCount).toHaveText('2/3');

    await page.keyboard.press('Shift+ArrowRight');
    await expect(imageNavCount).toHaveText('3/3');

    await page.keyboard.press('ArrowLeft');
    await expect(imageNavCount).toHaveText('2/3');

    await page.keyboard.press('Shift+ArrowLeft');
    await expect(imageNavCount).toHaveText('1/3');

    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.24, yFrac: 0.28 }, { xFrac: 0.48, yFrac: 0.57 });
    await drawByDragOnCanvas(page, { xFrac: 0.55, yFrac: 0.34 }, { xFrac: 0.79, yFrac: 0.69 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(2);
    const annotationNavCount = page.locator('section:has-text("Annotation navigation") .nav-status-count');
    await expect(annotationNavCount).toHaveText('2/2');

    await focusCanvas(page);
    await page.keyboard.press('ArrowUp');
    await expect(annotationNavCount).toHaveText('1/2');

    await page.keyboard.press('ArrowDown');
    await expect(annotationNavCount).toHaveText('2/2');
  });

  test('Backquote toggles add/edit mode, but is ignored while modal or text input is focused', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('kbd-mode.bmp', 320, 220, { r: 110, g: 130, b: 170 })]);
    const toolbarStatus = page.locator('.canvas-toolbar > span');

    await expect(toolbarStatus).toContainText('Mode: edit');
    await focusCanvas(page);
    await page.keyboard.press('Backquote');
    await expect(toolbarStatus).toContainText('Mode: add');

    await topbar(page).getByRole('button', { name: 'Settings', exact: true }).click();
    const settingsDialog = page.locator('.modal-card').filter({ has: page.getByRole('heading', { name: 'Settings' }) }).first();
    await expect(settingsDialog).toBeVisible();
    await page.keyboard.press('Backquote');
    await expect(toolbarStatus).toContainText('Mode: add');
    await settingsDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(settingsDialog).toBeHidden();

    await openSidebarTab(page, 'Classes');
    const classNameInput = page.getByRole('textbox', { name: 'Class name' });
    await classNameInput.click();
    await page.keyboard.press('Backquote');
    await expect(toolbarStatus).toContainText('Mode: add');

    await focusCanvas(page);
    await page.keyboard.press('Backquote');
    await expect(toolbarStatus).toContainText('Mode: edit');
  });
});
