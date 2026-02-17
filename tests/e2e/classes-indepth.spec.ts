import { expect, test, type FilePayload, type Locator, type Page } from '@playwright/test';
import {
  annotationItems,
  bmpFile,
  bootstrapEmptyWorkspace,
  drawByDragOnCanvas,
  openImagesViaTopbar,
  openSidebarTab,
  setApplicationMode,
  setAddingMode,
} from './helpers/app';

function topbar(page: Page): Locator {
  return page.locator('header.topbar');
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
  await chooser.setFiles([textFile('classes.txt', `${classes.join('\n')}\n`)]);
}

function classCard(page: Page, className: string): Locator {
  return page
    .locator('.class-card')
    .filter({ has: page.locator('.class-name-btn', { hasText: className }) })
    .first();
}

function classFlyout(page: Page): Locator {
  return page
    .locator('.annotation-menu')
    .filter({ has: page.getByRole('button', { name: 'Swap instances', exact: true }) })
    .first();
}

function modalByHeading(page: Page, heading: string | RegExp): Locator {
  return page
    .locator('.modal-card')
    .filter({
      has:
        typeof heading === 'string'
          ? page.getByRole('heading', { name: heading, exact: true })
          : page.getByRole('heading', { name: heading }),
    })
    .first();
}

function annotationRowByDisplayId(page: Page, displayId: number): Locator {
  return annotationItems(page)
    .filter({ has: page.locator('.annotation-title-btn', { hasText: `#${displayId} ` }) })
    .first();
}

function classSelectionModifier(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

async function selectAnnotationClassByDisplayId(page: Page, displayId: number, classLabel: string): Promise<void> {
  await openSidebarTab(page, 'Annotations');
  const row = annotationRowByDisplayId(page, displayId);
  await expect(row).toBeVisible();
  await row.locator('select.annotation-class-select').selectOption({ label: classLabel });
}

async function openClassFlyout(page: Page, className: string): Promise<Locator> {
  await openSidebarTab(page, 'Classes');
  const card = classCard(page, className);
  await expect(card).toBeVisible();
  await card.locator('.class-name-btn').click({ button: 'right' });
  const menu = classFlyout(page);
  await expect(menu).toBeVisible();
  return menu;
}

async function selectClasses(page: Page, classNames: string[]): Promise<void> {
  if (classNames.length === 0) return;
  await openSidebarTab(page, 'Classes');
  const [first, ...rest] = classNames;
  await classCard(page, first).locator('.class-name-btn').click();
  const modifier = classSelectionModifier();
  for (const className of rest) {
    await classCard(page, className).locator('.class-name-btn').click({ modifiers: [modifier] });
  }
}

async function seedImageWithTwoAnnotations(page: Page): Promise<void> {
  await openImagesViaTopbar(page, [bmpFile('classes-seed.bmp', 340, 220, { r: 100, g: 130, b: 170 })]);
  await setAddingMode(page, 'Drag');
  await drawByDragOnCanvas(page, { xFrac: 0.24, yFrac: 0.30 }, { xFrac: 0.48, yFrac: 0.58 });
  await drawByDragOnCanvas(page, { xFrac: 0.56, yFrac: 0.34 }, { xFrac: 0.84, yFrac: 0.70 });
  await openSidebarTab(page, 'Annotations');
  await expect(annotationItems(page)).toHaveCount(2);
}

test.describe('Classes behavior in-depth', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapEmptyWorkspace(page);
  });

  test('class lifecycle supports add, rename, visibility/anchoring toggles, and direct delete for unused class', async ({ page }) => {
    await openSidebarTab(page, 'Classes');

    const addClassRow = page.locator('.add-class-row');
    await addClassRow.locator('input[placeholder="Class name"]').fill('Vehicle');
    await addClassRow.getByRole('button', { name: 'Add', exact: true }).click();
    const vehicleCard = classCard(page, 'Vehicle');
    await expect(vehicleCard).toBeVisible();

    await vehicleCard.locator('input.rename-input').fill('Car');
    await vehicleCard.getByRole('button', { name: 'Rename', exact: true }).click();
    const carCard = classCard(page, 'Car');
    await expect(carCard).toBeVisible();
    await expect(classCard(page, 'Vehicle')).toHaveCount(0);

    await carCard.locator('button[title="Hide class"]').click();
    await expect(carCard.locator('button[title="Show class"]')).toBeVisible();
    await carCard.locator('button[title="Show class"]').click();
    await expect(carCard.locator('button[title="Hide class"]')).toBeVisible();

    await carCard.locator('button[title="Anchor class instances"]').click();
    await expect(carCard.locator('button[title="Unanchor class instances"]')).toBeVisible();
    await carCard.locator('button[title="Unanchor class instances"]').click();
    await expect(carCard.locator('button[title="Anchor class instances"]')).toBeVisible();

    await carCard.locator('button[title="Delete class"]').click();
    await expect(classCard(page, 'Car')).toHaveCount(0);
  });

  test('delete class dialog can remap affected annotations to Unassigned', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('delete-to-unassigned.bmp', 300, 200, { r: 115, g: 105, b: 160 })]);
    await importClasses(page, ['Vehicle']);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.26, yFrac: 0.32 }, { xFrac: 0.58, yFrac: 0.66 });
    await selectAnnotationClassByDisplayId(page, 1, 'Vehicle');

    await openSidebarTab(page, 'Classes');
    await classCard(page, 'Vehicle').locator('button[title="Delete class"]').click();
    const dialog = modalByHeading(page, /^Delete class:/);
    await expect(dialog).toBeVisible();
    await dialog.locator('label.radio-row', { hasText: 'Change affected annotations to Unassigned' }).click();
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect(classCard(page, 'Vehicle')).toHaveCount(0);
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(annotationRowByDisplayId(page, 1).locator('.annotation-title-btn')).toContainText('Unassigned');
  });

  test('delete class dialog can remap affected annotations to a specific class', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('delete-to-specific.bmp', 300, 200, { r: 90, g: 140, b: 150 })]);
    await importClasses(page, ['Vehicle', 'Person']);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.30, yFrac: 0.30 }, { xFrac: 0.60, yFrac: 0.62 });
    await selectAnnotationClassByDisplayId(page, 1, 'Vehicle');

    await openSidebarTab(page, 'Classes');
    await classCard(page, 'Vehicle').locator('button[title="Delete class"]').click();
    const dialog = modalByHeading(page, /^Delete class:/);
    await expect(dialog).toBeVisible();
    await dialog.locator('label.radio-row', { hasText: 'Change affected annotations to specific class' }).click();
    await dialog.locator('select').selectOption({ label: 'Person' });
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect(classCard(page, 'Vehicle')).toHaveCount(0);
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(annotationRowByDisplayId(page, 1).locator('.annotation-title-btn')).toContainText('Person');
  });

  test('delete class dialog can remove affected annotations', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('delete-affected.bmp', 300, 200, { r: 130, g: 95, b: 160 })]);
    await importClasses(page, ['Vehicle']);
    await setAddingMode(page, 'Drag');
    await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.30 }, { xFrac: 0.56, yFrac: 0.64 });
    await selectAnnotationClassByDisplayId(page, 1, 'Vehicle');

    await openSidebarTab(page, 'Classes');
    await classCard(page, 'Vehicle').locator('button[title="Delete class"]').click();
    const dialog = modalByHeading(page, /^Delete class:/);
    await expect(dialog).toBeVisible();
    await dialog.locator('label.radio-row', { hasText: 'Delete affected annotations' }).click();
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();

    await expect(classCard(page, 'Vehicle')).toHaveCount(0);
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);
  });

  test('swap and remove instance actions in class cards mutate annotations correctly', async ({ page }) => {
    await seedImageWithTwoAnnotations(page);
    await importClasses(page, ['Vehicle', 'Person']);
    await selectAnnotationClassByDisplayId(page, 1, 'Vehicle');
    await selectAnnotationClassByDisplayId(page, 2, 'Person');

    await openSidebarTab(page, 'Classes');
    await classCard(page, 'Vehicle').getByRole('button', { name: 'Swap instances', exact: true }).click();
    const swapDialog = modalByHeading(page, /^Swap instances:/);
    await expect(swapDialog).toBeVisible();
    await swapDialog.locator('select').selectOption({ label: 'Person' });
    await swapDialog.getByRole('button', { name: 'Confirm', exact: true }).click();

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(2);
    await expect(page.locator('.annotation-title-btn', { hasText: 'Vehicle' })).toHaveCount(0);
    await expect(page.locator('.annotation-title-btn', { hasText: 'Person' })).toHaveCount(2);

    await openSidebarTab(page, 'Classes');
    await classCard(page, 'Person').getByRole('button', { name: 'Remove instances', exact: true }).click();
    const removeDialog = modalByHeading(page, /^Remove instances:/);
    await expect(removeDialog).toBeVisible();
    await removeDialog.getByRole('button', { name: 'Confirm', exact: true }).click();

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);
  });

  test('class flyout supports visibility/anchoring toggles plus bulk swap and delete', async ({ page }) => {
    await seedImageWithTwoAnnotations(page);
    await importClasses(page, ['Vehicle', 'Person']);
    await selectAnnotationClassByDisplayId(page, 1, 'Vehicle');
    await selectAnnotationClassByDisplayId(page, 2, 'Person');

    {
      const menu = await openClassFlyout(page, 'Vehicle');
      await expect(menu.getByRole('button', { name: 'Toggle visibility', exact: true })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Toggle anchoring', exact: true })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Delete selected', exact: true })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Swap instances', exact: true })).toBeVisible();
      await expect(menu.getByRole('button', { name: 'Remove instances', exact: true })).toBeVisible();
      await menu.getByRole('button', { name: 'Toggle visibility', exact: true }).click();
    }
    await openSidebarTab(page, 'Classes');
    await expect(classCard(page, 'Vehicle').locator('button[title="Show class"]')).toBeVisible();

    {
      const menu = await openClassFlyout(page, 'Vehicle');
      await menu.getByRole('button', { name: 'Toggle anchoring', exact: true }).click();
    }
    await openSidebarTab(page, 'Classes');
    await expect(classCard(page, 'Vehicle').locator('button[title="Unanchor class instances"]')).toBeVisible();

    await selectClasses(page, ['Vehicle', 'Person']);
    {
      const menu = await openClassFlyout(page, 'Vehicle');
      await menu.getByRole('button', { name: 'Swap instances', exact: true }).click();
    }
    const bulkSwap = modalByHeading(page, 'Swap instances');
    await expect(bulkSwap).toBeVisible();
    await bulkSwap.locator('select').selectOption({ label: 'Unassigned' });
    await bulkSwap.getByRole('button', { name: 'Confirm', exact: true }).click();

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(2);
    await expect(page.locator('.annotation-title-btn', { hasText: 'Vehicle' })).toHaveCount(0);
    await expect(page.locator('.annotation-title-btn', { hasText: 'Person' })).toHaveCount(0);
    await expect(page.locator('.annotation-title-btn', { hasText: 'Unassigned' })).toHaveCount(2);

    await selectClasses(page, ['Vehicle', 'Person']);
    {
      const menu = await openClassFlyout(page, 'Vehicle');
      await menu.getByRole('button', { name: 'Delete selected', exact: true }).click();
    }
    await expect(modalByHeading(page, 'Delete classes')).toHaveCount(0);
    await openSidebarTab(page, 'Classes');
    await expect(classCard(page, 'Vehicle')).toHaveCount(0);
    await expect(classCard(page, 'Person')).toHaveCount(0);
  });

  test('class flyout remove instances action works for multi-selection', async ({ page }) => {
    await seedImageWithTwoAnnotations(page);
    await importClasses(page, ['Vehicle', 'Person']);
    await selectAnnotationClassByDisplayId(page, 1, 'Vehicle');
    await selectAnnotationClassByDisplayId(page, 2, 'Person');

    await selectClasses(page, ['Vehicle', 'Person']);
    {
      const menu = await openClassFlyout(page, 'Vehicle');
      await menu.getByRole('button', { name: 'Remove instances', exact: true }).click();
    }
    const dialog = modalByHeading(page, 'Remove instances');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(0);
  });

  test('fast class swap mode reassigns selected annotations via class clicks and class hotkeys in edit mode', async ({ page }) => {
    await seedImageWithTwoAnnotations(page);
    await importClasses(page, ['Vehicle', 'Person']);
    await setApplicationMode(page, 'Edit');

    await openSidebarTab(page, 'Classes');
    const vehicleCard = classCard(page, 'Vehicle');
    await vehicleCard.locator('.class-hotkey-btn').click();
    await expect(vehicleCard.locator('.class-hotkey-btn')).toHaveText('Press key...');
    await page.keyboard.press('v');
    await expect(vehicleCard.locator('.class-hotkey-btn')).toHaveText('Key: V');

    await openSidebarTab(page, 'Annotations');
    const rows = annotationItems(page);
    const modifier = classSelectionModifier();
    await rows.nth(0).locator('.annotation-title-btn').click();
    await rows.nth(1).locator('.annotation-title-btn').click({ modifiers: [modifier] });
    await expect(page.locator('.annotation-item.selected')).toHaveCount(2);

    await openSidebarTab(page, 'Classes');
    const fastSwapToggle = page.getByRole('button', { name: /^Fast class swap:/ }).first();
    await fastSwapToggle.click();
    await expect(fastSwapToggle).toHaveText('Fast class swap: On');
    await classCard(page, 'Person').locator('.class-name-btn').click();

    await openSidebarTab(page, 'Annotations');
    await expect(page.locator('.annotation-title-btn', { hasText: 'Person' })).toHaveCount(2);

    await page.keyboard.press('v');
    await expect(page.locator('.annotation-title-btn', { hasText: 'Vehicle' })).toHaveCount(2);
  });

  test('class hotkeys support assign, conflict handling, clear, and active-class drawing', async ({ page }) => {
    await openImagesViaTopbar(page, [bmpFile('class-hotkeys.bmp', 340, 220, { r: 110, g: 130, b: 165 })]);
    await importClasses(page, ['Vehicle', 'Person']);
    await setAddingMode(page, 'Drag');

    await openSidebarTab(page, 'Classes');
    const vehicleCard = classCard(page, 'Vehicle');
    const personCard = classCard(page, 'Person');
    const unassignedCard = classCard(page, 'Unassigned');

    await vehicleCard.locator('.class-hotkey-btn').click();
    await expect(vehicleCard.locator('.class-hotkey-btn')).toHaveText('Press key...');
    await page.keyboard.press('v');
    await expect(vehicleCard.locator('.class-hotkey-btn')).toHaveText('Key: V');

    await personCard.locator('.class-hotkey-btn').click();
    await page.keyboard.press('v');
    await expect(topbar(page).locator('.topbar-status')).toContainText('Hotkey "V" is already assigned to "Vehicle".');
    await expect(personCard.locator('.class-hotkey-btn')).toHaveText('Set key');

    await personCard.locator('.class-hotkey-btn').click();
    await page.keyboard.press('p');
    await expect(personCard.locator('.class-hotkey-btn')).toHaveText('Key: P');

    await personCard.locator('button.class-hotkey-clear').click();
    await expect(personCard.locator('.class-hotkey-btn')).toHaveText('Set key');

    await unassignedCard.locator('.class-name-btn').click();
    await page.keyboard.press('v');
    await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.30 }, { xFrac: 0.56, yFrac: 0.62 });

    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
    await expect(annotationRowByDisplayId(page, 1).locator('.annotation-title-btn')).toContainText('Vehicle');
  });
});
