import { AnnotationClassAssignmentMode, BBox, ClassData, ImageItem, InteractionMode } from '../domain/types';
import { getDefaultClassId } from './classImageHelpers';

type ClassSelectionContext = {
  classId: string;
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  interactionMode: InteractionMode;
  classAssignmentMode: AnnotationClassAssignmentMode;
  liveDraftBBox: BBox | null;
  deferredLastAnnotationId: string | null;
  deferredLastImageId: string | null;
};

export type ClassSelectionOutcome =
  | { type: 'set-selected'; selectedClassId: string }
  | { type: 'set-live-draft'; selectedClassId: string; liveDraftClassId: string }
  | { type: 'apply-last-annotation'; selectedClassId: string; annotationId: string };

export function resolveClassSelectionOutcome(
  context: ClassSelectionContext
): ClassSelectionOutcome {
  const shouldAssignDeferred =
    context.interactionMode === 'add' &&
    context.classAssignmentMode === 'deferred';

  if (!shouldAssignDeferred) {
    return { type: 'set-selected', selectedClassId: context.classId };
  }

  const defaultClassId = getDefaultClassId(context.classes, context.selectedClassId);

  if (context.liveDraftBBox) {
    return {
      type: 'set-live-draft',
      selectedClassId: defaultClassId,
      liveDraftClassId: context.classId,
    };
  }

  if (!context.selectedImageId) {
    return { type: 'set-selected', selectedClassId: defaultClassId };
  }

  const image = context.images.find((img) => img.id === context.selectedImageId);
  if (!image) {
    return { type: 'set-selected', selectedClassId: defaultClassId };
  }

  const targetId =
    context.deferredLastImageId === image.id ? context.deferredLastAnnotationId : null;
  if (!targetId || !image.annotations.some((annotation) => annotation.id === targetId)) {
    return { type: 'set-selected', selectedClassId: defaultClassId };
  }

  return {
    type: 'apply-last-annotation',
    selectedClassId: defaultClassId,
    annotationId: targetId,
  };
}
