import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { ImageScope } from '../domain/types';
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
const IMAGE_FILE_RE = /\.(jpg|jpeg|png|bmp|tiff|tif|webp)$/i;

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

type WorkspaceClassOperationDialog =
  | null
  | { type: 'swap'; selectedClassIds: string[]; targetClassId: string; search: string; scope: ImageScope }
  | { type: 'remove'; selectedClassIds: string[]; search: string; scope: ImageScope }
  | { type: 'anchoring'; selectedClassIds: string[]; search: string; value: 'anchor' | 'unanchor'; scope: ImageScope }
  | { type: 'visibility'; selectedClassIds: string[]; search: string; value: 'show' | 'hide'; scope: ImageScope };

type AnnotationScopeDialog =
  | null
  | { type: 'removeAll'; scope: ImageScope }
  | { type: 'visibility'; scope: ImageScope; visibilityValue: 'show' | 'hide' }
  | { type: 'anchoring'; scope: ImageScope; anchoringValue: 'anchor' | 'unanchor' };

type ExportImageNamingMode = 'original' | 'sequential';

type ExportRequest =
  | {
      kind: 'single';
      format: 'yolo' | 'coco' | 'voc';
      scope: ImageScope;
      includeUnassigned: boolean;
      namingMode: ExportImageNamingMode;
      namingBase: string;
      convertImages: boolean;
      convertFormat: 'jpeg' | 'png';
      includeImagesWithoutAnnotations: boolean;
      includeOriginalNameMetadata: boolean;
      sanitizeImageMetadata: boolean;
    }
  | {
      kind: 'allFormats';
      scope: ImageScope;
      folderName: string;
      includeUnassigned: boolean;
      namingMode: ExportImageNamingMode;
      namingBase: string;
      convertImages: boolean;
      convertFormat: 'jpeg' | 'png';
      includeImagesWithoutAnnotations: boolean;
      includeOriginalNameMetadata: boolean;
      sanitizeImageMetadata: boolean;
    };

const DIGITS_ONLY_RE = /^\d*$/;
const DECIMAL_RE = /^\d*(?:\.\d*)?$/;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function areSettingsSnapshotsEqual(
  left: Record<string, boolean | number | string> | null,
  right: Record<string, boolean | number | string> | null
): boolean {
  if (!left || !right) return left === right;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
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

function sanitizeExportImageBaseNamePreview(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'image';
  const safe = trimmed
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 80);
  return safe.length > 0 ? safe : 'image';
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return name.slice(idx);
}

export function TopBar(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [statisticsScope, setStatisticsScope] = useState<ImageScope>('allImages');
  const [settingsSnapshot, setSettingsSnapshot] = useState<Record<string, boolean | number | string> | null>(null);
  const [confirmCloseSettings, setConfirmCloseSettings] = useState(false);
  const [exportDialog, setExportDialog] = useState<ExportRequest | null>(null);
  const [pendingExport, setPendingExport] = useState<ExportRequest | null>(null);
  const [confirmClearWorkspace, setConfirmClearWorkspace] = useState(false);
  const [videoImportDialog, setVideoImportDialog] = useState<VideoImportDialog | null>(null);
  const [videoInputDraft, setVideoInputDraft] = useState<VideoInputDraft | null>(null);
  const [videoImportBusy, setVideoImportBusy] = useState(false);
  const [workspaceClassDialog, setWorkspaceClassDialog] = useState<WorkspaceClassOperationDialog>(null);
  const [annotationScopeDialog, setAnnotationScopeDialog] = useState<AnnotationScopeDialog>(null);
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
  const exportAllAnnotations = useAppStore((s) => s.exportAllAnnotations);
  const exportWorkspaceState = useAppStore((s) => s.exportWorkspaceState);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.undoStack.length > 0);
  const canRedo = useAppStore((s) => s.redoStack.length > 0);
  const removeAllBBoxes = useAppStore((s) => s.removeAllBBoxes);
  const removeAllBBoxesGlobal = useAppStore((s) => s.removeAllBBoxesGlobal);
  const removeAllBBoxesBookmarked = useAppStore((s) => s.removeAllBBoxesBookmarked);
  const removeLastBBox = useAppStore((s) => s.removeLastBBox);
  const setAllAnchoringCurrentImage = useAppStore((s) => s.setAllAnchoringCurrentImage);
  const setAllVisibilityCurrentImage = useAppStore((s) => s.setAllVisibilityCurrentImage);
  const swapClassInstances = useAppStore((s) => s.swapClassInstances);
  const removeClassInstances = useAppStore((s) => s.removeClassInstances);
  const setClassInstancesAnchoring = useAppStore((s) => s.setClassInstancesAnchoring);
  const setClassInstancesVisibility = useAppStore((s) => s.setClassInstancesVisibility);
  const classes = useAppStore((s) => s.classes);
  const images = useAppStore((s) => s.images);
  const selectedImageId = useAppStore((s) => s.selectedImageId);
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
  const suppressDeleteAnn = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const suppressDeleteImage = useAppStore((s) => s.suppressDeleteImageWarningDialog);
  const suppressRemoveInstances = useAppStore((s) => s.suppressRemoveClassInstancesWarningDialog);

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
  const setSuppressDeleteAnn = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteImage = useAppStore((s) => s.setSuppressDeleteImageWarningDialog);
  const setSuppressRemoveInstances = useAppStore((s) => s.setSuppressRemoveClassInstancesWarningDialog);
  const statusText = useAppStore((s) => s.statusText);
  const setStatusText = useAppStore((s) => s.setStatusText);

  const hasImages = images.length > 0;
  const hasBookmarkedImages = useMemo(() => images.some((img) => img.isBookmarked), [images]);
  const selectedImage = useMemo(() => images.find((img) => img.id === selectedImageId) ?? null, [images, selectedImageId]);
  const currentImageAnnotations = selectedImage?.annotations ?? [];
  const hasCurrentImageAnnotations = currentImageAnnotations.length > 0;
  const hasGlobalAnnotations = useMemo(() => images.some((img) => img.annotations.length > 0), [images]);
  const hasBookmarkedAnnotations = useMemo(
    () => images.some((img) => img.isBookmarked && img.annotations.length > 0),
    [images]
  );
  const selectedDialogClassSet = useMemo(
    () => new Set(workspaceClassDialog?.selectedClassIds ?? []),
    [workspaceClassDialog]
  );
  const workspaceDialogClasses = useMemo(() => {
    const query = workspaceClassDialog?.search.trim().toLowerCase() ?? '';
    if (!query) return classes;
    return classes.filter((cls) => cls.name.toLowerCase().includes(query));
  }, [classes, workspaceClassDialog]);
  const workspaceDialogSwapTargets = useMemo(() => {
    if (!workspaceClassDialog || workspaceClassDialog.type !== 'swap') return [];
    return classes.filter((cls) => !selectedDialogClassSet.has(cls.id));
  }, [classes, selectedDialogClassSet, workspaceClassDialog]);
  const hasValidSwapTarget =
    workspaceClassDialog?.type === 'swap' &&
    workspaceDialogSwapTargets.some((cls) => cls.id === workspaceClassDialog.targetClassId);
  const hasSelectedImageForClassOps = Boolean(selectedImageId);
  const hasSelectedImageClassInstances = useMemo(() => {
    if (!workspaceClassDialog || !selectedImage) return false;
    if (workspaceClassDialog.selectedClassIds.length === 0) return false;
    const sourceSet = new Set(workspaceClassDialog.selectedClassIds);
    return selectedImage.annotations.some((ann) => sourceSet.has(ann.classId));
  }, [selectedImage, workspaceClassDialog]);
  const hasGlobalClassInstances = useMemo(() => {
    if (!workspaceClassDialog) return false;
    if (workspaceClassDialog.selectedClassIds.length === 0) return false;
    const sourceSet = new Set(workspaceClassDialog.selectedClassIds);
    return images.some((img) => img.annotations.some((ann) => sourceSet.has(ann.classId)));
  }, [images, workspaceClassDialog]);
  const hasBookmarkedClassInstances = useMemo(() => {
    if (!workspaceClassDialog) return false;
    if (workspaceClassDialog.selectedClassIds.length === 0) return false;
    const sourceSet = new Set(workspaceClassDialog.selectedClassIds);
    return images.some(
      (img) => img.isBookmarked && img.annotations.some((ann) => sourceSet.has(ann.classId))
    );
  }, [images, workspaceClassDialog]);

  const hasAnnotationsForScope = (scope: ImageScope): boolean => {
    if (scope === 'currentImage') return hasCurrentImageAnnotations;
    if (scope === 'bookmarkedImages') return hasBookmarkedAnnotations;
    return hasGlobalAnnotations;
  };

  const canRunWorkspaceClassOperationForScope = (scope: ImageScope): boolean => {
    if (!workspaceClassDialog) return false;
    if (workspaceClassDialog.selectedClassIds.length === 0) return false;
    if (workspaceClassDialog.type === 'swap' && !hasValidSwapTarget) return false;
    if (scope === 'currentImage') return hasSelectedImageForClassOps && hasSelectedImageClassInstances;
    if (scope === 'bookmarkedImages') return hasBookmarkedClassInstances;
    return hasGlobalClassInstances;
  };

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
    classAssignmentMode,
    fastClassSwapMode,
    showLabels,
    bboxOpacity,
    lineThickness,
    drawBoxFill,
    drawBoxBorder,
    showCrosshair,
    showMinimap,
    minimapLocation,
    dragDeadzonePx,
    inferenceModelUrl,
    exportIncludeUnassigned,
    suppressDeleteAnn,
    suppressDeleteImage,
    suppressRemoveInstances,
  });

  const applySettingsSnapshot = (snap: Record<string, boolean | number | string>): void => {
    setInteractionMode(snap.interactionMode as 'add' | 'edit');
    setAddingMode(snap.addingMode as 'click' | 'drag');
    setClassAssignmentMode(snap.classAssignmentMode as 'activeClass' | 'deferred');
    setFastClassSwapMode(Boolean(snap.fastClassSwapMode));
    setShowLabels(Boolean(snap.showLabels));
    setBBoxOpacity(Number(snap.bboxOpacity));
    setLineThickness(Number(snap.lineThickness));
    setDrawBoxFill(Boolean(snap.drawBoxFill));
    setDrawBoxBorder(Boolean(snap.drawBoxBorder));
    setShowCrosshair(Boolean(snap.showCrosshair));
    setShowMinimap(Boolean(snap.showMinimap));
    setMinimapLocation(
      (typeof snap.minimapLocation === 'string' ? snap.minimapLocation : 'bottomRight') as
        | 'topLeft'
        | 'topRight'
        | 'bottomLeft'
        | 'bottomRight'
        | 'sidebar'
    );
    setDragDeadzonePx(Number(snap.dragDeadzonePx));
    setInferenceModelUrl(
      typeof snap.inferenceModelUrl === 'string' && snap.inferenceModelUrl.trim().length > 0
        ? snap.inferenceModelUrl
        : '/models/yolo26n.onnx'
    );
    setExportIncludeUnassigned(Boolean(snap.exportIncludeUnassigned));
    setSuppressDeleteAnn(Boolean(snap.suppressDeleteAnn));
    setSuppressDeleteImage(Boolean(snap.suppressDeleteImage));
    setSuppressRemoveInstances(Boolean(snap.suppressRemoveInstances));
  };

  const hasPendingSettingsChanges =
    settingsOpen &&
    settingsSnapshot !== null &&
    !areSettingsSnapshotsEqual(currentSettingsSnapshot(), settingsSnapshot);

  const closeSettingsDialog = (): void => {
    setConfirmCloseSettings(false);
    setSettingsOpen(false);
    setSettingsSnapshot(null);
  };

  const abortSettingsChanges = (): void => {
    if (settingsSnapshot) {
      applySettingsSnapshot(settingsSnapshot);
    }
    closeSettingsDialog();
  };

  const hasImagesForScope = (scope: ImageScope): boolean => {
    if (scope === 'currentImage') return Boolean(selectedImage);
    if (scope === 'bookmarkedImages') return hasBookmarkedImages;
    return hasImages;
  };

  const getImagesForScope = (scope: ImageScope) => {
    if (scope === 'currentImage') return selectedImage ? [selectedImage] : [];
    if (scope === 'bookmarkedImages') return images.filter((img) => img.isBookmarked);
    return images;
  };

  const statisticsImages = useMemo(() => getImagesForScope(statisticsScope), [statisticsScope, images, selectedImage]);

  const statisticsData = useMemo(() => {
    const defaultClassId = classes.find((cls) => cls.isDefault)?.id ?? null;
    const classCountById = new Map<string, number>(classes.map((cls) => [cls.id, 0]));
    const perImageRows = statisticsImages
      .map((img) => {
        let unassigned = 0;
        for (const ann of img.annotations) {
          classCountById.set(ann.classId, (classCountById.get(ann.classId) ?? 0) + 1);
          if (defaultClassId && ann.classId === defaultClassId) {
            unassigned += 1;
          }
        }
        const total = img.annotations.length;
        return {
          id: img.id,
          name: img.name,
          total,
          unassigned,
          assigned: Math.max(0, total - unassigned),
        };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const totalAnnotations = perImageRows.reduce((sum, row) => sum + row.total, 0);
    const totalUnassigned = perImageRows.reduce((sum, row) => sum + row.unassigned, 0);
    const classRows = classes
      .map((cls) => {
        const count = classCountById.get(cls.id) ?? 0;
        const percentage = totalAnnotations > 0 ? (count / totalAnnotations) * 100 : 0;
        return {
          id: cls.id,
          name: cls.name,
          color: cls.color,
          isDefault: Boolean(cls.isDefault),
          count,
          percentage,
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      imagesCount: statisticsImages.length,
      classesCount: classes.length,
      totalAnnotations,
      totalUnassigned,
      classRows,
      perImageRows,
    };
  }, [classes, statisticsImages]);

  const getExportPreviewStats = (
    request: Pick<ExportRequest, 'scope' | 'includeUnassigned' | 'includeImagesWithoutAnnotations'>
  ): {
    openTotal: number;
    scopeTotal: number;
    mappedAnnotatedInScope: number;
    willExport: number;
  } => {
    const openTotal = images.length;
    const scopedImages = getImagesForScope(request.scope).filter((img) => IMAGE_FILE_RE.test(img.name.toLowerCase()));
    const scopeTotal = scopedImages.length;

    let exportClasses = classes.filter((cls) => request.includeUnassigned || !cls.isDefault);
    if (exportClasses.length === 0) {
      return { openTotal, scopeTotal, mappedAnnotatedInScope: 0, willExport: 0 };
    }

    let classIdSet = new Set(exportClasses.map((cls) => cls.id));
    const hasAnyScopeAnnotation = scopedImages.some((img) => img.annotations.length > 0);
    const hasMappedAnnotation = scopedImages.some((img) =>
      img.annotations.some((ann) => classIdSet.has(ann.classId))
    );
    if (hasAnyScopeAnnotation && !hasMappedAnnotation) {
      exportClasses = classes;
      classIdSet = new Set(exportClasses.map((cls) => cls.id));
    }

    const mappedAnnotatedInScope = scopedImages.filter((img) =>
      img.annotations.some((ann) => classIdSet.has(ann.classId))
    ).length;
    const willExport = request.includeImagesWithoutAnnotations ? scopeTotal : mappedAnnotatedInScope;
    return {
      openTotal,
      scopeTotal,
      mappedAnnotatedInScope,
      willExport,
    };
  };

  const exportDialogStats = useMemo(() => {
    if (!exportDialog) return null;
    return getExportPreviewStats(exportDialog);
  }, [classes, exportDialog, images, selectedImage]);

  const pendingExportStats = useMemo(() => {
    if (!pendingExport) return null;
    return getExportPreviewStats(pendingExport);
  }, [classes, images, pendingExport, selectedImage]);

  const sequentialNamingPreview = useMemo(() => {
    if (!exportDialog || exportDialog.namingMode !== 'sequential') return '';
    const base = sanitizeExportImageBaseNamePreview(exportDialog.namingBase);
    const sampleImage = getImagesForScope(exportDialog.scope)[0];
    const ext = sampleImage ? getFileExtension(sampleImage.name) : '';
    return `${base}_1${ext}`;
  }, [exportDialog, images, selectedImage]);

  const executeExportRequest = async (request: ExportRequest): Promise<void> => {
    const naming = {
      mode: request.namingMode,
      baseName: request.namingBase,
    } as const;
    const output = {
      convert: request.convertImages,
      format: request.convertFormat,
    } as const;
    const metadata = {
      includeOriginalName: request.includeOriginalNameMetadata,
      sanitizeImageMetadata: request.sanitizeImageMetadata,
    } as const;
    if (request.kind === 'single') {
      await exportAnnotations(
        request.format,
        request.scope,
        request.includeUnassigned,
        naming,
        output,
        request.includeImagesWithoutAnnotations,
        metadata
      );
      return;
    }
    await exportAllAnnotations(
      request.scope,
      request.folderName,
      request.includeUnassigned,
      naming,
      output,
      request.includeImagesWithoutAnnotations,
      metadata
    );
  };

  const defaultExportScope = (): ImageScope => {
    if (selectedImage) return 'currentImage';
    if (hasBookmarkedImages) return 'bookmarkedImages';
    return 'allImages';
  };

  const openStatisticsDialog = (): void => {
    setStatisticsScope(defaultExportScope());
    setStatisticsOpen(true);
    closeMenus();
  };

  const openSingleExportDialog = (format: 'yolo' | 'coco' | 'voc'): void => {
    setExportDialog({
      kind: 'single',
      format,
      scope: defaultExportScope(),
      includeUnassigned: exportIncludeUnassigned,
      namingMode: 'sequential',
      namingBase: 'image',
      convertImages: false,
      convertFormat: 'png',
      includeImagesWithoutAnnotations: true,
      includeOriginalNameMetadata: false,
      sanitizeImageMetadata: false,
    });
    closeMenus();
  };

  const openAllFormatsExportDialog = (): void => {
    setExportDialog({
      kind: 'allFormats',
      scope: defaultExportScope(),
      folderName: 'annotation_exports',
      includeUnassigned: exportIncludeUnassigned,
      namingMode: 'sequential',
      namingBase: 'image',
      convertImages: false,
      convertFormat: 'png',
      includeImagesWithoutAnnotations: true,
      includeOriginalNameMetadata: false,
      sanitizeImageMetadata: false,
    });
    closeMenus();
  };

  const confirmExportDialog = async (): Promise<void> => {
    if (!exportDialog) return;
    if (!hasImagesForScope(exportDialog.scope)) {
      setStatusText('No images available for selected export scope.');
      return;
    }
    if (exportDialog.kind === 'allFormats' && exportDialog.folderName.trim().length === 0) {
      setStatusText('Provide a folder name for all-formats export.');
      return;
    }
    const request = exportDialog;
    setExportDialog(null);
    setPendingExport(request);
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

  const openSwapInstancesDialog = (): void => {
    const firstClassId = classes[0]?.id ?? '';
    setWorkspaceClassDialog({
      type: 'swap',
      selectedClassIds: [],
      targetClassId: firstClassId,
      search: '',
      scope: selectedImage ? 'currentImage' : hasBookmarkedImages ? 'bookmarkedImages' : 'allImages',
    });
    closeMenus();
  };

  const openRemoveInstancesDialog = (): void => {
    setWorkspaceClassDialog({
      type: 'remove',
      selectedClassIds: [],
      search: '',
      scope: selectedImage ? 'currentImage' : hasBookmarkedImages ? 'bookmarkedImages' : 'allImages',
    });
    closeMenus();
  };

  const openAnchoringInstancesDialog = (): void => {
    setWorkspaceClassDialog({
      type: 'anchoring',
      selectedClassIds: [],
      search: '',
      value: 'anchor',
      scope: selectedImage ? 'currentImage' : hasBookmarkedImages ? 'bookmarkedImages' : 'allImages',
    });
    closeMenus();
  };

  const openVisibilityInstancesDialog = (): void => {
    setWorkspaceClassDialog({
      type: 'visibility',
      selectedClassIds: [],
      search: '',
      value: 'show',
      scope: selectedImage ? 'currentImage' : hasBookmarkedImages ? 'bookmarkedImages' : 'allImages',
    });
    closeMenus();
  };

  const openAnnotationScopeDialog = (
    type: NonNullable<AnnotationScopeDialog>['type']
  ): void => {
    const scope = selectedImage ? 'currentImage' : hasBookmarkedImages ? 'bookmarkedImages' : 'allImages';
    if (type === 'visibility') {
      setAnnotationScopeDialog({
        type,
        scope,
        visibilityValue: 'show',
      });
    } else if (type === 'anchoring') {
      setAnnotationScopeDialog({
        type,
        scope,
        anchoringValue: 'anchor',
      });
    } else {
      setAnnotationScopeDialog({
        type,
        scope,
      });
    }
    closeMenus();
  };

  const runAnnotationScopeOperation = async (): Promise<void> => {
    if (!annotationScopeDialog) return;
    const scope = annotationScopeDialog.scope;
    if (annotationScopeDialog.type === 'removeAll') {
      if (scope === 'currentImage') await removeAllBBoxes();
      else if (scope === 'bookmarkedImages') await removeAllBBoxesBookmarked();
      else await removeAllBBoxesGlobal();
      setAnnotationScopeDialog(null);
      return;
    }
    if (annotationScopeDialog.type === 'visibility') {
      const visible = annotationScopeDialog.visibilityValue !== 'hide';
      if (scope === 'currentImage') {
        setAllVisibilityCurrentImage(visible);
      } else {
        setClassInstancesVisibility(classes.map((cls) => cls.id), visible, scope);
      }
      setAnnotationScopeDialog(null);
      return;
    }
    const anchored = annotationScopeDialog.anchoringValue !== 'unanchor';
    if (scope === 'currentImage') {
      setAllAnchoringCurrentImage(anchored);
    } else {
      setClassInstancesAnchoring(classes.map((cls) => cls.id), anchored, scope);
    }
    setAnnotationScopeDialog(null);
  };

  const toggleWorkspaceDialogClass = (classId: string): void => {
    setWorkspaceClassDialog((prev) => {
      if (!prev) return prev;
      const exists = prev.selectedClassIds.includes(classId);
      const selectedClassIds = exists
        ? prev.selectedClassIds.filter((id) => id !== classId)
        : [...prev.selectedClassIds, classId];
      if (prev.type !== 'swap') {
        return { ...prev, selectedClassIds };
      }
      const swapTargets = classes.filter((cls) => !selectedClassIds.includes(cls.id));
      const targetClassId = swapTargets.some((cls) => cls.id === prev.targetClassId)
        ? prev.targetClassId
        : swapTargets[0]?.id ?? '';
      return { ...prev, selectedClassIds, targetClassId };
    });
  };

  const selectAllVisibleDialogClasses = (): void => {
    setWorkspaceClassDialog((prev) => {
      if (!prev) return prev;
      const query = prev.search.trim().toLowerCase();
      const visibleClassIds = classes
        .filter((cls) => cls.name.toLowerCase().includes(query))
        .map((cls) => cls.id);
      const selectedClassIds = [...new Set([...prev.selectedClassIds, ...visibleClassIds])];
      if (prev.type !== 'swap') {
        return { ...prev, selectedClassIds };
      }
      const swapTargets = classes.filter((cls) => !selectedClassIds.includes(cls.id));
      const targetClassId = swapTargets.some((cls) => cls.id === prev.targetClassId)
        ? prev.targetClassId
        : swapTargets[0]?.id ?? '';
      return { ...prev, selectedClassIds, targetClassId };
    });
  };

  const clearDialogClassSelection = (): void => {
    setWorkspaceClassDialog((prev) => {
      if (!prev) return prev;
      if (prev.type !== 'swap') {
        return { ...prev, selectedClassIds: [] };
      }
      const firstClassId = classes[0]?.id ?? '';
      return { ...prev, selectedClassIds: [], targetClassId: firstClassId };
    });
  };

  const runSwapInstances = (scope: 'currentImage' | 'bookmarkedImages' | 'allImages'): void => {
    if (!workspaceClassDialog || workspaceClassDialog.type !== 'swap') return;
    if (workspaceClassDialog.selectedClassIds.length === 0) {
      setStatusText('Select at least one source class.');
      return;
    }
    if (!hasValidSwapTarget) {
      setStatusText('Pick a valid target class.');
      return;
    }
    swapClassInstances(workspaceClassDialog.selectedClassIds, workspaceClassDialog.targetClassId, scope);
    setWorkspaceClassDialog(null);
  };

  const runRemoveInstances = (scope: 'currentImage' | 'bookmarkedImages' | 'allImages'): void => {
    if (!workspaceClassDialog || workspaceClassDialog.type !== 'remove') return;
    if (workspaceClassDialog.selectedClassIds.length === 0) {
      setStatusText('Select at least one class.');
      return;
    }
    removeClassInstances(workspaceClassDialog.selectedClassIds, scope);
    setWorkspaceClassDialog(null);
  };

  const runAnchoringInstances = (scope: 'currentImage' | 'bookmarkedImages' | 'allImages'): void => {
    if (!workspaceClassDialog || workspaceClassDialog.type !== 'anchoring') return;
    if (workspaceClassDialog.selectedClassIds.length === 0) {
      setStatusText('Select at least one class.');
      return;
    }
    setClassInstancesAnchoring(
      workspaceClassDialog.selectedClassIds,
      workspaceClassDialog.value === 'anchor',
      scope
    );
    setWorkspaceClassDialog(null);
  };

  const runVisibilityInstances = (scope: 'currentImage' | 'bookmarkedImages' | 'allImages'): void => {
    if (!workspaceClassDialog || workspaceClassDialog.type !== 'visibility') return;
    if (workspaceClassDialog.selectedClassIds.length === 0) {
      setStatusText('Select at least one class.');
      return;
    }
    setClassInstancesVisibility(
      workspaceClassDialog.selectedClassIds,
      workspaceClassDialog.value === 'show',
      scope
    );
    setWorkspaceClassDialog(null);
  };

  const runWorkspaceClassOperation = (): void => {
    if (!workspaceClassDialog) return;
    const scope = workspaceClassDialog.scope;
    if (workspaceClassDialog.type === 'swap') {
      runSwapInstances(scope);
      return;
    }
    if (workspaceClassDialog.type === 'remove') {
      runRemoveInstances(scope);
      return;
    }
    if (workspaceClassDialog.type === 'anchoring') {
      runAnchoringInstances(scope);
      return;
    }
    runVisibilityInstances(scope);
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
      if (e.key !== 'Escape') return;

      setOpenMenu(null);

      if (workspaceClassDialog) {
        e.preventDefault();
        setWorkspaceClassDialog(null);
        return;
      }

      if (annotationScopeDialog) {
        e.preventDefault();
        setAnnotationScopeDialog(null);
        return;
      }

      if (statisticsOpen) {
        e.preventDefault();
        setStatisticsOpen(false);
        return;
      }

      if (exportDialog) {
        e.preventDefault();
        setExportDialog(null);
        return;
      }

      if (confirmCloseSettings) {
        e.preventDefault();
        setConfirmCloseSettings(false);
        return;
      }

      if (videoImportDialog && !videoImportBusy) {
        e.preventDefault();
        setVideoImportDialog(null);
        return;
      }

      if (settingsOpen) {
        e.preventDefault();
        if (hasPendingSettingsChanges) {
          setConfirmCloseSettings(true);
        } else {
          closeSettingsDialog();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    confirmCloseSettings,
    exportDialog,
    hasPendingSettingsChanges,
    settingsOpen,
    videoImportBusy,
    videoImportDialog,
    annotationScopeDialog,
    statisticsOpen,
    workspaceClassDialog,
  ]);

  useEffect(() => {
    if (
      !settingsOpen &&
      !videoImportDialog &&
      !workspaceClassDialog &&
      !annotationScopeDialog &&
      !statisticsOpen &&
      !exportDialog &&
      !pendingExport
    ) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [
    settingsOpen,
    videoImportDialog,
    workspaceClassDialog,
    annotationScopeDialog,
    statisticsOpen,
    exportDialog,
    pendingExport,
  ]);

  useEffect(() => {
    if (!videoImportDialog) {
      setVideoInputDraft(null);
      return;
    }
    syncVideoDraft(videoImportDialog);
  }, [videoImportDialog]);

  useEffect(() => {
    if (!workspaceClassDialog) return;
    const validClassIds = new Set(classes.map((cls) => cls.id));
    const selectedClassIds = workspaceClassDialog.selectedClassIds.filter((id) => validClassIds.has(id));
    const selectedChanged =
      selectedClassIds.length !== workspaceClassDialog.selectedClassIds.length ||
      selectedClassIds.some((id, index) => id !== workspaceClassDialog.selectedClassIds[index]);
    if (workspaceClassDialog.type !== 'swap') {
      if (selectedChanged) {
        setWorkspaceClassDialog({ ...workspaceClassDialog, selectedClassIds });
      }
      return;
    }
    const swapTargets = classes.filter((cls) => !selectedClassIds.includes(cls.id));
    const targetClassId = swapTargets.some((cls) => cls.id === workspaceClassDialog.targetClassId)
      ? workspaceClassDialog.targetClassId
      : swapTargets[0]?.id ?? '';
    if (selectedChanged || targetClassId !== workspaceClassDialog.targetClassId) {
      setWorkspaceClassDialog({ ...workspaceClassDialog, selectedClassIds, targetClassId });
    }
  }, [classes, workspaceClassDialog]);

  useEffect(() => {
    if (!statusText) return;
    // Status text is transient feedback; auto-clear to avoid stale warnings.
    const id = window.setTimeout(() => setStatusText(null), 7600);
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
                <button onClick={() => runAndClose(exportWorkspaceState)}>Export workspace state</button>
                <button onClick={() => runAndClose(exportClassesTxt)}>Export classes</button>
                <div className="menu-group-label menu-group-label-separator">Export annotations</div>
                <button onClick={openAllFormatsExportDialog} disabled={!hasImages}>
                  Export all formats
                </button>
                <button onClick={() => openSingleExportDialog('coco')} disabled={!hasImages}>
                  Export COCO
                </button>
                <button onClick={() => openSingleExportDialog('yolo')} disabled={!hasImages}>
                  Export YOLO
                </button>
                <button onClick={() => openSingleExportDialog('voc')} disabled={!hasImages}>
                  Export VOC
                </button>
              </div>
            )}
          </div>

          <div className={`menu ${openMenu === 'edit' ? 'open' : ''}`}>
            <button ref={(el) => (buttonRefs.current.edit = el)} className="menu-trigger" onClick={() => toggleMenu('edit')}>
              Edit
            </button>
            {openMenu === 'edit' && (
              <div ref={(el) => (popoverRefs.current.edit = el)} className="menu-popover">
                <button onClick={() => runAndClose(async () => undo())} disabled={!canUndo}>
                  Undo
                </button>
                <button onClick={() => runAndClose(async () => redo())} disabled={!canRedo}>
                  Redo
                </button>
                <div className="menu-group-label menu-group-label-separator">Annotations</div>
                <button onClick={() => runAndClose(async () => removeLastBBox())} disabled={!hasCurrentImageAnnotations}>
                  Remove last annotation (current image)
                </button>
                <button onClick={() => openAnnotationScopeDialog('removeAll')} disabled={!hasGlobalAnnotations}>
                  Remove all annotations
                </button>
                <button onClick={() => openAnnotationScopeDialog('visibility')} disabled={!hasGlobalAnnotations}>
                  Toggle visibility
                </button>
                <button onClick={() => openAnnotationScopeDialog('anchoring')} disabled={!hasGlobalAnnotations}>
                  Toggle anchoring
                </button>

                <div className="menu-group-label menu-group-label-separator">Classes</div>
                <button onClick={openSwapInstancesDialog} disabled={!hasGlobalAnnotations}>
                  Swap instances of classes
                </button>
                <button onClick={openRemoveInstancesDialog} disabled={!hasGlobalAnnotations}>
                  Remove instances of classes
                </button>
                <button onClick={openAnchoringInstancesDialog} disabled={!hasGlobalAnnotations}>
                  Set anchoring for class instances
                </button>
                <button onClick={openVisibilityInstancesDialog} disabled={!hasGlobalAnnotations}>
                  Set visibility for class instances
                </button>

                <div className="menu-group-label menu-group-label-separator">Workspace</div>
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
              setConfirmCloseSettings(false);
              setSettingsOpen(true);
            }}
          >
            Settings
          </button>
          <button onClick={openStatisticsDialog}>Statistics</button>
        </div>
        <div className="topbar-status">{statusText ?? ''}</div>
      </header>
      {statisticsOpen && (
        <div className="modal-backdrop" onClick={() => setStatisticsOpen(false)}>
          <div className="modal-card statistics-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Statistics</h3>
            <div className="row">
              <button
                className={statisticsScope === 'currentImage' ? 'active' : ''}
                onClick={() => setStatisticsScope('currentImage')}
                disabled={!selectedImage}
              >
                Current image
              </button>
              <button
                className={statisticsScope === 'bookmarkedImages' ? 'active' : ''}
                onClick={() => setStatisticsScope('bookmarkedImages')}
                disabled={!hasBookmarkedImages}
              >
                Bookmarked images
              </button>
              <button
                className={statisticsScope === 'allImages' ? 'active' : ''}
                onClick={() => setStatisticsScope('allImages')}
                disabled={!hasImages}
              >
                All images
              </button>
            </div>
            <div className="statistics-summary-grid">
              <div className="statistics-card">
                <div className="statistics-card-label">Images</div>
                <div className="statistics-card-value">{statisticsData.imagesCount}</div>
              </div>
              <div className="statistics-card">
                <div className="statistics-card-label">Classes</div>
                <div className="statistics-card-value">{statisticsData.classesCount}</div>
              </div>
              <div className="statistics-card">
                <div className="statistics-card-label">Annotations (total)</div>
                <div className="statistics-card-value">{statisticsData.totalAnnotations}</div>
              </div>
              <div className="statistics-card">
                <div className="statistics-card-label">Unassigned annotations</div>
                <div className="statistics-card-value">{statisticsData.totalUnassigned}</div>
              </div>
            </div>

            <section className="statistics-section">
              <h4>Class instances</h4>
              <div className="statistics-table-wrap">
                <table className="statistics-table statistics-table-class">
                  <colgroup>
                    <col />
                    <col className="statistics-col-num" />
                    <col className="statistics-col-num" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th className="statistics-num-head">Instances</th>
                      <th className="statistics-num-head">Percent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statisticsData.classRows.map((row) => (
                      <tr key={row.id}>
                        <td className="statistics-name-cell" title={row.name}>
                          <div className="statistics-name-wrap">
                            <span className="color-dot" style={{ background: row.color }} />
                            <span className="statistics-name-text">
                              {row.name}
                              {row.isDefault ? ' (Unassigned)' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="statistics-num">{row.count}</td>
                        <td className="statistics-num">{row.percentage.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="statistics-section">
              <h4>Per-image annotations</h4>
              <div className="statistics-table-wrap">
                <table className="statistics-table statistics-table-image">
                  <colgroup>
                    <col />
                    <col className="statistics-col-num" />
                    <col className="statistics-col-num" />
                    <col className="statistics-col-num" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th className="statistics-num-head">Annotations</th>
                      <th className="statistics-num-head">Unassigned</th>
                      <th className="statistics-num-head">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statisticsData.perImageRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="statistics-empty-cell">
                          No images in selected scope.
                        </td>
                      </tr>
                    ) : (
                      statisticsData.perImageRows.map((row) => (
                        <tr key={row.id}>
                          <td className="statistics-name-cell" title={row.name}>
                            <div className="statistics-name-wrap">
                              <span className="statistics-name-text">{row.name}</span>
                            </div>
                          </td>
                          <td className="statistics-num">{row.total}</td>
                          <td className="statistics-num">{row.unassigned}</td>
                          <td className="statistics-num">{row.assigned}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="row dialog-actions">
              <button onClick={() => setStatisticsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Settings</h3>
            <SettingsTab variant="dialog" />
            <div className="row dialog-actions">
              <button
                onClick={() => {
                  abortSettingsChanges();
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setInteractionMode('edit');
                  setAddingMode('click');
                  setClassAssignmentMode('activeClass');
                  setFastClassSwapMode(false);
                  setShowLabels(true);
                  setBBoxOpacity(0.2);
                  setLineThickness(2);
                  setDrawBoxFill(true);
                  setDrawBoxBorder(true);
                  setShowCrosshair(true);
                  setDragDeadzonePx(4);
                  setInferenceModelUrl('/models/yolo26n.onnx');
                  setExportIncludeUnassigned(false);
                  setSuppressDeleteAnn(false);
                  setSuppressDeleteImage(false);
                  setSuppressRemoveInstances(false);
                }}
              >
                Revert to default
              </button>
              <button onClick={() => closeSettingsDialog()} disabled={!hasPendingSettingsChanges}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmCloseSettings && settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Unsaved settings changes</h3>
            <p>You have pending changes in settings. What do you want to do?</p>
            <div className="row dialog-actions">
              <button onClick={() => setConfirmCloseSettings(false)}>Cancel</button>
              <button onClick={() => abortSettingsChanges()}>Abort changes</button>
              <button onClick={() => closeSettingsDialog()}>Save changes</button>
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
      {annotationScopeDialog && (
        <div className="modal-backdrop" onClick={() => setAnnotationScopeDialog(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>
                  {annotationScopeDialog.type === 'removeAll'
                    ? 'Remove all annotations'
                    : annotationScopeDialog.type === 'visibility'
                      ? 'Toggle visibility'
                      : 'Toggle anchoring'}
                </h4>
                <p>Choose scope of this operation.</p>
                <div className="row">
                  <button
                    className={annotationScopeDialog.scope === 'currentImage' ? 'active' : ''}
                    onClick={() =>
                      setAnnotationScopeDialog((prev) => (prev ? { ...prev, scope: 'currentImage' } : prev))
                    }
                    disabled={!hasCurrentImageAnnotations}
                  >
                    Current image
                  </button>
                  <button
                    className={annotationScopeDialog.scope === 'bookmarkedImages' ? 'active' : ''}
                    onClick={() =>
                      setAnnotationScopeDialog((prev) => (prev ? { ...prev, scope: 'bookmarkedImages' } : prev))
                    }
                    disabled={!hasBookmarkedAnnotations}
                  >
                    Bookmarked images
                  </button>
                  <button
                    className={annotationScopeDialog.scope === 'allImages' ? 'active' : ''}
                    onClick={() =>
                      setAnnotationScopeDialog((prev) => (prev ? { ...prev, scope: 'allImages' } : prev))
                    }
                    disabled={!hasGlobalAnnotations}
                  >
                    All images
                  </button>
                </div>
                {annotationScopeDialog.type === 'visibility' && (
                  <label>
                    Action
                    <div className="row">
                      <button
                        type="button"
                        className={annotationScopeDialog.visibilityValue === 'show' ? 'active' : ''}
                        aria-label="Show"
                        onClick={() =>
                          setAnnotationScopeDialog((prev) =>
                            prev && prev.type === 'visibility'
                              ? { ...prev, visibilityValue: 'show' }
                              : prev
                          )
                        }
                      >
                        Show
                      </button>
                      <button
                        type="button"
                        className={annotationScopeDialog.visibilityValue === 'hide' ? 'active' : ''}
                        aria-label="Hide"
                        onClick={() =>
                          setAnnotationScopeDialog((prev) =>
                            prev && prev.type === 'visibility'
                              ? { ...prev, visibilityValue: 'hide' }
                              : prev
                          )
                        }
                      >
                        Hide
                      </button>
                    </div>
                  </label>
                )}
                {annotationScopeDialog.type === 'anchoring' && (
                  <label>
                    Action
                    <div className="row">
                      <button
                        type="button"
                        className={annotationScopeDialog.anchoringValue === 'anchor' ? 'active' : ''}
                        aria-label="Anchor"
                        onClick={() =>
                          setAnnotationScopeDialog((prev) =>
                            prev && prev.type === 'anchoring'
                              ? { ...prev, anchoringValue: 'anchor' }
                              : prev
                          )
                        }
                      >
                        Anchor
                      </button>
                      <button
                        type="button"
                        className={annotationScopeDialog.anchoringValue === 'unanchor' ? 'active' : ''}
                        aria-label="Unanchor"
                        onClick={() =>
                          setAnnotationScopeDialog((prev) =>
                            prev && prev.type === 'anchoring'
                              ? { ...prev, anchoringValue: 'unanchor' }
                              : prev
                          )
                        }
                      >
                        Unanchor
                      </button>
                    </div>
                  </label>
                )}
                <div className="row dialog-actions">
                  <button onClick={() => setAnnotationScopeDialog(null)}>Cancel</button>
                  <button
                    onClick={() => void runAnnotationScopeOperation()}
                    disabled={!hasAnnotationsForScope(annotationScopeDialog.scope)}
                  >
                    Continue
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {workspaceClassDialog && (
        <div className="modal-backdrop" onClick={() => setWorkspaceClassDialog(null)}>
          <div className="modal-card workspace-class-op-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>
                  {workspaceClassDialog.type === 'swap'
                    ? 'Swap instances of classes'
                    : workspaceClassDialog.type === 'remove'
                      ? 'Remove instances of classes'
                      : workspaceClassDialog.type === 'anchoring'
                        ? 'Set anchoring for class instances'
                        : 'Set visibility for class instances'}
                </h4>
                <p>
                  {workspaceClassDialog.type === 'swap'
                    ? 'Select one or more source classes and a target class.'
                    : workspaceClassDialog.type === 'remove'
                      ? 'Select one or more classes whose annotation instances should be removed.'
                      : workspaceClassDialog.type === 'anchoring'
                        ? 'Select classes and choose whether their instances should be anchored or unanchored.'
                        : 'Select classes and choose whether their instances should be shown or hidden.'}
                </p>
                <div className="row">
                  <button
                    className={workspaceClassDialog.scope === 'currentImage' ? 'active' : ''}
                    onClick={() =>
                      setWorkspaceClassDialog((prev) => (prev ? { ...prev, scope: 'currentImage' } : prev))
                    }
                    disabled={!hasSelectedImageForClassOps}
                  >
                    Current image
                  </button>
                  <button
                    className={workspaceClassDialog.scope === 'bookmarkedImages' ? 'active' : ''}
                    onClick={() =>
                      setWorkspaceClassDialog((prev) => (prev ? { ...prev, scope: 'bookmarkedImages' } : prev))
                    }
                    disabled={!hasBookmarkedImages}
                  >
                    Bookmarked images
                  </button>
                  <button
                    className={workspaceClassDialog.scope === 'allImages' ? 'active' : ''}
                    onClick={() =>
                      setWorkspaceClassDialog((prev) => (prev ? { ...prev, scope: 'allImages' } : prev))
                    }
                    disabled={!hasImages}
                  >
                    All images
                  </button>
                </div>
                <label>
                  Search classes
                  <input
                    type="text"
                    value={workspaceClassDialog.search}
                    onChange={(e) =>
                      setWorkspaceClassDialog((prev) => (prev ? { ...prev, search: e.target.value } : prev))
                    }
                    placeholder="Filter classes"
                  />
                </label>
                <div className="row class-filter-actions">
                  <button type="button" onClick={selectAllVisibleDialogClasses} disabled={workspaceDialogClasses.length === 0}>
                    Select all visible
                  </button>
                  <button
                    type="button"
                    onClick={clearDialogClassSelection}
                    disabled={workspaceClassDialog.selectedClassIds.length === 0}
                  >
                    Clear
                  </button>
                </div>
                <div className="workspace-class-picker-list">
                  {workspaceDialogClasses.length === 0 && <div className="class-filter-empty">No matching classes.</div>}
                  {workspaceDialogClasses.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      className={`class-filter-option ${selectedDialogClassSet.has(cls.id) ? 'selected' : ''}`}
                      onClick={() => toggleWorkspaceDialogClass(cls.id)}
                    >
                      <span className="class-filter-check" aria-hidden="true">
                        {selectedDialogClassSet.has(cls.id) ? '✓' : ''}
                      </span>
                      <span className="color-dot" style={{ background: cls.color }} />
                      <span className="class-filter-option-name">{cls.name}</span>
                    </button>
                  ))}
                </div>

                {workspaceClassDialog.type === 'swap' && (
                  <label>
                    Target class
                    <select
                      value={workspaceClassDialog.targetClassId}
                      onChange={(e) =>
                        setWorkspaceClassDialog((prev) =>
                          prev && prev.type === 'swap'
                            ? { ...prev, targetClassId: e.target.value }
                            : prev
                        )
                      }
                    >
                      {workspaceDialogSwapTargets.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {workspaceClassDialog.type === 'anchoring' && (
                  <label>
                    Action
                    <div className="row">
                      <button
                        type="button"
                        className={workspaceClassDialog.value === 'anchor' ? 'active' : ''}
                        onClick={() =>
                          setWorkspaceClassDialog((prev) =>
                            prev && prev.type === 'anchoring'
                              ? { ...prev, value: 'anchor' }
                              : prev
                          )
                        }
                      >
                        Anchor
                      </button>
                      <button
                        type="button"
                        className={workspaceClassDialog.value === 'unanchor' ? 'active' : ''}
                        onClick={() =>
                          setWorkspaceClassDialog((prev) =>
                            prev && prev.type === 'anchoring'
                              ? { ...prev, value: 'unanchor' }
                              : prev
                          )
                        }
                      >
                        Unanchor
                      </button>
                    </div>
                  </label>
                )}
                {workspaceClassDialog.type === 'visibility' && (
                  <label>
                    Action
                    <div className="row">
                      <button
                        type="button"
                        className={workspaceClassDialog.value === 'show' ? 'active' : ''}
                        onClick={() =>
                          setWorkspaceClassDialog((prev) =>
                            prev && prev.type === 'visibility'
                              ? { ...prev, value: 'show' }
                              : prev
                          )
                        }
                      >
                        Show
                      </button>
                      <button
                        type="button"
                        className={workspaceClassDialog.value === 'hide' ? 'active' : ''}
                        onClick={() =>
                          setWorkspaceClassDialog((prev) =>
                            prev && prev.type === 'visibility'
                              ? { ...prev, value: 'hide' }
                              : prev
                          )
                        }
                      >
                        Hide
                      </button>
                    </div>
                  </label>
                )}

                <div className="row dialog-actions">
                  <button onClick={() => setWorkspaceClassDialog(null)}>Cancel</button>
                  <button
                    onClick={() => runWorkspaceClassOperation()}
                    disabled={!canRunWorkspaceClassOperationForScope(workspaceClassDialog.scope)}
                  >
                    Continue
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {exportDialog && (
        <div className="modal-backdrop" onClick={() => setExportDialog(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>
                  {exportDialog.kind === 'single'
                    ? `Export ${exportDialog.format.toUpperCase()}`
                    : 'Export all formats'}
                </h4>
                <p>Choose what image scope to export.</p>
                <div className="row">
                  <button
                    className={exportDialog.scope === 'currentImage' ? 'active' : ''}
                    onClick={() => setExportDialog((prev) => (prev ? { ...prev, scope: 'currentImage' } : prev))}
                    disabled={!selectedImage}
                  >
                    Current image
                  </button>
                  <button
                    className={exportDialog.scope === 'bookmarkedImages' ? 'active' : ''}
                    onClick={() => setExportDialog((prev) => (prev ? { ...prev, scope: 'bookmarkedImages' } : prev))}
                    disabled={!hasBookmarkedImages}
                  >
                    Bookmarked images
                  </button>
                  <button
                    className={exportDialog.scope === 'allImages' ? 'active' : ''}
                    onClick={() => setExportDialog((prev) => (prev ? { ...prev, scope: 'allImages' } : prev))}
                    disabled={!hasImages}
                  >
                    All images
                  </button>
                </div>
                {exportDialog.kind === 'allFormats' && (
                  <label>
                    Output folder name
                    <input
                      type="text"
                      value={exportDialog.folderName}
                      onChange={(e) =>
                        setExportDialog((prev) =>
                          prev && prev.kind === 'allFormats'
                            ? { ...prev, folderName: e.target.value }
                            : prev
                        )
                      }
                      placeholder="annotation_exports"
                    />
                  </label>
                )}
                <h5>Image naming</h5>
                <div className="row">
                  <button
                    className={exportDialog.namingMode === 'original' ? 'active' : ''}
                    onClick={() =>
                      setExportDialog((prev) => (prev ? { ...prev, namingMode: 'original' } : prev))
                    }
                  >
                    Keep original names
                  </button>
                  <button
                    className={exportDialog.namingMode === 'sequential' ? 'active' : ''}
                    onClick={() =>
                      setExportDialog((prev) => (prev ? { ...prev, namingMode: 'sequential' } : prev))
                    }
                  >
                    Sequential
                  </button>
                </div>
                {exportDialog.namingMode === 'sequential' && (
                  <div className="row wrap export-naming-row">
                    <label className="export-naming-base">
                      Base name
                      <input
                        type="text"
                        value={exportDialog.namingBase}
                        onChange={(e) =>
                          setExportDialog((prev) => (prev ? { ...prev, namingBase: e.target.value } : prev))
                        }
                        placeholder="image"
                      />
                    </label>
                    <label className="export-naming-preview">
                      Preview
                      <input type="text" value={sequentialNamingPreview} readOnly aria-label="Sequential name preview" />
                    </label>
                  </div>
                )}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={exportDialog.convertImages}
                    onChange={(e) =>
                      setExportDialog((prev) => (prev ? { ...prev, convertImages: e.target.checked } : prev))
                    }
                  />
                  <span>Convert images on export</span>
                </label>
                {exportDialog.convertImages && (
                  <label>
                    Target image format
                    <select
                      value={exportDialog.convertFormat}
                      onChange={(e) =>
                        setExportDialog((prev) =>
                          prev ? { ...prev, convertFormat: e.target.value === 'jpeg' ? 'jpeg' : 'png' } : prev
                        )
                      }
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                    </select>
                  </label>
                )}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={exportDialog.includeUnassigned}
                    onChange={(e) => {
                      const nextValue = e.target.checked;
                      setExportDialog((prev) => (prev ? { ...prev, includeUnassigned: nextValue } : prev));
                      setExportIncludeUnassigned(nextValue);
                    }}
                  />
                  <span>Export unassigned class</span>
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={exportDialog.includeImagesWithoutAnnotations}
                    onChange={(e) =>
                      setExportDialog((prev) =>
                        prev ? { ...prev, includeImagesWithoutAnnotations: e.target.checked } : prev
                      )
                    }
                  />
                  <span className="inline-check-body export-count-body">
                    <span>Include images without annotations</span>
                    <span className="inline-check-meta export-count-meta">
                      {exportDialogStats
                        ? `${exportDialogStats.willExport}/${exportDialogStats.openTotal} open images will be exported (${exportDialogStats.mappedAnnotatedInScope}/${exportDialogStats.scopeTotal} in scope have selected classes)`
                        : 'No images available'}
                    </span>
                  </span>
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={exportDialog.includeOriginalNameMetadata}
                    onChange={(e) =>
                      setExportDialog((prev) =>
                        prev ? { ...prev, includeOriginalNameMetadata: e.target.checked } : prev
                      )
                    }
                  />
                  <span>Include original image names in metadata</span>
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={exportDialog.sanitizeImageMetadata}
                    onChange={(e) =>
                      setExportDialog((prev) =>
                        prev ? { ...prev, sanitizeImageMetadata: e.target.checked } : prev
                      )
                    }
                  />
                  <span>Sanitize image metadata (EXIF/device data)</span>
                </label>
                <div className="row dialog-actions">
                  <button onClick={() => setExportDialog(null)}>Cancel</button>
                  <button
                    onClick={() => void confirmExportDialog()}
                    disabled={
                      !hasImagesForScope(exportDialog.scope) ||
                      (exportDialog.kind === 'allFormats' && exportDialog.folderName.trim().length === 0)
                    }
                  >
                    Continue
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
                <h4>Export summary</h4>
                <div className="export-warning-list" role="list">
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Format</span>
                    <span className="export-warning-value">
                      {pendingExport.kind === 'single'
                        ? pendingExport.format.toUpperCase()
                        : 'All (COCO, YOLO, VOC)'}
                    </span>
                  </div>
                  {pendingExport.kind === 'allFormats' ? (
                    <div className="export-warning-row" role="listitem">
                      <span className="export-warning-key">Output folder</span>
                      <span className="export-warning-value">{pendingExport.folderName}</span>
                    </div>
                  ) : null}
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Export scope</span>
                    <span className="export-warning-value">
                      {pendingExport.scope === 'currentImage'
                        ? 'Current image'
                        : pendingExport.scope === 'bookmarkedImages'
                          ? 'Bookmarked images'
                          : 'All images'}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Image naming</span>
                    <span className="export-warning-value">
                      {pendingExport.namingMode === 'original'
                        ? 'Keep original names'
                        : `Sequential (${pendingExport.namingBase || 'image'}_N)`}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Image conversion</span>
                    <span className="export-warning-value">
                      {pendingExport.convertImages
                        ? pendingExport.convertFormat === 'jpeg'
                          ? 'JPEG'
                          : 'PNG'
                        : 'None'}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Include images without annotations</span>
                    <span className="export-warning-value">
                      {pendingExport.includeImagesWithoutAnnotations ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Images to export</span>
                    <span className="export-warning-value">
                      {pendingExportStats
                        ? `${pendingExportStats.willExport}/${pendingExportStats.openTotal}`
                        : `0/${images.length}`}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Class-mapped images in scope</span>
                    <span className="export-warning-value">
                      {pendingExportStats
                        ? `${pendingExportStats.mappedAnnotatedInScope}/${pendingExportStats.scopeTotal}`
                        : '0/0'}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Original name metadata</span>
                    <span className="export-warning-value">
                      {pendingExport.includeOriginalNameMetadata ? 'Included' : 'Not included'}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Image metadata sanitization</span>
                    <span className="export-warning-value">
                      {pendingExport.sanitizeImageMetadata ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="export-warning-row" role="listitem">
                    <span className="export-warning-key">Unassigned class export</span>
                    <span className="export-warning-value">
                      {pendingExport.includeUnassigned ? 'Will be exported' : 'Will not be exported'}
                    </span>
                  </div>
                </div>
                <div className="row dialog-actions">
                  <button onClick={() => setPendingExport(null)}>Cancel</button>
                  <button
                    onClick={() => {
                      setExportDialog(pendingExport);
                      setPendingExport(null);
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      await executeExportRequest(pendingExport);
                      setPendingExport(null);
                    }}
                  >
                    Continue
                  </button>
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
