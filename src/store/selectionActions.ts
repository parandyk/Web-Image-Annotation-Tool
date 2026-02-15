import { resolveSelectedImageAnnotationScope } from './annotationScopeHelpers';
import {
  buildNormalizedAnnotationSelection,
  buildSingleAnnotationSelection,
  toggleAnnotationSelectionState,
} from './annotationSelection';
import { resolveClassSelectionOutcome } from './classSelection';
import { buildApplyLastAnnotationClassSelectionPatch } from './classSelectionPatches';
import { buildSetImagesBookmarkedPatch, getChangedImageBookmarkIdSet, resolveToggleImageBookmark } from './imageBookmarks';
import { buildSelectImagePatch } from './imageSelectionState';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type SelectionActionKeys =
  | 'selectImage'
  | 'toggleImageBookmark'
  | 'setImagesBookmarked'
  | 'selectClass'
  | 'selectAnnotation'
  | 'setAnnotationSelection'
  | 'toggleAnnotationSelection'
  | 'clearAnnotationSelection'
  | 'selectAllAnnotationsCurrentImage';

export function createSelectionActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, SelectionActionKeys> {
  return {
    selectImage: (imageId) => set((s) => buildSelectImagePatch(s.images, imageId)),

    toggleImageBookmark: (imageId) => {
      const state = get();
      const toggle = resolveToggleImageBookmark(state.images, imageId);
      if (!toggle) return;
      get().setImagesBookmarked([toggle.imageId], toggle.bookmarked);
    },

    setImagesBookmarked: (imageIds, bookmarked) => {
      const state = get();
      const changedIds = getChangedImageBookmarkIdSet(
        state.images,
        imageIds,
        bookmarked
      );
      if (changedIds.size === 0) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetImagesBookmarkedPatch(s, changedIds, bookmarked),
        ...pushUndoHistory(s, base),
      }));
    },

    selectClass: (classId) => {
      const state = get();
      if (!state.classes.some((c) => c.id === classId)) return;
      const outcome = resolveClassSelectionOutcome({
        classId,
        classes: state.classes,
        images: state.images,
        selectedClassId: state.selectedClassId,
        selectedImageId: state.selectedImageId,
        interactionMode: state.interactionMode,
        classAssignmentMode: state.classAssignmentMode,
        liveDraftBBox: state.liveDraftBBox,
        deferredLastAnnotationId: state.deferredLastAnnotationId,
        deferredLastImageId: state.deferredLastImageId,
      });

      if (outcome.type === 'set-selected') {
        set({ selectedClassId: outcome.selectedClassId });
        return;
      }

      if (outcome.type === 'set-live-draft') {
        set({
          selectedClassId: outcome.selectedClassId,
          liveDraftClassId: outcome.liveDraftClassId,
        });
        return;
      }

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildApplyLastAnnotationClassSelectionPatch(
          s,
          outcome.selectedClassId,
          outcome.annotationId,
          classId
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    selectAnnotation: (annotationId) =>
      set(buildSingleAnnotationSelection(annotationId)),

    setAnnotationSelection: (annotationIds, latestId = null) => {
      set(buildNormalizedAnnotationSelection(annotationIds, latestId));
    },

    toggleAnnotationSelection: (annotationId) =>
      set((s) =>
        toggleAnnotationSelectionState(s.selectedAnnotationIds, annotationId)
      ),

    clearAnnotationSelection: () => set(buildSingleAnnotationSelection(null)),

    selectAllAnnotationsCurrentImage: () => {
      const state = get();
      const scope = resolveSelectedImageAnnotationScope(
        state.images,
        state.selectedImageId
      );
      if (!scope) return;
      const ids = scope.image.annotations.map((a) => a.id);
      set(buildNormalizedAnnotationSelection(ids, ids[ids.length - 1] ?? null));
    },
  };
}
