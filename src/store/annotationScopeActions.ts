import {
  resolveAnnotationToggleValue,
  resolveBookmarkedAnnotationImageIds,
  resolveSelectedImageAnnotationFlagValue,
} from './annotationScopeHelpers';
import {
  buildSetAnnotationsAnchoringPatch,
  buildSetAnnotationsVisibilityPatch,
  buildSetAnnotationsVisibilityReconciledPatch,
} from './annotationScopeTogglePatches';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type AnnotationScopeActionKeys =
  | 'toggleAllAnchoringCurrentImage'
  | 'setAllAnchoringCurrentImage'
  | 'setAllVisibilityCurrentImage'
  | 'toggleAllAnchoringGlobal'
  | 'toggleAllAnchoringBookmarked'
  | 'toggleAllVisibilityGlobal'
  | 'toggleAllVisibilityBookmarked';

export function createAnnotationScopeActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, AnnotationScopeActionKeys> {
  return {
    toggleAllAnchoringCurrentImage: () => {
      const state = get();
      const resolved = resolveSelectedImageAnnotationFlagValue(
        state.images,
        state.selectedImageId,
        'isAnchored',
        'toggle'
      );
      if (!resolved) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsAnchoringPatch(
          s,
          resolved.value,
          resolved.scope.targetImageIds
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    setAllAnchoringCurrentImage: (anchored) => {
      const state = get();
      const resolved = resolveSelectedImageAnnotationFlagValue(
        state.images,
        state.selectedImageId,
        'isAnchored',
        'set',
        anchored
      );
      if (!resolved) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsAnchoringPatch(
          s,
          resolved.value,
          resolved.scope.targetImageIds
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    setAllVisibilityCurrentImage: (visible) => {
      const state = get();
      const resolved = resolveSelectedImageAnnotationFlagValue(
        state.images,
        state.selectedImageId,
        'isVisible',
        'set',
        visible
      );
      if (!resolved) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsVisibilityPatch(
          s,
          resolved.value,
          resolved.scope.targetImageIds
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAllAnchoringGlobal: () => {
      const state = get();
      const nextAnchored = resolveAnnotationToggleValue(
        state.images,
        (annotation) => !annotation.isAnchored
      );
      if (nextAnchored === null) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsAnchoringPatch(s, nextAnchored),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAllAnchoringBookmarked: () => {
      const state = get();
      const bookmarkedImageIds = resolveBookmarkedAnnotationImageIds(
        state.images
      );
      if (!bookmarkedImageIds) return;
      const nextAnchored = resolveAnnotationToggleValue(
        state.images,
        (annotation) => !annotation.isAnchored,
        bookmarkedImageIds
      );
      if (nextAnchored === null) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsAnchoringPatch(s, nextAnchored, bookmarkedImageIds),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAllVisibilityGlobal: () => {
      const state = get();
      const nextVisible = resolveAnnotationToggleValue(
        state.images,
        (annotation) => !annotation.isVisible
      );
      if (nextVisible === null) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsVisibilityPatch(s, nextVisible),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleAllVisibilityBookmarked: () => {
      const state = get();
      const bookmarkedImageIds = resolveBookmarkedAnnotationImageIds(
        state.images
      );
      if (!bookmarkedImageIds) return;
      const nextVisible = resolveAnnotationToggleValue(
        state.images,
        (annotation) => !annotation.isVisible,
        bookmarkedImageIds
      );
      if (nextVisible === null) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetAnnotationsVisibilityReconciledPatch(
          s,
          nextVisible,
          bookmarkedImageIds
        ),
        ...pushUndoHistory(s, base),
      }));
    },
  };
}
