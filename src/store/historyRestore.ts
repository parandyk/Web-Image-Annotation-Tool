import { ImageItem } from '../domain/types';
import { Snapshot, cloneSnapshot, createSnapshotFromState } from './snapshot';
import { reconcileImageSourcesForSelection, revokeImageSources } from './imageSources';

type HistoryState = {
  classes: Snapshot['classes'];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  nextDisplayIdByClass: Record<string, number>;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
};

type HistoryRestorePatch = {
  restored: Snapshot;
  images: ImageItem[];
  liveDraftBBox: null;
  liveDraftClassId: null;
  deferredLastAnnotationId: null;
  deferredLastImageId: null;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
};

type HistoryAppliedState = Snapshot & {
  images: ImageItem[];
  liveDraftBBox: null;
  liveDraftClassId: null;
  deferredLastAnnotationId: null;
  deferredLastImageId: null;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
};

export function buildUndoRestorePatch(state: HistoryState): HistoryRestorePatch | null {
  if (state.undoStack.length === 0) return null;
  const current = createSnapshotFromState(state);
  const previous = state.undoStack[state.undoStack.length - 1];
  const trimmedUndo = state.undoStack.slice(0, -1);
  const restored = cloneSnapshot(previous);
  revokeImageSources(state.images);
  const hydratedImages = reconcileImageSourcesForSelection(restored.images, restored.selectedImageId);

  return {
    restored,
    images: hydratedImages,
    liveDraftBBox: null,
    liveDraftClassId: null,
    deferredLastAnnotationId: null,
    deferredLastImageId: null,
    undoStack: trimmedUndo,
    redoStack: [...state.redoStack, cloneSnapshot(current)],
  };
}

export function buildRedoRestorePatch(state: HistoryState): HistoryRestorePatch | null {
  if (state.redoStack.length === 0) return null;
  const current = createSnapshotFromState(state);
  const next = state.redoStack[state.redoStack.length - 1];
  const trimmedRedo = state.redoStack.slice(0, -1);
  const restored = cloneSnapshot(next);
  revokeImageSources(state.images);
  const hydratedImages = reconcileImageSourcesForSelection(restored.images, restored.selectedImageId);

  return {
    restored,
    images: hydratedImages,
    liveDraftBBox: null,
    liveDraftClassId: null,
    deferredLastAnnotationId: null,
    deferredLastImageId: null,
    redoStack: trimmedRedo,
    undoStack: [...state.undoStack, cloneSnapshot(current)],
  };
}

export function buildAppliedHistoryRestoreState(
  patch: HistoryRestorePatch
): HistoryAppliedState {
  return {
    ...patch.restored,
    images: patch.images,
    liveDraftBBox: patch.liveDraftBBox,
    liveDraftClassId: patch.liveDraftClassId,
    deferredLastAnnotationId: patch.deferredLastAnnotationId,
    deferredLastImageId: patch.deferredLastImageId,
    undoStack: patch.undoStack,
    redoStack: patch.redoStack,
  };
}
