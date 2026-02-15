import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Text, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import { ImageItem, BBox } from '../domain/types';
import { useAppStore } from '../store/appStore';
import { PortalMenu } from './common/PortalMenu';

const MIN_ZOOM_ABSOLUTE = 0.02;
const MAX_ZOOM_ABSOLUTE = 64;
const MIN_ZOOM_FIT_MULTIPLIER = 0.1;
const MAX_ZOOM_FIT_MULTIPLIER = 10;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Clamp any bbox-like input to image coordinates while preserving minimum valid size.
function clampBBoxToImage(b: BBox, image: ImageItem): BBox {
  const x = Math.max(0, Math.min(image.width, b.x));
  const y = Math.max(0, Math.min(image.height, b.y));
  const width = Math.max(1, Math.min(image.width - x, b.width));
  const height = Math.max(1, Math.min(image.height - y, b.height));
  return { x, y, width, height };
}

function clampMovedBBox(b: BBox, image: ImageItem): BBox {
  const width = Math.max(1, Math.min(image.width, b.width));
  const height = Math.max(1, Math.min(image.height, b.height));
  const x = Math.max(0, Math.min(image.width - width, b.x));
  const y = Math.max(0, Math.min(image.height - height, b.y));
  return { x, y, width, height };
}

// Convert viewport pointer to image-space coordinates using stage transform inversion.
function getPointOnImage(stage: Konva.Stage): { x: number; y: number } | null {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;

  const transform = stage.getAbsoluteTransform().copy();
  transform.invert();
  const pos = transform.point(pointer);

  return { x: pos.x, y: pos.y };
}

function isPointInsideImage(p: { x: number; y: number }, image: ImageItem): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= image.width && p.y <= image.height;
}

function boxesIntersect(a: BBox, b: BBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clampAbsoluteDragPos(
  absPos: { x: number; y: number },
  image: ImageItem,
  bbox: BBox,
  stage: Konva.Stage | null
): { x: number; y: number } {
  if (!stage) return absPos;

  const toLocal = stage.getAbsoluteTransform().copy().invert();
  const local = toLocal.point(absPos);

  const clampedLocal = {
    x: Math.max(0, Math.min(image.width - bbox.width, local.x)),
    y: Math.max(0, Math.min(image.height - bbox.height, local.y)),
  };

  const toAbs = stage.getAbsoluteTransform().copy();
  return toAbs.point(clampedLocal);
}

// Clamp transformer bounds in image space, then map back to absolute screen space.
function clampAbsoluteTransformBox(
  box: { x: number; y: number; width: number; height: number; rotation?: number },
  oldBox: { x: number; y: number; width: number; height: number; rotation?: number },
  image: ImageItem,
  stage: Konva.Stage | null
): { x: number; y: number; width: number; height: number; rotation: number } {
  if (!stage) {
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: box.rotation ?? 0,
    };
  }

  const toLocal = stage.getAbsoluteTransform().copy().invert();
  const p1 = toLocal.point({ x: box.x, y: box.y });
  const p2 = toLocal.point({ x: box.x + box.width, y: box.y + box.height });

  const left = Math.min(p1.x, p2.x);
  const right = Math.max(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const bottom = Math.max(p1.y, p2.y);

  const clampedLeft = Math.max(0, Math.min(image.width - 2, left));
  const clampedRight = Math.max(clampedLeft + 2, Math.min(image.width, right));
  const clampedTop = Math.max(0, Math.min(image.height - 2, top));
  const clampedBottom = Math.max(clampedTop + 2, Math.min(image.height, bottom));

  const clampedW = clampedRight - clampedLeft;
  const clampedH = clampedBottom - clampedTop;

  if (clampedW < 2 || clampedH < 2) {
    return {
      x: oldBox.x,
      y: oldBox.y,
      width: oldBox.width,
      height: oldBox.height,
      rotation: oldBox.rotation ?? 0,
    };
  }

  const toAbs = stage.getAbsoluteTransform().copy();
  const absPos1 = toAbs.point({ x: clampedLeft, y: clampedTop });
  const absPos2 = toAbs.point({ x: clampedRight, y: clampedBottom });

  return {
    x: Math.min(absPos1.x, absPos2.x),
    y: Math.min(absPos1.y, absPos2.y),
    width: Math.abs(absPos2.x - absPos1.x),
    height: Math.abs(absPos2.y - absPos1.y),
    rotation: box.rotation ?? oldBox.rotation ?? 0,
  };
}

export function WorkspaceCanvas({ image }: { image: ImageItem }): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const rectRefs = useRef<Record<string, Konva.Rect | null>>({});
  const labelRefs = useRef<Record<string, Konva.Text | null>>({});
  const anchorRefs = useRef<Record<string, Konva.Text | null>>({});
  const borderRefs = useRef<Record<string, Konva.Rect | null>>({});
  const selectedRefs = useRef<Record<string, Konva.Rect | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  const interactionMode = useAppStore((s) => s.interactionMode);
  const addingMode = useAppStore((s) => s.addingMode);
  const classAssignmentMode = useAppStore((s) => s.classAssignmentMode);
  const selectedAnnotationId = useAppStore((s) => s.selectedAnnotationId);
  const selectedAnnotationIds = useAppStore((s) => s.selectedAnnotationIds);
  const selectedClassId = useAppStore((s) => s.selectedClassId);
  const liveDraftClassId = useAppStore((s) => s.liveDraftClassId);
  const classes = useAppStore((s) => s.classes);
  const lineThickness = useAppStore((s) => s.lineThickness);
  const bboxOpacity = useAppStore((s) => s.bboxOpacity);
  const drawBoxFill = useAppStore((s) => s.drawBoxFill);
  const drawBoxBorder = useAppStore((s) => s.drawBoxBorder);
  const showCrosshair = useAppStore((s) => s.showCrosshair);
  const showLabels = useAppStore((s) => s.showLabels);
  const dragDeadzonePx = useAppStore((s) => s.dragDeadzonePx);
  const suppressDeleteAnnotationWarning = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteAnnotationWarning = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);

  const selectClass = useAppStore((s) => s.selectClass);
  const selectAnnotation = useAppStore((s) => s.selectAnnotation);
  const toggleAnnotationSelection = useAppStore((s) => s.toggleAnnotationSelection);
  const clearAnnotationSelection = useAppStore((s) => s.clearAnnotationSelection);
  const selectAllAnnotationsCurrentImage = useAppStore((s) => s.selectAllAnnotationsCurrentImage);
  const addAnnotation = useAppStore((s) => s.addAnnotation);
  const updateAnnotationBBox = useAppStore((s) => s.updateAnnotationBBox);
  const toggleAnnotationVisibility = useAppStore((s) => s.toggleAnnotationVisibility);
  const toggleAnnotationAnchoring = useAppStore((s) => s.toggleAnnotationAnchoring);
  const toggleAnnotationsVisibility = useAppStore((s) => s.toggleAnnotationsVisibility);
  const toggleAnnotationsAnchoring = useAppStore((s) => s.toggleAnnotationsAnchoring);
  const deleteAnnotation = useAppStore((s) => s.deleteAnnotation);
  const deleteSelectedAnnotations = useAppStore((s) => s.deleteSelectedAnnotations);
  const setAnnotationSelection = useAppStore((s) => s.setAnnotationSelection);
  const setAnnotationsClass = useAppStore((s) => s.setAnnotationsClass);
  const setLiveDraftBBox = useAppStore((s) => s.setLiveDraftBBox);
  const setLiveDraftClassId = useAppStore((s) => s.setLiveDraftClassId);

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [viewScale, setViewScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [draftBBox, setDraftBBox] = useState<BBox | null>(null);
  const [dragAdding, setDragAdding] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; annId: string } | null>(null);
  const [confirmDeleteAnnIds, setConfirmDeleteAnnIds] = useState<string[] | null>(null);
  const [swapClassAnnIds, setSwapClassAnnIds] = useState<string[] | null>(null);
  const [swapClassId, setSwapClassId] = useState<string>('');
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeBBox, setMarqueeBBox] = useState<BBox | null>(null);
  const [marqueeSeedSelection, setMarqueeSeedSelection] = useState<string[]>([]);
  const [annotationInteraction, setAnnotationInteraction] = useState(false);
  const [canvasDragMode, setCanvasDragMode] = useState<'annotate' | 'pan'>('annotate');
  const [crosshairImgPos, setCrosshairImgPos] = useState<{ x: number; y: number }>({ x: image.width / 2, y: image.height / 2 });
  const [pointerInsideImage, setPointerInsideImage] = useState(false);

  const zoomBounds = useMemo(() => {
    const fitScaleRaw = Math.min(stageSize.width / image.width, stageSize.height / image.height);
    const fitScale = Number.isFinite(fitScaleRaw) && fitScaleRaw > 0 ? fitScaleRaw : 1;
    const minScale = clampNumber(fitScale * MIN_ZOOM_FIT_MULTIPLIER, MIN_ZOOM_ABSOLUTE, MAX_ZOOM_ABSOLUTE);
    const maxScale = clampNumber(
      Math.max(fitScale * MAX_ZOOM_FIT_MULTIPLIER, minScale),
      MIN_ZOOM_ABSOLUTE,
      MAX_ZOOM_ABSOLUTE
    );
    return { fitScale, minScale, maxScale };
  }, [image.height, image.width, stageSize.height, stageSize.width]);

  // Unified cancel path for both click-click and drag draft creation flows.
  const abortDraft = (): void => {
    setDraftStart(null);
    setDraftBBox(null);
    setDragAdding(false);
    setLiveDraftBBox(null);
    setLiveDraftClassId(null);
  };

  const clampPointToImage = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.max(0, Math.min(image.width, p.x)),
    y: Math.max(0, Math.min(image.height, p.y)),
  });

  const isMultiSelectModifierActive = (evt: { ctrlKey?: boolean; metaKey?: boolean; getModifierState?: (keyArg: string) => boolean }): boolean =>
    Boolean(evt.ctrlKey || evt.metaKey || evt.getModifierState?.('Control'));

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const defaultClassId = useMemo(
    () => classes.find((c) => c.isDefault)?.id ?? classes[0]?.id ?? selectedClassId,
    [classes, selectedClassId]
  );

  const classHotkeyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cls of classes) {
      const key = cls.hotkey?.toUpperCase();
      if (!key || !/^[A-Z0-9]$/.test(key)) continue;
      map.set(key, cls.id);
    }
    return map;
  }, [classes]);

  const selectedIdsForImage = useMemo(() => {
    const available = new Set(image.annotations.map((a) => a.id));
    return selectedAnnotationIds.filter((id) => available.has(id));
  }, [image.annotations, selectedAnnotationIds]);

  const draftClassColor = useMemo(() => {
    const classIdForDraft =
      classAssignmentMode === 'deferred'
        ? liveDraftClassId ?? defaultClassId
        : selectedClassId;
    return classById.get(classIdForDraft)?.color ?? '#38bdf8';
  }, [classAssignmentMode, classById, defaultClassId, liveDraftClassId, selectedClassId]);

  // Load the browser image element once per selected source.
  useEffect(() => {
    const img = new Image();
    img.src = image.src;
    img.onload = () => setImageElement(img);
    return () => {
      setImageElement(null);
    };
  }, [image.src]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setStageSize({ width: r.width, height: r.height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Refit and reset interaction state whenever image or viewport size changes.
    const clampedFitScale = clampNumber(zoomBounds.fitScale, zoomBounds.minScale, zoomBounds.maxScale);
    const x = (stageSize.width - image.width * clampedFitScale) / 2;
    const y = (stageSize.height - image.height * clampedFitScale) / 2;

    setViewScale(clampedFitScale);
    setViewPos({ x, y });
    abortDraft();
    setMenu(null);
    setSwapClassAnnIds(null);
    setCanvasDragMode('annotate');
    setCrosshairImgPos({ x: image.width / 2, y: image.height / 2 });
    setMarqueeStart(null);
    setMarqueeBBox(null);
    setMarqueeSeedSelection([]);
  }, [image.id, image.width, image.height, stageSize.height, stageSize.width, zoomBounds.fitScale, zoomBounds.maxScale, zoomBounds.minScale]);

  useEffect(() => {
    // Crosshair tracks pointer globally but is clamped to image bounds.
    const onPointerMove = (e: PointerEvent): void => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const imgX = (px - viewPos.x) / viewScale;
      const imgY = (py - viewPos.y) / viewScale;
      const insideContainer = px >= 0 && py >= 0 && px <= rect.width && py <= rect.height;
      const insideImage =
        insideContainer && imgX >= 0 && imgY >= 0 && imgX <= image.width && imgY <= image.height;
      setPointerInsideImage(insideImage);
      setCrosshairImgPos(clampPointToImage({ x: imgX, y: imgY }));
    };
    window.addEventListener('pointermove', onPointerMove, true);
    return () => window.removeEventListener('pointermove', onPointerMove, true);
  }, [image.height, image.width, viewPos.x, viewPos.y, viewScale]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.draggable(canvasDragMode === 'pan' && !annotationInteraction);
  }, [canvasDragMode, annotationInteraction]);

  useEffect(() => {
    if (interactionMode === 'edit') {
      abortDraft();
    }
  }, [interactionMode]);

  useEffect(() => {
    if (!menu) return;
    const closeDistancePx = 240;
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      setMenu(null);
    };
    const onPointerMove = (e: PointerEvent): void => {
      const menuEl = menuRef.current;
      if (!menuEl) return;
      const rect = menuEl.getBoundingClientRect();
      const px = e.clientX;
      const py = e.clientY;
      const inMenu =
        px >= rect.left - 12 &&
        px <= rect.right + 12 &&
        py >= rect.top - 12 &&
        py <= rect.bottom + 12;
      if (inMenu) return;
      const nearestX = Math.max(rect.left, Math.min(px, rect.right));
      const nearestY = Math.max(rect.top, Math.min(py, rect.bottom));
      const distance = Math.hypot(px - nearestX, py - nearestY);
      // Keep context menu open only while pointer remains nearby.
      if (distance > closeDistancePx) {
        setMenu(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
    };
  }, [menu]);

  useEffect(() => {
    // Escape aborts all transient interactions; Ctrl/Cmd+A selects all annotations in image.
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && active.closest('input,textarea,select,[contenteditable="true"],.class-hotkey-btn.active')) return;

      if (e.key === 'Escape') {
        setMenu(null);
        setSwapClassAnnIds(null);
        setMarqueeStart(null);
        setMarqueeBBox(null);
        setMarqueeSeedSelection([]);
        abortDraft();
        clearAnnotationSelection();
        return;
      }

      const isMac = navigator.platform.toLowerCase().includes('mac');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (ctrlOrCmd && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllAnnotationsCurrentImage();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.repeat) return;
        if (active?.closest('.sidebar,.topbar,.menu-popover,.modal-card,.annotation-menu')) return;
        if (document.querySelector('.modal-backdrop')) return;
        if (selectedIdsForImage.length === 0) return;
        e.preventDefault();
        if (suppressDeleteAnnotationWarning) {
          if (selectedIdsForImage.length > 1) deleteSelectedAnnotations();
          else deleteAnnotation(selectedIdsForImage[0]);
        } else {
          setConfirmDeleteAnnIds([...selectedIdsForImage]);
        }
        setMenu(null);
        setSwapClassAnnIds(null);
        return;
      }

      if (interactionMode !== 'add') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const hotkey = e.key.toUpperCase();
      if (!/^[A-Z0-9]$/.test(hotkey)) return;
      const classId = classHotkeyMap.get(hotkey);
      if (!classId) return;
      e.preventDefault();
      selectClass(classId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    classHotkeyMap,
    clearAnnotationSelection,
    deleteAnnotation,
    deleteSelectedAnnotations,
    interactionMode,
    selectAllAnnotationsCurrentImage,
    selectClass,
    selectedIdsForImage,
    suppressDeleteAnnotationWarning,
  ]);

  useEffect(() => {
    setLiveDraftBBox(draftBBox);
  }, [draftBBox, setLiveDraftBBox]);

  useEffect(() => {
    return () => setLiveDraftBBox(null);
  }, [setLiveDraftBBox]);

  useEffect(() => {
    return () => setLiveDraftClassId(null);
  }, [setLiveDraftClassId]);

  const getPointFromPointerEvent = (e: PointerEvent): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    stage.setPointersPositions(e as unknown as PointerEvent);
    return getPointOnImage(stage);
  };

  const visibleAnnotations = useMemo(
    () =>
      image.annotations.filter((a) => {
        const cls = classById.get(a.classId);
        if (!cls) return false;
        return cls.isVisible && a.isVisible;
      }),
    [classById, image.annotations]
  );

  const finalizeMarqueeSelection = (endPos: { x: number; y: number } | null): void => {
    if (!marqueeStart) return;

    const end = clampPointToImage(endPos ?? marqueeStart);
    const selectionBox: BBox = {
      x: Math.min(marqueeStart.x, end.x),
      y: Math.min(marqueeStart.y, end.y),
      width: Math.abs(end.x - marqueeStart.x),
      height: Math.abs(end.y - marqueeStart.y),
    };

    const hitIds = visibleAnnotations
      .filter((ann) => boxesIntersect(selectionBox, ann.bbox))
      .map((ann) => ann.id);
    const nextSelection = Array.from(new Set([...marqueeSeedSelection, ...hitIds]));
    const latestId = hitIds[hitIds.length - 1] ?? nextSelection[nextSelection.length - 1] ?? null;
    setAnnotationSelection(nextSelection, latestId);

    setMarqueeStart(null);
    setMarqueeBBox(null);
    setMarqueeSeedSelection([]);
  };

  useEffect(() => {
    if (!marqueeStart) return;
    const onMove = (e: PointerEvent): void => {
      const pos = getPointFromPointerEvent(e);
      if (!pos) return;
      const clamped = clampPointToImage(pos);
      setMarqueeBBox({
        x: Math.min(marqueeStart.x, clamped.x),
        y: Math.min(marqueeStart.y, clamped.y),
        width: Math.abs(clamped.x - marqueeStart.x),
        height: Math.abs(clamped.y - marqueeStart.y),
      });
    };
    const onUp = (e: PointerEvent): void => {
      finalizeMarqueeSelection(getPointFromPointerEvent(e));
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [marqueeStart, image.height, image.width, viewPos.x, viewPos.y, viewScale, visibleAnnotations, marqueeSeedSelection]);

  useEffect(() => {
    // Transformer is enabled only for single, editable, unanchored selection.
    const tr = transformerRef.current;
    if (!tr) return;

    if (selectedIdsForImage.length !== 1) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const selected = rectRefs.current[selectedIdsForImage[0]];
    const ann = image.annotations.find((a) => a.id === selectedIdsForImage[0]);
    if (!selected || !ann || ann.isAnchored || interactionMode !== 'edit' || canvasDragMode !== 'annotate') {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    tr.nodes([selected]);
    tr.getLayer()?.batchDraw();
  }, [canvasDragMode, image.annotations, interactionMode, selectedIdsForImage]);

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>): void => {
    if (!e.evt.ctrlKey && !e.evt.metaKey) return;

    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const zoomFactor = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const nextScale = direction > 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
    const newScale = clampNumber(nextScale, zoomBounds.minScale, zoomBounds.maxScale);

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setViewScale(newScale);
    setViewPos(newPos);
  };

  const finalizeDraft = (bbox: BBox): void => {
    addAnnotation(bbox);
    setDraftStart(null);
    setDraftBBox(null);
    setDragAdding(false);
    setLiveDraftClassId(null);
  };

  const onStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    if (e.evt.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;

    const targetType = e.target.getClassName();
    const clickedCanvasSurface =
      e.target === stage || targetType === 'Image' || targetType === 'Layer';
    const clickedAnnotation = targetType === 'Rect' || targetType === 'Text';
    const drawableSurface = clickedCanvasSurface || (interactionMode === 'add' && clickedAnnotation);

    if (clickedAnnotation && interactionMode !== 'add') {
      return;
    }

    if (!drawableSurface) return;

    setMenu(null);

    if (interactionMode === 'edit' && canvasDragMode === 'annotate' && clickedCanvasSurface) {
      // Edit mode + empty-space drag starts marquee selection.
      const pos = getPointOnImage(stage);
      if (!pos || !isPointInsideImage(pos, image)) return;
      const clamped = clampPointToImage(pos);
      const additive = isMultiSelectModifierActive(e.evt);
      setMarqueeStart(clamped);
      setMarqueeBBox({ x: clamped.x, y: clamped.y, width: 0, height: 0 });
      setMarqueeSeedSelection(additive ? selectedIdsForImage : []);
      if (!additive) {
        clearAnnotationSelection();
      }
      return;
    }

    if (canvasDragMode === 'pan') return;

    if (interactionMode !== 'add') return;

    const pos = getPointOnImage(stage);
    if (!pos) return;
    if (!draftStart && !isPointInsideImage(pos, image)) {
      return;
    }

    if (addingMode === 'click') {
      // Click-click mode: first click sets anchor, second click finalizes/clamps.
      if (!draftStart) {
        setDraftStart(pos);
        setDraftBBox({ x: pos.x, y: pos.y, width: 1, height: 1 });
        if (classAssignmentMode === 'deferred') {
          setLiveDraftClassId(defaultClassId);
        } else {
          setLiveDraftClassId(null);
        }
      } else {
        const clamped = {
          x: Math.max(0, Math.min(image.width, pos.x)),
          y: Math.max(0, Math.min(image.height, pos.y)),
        };
        const nextBox = {
          x: Math.min(draftStart.x, clamped.x),
          y: Math.min(draftStart.y, clamped.y),
          width: Math.abs(clamped.x - draftStart.x),
          height: Math.abs(clamped.y - draftStart.y),
        };
        if (nextBox.width >= dragDeadzonePx && nextBox.height >= dragDeadzonePx) {
          finalizeDraft(nextBox);
        } else {
          abortDraft();
        }
      }
      return;
    }

    setDragAdding(true);
    setDraftStart(pos);
    setDraftBBox({ x: pos.x, y: pos.y, width: 1, height: 1 });
    if (classAssignmentMode === 'deferred') {
      setLiveDraftClassId(defaultClassId);
    } else {
      setLiveDraftClassId(null);
    }
  };

  const pickNextOverlappingAnnotation = (): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = getPointOnImage(stage);
    if (!pos) return null;

    const overlapping = visibleAnnotations.filter((a) => {
      const x2 = a.bbox.x + a.bbox.width;
      const y2 = a.bbox.y + a.bbox.height;
      return pos.x >= a.bbox.x && pos.x <= x2 && pos.y >= a.bbox.y && pos.y <= y2;
    });

    if (overlapping.length === 0) return null;
    if (overlapping.length === 1) return overlapping[0].id;

    const idx = overlapping.findIndex((a) => a.id === selectedAnnotationId);
    const next = overlapping[(idx + 1 + overlapping.length) % overlapping.length];
    return next.id;
  };

  const onStageMouseMove = (): void => {
    const stage = stageRef.current;
    if (!stage || !draftStart) return;

    if (addingMode === 'click' || dragAdding) {
      const pos = getPointOnImage(stage);
      if (!pos) return;
      const clamped = {
        x: Math.max(0, Math.min(image.width, pos.x)),
        y: Math.max(0, Math.min(image.height, pos.y)),
      };
      setDraftBBox({
        x: Math.min(draftStart.x, clamped.x),
        y: Math.min(draftStart.y, clamped.y),
        width: Math.abs(clamped.x - draftStart.x),
        height: Math.abs(clamped.y - draftStart.y),
      });
    }
  };

  const onStageMouseUp = (): void => {
    const stage = stageRef.current;
    const pos = stage ? getPointOnImage(stage) : null;
    if (interactionMode !== 'add' || addingMode !== 'drag' || !dragAdding || !draftBBox) return;
    if (!pos) {
      abortDraft();
      return;
    }

    const clamped = {
      x: Math.max(0, Math.min(image.width, pos.x)),
      y: Math.max(0, Math.min(image.height, pos.y)),
    };
    const start = draftStart ?? clamped;
    const clampedBox = {
      x: Math.min(start.x, clamped.x),
      y: Math.min(start.y, clamped.y),
      width: Math.abs(clamped.x - start.x),
      height: Math.abs(clamped.y - start.y),
    };

    if (clampedBox.width >= dragDeadzonePx && clampedBox.height >= dragDeadzonePx) {
      finalizeDraft(clampedBox);
    } else {
      abortDraft();
    }
  };

  useEffect(() => {
    // Global listeners keep drag-draw responsive even if pointer leaves stage element.
    if (!(interactionMode === 'add' && addingMode === 'drag' && dragAdding)) return;
    const onMove = (e: PointerEvent): void => {
      const pos = getPointFromPointerEvent(e);
      if (!pos || !draftStart) return;
      const clamped = {
        x: Math.max(0, Math.min(image.width, pos.x)),
        y: Math.max(0, Math.min(image.height, pos.y)),
      };
      setDraftBBox({
        x: Math.min(draftStart.x, clamped.x),
        y: Math.min(draftStart.y, clamped.y),
        width: Math.abs(clamped.x - draftStart.x),
        height: Math.abs(clamped.y - draftStart.y),
      });
    };
    const onUp = (e: PointerEvent): void => {
      const pos = getPointFromPointerEvent(e);
      if (!pos || !draftStart) {
        abortDraft();
        return;
      }
      const clamped = {
        x: Math.max(0, Math.min(image.width, pos.x)),
        y: Math.max(0, Math.min(image.height, pos.y)),
      };
      const clampedBox = {
        x: Math.min(draftStart.x, clamped.x),
        y: Math.min(draftStart.y, clamped.y),
        width: Math.abs(clamped.x - draftStart.x),
        height: Math.abs(clamped.y - draftStart.y),
      };
      if (clampedBox.width >= dragDeadzonePx && clampedBox.height >= dragDeadzonePx) {
        finalizeDraft(clampedBox);
      } else {
        abortDraft();
      }
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [addingMode, dragAdding, draftStart, dragDeadzonePx, image.height, image.width, interactionMode]);

  useEffect(() => {
    // In click-click mode, allow finishing from outside image while keeping bbox clamped.
    if (!(interactionMode === 'add' && addingMode === 'click' && draftStart)) return;
    const onMove = (e: PointerEvent): void => {
      const pos = getPointFromPointerEvent(e);
      if (!pos || !draftStart) return;
      const clamped = {
        x: Math.max(0, Math.min(image.width, pos.x)),
        y: Math.max(0, Math.min(image.height, pos.y)),
      };
      setDraftBBox({
        x: Math.min(draftStart.x, clamped.x),
        y: Math.min(draftStart.y, clamped.y),
        width: Math.abs(clamped.x - draftStart.x),
        height: Math.abs(clamped.y - draftStart.y),
      });
    };
    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      const stageContainer = stageRef.current?.container() ?? null;
      if (stageContainer && target && stageContainer.contains(target)) {
        return;
      }
      if (target?.closest('button,[role="button"],input,select,textarea,a,label,.menu-popover,.annotation-menu,.modal-card')) {
        return;
      }
      const pos = getPointFromPointerEvent(e);
      if (!pos || !draftStart) return;
      const clamped = {
        x: Math.max(0, Math.min(image.width, pos.x)),
        y: Math.max(0, Math.min(image.height, pos.y)),
      };
      const nextBox = {
        x: Math.min(draftStart.x, clamped.x),
        y: Math.min(draftStart.y, clamped.y),
        width: Math.abs(clamped.x - draftStart.x),
        height: Math.abs(clamped.y - draftStart.y),
      };
      if (nextBox.width >= dragDeadzonePx && nextBox.height >= dragDeadzonePx) {
        finalizeDraft(nextBox);
      } else {
        abortDraft();
      }
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [addingMode, draftStart, dragDeadzonePx, image.height, image.width, interactionMode]);

  const resetView = (): void => {
    const clampedFitScale = clampNumber(zoomBounds.fitScale, zoomBounds.minScale, zoomBounds.maxScale);
    const x = (stageSize.width - image.width * clampedFitScale) / 2;
    const y = (stageSize.height - image.height * clampedFitScale) / 2;
    setViewScale(clampedFitScale);
    setViewPos({ x, y });
  };

  const crosshairStageX = crosshairImgPos.x * viewScale + viewPos.x;
  const crosshairStageY = crosshairImgPos.y * viewScale + viewPos.y;

  const crossLabelText = `${crosshairImgPos.x.toFixed(1)}, ${crosshairImgPos.y.toFixed(1)}`;
  const crossLabelW = Math.max(72, crossLabelText.length * 7.1 + 12);
  const crossLabelH = 22;
  let crossLabelLeft = crosshairStageX + 10;
  let crossLabelTop = crosshairStageY + 10;

  if (crossLabelLeft + crossLabelW > stageSize.width - 6) {
    crossLabelLeft = crosshairStageX - crossLabelW - 10;
  }
  if (crossLabelTop + crossLabelH > stageSize.height - 6) {
    crossLabelTop = crosshairStageY - crossLabelH - 10;
  }
  if (crossLabelLeft < 6) crossLabelLeft = 6;
  if (crossLabelTop < 6) crossLabelTop = 6;

  return (
    <div className="canvas-shell">
      <div className="canvas-toolbar">
        <span>
          Mode: {interactionMode} | Adding: {addingMode} | Canvas: {canvasDragMode} | Zoom:{' '}
          {(viewScale * 100).toFixed(0)}%
        </span>
        <div className="row">
          <button className={canvasDragMode === 'annotate' ? 'active' : ''} onClick={() => setCanvasDragMode('annotate')}>
            Annotate
          </button>
          <button className={canvasDragMode === 'pan' ? 'active' : ''} onClick={() => setCanvasDragMode('pan')}>
            Pan
          </button>
          <button onClick={resetView}>Reset view</button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={`canvas-container ${showCrosshair && pointerInsideImage ? 'canvas-crosshair-mode' : ''}`}
      >
        {showCrosshair && (
          // Crosshair overlay is UI-only; annotation geometry remains image-space.
          <div className="workspace-crosshair-overlay" aria-hidden="true">
            <div className="crosshair-line-h" style={{ top: `${crosshairStageY}px` }} />
            <div className="crosshair-line-v" style={{ left: `${crosshairStageX}px` }} />
            <div className="crosshair-coords" style={{ left: `${crossLabelLeft}px`, top: `${crossLabelTop}px` }}>
              {crossLabelText}
            </div>
          </div>
        )}
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          draggable={canvasDragMode === 'pan' && !annotationInteraction}
          x={viewPos.x}
          y={viewPos.y}
          scaleX={viewScale}
          scaleY={viewScale}
          onDragEnd={(evt) => {
            if (evt.target !== stageRef.current) return;
            setViewPos({ x: evt.target.x(), y: evt.target.y() });
          }}
          onWheel={onWheel}
          onContextMenu={(e) => {
            e.evt.preventDefault();
          }}
          onMouseDown={onStageMouseDown}
          onMouseMove={onStageMouseMove}
          onMouseUp={onStageMouseUp}
          ref={stageRef}
        >
          <Layer>
            {imageElement && <KonvaImage image={imageElement} width={image.width} height={image.height} />}

            {visibleAnnotations.map((ann) => {
              const cls = classById.get(ann.classId);
              if (!cls) return null;
              const isSelected = selectedIdsForImage.includes(ann.id);
              const visualStroke = drawBoxBorder ? lineThickness / viewScale : 0;
              const inset = visualStroke / 2;
              const visualX = ann.bbox.x + inset;
              const visualY = ann.bbox.y + inset;
              const visualW = Math.max(1, ann.bbox.width - inset * 2);
              const visualH = Math.max(1, ann.bbox.height - inset * 2);
              const selectedStroke = 2 / viewScale;
              const selectedInset = selectedStroke / 2;
              const anchorPad = (drawBoxBorder ? lineThickness / viewScale : 0) + 2 / viewScale;
              const anchorFontSize = 12 / viewScale;
              const anchorX = ann.bbox.x + anchorPad;
              const anchorY = Math.max(0, ann.bbox.y + ann.bbox.height - anchorPad - anchorFontSize);
              const anchorWidth = Math.max(1, ann.bbox.width - anchorPad * 2);

              return (
                <Group key={`ann_${ann.id}`}>
                  <Rect
                    name="annotation"
                    ref={(node) => {
                      rectRefs.current[ann.id] = node;
                    }}
                    x={ann.bbox.x}
                    y={ann.bbox.y}
                    width={ann.bbox.width}
                    height={ann.bbox.height}
                    stroke="transparent"
                    strokeWidth={0}
                    fill={drawBoxFill ? cls.color : 'rgba(0,0,0,0.001)'}
                    opacity={drawBoxFill ? bboxOpacity : 1}
                    draggable={
                      interactionMode === 'edit' &&
                      !ann.isAnchored &&
                      canvasDragMode === 'annotate' &&
                      selectedIdsForImage.length === 1 &&
                      selectedIdsForImage[0] === ann.id
                    }
                    dragBoundFunc={(pos) =>
                      clampAbsoluteDragPos(
                        pos,
                        image,
                        { width: ann.bbox.width, height: ann.bbox.height, x: ann.bbox.x, y: ann.bbox.y },
                        stageRef.current
                      )
                    }
                    onClick={(e) => {
                      if (e.evt.button !== 0) return;
                      if (interactionMode === 'add') return;
                      e.cancelBubble = true;
                      setMenu(null);
                      if (isMultiSelectModifierActive(e.evt)) {
                        toggleAnnotationSelection(ann.id);
                        return;
                      }
                      const next = pickNextOverlappingAnnotation();
                      selectAnnotation(next ?? ann.id);
                    }}
                    onMouseDown={(e) => {
                      if (e.evt.button !== 0) {
                        e.cancelBubble = true;
                        return;
                      }
                      if (interactionMode === 'add') return;
                      e.cancelBubble = true;
                    }}
                    onTap={(e) => {
                      if (interactionMode === 'add') return;
                      e.cancelBubble = true;
                      setMenu(null);
                      const next = pickNextOverlappingAnnotation();
                      selectAnnotation(next ?? ann.id);
                    }}
                    onDragEnd={(e) => {
                      const updated = clampMovedBBox(
                        {
                          x: e.target.x(),
                          y: e.target.y(),
                          width: ann.bbox.width,
                          height: ann.bbox.height,
                        },
                        image
                      );
                      updateAnnotationBBox(ann.id, updated);
                      setAnnotationInteraction(false);
                      stageRef.current?.draggable(canvasDragMode === 'pan');
                    }}
                    onDragStart={() => {
                      setAnnotationInteraction(true);
                      stageRef.current?.draggable(false);
                    }}
                    onDragMove={(e) => {
                    // Update visual companions live so borders/labels stay in sync mid-drag.
                    const node = e.target;
                    const live = clampMovedBBox(
                        {
                          x: node.x(),
                          y: node.y(),
                          width: ann.bbox.width,
                          height: ann.bbox.height,
                        },
                        image
                    );
                    const labelNode = labelRefs.current[ann.id];
                    const anchorNode = anchorRefs.current[ann.id];
                    const borderNode = borderRefs.current[ann.id];
                    const selectedNode = selectedRefs.current[ann.id];
                    if (labelNode) {
                      const labelYOffset = drawBoxBorder ? lineThickness / viewScale + 2 / viewScale : 2 / viewScale;
                      labelNode.x(live.x + (drawBoxBorder ? lineThickness / viewScale + 5 / viewScale : 5 / viewScale));
                      labelNode.y(Math.max(0, live.y + labelYOffset));
                      labelNode.getLayer()?.batchDraw();
                    }
                    if (borderNode && drawBoxBorder) {
                      const liveStroke = lineThickness / viewScale;
                      const liveInset = liveStroke / 2;
                      borderNode.x(live.x + liveInset);
                      borderNode.y(live.y + liveInset);
                      borderNode.width(Math.max(1, live.width - liveInset * 2));
                      borderNode.height(Math.max(1, live.height - liveInset * 2));
                      borderNode.strokeWidth(liveStroke);
                      borderNode.getLayer()?.batchDraw();
                    }
                    if (selectedNode) {
                      const liveSelectedStroke = 2 / viewScale;
                      const liveSelectedInset = liveSelectedStroke / 2;
                      selectedNode.x(live.x + liveSelectedInset);
                      selectedNode.y(live.y + liveSelectedInset);
                      selectedNode.width(Math.max(1, live.width - liveSelectedInset * 2));
                      selectedNode.height(Math.max(1, live.height - liveSelectedInset * 2));
                      selectedNode.strokeWidth(liveSelectedStroke);
                      selectedNode.getLayer()?.batchDraw();
                    }
                    if (anchorNode) {
                      const liveAnchorPad = (drawBoxBorder ? lineThickness / viewScale : 0) + 2 / viewScale;
                      const liveAnchorFontSize = 12 / viewScale;
                      anchorNode.x(live.x + liveAnchorPad);
                      anchorNode.y(Math.max(0, live.y + live.height - liveAnchorPad - liveAnchorFontSize));
                      anchorNode.width(Math.max(1, live.width - liveAnchorPad * 2));
                      anchorNode.fontSize(liveAnchorFontSize);
                      anchorNode.getLayer()?.batchDraw();
                    }
                  }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();

                      node.scaleX(1);
                      node.scaleY(1);

                      const updated = clampBBoxToImage(
                        {
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(2, node.width() * scaleX),
                          height: Math.max(2, node.height() * scaleY),
                        },
                        image
                      );

                      updateAnnotationBBox(ann.id, updated);
                      setAnnotationInteraction(false);
                      stageRef.current?.draggable(canvasDragMode === 'pan');
                    }}
                    onTransformStart={() => {
                      setAnnotationInteraction(true);
                      stageRef.current?.draggable(false);
                    }}
                    onTransform={(e) => {
                    // Mirror transform preview onto border/selection/anchor overlays.
                      const node = e.target;
                    const live = clampBBoxToImage(
                        {
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(2, node.width() * node.scaleX()),
                          height: Math.max(2, node.height() * node.scaleY()),
                        },
                        image
                    );
                    const labelNode = labelRefs.current[ann.id];
                    const anchorNode = anchorRefs.current[ann.id];
                    const borderNode = borderRefs.current[ann.id];
                    const selectedNode = selectedRefs.current[ann.id];
                    if (labelNode) {
                      const labelYOffset = drawBoxBorder ? lineThickness / viewScale + 2 / viewScale : 2 / viewScale;
                      labelNode.x(live.x + (drawBoxBorder ? lineThickness / viewScale + 5 / viewScale : 5 / viewScale));
                      labelNode.y(Math.max(0, live.y + labelYOffset));
                      labelNode.getLayer()?.batchDraw();
                    }
                    if (borderNode && drawBoxBorder) {
                      const liveStroke = lineThickness / viewScale;
                      const liveInset = liveStroke / 2;
                      borderNode.x(live.x + liveInset);
                      borderNode.y(live.y + liveInset);
                      borderNode.width(Math.max(1, live.width - liveInset * 2));
                      borderNode.height(Math.max(1, live.height - liveInset * 2));
                      borderNode.strokeWidth(liveStroke);
                      borderNode.getLayer()?.batchDraw();
                    }
                    if (selectedNode) {
                      const liveSelectedStroke = 2 / viewScale;
                      const liveSelectedInset = liveSelectedStroke / 2;
                      selectedNode.x(live.x + liveSelectedInset);
                      selectedNode.y(live.y + liveSelectedInset);
                      selectedNode.width(Math.max(1, live.width - liveSelectedInset * 2));
                      selectedNode.height(Math.max(1, live.height - liveSelectedInset * 2));
                      selectedNode.strokeWidth(liveSelectedStroke);
                      selectedNode.getLayer()?.batchDraw();
                    }
                    if (anchorNode) {
                      const liveAnchorPad = (drawBoxBorder ? lineThickness / viewScale : 0) + 2 / viewScale;
                      const liveAnchorFontSize = 12 / viewScale;
                      anchorNode.x(live.x + liveAnchorPad);
                      anchorNode.y(Math.max(0, live.y + live.height - liveAnchorPad - liveAnchorFontSize));
                      anchorNode.width(Math.max(1, live.width - liveAnchorPad * 2));
                      anchorNode.fontSize(liveAnchorFontSize);
                      anchorNode.getLayer()?.batchDraw();
                    }
                  }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      if (!selectedIdsForImage.includes(ann.id)) {
                        selectAnnotation(ann.id);
                      }
                      setMenu({ x: e.evt.clientX, y: e.evt.clientY, annId: ann.id });
                    }}
                  />
                  {drawBoxBorder ? (
                    <Rect
                      ref={(node) => {
                        borderRefs.current[ann.id] = node;
                      }}
                      x={visualX}
                      y={visualY}
                      width={visualW}
                      height={visualH}
                      stroke={cls.color}
                      strokeWidth={visualStroke}
                      dash={ann.isAnchored ? [8 / viewScale, 6 / viewScale] : undefined}
                      fill="transparent"
                      listening={false}
                    />
                  ) : null}
                  {isSelected ? (
                    <Rect
                      ref={(node) => {
                        selectedRefs.current[ann.id] = node;
                      }}
                      x={ann.bbox.x + selectedInset}
                      y={ann.bbox.y + selectedInset}
                      width={Math.max(1, ann.bbox.width - selectedInset * 2)}
                      height={Math.max(1, ann.bbox.height - selectedInset * 2)}
                      stroke="#38bdf8"
                      strokeWidth={selectedStroke}
                      fill="transparent"
                      listening={false}
                    />
                  ) : null}
                  {ann.isAnchored ? (
                    <Text
                      ref={(node) => {
                        anchorRefs.current[ann.id] = node;
                      }}
                      x={anchorX}
                      y={anchorY}
                      width={anchorWidth}
                      align="right"
                      text="[A]"
                      fill={cls.color}
                      fontStyle="bold"
                      fontSize={anchorFontSize}
                      listening={false}
                    />
                  ) : null}
                </Group>
              );
            })}

            {showLabels &&
              visibleAnnotations.map((ann) => {
                const cls = classById.get(ann.classId);
                if (!cls) return null;

                return (
                  <Text
                    key={`${ann.id}_label`}
                    ref={(node) => {
                      labelRefs.current[ann.id] = node;
                    }}
                    x={ann.bbox.x + (drawBoxBorder ? lineThickness / viewScale + 5 / viewScale : 5 / viewScale)}
                    y={Math.max(
                      0,
                      ann.bbox.y + (drawBoxBorder ? lineThickness / viewScale + 2 / viewScale : 2 / viewScale)
                    )}
                    text={`#${ann.displayId} ${cls.name}`}
                    fill={cls.color}
                    fontStyle="bold"
                    fontSize={14 / viewScale}
                    listening={false}
                  />
                );
              })}

            {draftBBox && (
              <Rect
                x={draftBBox.x}
                y={draftBBox.y}
                width={draftBBox.width}
                height={draftBBox.height}
                stroke={draftClassColor}
                strokeWidth={2 / viewScale}
                dash={[8 / viewScale, 6 / viewScale]}
                listening={false}
              />
            )}
            {marqueeBBox && interactionMode === 'edit' && canvasDragMode === 'annotate' && (
              <Rect
                x={marqueeBBox.x}
                y={marqueeBBox.y}
                width={marqueeBBox.width}
                height={marqueeBBox.height}
                stroke="#38bdf8"
                strokeWidth={2 / viewScale}
                fill="rgba(56, 189, 248, 0.12)"
                dash={[8 / viewScale, 6 / viewScale]}
                listening={false}
              />
            )}

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              ignoreStroke
              keepRatio={false}
              resizeEnabled={canvasDragMode === 'annotate'}
              enabledAnchors={
                [
                  'top-left',
                  'top-center',
                  'top-right',
                  'middle-right',
                  'bottom-right',
                  'bottom-center',
                  'bottom-left',
                  'middle-left',
                ]
              }
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 2 || newBox.height < 2) return oldBox;
                return clampAbsoluteTransformBox(newBox, oldBox, image, stageRef.current);
              }}
            />
          </Layer>
        </Stage>
      </div>
      {menu && (
        // Right-click menu supports single or multi-selection operations.
        <PortalMenu x={menu.x} y={menu.y} menuRef={menuRef}>
          <button
            onClick={() => {
              if (selectedIdsForImage.length > 1 && selectedIdsForImage.includes(menu.annId)) {
                toggleAnnotationsVisibility(selectedIdsForImage);
              } else {
                toggleAnnotationVisibility(menu.annId);
              }
              setMenu(null);
            }}
          >
            Toggle visibility
          </button>
          <button
            onClick={() => {
              if (selectedIdsForImage.length > 1 && selectedIdsForImage.includes(menu.annId)) {
                toggleAnnotationsAnchoring(selectedIdsForImage);
              } else {
                toggleAnnotationAnchoring(menu.annId);
              }
              setMenu(null);
            }}
          >
            Toggle anchoring
          </button>
          <button
            onClick={() => {
              const targetIds =
                selectedIdsForImage.length > 1 && selectedIdsForImage.includes(menu.annId)
                  ? [...selectedIdsForImage]
                  : [menu.annId];
              if (targetIds.length === 0) {
                setMenu(null);
                return;
              }
              const first = image.annotations.find((a) => a.id === targetIds[0]);
              setSwapClassId(first?.classId ?? classes[0]?.id ?? '');
              setSwapClassAnnIds(targetIds);
              setMenu(null);
            }}
          >
            Swap class
          </button>
          <button
            onClick={() => {
              const deletingMultiple = selectedIdsForImage.length > 1 && selectedIdsForImage.includes(menu.annId);
              if (suppressDeleteAnnotationWarning) {
                if (deletingMultiple) deleteSelectedAnnotations();
                else deleteAnnotation(menu.annId);
              } else {
                setConfirmDeleteAnnIds(deletingMultiple ? [...selectedIdsForImage] : [menu.annId]);
              }
              setMenu(null);
            }}
          >
            Delete
          </button>
        </PortalMenu>
      )}
      {swapClassAnnIds && (
        <div className="modal-backdrop" onClick={() => setSwapClassAnnIds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Swap class</h4>
                <p>
                  {swapClassAnnIds.length > 1
                    ? `Change class for ${swapClassAnnIds.length} selected annotations.`
                    : 'Change class for the selected annotation.'}
                </p>
                <label>
                  Class
                  <select value={swapClassId} onChange={(e) => setSwapClassId(e.target.value)}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      if (swapClassId) {
                        setAnnotationsClass(swapClassAnnIds, swapClassId);
                      }
                      setSwapClassAnnIds(null);
                    }}
                  >
                    Apply
                  </button>
                  <button onClick={() => setSwapClassAnnIds(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteAnnIds && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteAnnIds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Delete annotation</h4>
                <p>
                  {confirmDeleteAnnIds.length > 1
                    ? `This will permanently remove ${confirmDeleteAnnIds.length} selected annotations.`
                    : 'This will permanently remove the selected annotation.'}
                </p>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={suppressDeleteAnnotationWarning}
                    onChange={(e) => setSuppressDeleteAnnotationWarning(e.target.checked)}
                  />
                  <span>Don't ask again</span>
                </label>
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      if (confirmDeleteAnnIds.length > 1) deleteSelectedAnnotations();
                      else deleteAnnotation(confirmDeleteAnnIds[0]);
                      setConfirmDeleteAnnIds(null);
                    }}
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirmDeleteAnnIds(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
