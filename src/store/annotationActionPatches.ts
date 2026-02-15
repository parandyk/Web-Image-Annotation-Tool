import { ImageItem } from '../domain/types';
import { buildVisibilitySelectionState } from './annotationSelection';
import {
  mapSelectedImageAnnotations,
  SelectedImageAnnotationFlag,
  setSelectedImageAnnotationFlags,
  toggleSelectedImageAnnotationFlag,
} from './selectedImageAnnotations';

type AnnotationActionState = {
  images: ImageItem[];
  selectedImageId: string | null;
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
};

export function buildSetAnnotationsClassPatch(
  state: Pick<AnnotationActionState, 'images' | 'selectedImageId'>,
  targetIds: Set<string>,
  classId: string
): { images: ImageItem[] } {
  return {
    images: mapSelectedImageAnnotations(
      state.images,
      state.selectedImageId,
      (annotation) =>
        targetIds.has(annotation.id) ? { ...annotation, classId } : annotation
    ),
  };
}

export function buildToggleSingleAnnotationFlagPatch(
  state: Pick<AnnotationActionState, 'images' | 'selectedImageId'>,
  annotationId: string,
  flag: SelectedImageAnnotationFlag
): { images: ImageItem[] } {
  return {
    images: toggleSelectedImageAnnotationFlag(
      state.images,
      state.selectedImageId,
      annotationId,
      flag
    ),
  };
}

export function buildSetAnnotationsFlagPatch(
  state: Pick<AnnotationActionState, 'images' | 'selectedImageId'>,
  targetIds: Set<string>,
  flag: SelectedImageAnnotationFlag,
  value: boolean
): { images: ImageItem[] } {
  return {
    images: setSelectedImageAnnotationFlags(
      state.images,
      state.selectedImageId,
      targetIds,
      flag,
      value
    ),
  };
}

export function buildSetAnnotationsVisibilityPatch(
  state: AnnotationActionState,
  targetIds: Set<string>,
  visible: boolean
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  return {
    images: setSelectedImageAnnotationFlags(
      state.images,
      state.selectedImageId,
      targetIds,
      'isVisible',
      visible
    ),
    ...buildVisibilitySelectionState(
      visible,
      state.selectedAnnotationIds,
      state.selectedAnnotationId
    ),
  };
}
