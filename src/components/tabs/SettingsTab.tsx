import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import type { MinimapLocation } from '../../domain/types';

type SettingsTabProps = {
  variant?: 'sidebar' | 'dialog';
};

const MAX_ONNX_UPLOAD_BYTES = 100 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function SettingsTab({ variant = 'sidebar' }: SettingsTabProps): JSX.Element {
  const isDialogVariant = variant === 'dialog';
  const interactionMode = useAppStore((s) => s.interactionMode);
  const addingMode = useAppStore((s) => s.addingMode);
  const classAssignmentMode = useAppStore((s) => s.classAssignmentMode);
  const fastClassSwapMode = useAppStore((s) => s.fastClassSwapMode);
  const showLabels = useAppStore((s) => s.showLabels);
  const bboxOpacity = useAppStore((s) => s.bboxOpacity);
  const lineThickness = useAppStore((s) => s.lineThickness);
  const drawBoxFill = useAppStore((s) => s.drawBoxFill);
  const drawBoxBorder = useAppStore((s) => s.drawBoxBorder);
  const showCrosshair = useAppStore((s) => s.showCrosshair);
  const showMinimap = useAppStore((s) => s.showMinimap);
  const minimapLocation = useAppStore((s) => s.minimapLocation);
  const dragDeadzonePx = useAppStore((s) => s.dragDeadzonePx);
  const inferenceModelUrl = useAppStore((s) => s.inferenceModelUrl);
  const exportIncludeUnassigned = useAppStore((s) => s.exportIncludeUnassigned);
  const suppressDeleteAnnotationWarning = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const suppressDeleteImageWarning = useAppStore((s) => s.suppressDeleteImageWarningDialog);
  const suppressRemoveClassInstancesWarning = useAppStore((s) => s.suppressRemoveClassInstancesWarningDialog);
  const images = useAppStore((s) => s.images);
  const selectedImageId = useAppStore((s) => s.selectedImageId);

  const setInteractionMode = useAppStore((s) => s.setInteractionMode);
  const setAddingMode = useAppStore((s) => s.setAddingMode);
  const setClassAssignmentMode = useAppStore((s) => s.setClassAssignmentMode);
  const setFastClassSwapMode = useAppStore((s) => s.setFastClassSwapMode);
  const setShowLabels = useAppStore((s) => s.setShowLabels);
  const setBBoxOpacity = useAppStore((s) => s.setBBoxOpacity);
  const setLineThickness = useAppStore((s) => s.setLineThickness);
  const setDrawBoxFill = useAppStore((s) => s.setDrawBoxFill);
  const setDrawBoxBorder = useAppStore((s) => s.setDrawBoxBorder);
  const setShowCrosshair = useAppStore((s) => s.setShowCrosshair);
  const setShowMinimap = useAppStore((s) => s.setShowMinimap);
  const setMinimapLocation = useAppStore((s) => s.setMinimapLocation);
  const setDragDeadzonePx = useAppStore((s) => s.setDragDeadzonePx);
  const setInferenceModelUrl = useAppStore((s) => s.setInferenceModelUrl);
  const setExportIncludeUnassigned = useAppStore((s) => s.setExportIncludeUnassigned);
  const setSuppressDeleteAnnotation = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteImage = useAppStore((s) => s.setSuppressDeleteImageWarningDialog);
  const setSuppressRemoveClassInstances = useAppStore((s) => s.setSuppressRemoveClassInstancesWarningDialog);
  const setStatusText = useAppStore((s) => s.setStatusText);
  const setAllAnchoringCurrentImage = useAppStore((s) => s.setAllAnchoringCurrentImage);
  const setAllVisibilityCurrentImage = useAppStore((s) => s.setAllVisibilityCurrentImage);

  const selectedImage = useMemo(
    () => images.find((img) => img.id === selectedImageId) ?? null,
    [images, selectedImageId]
  );
  const anns = selectedImage?.annotations ?? [];
  const hasAnns = anns.length > 0;
  const someAnchored = anns.some((a) => a.isAnchored);
  const someUnanchored = anns.some((a) => !a.isAnchored);
  const allAnchored = hasAnns && someAnchored && !someUnanchored;
  const mixedAnchored = hasAnns && someAnchored && someUnanchored;
  const someVisible = anns.some((a) => a.isVisible);
  const someHidden = anns.some((a) => !a.isVisible);
  const allVisible = hasAnns && someVisible && !someHidden;
  const mixedVisible = hasAnns && someVisible && someHidden;

  const anchorRef = useRef<HTMLInputElement | null>(null);
  const visibilityRef = useRef<HTMLInputElement | null>(null);
  const uploadModelInputRef = useRef<HTMLInputElement | null>(null);
  const lastAnchorBulkRef = useRef(false);
  const lastVisibilityBulkRef = useRef(true);

  // Tri-state checkboxes use `indeterminate` and remember last bulk choice for mixed state toggles.
  useEffect(() => {
    if (!anchorRef.current) return;
    anchorRef.current.indeterminate = mixedAnchored;
    if (!mixedAnchored) {
      lastAnchorBulkRef.current = allAnchored;
    }
  }, [allAnchored, mixedAnchored]);

  useEffect(() => {
    if (!visibilityRef.current) return;
    visibilityRef.current.indeterminate = mixedVisible;
    if (!mixedVisible) {
      lastVisibilityBulkRef.current = allVisible;
    }
  }, [allVisible, mixedVisible]);

  const onToggleAllAnchoring = (): void => {
    if (!hasAnns) return;
    // Mixed state resolves by flipping last explicit bulk decision.
    const target = mixedAnchored ? !lastAnchorBulkRef.current : !allAnchored;
    setAllAnchoringCurrentImage(target);
    lastAnchorBulkRef.current = target;
  };

  const onToggleAllVisibility = (): void => {
    if (!hasAnns) return;
    const target = mixedVisible ? !lastVisibilityBulkRef.current : !allVisible;
    setAllVisibilityCurrentImage(target);
    lastVisibilityBulkRef.current = target;
  };

  const minimapLocationOptions: Array<{ value: MinimapLocation; label: string }> = [
    { value: 'topLeft', label: 'Top left' },
    { value: 'topRight', label: 'Top right' },
    { value: 'bottomLeft', label: 'Bottom left' },
    { value: 'bottomRight', label: 'Bottom right' },
    { value: 'sidebar', label: 'Sidebar (general tab)' },
  ];

  const onUploadInferenceModel = (file: File): void => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.onnx')) {
      setStatusText('Inference model upload failed: select a .onnx file.');
      return;
    }
    if (file.size > MAX_ONNX_UPLOAD_BYTES) {
      setStatusText(
        `Inference model upload failed: "${file.name}" is ${formatBytes(file.size)} (max ${formatBytes(MAX_ONNX_UPLOAD_BYTES)}).`
      );
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setInferenceModelUrl(objectUrl);
    setStatusText(`Loaded ONNX model "${file.name}" (${formatBytes(file.size)}).`);
  };

  return (
    <div className="panel-stack">
      <section>
        <h4>Application mode</h4>
        <div className="row">
          <button className={interactionMode === 'add' ? 'active' : ''} onClick={() => setInteractionMode('add')}>
            Add
          </button>
          <button className={interactionMode === 'edit' ? 'active' : ''} onClick={() => setInteractionMode('edit')}>
            Edit
          </button>
        </div>
      </section>

      <section>
        <h4>Adding mode</h4>
        <div className="row">
          <button className={addingMode === 'click' ? 'active' : ''} onClick={() => setAddingMode('click')}>
            Click-Click
          </button>
          <button className={addingMode === 'drag' ? 'active' : ''} onClick={() => setAddingMode('drag')}>
            Drag
          </button>
        </div>
      </section>

      <section>
        <h4>Classes</h4>
        <label className="inline-check">
          <input type="checkbox" checked={fastClassSwapMode} onChange={(e) => setFastClassSwapMode(e.target.checked)} />
          <span>Fast class swap mode</span>
        </label>
        <span className="slider-meta">Edit mode: click class names or use class hotkeys to reassign selected annotations.</span>
      </section>

      {isDialogVariant && (
        <section>
          <h4>Class assignment</h4>
          <div className="row">
            <button
              className={classAssignmentMode === 'activeClass' ? 'active' : ''}
              onClick={() => setClassAssignmentMode('activeClass')}
            >
              Active class
            </button>
            <button
              className={classAssignmentMode === 'deferred' ? 'active' : ''}
              onClick={() => setClassAssignmentMode('deferred')}
            >
              Deferred
            </button>
          </div>
        </section>
      )}

      <section>
        <h4>Rendering</h4>
        <label className="inline-check">
          <input
            ref={visibilityRef}
            type="checkbox"
            checked={allVisible}
            disabled={!hasAnns}
            onChange={onToggleAllVisibility}
          />
          <span>All annotations visible (selected image)</span>
        </label>
        <label className="inline-check">
          <input
            ref={anchorRef}
            type="checkbox"
            checked={allAnchored}
            disabled={!hasAnns}
            onChange={onToggleAllAnchoring}
          />
          <span>All annotations anchored (selected image)</span>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          <span>Show labels</span>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={drawBoxFill} onChange={(e) => setDrawBoxFill(e.target.checked)} />
          <span>Draw box backgrounds</span>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={drawBoxBorder} onChange={(e) => setDrawBoxBorder(e.target.checked)} />
          <span>Draw box borders</span>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={showCrosshair} onChange={(e) => setShowCrosshair(e.target.checked)} />
          <span>Show crosshair</span>
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={showMinimap} onChange={(e) => setShowMinimap(e.target.checked)} />
          <span>Show minimap</span>
        </label>
        <label>
          Annotation background opacity
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={bboxOpacity}
            onChange={(e) => setBBoxOpacity(Number(e.target.value))}
          />
          <span className="slider-meta">
            Current: {bboxOpacity.toFixed(2)} | Min: 0.00 | Max: 1.00
          </span>
        </label>
        {isDialogVariant && (
          <>
            <label>
              Annotation border thickness
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={lineThickness}
                onChange={(e) => setLineThickness(Number(e.target.value))}
              />
              <span className="slider-meta">
                Current: {lineThickness} | Min: 1 | Max: 8
              </span>
            </label>
            <label>
              Drag deadzone (px)
              <input
                type="range"
                min={0}
                max={16}
                step={1}
                value={dragDeadzonePx}
                onChange={(e) => setDragDeadzonePx(Number(e.target.value))}
              />
              <span className="slider-meta">
                Current: {dragDeadzonePx} | Min: 0 | Max: 16
              </span>
            </label>
          </>
        )}
      </section>

      {isDialogVariant && (
        <>
          <section>
            <h4>Inference model</h4>
            <span className="slider-meta">Default local model path: /models/yolo26n.onnx</span>
            <span className="slider-meta">Maximum uploaded model size: {formatBytes(MAX_ONNX_UPLOAD_BYTES)}</span>
            <label>
              Model URL/path
              <input
                type="text"
                value={inferenceModelUrl}
                placeholder="/models/yolo26n.onnx"
                onChange={(e) => setInferenceModelUrl(e.target.value)}
              />
            </label>
            <span className="slider-meta">
              Source: {inferenceModelUrl.startsWith('blob:') ? 'Uploaded ONNX (session-local URL)' : 'Path/URL'}
            </span>
            <div className="row wrap">
              <button onClick={() => uploadModelInputRef.current?.click()}>Upload ONNX model</button>
              <button
                disabled={!inferenceModelUrl.startsWith('blob:')}
                onClick={() => {
                  setInferenceModelUrl('/models/yolo26n.onnx');
                  setStatusText('Cleared uploaded inference model. Using default local model path.');
                }}
              >
                Clear uploaded model
              </button>
              <input
                ref={uploadModelInputRef}
                data-testid="inference-model-upload-input"
                type="file"
                accept=".onnx,application/octet-stream"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) onUploadInferenceModel(file);
                  e.currentTarget.value = '';
                }}
              />
            </div>
          </section>

          <section>
            <h4>Minimap</h4>
            <label>
              Location
              <select
                value={minimapLocation}
                onChange={(e) => setMinimapLocation(e.target.value as MinimapLocation)}
              >
                {minimapLocationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section>
            <h4>Export</h4>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={exportIncludeUnassigned}
                onChange={(e) => setExportIncludeUnassigned(e.target.checked)}
              />
              <span>Export unassigned class</span>
            </label>
          </section>

          <section>
            <h4>Notifications</h4>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={suppressDeleteAnnotationWarning}
                onChange={(e) => setSuppressDeleteAnnotation(e.target.checked)}
              />
              <span>Suppress delete annotation warning</span>
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={suppressDeleteImageWarning}
                onChange={(e) => setSuppressDeleteImage(e.target.checked)}
              />
              <span>Suppress delete image warning</span>
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={suppressRemoveClassInstancesWarning}
                onChange={(e) => setSuppressRemoveClassInstances(e.target.checked)}
              />
              <span>Suppress remove class instances warning</span>
            </label>
          </section>
        </>
      )}
    </div>
  );
}
