import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { pickImageFiles, pickSingleTextLikeFile } from '../utils/files';
import { SettingsTab } from './tabs/SettingsTab';

type MenuId = 'file' | 'export' | 'edit';

export function TopBar(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState<Record<string, boolean | number | string> | null>(null);
  const [pendingExport, setPendingExport] = useState<{ format: 'yolo' | 'coco'; global: boolean } | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const buttonRefs = useRef<Record<MenuId, HTMLButtonElement | null>>({
    file: null,
    export: null,
    edit: null,
  });
  const popoverRefs = useRef<Record<MenuId, HTMLDivElement | null>>({
    file: null,
    export: null,
    edit: null,
  });
  const openImages = useAppStore((s) => s.openImages);
  const openClassFileText = useAppStore((s) => s.openClassFileText);
  const exportClassesTxt = useAppStore((s) => s.exportClassesTxt);
  const exportAnnotations = useAppStore((s) => s.exportAnnotations);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const removeAllBBoxes = useAppStore((s) => s.removeAllBBoxes);
  const removeAllBBoxesGlobal = useAppStore((s) => s.removeAllBBoxesGlobal);
  const removeLastBBox = useAppStore((s) => s.removeLastBBox);
  const toggleAllAnchoringCurrentImage = useAppStore((s) => s.toggleAllAnchoringCurrentImage);
  const toggleAllVisibilityGlobal = useAppStore((s) => s.toggleAllVisibilityGlobal);
  const images = useAppStore((s) => s.images);
  const interactionMode = useAppStore((s) => s.interactionMode);
  const addingMode = useAppStore((s) => s.addingMode);
  const showLabels = useAppStore((s) => s.showLabels);
  const showOnlySelectedThumbs = useAppStore((s) => s.showOnlySelectedThumbs);
  const bboxOpacity = useAppStore((s) => s.bboxOpacity);
  const lineThickness = useAppStore((s) => s.lineThickness);
  const drawBoxFill = useAppStore((s) => s.drawBoxFill);
  const drawBoxBorder = useAppStore((s) => s.drawBoxBorder);
  const dragDeadzonePx = useAppStore((s) => s.dragDeadzonePx);
  const suppressUnassigned = useAppStore((s) => s.suppressUnassignedExportWarningDialog);
  const exportIncludeUnassigned = useAppStore((s) => s.exportIncludeUnassigned);
  const suppressDeleteAnn = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const suppressDeleteImage = useAppStore((s) => s.suppressDeleteImageWarningDialog);
  const suppressRemoveInstances = useAppStore((s) => s.suppressRemoveClassInstancesWarningDialog);

  const setInteractionMode = useAppStore((s) => s.setInteractionMode);
  const setAddingMode = useAppStore((s) => s.setAddingMode);
  const setShowLabels = useAppStore((s) => s.setShowLabels);
  const setShowOnlySelectedThumbs = useAppStore((s) => s.setShowOnlySelectedThumbs);
  const setBBoxOpacity = useAppStore((s) => s.setBBoxOpacity);
  const setLineThickness = useAppStore((s) => s.setLineThickness);
  const setDrawBoxFill = useAppStore((s) => s.setDrawBoxFill);
  const setDrawBoxBorder = useAppStore((s) => s.setDrawBoxBorder);
  const setDragDeadzonePx = useAppStore((s) => s.setDragDeadzonePx);
  const setSuppressUnassigned = useAppStore((s) => s.setSuppressUnassignedExportWarningDialog);
  const setExportIncludeUnassigned = useAppStore((s) => s.setExportIncludeUnassigned);
  const setSuppressDeleteAnn = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteImage = useAppStore((s) => s.setSuppressDeleteImageWarningDialog);
  const setSuppressRemoveInstances = useAppStore((s) => s.setSuppressRemoveClassInstancesWarningDialog);
  const statusText = useAppStore((s) => s.statusText);
  const setStatusText = useAppStore((s) => s.setStatusText);

  const hasImages = images.length > 0;

  const currentSettingsSnapshot = (): Record<string, boolean | number | string> => ({
    interactionMode,
    addingMode,
    showLabels,
    showOnlySelectedThumbs,
    bboxOpacity,
    lineThickness,
    drawBoxFill,
    drawBoxBorder,
    dragDeadzonePx,
    suppressUnassigned,
    exportIncludeUnassigned,
    suppressDeleteAnn,
    suppressDeleteImage,
    suppressRemoveInstances,
  });

  const applySettingsSnapshot = (snap: Record<string, boolean | number | string>): void => {
    setInteractionMode(snap.interactionMode as 'add' | 'edit');
    setAddingMode(snap.addingMode as 'click' | 'drag');
    setShowLabels(Boolean(snap.showLabels));
    setShowOnlySelectedThumbs(Boolean(snap.showOnlySelectedThumbs));
    setBBoxOpacity(Number(snap.bboxOpacity));
    setLineThickness(Number(snap.lineThickness));
    setDrawBoxFill(Boolean(snap.drawBoxFill));
    setDrawBoxBorder(Boolean(snap.drawBoxBorder));
    setDragDeadzonePx(Number(snap.dragDeadzonePx));
    setSuppressUnassigned(Boolean(snap.suppressUnassigned));
    setExportIncludeUnassigned(Boolean(snap.exportIncludeUnassigned));
    setSuppressDeleteAnn(Boolean(snap.suppressDeleteAnn));
    setSuppressDeleteImage(Boolean(snap.suppressDeleteImage));
    setSuppressRemoveInstances(Boolean(snap.suppressRemoveInstances));
  };

  const exportButtons = useMemo(
    () => [
      { id: 'local-yolo', label: 'Export selected YOLO', format: 'yolo' as const, global: false },
      { id: 'global-yolo', label: 'Export global YOLO', format: 'yolo' as const, global: true },
      { id: 'local-coco', label: 'Export selected COCO', format: 'coco' as const, global: false },
      { id: 'global-coco', label: 'Export global COCO', format: 'coco' as const, global: true },
    ],
    []
  );

  const startExport = async (format: 'yolo' | 'coco', global: boolean): Promise<void> => {
    if (suppressUnassigned) {
      await exportAnnotations(format, global, exportIncludeUnassigned);
      return;
    }
    setPendingExport({ format, global });
    closeMenus();
  };

  const onOpenImages = async (): Promise<void> => {
    const files = await pickImageFiles();
    await openImages(files);
  };

  const onOpenClasses = async (): Promise<void> => {
    const file = await pickSingleTextLikeFile();
    if (!file) return;
    const content = await file.text();
    openClassFileText(content);
  };

  const closeMenus = (): void => setOpenMenu(null);

  const runAndClose = async (action: () => void | Promise<void>): Promise<void> => {
    await action();
    closeMenus();
  };

  const toggleMenu = (id: MenuId): void => {
    setOpenMenu((prev) => (prev === id ? null : id));
  };

  useEffect(() => {
    if (!openMenu) return;

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      const button = buttonRefs.current[openMenu];
      const popover = popoverRefs.current[openMenu];
      if (button?.contains(target) || popover?.contains(target)) return;
      setOpenMenu(null);
    };

    const onPointerMove = (e: PointerEvent): void => {
      const button = buttonRefs.current[openMenu];
      const popover = popoverRefs.current[openMenu];
      if (!button || !popover) return;

      const px = e.clientX;
      const py = e.clientY;
      const b = button.getBoundingClientRect();
      const p = popover.getBoundingClientRect();

      const inButton =
        px >= b.left - 12 && px <= b.right + 12 && py >= b.top - 12 && py <= b.bottom + 12;
      const inPopover =
        px >= p.left - 12 && px <= p.right + 12 && py >= p.top - 12 && py <= p.bottom + 12;

      if (inButton || inPopover) return;

      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist > 260) {
        setOpenMenu(null);
      }
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
    };
  }, [openMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!statusText) return;
    const id = window.setTimeout(() => setStatusText(null), 2600);
    return () => window.clearTimeout(id);
  }, [setStatusText, statusText]);

  return (
    <>
      <header className="topbar">
        <div className="menu-group">
          <div className={`menu ${openMenu === 'file' ? 'open' : ''}`}>
            <button ref={(el) => (buttonRefs.current.file = el)} className="menu-trigger" onClick={() => toggleMenu('file')}>
              File
            </button>
            {openMenu === 'file' && (
              <div ref={(el) => (popoverRefs.current.file = el)} className="menu-popover">
                <button onClick={() => runAndClose(onOpenImages)}>Open images</button>
                <button onClick={() => runAndClose(onOpenClasses)}>Open classes</button>
              </div>
            )}
          </div>

          <div className={`menu ${openMenu === 'export' ? 'open' : ''}`}>
            <button
              ref={(el) => (buttonRefs.current.export = el)}
              className="menu-trigger"
              onClick={() => toggleMenu('export')}
            >
              Export
            </button>
            {openMenu === 'export' && (
              <div ref={(el) => (popoverRefs.current.export = el)} className="menu-popover">
                <button onClick={() => runAndClose(exportClassesTxt)}>Export classes TXT</button>
                {exportButtons.map((b) => (
                  <button key={b.id} onClick={() => runAndClose(() => startExport(b.format, b.global))} disabled={!hasImages}>
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`menu ${openMenu === 'edit' ? 'open' : ''}`}>
            <button ref={(el) => (buttonRefs.current.edit = el)} className="menu-trigger" onClick={() => toggleMenu('edit')}>
              Edit
            </button>
            {openMenu === 'edit' && (
              <div ref={(el) => (popoverRefs.current.edit = el)} className="menu-popover">
                <button onClick={() => runAndClose(async () => undo())}>Undo</button>
                <button onClick={() => runAndClose(async () => redo())}>Redo</button>
                <button onClick={() => runAndClose(async () => removeLastBBox())} disabled={!hasImages}>
                  Remove last annotation
                </button>
                <button onClick={() => runAndClose(async () => removeAllBBoxes())} disabled={!hasImages}>
                  Remove all annotations (selected image)
                </button>
                <button onClick={() => runAndClose(async () => removeAllBBoxesGlobal())} disabled={!hasImages}>
                  Remove all annotations (global)
                </button>
                <button onClick={() => runAndClose(async () => toggleAllAnchoringCurrentImage())} disabled={!hasImages}>
                  Toggle anchoring (selected image)
                </button>
                <button onClick={() => runAndClose(async () => toggleAllVisibilityGlobal())} disabled={!hasImages}>
                  Toggle visibility (global)
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSettingsSnapshot(currentSettingsSnapshot());
              setSettingsOpen(true);
            }}
          >
            Settings
          </button>
        </div>
        <div className="topbar-status">{statusText ?? ''}</div>
      </header>
      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Settings</h3>
            <SettingsTab />
            <div className="row dialog-actions">
              <button
                onClick={() => {
                  if (settingsSnapshot) applySettingsSnapshot(settingsSnapshot);
                  setSettingsOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setInteractionMode('edit');
                  setAddingMode('click');
                  setShowLabels(true);
                  setShowOnlySelectedThumbs(true);
                  setBBoxOpacity(0.2);
                  setLineThickness(2);
                  setDrawBoxFill(true);
                  setDrawBoxBorder(true);
                  setDragDeadzonePx(4);
                  setSuppressUnassigned(false);
                  setExportIncludeUnassigned(false);
                  setSuppressDeleteAnn(false);
                  setSuppressDeleteImage(false);
                  setSuppressRemoveInstances(false);
                }}
              >
                Revert to Default
              </button>
              <button onClick={() => setSettingsOpen(false)}>Save</button>
            </div>
          </div>
        </div>
      )}
      {pendingExport && (
        <div className="modal-backdrop" onClick={() => setPendingExport(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Export warning</h4>
                <p>
                  Unassigned class {exportIncludeUnassigned ? 'will be' : 'will not be'} exported.
                </p>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={exportIncludeUnassigned}
                    onChange={(e) => setExportIncludeUnassigned(e.target.checked)}
                  />
                  <span>Export unassigned class</span>
                </label>
                <label className="inline-check">
                  <input type="checkbox" checked={suppressUnassigned} onChange={(e) => setSuppressUnassigned(e.target.checked)} />
                  <span>Don't ask again</span>
                </label>
                <div className="row dialog-actions">
                  <button
                    onClick={async () => {
                      await exportAnnotations(pendingExport.format, pendingExport.global, exportIncludeUnassigned);
                      setPendingExport(null);
                    }}
                  >
                    Continue
                  </button>
                  <button onClick={() => setPendingExport(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
