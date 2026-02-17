import { expect, test, type FilePayload, type Page } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  clickEditAction,
  editUndoRedoButtons,
  openImagesViaTopbar,
  openSidebarTab,
  runEditAnnotationScopeOperation,
  setAddingMode,
  drawByDragOnCanvas,
} from './helpers/app';

async function selectImageByName(page: Page, imageName: string): Promise<void> {
  await openSidebarTab(page, 'Images');
  const row = page
    .locator('.image-list-row')
    .filter({ has: page.locator('.image-name-btn', { hasText: imageName }) })
    .first();
  await expect(row).toBeVisible();
  await row.locator('.image-name-btn').click();
}

async function bookmarkImageByName(page: Page, imageName: string): Promise<void> {
  await openSidebarTab(page, 'Images');
  const row = page
    .locator('.image-list-row')
    .filter({ has: page.locator('.image-name-btn', { hasText: imageName }) })
    .first();
  await expect(row).toBeVisible();
  const bookmark = row.locator('button[title="Bookmark image"]');
  if (await bookmark.isVisible().catch(() => false)) {
    await bookmark.click();
  }
  await expect(row.locator('button[title="Remove bookmark"]')).toBeVisible();
}

test.describe('Edit operations (combined smoke+regression)', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('undo/redo buttons are disabled with empty history and restore after remove-last flow', async ({ page }) => {
    const initialMenu = await editUndoRedoButtons(page);
    await expect(initialMenu.undo).toBeDisabled();
    await expect(initialMenu.redo).toBeDisabled();
    await page.locator('header.topbar').getByRole('button', { name: 'Edit', exact: true }).click();

    const files: FilePayload[] = [
      bmpFile('undo-redo.bmp', 260, 180, { r: 130, g: 70, b: 70 }),
    ];
    await openImagesViaTopbar(page, files);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page);

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);

    await clickEditAction(page, 'Remove last annotation (current image)');
    await expect(annotationItems(page)).toHaveCount(0);

    await clickEditAction(page, 'Undo');
    await expect(annotationItems(page)).toHaveCount(1);

    await clickEditAction(page, 'Redo');
    await expect(annotationItems(page)).toHaveCount(0);
  });

  test('set visibility dialog applies hide/show for current image', async ({ page }) => {
    const files: FilePayload[] = [
      bmpFile('visibility-scope.bmp', 280, 180, { r: 90, g: 110, b: 170 }),
    ];
    await openImagesViaTopbar(page, files);
    await setAddingMode(page, 'Drag');

    await drawByDragOnCanvas(page, { xFrac: 0.40, yFrac: 0.40 }, { xFrac: 0.62, yFrac: 0.65 });
    await drawByDragOnCanvas(page, { xFrac: 0.48, yFrac: 0.48 }, { xFrac: 0.75, yFrac: 0.78 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(2);

    await runEditAnnotationScopeOperation(page, 'Toggle visibility', 'Current image', 'Hide');
    await expect(annotationItems(page).first().locator('button[title="Show annotation"]')).toBeVisible();

    await runEditAnnotationScopeOperation(page, 'Toggle visibility', 'Current image', 'Show');
    await expect(annotationItems(page).first().locator('button[title="Hide annotation"]')).toBeVisible();
  });

  test('set anchoring dialog applies anchor/unanchor for current image', async ({ page }) => {
    const files: FilePayload[] = [
      bmpFile('anchoring-scope.bmp', 280, 180, { r: 120, g: 140, b: 160 }),
    ];
    await openImagesViaTopbar(page, files);
    await setAddingMode(page, 'Drag');

    await drawByDragOnCanvas(page, { xFrac: 0.36, yFrac: 0.35 }, { xFrac: 0.57, yFrac: 0.61 });
    await drawByDragOnCanvas(page, { xFrac: 0.50, yFrac: 0.42 }, { xFrac: 0.73, yFrac: 0.76 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(2);

    await runEditAnnotationScopeOperation(page, 'Toggle anchoring', 'Current image', 'Anchor');
    await expect(annotationItems(page).first().locator('button[title="Unanchor annotation"]')).toBeVisible();

    await runEditAnnotationScopeOperation(page, 'Toggle anchoring', 'Current image', 'Unanchor');
    await expect(annotationItems(page).first().locator('button[title="Anchor annotation"]')).toBeVisible();
  });

  test('set visibility dialog applies hide only to bookmarked images scope', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('scope-bookmark-a.bmp', 280, 180, { r: 90, g: 120, b: 170 }),
      bmpFile('scope-bookmark-b.bmp', 280, 180, { r: 130, g: 105, b: 160 }),
    ]);
    await setAddingMode(page, 'Drag');

    await drawByDragOnCanvas(page, { xFrac: 0.34, yFrac: 0.30 }, { xFrac: 0.62, yFrac: 0.66 });
    await bookmarkImageByName(page, 'scope-bookmark-a.bmp');

    await selectImageByName(page, 'scope-bookmark-b.bmp');
    await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.26 }, { xFrac: 0.52, yFrac: 0.58 });

    await runEditAnnotationScopeOperation(page, 'Toggle visibility', 'Bookmarked images', 'Hide');

    await selectImageByName(page, 'scope-bookmark-a.bmp');
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(annotationItems(page).first().locator('button[title="Show annotation"]')).toBeVisible();

    await selectImageByName(page, 'scope-bookmark-b.bmp');
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(annotationItems(page).first().locator('button[title="Hide annotation"]')).toBeVisible();
  });

  test('set anchoring dialog applies anchor across all images scope', async ({ page }) => {
    await openImagesViaTopbar(page, [
      bmpFile('scope-all-a.bmp', 280, 180, { r: 95, g: 120, b: 170 }),
      bmpFile('scope-all-b.bmp', 280, 180, { r: 135, g: 105, b: 150 }),
    ]);
    await setAddingMode(page, 'Drag');

    await drawByDragOnCanvas(page, { xFrac: 0.32, yFrac: 0.30 }, { xFrac: 0.58, yFrac: 0.62 });
    await selectImageByName(page, 'scope-all-b.bmp');
    await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.32 }, { xFrac: 0.56, yFrac: 0.64 });

    await runEditAnnotationScopeOperation(page, 'Toggle anchoring', 'All images', 'Anchor');

    await selectImageByName(page, 'scope-all-a.bmp');
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page).first().locator('button[title="Unanchor annotation"]')).toBeVisible();

    await selectImageByName(page, 'scope-all-b.bmp');
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page).first().locator('button[title="Unanchor annotation"]')).toBeVisible();
  });

  test('class default anchoring applies to newly drawn annotation', async ({ page }) => {
    const files: FilePayload[] = [
      bmpFile('class-default-anchor.bmp', 260, 180, { r: 85, g: 120, b: 130 }),
    ];
    await openImagesViaTopbar(page, files);

    await openSidebarTab(page, 'Classes');
    const unassignedCard = page
      .locator('.class-card')
      .filter({ has: page.locator('.class-name-btn', { hasText: 'Unassigned' }) })
      .first();
    await expect(unassignedCard).toBeVisible();

    await unassignedCard.locator('button[title="Anchor class instances"]').click();
    await expect(unassignedCard.locator('button[title="Unanchor class instances"]')).toBeVisible();

    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.44, yFrac: 0.45 }, { xFrac: 0.70, yFrac: 0.72 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(annotationItems(page).first().locator('button[title="Unanchor annotation"]')).toBeVisible();
  });
});
