import { ImageItem } from '../domain/types';
import { findSelectedImage } from './annotationScopeHelpers';
import { getAdjacentAnnotation, getAdjacentImage, getBoundaryImage } from './navigationHelpers';

export function resolveAdjacentImageId(
  images: ImageItem[],
  selectedImageId: string | null,
  direction: 'next' | 'prev'
): string | null {
  if (!selectedImageId || images.length === 0) return null;
  return getAdjacentImage(images, selectedImageId, direction)?.id ?? null;
}

export function resolveBoundaryImageId(
  images: ImageItem[],
  boundary: 'first' | 'last'
): string | null {
  return getBoundaryImage(images, boundary)?.id ?? null;
}

export function resolveAdjacentAnnotationId(
  images: ImageItem[],
  selectedImageId: string | null,
  selectedAnnotationId: string | null,
  direction: 'next' | 'prev'
): string | null {
  const image = findSelectedImage(images, selectedImageId);
  if (!image || image.annotations.length === 0) return null;
  return getAdjacentAnnotation(image.annotations, selectedAnnotationId, direction)?.id ?? null;
}
