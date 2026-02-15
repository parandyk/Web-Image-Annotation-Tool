import { ImageItem } from '../domain/types';

export function revokeObjectUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export function revokeImageSources(images: ImageItem[]): void {
  for (const image of images) {
    revokeObjectUrl(image.src);
  }
}

export function reconcileImageSourcesForSelection(images: ImageItem[], selectedImageId: string | null): ImageItem[] {
  let changed = false;
  const reconciled = images.map((image) => {
    const shouldHaveSource = selectedImageId !== null && image.id === selectedImageId;
    if (shouldHaveSource) {
      if (image.src) return image;
      changed = true;
      return { ...image, src: URL.createObjectURL(image.file) };
    }
    if (!image.src) return image;
    revokeObjectUrl(image.src);
    changed = true;
    return { ...image, src: '' };
  });
  return changed ? reconciled : images;
}
