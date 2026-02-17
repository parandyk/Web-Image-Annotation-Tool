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
import { chooseFilesFromMenu, modalByHeading, openTopbarMenu, textFile, topbar } from './helpers/topbar';

async function openEditAndClick(page: Page, actionName: string): Promise<void> {
  const menu = await openTopbarMenu(page, 'Edit');
  await menu.getByRole('button', { name: actionName, exact: true }).click();
}

test.describe('Topbar actions', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('Open menu actions handle images, video parse failure, and folder import', async ({ page }) => {
    await chooseFilesFromMenu(page, 'Open', 'Open images', [
      bmpFile('open-a.bmp', 240, 160, { r: 170, g: 90, b: 90 }),
    ]);
    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();

    await chooseFilesFromMenu(page, 'Open', 'Open video', [
      textFile('broken.mp4', 'this-is-not-a-real-video', 'video/mp4'),
    ]);
    await expect(page.locator('.topbar-status')).toContainText('Could not open video', { timeout: 15_000 });

    await chooseFilesFromMenu(page, 'Open', 'Open image folder', [
      bmpFile('folder-image.bmp', 260, 180, { r: 80, g: 140, b: 180 }),
      textFile('notes.txt', 'non-image file'),
    ]);

    await openSidebarTab(page, 'Images');
    const navCount = page.locator('section:has-text("Image navigation") .nav-status-count');
    await expect(navCount).toContainText('/2', { timeout: 10_000 });
  });

  test('Import menu actions handle class file, dataset folder, and invalid workspace zip', async ({ page }) => {
    await chooseFilesFromMenu(page, 'Import', 'Import classes', [
      textFile('classes.txt', 'Vehicle\nPerson\n'),
    ]);

    await openSidebarTab(page, 'Classes');
    await expect(page.locator('.class-name-btn', { hasText: 'Vehicle' })).toBeVisible();
    await expect(page.locator('.class-name-btn', { hasText: 'Person' })).toBeVisible();

    await chooseFilesFromMenu(page, 'Import', 'Import dataset folder', [
      textFile('classes.txt', 'Widget\n'),
      bmpFile('dataset-image.bmp', 200, 120, { r: 120, g: 170, b: 70 }),
    ]);
    await expect(page.locator('.topbar-status')).toContainText('Imported YOLO dataset', { timeout: 15_000 });
    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();

    await chooseFilesFromMenu(page, 'Import', 'Import workspace state', [
      textFile('broken-workspace.zip', 'definitely-not-a-zip', 'application/zip'),
    ]);
    await expect(page.locator('.topbar-status')).toContainText('Workspace import failed', { timeout: 10_000 });
  });

  test('Export menu actions cover direct downloads and export dialogs', async ({ page }) => {
    {
      const downloadPromise = page.waitForEvent('download');
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export workspace state', exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^workspace_state_\d+\.zip$/);
    }

    {
      const downloadPromise = page.waitForEvent('download');
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export classes', exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('classes.txt');
    }

    {
      const menu = await openTopbarMenu(page, 'Export');
      await expect(menu.getByRole('button', { name: 'Export all formats', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Export COCO', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Export YOLO', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Export VOC', exact: true })).toBeDisabled();
    }

    await openImagesViaTopbar(page, [bmpFile('export-source.bmp', 300, 220, { r: 110, g: 110, b: 170 })]);

    {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export all formats', exact: true }).click();
      const dialog = modalByHeading(page, 'Export all formats');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export COCO', exact: true }).click();
      const dialog = modalByHeading(page, 'Export COCO');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();

      const summary = modalByHeading(page, 'Export summary');
      await expect(summary).toBeVisible();
      await summary.getByRole('button', { name: 'Back', exact: true }).click();

      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export YOLO', exact: true }).click();
      const dialog = modalByHeading(page, 'Export YOLO');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export VOC', exact: true }).click();
      const dialog = modalByHeading(page, 'Export VOC');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
  });

  test('Edit menu actions open expected dialogs and history actions work', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('edit-actions.bmp', 280, 200, { r: 95, g: 120, b: 145 })]);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.38, yFrac: 0.38 }, { xFrac: 0.67, yFrac: 0.72 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);

    await openEditAndClick(page, 'Remove all annotations');
    {
      const dialog = modalByHeading(page, 'Remove all annotations');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await openEditAndClick(page, 'Toggle visibility');
    {
      const dialog = modalByHeading(page, 'Toggle visibility');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await openEditAndClick(page, 'Toggle anchoring');
    {
      const dialog = modalByHeading(page, 'Toggle anchoring');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await openEditAndClick(page, 'Swap instances of classes');
    {
      const dialog = modalByHeading(page, 'Swap instances of classes');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await openEditAndClick(page, 'Remove instances of classes');
    {
      const dialog = modalByHeading(page, 'Remove instances of classes');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await openEditAndClick(page, 'Set anchoring for class instances');
    {
      const dialog = modalByHeading(page, 'Set anchoring for class instances');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await openEditAndClick(page, 'Set visibility for class instances');
    {
      const dialog = modalByHeading(page, 'Set visibility for class instances');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await openEditAndClick(page, 'Remove last annotation (current image)');
    await expect(annotationItems(page)).toHaveCount(0);

    await openEditAndClick(page, 'Undo');
    await expect(annotationItems(page)).toHaveCount(1);

    await openEditAndClick(page, 'Redo');
    await expect(annotationItems(page)).toHaveCount(0);
  });

  test('Edit workspace actions clear loaded images', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('workspace-actions.bmp', 260, 180, { r: 70, g: 130, b: 170 })]);

    await openEditAndClick(page, 'Close all images');
    await expect(page.locator('.workspace-empty')).toBeVisible();

    await openImagesViaTopbar(page, [bmpFile('workspace-clear.bmp', 260, 180, { r: 140, g: 110, b: 80 })]);
    await openEditAndClick(page, 'Clear workspace');

    const clearDialog = modalByHeading(page, 'Clear workspace');
    await expect(clearDialog).toBeVisible();
    await clearDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();

    await openEditAndClick(page, 'Clear workspace');
    await clearDialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.locator('.workspace-empty')).toBeVisible();
  });

  test('Topbar Settings and Statistics dialogs can open and close', async ({ page }) => {
    await topbar(page).getByRole('button', { name: 'Settings', exact: true }).click();
    {
      const dialog = modalByHeading(page, 'Settings');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    await topbar(page).getByRole('button', { name: 'Statistics', exact: true }).click();
    {
      const dialog = modalByHeading(page, 'Statistics');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    }
  });
});
