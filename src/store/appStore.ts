import { create } from 'zustand';
import JSZip from 'jszip';
import {
  Annotation,
  AnnotationAddingMode,
  AnnotationFilterMode,
  AnnotationSortMode,
  BBox,
  ClassData,
  ClassFilterMode,
  ClassSortMode,
  ExportAnnotationFormat,
  ImageFilterMode,
  ImageItem,
  ImageSortMode,
  InteractionMode,
} from '../domain/types';
import { getClassColor } from '../utils/colors';
import { uid } from '../utils/id';

type Snapshot = {
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  nextDisplayIdByClass: Record<string, number>;
};

type ViewState = {
  interactionMode: InteractionMode;
  addingMode: AnnotationAddingMode;
  imageSort: ImageSortMode;
  imageFilter: ImageFilterMode;
  annotationSort: AnnotationSortMode;
  annotationFilter: AnnotationFilterMode;
  classSort: ClassSortMode;
  classFilter: ClassFilterMode;
  suppressUnassignedExportWarningDialog: boolean;
  suppressDeleteAnnotationWarningDialog: boolean;
  suppressDeleteImageWarningDialog: boolean;
  suppressRemoveClassInstancesWarningDialog: boolean;
  exportIncludeUnassigned: boolean;
  showLabels: boolean;
  showOnlySelectedThumbs: boolean;
  bboxOpacity: number;
  lineThickness: number;
  drawBoxFill: boolean;
  drawBoxBorder: boolean;
  dragDeadzonePx: number;
};

type AppState = ViewState & {
  statusText: string | null;
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  nextDisplayIdByClass: Record<string, number>;
  undoStack: Snapshot[];
  redoStack: Snapshot[];

  initializeDefaults: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setAddingMode: (mode: AnnotationAddingMode) => void;
  setImageSort: (mode: ImageSortMode) => void;
  setImageFilter: (mode: ImageFilterMode) => void;
  setAnnotationSort: (mode: AnnotationSortMode) => void;
  setAnnotationFilter: (mode: AnnotationFilterMode) => void;
  setClassSort: (mode: ClassSortMode) => void;
  setClassFilter: (mode: ClassFilterMode) => void;
  setShowLabels: (v: boolean) => void;
  setShowOnlySelectedThumbs: (v: boolean) => void;
  setBBoxOpacity: (v: number) => void;
  setLineThickness: (v: number) => void;
  setDrawBoxFill: (v: boolean) => void;
  setDrawBoxBorder: (v: boolean) => void;
  setDragDeadzonePx: (v: number) => void;
  setSuppressUnassignedExportWarningDialog: (v: boolean) => void;
  setSuppressDeleteAnnotationWarningDialog: (v: boolean) => void;
  setSuppressDeleteImageWarningDialog: (v: boolean) => void;
  setSuppressRemoveClassInstancesWarningDialog: (v: boolean) => void;
  setExportIncludeUnassigned: (v: boolean) => void;
  setStatusText: (v: string | null) => void;

  openImages: (files: File[]) => Promise<void>;
  openClassFileText: (content: string) => void;
  selectImage: (imageId: string | null) => void;
  selectClass: (classId: string) => void;
  selectAnnotation: (annotationId: string | null) => void;

  addClass: (name: string) => void;
  renameClass: (classId: string, newName: string) => void;
  toggleClassVisibility: (classId: string) => void;
  deleteClassSwapTo: (classId: string, substituteClassId: string) => void;
  deleteClassAndAffected: (classId: string) => void;
  deleteClassToUnassigned: (classId: string) => void;
  swapClassInstancesGlobal: (classId: string, substituteClassId: string) => void;
  removeClassInstancesGlobal: (classId: string) => void;
  toggleClassInstancesAnchoringGlobal: (classId: string) => void;

  addAnnotation: (bbox: BBox) => void;
  updateAnnotationBBox: (annotationId: string, bbox: BBox) => void;
  setAnnotationClass: (annotationId: string, classId: string) => void;
  toggleAnnotationVisibility: (annotationId: string) => void;
  toggleAnnotationAnchoring: (annotationId: string) => void;
  deleteAnnotation: (annotationId: string) => void;
  removeLastBBox: () => void;
  removeAllBBoxes: () => void;
  removeAllBBoxesGlobal: () => void;
  toggleAllAnchoringCurrentImage: () => void;
  setAllAnchoringCurrentImage: (anchored: boolean) => void;
  setAllVisibilityCurrentImage: (visible: boolean) => void;
  toggleAllVisibilityGlobal: () => void;

  moveToNextImage: () => void;
  moveToPrevImage: () => void;
  moveToFirstImage: () => void;
  moveToLastImage: () => void;
  moveToNextAnnotation: () => void;
  moveToPrevAnnotation: () => void;

  deleteImage: (imageId: string) => void;

  undo: () => void;
  redo: () => void;

  exportClassesTxt: () => Promise<void>;
  exportAnnotations: (format: ExportAnnotationFormat, global: boolean, includeFallback?: boolean) => Promise<void>;
};

const FALLBACK_CLASS_NAME = 'Unassigned';

function cloneSnapshot(s: Snapshot): Snapshot {
  return {
    classes: s.classes.map((c) => ({ ...c })),
    images: s.images.map((img) => ({
      ...img,
      annotations: img.annotations.map((a) => ({
        ...a,
        bbox: { ...a.bbox },
      })),
    })),
    selectedClassId: s.selectedClassId,
    selectedImageId: s.selectedImageId,
    selectedAnnotationId: s.selectedAnnotationId,
    nextDisplayIdByClass: { ...s.nextDisplayIdByClass },
  };
}

function normalizeBBox(b: BBox, maxW: number, maxH: number): BBox {
  const x1 = Math.max(0, Math.min(maxW, b.x));
  const y1 = Math.max(0, Math.min(maxH, b.y));
  const x2 = Math.max(0, Math.min(maxW, b.x + b.width));
  const y2 = Math.max(0, Math.min(maxH, b.y + b.height));

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return { x, y, width, height };
}

function sanitizeClassName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
}

function splitNameAndExt(fileName: string): { stem: string; ext: string } {
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0 || idx === fileName.length - 1) return { stem: fileName, ext: '' };
  return { stem: fileName.slice(0, idx), ext: fileName.slice(idx) };
}

function toUniqueName(rawName: string, taken: Set<string>): string {
  if (!taken.has(rawName)) {
    taken.add(rawName);
    return rawName;
  }
  const { stem, ext } = splitNameAndExt(rawName);
  let n = 2;
  while (true) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
    n += 1;
  }
}

function getDefaultViewState(): ViewState {
  return {
    interactionMode: 'edit',
    addingMode: 'click',
    imageSort: 'none',
    imageFilter: 'none',
    annotationSort: 'none',
    annotationFilter: 'none',
    classSort: 'none',
    classFilter: 'none',
    suppressUnassignedExportWarningDialog: false,
    suppressDeleteAnnotationWarningDialog: false,
    suppressDeleteImageWarningDialog: false,
    suppressRemoveClassInstancesWarningDialog: false,
    exportIncludeUnassigned: false,
    showLabels: true,
    showOnlySelectedThumbs: true,
    bboxOpacity: 0.2,
    lineThickness: 2,
    drawBoxFill: true,
    drawBoxBorder: true,
    dragDeadzonePx: 4,
  };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export const useAppStore = create<AppState>((set, get) => ({
  ...getDefaultViewState(),
  statusText: null,
  classes: [],
  images: [],
  selectedClassId: '',
  selectedImageId: null,
  selectedAnnotationId: null,
  nextDisplayIdByClass: {},
  undoStack: [],
  redoStack: [],

  initializeDefaults: () => {
    const existing = get().classes;
    if (existing.length > 0) {
      return;
    }

    const fallbackId = uid('class');
    const fallback: ClassData = {
      id: fallbackId,
      name: FALLBACK_CLASS_NAME,
      color: '#27272A',
      isVisible: true,
      isDefault: true,
    };

    set((state) => ({
      ...state,
      classes: [fallback],
      selectedClassId: fallbackId,
      nextDisplayIdByClass: { [fallbackId]: 1 },
    }));
  },

  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setAddingMode: (mode) => set({ addingMode: mode }),
  setImageSort: (mode) => set({ imageSort: mode }),
  setImageFilter: (mode) => set({ imageFilter: mode }),
  setAnnotationSort: (mode) => set({ annotationSort: mode }),
  setAnnotationFilter: (mode) => set({ annotationFilter: mode }),
  setClassSort: (mode) => set({ classSort: mode }),
  setClassFilter: (mode) => set({ classFilter: mode }),
  setShowLabels: (v) => set({ showLabels: v }),
  setShowOnlySelectedThumbs: (v) => set({ showOnlySelectedThumbs: v }),
  setBBoxOpacity: (v) => set({ bboxOpacity: v }),
  setLineThickness: (v) => set({ lineThickness: v }),
  setDrawBoxFill: (v) => set({ drawBoxFill: v }),
  setDrawBoxBorder: (v) => set({ drawBoxBorder: v }),
  setDragDeadzonePx: (v) => set({ dragDeadzonePx: Math.max(0, Math.floor(v)) }),
  setSuppressUnassignedExportWarningDialog: (v) => set({ suppressUnassignedExportWarningDialog: v }),
  setSuppressDeleteAnnotationWarningDialog: (v) => set({ suppressDeleteAnnotationWarningDialog: v }),
  setSuppressDeleteImageWarningDialog: (v) => set({ suppressDeleteImageWarningDialog: v }),
  setSuppressRemoveClassInstancesWarningDialog: (v) => set({ suppressRemoveClassInstancesWarningDialog: v }),
  setExportIncludeUnassigned: (v) => set({ exportIncludeUnassigned: v }),
  setStatusText: (v) => set({ statusText: v }),

  openImages: async (files) => {
    const current = get();
    if (files.length === 0) return;

    const base: Snapshot = {
      classes: current.classes,
      images: current.images,
      selectedClassId: current.selectedClassId,
      selectedImageId: current.selectedImageId,
      selectedAnnotationId: current.selectedAnnotationId,
      nextDisplayIdByClass: current.nextDisplayIdByClass,
    };

    const takenNames = new Set(current.images.map((i) => i.name));
    const newImages = await Promise.all(
      files.map(async (file) => {
        const src = URL.createObjectURL(file);
        const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = reject;
          image.src = src;
        });

        return {
          id: uid('img'),
          name: toUniqueName(file.name, takenNames),
          file,
          src,
          width: dims.width,
          height: dims.height,
          annotations: [],
        } as ImageItem;
      })
    );

    set((state) => ({
      images: [...state.images, ...newImages],
      selectedImageId: state.selectedImageId ?? newImages[0]?.id ?? null,
      selectedAnnotationId: null,
      undoStack: [...state.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  openClassFileText: (content) => {
    const names = content
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);

    for (const name of names) {
      get().addClass(name);
    }
  },

  selectImage: (imageId) => set({ selectedImageId: imageId, selectedAnnotationId: null }),
  selectClass: (classId) => set({ selectedClassId: classId }),
  selectAnnotation: (annotationId) => set({ selectedAnnotationId: annotationId }),

  addClass: (name) => {
    const sanitized = sanitizeClassName(name);
    if (!sanitized || !/[A-Za-z0-9]/.test(sanitized)) {
      set({ statusText: 'Class name must contain letters or digits.' });
      return;
    }

    const state = get();
    if (state.classes.some((c) => c.name.toLowerCase() === sanitized.toLowerCase())) {
      set({ statusText: `Class "${sanitized}" already exists.` });
      return;
    }

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const newClass: ClassData = {
      id: uid('class'),
      name: sanitized,
      color: getClassColor(state.classes.length),
      isVisible: true,
    };

    set((s) => ({
      classes: [...s.classes, newClass],
      nextDisplayIdByClass: { ...s.nextDisplayIdByClass, [newClass.id]: 1 },
      selectedClassId: s.selectedClassId,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  renameClass: (classId, newName) => {
    const state = get();
    const cls = state.classes.find((c) => c.id === classId);
    if (!cls || cls.isDefault) return;

    const trimmed = newName.trim();
    if (!trimmed) return;
    if (state.classes.some((c) => c.id !== classId && c.name.toLowerCase() === trimmed.toLowerCase())) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      classes: s.classes.map((c) => (c.id === classId ? { ...c, name: trimmed } : c)),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleClassVisibility: (classId) => {
    const state = get();
    const cls = state.classes.find((c) => c.id === classId);
    if (!cls) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const selectedImage = state.images.find((i) => i.id === state.selectedImageId) ?? null;
    const selectedAnnotation = selectedImage?.annotations.find((a) => a.id === state.selectedAnnotationId) ?? null;
    const nextVisible = !cls.isVisible;

    set((s) => ({
      classes: s.classes.map((c) => (c.id === classId ? { ...c, isVisible: nextVisible } : c)),
      selectedAnnotationId:
        !nextVisible && selectedAnnotation?.classId === classId ? null : s.selectedAnnotationId,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  deleteClassSwapTo: (classId, substituteClassId) => {
    const state = get();
    if (classId === substituteClassId) return;

    const cls = state.classes.find((c) => c.id === classId);
    const sub = state.classes.find((c) => c.id === substituteClassId);
    if (!cls || !sub || cls.isDefault) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      classes: s.classes.filter((c) => c.id !== classId),
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.map((a) =>
          a.classId === classId ? { ...a, classId: substituteClassId } : a
        ),
      })),
      selectedClassId:
        s.selectedClassId === classId
          ? (s.classes.find((c) => c.isDefault)?.id ?? substituteClassId)
          : s.selectedClassId,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  deleteClassAndAffected: (classId) => {
    const state = get();
    const cls = state.classes.find((c) => c.id === classId);
    if (!cls || cls.isDefault) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      classes: s.classes.filter((c) => c.id !== classId),
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.filter((a) => a.classId !== classId),
      })),
      selectedClassId: s.classes.find((c) => c.isDefault)?.id ?? s.selectedClassId,
      selectedAnnotationId: null,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  deleteClassToUnassigned: (classId) => {
    const state = get();
    const defaultClassId = state.classes.find((c) => c.isDefault)?.id;
    if (!defaultClassId) return;
    get().deleteClassSwapTo(classId, defaultClassId);
  },

  swapClassInstancesGlobal: (classId, substituteClassId) => {
    const state = get();
    if (classId === substituteClassId) return;
    if (!state.classes.some((c) => c.id === classId) || !state.classes.some((c) => c.id === substituteClassId)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.map((a) =>
          a.classId === classId ? { ...a, classId: substituteClassId } : a
        ),
      })),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  removeClassInstancesGlobal: (classId) => {
    const state = get();
    if (!state.classes.some((c) => c.id === classId)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.filter((a) => a.classId !== classId),
      })),
      selectedAnnotationId: null,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleClassInstancesAnchoringGlobal: (classId) => {
    const state = get();
    if (!state.classes.some((c) => c.id === classId)) return;

    const affected = state.images.flatMap((img) => img.annotations.filter((a) => a.classId === classId));
    if (affected.length === 0) return;
    const shouldAnchor = affected.some((a) => !a.isAnchored);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.map((a) =>
          a.classId === classId ? { ...a, isAnchored: shouldAnchor } : a
        ),
      })),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  addAnnotation: (bbox) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image) return;

    const normalized = normalizeBBox(bbox, image.width, image.height);
    const minSize = Math.max(2, state.dragDeadzonePx);
    if (normalized.width < minSize || normalized.height < minSize) return;

    const classId = state.selectedClassId;
    const displayId = state.nextDisplayIdByClass[classId] ?? 1;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const newAnn: Annotation = {
      id: uid('ann'),
      classId,
      bbox: normalized,
      isVisible: true,
      isAnchored: false,
      displayId,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id === s.selectedImageId
          ? { ...img, annotations: [...img.annotations, newAnn] }
          : img
      ),
      selectedAnnotationId: newAnn.id,
      nextDisplayIdByClass: {
        ...s.nextDisplayIdByClass,
        [classId]: displayId + 1,
      },
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  updateAnnotationBBox: (annotationId, bbox) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image) return;

    const ann = image.annotations.find((a) => a.id === annotationId);
    if (!ann || ann.isAnchored) return;

    const normalized = normalizeBBox(bbox, image.width, image.height);
    if (normalized.width < 2 || normalized.height < 2) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                a.id === annotationId ? { ...a, bbox: normalized } : a
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  setAnnotationClass: (annotationId, classId) => {
    const state = get();
    if (!state.classes.some((c) => c.id === classId)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                a.id === annotationId ? { ...a, classId } : a
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAnnotationVisibility: (annotationId) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || !image.annotations.some((a) => a.id === annotationId)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                a.id === annotationId ? { ...a, isVisible: !a.isVisible } : a
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAnnotationAnchoring: (annotationId) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || !image.annotations.some((a) => a.id === annotationId)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                a.id === annotationId ? { ...a, isAnchored: !a.isAnchored } : a
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  deleteAnnotation: (annotationId) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || !image.annotations.some((a) => a.id === annotationId)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.filter((a) => a.id !== annotationId),
            }
      ),
      selectedAnnotationId: s.selectedAnnotationId === annotationId ? null : s.selectedAnnotationId,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  removeLastBBox: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;

    const lastId = image.annotations[image.annotations.length - 1].id;
    get().deleteAnnotation(lastId);
  },

  removeAllBBoxes: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id === s.selectedImageId ? { ...img, annotations: [] } : img
      ),
      selectedAnnotationId: null,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  removeAllBBoxesGlobal: () => {
    const state = get();
    if (!state.images.some((i) => i.annotations.length > 0)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({ ...img, annotations: [] })),
      selectedAnnotationId: null,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAllAnchoringCurrentImage: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;
    const shouldAnchor = image.annotations.some((a) => !a.isAnchored);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) => ({ ...a, isAnchored: shouldAnchor })),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  setAllAnchoringCurrentImage: (anchored) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;
    if (image.annotations.every((a) => a.isAnchored === anchored)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) => ({ ...a, isAnchored: anchored })),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  setAllVisibilityCurrentImage: (visible) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;
    if (image.annotations.every((a) => a.isVisible === visible)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) => ({ ...a, isVisible: visible })),
            }
      ),
      selectedAnnotationId: visible ? s.selectedAnnotationId : null,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAllVisibilityGlobal: () => {
    const state = get();
    if (!state.images.some((i) => i.annotations.length > 0)) return;
    const hasHidden = state.images.some((img) => img.annotations.some((a) => !a.isVisible));
    const nextVisible = hasHidden;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.map((a) => ({ ...a, isVisible: nextVisible })),
      })),
      selectedAnnotationId: nextVisible ? s.selectedAnnotationId : null,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  moveToNextImage: () => {
    const state = get();
    if (!state.selectedImageId || state.images.length === 0) return;
    const idx = state.images.findIndex((i) => i.id === state.selectedImageId);
    const next = state.images[(idx + 1) % state.images.length];
    set({ selectedImageId: next.id, selectedAnnotationId: null });
  },

  moveToPrevImage: () => {
    const state = get();
    if (!state.selectedImageId || state.images.length === 0) return;
    const idx = state.images.findIndex((i) => i.id === state.selectedImageId);
    const prev = state.images[(idx - 1 + state.images.length) % state.images.length];
    set({ selectedImageId: prev.id, selectedAnnotationId: null });
  },

  moveToFirstImage: () => {
    const state = get();
    if (state.images.length === 0) return;
    set({ selectedImageId: state.images[0].id, selectedAnnotationId: null });
  },

  moveToLastImage: () => {
    const state = get();
    if (state.images.length === 0) return;
    set({ selectedImageId: state.images[state.images.length - 1].id, selectedAnnotationId: null });
  },

  moveToNextAnnotation: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;

    const idx = image.annotations.findIndex((a) => a.id === state.selectedAnnotationId);
    const next = image.annotations[(idx + 1 + image.annotations.length) % image.annotations.length];
    set({ selectedAnnotationId: next.id });
  },

  moveToPrevAnnotation: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;

    const idx = image.annotations.findIndex((a) => a.id === state.selectedAnnotationId);
    const prev = image.annotations[(idx - 1 + image.annotations.length) % image.annotations.length];
    set({ selectedAnnotationId: prev.id });
  },

  deleteImage: (imageId) => {
    const state = get();
    if (!state.images.some((i) => i.id === imageId)) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const images = s.images.filter((i) => i.id !== imageId);
      const selectedImageId = s.selectedImageId === imageId ? images[0]?.id ?? null : s.selectedImageId;
      return {
        images,
        selectedImageId,
        selectedAnnotationId: null,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const current: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const previous = state.undoStack[state.undoStack.length - 1];
    const trimmedUndo = state.undoStack.slice(0, -1);

    set({
      ...cloneSnapshot(previous),
      undoStack: trimmedUndo,
      redoStack: [...state.redoStack, cloneSnapshot(current)],
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;

    const current: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const next = state.redoStack[state.redoStack.length - 1];
    const trimmedRedo = state.redoStack.slice(0, -1);

    set({
      ...cloneSnapshot(next),
      redoStack: trimmedRedo,
      undoStack: [...state.undoStack, cloneSnapshot(current)],
    });
  },

  exportClassesTxt: async () => {
    const state = get();
    const classNames = state.classes.filter((c) => !c.isDefault).map((c) => c.name);
    const blob = new Blob([classNames.join('\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, 'classes.txt');
  },

  exportAnnotations: async (format, global, includeFallback = false) => {
    const state = get();

    const selectedImage = state.images.find((i) => i.id === state.selectedImageId) ?? null;
    const images = global ? state.images : selectedImage ? [selectedImage] : [];
    if (images.length === 0) return;

    const hasAnyAnnotation = images.some((img) => img.annotations.length > 0);
    let classes = state.classes.filter((c) => includeFallback || !c.isDefault);
    if (classes.length === 0) return;

    let classMap = new Map(classes.map((c, idx) => [c.id, idx]));
    const hasMappedAnnotation = images.some((img) => img.annotations.some((a) => classMap.has(a.classId)));
    if (hasAnyAnnotation && !hasMappedAnnotation) {
      // If all boxes are in fallback class, avoid producing empty exports.
      classes = state.classes;
      classMap = new Map(classes.map((c, idx) => [c.id, idx]));
    }

    if (format === 'yolo') {
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');
      const labelsFolder = zip.folder('labels');

      if (!imagesFolder || !labelsFolder) return;

      const classNames = classes.map((c) => c.name).join('\n');
      zip.file('classes.txt', classNames);

      for (const image of images) {
        imagesFolder.file(image.name, image.file);

        const lines = image.annotations
          .filter((a) => classMap.has(a.classId))
          .map((a) => {
            const clsIdx = classMap.get(a.classId) ?? 0;
            const cx = (a.bbox.x + a.bbox.width / 2) / image.width;
            const cy = (a.bbox.y + a.bbox.height / 2) / image.height;
            const w = a.bbox.width / image.width;
            const h = a.bbox.height / image.height;
            return `${clsIdx} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
          })
          .join('\n');

        const labelName = image.name.replace(/\.[^.]+$/, '.txt');
        labelsFolder.file(labelName, lines);
      }

      const yaml = [
        'path: .',
        'train: images',
        'val: images',
        '',
        `nc: ${classes.length}`,
        'names:',
        ...classes.map((c, idx) => `  ${idx}: '${c.name}'`),
      ].join('\n');

      zip.file('data.yaml', yaml);
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `dataset_yolo_${Date.now()}.zip`);
      return;
    }

    if (format === 'coco') {
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');
      if (!imagesFolder) return;
      for (const image of images) {
        imagesFolder.file(image.name, image.file);
      }

      const round = (v: number, places: number): number => {
        const m = 10 ** places;
        return Math.round(v * m) / m;
      };

      const categories = classes.map((c, idx) => ({ id: idx + 1, name: c.name }));
      const categoryById = new Map(classes.map((c, idx) => [c.id, idx + 1]));

      let annId = 1;
      const coco = {
        info: {
          description: `Export of ${images.length} images`,
          version: '1.0',
          year: new Date().getFullYear(),
          date_created: new Date().toLocaleString('sv-SE'),
        },
        images: images.map((img, idx) => ({
          id: idx + 1,
          file_name: img.name,
          width: img.width,
          height: img.height,
        })),
        categories,
        annotations: images.flatMap((img, idx) =>
          img.annotations
            .filter((a) => categoryById.has(a.classId))
            .map((a) => ({
              id: annId++,
              image_id: idx + 1,
              category_id: categoryById.get(a.classId),
              bbox: [
                round(a.bbox.x, 2),
                round(a.bbox.y, 2),
                round(a.bbox.width, 2),
                round(a.bbox.height, 2),
              ],
              area: round(a.bbox.width * a.bbox.height, 4),
              iscrowd: 0,
            }))
        ),
      };

      zip.file('instances_default.json', JSON.stringify(coco, null, 2));
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `dataset_coco_${Date.now()}.zip`);
    }
  },
}));
