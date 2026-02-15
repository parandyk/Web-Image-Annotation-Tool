import {
  buildAppliedHistoryRestoreState,
  buildRedoRestorePatch,
  buildUndoRestorePatch,
} from './historyRestore';
import { revokeImageSources } from './imageSources';
import { restoreRecoverySnapshotPayload } from './workspaceRecoveryRestore';
import { buildRecoverySnapshotPayload } from './workspaceSerialization';
import { buildRecoveryWorkspacePatch } from './workspaceRestoreState';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type HistoryRecoveryActionKeys =
  | 'undo'
  | 'redo'
  | 'createRecoverySnapshot'
  | 'restoreRecoverySnapshot';

export function createHistoryRecoveryActions(
  set: AppStoreSet,
  get: AppStoreGet,
  fallbackClassName: string
): Pick<AppState, HistoryRecoveryActionKeys> {
  return {
    undo: () => {
      const state = get();
      const patch = buildUndoRestorePatch(state);
      if (!patch) return;

      set(buildAppliedHistoryRestoreState(patch));
    },

    redo: () => {
      const state = get();
      const patch = buildRedoRestorePatch(state);
      if (!patch) return;

      set(buildAppliedHistoryRestoreState(patch));
    },

    createRecoverySnapshot: () => {
      const state = get();
      const hasWorkspaceState =
        state.images.length > 0 || state.classes.some((c) => !c.isDefault);
      if (!hasWorkspaceState) return null;

      return buildRecoverySnapshotPayload(state);
    },

    restoreRecoverySnapshot: (snapshot) => {
      const restored = restoreRecoverySnapshotPayload(
        snapshot,
        fallbackClassName
      );
      if (!restored.ok) {
        set({ statusText: restored.statusText });
        return;
      }

      const state = get();
      revokeImageSources(state.images);
      set({
        ...buildRecoveryWorkspacePatch(restored),
        undoStack: [],
        redoStack: [],
        statusText: 'Recovered previous workspace state.',
      });
    },
  };
}
