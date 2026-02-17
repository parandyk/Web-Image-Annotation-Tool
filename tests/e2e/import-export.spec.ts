import fs from 'node:fs/promises';
import JSZip from 'jszip';
import {
  expect,
  test,
  type Download,
  type FilePayload,
  type Page,
  type TestInfo,
} from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  openImagesViaTopbar,
  openSidebarTab,
} from './helpers/app';
import { chooseFilesFromMenu, modalByHeading, openTopbarMenu, textFile } from './helpers/topbar';

async function readDownloadBuffer(download: Download, testInfo: TestInfo): Promise<Buffer> {
  const fileName = download.suggestedFilename();
  const outputPath = testInfo.outputPath(fileName);
  await download.saveAs(outputPath);
  return fs.readFile(outputPath);
}

async function importCocoDataset(page: Page): Promise<void> {
  const image = bmpFile('coco-sample.bmp', 320, 200, { r: 120, g: 95, b: 160 });
  const coco = {
        // images: [{ id: 1, file_name: image.name, width: 320, height: 200}],
    images: [{ id: 1, file_name: image.name, width: image.width, height: image.height}],
    categories: [{ id: 1, name: 'Vehicle' }],
    annotations: [{ image_id: 1, category_id: 1, bbox: [48, 40, 120, 90] }],
  };

  await chooseFilesFromMenu(page, 'Import', 'Import dataset folder', [
    image,
    textFile('instances_default.json', JSON.stringify(coco, null, 2), 'application/json'),
  ]);
  await expect(page.locator('.topbar-status')).toContainText('Imported COCO dataset', { timeout: 15_000 });
}

async function startSingleExport(page: Page, actionLabel: 'Export COCO' | 'Export YOLO' | 'Export VOC'): Promise<void> {
  const menu = await openTopbarMenu(page, 'Export');
  await menu.getByRole('button', { name: actionLabel, exact: true }).click();
  await expect(modalByHeading(page, actionLabel)).toBeVisible();
  await modalByHeading(page, actionLabel).getByRole('button', { name: 'Keep original names', exact: true }).click();
  await modalByHeading(page, actionLabel).getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(modalByHeading(page, 'Export summary')).toBeVisible();
}

async function confirmSummaryAndDownload(page: Page, testInfo: TestInfo): Promise<Buffer> {
  const summary = modalByHeading(page, 'Export summary');
  const downloadPromise = page.waitForEvent('download');
  await summary.getByRole('button', { name: 'Continue', exact: true }).click();
  const download = await downloadPromise;
  return readDownloadBuffer(download, testInfo);
}

test.describe('Import and export workflows', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('imports classes from text file', async ({ page }) => {
    await chooseFilesFromMenu(page, 'Import', 'Import classes', [
      textFile('classes.txt', 'Vehicle\nPerson\n'),
    ]);

    await openSidebarTab(page, 'Classes');
    await expect(page.locator('.class-name-btn', { hasText: 'Vehicle' })).toBeVisible();
    await expect(page.locator('.class-name-btn', { hasText: 'Person' })).toBeVisible();
  });

  test('imports COCO dataset folder with class and annotation', async ({ page }) => {
    await importCocoDataset(page);

    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();
    await openSidebarTab(page, 'Classes');
    await expect(page.locator('.class-name-btn', { hasText: 'Vehicle' })).toBeVisible();

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
  });

  test('imports workspace state zip archive', async ({ page }) => {
    const image = bmpFile('workspace-image.bmp', 240, 160, { r: 90, g: 145, b: 120 });
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
                  bbox: { x: 30, y: 24, width: 80, height: 60 },
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
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    await chooseFilesFromMenu(page, 'Import', 'Import workspace state', [
      {
        name: 'workspace-state.zip',
        mimeType: 'application/zip',
        buffer: zipBuffer,
      },
    ]);

    await expect(page.locator('.topbar-status')).toContainText('Imported workspace state: 1 images', { timeout: 15_000 });
    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();

    await openSidebarTab(page, 'Classes');
    await expect(page.locator('.class-name-btn', { hasText: 'Widget' })).toBeVisible();

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(page.locator('.annotation-title-btn').first()).toContainText('Widget');
  });

  test('exports classes and workspace state archives', async ({ page }, testInfo) => {
    await chooseFilesFromMenu(page, 'Import', 'Import classes', [
      textFile('classes.txt', 'Vehicle\nPerson\n'),
    ]);
    await openImagesViaTopbar(page, [bmpFile('workspace-export.bmp', 280, 180, { r: 70, g: 120, b: 175 })]);

    {
      const downloadPromise = page.waitForEvent('download');
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export classes', exact: true }).click();
      const download = await downloadPromise;
      const content = (await readDownloadBuffer(download, testInfo)).toString('utf8');
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines).toEqual(['Vehicle', 'Person']);
    }

    {
      const downloadPromise = page.waitForEvent('download');
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export workspace state', exact: true }).click();
      const download = await downloadPromise;
      const buffer = await readDownloadBuffer(download, testInfo);
      const archive = await JSZip.loadAsync(buffer);
      const names = Object.keys(archive.files);
      expect(names).toContain('workspace_state.json');
      expect(names.some((name) => /^images\/.+/.test(name))).toBeTruthy();

      const payloadText = await archive.file('workspace_state.json')!.async('text');
      const payload = JSON.parse(payloadText) as {
        images: Array<unknown>;
        classes: Array<{ name?: string }>;
      };
      expect(payload.images.length).toBe(1);
      expect(payload.classes.some((cls) => cls.name === 'Vehicle')).toBeTruthy();
      expect(payload.classes.some((cls) => cls.name === 'Person')).toBeTruthy();
    }
  });

  test('exports COCO and all-formats datasets with expected archive structure', async ({ page }, testInfo) => {
    await importCocoDataset(page);

    await startSingleExport(page, 'Export COCO');
    const cocoBuffer = await confirmSummaryAndDownload(page, testInfo);
    const cocoArchive = await JSZip.loadAsync(cocoBuffer);
    const cocoNames = Object.keys(cocoArchive.files);
    expect(cocoNames).toContain('instances_default.json');
    expect(cocoNames).toContain('images/coco-sample.bmp');

    const cocoJsonText = await cocoArchive.file('instances_default.json')!.async('text');
    const cocoJson = JSON.parse(cocoJsonText) as {
      categories: Array<{ name: string }>;
      annotations: Array<unknown>;
      images: Array<unknown>;
    };
    expect(cocoJson.categories.some((category) => category.name === 'Vehicle')).toBeTruthy();
    expect(cocoJson.images.length).toBe(1);
    expect(cocoJson.annotations.length).toBe(1);

    {
      const menu = await openTopbarMenu(page, 'Export');
      await menu.getByRole('button', { name: 'Export all formats', exact: true }).click();
      const dialog = modalByHeading(page, 'Export all formats');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(modalByHeading(page, 'Export summary')).toBeVisible();
    }
    const allFormatsBuffer = await confirmSummaryAndDownload(page, testInfo);
    const allFormatsArchive = await JSZip.loadAsync(allFormatsBuffer);
    const allNames = Object.keys(allFormatsArchive.files);
    expect(allNames.some((name) => /\/yolo\/classes\.txt$/.test(name))).toBeTruthy();
    expect(allNames.some((name) => /\/coco\/instances_default\.json$/.test(name))).toBeTruthy();
    expect(allNames.some((name) => /\/voc\/annotations\/.+\.xml$/.test(name))).toBeTruthy();
  });
});
