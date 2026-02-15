import { exportAllAnnotationsFromState, exportAnnotationsFromState } from './exportWorkflow';
import { downloadBlob } from './exportDataset';
import { createWorkspaceExportArchive } from './workspaceExport';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type ExportActionKeys =
  | 'exportClassesTxt'
  | 'exportAnnotations'
  | 'exportAllAnnotations'
  | 'exportWorkspaceState';

export function createExportActions(
  set: AppStoreSet,
  get: AppStoreGet,
  fallbackClassName: string
): Pick<AppState, ExportActionKeys> {
  return {
    exportClassesTxt: async () => {
      const state = get();
      const classNames = state.classes
        .filter((c) => !c.isDefault)
        .map((c) => c.name);
      const blob = new Blob([classNames.join('\n')], {
        type: 'text/plain;charset=utf-8',
      });
      downloadBlob(blob, 'classes.txt');
    },

    exportAnnotations: async (
      format,
      scope,
      includeFallback = false,
      namingOptions = { mode: 'sequential', baseName: 'image' },
      outputOptions = { convert: false, format: 'png' },
      includeImagesWithoutAnnotations = true,
      imageMetadataOptions = {
        includeOriginalName: false,
        sanitizeImageMetadata: false,
      }
    ) => {
      const result = await exportAnnotationsFromState(
        get(),
        format,
        scope,
        includeFallback,
        namingOptions,
        outputOptions,
        includeImagesWithoutAnnotations,
        imageMetadataOptions,
        fallbackClassName
      );
      if (result.statusText) {
        set({ statusText: result.statusText });
      }
    },

    exportAllAnnotations: async (
      scope,
      folderName,
      includeFallback = false,
      namingOptions = { mode: 'sequential', baseName: 'image' },
      outputOptions = { convert: false, format: 'png' },
      includeImagesWithoutAnnotations = true,
      imageMetadataOptions = {
        includeOriginalName: false,
        sanitizeImageMetadata: false,
      }
    ) => {
      const result = await exportAllAnnotationsFromState(
        get(),
        scope,
        folderName,
        includeFallback,
        namingOptions,
        outputOptions,
        includeImagesWithoutAnnotations,
        imageMetadataOptions,
        fallbackClassName
      );
      if (result.statusText) {
        set({ statusText: result.statusText });
      }
    },

    exportWorkspaceState: async () => {
      const state = get();
      const archive = await createWorkspaceExportArchive(state);
      if (!archive) return;
      downloadBlob(archive.blob, archive.fileName);
    },
  };
}
