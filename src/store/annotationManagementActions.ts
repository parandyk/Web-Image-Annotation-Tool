import { Annotation } from '../domain/types';
import { uid } from '../utils/id';
import { clamp, normalizeBBox } from './bboxMath';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import {
  buildNudgeSelectedAnnotationPatch,
  buildSetSelectedAnnotationClassPatch,
  buildUpdateSelectedAnnotationBBoxPatch,
  hasAnnotationInSelectedImage,
  resolveEditableSelectedImageAnnotation,
  resolveNudgableSelectedAnnotation,
  resolveSelectedImageAnnotationFlagToggle,
  resolveSelectedImageAnnotationTargets,
} from './selectedImageAnnotations';
import { buildAddedAnnotationPatch, resolveAddAnnotation } from './annotationCreation';
import {
  buildSetAnnotationsClassPatch,
  buildSetAnnotationsFlagPatch,
  buildSetAnnotationsVisibilityPatch,
  buildToggleSingleAnnotationFlagPatch,
} from './annotationActionPatches';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';
import { hasClassId } from './classLookup';

type AnnotationManagementActionKeys =
  | 'addAnnotation'
  | 'updateAnnotationBBox'
  | 'nudgeSelectedAnnotations'
  | 'setAnnotationClass'
  | 'setAnnotationsClass'
  | 'toggleAnnotationVisibility'
  | 'toggleAnnotationAnchoring'
  | 'toggleAnnotationsVisibility'
  | 'toggleAnnotationsAnchoring';

export function createAnnotationManagementActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, AnnotationManagementActionKeys> {
  return {
    addAnnotation: (bbox) => {
      const state = get();
      const resolved = resolveAddAnnotation({
        images: state.images,
        selectedImageId: state.selectedImageId,
        bbox,
        classes: state.classes,
        selectedClassId: state.selectedClassId,
        classAssignmentMode: state.classAssignmentMode,
        liveDraftClassId: state.liveDraftClassId,
        nextDisplayIdByClass: state.nextDisplayIdByClass,
        dragDeadzonePx: state.dragDeadzonePx,
      });
      if (!resolved) return;

      const base = createSnapshotFromState(state);
      const defaultAnchored = Boolean(
        state.classes.find((c) => c.id === resolved.classId)?.defaultAnchored
      );

      const newAnn: Annotation = {
        id: uid('ann'),
        classId: resolved.classId,
        bbox: resolved.bbox,
        isVisible: true,
        isAnchored: defaultAnchored,
        displayId: resolved.displayId,
      };

      set((s) => ({
        ...buildAddedAnnotationPatch(s, newAnn, resolved.image.id, resolved.displayId),
        ...pushUndoHistory(s, base),
      }));
    },

    updateAnnotationBBox: (annotationId, bbox) => {
      const state = get();
      const editable = resolveEditableSelectedImageAnnotation(
        state.images,
        state.selectedImageId,
        annotationId
      );
      if (!editable) return;

      const normalized = normalizeBBox(
        bbox,
        editable.image.width,
        editable.image.height
      );
      if (normalized.width < 2 || normalized.height < 2) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildUpdateSelectedAnnotationBBoxPatch(
          s,
          annotationId,
          normalized
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    nudgeSelectedAnnotations: (dx, dy) => {
      const state = get();
      const nudgable = resolveNudgableSelectedAnnotation(
        state.images,
        state.selectedImageId,
        state.selectedAnnotationId,
        state.selectedAnnotationIds
      );
      if (!nudgable) return;

      const nextX = clamp(
        nudgable.annotation.bbox.x + dx,
        0,
        nudgable.image.width - nudgable.annotation.bbox.width
      );
      const nextY = clamp(
        nudgable.annotation.bbox.y + dy,
        0,
        nudgable.image.height - nudgable.annotation.bbox.height
      );
      if (
        nextX === nudgable.annotation.bbox.x &&
        nextY === nudgable.annotation.bbox.y
      ) {
        return;
      }

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildNudgeSelectedAnnotationPatch(
          s,
          nudgable.annotationId,
          nextX,
          nextY
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    setAnnotationClass: (annotationId, classId) => {
      const state = get();
      if (!hasClassId(state.classes, classId)) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetSelectedAnnotationClassPatch(
          s,
          annotationId,
          classId
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    setAnnotationsClass: (annotationIds, classId) => {
      const state = get();
      if (!hasClassId(state.classes, classId)) return;
      const targets = resolveSelectedImageAnnotationTargets(
        state.images,
        state.selectedImageId,
        annotationIds
      );
      if (!targets) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsClassPatch(s, targets.targetIds, classId),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAnnotationVisibility: (annotationId) => {
      const state = get();
      if (!hasAnnotationInSelectedImage(state.images, state.selectedImageId, annotationId)) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildToggleSingleAnnotationFlagPatch(
          s,
          annotationId,
          'isVisible'
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAnnotationAnchoring: (annotationId) => {
      const state = get();
      if (!hasAnnotationInSelectedImage(state.images, state.selectedImageId, annotationId)) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildToggleSingleAnnotationFlagPatch(
          s,
          annotationId,
          'isAnchored'
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAnnotationsVisibility: (annotationIds) => {
      const state = get();
      const toggle = resolveSelectedImageAnnotationFlagToggle(
        state.images,
        state.selectedImageId,
        annotationIds,
        'isVisible'
      );
      if (!toggle) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsVisibilityPatch(
          s,
          toggle.targetIds,
          toggle.nextValue
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAnnotationsAnchoring: (annotationIds) => {
      const state = get();
      const toggle = resolveSelectedImageAnnotationFlagToggle(
        state.images,
        state.selectedImageId,
        annotationIds,
        'isAnchored'
      );
      if (!toggle) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsFlagPatch(
          s,
          toggle.targetIds,
          'isAnchored',
          toggle.nextValue
        ),
        ...pushUndoHistory(s, base),
      }));
    },
  };
}
