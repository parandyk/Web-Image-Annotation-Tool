import type { AppState } from './appStore.types';
import { reconcileImageSourcesForSelection } from './imageSources';

type ImageLifecycleState = Pick<AppState, 'images' | 'selectedImageId' | 'nextDisplayIdByClass'>;

type DeleteImagesPatch = Pick<
  AppState,
  'images' | 'selectedImageId' | 'selectedAnnotationId' | 'selectedAnnotationIds' | 'nextDisplayIdByClass'
>;

type ClearImagesPatch = Pick<
  AppState,
  | 'images'
  | 'selectedImageId'
  | 'selectedAnnotationId'
  | 'selectedAnnotationIds'
  | 'liveDraftBBox'
  | 'liveDraftClassId'
  | 'deferredLastAnnotationId'
  | 'deferredLastImageId'
  | 'nextDisplayIdByClass'
  | 'statusText'
>;

export function buildStateAfterDeletingImages(
  state: ImageLifecycleState,
  deletedImageIds: Set<string>
): DeleteImagesPatch {
  const images = state.images.filter((img) => !deletedImageIds.has(img.id));
  const selectedImageId =
    state.selectedImageId && deletedImageIds.has(state.selectedImageId)
      ? images[0]?.id ?? null
      : state.selectedImageId;
  const nextDisplayIdByClass = { ...state.nextDisplayIdByClass };
  for (const id of deletedImageIds) {
    delete nextDisplayIdByClass[id];
  }

  return {
    images: reconcileImageSourcesForSelection(images, selectedImageId),
    selectedImageId,
    selectedAnnotationId: null,
    selectedAnnotationIds: [],
    nextDisplayIdByClass,
  };
}

export function buildStateAfterClearingImages(statusText: string): ClearImagesPatch {
  return {
    images: [],
    selectedImageId: null,
    selectedAnnotationId: null,
    selectedAnnotationIds: [],
    liveDraftBBox: null,
    liveDraftClassId: null,
    deferredLastAnnotationId: null,
    deferredLastImageId: null,
    nextDisplayIdByClass: {},
    statusText,
  };
}
