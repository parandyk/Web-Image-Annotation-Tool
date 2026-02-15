import type { AppState } from './appStore.types';
import { toViewStateSnapshot } from './viewState';
import { WorkspaceRecoverySnapshot } from '../utils/workspaceRecovery';
import type { ViewState } from './viewState';

type WorkspaceSerializableState = ViewState &
  Pick<
  AppState,
  | 'classes'
  | 'images'
  | 'selectedClassId'
  | 'selectedImageId'
  | 'selectedAnnotationId'
  | 'selectedAnnotationIds'
  | 'nextDisplayIdByClass'
>;

export function buildRecoverySnapshotPayload(
  state: WorkspaceSerializableState
): WorkspaceRecoverySnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    settings: toViewStateSnapshot(state),
    classes: state.classes.map((c) => ({ ...c })),
    images: state.images.map((img) => ({
      id: img.id,
      name: img.name,
      file: img.file,
      width: img.width,
      height: img.height,
      isBookmarked: img.isBookmarked,
      sourceKind: img.sourceKind,
      videoMeta: img.videoMeta ? { ...img.videoMeta } : undefined,
      annotations: img.annotations.map((ann) => ({
        ...ann,
        bbox: { ...ann.bbox },
      })),
    })),
    selectedClassId: state.selectedClassId,
    selectedImageId: state.selectedImageId,
    selectedAnnotationId: state.selectedAnnotationId,
    selectedAnnotationIds: [...state.selectedAnnotationIds],
    nextDisplayIdByClass: { ...state.nextDisplayIdByClass },
  };
}

export function buildWorkspaceExportPayload(
  state: WorkspaceSerializableState,
  imageFileNameById: Record<string, string>
): Record<string, unknown> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: toViewStateSnapshot(state),
    selection: {
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: state.selectedAnnotationIds,
    },
    classes: state.classes.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isVisible: c.isVisible,
      defaultAnchored: Boolean(c.defaultAnchored),
      isDefault: Boolean(c.isDefault),
      hotkey: c.hotkey ?? null,
    })),
    images: state.images.map((img) => ({
      id: img.id,
      name: img.name,
      fileName: imageFileNameById[img.id] ?? img.name,
      isBookmarked: img.isBookmarked,
      sourceKind: img.sourceKind ?? 'image',
      videoMeta: img.videoMeta
        ? {
            videoId: img.videoMeta.videoId,
            videoName: img.videoMeta.videoName,
            sourceFps: img.videoMeta.sourceFps,
            sourceDurationMs: img.videoMeta.sourceDurationMs,
            frameIndex: img.videoMeta.frameIndex,
            timestampMs: img.videoMeta.timestampMs,
          }
        : null,
      width: img.width,
      height: img.height,
      annotations: img.annotations.map((ann) => ({
        id: ann.id,
        classId: ann.classId,
        bbox: { ...ann.bbox },
        isVisible: ann.isVisible,
        isAnchored: ann.isAnchored,
        displayId: ann.displayId,
      })),
    })),
    nextDisplayIdByClass: { ...state.nextDisplayIdByClass },
  };
}
