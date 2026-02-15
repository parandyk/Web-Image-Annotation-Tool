import { Annotation, ImageItem } from '../domain/types';
import {
  filterScopedClassAnnotations,
  mapScopedClassAnnotations,
  reconcileSelectedAnnotations,
} from './scopedClassMutations';

type ScopedClassPatchState = {
  images: ImageItem[];
  selectedImageId: string | null;
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
};

export function buildScopedClassSwapPatch(
  state: Pick<ScopedClassPatchState, 'images'>,
  targetImageIdSet: Set<string>,
  sourceSet: Set<string>,
  substituteClassId: string
): { images: ImageItem[] } {
  return {
    images: mapScopedClassAnnotations(
      state.images,
      targetImageIdSet,
      sourceSet,
      (annotation) => ({ ...annotation, classId: substituteClassId })
    ),
  };
}

export function buildScopedClassRemoveWithSelectionPatch(
  state: ScopedClassPatchState,
  targetImageIdSet: Set<string>,
  sourceSet: Set<string>
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  const images = filterScopedClassAnnotations(
    state.images,
    targetImageIdSet,
    sourceSet
  );
  const selection = reconcileSelectedAnnotations(
    images,
    state.selectedImageId,
    state.selectedAnnotationIds,
    state.selectedAnnotationId,
    { fallback: 'first' }
  );
  return {
    images,
    selectedAnnotationIds: selection.selectedAnnotationIds,
    selectedAnnotationId: selection.selectedAnnotationId,
  };
}

function buildScopedClassSetFieldPatch(
  state: Pick<ScopedClassPatchState, 'images'>,
  targetImageIdSet: Set<string>,
  sourceSet: Set<string>,
  mapper: (annotation: Annotation) => Annotation
): { images: ImageItem[] } {
  return {
    images: mapScopedClassAnnotations(
      state.images,
      targetImageIdSet,
      sourceSet,
      mapper
    ),
  };
}

export function buildScopedClassAnchoringPatch(
  state: Pick<ScopedClassPatchState, 'images'>,
  targetImageIdSet: Set<string>,
  sourceSet: Set<string>,
  anchored: boolean
): { images: ImageItem[] } {
  return buildScopedClassSetFieldPatch(
    state,
    targetImageIdSet,
    sourceSet,
    (annotation) => ({ ...annotation, isAnchored: anchored })
  );
}

export function buildScopedClassVisibilityWithSelectionPatch(
  state: ScopedClassPatchState,
  targetImageIdSet: Set<string>,
  sourceSet: Set<string>,
  visible: boolean
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  const images = mapScopedClassAnnotations(
    state.images,
    targetImageIdSet,
    sourceSet,
    (annotation) => ({ ...annotation, isVisible: visible })
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
