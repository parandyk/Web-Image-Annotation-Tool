import { expect, type FilePayload, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type TopbarMenuName = 'Open' | 'Import' | 'Export' | 'Edit';

const DIRECTORY_ACTIONS = new Set(['Open image folder', 'Import dataset folder']);

export function textFile(name: string, content: string, mimeType = 'text/plain'): FilePayload {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content, 'utf8'),
  };
}

export function topbar(page: Page): Locator {
  return page.locator('header.topbar');
}

export function topbarStatus(page: Page): Locator {
  return page.locator('.topbar-status');
}

export function modalByHeading(page: Page, heading: string | RegExp): Locator {
  return page
    .locator('.modal-card')
    .filter({ has: page.getByRole('heading', { name: heading }) })
    .first();
}

export async function openTopbarMenu(page: Page, menuName: TopbarMenuName): Promise<Locator> {
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
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, toUploadBuffer(file));
  }
  return dir;
}

export async function chooseFilesFromMenu(
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

export async function importClassesViaTopbar(page: Page, classes: string[]): Promise<void> {
  await chooseFilesFromMenu(page, 'Import', 'Import classes', [textFile('classes.txt', `${classes.join('\n')}\n`)]);
}
