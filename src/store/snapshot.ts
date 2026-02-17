import { ClassData, ImageItem, InferenceDetection } from '../domain/types';

export type Snapshot = {
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds?: string[];
  nextDisplayIdByClass: Record<string, number>;
  pendingDetectionsByImageId: Record<string, InferenceDetection[]>;
};

type HistoryState = {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
};

type SnapshotSource = {
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds?: string[];
  nextDisplayIdByClass: Record<string, number>;
  pendingDetectionsByImageId: Record<string, InferenceDetection[]>;
};

export function createSnapshotFromState(source: SnapshotSource): Snapshot {
  return {
    classes: source.classes,
    images: source.images,
    selectedClassId: source.selectedClassId,
    selectedImageId: source.selectedImageId,
    selectedAnnotationId: source.selectedAnnotationId,
    selectedAnnotationIds: [
      ...(source.selectedAnnotationIds ?? (source.selectedAnnotationId ? [source.selectedAnnotationId] : [])),
    ],
    nextDisplayIdByClass: source.nextDisplayIdByClass,
    pendingDetectionsByImageId: source.pendingDetectionsByImageId,
  };
}

// Snapshot payload is the source of truth for undo/redo transitions.
export function cloneSnapshot(s: Snapshot): Snapshot {
  return {
    classes: s.classes.map((c) => ({ ...c })),
    images: s.images.map((img) => ({
      ...img,
      // Keep snapshots file-backed and URL-free so undo/redo doesn't pin many blob URLs.
      src: '',
      videoMeta: img.videoMeta ? { ...img.videoMeta } : undefined,
      annotations: img.annotations.map((a) => ({
        ...a,
        bbox: { ...a.bbox },
      })),
    })),
    selectedClassId: s.selectedClassId,
    selectedImageId: s.selectedImageId,
    selectedAnnotationId: s.selectedAnnotationId,
    selectedAnnotationIds: [...(s.selectedAnnotationIds ?? (s.selectedAnnotationId ? [s.selectedAnnotationId] : []))],
    nextDisplayIdByClass: { ...s.nextDisplayIdByClass },
    pendingDetectionsByImageId: Object.fromEntries(
      Object.entries(s.pendingDetectionsByImageId ?? {}).map(([imageId, detections]) => [
        imageId,
        detections.map((det) => ({
          ...det,
          bbox: { ...det.bbox },
        })),
      ])
    ),
  };
}

export function pushUndoHistory(state: HistoryState, base: Snapshot): HistoryState {
  return {
    undoStack: [...state.undoStack, cloneSnapshot(base)],
    redoStack: [],
  };
}
