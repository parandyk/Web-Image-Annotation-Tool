import { ImageItem } from '../domain/types';
import { mapAnnotationsInImages } from './annotationScopeHelpers';
import { buildVisibilitySelectionState } from './annotationSelection';
import { reconcileSelectedAnnotations } from './scopedClassMutations';

type AnnotationScopeState = {
  images: ImageItem[];
  selectedImageId: string | null;
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
};

export function buildSetAnnotationsAnchoringPatch(
  state: Pick<AnnotationScopeState, 'images'>,
  anchored: boolean,
  targetImageIds?: Set<string>
): { images: ImageItem[] } {
  return {
    images: mapAnnotationsInImages(
      state.images,
      (annotation) => ({ ...annotation, isAnchored: anchored }),
      targetImageIds
    ),
  };
}

export function buildSetAnnotationsVisibilityPatch(
  state: AnnotationScopeState,
  visible: boolean,
  targetImageIds?: Set<string>
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  return {
    images: mapAnnotationsInImages(
      state.images,
      (annotation) => ({ ...annotation, isVisible: visible }),
      targetImageIds
    ),
    ...buildVisibilitySelectionState(
      visible,
      state.selectedAnnotationIds,
      state.selectedAnnotationId
    ),
  };
}

export function buildSetAnnotationsVisibilityReconciledPatch(
  state: AnnotationScopeState,
  visible: boolean,
  targetImageIds: Set<string>
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  const images = mapAnnotationsInImages(
    state.images,
    (annotation) => ({ ...annotation, isVisible: visible }),
    targetImageIds
  );
  const selection = reconcileSelectedAnnotations(
    images,
    state.selectedImageId,
    state.selectedAnnotationIds,
    state.selectedAnnotationId,
    { visibleOnly: true, fallback: 'last' }
  );
  return {
    images,
    selectedAnnotationIds: selection.selectedAnnotationIds,
    selectedAnnotationId: selection.selectedAnnotationId,
  };
}
