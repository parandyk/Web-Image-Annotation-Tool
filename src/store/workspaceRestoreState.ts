import type { AppState } from './appStore.types';
import type { ViewState } from './viewState';
import { reconcileImageSourcesForSelection } from './imageSources';

type WorkspaceImportSuccessLike = {
  importedView: ViewState;
  importedClasses: AppState['classes'];
  importedImages: AppState['images'];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  nextDisplayIdByClass: Record<string, number>;
  skippedImages: number;
  skippedAnnotations: number;
};

type RecoveryRestoreSuccessLike = {
  settings: ViewState;
  classes: AppState['classes'];
  images: AppState['images'];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  nextDisplayIdByClass: Record<string, number>;
};

type RestoredWorkspacePatch = ViewState &
  Pick<
    AppState,
    | 'classes'
    | 'images'
    | 'selectedClassId'
    | 'selectedImageId'
    | 'selectedAnnotationId'
    | 'selectedAnnotationIds'
    | 'liveDraftBBox'
    | 'liveDraftClassId'
    | 'deferredLastAnnotationId'
    | 'deferredLastImageId'
    | 'nextDisplayIdByClass'
  >;

export function formatWorkspaceImportStatus(
  importedImageCount: number,
  skippedImages: number,
  skippedAnnotations: number
): string {
  return `Imported workspace state: ${importedImageCount} images${skippedImages > 0 ? `, ${skippedImages} skipped` : ''}${skippedAnnotations > 0 ? `, ${skippedAnnotations} annotations skipped` : ''}.`;
}

export function buildImportedWorkspacePatch(
  parsed: WorkspaceImportSuccessLike
): RestoredWorkspacePatch {
  return {
    ...parsed.importedView,
    classes: parsed.importedClasses,
    images: reconcileImageSourcesForSelection(parsed.importedImages, parsed.selectedImageId),
    selectedClassId: parsed.selectedClassId,
    selectedImageId: parsed.selectedImageId,
    selectedAnnotationId: parsed.selectedAnnotationId,
    selectedAnnotationIds: parsed.selectedAnnotationIds,
    liveDraftBBox: null,
    liveDraftClassId: null,
    deferredLastAnnotationId: null,
    deferredLastImageId: null,
    nextDisplayIdByClass: parsed.nextDisplayIdByClass,
  };
}

export function buildRecoveryWorkspacePatch(
  restored: RecoveryRestoreSuccessLike
): RestoredWorkspacePatch {
  return {
    ...restored.settings,
    classes: restored.classes,
    images: reconcileImageSourcesForSelection(restored.images, restored.selectedImageId),
    selectedClassId: restored.selectedClassId,
    selectedImageId: restored.selectedImageId,
    selectedAnnotationId: restored.selectedAnnotationId,
    selectedAnnotationIds: restored.selectedAnnotationIds,
    liveDraftBBox: null,
    liveDraftClassId: null,
    deferredLastAnnotationId: null,
    deferredLastImageId: null,
    nextDisplayIdByClass: restored.nextDisplayIdByClass,
  };
}

