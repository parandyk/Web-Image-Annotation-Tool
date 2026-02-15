import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../store/appStore';

type SettingsTabProps = {
  variant?: 'sidebar' | 'dialog';
};

export function SettingsTab({ variant = 'sidebar' }: SettingsTabProps): JSX.Element {
  const isDialogVariant = variant === 'dialog';
  const interactionMode = useAppStore((s) => s.interactionMode);
  const addingMode = useAppStore((s) => s.addingMode);
  const showLabels = useAppStore((s) => s.showLabels);
  const bboxOpacity = useAppStore((s) => s.bboxOpacity);
  const lineThickness = useAppStore((s) => s.lineThickness);
  const drawBoxFill = useAppStore((s) => s.drawBoxFill);
  const drawBoxBorder = useAppStore((s) => s.drawBoxBorder);
  const showCrosshair = useAppStore((s) => s.showCrosshair);
  const dragDeadzonePx = useAppStore((s) => s.dragDeadzonePx);
  const suppressUnassignedWarning = useAppStore((s) => s.suppressUnassignedExportWarningDialog);
  const exportIncludeUnassigned = useAppStore((s) => s.exportIncludeUnassigned);
  const suppressDeleteAnnotationWarning = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const suppressDeleteImageWarning = useAppStore((s) => s.suppressDeleteImageWarningDialog);
  const suppressRemoveClassInstancesWarning = useAppStore((s) => s.suppressRemoveClassInstancesWarningDialog);
  const images = useAppStore((s) => s.images);
  const selectedImageId = useAppStore((s) => s.selectedImageId);

  const setInteractionMode = useAppStore((s) => s.setInteractionMode);
  const setAddingMode = useAppStore((s) => s.setAddingMode);
  const setShowLabels = useAppStore((s) => s.setShowLabels);
  const setBBoxOpacity = useAppStore((s) => s.setBBoxOpacity);
  const setLineThickness = useAppStore((s) => s.setLineThickness);
  const setDrawBoxFill = useAppStore((s) => s.setDrawBoxFill);
  const setDrawBoxBorder = useAppStore((s) => s.setDrawBoxBorder);
  const setShowCrosshair = useAppStore((s) => s.setShowCrosshair);
  const setDragDeadzonePx = useAppStore((s) => s.setDragDeadzonePx);
  const setSuppressUnassigned = useAppStore((s) => s.setSuppressUnassignedExportWarningDialog);
  const setExportIncludeUnassigned = useAppStore((s) => s.setExportIncludeUnassigned);
  const setSuppressDeleteAnnotation = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteImage = useAppStore((s) => s.setSuppressDeleteImageWarningDialog);
  const setSuppressRemoveClassInstances = useAppStore((s) => s.setSuppressRemoveClassInstancesWarningDialog);
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
                checked={suppressUnassignedWarning}
                onChange={(e) => setSuppressUnassigned(e.target.checked)}
              />
              <span>Suppress unassigned export warning</span>
            </label>
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
