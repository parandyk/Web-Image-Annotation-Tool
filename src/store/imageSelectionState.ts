import { ImageItem } from '../domain/types';
import type { AppState } from './appStore.types';
import { buildSingleAnnotationSelection } from './annotationSelection';
import { reconcileImageSourcesForSelection } from './imageSources';

type SelectImagePatch = Pick<
  AppState,
  | 'images'
  | 'selectedImageId'
  | 'selectedAnnotationId'
  | 'selectedAnnotationIds'
  | 'liveDraftBBox'
  | 'liveDraftClassId'
  | 'deferredLastAnnotationId'
  | 'deferredLastImageId'
>;

export function buildSelectImagePatch(
  images: ImageItem[],
  requestedImageId: string | null
): SelectImagePatch {
  const selectedImageId =
    requestedImageId !== null && images.some((img) => img.id === requestedImageId)
      ? requestedImageId
      : null;
  return {
    images: reconcileImageSourcesForSelection(images, selectedImageId),
    selectedImageId,
    ...buildSingleAnnotationSelection(null),
    liveDraftBBox: null,
    liveDraftClassId: null,
    deferredLastAnnotationId: null,
    deferredLastImageId: null,
  };
}

