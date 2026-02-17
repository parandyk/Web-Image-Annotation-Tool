import type { AppState } from './appStore.types';
import { reconcileImageSourcesForSelection } from './imageSources';

type ImageLifecycleState = Pick<
  AppState,
  'images' | 'selectedImageId' | 'nextDisplayIdByClass' | 'pendingDetectionsByImageId'
>;

type DeleteImagesPatch = Pick<
  AppState,
  | 'images'
  | 'selectedImageId'
  | 'selectedAnnotationId'
  | 'selectedAnnotationIds'
  | 'selectedPendingDetectionIds'
  | 'nextDisplayIdByClass'
  | 'pendingDetectionsByImageId'
>;

type ClearImagesPatch = Pick<
  AppState,
  | 'images'
  | 'selectedImageId'
  | 'selectedAnnotationId'
  | 'selectedAnnotationIds'
  | 'selectedPendingDetectionIds'
  | 'liveDraftBBox'
  | 'liveDraftClassId'
  | 'deferredLastAnnotationId'
  | 'deferredLastImageId'
  | 'nextDisplayIdByClass'
  | 'pendingDetectionsByImageId'
  | 'inferenceBusy'
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
  const pendingDetectionsByImageId = { ...state.pendingDetectionsByImageId };
  for (const id of deletedImageIds) {
    delete nextDisplayIdByClass[id];
    delete pendingDetectionsByImageId[id];
  }

  return {
    images: reconcileImageSourcesForSelection(images, selectedImageId),
    selectedImageId,
    selectedAnnotationId: null,
    selectedAnnotationIds: [],
    selectedPendingDetectionIds: [],
    nextDisplayIdByClass,
    pendingDetectionsByImageId,
  };
}

export function buildStateAfterClearingImages(statusText: string): ClearImagesPatch {
  return {
    images: [],
    selectedImageId: null,
    selectedAnnotationId: null,
    selectedAnnotationIds: [],
    selectedPendingDetectionIds: [],
    liveDraftBBox: null,
    liveDraftClassId: null,
    deferredLastAnnotationId: null,
    deferredLastImageId: null,
    nextDisplayIdByClass: {},
    pendingDetectionsByImageId: {},
    inferenceBusy: false,
    statusText,
  };
}
