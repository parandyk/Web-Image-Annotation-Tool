import { Annotation, ImageItem } from '../domain/types';

type Direction = 'next' | 'prev';

function cycleIndex(currentIndex: number, length: number, direction: Direction): number {
  if (direction === 'next') {
    return (currentIndex + 1 + length) % length;
  }
  return (currentIndex - 1 + length) % length;
}

export function getAdjacentImage(
  images: ImageItem[],
  selectedImageId: string,
  direction: Direction
): ImageItem | null {
  if (images.length === 0) return null;
  const currentIndex = images.findIndex((image) => image.id === selectedImageId);
  return images[cycleIndex(currentIndex, images.length, direction)] ?? null;
}

export function getBoundaryImage(images: ImageItem[], boundary: 'first' | 'last'): ImageItem | null {
  if (images.length === 0) return null;
  return boundary === 'first' ? images[0] : images[images.length - 1];
}

export function getAdjacentAnnotation(
  annotations: Annotation[],
  selectedAnnotationId: string | null,
  direction: Direction
): Annotation | null {
  if (annotations.length === 0) return null;
  const currentIndex = annotations.findIndex((annotation) => annotation.id === selectedAnnotationId);
  return annotations[cycleIndex(currentIndex, annotations.length, direction)] ?? null;
}

