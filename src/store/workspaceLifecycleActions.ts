import {
  resolveMultipleImageDeletions,
  resolveSingleImageDeletion,
} from './imageDeletion';
import { revokeImageSources, revokeObjectUrl } from './imageSources';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import {
  buildStateAfterClearingImages,
  buildStateAfterDeletingImages,
} from './workspaceLifecycle';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type WorkspaceLifecycleActionKeys =
  | 'deleteImage'
  | 'deleteImages'
  | 'closeAllImages'
  | 'clearWorkspace';

export function createWorkspaceLifecycleActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, WorkspaceLifecycleActionKeys> {
  return {
    deleteImage: (imageId) => {
      const state = get();
      const removed = resolveSingleImageDeletion(state.images, imageId);
      if (!removed) return;
      revokeObjectUrl(removed.src);

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildStateAfterDeletingImages(s, new Set([imageId])),
        ...pushUndoHistory(s, base),
      }));
    },

    deleteImages: (imageIds) => {
      const state = get();
      const resolved = resolveMultipleImageDeletions(state.images, imageIds);
      if (!resolved) return;
      revokeImageSources(resolved.deletedImages);

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildStateAfterDeletingImages(s, resolved.deletedIds),
        ...pushUndoHistory(s, base),
      }));
    },

    closeAllImages: () => {
      const state = get();
      if (state.images.length === 0) return;
      revokeImageSources(state.images);

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildStateAfterClearingImages('Closed all images.'),
        ...pushUndoHistory(s, base),
      }));
    },

    clearWorkspace: () => {
      const state = get();
      if (state.images.length === 0) return;
      revokeImageSources(state.images);

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildStateAfterClearingImages('Workspace cleared.'),
        ...pushUndoHistory(s, base),
      }));
    },
  };
}
