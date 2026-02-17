import { expect, type FilePayload, type Locator, type Page } from '@playwright/test';

function createBmp24Buffer(
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): Buffer {
  const rowRaw = width * 3;
  const rowStride = (rowRaw + 3) & ~3;
  const pixelDataSize = rowStride * height;
  const fileSize = 54 + pixelDataSize;
  const buffer = Buffer.alloc(fileSize, 0);

  buffer.write('BM', 0, 2, 'ascii');
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);

  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  const { r, g, b } = color;
  for (let y = 0; y < height; y += 1) {
    const rowOffset = 54 + y * rowStride;
    for (let x = 0; x < width; x += 1) {
      const px = rowOffset + x * 3;
      buffer[px] = b;
      buffer[px + 1] = g;
      buffer[px + 2] = r;
    }
  }

  return buffer;
}

export function bmpFile(
  name: string,
  width: number,
  height: number,
  color: { r: number; g: number; b: number }
): FilePayload {
  return {
    name,
    mimeType: 'image/bmp',
    buffer: createBmp24Buffer(width, height, color),
  };
}

export async function bootstrapEmptyWorkspace(page: Page): Promise<void> {
  await page.goto('/');
  const restoreDialog = page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: 'Restore workspace' }) })
    .first();
  if (await restoreDialog.isVisible().catch(() => false)) {
    await restoreDialog.getByRole('button', { name: 'Discard' }).click();
  }

  await expect(topbar(page).getByRole('button', { name: 'Open', exact: true })).toBeVisible();
  await expect(page.locator('.workspace-empty')).toContainText('Open images');
}

export async function openImagesViaTopbar(
  page: Page,
  files: FilePayload[]
): Promise<void> {
  await topbar(page).getByRole('button', { name: 'Open', exact: true }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('.menu.open .menu-popover').first().getByRole('button', { name: 'Open images', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(files);
  await expect(page.locator('.canvas-container canvas').first()).toBeVisible();
}

export async function openSidebarTab(
  page: Page,
  tab: 'General' | 'Images' | 'Annotations' | 'Classes' | 'Settings'
): Promise<void> {
  await page.locator('.tabs').getByRole('button', { name: tab }).click();
}

function settingsDialog(page: Page): Locator {
  return page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: 'Settings' }) })
    .first();
}

function topbar(page: Page): Locator {
  return page.locator('header.topbar');
}

function editMenu(page: Page): Locator {
  return page.locator('.menu.open .menu-popover').first();
}

export async function setAddingMode(
  page: Page,
  mode: 'Click-Click' | 'Drag'
): Promise<void> {
  await topbar(page).getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = settingsDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Add', exact: true }).click();
  await dialog.getByRole('button', { name: mode }).click();
  const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
  if (await saveButton.isEnabled()) {
    await saveButton.click();
  } else {
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
}

export async function setApplicationMode(
  page: Page,
  mode: 'Add' | 'Edit'
): Promise<void> {
  await topbar(page).getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = settingsDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: mode }).click();
  const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
  if (await saveButton.isEnabled()) {
    await saveButton.click();
  } else {
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
}

async function canvasBox(page: Page): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const canvasHost = page.locator('.canvas-container canvas').first();
  await expect(canvasHost).toBeVisible();
  const box = await canvasHost.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box unavailable.');
  }
  return box;
}

export async function drawOnCanvas(
  page: Page, 
  mode: 'Click-Click' | 'Drag',
  start?: { xFrac: number; yFrac: number },
  end?: { xFrac: number; yFrac: number }
): Promise<void> {
  if (mode === 'Click-Click') {
    await drawByClickClickOnCanvas(page, start, end);
  } else {
    await drawByDragOnCanvas(page, start, end);
  }
}

export async function drawByDragOnCanvas(
  page: Page,
  start: { xFrac: number; yFrac: number } = { xFrac: 0.5, yFrac: 0.5 },
  end: { xFrac: number; yFrac: number } = { xFrac: 1.2, yFrac: 1.2 }
): Promise<void> {
  const box = await canvasBox(page);
  const startX = box.x + box.width * start.xFrac;
  const startY = box.y + box.height * start.yFrac;
  const endX = box.x + box.width * end.xFrac;
  const endY = box.y + box.height * end.yFrac;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.mouse.up();
}

export async function drawByClickClickOnCanvas(
  page: Page,
  first: { xFrac: number; yFrac: number } = { xFrac: 0.35, yFrac: 0.35 },
  second: { xFrac: number; yFrac: number } = { xFrac: 0.7, yFrac: 0.65 }
): Promise<void> {
  const box = await canvasBox(page);
  const x1 = box.x + box.width * first.xFrac;
  const y1 = box.y + box.height * first.yFrac;
  const x2 = box.x + box.width * second.xFrac;
  const y2 = box.y + box.height * second.yFrac;

  await page.mouse.click(x1, y1);
  await page.mouse.click(x2, y2);
}

export async function dragOnCanvas(
  page: Page,
  from: { xFrac: number; yFrac: number },
  to: { xFrac: number; yFrac: number }
): Promise<void> {
  const box = await canvasBox(page);
  const x1 = box.x + box.width * from.xFrac;
  const y1 = box.y + box.height * from.yFrac;
  const x2 = box.x + box.width * to.xFrac;
  const y2 = box.y + box.height * to.yFrac;

  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 12 });
  await page.mouse.up();
}

export function annotationItems(page: Page): Locator {
  return page.locator('.annotation-item');
}

export async function getCoordValue(page: Page, key: 'X1' | 'Y1' | 'X2' | 'Y2' | 'Width' | 'Height'): Promise<number> {
  const item = page
    .locator('.coord-item')
    .filter({ has: page.locator('.coord-key', { hasText: key }) })
    .first();
  const valueNode = item.locator('.coord-value');
  await expect(valueNode).not.toHaveText('');
  const text = (await valueNode.textContent())?.trim() ?? '';
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid coordinate value for ${key}: "${text}"`);
  }
  return value;
}

export async function runEditAnnotationScopeOperation(
  page: Page,
  kind: 'Toggle visibility' | 'Toggle anchoring',
  scope: 'Current image' | 'Bookmarked images' | 'All images',
  action: 'Show' | 'Hide' | 'Anchor' | 'Unanchor'
): Promise<void> {
  await topbar(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await editMenu(page).getByRole('button', { name: kind, exact: true }).click();
  const heading = kind === 'Toggle visibility' ? 'Toggle visibility' : 'Toggle anchoring';
  const dialog = page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: heading }) })
    .first();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: scope, exact: true }).click();
  await dialog.getByRole('button', { name: action, exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
}

export async function clickEditAction(page: Page, label: string): Promise<void> {
  await topbar(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await editMenu(page).getByRole('button', { name: label, exact: true }).click();
}

export async function editUndoRedoButtons(page: Page): Promise<{
  undo: Locator;
  redo: Locator;
}> {
  await topbar(page).getByRole('button', { name: 'Edit', exact: true }).click();
  const menu = editMenu(page);
  return {
    undo: menu.getByRole('button', { name: 'Undo' }),
    redo: menu.getByRole('button', { name: 'Redo' }),
  };
}
