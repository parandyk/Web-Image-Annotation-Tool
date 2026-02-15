import { ClassData, ImageItem, ImageScope } from '../domain/types';

export function sanitizeClassName(input: string): string {
  // Normalize user-entered class names to safe, export-friendly identifiers.
  return input
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
}

export function normalizeClassHotkey(input: string): string | null {
  const key = input.trim().toUpperCase();
  if (!/^[A-Z0-9]$/.test(key)) return null;
  return key;
}

export function splitNameAndExt(fileName: string): { stem: string; ext: string } {
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0 || idx === fileName.length - 1) return { stem: fileName, ext: '' };
  return { stem: fileName.slice(0, idx), ext: fileName.slice(idx) };
}

export function withExtension(fileName: string, ext: string): string {
  const { stem } = splitNameAndExt(fileName);
  return `${stem}${ext}`;
}

export function toUniqueName(rawName: string, taken: Set<string>): string {
  if (!taken.has(rawName)) {
    taken.add(rawName);
    return rawName;
  }
  const { stem, ext } = splitNameAndExt(rawName);
  let n = 2;
  while (true) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
    n += 1;
  }
}

export function getNextDisplayIdForImage(
  nextDisplayIdByClass: Record<string, number>,
  images: ImageItem[],
  imageId: string
): number {
  // Display IDs are per-image and monotonic for stable labels in a session.
  const direct = nextDisplayIdByClass[imageId];
  if (Number.isFinite(direct) && direct >= 1) {
    return Math.max(1, Math.floor(direct));
  }
  const image = images.find((img) => img.id === imageId);
  const maxDisplayId = image?.annotations.reduce((max, ann) => Math.max(max, ann.displayId ?? 0), 0) ?? 0;
  return maxDisplayId + 1;
}

export function getDefaultClassId(classes: ClassData[], fallback = ''): string {
  return classes.find((c) => c.isDefault)?.id ?? classes[0]?.id ?? fallback;
}

export function getImageIdsByScope(
  images: ImageItem[],
  selectedImageId: string | null,
  scope: ImageScope
): string[] {
  if (scope === 'currentImage') {
    return [selectedImageId].filter(Boolean) as string[];
  }
  if (scope === 'bookmarkedImages') {
    return images.filter((img) => img.isBookmarked).map((img) => img.id);
  }
  return images.map((img) => img.id);
}

export function sanitizeExportImageBaseName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'image';
  const safe = trimmed
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 80);
  return safe.length > 0 ? safe : 'image';
}

export function sanitizeExportFolderName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'annotation_exports';
  const safe = trimmed
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  return safe.length > 0 ? safe : 'annotation_exports';
}
