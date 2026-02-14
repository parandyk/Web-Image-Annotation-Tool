import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { pickDirectoryFiles, pickImageFiles, pickSingleTextLikeFile, pickSingleVideoFile, pickSingleZipFile } from '../utils/files';
import {
  DEFAULT_VIDEO_PARSE_OPTIONS,
  estimateExtractedFrameCount,
  probeVideoFile,
  VideoProbe,
  VideoSamplingMode,
} from '../utils/video';
import { SettingsTab } from './tabs/SettingsTab';

type MenuId = 'open' | 'import' | 'export' | 'edit';
const IMAGE_FILE_RE = /\.(jpg|jpeg|png|bmp|tiff|tif|webp|gif)$/i;

type VideoImportDialog = {
  file: File;
  probe: VideoProbe;
  sourceFps: number;
  samplingMode: VideoSamplingMode;
  everyNFrames: number;
  targetFps: number;
  startFrame: number;
  endFrame: number;
  maxFrames: number;
};

type VideoInputDraft = {
  sourceFps: string;
  startFrame: string;
  endFrame: string;
  everyNFrames: string;
  targetFps: string;
  maxFrames: string;
};

const DIGITS_ONLY_RE = /^\d*$/;
const DECIMAL_RE = /^\d*(?:\.\d*)?$/;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatTimeSec(seconds: number): string {
  const safe = Math.max(0, seconds);
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function TopBar(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState<Record<string, boolean | number | string> | null>(null);
  const [pendingExport, setPendingExport] = useState<{ format: 'yolo' | 'coco'; global: boolean } | null>(null);
  const [confirmClearWorkspace, setConfirmClearWorkspace] = useState(false);
  const [videoImportDialog, setVideoImportDialog] = useState<VideoImportDialog | null>(null);
  const [videoInputDraft, setVideoInputDraft] = useState<VideoInputDraft | null>(null);
  const [videoImportBusy, setVideoImportBusy] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const buttonRefs = useRef<Record<MenuId, HTMLButtonElement | null>>({
    open: null,
    import: null,
    export: null,
    edit: null,
  });
  const popoverRefs = useRef<Record<MenuId, HTMLDivElement | null>>({
    open: null,
    import: null,
    export: null,
    edit: null,
  });
  const openImages = useAppStore((s) => s.openImages);
  const openVideoFrames = useAppStore((s) => s.openVideoFrames);
  const importDatasetFolder = useAppStore((s) => s.importDatasetFolder);
  const importWorkspaceState = useAppStore((s) => s.importWorkspaceState);
  const closeAllImages = useAppStore((s) => s.closeAllImages);
  const clearWorkspace = useAppStore((s) => s.clearWorkspace);
  const openClassFileText = useAppStore((s) => s.openClassFileText);
  const exportClassesTxt = useAppStore((s) => s.exportClassesTxt);
  const exportAnnotations = useAppStore((s) => s.exportAnnotations);
  const exportWorkspaceState = useAppStore((s) => s.exportWorkspaceState);
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
  const bboxOpacity = useAppStore((s) => s.bboxOpacity);
  const lineThickness = useAppStore((s) => s.lineThickness);
  const drawBoxFill = useAppStore((s) => s.drawBoxFill);
  const drawBoxBorder = useAppStore((s) => s.drawBoxBorder);
  const showCrosshair = useAppStore((s) => s.showCrosshair);
  const dragDeadzonePx = useAppStore((s) => s.dragDeadzonePx);
  const suppressUnassigned = useAppStore((s) => s.suppressUnassignedExportWarningDialog);
  const exportIncludeUnassigned = useAppStore((s) => s.exportIncludeUnassigned);
  const suppressDeleteAnn = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const suppressDeleteImage = useAppStore((s) => s.suppressDeleteImageWarningDialog);
  const suppressRemoveInstances = useAppStore((s) => s.suppressRemoveClassInstancesWarningDialog);

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
  const setSuppressDeleteAnn = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteImage = useAppStore((s) => s.setSuppressDeleteImageWarningDialog);
  const setSuppressRemoveInstances = useAppStore((s) => s.setSuppressRemoveClassInstancesWarningDialog);
  const statusText = useAppStore((s) => s.statusText);
  const setStatusText = useAppStore((s) => s.setStatusText);

  const hasImages = images.length > 0;

  const sourceFrameCount = useMemo(() => {
    if (!videoImportDialog) return 0;
    return Math.max(1, Math.floor(videoImportDialog.probe.durationSec * videoImportDialog.sourceFps));
  }, [videoImportDialog]);

  const estimatedVideoOutputCount = useMemo(() => {
    if (!videoImportDialog) return 0;
    return estimateExtractedFrameCount(videoImportDialog.probe, {
      ...DEFAULT_VIDEO_PARSE_OPTIONS,
      sourceFps: videoImportDialog.sourceFps,
      samplingMode: videoImportDialog.samplingMode,
      everyNFrames: videoImportDialog.everyNFrames,
      targetFps: videoImportDialog.targetFps,
      startFrame: videoImportDialog.startFrame,
      endFrame: videoImportDialog.endFrame,
      maxFrames: videoImportDialog.maxFrames,
    });
  }, [videoImportDialog]);

  const syncVideoDraft = (dialog: VideoImportDialog): void => {
    setVideoInputDraft({
      sourceFps: String(dialog.sourceFps),
      startFrame: String(dialog.startFrame),
      endFrame: String(dialog.endFrame),
      everyNFrames: String(dialog.everyNFrames),
      targetFps: String(dialog.targetFps),
      maxFrames: String(dialog.maxFrames),
    });
  };

  const commitSourceFps = (): void => {
    const raw = videoInputDraft?.sourceFps ?? '';
    setVideoImportDialog((prev) => {
      if (!prev) return prev;
      const parsed = raw === '' ? prev.sourceFps : Number(raw);
      const sourceFps = clampNumber(Number.isFinite(parsed) ? parsed : prev.sourceFps, 1, 240);
      const totalFrames = Math.max(1, Math.floor(prev.probe.durationSec * sourceFps));
      const maxFrame = totalFrames - 1;
      const startFrame = Math.min(prev.startFrame, maxFrame);
      const endFrame = Math.max(startFrame, Math.min(prev.endFrame, maxFrame));
      return { ...prev, sourceFps, startFrame, endFrame };
    });
  };

  const commitStartFrame = (): void => {
    const raw = videoInputDraft?.startFrame ?? '';
    setVideoImportDialog((prev) => {
      if (!prev) return prev;
      const maxFrame = Math.max(0, Math.floor(prev.probe.durationSec * prev.sourceFps) - 1);
      const parsed = raw === '' ? prev.startFrame : Math.floor(Number(raw));
      const startFrame = clampNumber(Number.isFinite(parsed) ? parsed : prev.startFrame, 0, maxFrame);
      const endFrame = Math.max(startFrame, Math.min(prev.endFrame, maxFrame));
      return { ...prev, startFrame, endFrame };
    });
  };

  const commitEndFrame = (): void => {
    const raw = videoInputDraft?.endFrame ?? '';
    setVideoImportDialog((prev) => {
      if (!prev) return prev;
      const maxFrame = Math.max(0, Math.floor(prev.probe.durationSec * prev.sourceFps) - 1);
      const parsed = raw === '' ? prev.endFrame : Math.floor(Number(raw));
      const endFrame = Math.max(prev.startFrame, clampNumber(Number.isFinite(parsed) ? parsed : prev.endFrame, 0, maxFrame));
      return { ...prev, endFrame };
    });
  };

  const commitEveryNFrames = (): void => {
    const raw = videoInputDraft?.everyNFrames ?? '';
    setVideoImportDialog((prev) => {
      if (!prev) return prev;
      const parsed = raw === '' ? prev.everyNFrames : Math.floor(Number(raw));
      const everyNFrames = clampNumber(Number.isFinite(parsed) ? parsed : prev.everyNFrames, 1, 10000);
      return { ...prev, everyNFrames };
    });
  };

  const commitTargetFps = (): void => {
    const raw = videoInputDraft?.targetFps ?? '';
    setVideoImportDialog((prev) => {
      if (!prev) return prev;
      const parsed = raw === '' ? prev.targetFps : Number(raw);
      const targetFps = clampNumber(Number.isFinite(parsed) ? parsed : prev.targetFps, 0.1, 120);
      return { ...prev, targetFps };
    });
  };

  const commitMaxFrames = (): void => {
    const raw = videoInputDraft?.maxFrames ?? '';
    setVideoImportDialog((prev) => {
      if (!prev) return prev;
      const parsed = raw === '' ? prev.maxFrames : Math.floor(Number(raw));
      const maxFrames = clampNumber(Number.isFinite(parsed) ? parsed : prev.maxFrames, 1, 2000);
      return { ...prev, maxFrames };
    });
  };

  // Snapshot lets modal settings support Save/Revert without immediate state loss.
  const currentSettingsSnapshot = (): Record<string, boolean | number | string> => ({
    interactionMode,
    addingMode,
    showLabels,
    bboxOpacity,
    lineThickness,
    drawBoxFill,
    drawBoxBorder,
    showCrosshair,
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
    setBBoxOpacity(Number(snap.bboxOpacity));
    setLineThickness(Number(snap.lineThickness));
    setDrawBoxFill(Boolean(snap.drawBoxFill));
    setDrawBoxBorder(Boolean(snap.drawBoxBorder));
    setShowCrosshair(Boolean(snap.showCrosshair));
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
    // Unassigned-class warning can be bypassed globally via settings.
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

  const onOpenVideo = async (): Promise<void> => {
    const file = await pickSingleVideoFile();
    if (!file) return;
    closeMenus();
    setStatusText(`Reading video metadata for "${file.name}"...`);
    try {
      const probe = await probeVideoFile(file);
      const sourceFps = DEFAULT_VIDEO_PARSE_OPTIONS.sourceFps;
      const totalFrames = Math.max(1, Math.floor(probe.durationSec * sourceFps));
      setVideoImportDialog({
        file,
        probe,
        sourceFps,
        samplingMode: DEFAULT_VIDEO_PARSE_OPTIONS.samplingMode,
        everyNFrames: DEFAULT_VIDEO_PARSE_OPTIONS.everyNFrames,
        targetFps: DEFAULT_VIDEO_PARSE_OPTIONS.targetFps,
        startFrame: 0,
        endFrame: Math.max(0, Math.min(totalFrames - 1, DEFAULT_VIDEO_PARSE_OPTIONS.endFrame)),
        maxFrames: DEFAULT_VIDEO_PARSE_OPTIONS.maxFrames,
      });
      setStatusText(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusText(`Could not open video: ${message}`);
    }
  };

  const runVideoImport = async (): Promise<void> => {
    if (!videoImportDialog || videoImportBusy) return;
    setVideoImportBusy(true);
    try {
      const before = useAppStore.getState().images.length;
      await openVideoFrames(videoImportDialog.file, {
        ...DEFAULT_VIDEO_PARSE_OPTIONS,
        sourceFps: videoImportDialog.sourceFps,
        samplingMode: videoImportDialog.samplingMode,
        everyNFrames: videoImportDialog.everyNFrames,
        targetFps: videoImportDialog.targetFps,
        startFrame: videoImportDialog.startFrame,
        endFrame: videoImportDialog.endFrame,
        maxFrames: videoImportDialog.maxFrames,
      });
      const after = useAppStore.getState().images.length;
      if (after > before) {
        setVideoImportDialog(null);
      }
    } finally {
      setVideoImportBusy(false);
    }
  };

  const onOpenImageFolder = async (): Promise<void> => {
    const files = await pickDirectoryFiles();
    // Folder import for images only, unlike dataset import which parses labels/metadata.
    const imageFiles = files.filter((f) => IMAGE_FILE_RE.test(f.name.toLowerCase()));
    if (imageFiles.length === 0) {
      setStatusText('No supported image files found in selected folder.');
      return;
    }
    await openImages(imageFiles);
  };

  const onImportDataset = async (): Promise<void> => {
    const files = await pickDirectoryFiles();
    await importDatasetFolder(files);
  };

  const onImportWorkspaceState = async (): Promise<void> => {
    const file = await pickSingleZipFile();
    if (!file) return;
    await importWorkspaceState(file);
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
      // Close flyouts when pointer leaves command area by a larger distance.
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
        if (videoImportDialog && !videoImportBusy) {
          setVideoImportDialog(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoImportBusy, videoImportDialog]);

  useEffect(() => {
    if (!settingsOpen && !videoImportDialog) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [settingsOpen, videoImportDialog]);

  useEffect(() => {
    if (!videoImportDialog) {
      setVideoInputDraft(null);
      return;
    }
    syncVideoDraft(videoImportDialog);
  }, [videoImportDialog]);

  useEffect(() => {
    if (!statusText) return;
    // Status text is transient feedback; auto-clear to avoid stale warnings.
    const id = window.setTimeout(() => setStatusText(null), 2600);
    return () => window.clearTimeout(id);
  }, [setStatusText, statusText]);

  return (
    <>
      <header className="topbar">
        <div className="menu-group">
          <div className={`menu ${openMenu === 'open' ? 'open' : ''}`}>
            <button ref={(el) => (buttonRefs.current.open = el)} className="menu-trigger" onClick={() => toggleMenu('open')}>
              Open
            </button>
            {openMenu === 'open' && (
              <div ref={(el) => (popoverRefs.current.open = el)} className="menu-popover">
                <button onClick={() => runAndClose(onOpenImages)}>Open images</button>
                <button onClick={() => runAndClose(onOpenVideo)}>Open video</button>
                <button onClick={() => runAndClose(onOpenImageFolder)}>Open image folder</button>
              </div>
            )}
          </div>

          <div className={`menu ${openMenu === 'import' ? 'open' : ''}`}>
            <button
              ref={(el) => (buttonRefs.current.import = el)}
              className="menu-trigger"
              onClick={() => toggleMenu('import')}
            >
              Import
            </button>
            {openMenu === 'import' && (
              <div ref={(el) => (popoverRefs.current.import = el)} className="menu-popover">
                <button onClick={() => runAndClose(onOpenClasses)}>Import classes</button>
                <button onClick={() => runAndClose(onImportDataset)}>Import dataset folder</button>
                <button onClick={() => runAndClose(onImportWorkspaceState)}>Import workspace state</button>
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
                <button onClick={() => runAndClose(exportWorkspaceState)}>Export workspace state</button>
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
                <button onClick={() => runAndClose(async () => closeAllImages())} disabled={!hasImages}>
                  Close all images
                </button>
                <button
                  onClick={() => {
                    closeMenus();
                    setConfirmClearWorkspace(true);
                  }}
                  disabled={!hasImages}
                >
                  Clear workspace
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
                  setBBoxOpacity(0.2);
                  setLineThickness(2);
                  setDrawBoxFill(true);
                  setDrawBoxBorder(true);
                  setShowCrosshair(true);
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
      {videoImportDialog && (
        <div className="modal-backdrop">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Open video</h4>
                <p className="slider-meta">
                  {videoImportDialog.file.name} | {videoImportDialog.probe.width}x{videoImportDialog.probe.height} |{' '}
                  {formatTimeSec(videoImportDialog.probe.durationSec)}
                </p>

                <label>
                  Source FPS (estimate)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={videoInputDraft?.sourceFps ?? ''}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!DECIMAL_RE.test(next)) return;
                      setVideoInputDraft((prev) => (prev ? { ...prev, sourceFps: next } : prev));
                    }}
                    onBlur={commitSourceFps}
                  />
                </label>

                <div className="video-range-stack">
                  <label>
                    Start frame
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={videoInputDraft?.startFrame ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!DIGITS_ONLY_RE.test(next)) return;
                        setVideoInputDraft((prev) => (prev ? { ...prev, startFrame: next } : prev));
                      }}
                      onBlur={commitStartFrame}
                    />
                  </label>
                  <label>
                    End frame
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={videoInputDraft?.endFrame ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!DIGITS_ONLY_RE.test(next)) return;
                        setVideoInputDraft((prev) => (prev ? { ...prev, endFrame: next } : prev));
                      }}
                      onBlur={commitEndFrame}
                    />
                  </label>
                </div>
                <div className="video-range-stack">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, sourceFrameCount - 1)}
                    value={videoImportDialog.startFrame}
                    onChange={(e) =>
                      setVideoImportDialog((prev) => {
                        if (!prev) return prev;
                        const nextStart = Math.min(prev.endFrame, Math.floor(Number(e.target.value) || 0));
                        return { ...prev, startFrame: nextStart };
                      })
                    }
                  />
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, sourceFrameCount - 1)}
                    value={videoImportDialog.endFrame}
                    onChange={(e) =>
                      setVideoImportDialog((prev) => {
                        if (!prev) return prev;
                        const nextEnd = Math.max(prev.startFrame, Math.floor(Number(e.target.value) || 0));
                        return { ...prev, endFrame: nextEnd };
                      })
                    }
                  />
                </div>
                <p className="slider-meta">
                  Range: frame {videoImportDialog.startFrame} ({formatTimeSec(videoImportDialog.startFrame / videoImportDialog.sourceFps)}) to frame {videoImportDialog.endFrame}{' '}
                  ({formatTimeSec(videoImportDialog.endFrame / videoImportDialog.sourceFps)})
                </p>

                <div className="row">
                  <button
                    className={videoImportDialog.samplingMode === 'everyN' ? 'active' : ''}
                    onClick={() =>
                      setVideoImportDialog((prev) => (prev ? { ...prev, samplingMode: 'everyN' } : prev))
                    }
                  >
                    Every N frames
                  </button>
                  <button
                    className={videoImportDialog.samplingMode === 'fps' ? 'active' : ''}
                    onClick={() =>
                      setVideoImportDialog((prev) => (prev ? { ...prev, samplingMode: 'fps' } : prev))
                    }
                  >
                    Target FPS
                  </button>
                </div>

                {videoImportDialog.samplingMode === 'everyN' ? (
                  <label>
                    Take every N frames
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={videoInputDraft?.everyNFrames ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!DIGITS_ONLY_RE.test(next)) return;
                        setVideoInputDraft((prev) => (prev ? { ...prev, everyNFrames: next } : prev));
                      }}
                      onBlur={commitEveryNFrames}
                    />
                  </label>
                ) : (
                  <label>
                    Sampling FPS
                    <input
                      type="text"
                      inputMode="decimal"
                      value={videoInputDraft?.targetFps ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (!DECIMAL_RE.test(next)) return;
                        setVideoInputDraft((prev) => (prev ? { ...prev, targetFps: next } : prev));
                      }}
                      onBlur={commitTargetFps}
                    />
                  </label>
                )}

                <label>
                  Max extracted frames
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={videoInputDraft?.maxFrames ?? ''}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (!DIGITS_ONLY_RE.test(next)) return;
                      setVideoInputDraft((prev) => (prev ? { ...prev, maxFrames: next } : prev));
                    }}
                    onBlur={commitMaxFrames}
                  />
                </label>

                <p className="slider-meta">
                  Estimated extraction count: {estimatedVideoOutputCount}
                </p>

                <div className="row dialog-actions">
                  <button disabled={videoImportBusy} onClick={() => setVideoImportDialog(null)}>
                    Cancel
                  </button>
                  <button
                    disabled={videoImportBusy || estimatedVideoOutputCount <= 0}
                    onClick={runVideoImport}
                  >
                    {videoImportBusy ? 'Parsing...' : 'Parse video'}
                  </button>
                </div>
              </section>
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
      {confirmClearWorkspace && (
        <div className="modal-backdrop" onClick={() => setConfirmClearWorkspace(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Clear workspace</h4>
                <p>This will remove all loaded images and their annotations from the current session.</p>
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      clearWorkspace();
                      setConfirmClearWorkspace(false);
                    }}
                  >
                    Clear
                  </button>
                  <button onClick={() => setConfirmClearWorkspace(false)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
