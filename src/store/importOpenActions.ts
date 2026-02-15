import { parseDatasetImportPayload } from './datasetImport';
import { parseClassNamesFromText } from './classImport';
import { parseOpenImagesPayload } from './imageOpen';
import {
  buildAppendedImagesPatch,
  buildAppendedImagesWithDisplayHistoryPatch,
} from './imageAppendState';
import { revokeImageSources } from './imageSources';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import {
  loadWorkspaceImportPayload,
  parseWorkspaceImportPayload,
} from './workspaceImport';
import { parseOpenVideoFramesPayload } from './videoOpen';
import {
  buildImportedWorkspacePatch,
  formatWorkspaceImportStatus,
} from './workspaceRestoreState';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type ImportOpenActionKeys =
  | 'openImages'
  | 'openVideoFrames'
  | 'importDatasetFolder'
  | 'importWorkspaceState'
  | 'openClassFileText';

export function createImportOpenActions(
  set: AppStoreSet,
  get: AppStoreGet,
  fallbackClassName: string
): Pick<AppState, ImportOpenActionKeys> {
  return {
    openImages: async (files) => {
      const current = get();
      if (files.length === 0) return;
      const base = createSnapshotFromState(current);
      const parsed = await parseOpenImagesPayload(files, current.images);
      if (!parsed.ok) {
        set({ statusText: parsed.statusText });
        return;
      }

      set((state) => ({
        ...buildAppendedImagesWithDisplayHistoryPatch(
          state,
          base,
          parsed.images,
          parsed.statusText ? parsed.statusText : undefined
        ),
      }));
    },

    openVideoFrames: async (file, options) => {
      const current = get();
      if (!file) return;

      const base = createSnapshotFromState(current);

      set({ statusText: `Parsing video "${file.name}"...` });
      const parsed = await parseOpenVideoFramesPayload(
        file,
        options,
        current.images,
        (done, total) => {
          if (done === 1 || done === total || done % 10 === 0) {
            set({
              statusText: `Parsing video "${file.name}" (${done}/${total})...`,
            });
          }
        }
      );
      if (!parsed.ok) {
        set({ statusText: parsed.statusText });
        return;
      }

      set((state) => ({
        ...buildAppendedImagesWithDisplayHistoryPatch(
          state,
          base,
          parsed.images,
          parsed.statusText
        ),
      }));
    },

    importDatasetFolder: async (files) => {
      const state = get();
      if (files.length === 0) return;

      const base = createSnapshotFromState(state);
      const parsed = await parseDatasetImportPayload({
        files,
        existingClasses: state.classes,
        existingImages: state.images,
        selectedClassId: state.selectedClassId,
        nextDisplayIdByClass: state.nextDisplayIdByClass,
        fallbackClassName,
      });
      if (!parsed.ok) {
        set({ statusText: parsed.statusText });
        return;
      }

      set((s) => ({
        ...buildAppendedImagesPatch(s, parsed.images),
        classes: parsed.classes,
        selectedClassId: parsed.selectedClassId,
        nextDisplayIdByClass: parsed.nextDisplayIdByClass,
        ...pushUndoHistory(s, base),
        statusText: parsed.statusText,
      }));
    },

    importWorkspaceState: async (file) => {
      const state = get();
      if (!file) return;

      const base = createSnapshotFromState(state);
      const loaded = await loadWorkspaceImportPayload(file);
      if (!loaded.ok) {
        set({ statusText: loaded.statusText });
        return;
      }

      const parsed = await parseWorkspaceImportPayload(
        loaded.payload,
        loaded.zip,
        fallbackClassName
      );
      if (!parsed.ok) {
        set({ statusText: parsed.statusText });
        return;
      }

      revokeImageSources(state.images);
      set((s) => ({
        ...buildImportedWorkspacePatch(parsed),
        ...pushUndoHistory(s, base),
        statusText: formatWorkspaceImportStatus(
          parsed.importedImages.length,
          parsed.skippedImages,
          parsed.skippedAnnotations
        ),
      }));
    },

    openClassFileText: (content) => {
      const names = parseClassNamesFromText(content);

      for (const name of names) {
        get().addClass(name);
      }
    },
  };
}
