import { expect, test, type Download, type FilePayload, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  dragOnCanvas,
  drawByDragOnCanvas,
  drawOnCanvas,
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

function topbarStatus(page: Page): Locator {
  return page.locator('.topbar-status');
}

const DIRECTORY_ACTIONS = new Set(['Open image folder', 'Import dataset folder']);

function modalByHeading(page: Page, heading: string): Locator {
  return page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: heading }) })
    .first();
}

async function openTopbarMenu(page: Page, menuName: 'Open' | 'Import' | 'Export' | 'Edit'): Promise<Locator> {
  await topbar(page).getByRole('button', { name: menuName, exact: true }).click();
  const menu = page.locator('.menu.open .menu-popover').first();
  await expect(menu).toBeVisible();
  return menu;
}

function asUploadList(files: FilePayload | FilePayload[]): FilePayload[] {
  return Array.isArray(files) ? files : [files];
}

function toUploadBuffer(file: FilePayload): Buffer {
  return Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer);
}

async function createUploadDirectory(files: FilePayload | FilePayload[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pw-upload-'));
  for (const file of asUploadList(files)) {
    const nestedPath = file.name.split('/').join(path.sep);
    const outputPath = path.join(dir, nestedPath);
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, toUploadBuffer(file));
  }
  return dir;
}

async function chooseFilesFromMenu(
  page: Page,
  menuName: 'Open' | 'Import',
  actionName: string,
  files: FilePayload | FilePayload[]
): Promise<void> {
  const menu = await openTopbarMenu(page, menuName);
  const chooserPromise = page.waitForEvent('filechooser');
  await menu.getByRole('button', { name: actionName, exact: true }).click();
  const chooser = await chooserPromise;
  if (DIRECTORY_ACTIONS.has(actionName)) {
    const dir = await createUploadDirectory(files);
    await chooser.setFiles(dir);
    return;
  }
  await chooser.setFiles(files);
}

async function openEditAction(page: Page, actionName: string): Promise<void> {
  const menu = await openTopbarMenu(page, 'Edit');
  await menu.getByRole('button', { name: actionName, exact: true }).click();
}

async function readDownloadBuffer(download: Download, testInfo: TestInfo): Promise<Buffer> {
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  return fs.readFile(path);
}

async function makeWorkspaceZipPayload(): Promise<FilePayload> {
  const image = bmpFile('workspace-state-image.bmp', 240, 160, { r: 90, g: 120, b: 150 });
  const zip = new JSZip();
  zip.file(`images/${image.name}`, image.buffer);
  zip.file(
    'workspace_state.json',
    JSON.stringify(
      {
        settings: {
          interactionMode: 'add',
          addingMode: 'drag',
        },
        classes: [
          {
            id: 'cls-default',
            name: 'Unassigned',
            color: '#9CA3AF',
            isVisible: true,
            isDefault: true,
            defaultAnchored: false,
          },
          {
            id: 'cls-widget',
            name: 'Widget',
            color: '#22C55E',
            isVisible: true,
            isDefault: false,
            defaultAnchored: false,
          },
        ],
        images: [
          {
            id: 'img-1',
            name: image.name,
            fileName: image.name,
            width: 240,
            height: 160,
            isBookmarked: false,
            annotations: [
              {
                id: 'ann-1',
                classId: 'cls-widget',
                bbox: { x: 30, y: 20, width: 80, height: 60 },
                isVisible: true,
                isAnchored: false,
                displayId: 1,
              },
            ],
          },
        ],
        selection: {
          selectedClassId: 'cls-widget',
          selectedImageId: 'img-1',
          selectedAnnotationId: 'ann-1',
          selectedAnnotationIds: ['ann-1'],
        },
        nextDisplayIdByClass: {
          'img-1': 2,
        },
      },
      null,
      2
    )
  );
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return {
    name: 'workspace-state.zip',
    mimeType: 'application/zip',
    buffer,
  };
}

async function seedTwoAnnotations(page: Page, mode: 'Click-Click' | 'Drag'): Promise<void> {
  await openImagesViaTopbar(page, [bmpFile('seed-annotations.bmp', 320, 220, { r: 110, g: 100, b: 170 })]);
  await setAddingMode(page, mode);
  // await drawByDragOnCanvas(page, { xFrac: 0.32, yFrac: 0.30 }, { xFrac: 0.52, yFrac: 0.55 });
  // await drawByDragOnCanvas(page, { xFrac: 0.58, yFrac: 0.36 }, { xFrac: 0.84, yFrac: 0.72 });
  await drawOnCanvas(page, mode, { xFrac: 0.32, yFrac: 0.30 }, { xFrac: 0.52, yFrac: 0.55 });
  await drawOnCanvas(page, mode, { xFrac: 0.58, yFrac: 0.36 }, { xFrac: 0.84, yFrac: 0.72 });
  await openSidebarTab(page, 'Annotations');
  await expect(annotationItems(page)).toHaveCount(2);
}

async function assignAnnotationClasses(page: Page): Promise<void> {
  await chooseFilesFromMenu(page, 'Import', 'Import classes', [textFile('classes.txt', 'Vehicle\nPerson\n')]);
  await openSidebarTab(page, 'Annotations');
  const rows = annotationItems(page);
  await expect(rows).toHaveCount(2);
  await rows.nth(0).locator('select.annotation-class-select').selectOption({ label: 'Vehicle' });
  await rows.nth(1).locator('select.annotation-class-select').selectOption({ label: 'Person' });
}

async function runAnnotationScopeAction(
  page: Page,
  kind: 'Toggle visibility' | 'Toggle anchoring' | 'Remove all annotations',
  action?: 'Show' | 'Hide' | 'Anchor' | 'Unanchor'
): Promise<void> {
  await openEditAction(page, kind);
  const heading = kind === 'Toggle visibility' ? 'Toggle visibility' : kind === 'Toggle anchoring' ? 'Toggle anchoring' : 'Remove all annotations';
  const dialog = modalByHeading(page, heading);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Current image', exact: true }).click();
  if (action) {
    await dialog.locator('button', { hasText: action }).first().click();
  }
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
}

async function runClassScopeAction(
  page: Page,
  menuAction: 'Swap instances of classes' | 'Remove instances of classes' | 'Set anchoring for class instances' | 'Set visibility for class instances',
  sourceClassName: string,
  options?: { targetClassName?: string; action?: 'Show' | 'Hide' | 'Anchor' | 'Unanchor' }
): Promise<void> {
  await openEditAction(page, menuAction);
  const dialog = modalByHeading(page, menuAction);
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Current image', exact: true }).click();
  await dialog.locator('.class-filter-option').filter({ hasText: sourceClassName }).first().click();

  if (options?.targetClassName) {
    await dialog.locator('select').first().selectOption({ label: options.targetClassName });
  }
  if (options?.action) {
    await dialog.locator('button', { hasText: options.action }).first().click();
  }
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
}

test.describe('Topbar in-depth coverage', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('Open menu covers image open, folder validation, folder import, and video parse failure', async ({ page }) => {
    await chooseFilesFromMenu(page, 'Open', 'Open images', [bmpFile('open-main.bmp', 240, 160, { r: 170, g: 90, b: 90 })]);
    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();

    await chooseFilesFromMenu(page, 'Open', 'Open image folder', [textFile('not-an-image.txt', 'abc')]);
    await expect(topbarStatus(page)).toContainText('No supported image files found in selected folder.', { timeout: 15_000 });

    await chooseFilesFromMenu(page, 'Open', 'Open image folder', [
      bmpFile('folder-ok.bmp', 220, 140, { r: 80, g: 140, b: 160 }),
      textFile('readme.txt', 'ignore'),
    ]);
    await openSidebarTab(page, 'Images');
    await expect(page.locator('section:has-text("Image navigation") .nav-status-count')).toContainText('/2', {
      timeout: 10_000,
    });

    await chooseFilesFromMenu(page, 'Open', 'Open video', [
      textFile('broken.mp4', 'not-a-real-video', 'video/mp4'),
    ]);
    await expect(topbarStatus(page)).toContainText('Could not open video', { timeout: 15_000 });
  });

  test('Import menu covers classes, dataset folder, invalid workspace zip, and valid workspace zip', async ({ page }) => {
    await chooseFilesFromMenu(page, 'Import', 'Import classes', [textFile('classes.txt', 'Vehicle\nPerson\n')]);
    await openSidebarTab(page, 'Classes');
    await expect(page.locator('.class-name-btn', { hasText: 'Vehicle' })).toBeVisible();
    await expect(page.locator('.class-name-btn', { hasText: 'Person' })).toBeVisible();

    const cocoImage = bmpFile('import-coco.bmp', 300, 200, { r: 90, g: 120, b: 170 });
    const cocoPayload = {
      images: [{ id: 1, file_name: cocoImage.name, width: 300, height: 200 }],
      categories: [{ id: 1, name: 'Vehicle' }],
      annotations: [{ image_id: 1, category_id: 1, bbox: [40, 30, 120, 80] }],
    };
    await chooseFilesFromMenu(page, 'Import', 'Import dataset folder', [
      cocoImage,
      textFile('instances_default.json', JSON.stringify(cocoPayload, null, 2), 'application/json'),
    ]);
    await expect(topbarStatus(page)).toContainText('Imported COCO dataset', { timeout: 15_000 });
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);

    await chooseFilesFromMenu(page, 'Import', 'Import workspace state', [
      textFile('broken.zip', 'not-zip', 'application/zip'),
    ]);
    await expect(topbarStatus(page)).toContainText('Workspace import failed', { timeout: 10_000 });

    await chooseFilesFromMenu(page, 'Import', 'Import workspace state', [await makeWorkspaceZipPayload()]);
    await expect(topbarStatus(page)).toContainText('Imported workspace state: 1 images', { timeout: 15_000 });
    await openSidebarTab(page, 'Classes');
    await expect(page.locator('.class-name-btn', { hasText: 'Widget' })).toBeVisible();
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
  });

  test('Export menu covers direct downloads and single-format/all-format dialogs', async ({ page }, testInfo) => {
    const exportMenuEmpty = await openTopbarMenu(page, 'Export');
    await expect(exportMenuEmpty.getByRole('button', { name: 'Export all formats', exact: true })).toBeDisabled();
    await expect(exportMenuEmpty.getByRole('button', { name: 'Export COCO', exact: true })).toBeDisabled();
    await expect(exportMenuEmpty.getByRole('button', { name: 'Export YOLO', exact: true })).toBeDisabled();
    await expect(exportMenuEmpty.getByRole('button', { name: 'Export VOC', exact: true })).toBeDisabled();

    await openImagesViaTopbar(page, [bmpFile('export-base.bmp', 260, 180, { r: 110, g: 140, b: 90 })]);

    {
      const downloadPromise = page.waitForEvent('download');
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export workspace state', exact: true }).click();
      const download = await downloadPromise;
      const archive = await JSZip.loadAsync(await readDownloadBuffer(download, testInfo));
      expect(Object.keys(archive.files)).toContain('workspace_state.json');
    }

    {
      const downloadPromise = page.waitForEvent('download');
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export classes', exact: true }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('classes.txt');
    }

    for (const action of ['Export COCO', 'Export YOLO', 'Export VOC'] as const) {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: action, exact: true }).click();
      const dialog = modalByHeading(page, action);
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      const summary = modalByHeading(page, 'Export summary');
      await expect(summary).toBeVisible();
      await summary.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export all formats', exact: true }).click();
      const dialog = modalByHeading(page, 'Export all formats');
      await expect(dialog).toBeVisible();

      const folderInput = dialog.getByRole('textbox', { name: 'Output folder name' });
      await folderInput.fill('');
      await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
      await folderInput.fill('custom_exports');
      await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();

      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      const summary = modalByHeading(page, 'Export summary');
      await expect(summary).toContainText('custom_exports');
      await summary.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
  });

  test('Edit menu shows strict disabled/enabled states as workspace evolves', async ({ page }) => {
    {
      const menu = await openTopbarMenu(page, 'Edit');
      await expect(menu.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Remove last annotation (current image)', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Remove all annotations', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Toggle visibility', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Toggle anchoring', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Swap instances of classes', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Remove instances of classes', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Set anchoring for class instances', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Set visibility for class instances', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Close all images', exact: true })).toBeDisabled();
      await expect(menu.getByRole('button', { name: 'Clear workspace', exact: true })).toBeDisabled();
    }

    await openImagesViaTopbar(page, [bmpFile('edit-state.bmp', 280, 180, { r: 120, g: 80, b: 150 })]);
    {
      const menu = await openTopbarMenu(page, 'Edit');
      await expect(menu.getByRole('button', { name: 'Close all images', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Clear workspace', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Remove last annotation (current image)', exact: true })).toBeDisabled();
    }

    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.35, yFrac: 0.3 }, { xFrac: 0.64, yFrac: 0.62 });
    {
      const menu = await openTopbarMenu(page, 'Edit');
      await expect(menu.getByRole('button', { name: 'Remove last annotation (current image)', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Remove all annotations', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Toggle visibility', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Toggle anchoring', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Swap instances of classes', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Remove instances of classes', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Set anchoring for class instances', exact: true })).toBeEnabled();
      await expect(menu.getByRole('button', { name: 'Set visibility for class instances', exact: true })).toBeEnabled();
    }
  });

  test('Edit menu annotation and class actions mutate annotations and classes correctly', async ({ page }) => {
    await seedTwoAnnotations(page, 'Drag');
    await assignAnnotationClasses(page);

    await openEditAction(page, 'Remove last annotation (current image)');
    await expect(annotationItems(page)).toHaveCount(1);
    await openEditAction(page, 'Undo');
    await expect(annotationItems(page)).toHaveCount(2);
    await openEditAction(page, 'Redo');
    await expect(annotationItems(page)).toHaveCount(1);
    await openEditAction(page, 'Undo');
    await expect(annotationItems(page)).toHaveCount(2);

    await runAnnotationScopeAction(page, 'Toggle visibility', 'Hide');
    await expect(annotationItems(page).first().locator('button[title="Show annotation"]')).toBeVisible();
    await runAnnotationScopeAction(page, 'Toggle visibility', 'Show');
    await expect(annotationItems(page).first().locator('button[title="Hide annotation"]')).toBeVisible();

    await runAnnotationScopeAction(page, 'Toggle anchoring', 'Anchor');
    await expect(annotationItems(page).first().locator('button[title="Unanchor annotation"]')).toBeVisible();
    await runAnnotationScopeAction(page, 'Toggle anchoring', 'Unanchor');
    await expect(annotationItems(page).first().locator('button[title="Anchor annotation"]')).toBeVisible();

    await runClassScopeAction(page, 'Set visibility for class instances', 'Vehicle', { action: 'Hide' });
    await expect(
      annotationItems(page)
        .filter({ has: page.locator('.annotation-title-btn', { hasText: 'Vehicle' }) })
        .first()
        .locator('button[title="Show annotation"]')
    ).toBeVisible();

    await runClassScopeAction(page, 'Set anchoring for class instances', 'Vehicle', { action: 'Anchor' });
    await expect(
      annotationItems(page)
        .filter({ has: page.locator('.annotation-title-btn', { hasText: 'Vehicle' }) })
        .first()
        .locator('button[title="Unanchor annotation"]')
    ).toBeVisible();

    await runClassScopeAction(page, 'Swap instances of classes', 'Vehicle', { targetClassName: 'Person' });
    await expect(page.locator('.annotation-title-btn', { hasText: 'Vehicle' })).toHaveCount(0);

    await runClassScopeAction(page, 'Remove instances of classes', 'Person');
    await expect(annotationItems(page)).toHaveCount(0);

    await openEditAction(page, 'Close all images');
    await expect(page.locator('.workspace-empty')).toBeVisible();
  });

  test('Edit workspace clear flow, Settings persistence, and Statistics values work end-to-end', async ({ page }) => {
    await seedTwoAnnotations(page, 'Click-Click');

    await openEditAction(page, 'Clear workspace');
    const clearDialog = modalByHeading(page, 'Clear workspace');
    await expect(clearDialog).toBeVisible();
    await clearDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();

    await topbar(page).getByRole('button', { name: 'Settings', exact: true }).click();
    const settingsDialog = modalByHeading(page, 'Settings');
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByRole('button', { name: 'Add', exact: true }).click();
    await settingsDialog.getByRole('button', { name: 'Drag', exact: true }).click();
    await settingsDialog.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.locator('.canvas-toolbar > span')).toContainText('Mode: add | Adding: drag');

    await topbar(page).getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.keyboard.press('Escape');
    const unsavedDialog = modalByHeading(page, 'Unsaved settings changes');
    await expect(unsavedDialog).toBeVisible();
    await unsavedDialog.getByRole('button', { name: 'Abort changes', exact: true }).click();
    await expect(page.locator('.canvas-toolbar > span')).toContainText('Mode: add | Adding: drag');

    await topbar(page).getByRole('button', { name: 'Statistics', exact: true }).click();
    const stats = modalByHeading(page, 'Statistics');
    await expect(stats).toBeVisible();
    await expect(stats.locator('.statistics-card').filter({ hasText: 'Images' }).locator('.statistics-card-value')).toHaveText('1');
    await expect(
      stats.locator('.statistics-card').filter({ hasText: 'Annotations (total)' }).locator('.statistics-card-value')
    ).toHaveText('2');
    await stats.getByRole('button', { name: 'Close', exact: true }).click();

    await openEditAction(page, 'Clear workspace');
    await clearDialog.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.locator('.workspace-empty')).toBeVisible();
  });
});
