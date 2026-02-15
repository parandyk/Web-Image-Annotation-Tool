import { Annotation, ImageItem } from '../domain/types';

export type SelectedImageScope = {
  selectedImageId: string;
  image: ImageItem;
};

export type SelectedImageAnnotationScope = SelectedImageScope & {
  targetImageIds: Set<string>;
};

export type AnnotationFlag = 'isVisible' | 'isAnchored';

export function findSelectedImage(
  images: ImageItem[],
  selectedImageId: string | null
): ImageItem | null {
  if (!selectedImageId) return null;
  return images.find((img) => img.id === selectedImageId) ?? null;
}

export function resolveSelectedImageScope(
  images: ImageItem[],
  selectedImageId: string | null
): SelectedImageScope | null {
  if (!selectedImageId) return null;
  const image = findSelectedImage(images, selectedImageId);
  if (!image) return null;
  return {
    selectedImageId,
    image,
  };
}

export function resolveSelectedImageAnnotationScope(
  images: ImageItem[],
  selectedImageId: string | null
): SelectedImageAnnotationScope | null {
  const scope = resolveSelectedImageScope(images, selectedImageId);
  if (!scope || scope.image.annotations.length === 0) return null;
  return {
    ...scope,
    targetImageIds: new Set([scope.selectedImageId]),
  };
}

export function resolveSelectedImageAnnotationFlagValue(
  images: ImageItem[],
  selectedImageId: string | null,
  flag: AnnotationFlag,
  mode: 'toggle' | 'set',
  explicitValue?: boolean
): { scope: SelectedImageAnnotationScope; value: boolean } | null {
  const scope = resolveSelectedImageAnnotationScope(images, selectedImageId);
  if (!scope) return null;

  if (mode === 'set') {
    if (typeof explicitValue !== 'boolean') return null;
    if (scope.image.annotations.every((annotation) => annotation[flag] === explicitValue)) {
      return null;
    }
    return { scope, value: explicitValue };
  }

  return {
    scope,
    value: scope.image.annotations.some((annotation) => !annotation[flag]),
  };
}

export function getBookmarkedImageIdSet(images: ImageItem[]): Set<string> {
  return new Set(images.filter((img) => img.isBookmarked).map((img) => img.id));
}

export function resolveBookmarkedAnnotationImageIds(
  images: ImageItem[]
): Set<string> | null {
  const bookmarkedImageIds = getBookmarkedImageIdSet(images);
  if (bookmarkedImageIds.size === 0) return null;
  if (!hasAnyAnnotations(images, bookmarkedImageIds)) return null;
  return bookmarkedImageIds;
}

export function hasAnyAnnotations(images: ImageItem[], targetImageIds?: Set<string>): boolean {
  return images.some(
    (img) => (!targetImageIds || targetImageIds.has(img.id)) && img.annotations.length > 0
  );
}

export function hasAnyAnnotationMatch(
  images: ImageItem[],
  predicate: (annotation: Annotation) => boolean,
  targetImageIds?: Set<string>
): boolean {
  return images.some(
    (img) =>
      (!targetImageIds || targetImageIds.has(img.id)) &&
      img.annotations.some((annotation) => predicate(annotation))
  );
}

export function resolveAnnotationToggleValue(
  images: ImageItem[],
  predicate: (annotation: Annotation) => boolean,
  targetImageIds?: Set<string>
): boolean | null {
  if (!hasAnyAnnotations(images, targetImageIds)) return null;
  return hasAnyAnnotationMatch(images, predicate, targetImageIds);
}

export function clearAnnotationsInImages(
  images: ImageItem[],
  targetImageIds?: Set<string>
): ImageItem[] {
  return images.map((img) =>
    targetImageIds && !targetImageIds.has(img.id)
      ? img
      : { ...img, annotations: [] }
  );
}

export function mapAnnotationsInImages(
  images: ImageItem[],
  mapper: (annotation: Annotation) => Annotation,
  targetImageIds?: Set<string>
): ImageItem[] {
  return images.map((img) =>
    targetImageIds && !targetImageIds.has(img.id)
      ? img
      : { ...img, annotations: img.annotations.map((annotation) => mapper(annotation)) }
  );
}
