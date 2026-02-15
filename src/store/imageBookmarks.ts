import { ImageItem } from '../domain/types';

type ImageBookmarkState = {
  images: ImageItem[];
};

export function resolveToggleImageBookmark(
  images: ImageItem[],
  imageId: string
): { imageId: string; bookmarked: boolean } | null {
  const image = images.find((item) => item.id === imageId);
  if (!image) return null;
  return {
    imageId,
    bookmarked: !image.isBookmarked,
  };
}

export function getChangedImageBookmarkIdSet(
  images: ImageItem[],
  imageIds: string[],
  bookmarked: boolean
): Set<string> {
  const idSet = new Set(imageIds);
  if (idSet.size === 0) return new Set();
  return new Set(
    images
      .filter((image) => idSet.has(image.id) && image.isBookmarked !== bookmarked)
      .map((image) => image.id)
  );
}

export function buildSetImagesBookmarkedPatch(
  state: ImageBookmarkState,
  changedIds: Set<string>,
  bookmarked: boolean
): { images: ImageItem[] } {
  return {
    images: state.images.map((image) =>
      changedIds.has(image.id)
        ? { ...image, isBookmarked: bookmarked }
        : image
    ),
  };
}
