import { Annotation, InferenceDetection } from '../domain/types';
import { uid } from '../utils/id';
import { runModelInferenceOnImage } from '../utils/inference';
import { normalizeBBox } from './bboxMath';
import { getDefaultClassId, getNextDisplayIdForImage } from './classImageHelpers';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import { appendSelectedImageAnnotation } from './selectedImageAnnotations';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type InferenceActionKeys =
  | 'runInferenceCurrentImage'
  | 'acceptDetection'
  | 'rejectDetection'
  | 'rejectDetections'
  | 'acceptAllDetectionsCurrentImage'
  | 'clearDetectionsCurrentImage';

function withUpdatedImageDetections(
  map: Record<string, InferenceDetection[]>,
  imageId: string,
  detections: InferenceDetection[]
): Record<string, InferenceDetection[]> {
  const next = { ...map };
  if (detections.length === 0) {
    delete next[imageId];
  } else {
    next[imageId] = detections;
  }
  return next;
}

export function createInferenceActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, InferenceActionKeys> {
  return {
    runInferenceCurrentImage: async () => {
      const state = get();
      if (state.inferenceBusy) return;
      if (!state.inferenceEnabled) {
        set({ statusText: 'Inference is disabled. Enable it in Settings first.' });
        return;
      }
      if (!state.selectedImageId) {
        set({ statusText: 'Select an image before running inference.' });
        return;
      }

      const selectedImage = state.images.find((img) => img.id === state.selectedImageId);
      if (!selectedImage) {
        set({ statusText: 'Selected image is unavailable.' });
        return;
      }

      const modelUrl = state.inferenceModelUrl.trim();
      if (!modelUrl) {
        set({ statusText: 'Configure a model URL/path in Settings before running inference.' });
        return;
      }

      const targetImageId = selectedImage.id;
      set({
        inferenceBusy: true,
        statusText: `Running inference on "${selectedImage.name}"...`,
      });

      try {
        const result = await runModelInferenceOnImage(selectedImage.file, {
          modelUrl,
          confidenceThreshold: state.inferenceConfidenceThreshold,
          classCountHint: state.classes.length,
        });

        set((s) => {
          if (!s.images.some((img) => img.id === targetImageId)) {
            return {
              inferenceBusy: false,
              statusText: 'Inference finished, but the target image is no longer open.',
            };
          }

          const fallbackClassId = getDefaultClassId(s.classes, s.selectedClassId);
          const detections: InferenceDetection[] = result.detections
            .map((det) => {
              const bbox = normalizeBBox(det.bbox, selectedImage.width, selectedImage.height);
              if (bbox.width < 1 || bbox.height < 1) return null;
              // Proposal-only mode: inferred boxes start as fallback/unassigned.
              const classId = fallbackClassId;
              return {
                id: uid('det'),
                classId,
                classIndex: det.classIndex,
                score: det.score,
                bbox,
              } satisfies InferenceDetection;
            })
            .filter((det): det is InferenceDetection => Boolean(det));

          const base = createSnapshotFromState(s);

          return {
            inferenceBusy: false,
            pendingDetectionsByImageId: withUpdatedImageDetections(s.pendingDetectionsByImageId, targetImageId, detections),
            ...pushUndoHistory(s, base),
            statusText:
              detections.length > 0
                ? `Inference found ${detections.length} detection${detections.length === 1 ? '' : 's'} in ${Math.round(result.durationMs)} ms.`
                : `Inference found no detections above threshold (${s.inferenceConfidenceThreshold.toFixed(2)}).`,
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown inference error.';
        set({
          inferenceBusy: false,
          statusText: `Inference failed: ${message}`,
        });
      }
    },

    acceptDetection: (detectionId) => {
      const state = get();
      const imageId = state.selectedImageId;
      if (!imageId) return;
      const selectedImage = state.images.find((img) => img.id === imageId);
      if (!selectedImage) return;

      const pending = state.pendingDetectionsByImageId[imageId] ?? [];
      const detection = pending.find((det) => det.id === detectionId);
      if (!detection) return;

      const fallbackClassId = getDefaultClassId(state.classes, state.selectedClassId);
      const classId = state.classes.some((cls) => cls.id === detection.classId) ? detection.classId : fallbackClassId;
      const bbox = normalizeBBox(detection.bbox, selectedImage.width, selectedImage.height);
      if (bbox.width < 1 || bbox.height < 1) return;

      const displayId = getNextDisplayIdForImage(state.nextDisplayIdByClass, state.images, imageId);
      const defaultAnchored = Boolean(state.classes.find((cls) => cls.id === classId)?.defaultAnchored);
      const annotation: Annotation = {
        id: uid('ann'),
        classId,
        bbox,
        isVisible: true,
        isAnchored: defaultAnchored,
        displayId,
      };

      const base = createSnapshotFromState(state);
      set((s) => {
        const remaining = (s.pendingDetectionsByImageId[imageId] ?? []).filter((det) => det.id !== detectionId);
        return {
          images: appendSelectedImageAnnotation(s.images, s.selectedImageId, annotation),
          selectedAnnotationId: annotation.id,
          selectedAnnotationIds: [annotation.id],
          nextDisplayIdByClass: {
            ...s.nextDisplayIdByClass,
            [imageId]: displayId + 1,
          },
          pendingDetectionsByImageId: withUpdatedImageDetections(s.pendingDetectionsByImageId, imageId, remaining),
          ...pushUndoHistory(s, base),
          statusText: 'Accepted one inference detection.',
        };
      });
    },

    rejectDetection: (detectionId) => {
      get().rejectDetections([detectionId]);
    },

    rejectDetections: (detectionIds) => {
      const state = get();
      const imageId = state.selectedImageId;
      if (!imageId) return;
      const pending = state.pendingDetectionsByImageId[imageId] ?? [];
      if (pending.length === 0 || detectionIds.length === 0) return;
      const targetIds = new Set(detectionIds);
      const removedCount = pending.reduce((count, det) => (targetIds.has(det.id) ? count + 1 : count), 0);
      if (removedCount === 0) return;
      const base = createSnapshotFromState(state);
      set((s) => {
        const remaining = (s.pendingDetectionsByImageId[imageId] ?? []).filter((det) => !targetIds.has(det.id));
        return {
          pendingDetectionsByImageId: withUpdatedImageDetections(s.pendingDetectionsByImageId, imageId, remaining),
          ...pushUndoHistory(s, base),
          statusText: `Removed ${removedCount} inferred suggestion${removedCount === 1 ? '' : 's'}.`,
        };
      });
    },

    acceptAllDetectionsCurrentImage: () => {
      const state = get();
      const imageId = state.selectedImageId;
      if (!imageId) return;
      const selectedImage = state.images.find((img) => img.id === imageId);
      if (!selectedImage) return;
      const pending = state.pendingDetectionsByImageId[imageId] ?? [];
      if (pending.length === 0) return;

      const fallbackClassId = getDefaultClassId(state.classes, state.selectedClassId);
      let nextDisplayId = getNextDisplayIdForImage(state.nextDisplayIdByClass, state.images, imageId);
      const annotations: Annotation[] = [];

      for (const detection of pending) {
        const classId = state.classes.some((cls) => cls.id === detection.classId) ? detection.classId : fallbackClassId;
        const bbox = normalizeBBox(detection.bbox, selectedImage.width, selectedImage.height);
        if (bbox.width < 1 || bbox.height < 1) continue;
        const defaultAnchored = Boolean(state.classes.find((cls) => cls.id === classId)?.defaultAnchored);
        annotations.push({
          id: uid('ann'),
          classId,
          bbox,
          isVisible: true,
          isAnchored: defaultAnchored,
          displayId: nextDisplayId,
        });
        nextDisplayId += 1;
      }

      if (annotations.length === 0) {
        const base = createSnapshotFromState(state);
        set((s) => ({
          pendingDetectionsByImageId: withUpdatedImageDetections(s.pendingDetectionsByImageId, imageId, []),
          ...pushUndoHistory(s, base),
          statusText: 'No valid detections remained to accept.',
        }));
        return;
      }

      const base = createSnapshotFromState(state);
      const lastAnnotationId = annotations[annotations.length - 1]?.id ?? null;
      set((s) => ({
        images: s.images.map((img) =>
          img.id === imageId
            ? {
                ...img,
                annotations: [...img.annotations, ...annotations],
              }
            : img
        ),
        selectedAnnotationId: lastAnnotationId,
        selectedAnnotationIds: lastAnnotationId ? [lastAnnotationId] : [],
        nextDisplayIdByClass: {
          ...s.nextDisplayIdByClass,
          [imageId]: nextDisplayId,
        },
        pendingDetectionsByImageId: withUpdatedImageDetections(s.pendingDetectionsByImageId, imageId, []),
        ...pushUndoHistory(s, base),
        statusText: `Accepted ${annotations.length} inference detection${annotations.length === 1 ? '' : 's'}.`,
      }));
    },

    clearDetectionsCurrentImage: () => {
      const state = get();
      const imageId = state.selectedImageId;
      if (!imageId) return;
      const pending = state.pendingDetectionsByImageId[imageId] ?? [];
      if (pending.length === 0) return;
      const base = createSnapshotFromState(state);
      set((s) => ({
        pendingDetectionsByImageId: withUpdatedImageDetections(s.pendingDetectionsByImageId, imageId, []),
        ...pushUndoHistory(s, base),
        statusText: `Cleared ${pending.length} pending inference detection${pending.length === 1 ? '' : 's'} for the selected image.`,
      }));
    },
  };
}
