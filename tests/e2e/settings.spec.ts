import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { expect, test, type Download, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByDragOnCanvas,
  openImagesViaTopbar,
  openSidebarTab,
  setAddingMode,
} from './helpers/app';
import { importClassesViaTopbar, modalByHeading, openTopbarMenu, topbar } from './helpers/topbar';

function settingsDialog(page: Page): Locator {
  return modalByHeading(page, 'Settings');
}

async function openSettings(page: Page): Promise<Locator> {
  await topbar(page).getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = settingsDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function importClasses(page: Page, classes: string[]): Promise<void> {
  await importClassesViaTopbar(page, classes);
}

async function setRangeByLabel(dialog: Locator, labelText: string, value: number): Promise<void> {
  const slider = dialog.locator('label', { hasText: labelText }).locator('input[type="range"]').first();
  await expect(slider).toBeVisible();
  await slider.evaluate((node, nextValue) => {
    const input = node as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, String(nextValue));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function selectSettingsButton(dialog: Locator, buttonName: string): Promise<void> {
  await dialog.getByRole('button', { name: buttonName, exact: true }).click();
}

async function moveMouseOnCanvas(page: Page, xFrac = 0.5, yFrac = 0.5): Promise<void> {
  const canvas = page.locator('.canvas-container canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box unavailable.');
  }
  await page.mouse.move(box.x + box.width * xFrac, box.y + box.height * yFrac);
}

async function readDownloadBuffer(download: Download, testInfo: TestInfo): Promise<Buffer> {
  const outputPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(outputPath);
  return fs.readFile(outputPath);
}

async function selectClassByName(page: Page, className: string): Promise<void> {
  await openSidebarTab(page, 'Classes');
  await page.locator('.class-name-btn', { hasText: className }).first().click();
}

async function selectAnnotationClassByDisplayId(page: Page, displayId: number, classLabel: string): Promise<void> {
  await openSidebarTab(page, 'Annotations');
  const row = annotationItems(page)
    .filter({ has: page.locator('.annotation-title-btn', { hasText: `#${displayId} ` }) })
    .first();
  await expect(row).toBeVisible();
  await row.locator('select.annotation-class-select').selectOption({ label: classLabel });
}

test.describe('Settings dialog and effects', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('dialog lifecycle handles unsaved changes, save, and revert-to-default correctly', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('settings-workflow.bmp', 320, 220, { r: 95, g: 130, b: 175 })]);

    const dialog = await openSettings(page);
    const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeDisabled();

    await selectSettingsButton(dialog, 'Add');
    await selectSettingsButton(dialog, 'Drag');
    await expect(saveButton).toBeEnabled();

    await page.keyboard.press('Escape');
    const unsaved = modalByHeading(page, 'Unsaved settings changes');
    await expect(unsaved).toBeVisible();

    await unsaved.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(unsaved).toBeHidden();
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.canvas-toolbar > span')).toContainText('Mode: edit | Adding: click');

    const dialog2 = await openSettings(page);
    await selectSettingsButton(dialog2, 'Add');
    await selectSettingsButton(dialog2, 'Drag');
    await expect(dialog2.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    await dialog2.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog2).toBeHidden();
    await expect(page.locator('.canvas-toolbar > span')).toContainText('Mode: add | Adding: drag');

    const dialog3 = await openSettings(page);
    await dialog3.getByRole('button', { name: 'Revert to default', exact: true }).click();
    await dialog3.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog3).toBeHidden();
    await expect(page.locator('.canvas-toolbar > span')).toContainText('Mode: edit | Adding: click');
  });

  test('inference model settings in dialog participate in save/revert flow', async ({ page }) => {
    const dialog = await openSettings(page);
    const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeDisabled();

    await dialog.getByLabel('Model URL/path').fill('/models/custom.onnx');
    await expect(saveButton).toBeEnabled();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();

    const dialogAfterCancel = await openSettings(page);
    await expect(dialogAfterCancel.getByLabel('Model URL/path')).toHaveValue('/models/yolo26n.onnx');
    await dialogAfterCancel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialogAfterCancel).toBeHidden();

    const dialogPersist = await openSettings(page);
    await dialogPersist.getByLabel('Model URL/path').fill('/models/custom.onnx');
    await dialogPersist.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialogPersist).toBeHidden();

    const dialogAfterSave = await openSettings(page);
    await expect(dialogAfterSave.getByLabel('Model URL/path')).toHaveValue('/models/custom.onnx');
    await dialogAfterSave.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialogAfterSave).toBeHidden();
  });

  test('fast class swap checkbox in settings dialog participates in save/revert flow', async ({ page }) => {
    const dialog = await openSettings(page);
    const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
    const fastSwap = dialog.getByLabel('Fast class swap mode');

    await expect(fastSwap).not.toBeChecked();
    await expect(saveButton).toBeDisabled();

    await fastSwap.check();
    await expect(saveButton).toBeEnabled();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();

    const dialogAfterCancel = await openSettings(page);
    await expect(dialogAfterCancel.getByLabel('Fast class swap mode')).not.toBeChecked();
    await dialogAfterCancel.getByLabel('Fast class swap mode').check();
    await dialogAfterCancel.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialogAfterCancel).toBeHidden();

    const dialogAfterSave = await openSettings(page);
    await expect(dialogAfterSave.getByLabel('Fast class swap mode')).toBeChecked();
    await dialogAfterSave.getByRole('button', { name: 'Revert to default', exact: true }).click();
    await expect(dialogAfterSave.getByLabel('Fast class swap mode')).not.toBeChecked();
    await dialogAfterSave.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialogAfterSave).toBeHidden();
  });

  test('inference settings allow uploading local ONNX model file', async ({ page }) => {
    const dialog = await openSettings(page);
    const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeDisabled();

    await dialog.getByTestId('inference-model-upload-input').setInputFiles({
      name: 'tiny-custom.onnx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('ONNX', 'utf8'),
    });

    await expect(dialog.getByLabel('Model URL/path')).toHaveValue(/^blob:/);
    await expect(saveButton).toBeEnabled();

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();

    const dialogAfterCancel = await openSettings(page);
    await expect(dialogAfterCancel.getByLabel('Model URL/path')).toHaveValue('/models/yolo26n.onnx');
    await dialogAfterCancel.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('inference controls are available in General tab, while settings dialog keeps only model configuration', async ({ page }) => {
    await openSidebarTab(page, 'General');
    const inferenceSection = page.locator('section.general-inference-segment');
    const generalSettingsSection = page.locator('section.general-settings-segment');
    await expect(inferenceSection).toBeVisible();
    await expect(generalSettingsSection.getByLabel('Fast class swap mode')).toBeVisible();

    const inferenceEnabledCheckbox = inferenceSection.getByLabel('Enable model inference');
    await expect(inferenceEnabledCheckbox).not.toBeChecked();
    await inferenceEnabledCheckbox.check();
    await setRangeByLabel(inferenceSection, 'Confidence threshold', 0.73);
    await expect(
      inferenceSection.locator('label', { hasText: 'Confidence threshold' }).locator('input[type="range"]')
    ).toHaveValue('0.73');

    const dialog = await openSettings(page);
    await expect(dialog.getByLabel('Fast class swap mode')).toBeVisible();
    await expect(dialog.getByLabel('Enable model inference')).toHaveCount(0);
    await expect(dialog.locator('label', { hasText: 'Confidence threshold' }).locator('input[type="range"]')).toHaveCount(0);
    await expect(dialog.getByLabel('Model URL/path')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Upload ONNX model', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test('settings persist to workspace export and affect crosshair/minimap/export defaults', async ({ page }, testInfo) => {
    await openImagesViaTopbar(page, [bmpFile('settings-persist.bmp', 360, 240, { r: 120, g: 105, b: 165 })]);

    {
      const dialog = await openSettings(page);
      await selectSettingsButton(dialog, 'Add');
      await selectSettingsButton(dialog, 'Drag');
      await selectSettingsButton(dialog, 'Deferred');
      await dialog.getByLabel('Fast class swap mode').check();
      await dialog.getByLabel('Show labels').uncheck();
      await dialog.getByLabel('Draw box backgrounds').uncheck();
      await dialog.getByLabel('Draw box borders').uncheck();
      await dialog.getByLabel('Show crosshair').uncheck();
      await dialog.getByLabel('Show minimap').uncheck();
      await setRangeByLabel(dialog, 'Annotation background opacity', 0.55);
      await setRangeByLabel(dialog, 'Annotation border thickness', 5);
      await setRangeByLabel(dialog, 'Drag deadzone (px)', 9);
      await dialog.locator('label', { hasText: 'Location' }).locator('select').selectOption('sidebar');
      await dialog.getByLabel('Export unassigned class').check();
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toBeHidden();
    }

    await moveMouseOnCanvas(page);
    await expect(page.locator('.workspace-crosshair-overlay')).toHaveCount(0);
    await expect(page.locator('.workspace-minimap')).toHaveCount(0);

    {
      const dialog = await openSettings(page);
      await dialog.getByLabel('Show crosshair').check();
      await dialog.getByLabel('Show minimap').check();
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog).toBeHidden();
    }

    await moveMouseOnCanvas(page);
    await expect(page.locator('.workspace-crosshair-overlay')).toBeVisible();
    await openSidebarTab(page, 'General');
    await expect(page.locator('#general-sidebar-minimap-host .workspace-minimap')).toBeVisible();

    {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export COCO', exact: true }).click();
      const exportDialog = modalByHeading(page, 'Export COCO');
      await expect(exportDialog).toBeVisible();
      await expect(exportDialog.getByLabel('Export unassigned class')).toBeChecked();
      await exportDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    {
      const downloadPromise = page.waitForEvent('download');
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export workspace state', exact: true }).click();
      const archive = await JSZip.loadAsync(await readDownloadBuffer(await downloadPromise, testInfo));
      const payload = JSON.parse(await archive.file('workspace_state.json')!.async('text')) as {
        settings: {
          interactionMode: string;
          addingMode: string;
          classAssignmentMode: string;
          fastClassSwapMode: boolean;
          showLabels: boolean;
          bboxOpacity: number;
          lineThickness: number;
          drawBoxFill: boolean;
          drawBoxBorder: boolean;
          showCrosshair: boolean;
          showMinimap: boolean;
          minimapLocation: string;
          dragDeadzonePx: number;
          exportIncludeUnassigned: boolean;
        };
      };
      expect(payload.settings.interactionMode).toBe('add');
      expect(payload.settings.addingMode).toBe('drag');
      expect(payload.settings.classAssignmentMode).toBe('deferred');
      expect(payload.settings.fastClassSwapMode).toBe(true);
      expect(payload.settings.showLabels).toBe(false);
      expect(payload.settings.bboxOpacity).toBe(0.55);
      expect(payload.settings.lineThickness).toBe(5);
      expect(payload.settings.drawBoxFill).toBe(false);
      expect(payload.settings.drawBoxBorder).toBe(false);
      expect(payload.settings.showCrosshair).toBe(true);
      expect(payload.settings.showMinimap).toBe(true);
      expect(payload.settings.minimapLocation).toBe('sidebar');
      expect(payload.settings.dragDeadzonePx).toBe(9);
      expect(payload.settings.exportIncludeUnassigned).toBe(true);
    }
  });

  test('class assignment mode, adding mode, deadzone, and bulk visibility/anchoring controls work', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('settings-drawing.bmp', 320, 220, { r: 90, g: 140, b: 130 })]);
    await importClasses(page, ['Vehicle']);

    {
      const dialog = await openSettings(page);
      await selectSettingsButton(dialog, 'Add');
      await selectSettingsButton(dialog, 'Drag');
      await selectSettingsButton(dialog, 'Active class');
      await setRangeByLabel(dialog, 'Drag deadzone (px)', 10);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    }

    await selectClassByName(page, 'Vehicle');
    await drawByDragOnCanvas(page, { xFrac: 0.40, yFrac: 0.40 }, { xFrac: 0.42, yFrac: 0.43 });
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);

    await drawByDragOnCanvas(page, { xFrac: 0.24, yFrac: 0.30 }, { xFrac: 0.52, yFrac: 0.61 });
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(page.locator('.annotation-title-btn', { hasText: '#1 Vehicle' })).toBeVisible();

    {
      const dialog = await openSettings(page);
      await dialog.getByLabel('All annotations anchored (selected image)').check();
      await dialog.getByLabel('All annotations visible (selected image)').uncheck();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page).first().locator('button[title="Unanchor annotation"]')).toBeVisible();
    await expect(annotationItems(page).first().locator('button[title="Show annotation"]')).toBeVisible();

    {
      const dialog = await openSettings(page);
      await dialog.getByLabel('All annotations visible (selected image)').check();
      await dialog.getByLabel('All annotations anchored (selected image)').uncheck();
      await selectSettingsButton(dialog, 'Deferred');
      await setRangeByLabel(dialog, 'Drag deadzone (px)', 2);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    }
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page).first().locator('button[title="Anchor annotation"]')).toBeVisible();
    await expect(annotationItems(page).first().locator('button[title="Hide annotation"]')).toBeVisible();

    await drawByDragOnCanvas(page, { xFrac: 0.58, yFrac: 0.34 }, { xFrac: 0.84, yFrac: 0.70 });
    await expect(annotationItems(page)).toHaveCount(2);
    await expect(page.locator('.annotation-title-btn', { hasText: '#2 Unassigned' })).toBeVisible();
  });

  test('notification suppression settings bypass delete/remove confirmation dialogs', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('settings-warnings.bmp', 320, 220, { r: 115, g: 120, b: 170 })]);
    await importClasses(page, ['Vehicle']);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.26, yFrac: 0.30 }, { xFrac: 0.50, yFrac: 0.59 });
    await selectAnnotationClassByDisplayId(page, 1, 'Vehicle');

    {
      const dialog = await openSettings(page);
      await dialog.getByLabel('Suppress delete annotation warning').check();
      await dialog.getByLabel('Suppress delete image warning').check();
      await dialog.getByLabel('Suppress remove class instances warning').check();
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    }

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await annotationItems(page).first().locator('button[title="Delete annotation"]').click();
    await expect(modalByHeading(page, 'Delete annotation')).toHaveCount(0);
    await expect(annotationItems(page)).toHaveCount(0);

    await drawByDragOnCanvas(page, { xFrac: 0.54, yFrac: 0.34 }, { xFrac: 0.82, yFrac: 0.68 });
    await selectAnnotationClassByDisplayId(page, 2, 'Vehicle');
    await expect(annotationItems(page)).toHaveCount(1);

    await openSidebarTab(page, 'Classes');
    const vehicleCard = page
      .locator('.class-card')
      .filter({ has: page.locator('.class-name-btn', { hasText: 'Vehicle' }) })
      .first();
    await expect(vehicleCard).toBeVisible();
    await vehicleCard.getByRole('button', { name: 'Remove instances', exact: true }).click();
    await expect(page.locator('.modal-card').filter({ has: page.getByRole('heading', { name: /^Remove instances/ }) })).toHaveCount(0);

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);

    await openSidebarTab(page, 'Images');
    const imageRow = page.locator('.image-list-row').first();
    await expect(imageRow).toBeVisible();
    await imageRow.locator('button[title="Delete image"]').click();
    await expect(modalByHeading(page, 'Delete image')).toHaveCount(0);
    await expect(page.locator('.workspace-empty')).toBeVisible();
  });
});
