import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Path, Rect, Stage, Text, Image as KonvaImage, Transformer } from 'react-konva';
import Konva from 'konva';
import { ImageItem, BBox } from '../domain/types';
import { useAppStore } from '../store/appStore';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

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
  const borderRefs = useRef<Record<string, Konva.Rect | null>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  const interactionMode = useAppStore((s) => s.interactionMode);
  const addingMode = useAppStore((s) => s.addingMode);
  const selectedAnnotationId = useAppStore((s) => s.selectedAnnotationId);
  const selectedClassId = useAppStore((s) => s.selectedClassId);
  const classes = useAppStore((s) => s.classes);
  const lineThickness = useAppStore((s) => s.lineThickness);
  const bboxOpacity = useAppStore((s) => s.bboxOpacity);
  const drawBoxFill = useAppStore((s) => s.drawBoxFill);
  const drawBoxBorder = useAppStore((s) => s.drawBoxBorder);
  const showLabels = useAppStore((s) => s.showLabels);
  const showOnlySelectedThumbs = useAppStore((s) => s.showOnlySelectedThumbs);
  const dragDeadzonePx = useAppStore((s) => s.dragDeadzonePx);
  const suppressDeleteAnnotationWarning = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteAnnotationWarning = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);

  const selectAnnotation = useAppStore((s) => s.selectAnnotation);
  const addAnnotation = useAppStore((s) => s.addAnnotation);
  const updateAnnotationBBox = useAppStore((s) => s.updateAnnotationBBox);
  const toggleAnnotationVisibility = useAppStore((s) => s.toggleAnnotationVisibility);
  const toggleAnnotationAnchoring = useAppStore((s) => s.toggleAnnotationAnchoring);
  const deleteAnnotation = useAppStore((s) => s.deleteAnnotation);

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [viewScale, setViewScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [draftBBox, setDraftBBox] = useState<BBox | null>(null);
  const [dragAdding, setDragAdding] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; annId: string } | null>(null);
  const [confirmDeleteAnnId, setConfirmDeleteAnnId] = useState<string | null>(null);
  const [annotationInteraction, setAnnotationInteraction] = useState(false);
  const [canvasDragMode, setCanvasDragMode] = useState<'annotate' | 'pan'>('annotate');

  const abortDraft = (): void => {
    setDraftStart(null);
    setDraftBBox(null);
    setDragAdding(false);
  };

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
    const fitScale = Math.min(stageSize.width / image.width, stageSize.height / image.height);
    const clampedFitScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitScale > 0 ? fitScale : 1));
    const x = (stageSize.width - image.width * clampedFitScale) / 2;
    const y = (stageSize.height - image.height * clampedFitScale) / 2;

    setViewScale(clampedFitScale);
    setViewPos({ x, y });
    abortDraft();
    setMenu(null);
    setCanvasDragMode('annotate');
  }, [image.id, image.width, image.height, stageSize.height, stageSize.width]);

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
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      setMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        abortDraft();
        setMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const getPointFromPointerEvent = (e: PointerEvent): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    stage.setPointersPositions(e as unknown as PointerEvent);
    return getPointOnImage(stage);
  };

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const visibleAnnotations = useMemo(
    () =>
      image.annotations.filter((a) => {
        const cls = classById.get(a.classId);
        if (!cls) return false;
        return cls.isVisible && a.isVisible;
      }),
    [classById, image.annotations]
  );

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const selected = selectedAnnotationId ? rectRefs.current[selectedAnnotationId] : null;
    const ann = image.annotations.find((a) => a.id === selectedAnnotationId);
    if (!selected || !ann || ann.isAnchored || interactionMode !== 'edit' || canvasDragMode !== 'annotate') {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    tr.nodes([selected]);
    tr.getLayer()?.batchDraw();
  }, [canvasDragMode, image.annotations, interactionMode, selectedAnnotationId, showOnlySelectedThumbs]);

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
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale));

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
    selectAnnotation(null);

    if (canvasDragMode === 'pan') return;

    if (interactionMode !== 'add') return;

    const pos = getPointOnImage(stage);
    if (!pos) return;
    if (!draftStart && !isPointInsideImage(pos, image)) {
      return;
    }

    if (addingMode === 'click') {
      if (!draftStart) {
        setDraftStart(pos);
        setDraftBBox({ x: pos.x, y: pos.y, width: 1, height: 1 });
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
    const fitScale = Math.min(stageSize.width / image.width, stageSize.height / image.height);
    const clampedFitScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitScale > 0 ? fitScale : 1));
    const x = (stageSize.width - image.width * clampedFitScale) / 2;
    const y = (stageSize.height - image.height * clampedFitScale) / 2;
    setViewScale(clampedFitScale);
    setViewPos({ x, y });
  };

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
          <button onClick={resetView}>Reset View</button>
        </div>
      </div>
      <div ref={containerRef} className="canvas-container">
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
              const visualStroke = drawBoxBorder ? lineThickness / viewScale : 0;
              const inset = visualStroke / 2;
              const visualX = ann.bbox.x + inset;
              const visualY = ann.bbox.y + inset;
              const visualW = Math.max(1, ann.bbox.width - inset * 2);
              const visualH = Math.max(1, ann.bbox.height - inset * 2);
              const badgeSize = 14 / viewScale;
              const badgePad = 2 / viewScale;
              const badgeX = ann.bbox.x + Math.max(0, ann.bbox.width - badgeSize - badgePad);
              const badgeY = ann.bbox.y + badgePad;

              return [
                  <Rect
                    key={ann.id}
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
                    draggable={interactionMode === 'edit' && !ann.isAnchored && canvasDragMode === 'annotate'}
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
                    const borderNode = borderRefs.current[ann.id];
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
                    const borderNode = borderRefs.current[ann.id];
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
                  }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      selectAnnotation(ann.id);
                      setMenu({ x: e.evt.clientX, y: e.evt.clientY, annId: ann.id });
                    }}
                  />,
                  drawBoxBorder ? (
                    <Rect
                      key={`${ann.id}_border`}
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
                  ) : null,
                  ann.isAnchored ? (
                    <Group key={`${ann.id}_anchor_badge`} x={badgeX} y={badgeY} listening={false}>
                      <Rect width={badgeSize} height={badgeSize} cornerRadius={2 / viewScale} fill="rgba(0,0,0,0.72)" />
                      <Path
                        data="M4 6V5.4A2.6 2.6 0 0 1 9.2 5.4V6 M3.4 6H9.8V10.6H3.4Z"
                        x={-1 / viewScale}
                        y={-1 / viewScale}
                        scaleX={badgeSize / 12}
                        scaleY={badgeSize / 12}
                        stroke="#F8FAFC"
                        strokeWidth={1.2 / viewScale}
                        fill="transparent"
                      />
                    </Group>
                  ) : null,
              ];
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
                    text={`#${ann.displayId} ${cls.name}${ann.isAnchored ? ' [A]' : ''}`}
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
                stroke={classById.get(selectedClassId)?.color ?? '#38bdf8'}
                strokeWidth={2 / viewScale}
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
        <div ref={menuRef} className="annotation-menu" style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => toggleAnnotationVisibility(menu.annId)}>Toggle visibility</button>
          <button onClick={() => toggleAnnotationAnchoring(menu.annId)}>Toggle anchoring</button>
          <button
            onClick={() => {
              if (suppressDeleteAnnotationWarning) {
                deleteAnnotation(menu.annId);
              } else {
                setConfirmDeleteAnnId(menu.annId);
              }
              setMenu(null);
            }}
          >
            Delete
          </button>
          <button onClick={() => setMenu(null)}>Close</button>
        </div>
      )}
      {confirmDeleteAnnId && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteAnnId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Delete annotation</h4>
                <p>This will permanently remove the selected annotation.</p>
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
                      deleteAnnotation(confirmDeleteAnnId);
                      setConfirmDeleteAnnId(null);
                    }}
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirmDeleteAnnId(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
