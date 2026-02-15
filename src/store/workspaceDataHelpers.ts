import { ClassData, ImageItem } from '../domain/types';

export const FALLBACK_CLASS_COLOR = '#27272A';

export function createFallbackClass(id: string, name: string): ClassData {
  return {
    id,
    name,
    color: FALLBACK_CLASS_COLOR,
    isVisible: true,
    isDefault: true,
  };
}

export function enforceSingleDefaultClass(classes: ClassData[]): void {
  if (classes.length === 0) return;
  const firstDefaultIndex = classes.findIndex((c) => c.isDefault);
  if (firstDefaultIndex < 0) {
    classes[0] = { ...classes[0], isDefault: true };
    return;
  }
  for (let i = 0; i < classes.length; i += 1) {
    const shouldBeDefault = i === firstDefaultIndex;
    if (classes[i].isDefault !== shouldBeDefault) {
      classes[i] = { ...classes[i], isDefault: shouldBeDefault };
    }
  }
}

export function computeNextDisplayIdByImage(images: ImageItem[]): Record<string, number> {
  const nextDisplayIdByClass: Record<string, number> = {};
  for (const image of images) {
    const computed = image.annotations.reduce((max, ann) => Math.max(max, ann.displayId + 1), 1);
    nextDisplayIdByClass[image.id] = computed;
  }
  return nextDisplayIdByClass;
}
