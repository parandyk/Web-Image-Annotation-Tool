import { ImageItem } from '../domain/types';
import { mapSelectedImageAnnotations } from './selectedImageAnnotations';

type ClassSelectionPatchState = {
  images: ImageItem[];
  selectedImageId: string | null;
};

export function buildApplyLastAnnotationClassSelectionPatch(
  state: ClassSelectionPatchState,
  selectedClassId: string,
  annotationId: string,
  classId: string
): {
  selectedClassId: string;
  images: ImageItem[];
} {
  return {
    selectedClassId,
    images: mapSelectedImageAnnotations(
      state.images,
      state.selectedImageId,
      (annotation) =>
        annotation.id === annotationId
          ? { ...annotation, classId }
          : annotation
    ),
  };
}
