import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { InferenceDetection } from '../../domain/types';

export function InferencePanel(): JSX.Element {
  const inferenceEnabled = useAppStore((s) => s.inferenceEnabled);
  const inferenceConfidenceThreshold = useAppStore((s) => s.inferenceConfidenceThreshold);
  const inferenceBusy = useAppStore((s) => s.inferenceBusy);
  const selectedImageId = useAppStore((s) => s.selectedImageId);
  const EMPTY: InferenceDetection[] = [];

  const pendingDetections = useAppStore((s) =>
  s.selectedImageId ? (s.pendingDetectionsByImageId[s.selectedImageId] ?? EMPTY) : EMPTY);
  // const pendingDetections = useAppStore((s) =>
  //   s.selectedImageId ? (s.pendingDetectionsByImageId[s.selectedImageId] ?? []) : []
  // );
  const selectedDetectionIds = useAppStore((s) => s.selectedPendingDetectionIds);

  const setInferenceEnabled = useAppStore((s) => s.setInferenceEnabled);
  const setInferenceConfidenceThreshold = useAppStore((s) => s.setInferenceConfidenceThreshold);
  const setSelectedDetectionIds = useAppStore((s) => s.setSelectedPendingDetectionIds);
  const runInferenceCurrentImage = useAppStore((s) => s.runInferenceCurrentImage);
  const acceptDetection = useAppStore((s) => s.acceptDetection);
  const rejectDetections = useAppStore((s) => s.rejectDetections);
  const acceptAllDetectionsCurrentImage = useAppStore((s) => s.acceptAllDetectionsCurrentImage);
  const clearDetectionsCurrentImage = useAppStore((s) => s.clearDetectionsCurrentImage);

  const selectedDetectionIdsInImage = useMemo(() => {
    if (selectedDetectionIds.length === 0 || pendingDetections.length === 0) return [];
    const selectedSet = new Set(selectedDetectionIds);
    return pendingDetections.filter((det) => selectedSet.has(det.id)).map((det) => det.id);
  }, [pendingDetections, selectedDetectionIds]);

  const pendingInferenceCount = pendingDetections.length;

  return (
    <div className="panel-stack">
      <section>
        <span className="slider-meta">Model path/upload is configured in Settings dialog.</span>
        <label className="inline-check">
          <input type="checkbox" checked={inferenceEnabled} onChange={(e) => setInferenceEnabled(e.target.checked)} />
          <span>Enable model inference</span>
        </label>
        <label>
          Confidence threshold
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={inferenceConfidenceThreshold}
            onChange={(e) => setInferenceConfidenceThreshold(Number(e.target.value))}
          />
          <span className="slider-meta">
            Current: {inferenceConfidenceThreshold.toFixed(2)} | Min: 0.00 | Max: 1.00
          </span>
        </label>
        <div className="row">
          <button
            disabled={!inferenceEnabled || inferenceBusy || !selectedImageId}
            onClick={() => {
              void runInferenceCurrentImage();
            }}
          >
            {inferenceBusy ? 'Running inference...' : 'Run on selected image'}
          </button>
        </div>
        <div className="row">
          <button
            disabled={selectedDetectionIdsInImage.length === 0}
            onClick={() => {
              if (selectedDetectionIdsInImage.length === 0) return;
              for (const detectionId of selectedDetectionIdsInImage) {
                acceptDetection(detectionId);
              }
              setSelectedDetectionIds([]);
            }}
          >
            Accept selected
          </button>
          <button
            disabled={pendingInferenceCount === 0}
            onClick={() => {
              acceptAllDetectionsCurrentImage();
              setSelectedDetectionIds([]);
            }}
          >
            Accept all
          </button>
        </div>
        <div className="row">
          <button
            disabled={selectedDetectionIdsInImage.length === 0}
            onClick={() => {
              if (selectedDetectionIdsInImage.length === 0) return;
              rejectDetections(selectedDetectionIdsInImage);
              setSelectedDetectionIds([]);
            }}
          >
            Remove selected
          </button>
          <button
            disabled={pendingInferenceCount === 0}
            onClick={() => {
              clearDetectionsCurrentImage();
              setSelectedDetectionIds([]);
            }}
          >
            Clear all
          </button>
        </div>
        <span className="slider-meta">Pending detections (selected image): {pendingInferenceCount}</span>
      </section>
    </div>
  );
}
