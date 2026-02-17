import { expect, test, type Page } from '@playwright/test';
import { annotationItems, bmpFile, drawByDragOnCanvas, openImagesViaTopbar, openSidebarTab, setAddingMode } from './helpers/app';

const RECOVERY_DB_NAME = 'image-annotation-tool-recovery';
const RECOVERY_STORE = 'snapshots';
const RECOVERY_KEY = 'latest';

async function clearRecoverySnapshot(page: Page): Promise<void> {
  await page.evaluate(
    async ({ dbName, storeName, key }) =>
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        req.onerror = () => reject(req.error ?? new Error('Failed to open recovery db.'));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const delReq = store.delete(key);
          delReq.onerror = () => reject(delReq.error ?? new Error('Failed to delete recovery snapshot.'));
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error ?? new Error('Failed to complete recovery delete transaction.'));
        };
      }),
    { dbName: RECOVERY_DB_NAME, storeName: RECOVERY_STORE, key: RECOVERY_KEY }
  );
}

async function hasRecoverySnapshot(page: Page): Promise<boolean> {
  return page.evaluate(
    async ({ dbName, storeName, key }) =>
      await new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        req.onerror = () => reject(req.error ?? new Error('Failed to open recovery db.'));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getReq = store.get(key);
          getReq.onerror = () => reject(getReq.error ?? new Error('Failed to read recovery snapshot.'));
          getReq.onsuccess = () => {
            const value = getReq.result as { snapshot?: unknown } | undefined;
            resolve(Boolean(value?.snapshot));
          };
          tx.oncomplete = () => db.close();
        };
      }),
    { dbName: RECOVERY_DB_NAME, storeName: RECOVERY_STORE, key: RECOVERY_KEY }
  );
}

function restoreDialog(page: Page) {
  return page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: 'Restore workspace' }) })
    .first();
}

async function discardRestoreIfPresent(page: Page): Promise<void> {
  const dialog = restoreDialog(page);
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
  }
}

async function seedWorkspace(page: Page): Promise<void> {
  await openImagesViaTopbar(page, [bmpFile('recovery-a.bmp', 320, 220, { r: 110, g: 120, b: 170 })]);
  await setAddingMode(page, 'Drag');
  await drawByDragOnCanvas(page, { xFrac: 0.28, yFrac: 0.30 }, { xFrac: 0.56, yFrac: 0.64 });
  await openSidebarTab(page, 'Annotations');
  await expect(annotationItems(page)).toHaveCount(1);
}

test.describe('Workspace recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await discardRestoreIfPresent(page);
    await clearRecoverySnapshot(page);
    await page.reload();
    await discardRestoreIfPresent(page);
  });

  test.afterEach(async ({ page }) => {
    await clearRecoverySnapshot(page);
  });

  test('restore dialog restores autosaved workspace after reload', async ({ page }) => {
    await seedWorkspace(page);

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(() => hasRecoverySnapshot(page), { timeout: 10_000 }).toBe(true);

    await page.reload();
    const dialog = restoreDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Restore', exact: true }).click();

    await expect(page.locator('.canvas-container canvas').first()).toBeVisible();
    await openSidebarTab(page, 'Annotations');
    await expect(annotationItems(page)).toHaveCount(1);
  });

  test('discard in restore dialog clears persisted snapshot and starts empty workspace', async ({ page }) => {
    await seedWorkspace(page);

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(() => hasRecoverySnapshot(page), { timeout: 10_000 }).toBe(true);

    await page.reload();
    const dialog = restoreDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Discard', exact: true }).click();

    await expect(page.locator('.workspace-empty')).toContainText('Open images');
    await expect.poll(() => hasRecoverySnapshot(page), { timeout: 10_000 }).toBe(false);
  });
});
