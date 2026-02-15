import { ImageItem } from '../domain/types';

export function resolveSingleImageDeletion(
  images: ImageItem[],
  imageId: string
): ImageItem | null {
  return images.find((image) => image.id === imageId) ?? null;
}

export function resolveMultipleImageDeletions(
  images: ImageItem[],
  imageIds: string[]
): { deletedIds: Set<string>; deletedImages: ImageItem[] } | null {
  const deletedIds = new Set(imageIds);
  if (deletedIds.size === 0) return null;

  const deletedImages = images.filter((image) => deletedIds.has(image.id));
  if (deletedImages.length === 0) return null;

  return {
    deletedIds: new Set(deletedImages.map((image) => image.id)),
    deletedImages,
  };
}
