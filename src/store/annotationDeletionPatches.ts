import { clearAnnotationsInImages } from './annotationScopeHelpers';
import { buildSingleAnnotationSelection, removeAnnotationFromSelectionState } from './annotationSelection';
import { reconcileSelectedAnnotations } from './scopedClassMutations';
import { filterSelectedImageAnnotations } from './selectedImageAnnotations';
import { ImageItem } from '../domain/types';

type AnnotationDeletionState = {
  images: ImageItem[];
  selectedImageId: string | null;
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
};

export function buildDeleteAnnotationPatch(
  state: AnnotationDeletionState,
  annotationId: string
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  const selection = removeAnnotationFromSelectionState(
    state.selectedAnnotationIds,
    state.selectedAnnotationId,
    annotationId
  );
  return {
    images: filterSelectedImageAnnotations(
      state.images,
      state.selectedImageId,
      (annotation) => annotation.id !== annotationId
    ),
    selectedAnnotationIds: selection.selectedAnnotationIds,
    selectedAnnotationId: selection.selectedAnnotationId,
  };
}

export function buildDeleteSelectedAnnotationsPatch(
  state: Pick<AnnotationDeletionState, 'images' | 'selectedImageId'>,
  targetIds: Set<string>
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  return {
    images: filterSelectedImageAnnotations(
      state.images,
      state.selectedImageId,
      (annotation) => !targetIds.has(annotation.id)
    ),
    ...buildSingleAnnotationSelection(null),
  };
}

export function buildClearAnnotationsPatch(
  state: Pick<AnnotationDeletionState, 'images'>,
  targetImageIds?: Set<string>
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  return {
    images: clearAnnotationsInImages(state.images, targetImageIds),
    ...buildSingleAnnotationSelection(null),
  };
}

export function buildClearBookmarkedAnnotationsWithSelectionPatch(
  state: AnnotationDeletionState,
  bookmarkedImageIds: Set<string>
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  const images = clearAnnotationsInImages(state.images, bookmarkedImageIds);
  const selection = reconcileSelectedAnnotations(
    images,
    state.selectedImageId,
    state.selectedAnnotationIds,
    state.selectedAnnotationId,
    { fallback: 'last' }
  );
  return {
    images,
    selectedAnnotationIds: selection.selectedAnnotationIds,
    selectedAnnotationId: selection.selectedAnnotationId,
  };
}
