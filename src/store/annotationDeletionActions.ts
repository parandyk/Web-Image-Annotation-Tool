import {
  hasAnnotationInSelectedImage,
  resolveLastSelectedImageAnnotationId,
  resolveSelectedImageAnnotationTargets,
} from './selectedImageAnnotations';
import {
  buildClearAnnotationsPatch,
  buildClearBookmarkedAnnotationsWithSelectionPatch,
  buildDeleteAnnotationPatch,
  buildDeleteSelectedAnnotationsPatch,
} from './annotationDeletionPatches';
import {
  hasAnyAnnotations,
  resolveBookmarkedAnnotationImageIds,
  resolveSelectedImageAnnotationScope,
} from './annotationScopeHelpers';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type AnnotationDeletionActionKeys =
  | 'deleteAnnotation'
  | 'deleteSelectedAnnotations'
  | 'removeLastBBox'
  | 'removeAllBBoxes'
  | 'removeAllBBoxesGlobal'
  | 'removeAllBBoxesBookmarked';

export function createAnnotationDeletionActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, AnnotationDeletionActionKeys> {
  return {
    deleteAnnotation: (annotationId) => {
      const state = get();
      if (
        !hasAnnotationInSelectedImage(
          state.images,
          state.selectedImageId,
          annotationId
        )
      ) {
        return;
      }

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildDeleteAnnotationPatch(s, annotationId),
        ...pushUndoHistory(s, base),
      }));
    },

    deleteSelectedAnnotations: () => {
      const state = get();
      const targets = resolveSelectedImageAnnotationTargets(
        state.images,
        state.selectedImageId,
        state.selectedAnnotationIds
      );
      if (!targets) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildDeleteSelectedAnnotationsPatch(s, targets.targetIds),
        ...pushUndoHistory(s, base),
      }));
    },

    removeLastBBox: () => {
      const state = get();
      const lastId = resolveLastSelectedImageAnnotationId(
        state.images,
        state.selectedImageId
      );
      if (!lastId) return;
      get().deleteAnnotation(lastId);
    },

    removeAllBBoxes: () => {
      const state = get();
      const scope = resolveSelectedImageAnnotationScope(
        state.images,
        state.selectedImageId
      );
      if (!scope) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildClearAnnotationsPatch(s, scope.targetImageIds),
        ...pushUndoHistory(s, base),
      }));
    },

    removeAllBBoxesGlobal: () => {
      const state = get();
      if (!hasAnyAnnotations(state.images)) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildClearAnnotationsPatch(s),
        ...pushUndoHistory(s, base),
      }));
    },

    removeAllBBoxesBookmarked: () => {
      const state = get();
      const bookmarkedImageIds = resolveBookmarkedAnnotationImageIds(
        state.images
      );
      if (!bookmarkedImageIds) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildClearBookmarkedAnnotationsWithSelectionPatch(
          s,
          bookmarkedImageIds
        ),
        ...pushUndoHistory(s, base),
      }));
    },
  };
}
