import { Annotation, AnnotationClassAssignmentMode, BBox, ClassData, ImageItem } from '../domain/types';
import { getDefaultClassId, getNextDisplayIdForImage } from './classImageHelpers';
import { normalizeBBox } from './bboxMath';
import { findSelectedImage } from './annotationScopeHelpers';
import { appendSelectedImageAnnotation } from './selectedImageAnnotations';

type AddAnnotationResolutionInput = {
  images: ImageItem[];
  selectedImageId: string | null;
  bbox: BBox;
  classes: ClassData[];
  selectedClassId: string;
  classAssignmentMode: AnnotationClassAssignmentMode;
  liveDraftClassId: string | null;
  nextDisplayIdByClass: Record<string, number>;
  dragDeadzonePx: number;
};

export type AddAnnotationResolution = {
  image: ImageItem;
  bbox: BBox;
  classId: string;
  displayId: number;
};

type AddAnnotationPatchState = {
  images: ImageItem[];
  selectedImageId: string | null;
  selectedClassId: string;
  classes: ClassData[];
  classAssignmentMode: AnnotationClassAssignmentMode;
  nextDisplayIdByClass: Record<string, number>;
};

export type AddAnnotationPatch = {
  images: ImageItem[];
  selectedAnnotationId: string;
  selectedAnnotationIds: string[];
  selectedClassId: string;
  liveDraftClassId: null;
  deferredLastAnnotationId: string | null;
  deferredLastImageId: string | null;
  nextDisplayIdByClass: Record<string, number>;
};

export function resolveAddAnnotation(
  input: AddAnnotationResolutionInput
): AddAnnotationResolution | null {
  const image = findSelectedImage(input.images, input.selectedImageId);
  if (!image) return null;

  const normalized = normalizeBBox(input.bbox, image.width, image.height);
  const minSize = Math.max(2, input.dragDeadzonePx);
  if (normalized.width < minSize || normalized.height < minSize) return null;

  const defaultClassId = getDefaultClassId(input.classes, input.selectedClassId);
  const classId =
    input.classAssignmentMode === 'deferred'
      ? input.liveDraftClassId && input.classes.some((c) => c.id === input.liveDraftClassId)
        ? input.liveDraftClassId
        : defaultClassId
      : input.selectedClassId;
  const displayId = getNextDisplayIdForImage(
    input.nextDisplayIdByClass,
    input.images,
    image.id
  );

  return {
    image,
    bbox: normalized,
    classId,
    displayId,
  };
}

export function buildAddedAnnotationPatch(
  state: AddAnnotationPatchState,
  annotation: Annotation,
  imageId: string,
  displayId: number
): AddAnnotationPatch {
  return {
    images: appendSelectedImageAnnotation(
      state.images,
      state.selectedImageId,
      annotation
    ),
    selectedAnnotationId: annotation.id,
    selectedAnnotationIds: [annotation.id],
    selectedClassId:
      state.classAssignmentMode === 'deferred'
        ? getDefaultClassId(state.classes, state.selectedClassId)
        : state.selectedClassId,
    liveDraftClassId: null,
    deferredLastAnnotationId:
      state.classAssignmentMode === 'deferred' ? annotation.id : null,
    deferredLastImageId:
      state.classAssignmentMode === 'deferred' ? imageId : null,
    nextDisplayIdByClass: {
      ...state.nextDisplayIdByClass,
      [imageId]: displayId + 1,
    },
  };
}
