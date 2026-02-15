import { create } from 'zustand';
import JSZip from 'jszip';
import {
  Annotation,
  AnnotationAddingMode,
  AnnotationClassAssignmentMode,
  AnnotationFilterMode,
  AnnotationSortMode,
  BBox,
  ClassData,
  ClassFilterMode,
  ClassSortMode,
  ExportAnnotationFormat,
  ImageClassFilterMode,
  ImageFilterMode,
  ImageItem,
  ImageScope,
  ImageSortMode,
  InteractionMode,
  MinimapLocation,
} from '../domain/types';
import { getClassColor } from '../utils/colors';
import { uid } from '../utils/id';
import {
  extractVideoFrames,
  VideoParseOptions,
} from '../utils/video';
import { WorkspaceRecoverySnapshot, WorkspaceRecoveryViewState } from '../utils/workspaceRecovery';

type Snapshot = {
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds?: string[];
  nextDisplayIdByClass: Record<string, number>;
};

type ViewState = {
  interactionMode: InteractionMode;
  addingMode: AnnotationAddingMode;
  classAssignmentMode: AnnotationClassAssignmentMode;
  imageSort: ImageSortMode;
  imageFilter: ImageFilterMode;
  imageClassFilterMode: ImageClassFilterMode;
  imageClassFilterClassIds: string[];
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
  showCrosshair: boolean;
  showMinimap: boolean;
  minimapLocation: MinimapLocation;
  dragDeadzonePx: number;
};

type ClassInstanceScope = ImageScope;
type ExportImageNamingMode = 'original' | 'sequential';
type ExportImageNamingOptions = {
  mode: ExportImageNamingMode;
  baseName?: string;
};
type ExportImageOutputFormat = 'jpeg' | 'png';
type ExportImageOutputOptions = {
  convert: boolean;
  format: ExportImageOutputFormat;
};
type ExportImageMetadataOptions = {
  includeOriginalName: boolean;
  sanitizeImageMetadata: boolean;
};

type AppState = ViewState & {
  statusText: string | null;
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  liveDraftBBox: BBox | null;
  liveDraftClassId: string | null;
  deferredLastAnnotationId: string | null;
  deferredLastImageId: string | null;
  nextDisplayIdByClass: Record<string, number>;
  undoStack: Snapshot[];
  redoStack: Snapshot[];

  initializeDefaults: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setAddingMode: (mode: AnnotationAddingMode) => void;
  setClassAssignmentMode: (mode: AnnotationClassAssignmentMode) => void;
  setImageSort: (mode: ImageSortMode) => void;
  setImageFilter: (mode: ImageFilterMode) => void;
  setImageClassFilterMode: (mode: ImageClassFilterMode) => void;
  setImageClassFilterClassIds: (classIds: string[]) => void;
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
  setShowCrosshair: (v: boolean) => void;
  setShowMinimap: (v: boolean) => void;
  setMinimapLocation: (v: MinimapLocation) => void;
  setDragDeadzonePx: (v: number) => void;
  setSuppressUnassignedExportWarningDialog: (v: boolean) => void;
  setSuppressDeleteAnnotationWarningDialog: (v: boolean) => void;
  setSuppressDeleteImageWarningDialog: (v: boolean) => void;
  setSuppressRemoveClassInstancesWarningDialog: (v: boolean) => void;
  setExportIncludeUnassigned: (v: boolean) => void;
  setStatusText: (v: string | null) => void;
  setLiveDraftBBox: (bbox: BBox | null) => void;
  setLiveDraftClassId: (classId: string | null) => void;

  openImages: (files: File[]) => Promise<void>;
  openVideoFrames: (file: File, options: VideoParseOptions) => Promise<void>;
  importDatasetFolder: (files: File[]) => Promise<void>;
  importWorkspaceState: (file: File) => Promise<void>;
  openClassFileText: (content: string) => void;
  selectImage: (imageId: string | null) => void;
  toggleImageBookmark: (imageId: string) => void;
  setImagesBookmarked: (imageIds: string[], bookmarked: boolean) => void;
  selectClass: (classId: string) => void;
  selectAnnotation: (annotationId: string | null) => void;
  setAnnotationSelection: (annotationIds: string[], latestId?: string | null) => void;
  toggleAnnotationSelection: (annotationId: string) => void;
  clearAnnotationSelection: () => void;
  selectAllAnnotationsCurrentImage: () => void;

  addClass: (name: string) => void;
  renameClass: (classId: string, newName: string) => void;
  setClassHotkey: (classId: string, hotkey: string) => void;
  clearClassHotkey: (classId: string) => void;
  toggleClassVisibility: (classId: string) => void;
  deleteClassSwapTo: (classId: string, substituteClassId: string) => void;
  deleteClassAndAffected: (classId: string) => void;
  deleteClassToUnassigned: (classId: string) => void;
  swapClassInstancesGlobal: (classId: string, substituteClassId: string) => void;
  removeClassInstancesGlobal: (classId: string) => void;
  toggleClassInstancesAnchoringGlobal: (classId: string) => void;
  swapClassInstances: (classIds: string[], substituteClassId: string, scope: ClassInstanceScope) => void;
  removeClassInstances: (classIds: string[], scope: ClassInstanceScope) => void;
  setClassInstancesAnchoring: (classIds: string[], anchored: boolean, scope: ClassInstanceScope) => void;
  setClassInstancesVisibility: (classIds: string[], visible: boolean, scope: ClassInstanceScope) => void;

  addAnnotation: (bbox: BBox) => void;
  updateAnnotationBBox: (annotationId: string, bbox: BBox) => void;
  nudgeSelectedAnnotations: (dx: number, dy: number) => void;
  setAnnotationClass: (annotationId: string, classId: string) => void;
  setAnnotationsClass: (annotationIds: string[], classId: string) => void;
  toggleAnnotationVisibility: (annotationId: string) => void;
  toggleAnnotationAnchoring: (annotationId: string) => void;
  toggleAnnotationsVisibility: (annotationIds: string[]) => void;
  toggleAnnotationsAnchoring: (annotationIds: string[]) => void;
  deleteAnnotation: (annotationId: string) => void;
  deleteSelectedAnnotations: () => void;
  removeLastBBox: () => void;
  removeAllBBoxes: () => void;
  removeAllBBoxesGlobal: () => void;
  removeAllBBoxesBookmarked: () => void;
  toggleAllAnchoringCurrentImage: () => void;
  setAllAnchoringCurrentImage: (anchored: boolean) => void;
  setAllVisibilityCurrentImage: (visible: boolean) => void;
  toggleAllAnchoringGlobal: () => void;
  toggleAllAnchoringBookmarked: () => void;
  toggleAllVisibilityGlobal: () => void;
  toggleAllVisibilityBookmarked: () => void;

  moveToNextImage: () => void;
  moveToPrevImage: () => void;
  moveToFirstImage: () => void;
  moveToLastImage: () => void;
  moveToNextAnnotation: () => void;
  moveToPrevAnnotation: () => void;

  deleteImage: (imageId: string) => void;
  deleteImages: (imageIds: string[]) => void;
  closeAllImages: () => void;
  clearWorkspace: () => void;

  undo: () => void;
  redo: () => void;
  createRecoverySnapshot: () => WorkspaceRecoverySnapshot | null;
  restoreRecoverySnapshot: (snapshot: WorkspaceRecoverySnapshot) => void;

  exportClassesTxt: () => Promise<void>;
  exportAnnotations: (
    format: ExportAnnotationFormat,
    scope: ImageScope,
    includeFallback?: boolean,
    namingOptions?: ExportImageNamingOptions,
    outputOptions?: ExportImageOutputOptions,
    includeImagesWithoutAnnotations?: boolean,
    imageMetadataOptions?: ExportImageMetadataOptions
  ) => Promise<void>;
  exportAllAnnotations: (
    scope: ImageScope,
    folderName: string,
    includeFallback?: boolean,
    namingOptions?: ExportImageNamingOptions,
    outputOptions?: ExportImageOutputOptions,
    includeImagesWithoutAnnotations?: boolean,
    imageMetadataOptions?: ExportImageMetadataOptions
  ) => Promise<void>;
  exportWorkspaceState: () => Promise<void>;
};

const FALLBACK_CLASS_NAME = 'Unassigned';

// Snapshot payload is the source of truth for undo/redo transitions.
function cloneSnapshot(s: Snapshot): Snapshot {
  return {
    classes: s.classes.map((c) => ({ ...c })),
    images: s.images.map((img) => ({
      ...img,
      // Keep snapshots file-backed and URL-free so undo/redo doesn't pin many blob URLs.
      src: '',
      videoMeta: img.videoMeta ? { ...img.videoMeta } : undefined,
      annotations: img.annotations.map((a) => ({
        ...a,
        bbox: { ...a.bbox },
      })),
    })),
    selectedClassId: s.selectedClassId,
    selectedImageId: s.selectedImageId,
    selectedAnnotationId: s.selectedAnnotationId,
    selectedAnnotationIds: [...(s.selectedAnnotationIds ?? (s.selectedAnnotationId ? [s.selectedAnnotationId] : []))],
    nextDisplayIdByClass: { ...s.nextDisplayIdByClass },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  // Normalize user-entered class names to safe, export-friendly identifiers.
  return input
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '');
}

function normalizeClassHotkey(input: string): string | null {
  const key = input.trim().toUpperCase();
  if (!/^[A-Z0-9]$/.test(key)) return null;
  return key;
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

type DirectoryEntry = {
  file: File;
  relPath: string;
  relPathLower: string;
  nameLower: string;
  baseNameLower: string;
  extLower: string;
};

const IMAGE_FILE_RE = /\.(jpg|jpeg|png|bmp|tiff|tif|webp)$/i;

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function basenameWithoutExt(path: string): string {
  return basename(path).replace(/\.[^.]+$/, '');
}

function fileRelativePath(file: File): string {
  const withRelative = file as File & { webkitRelativePath?: string };
  return (withRelative.webkitRelativePath || file.name).replace(/\\/g, '/').replace(/^\.?\//, '');
}

function toDirectoryEntries(files: File[]): DirectoryEntry[] {
  // Keep both original relative paths and lowercase variants for robust dataset matching.
  return files.map((file) => {
    const relPath = fileRelativePath(file);
    const relPathLower = relPath.toLowerCase();
    const name = basename(relPath);
    const extIdx = name.lastIndexOf('.');
    return {
      file,
      relPath,
      relPathLower,
      nameLower: name.toLowerCase(),
      baseNameLower: basenameWithoutExt(name).toLowerCase(),
      extLower: extIdx >= 0 ? name.slice(extIdx).toLowerCase() : '',
    };
  });
}

function isImageEntry(entry: DirectoryEntry): boolean {
  return isSupportedImageFileName(entry.nameLower);
}

function isSupportedImageFileName(name: string): boolean {
  return IMAGE_FILE_RE.test(name.toLowerCase());
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(src);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(src);
      reject(error);
    };
    image.src = src;
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function getImageDimensionsWithRetry(file: File, attempts = 3): Promise<{ width: number; height: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getImageDimensions(file);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(120 * attempt);
      }
    }
  }
  throw lastError ?? new Error('Image decode failed');
}

function revokeObjectUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function revokeImageSources(images: ImageItem[]): void {
  for (const image of images) {
    revokeObjectUrl(image.src);
  }
}

function reconcileImageSourcesForSelection(images: ImageItem[], selectedImageId: string | null): ImageItem[] {
  let changed = false;
  const reconciled = images.map((image) => {
    const shouldHaveSource = selectedImageId !== null && image.id === selectedImageId;
    if (shouldHaveSource) {
      if (image.src) return image;
      changed = true;
      return { ...image, src: URL.createObjectURL(image.file) };
    }
    if (!image.src) return image;
    revokeObjectUrl(image.src);
    changed = true;
    return { ...image, src: '' };
  });
  return changed ? reconciled : images;
}

function parseYoloNamesFromYaml(content: string): string[] {
  // Accept both "names: [..]" and indexed "0: name" YAML styles.
  const mapped: Array<[number, string]> = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    const idx = Number(match[1]);
    const name = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (Number.isFinite(idx) && name) {
      mapped.push([idx, name]);
    }
  }
  if (mapped.length > 0) {
    mapped.sort((a, b) => a[0] - b[0]);
    return mapped.map(([, name]) => name).filter(Boolean);
  }

  const inline = content.match(/names\s*:\s*\[(.*?)\]/s);
  if (inline) {
    return inline[1]
      .split(',')
      .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return [];
}

type VocObjectRecord = {
  name: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

type VocParsedAnnotation = {
  filename: string | null;
  width: number | null;
  height: number | null;
  objects: VocObjectRecord[];
};

function parseVocAnnotationXml(content: string): VocParsedAnnotation | null {
  if (typeof DOMParser === 'undefined') return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  if (doc.querySelector('parsererror')) return null;

  const root = doc.querySelector('annotation');
  if (!root) return null;

  const readText = (scope: ParentNode, selector: string): string | null => {
    const node = scope.querySelector(selector);
    const raw = node?.textContent?.trim() ?? '';
    return raw.length > 0 ? raw : null;
  };

  const readNumber = (scope: ParentNode, selector: string): number | null => {
    const text = readText(scope, selector);
    if (!text) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  };

  const filename = readText(root, 'filename');
  const width = readNumber(root, 'size > width');
  const height = readNumber(root, 'size > height');

  const objects: VocObjectRecord[] = [];
  for (const objectNode of Array.from(root.querySelectorAll('object'))) {
    const name = readText(objectNode, 'name');
    const xmin = readNumber(objectNode, 'bndbox > xmin');
    const ymin = readNumber(objectNode, 'bndbox > ymin');
    const xmax = readNumber(objectNode, 'bndbox > xmax');
    const ymax = readNumber(objectNode, 'bndbox > ymax');
    if (!name || xmin === null || ymin === null || xmax === null || ymax === null) continue;
    objects.push({
      name,
      xmin: Math.min(xmin, xmax),
      ymin: Math.min(ymin, ymax),
      xmax: Math.max(xmin, xmax),
      ymax: Math.max(ymin, ymax),
    });
  }

  return {
    filename,
    width: width && width > 0 ? width : null,
    height: height && height > 0 ? height : null,
    objects,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatVocNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function buildVocAnnotationXml(
  imageName: string,
  width: number,
  height: number,
  objects: Array<{ className: string; bbox: BBox }>
): string {
  const objectXml = objects
    .map((obj) => {
      const x1 = clamp(obj.bbox.x, 0, width);
      const y1 = clamp(obj.bbox.y, 0, height);
      const x2 = clamp(obj.bbox.x + obj.bbox.width, 0, width);
      const y2 = clamp(obj.bbox.y + obj.bbox.height, 0, height);
      return [
        '  <object>',
        `    <name>${escapeXml(obj.className)}</name>`,
        '    <pose>Unspecified</pose>',
        '    <truncated>0</truncated>',
        '    <difficult>0</difficult>',
        '    <bndbox>',
        `      <xmin>${formatVocNumber(Math.min(x1, x2))}</xmin>`,
        `      <ymin>${formatVocNumber(Math.min(y1, y2))}</ymin>`,
        `      <xmax>${formatVocNumber(Math.max(x1, x2))}</xmax>`,
        `      <ymax>${formatVocNumber(Math.max(y1, y2))}</ymax>`,
        '    </bndbox>',
        '  </object>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<annotation>',
    '  <folder>images</folder>',
    `  <filename>${escapeXml(imageName)}</filename>`,
    `  <path>images/${escapeXml(imageName)}</path>`,
    '  <source>',
    '    <database>Unknown</database>',
    '  </source>',
    '  <size>',
    `    <width>${Math.max(1, Math.round(width))}</width>`,
    `    <height>${Math.max(1, Math.round(height))}</height>`,
    '    <depth>3</depth>',
    '  </size>',
    '  <segmented>0</segmented>',
    objectXml,
    '</annotation>',
  ].join('\n');
}

function getNextDisplayIdForImage(
  nextDisplayIdByClass: Record<string, number>,
  images: ImageItem[],
  imageId: string
): number {
  // Display IDs are per-image and monotonic for stable labels in a session.
  const direct = nextDisplayIdByClass[imageId];
  if (Number.isFinite(direct) && direct >= 1) {
    return Math.max(1, Math.floor(direct));
  }
  const image = images.find((img) => img.id === imageId);
  const maxDisplayId = image?.annotations.reduce((max, ann) => Math.max(max, ann.displayId ?? 0), 0) ?? 0;
  return maxDisplayId + 1;
}

function getDefaultClassId(classes: ClassData[], fallback = ''): string {
  return classes.find((c) => c.isDefault)?.id ?? classes[0]?.id ?? fallback;
}

function getImageIdsByScope(
  images: ImageItem[],
  selectedImageId: string | null,
  scope: ImageScope
): string[] {
  if (scope === 'currentImage') {
    return [selectedImageId].filter(Boolean) as string[];
  }
  if (scope === 'bookmarkedImages') {
    return images.filter((img) => img.isBookmarked).map((img) => img.id);
  }
  return images.map((img) => img.id);
}

function getDefaultViewState(): ViewState {
  return {
    interactionMode: 'edit',
    addingMode: 'click',
    classAssignmentMode: 'activeClass',
    imageSort: 'none',
    imageFilter: 'none',
    imageClassFilterMode: 'none',
    imageClassFilterClassIds: [],
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
    showCrosshair: true,
    showMinimap: true,
    minimapLocation: 'bottomRight',
    dragDeadzonePx: 4,
  };
}

function toViewStateSnapshot(state: ViewState): ViewState {
  return {
    interactionMode: state.interactionMode,
    addingMode: state.addingMode,
    classAssignmentMode: state.classAssignmentMode,
    imageSort: state.imageSort,
    imageFilter: state.imageFilter,
    imageClassFilterMode: state.imageClassFilterMode,
    imageClassFilterClassIds: [...state.imageClassFilterClassIds],
    annotationSort: state.annotationSort,
    annotationFilter: state.annotationFilter,
    classSort: state.classSort,
    classFilter: state.classFilter,
    suppressUnassignedExportWarningDialog: state.suppressUnassignedExportWarningDialog,
    suppressDeleteAnnotationWarningDialog: state.suppressDeleteAnnotationWarningDialog,
    suppressDeleteImageWarningDialog: state.suppressDeleteImageWarningDialog,
    suppressRemoveClassInstancesWarningDialog: state.suppressRemoveClassInstancesWarningDialog,
    exportIncludeUnassigned: state.exportIncludeUnassigned,
    showLabels: state.showLabels,
    showOnlySelectedThumbs: state.showOnlySelectedThumbs,
    bboxOpacity: state.bboxOpacity,
    lineThickness: state.lineThickness,
    drawBoxFill: state.drawBoxFill,
    drawBoxBorder: state.drawBoxBorder,
    showCrosshair: state.showCrosshair,
    showMinimap: state.showMinimap,
    minimapLocation: state.minimapLocation,
    dragDeadzonePx: state.dragDeadzonePx,
  };
}

function sanitizeViewStateSnapshot(raw: Partial<WorkspaceRecoveryViewState> | null | undefined): ViewState {
  const defaults = getDefaultViewState();
  const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
  const pickBool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
  const pickNum = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const pickStringArray = (value: unknown, fallback: string[]): string[] =>
    Array.isArray(value)
      ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))]
      : fallback;
  const source = raw ?? {};
  return {
    interactionMode: pickEnum(source.interactionMode, ['add', 'edit'] as const, defaults.interactionMode),
    addingMode: pickEnum(source.addingMode, ['click', 'drag'] as const, defaults.addingMode),
    classAssignmentMode: pickEnum(source.classAssignmentMode, ['activeClass', 'deferred'] as const, defaults.classAssignmentMode),
    imageSort: pickEnum(
      source.imageSort,
      ['none', 'alphabetical', 'reversedAlphabetical', 'largestFirst', 'smallestFirst', 'mostAnnotations', 'fewestAnnotations'] as const,
      defaults.imageSort
    ),
    imageFilter: pickEnum(
      source.imageFilter,
      ['none', 'hideAnnotated', 'hideUnannotated', 'hideBookmarked', 'hideUnbookmarked'] as const,
      defaults.imageFilter
    ),
    imageClassFilterMode: pickEnum(
      source.imageClassFilterMode,
      ['none', 'hasAny', 'hasAll', 'hasNone'] as const,
      defaults.imageClassFilterMode
    ),
    imageClassFilterClassIds: pickStringArray(source.imageClassFilterClassIds, defaults.imageClassFilterClassIds),
    annotationSort: pickEnum(
      source.annotationSort,
      ['none', 'oldest', 'newest', 'alphabetical', 'reversedAlphabetical', 'largestFirst', 'smallestFirst'] as const,
      defaults.annotationSort
    ),
    annotationFilter: pickEnum(source.annotationFilter, ['none', 'hideAssigned', 'hideUnassigned'] as const, defaults.annotationFilter),
    classSort: pickEnum(
      source.classSort,
      ['none', 'alphabetical', 'reversedAlphabetical', 'countAscending', 'countDescending'] as const,
      defaults.classSort
    ),
    classFilter: pickEnum(source.classFilter, ['none', 'hideUsed', 'hideUnused'] as const, defaults.classFilter),
    suppressUnassignedExportWarningDialog: pickBool(
      source.suppressUnassignedExportWarningDialog,
      defaults.suppressUnassignedExportWarningDialog
    ),
    suppressDeleteAnnotationWarningDialog: pickBool(
      source.suppressDeleteAnnotationWarningDialog,
      defaults.suppressDeleteAnnotationWarningDialog
    ),
    suppressDeleteImageWarningDialog: pickBool(source.suppressDeleteImageWarningDialog, defaults.suppressDeleteImageWarningDialog),
    suppressRemoveClassInstancesWarningDialog: pickBool(
      source.suppressRemoveClassInstancesWarningDialog,
      defaults.suppressRemoveClassInstancesWarningDialog
    ),
    exportIncludeUnassigned: pickBool(source.exportIncludeUnassigned, defaults.exportIncludeUnassigned),
    showLabels: pickBool(source.showLabels, defaults.showLabels),
    showOnlySelectedThumbs: pickBool(source.showOnlySelectedThumbs, defaults.showOnlySelectedThumbs),
    bboxOpacity: clamp(pickNum(source.bboxOpacity, defaults.bboxOpacity), 0, 1),
    lineThickness: clamp(pickNum(source.lineThickness, defaults.lineThickness), 0.5, 12),
    drawBoxFill: pickBool(source.drawBoxFill, defaults.drawBoxFill),
    drawBoxBorder: pickBool(source.drawBoxBorder, defaults.drawBoxBorder),
    showCrosshair: pickBool(source.showCrosshair, defaults.showCrosshair),
    showMinimap: pickBool(source.showMinimap, defaults.showMinimap),
    minimapLocation: pickEnum(
      source.minimapLocation,
      ['topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'sidebar'] as const,
      defaults.minimapLocation
    ),
    dragDeadzonePx: Math.max(0, Math.floor(pickNum(source.dragDeadzonePx, defaults.dragDeadzonePx))),
  };
}

type ExportContext = {
  images: ImageItem[];
  classes: ClassData[];
  classMap: Map<string, number>;
  fileNameByImageId: Map<string, string>;
  outputOptions: ExportImageOutputOptions;
};

function sanitizeExportImageBaseName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'image';
  const safe = trimmed
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .slice(0, 80);
  return safe.length > 0 ? safe : 'image';
}

function normalizeExportImageOutputOptions(
  options: ExportImageOutputOptions | undefined
): ExportImageOutputOptions {
  if (!options) return { convert: false, format: 'png' };
  return {
    convert: Boolean(options.convert),
    format: options.format === 'jpeg' ? 'jpeg' : 'png',
  };
}

function normalizeExportImageMetadataOptions(
  options: ExportImageMetadataOptions | undefined
): ExportImageMetadataOptions {
  if (!options) {
    return { includeOriginalName: false, sanitizeImageMetadata: false };
  }
  return {
    includeOriginalName: Boolean(options.includeOriginalName),
    sanitizeImageMetadata: Boolean(options.sanitizeImageMetadata),
  };
}

function getReencodedExtensionForImage(
  imageName: string,
  outputOptions: ExportImageOutputOptions,
  metadataOptions: ExportImageMetadataOptions
): string | null {
  if (outputOptions.convert) {
    return outputOptions.format === 'jpeg' ? '.jpg' : '.png';
  }
  if (!metadataOptions.sanitizeImageMetadata) return null;
  const ext = splitNameAndExt(imageName).ext.toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return '.jpg';
  if (ext === '.png') return '.png';
  // For formats without reliable same-format canvas export (webp/bmp/tiff), sanitize via PNG re-encode.
  return '.png';
}

function getReencodedFormat(extension: string): ExportImageOutputFormat {
  return extension === '.jpg' ? 'jpeg' : 'png';
}

function withExtension(fileName: string, ext: string): string {
  const { stem } = splitNameAndExt(fileName);
  return `${stem}${ext}`;
}

function getImageMetadataOriginalName(image: ImageItem): string {
  return image.name;
}

function buildExportImageFileNameMap(
  images: ImageItem[],
  namingOptions: ExportImageNamingOptions,
  outputOptions: ExportImageOutputOptions,
  metadataOptions: ExportImageMetadataOptions
): Map<string, string> {
  const mode = namingOptions.mode ?? 'sequential';
  const mapped = new Map<string, string>();
  const used = new Set<string>();

  if (mode === 'original') {
    for (const image of images) {
      const convertedExt = getReencodedExtensionForImage(image.name, outputOptions, metadataOptions);
      const sourceName = convertedExt ? withExtension(image.name, convertedExt) : image.name;
      const uniqueName = toUniqueName(sourceName, used);
      mapped.set(image.id, uniqueName);
    }
    return mapped;
  }

  const baseName = sanitizeExportImageBaseName(namingOptions.baseName ?? 'image');
  images.forEach((image, index) => {
    const { ext } = splitNameAndExt(image.name);
    const convertedExt = getReencodedExtensionForImage(image.name, outputOptions, metadataOptions);
    const resolvedExt = convertedExt ?? ext;
    const raw = `${baseName}_${index + 1}${ext}`;
    const candidate = withExtension(raw, resolvedExt);
    const uniqueName = toUniqueName(candidate, used);
    mapped.set(image.id, uniqueName);
  });
  return mapped;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const src = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(src);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(src);
      reject(error);
    };
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas conversion failed.'));
          return;
        }
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

async function convertImageFileForExport(file: File, format: ExportImageOutputFormat): Promise<Blob> {
  const image = await loadImageFromFile(file);
  const width = Math.max(1, image.naturalWidth);
  const height = Math.max(1, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable.');
  ctx.drawImage(image, 0, 0, width, height);
  if (format === 'jpeg') {
    return canvasToBlob(canvas, 'image/jpeg', 0.92);
  }
  return canvasToBlob(canvas, 'image/png');
}

async function prepareExportImageBlobs(
  ctx: ExportContext,
  metadataOptions: ExportImageMetadataOptions
): Promise<Map<string, Blob>> {
  const blobById = new Map<string, Blob>();
  for (const image of ctx.images) {
    const targetExt = getReencodedExtensionForImage(image.name, ctx.outputOptions, metadataOptions);
    if (!targetExt) {
      blobById.set(image.id, image.file);
      continue;
    }
    const converted = await convertImageFileForExport(image.file, getReencodedFormat(targetExt));
    blobById.set(image.id, converted);
  }
  return blobById;
}

function resolveExportContext(
  state: Pick<AppState, 'images' | 'selectedImageId' | 'classes'>,
  scope: ImageScope,
  includeFallback: boolean,
  namingOptions: ExportImageNamingOptions,
  outputOptions: ExportImageOutputOptions,
  includeImagesWithoutAnnotations: boolean,
  metadataOptions: ExportImageMetadataOptions
): ExportContext | null {
  const normalizedOutputOptions = normalizeExportImageOutputOptions(outputOptions);
  const normalizedMetadataOptions = normalizeExportImageMetadataOptions(metadataOptions);
  const imageIdSet = new Set(getImageIdsByScope(state.images, state.selectedImageId, scope));
  let images = state.images.filter(
    (img) => imageIdSet.has(img.id) && isSupportedImageFileName(img.name)
  );
  if (images.length === 0) return null;

  const hasAnyAnnotation = images.some((img) => img.annotations.length > 0);
  let classes = state.classes.filter((c) => includeFallback || !c.isDefault);
  if (classes.length === 0) return null;

  let classMap = new Map(classes.map((c, idx) => [c.id, idx]));
  const hasMappedAnnotation = images.some((img) =>
    img.annotations.some((ann) => classMap.has(ann.classId))
  );
  if (hasAnyAnnotation && !hasMappedAnnotation) {
    classes = state.classes;
    classMap = new Map(classes.map((c, idx) => [c.id, idx]));
  }

  if (!includeImagesWithoutAnnotations) {
    images = images.filter((img) => img.annotations.some((ann) => classMap.has(ann.classId)));
    if (images.length === 0) return null;
  }

  const fileNameByImageId = buildExportImageFileNameMap(
    images,
    namingOptions,
    normalizedOutputOptions,
    normalizedMetadataOptions
  );
  return { images, classes, classMap, fileNameByImageId, outputOptions: normalizedOutputOptions };
}

function writeImageMetadataSidecar(
  root: JSZip,
  ctx: ExportContext,
  metadataOptions: ExportImageMetadataOptions
): void {
  if (!metadataOptions.includeOriginalName) return;
  const payload = {
    images: ctx.images.map((img, idx) => ({
      id: idx + 1,
      file_name: ctx.fileNameByImageId.get(img.id) ?? img.name,
      original_file_name: getImageMetadataOriginalName(img),
    })),
  };
  root.file('image_metadata.json', JSON.stringify(payload, null, 2));
}

function writeYoloDataset(
  root: JSZip,
  ctx: ExportContext,
  imageBlobById: Map<string, Blob>,
  metadataOptions: ExportImageMetadataOptions
): void {
  const imagesFolder = root.folder('images');
  const labelsFolder = root.folder('labels');
  if (!imagesFolder || !labelsFolder) return;

  const classNames = ctx.classes.map((c) => c.name).join('\n');
  root.file('classes.txt', classNames);

  for (const image of ctx.images) {
    const exportImageName = ctx.fileNameByImageId.get(image.id) ?? image.name;
    const exportBlob = imageBlobById.get(image.id) ?? image.file;
    imagesFolder.file(exportImageName, exportBlob);

    const lines = image.annotations
      .filter((a) => ctx.classMap.has(a.classId))
      .map((a) => {
        const clsIdx = ctx.classMap.get(a.classId) ?? 0;
        const cx = (a.bbox.x + a.bbox.width / 2) / image.width;
        const cy = (a.bbox.y + a.bbox.height / 2) / image.height;
        const w = a.bbox.width / image.width;
        const h = a.bbox.height / image.height;
        return `${clsIdx} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
      })
      .join('\n');

    const labelName = exportImageName.replace(/\.[^.]+$/, '.txt');
    labelsFolder.file(labelName, lines);
  }

  const yaml = [
    'path: .',
    'train: images',
    'val: images',
    '',
    `nc: ${ctx.classes.length}`,
    'names:',
    ...ctx.classes.map((c, idx) => `  ${idx}: '${c.name}'`),
  ].join('\n');

  root.file('data.yaml', yaml);
  writeImageMetadataSidecar(root, ctx, metadataOptions);
}

function writeCocoDataset(
  root: JSZip,
  ctx: ExportContext,
  imageBlobById: Map<string, Blob>,
  metadataOptions: ExportImageMetadataOptions
): void {
  const imagesFolder = root.folder('images');
  if (!imagesFolder) return;
  for (const image of ctx.images) {
    const exportImageName = ctx.fileNameByImageId.get(image.id) ?? image.name;
    const exportBlob = imageBlobById.get(image.id) ?? image.file;
    imagesFolder.file(exportImageName, exportBlob);
  }

  const round = (v: number, places: number): number => {
    const m = 10 ** places;
    return Math.round(v * m) / m;
  };
  const categories = ctx.classes.map((c, idx) => ({ id: idx + 1, name: c.name }));
  const categoryById = new Map(ctx.classes.map((c, idx) => [c.id, idx + 1]));

  let annId = 1;
  const coco = {
    info: {
      description: `Export of ${ctx.images.length} images`,
      version: '1.0',
      year: new Date().getFullYear(),
      date_created: new Date().toLocaleString('sv-SE'),
    },
    images: ctx.images.map((img, idx) => {
      const base = {
        id: idx + 1,
        file_name: ctx.fileNameByImageId.get(img.id) ?? img.name,
        width: img.width,
        height: img.height,
      };
      if (!metadataOptions.includeOriginalName) return base;
      return {
        ...base,
        original_file_name: getImageMetadataOriginalName(img),
      };
    }),
    categories,
    annotations: ctx.images.flatMap((img, idx) =>
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

  root.file('instances_default.json', JSON.stringify(coco, null, 2));
  writeImageMetadataSidecar(root, ctx, metadataOptions);
}

function writeVocDataset(
  root: JSZip,
  ctx: ExportContext,
  imageBlobById: Map<string, Blob>,
  metadataOptions: ExportImageMetadataOptions
): void {
  const imagesFolder = root.folder('images');
  const annotationsFolder = root.folder('annotations');
  if (!imagesFolder || !annotationsFolder) return;

  const classById = new Map(ctx.classes.map((c) => [c.id, c]));
  for (const image of ctx.images) {
    const exportImageName = ctx.fileNameByImageId.get(image.id) ?? image.name;
    const exportBlob = imageBlobById.get(image.id) ?? image.file;
    imagesFolder.file(exportImageName, exportBlob);
    const objects = image.annotations
      .filter((ann) => classById.has(ann.classId))
      .map((ann) => ({
        className: classById.get(ann.classId)?.name ?? FALLBACK_CLASS_NAME,
        bbox: ann.bbox,
      }));
    const xml = buildVocAnnotationXml(exportImageName, image.width, image.height, objects);
    const xmlName = exportImageName.replace(/\.[^.]+$/, '.xml');
    annotationsFolder.file(xmlName, xml);
  }
  writeImageMetadataSidecar(root, ctx, metadataOptions);
}

function sanitizeExportFolderName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'annotation_exports';
  const safe = trimmed
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();
  return safe.length > 0 ? safe : 'annotation_exports';
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
  // --- View/UI state ---
  ...getDefaultViewState(),
  statusText: null,
  classes: [],
  images: [],
  selectedClassId: '',
  selectedImageId: null,
  selectedAnnotationId: null,
  selectedAnnotationIds: [],
  liveDraftBBox: null,
  liveDraftClassId: null,
  deferredLastAnnotationId: null,
  deferredLastImageId: null,
  nextDisplayIdByClass: {},
  undoStack: [],
  redoStack: [],

  // --- Initialization ---
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
      hotkey: undefined,
    };

    set((state) => ({
      ...state,
      classes: [fallback],
      selectedClassId: fallbackId,
      nextDisplayIdByClass: {},
    }));
  },

  setInteractionMode: (mode) =>
    set((s) =>
      mode === 'add'
        ? {
            interactionMode: mode,
            selectedClassId:
              s.classAssignmentMode === 'deferred'
                ? getDefaultClassId(s.classes, s.selectedClassId)
                : s.selectedClassId,
          }
        : { interactionMode: mode, liveDraftBBox: null, liveDraftClassId: null }
    ),
  setAddingMode: (mode) => set({ addingMode: mode }),
  setClassAssignmentMode: (mode) =>
    set((s) => {
      if (mode !== 'deferred') {
        return {
          classAssignmentMode: mode,
          liveDraftClassId: null,
          deferredLastAnnotationId: null,
          deferredLastImageId: null,
        };
      }
      const defaultClassId = getDefaultClassId(s.classes, s.selectedClassId);
      return {
        classAssignmentMode: mode,
        selectedClassId: defaultClassId,
      };
    }),
  setImageSort: (mode) => set({ imageSort: mode }),
  setImageFilter: (mode) => set({ imageFilter: mode }),
  setImageClassFilterMode: (mode) => set({ imageClassFilterMode: mode }),
  setImageClassFilterClassIds: (classIds) =>
    set({
      imageClassFilterClassIds: [...new Set(classIds.filter((id): id is string => typeof id === 'string' && id.length > 0))],
    }),
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
  setShowCrosshair: (v) => set({ showCrosshair: v }),
  setShowMinimap: (v) => set({ showMinimap: v }),
  setMinimapLocation: (v) => set({ minimapLocation: v }),
  setDragDeadzonePx: (v) => set({ dragDeadzonePx: Math.max(0, Math.floor(v)) }),
  setSuppressUnassignedExportWarningDialog: (v) => set({ suppressUnassignedExportWarningDialog: v }),
  setSuppressDeleteAnnotationWarningDialog: (v) => set({ suppressDeleteAnnotationWarningDialog: v }),
  setSuppressDeleteImageWarningDialog: (v) => set({ suppressDeleteImageWarningDialog: v }),
  setSuppressRemoveClassInstancesWarningDialog: (v) => set({ suppressRemoveClassInstancesWarningDialog: v }),
  setExportIncludeUnassigned: (v) => set({ exportIncludeUnassigned: v }),
  setStatusText: (v) => set({ statusText: v }),
  setLiveDraftBBox: (bbox) => set({ liveDraftBBox: bbox }),
  setLiveDraftClassId: (classId) => set({ liveDraftClassId: classId }),

  // --- Import/open actions ---
  openImages: async (files) => {
    const current = get();
    if (files.length === 0) return;
    const supportedFiles = files.filter((f) => isSupportedImageFileName(f.name));
    const skippedUnsupportedCount = files.length - supportedFiles.length;
    if (supportedFiles.length === 0) {
      set({ statusText: 'No supported image files selected.' });
      return;
    }

    const base: Snapshot = {
      classes: current.classes,
      images: current.images,
      selectedClassId: current.selectedClassId,
      selectedImageId: current.selectedImageId,
      selectedAnnotationId: current.selectedAnnotationId,
      selectedAnnotationIds: [...current.selectedAnnotationIds],
      nextDisplayIdByClass: current.nextDisplayIdByClass,
    };

    const takenNames = new Set(current.images.map((i) => i.name));
    const newImages: ImageItem[] = [];
    const failedNames: string[] = [];
    for (const file of supportedFiles) {
      try {
        const dims = await getImageDimensionsWithRetry(file, 3);
        newImages.push({
          id: uid('img'),
          name: toUniqueName(file.name, takenNames),
          file,
          src: '',
          width: dims.width,
          height: dims.height,
          isBookmarked: false,
          annotations: [],
          sourceKind: 'image',
        });
      } catch {
        failedNames.push(file.name);
      }
    }

    if (newImages.length === 0) {
      const openFailure =
        failedNames.length === 1
          ? `Couldn't open "${failedNames[0]}".`
          : `Couldn't open ${failedNames.length} selected images.`;
      if (skippedUnsupportedCount > 0) {
        set({
          statusText: `${openFailure} Skipped ${skippedUnsupportedCount} unsupported file${skippedUnsupportedCount === 1 ? '' : 's'}.`,
        });
      } else {
        set({ statusText: openFailure });
      }
      return;
    }

    const partialFailureStatus =
      failedNames.length > 0
        ? `Opened ${newImages.length}/${supportedFiles.length} images. ${failedNames.length} failed to decode.`
        : skippedUnsupportedCount > 0
          ? `Opened ${newImages.length} images. Skipped ${skippedUnsupportedCount} unsupported file${skippedUnsupportedCount === 1 ? '' : 's'}.`
          : null;

    set((state) => ({
      images: reconcileImageSourcesForSelection(
        [...state.images, ...newImages],
        state.selectedImageId ?? newImages[0]?.id ?? null
      ),
      selectedImageId: state.selectedImageId ?? newImages[0]?.id ?? null,
      selectedAnnotationId: state.selectedImageId ? state.selectedAnnotationId : null,
      selectedAnnotationIds: state.selectedImageId ? state.selectedAnnotationIds : [],
      nextDisplayIdByClass: {
        ...state.nextDisplayIdByClass,
        ...Object.fromEntries(newImages.map((img) => [img.id, 1])),
      },
      undoStack: [...state.undoStack, cloneSnapshot(base)],
      redoStack: [],
      ...(partialFailureStatus ? { statusText: partialFailureStatus } : {}),
    }));
  },

  openVideoFrames: async (file, options) => {
    const current = get();
    if (!file) return;

    const base: Snapshot = {
      classes: current.classes,
      images: current.images,
      selectedClassId: current.selectedClassId,
      selectedImageId: current.selectedImageId,
      selectedAnnotationId: current.selectedAnnotationId,
      selectedAnnotationIds: [...current.selectedAnnotationIds],
      nextDisplayIdByClass: current.nextDisplayIdByClass,
    };

    set({ statusText: `Parsing video "${file.name}"...` });

    let parsed: Awaited<ReturnType<typeof extractVideoFrames>>;
    try {
      parsed = await extractVideoFrames(file, options, (done, total) => {
        if (done === 1 || done === total || done % 10 === 0) {
          set({ statusText: `Parsing video "${file.name}" (${done}/${total})...` });
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ statusText: `Video parsing failed: ${message}` });
      return;
    }

    if (parsed.frames.length === 0) {
      set({ statusText: 'No frames were extracted from the selected video.' });
      return;
    }

    const videoId = uid('video');
    const takenNames = new Set(current.images.map((img) => img.name));
    const newImages: ImageItem[] = parsed.frames.map((frame) => {
      const name = toUniqueName(frame.file.name, takenNames);
      return {
        id: uid('img'),
        name,
        file: frame.file,
        src: '',
        width: parsed.probe.width,
        height: parsed.probe.height,
        isBookmarked: false,
        annotations: [],
        sourceKind: 'videoFrame',
        videoMeta: {
          videoId,
          videoName: file.name,
          sourceFps: options.sourceFps,
          sourceDurationMs: Math.round(parsed.probe.durationSec * 1000),
          frameIndex: frame.frameIndex,
          timestampMs: frame.timestampMs,
        },
      };
    });

    set((state) => ({
      images: reconcileImageSourcesForSelection(
        [...state.images, ...newImages],
        state.selectedImageId ?? newImages[0]?.id ?? null
      ),
      selectedImageId: state.selectedImageId ?? newImages[0]?.id ?? null,
      selectedAnnotationId: state.selectedImageId ? state.selectedAnnotationId : null,
      selectedAnnotationIds: state.selectedImageId ? state.selectedAnnotationIds : [],
      nextDisplayIdByClass: {
        ...state.nextDisplayIdByClass,
        ...Object.fromEntries(newImages.map((img) => [img.id, 1])),
      },
      undoStack: [...state.undoStack, cloneSnapshot(base)],
      redoStack: [],
      statusText: `Imported ${newImages.length} frames from "${file.name}".`,
    }));
  },

  importDatasetFolder: async (files) => {
    const state = get();
    if (files.length === 0) return;

    const entries = toDirectoryEntries(files);
    const imageEntries = entries.filter(isImageEntry);
    if (imageEntries.length === 0) {
      set({ statusText: 'No images found in selected folder.' });
      return;
    }

    const jsonEntries = entries.filter((e) => e.extLower === '.json');
    const cocoJsonEntry =
      jsonEntries.find((e) => basename(e.relPathLower) === 'instances_default.json') ??
      jsonEntries.find((e) => basename(e.relPathLower).startsWith('instances'));
    const classesEntry = entries.find((e) => e.nameLower === 'classes.txt') ?? null;
    const yoloYamlEntry =
      entries.find((e) => e.nameLower === 'data.yaml') ??
      entries.find((e) => e.nameLower === 'data.yml') ??
      null;
    const yoloLabelEntries = entries.filter((e) => e.extLower === '.txt' && e.relPathLower.includes('/labels/'));
    const xmlEntries = entries.filter((e) => e.extLower === '.xml');
    const vocXmlEntries =
      xmlEntries.filter((e) => e.relPathLower.includes('/annotations/') || e.relPathLower.includes('/annotation/'));
    const vocCandidateEntries = vocXmlEntries.length > 0 ? vocXmlEntries : xmlEntries;

    const format: 'coco' | 'yolo' | 'voc' | null = cocoJsonEntry
      ? 'coco'
      : classesEntry || yoloYamlEntry || yoloLabelEntries.length > 0
        ? 'yolo'
        : vocCandidateEntries.length > 0
          ? 'voc'
        : null;

    if (!format) {
      set({ statusText: 'Dataset format not recognized. Expected COCO, YOLO, or VOC export folder.' });
      return;
    }

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const workingClasses = state.classes.map((c) => ({ ...c }));
    const takenNames = new Set(state.images.map((i) => i.name));
    const nextDisplayIdByClass: Record<string, number> = { ...state.nextDisplayIdByClass };
    for (const img of state.images) {
      const nextValue = img.annotations.reduce((max, ann) => Math.max(max, (ann.displayId ?? 0) + 1), 1);
      nextDisplayIdByClass[img.id] = Math.max(nextDisplayIdByClass[img.id] ?? 1, nextValue);
    }

    const classIdByLowerName = new Map(workingClasses.map((c) => [c.name.toLowerCase(), c.id]));
    const ensureFallbackClass = (): string => {
      const existing = workingClasses.find((c) => c.isDefault);
      if (existing) {
        return existing.id;
      }
      const fallbackId = uid('class');
      const fallback: ClassData = {
        id: fallbackId,
        name: FALLBACK_CLASS_NAME,
        color: '#27272A',
        isVisible: true,
        isDefault: true,
        hotkey: undefined,
      };
      workingClasses.unshift(fallback);
      classIdByLowerName.set(fallback.name.toLowerCase(), fallback.id);
      return fallback.id;
    };
    const fallbackClassId = ensureFallbackClass();

    const ensureClassId = (rawName: string): string => {
      const trimmed = rawName.trim();
      if (!trimmed) return fallbackClassId;
      const existing = classIdByLowerName.get(trimmed.toLowerCase());
      if (existing) return existing;

      const sanitized = sanitizeClassName(trimmed) || trimmed.replace(/\s+/g, '_');
      const newClass: ClassData = {
        id: uid('class'),
        name: sanitized,
        color: getClassColor(workingClasses.length),
        isVisible: true,
        hotkey: undefined,
      };
      workingClasses.push(newClass);
      classIdByLowerName.set(trimmed.toLowerCase(), newClass.id);
      classIdByLowerName.set(newClass.name.toLowerCase(), newClass.id);
      return newClass.id;
    };

    const allocateDisplayId = (imageId: string): number => {
      const current = nextDisplayIdByClass[imageId] ?? 1;
      nextDisplayIdByClass[imageId] = current + 1;
      return current;
    };

    const newImages: ImageItem[] = [];
    let importedAnnotationCount = 0;
    let skippedAnnotations = 0;

    if (format === 'yolo') {
      // YOLO import expects class names + per-image txt labels in normalized coordinates.
      let classNames: string[] = [];
      if (classesEntry) {
        classNames = (await classesEntry.file.text())
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
      }
      if (classNames.length === 0 && yoloYamlEntry) {
        classNames = parseYoloNamesFromYaml(await yoloYamlEntry.file.text());
      }
      if (classNames.length === 0) {
        set({ statusText: 'YOLO dataset import failed: classes.txt or names in data.yaml not found.' });
        return;
      }

      const classIdsByIndex = classNames.map((name) => ensureClassId(name));
      const labelByBaseName = new Map<string, File>();
      for (const labelEntry of yoloLabelEntries) {
        if (!labelByBaseName.has(labelEntry.baseNameLower)) {
          labelByBaseName.set(labelEntry.baseNameLower, labelEntry.file);
        }
      }

      const preferredImages = imageEntries.filter((e) => e.relPathLower.includes('/images/'));
      const sourceImages = preferredImages.length > 0 ? preferredImages : imageEntries;
      for (const imageEntry of sourceImages) {
        const importedImageId = uid('img');
        let dims: { width: number; height: number };
        try {
          dims = await getImageDimensions(imageEntry.file);
        } catch {
          continue;
        }

        const annotations: Annotation[] = [];
        const labelFile = labelByBaseName.get(imageEntry.baseNameLower) ?? null;
        if (labelFile) {
          const labelContent = await labelFile.text();
          for (const line of labelContent.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parts = trimmed.split(/\s+/);
            if (parts.length < 5) {
              skippedAnnotations += 1;
              continue;
            }
            const classIdx = Number(parts[0]);
            const cx = Number(parts[1]);
            const cy = Number(parts[2]);
            const w = Number(parts[3]);
            const h = Number(parts[4]);
            if (!Number.isInteger(classIdx) || classIdx < 0 || classIdx >= classIdsByIndex.length) {
              skippedAnnotations += 1;
              continue;
            }
            if (![cx, cy, w, h].every((v) => Number.isFinite(v))) {
              skippedAnnotations += 1;
              continue;
            }

            const widthPx = w * dims.width;
            const heightPx = h * dims.height;
            const bbox = normalizeBBox(
              {
                x: cx * dims.width - widthPx / 2,
                y: cy * dims.height - heightPx / 2,
                width: widthPx,
                height: heightPx,
              },
              dims.width,
              dims.height
            );
            if (bbox.width < 1 || bbox.height < 1) {
              skippedAnnotations += 1;
              continue;
            }

            const classId = classIdsByIndex[classIdx];
            annotations.push({
              id: uid('ann'),
              classId,
              bbox,
              isVisible: true,
              isAnchored: false,
              displayId: allocateDisplayId(importedImageId),
            });
            importedAnnotationCount += 1;
          }
        }

        nextDisplayIdByClass[importedImageId] = Math.max(
          nextDisplayIdByClass[importedImageId] ?? 1,
          annotations.reduce((max, ann) => Math.max(max, (ann.displayId ?? 0) + 1), 1)
        );
        newImages.push({
          id: importedImageId,
          name: toUniqueName(imageEntry.file.name, takenNames),
          file: imageEntry.file,
          src: '',
          width: dims.width,
          height: dims.height,
          isBookmarked: false,
          annotations,
          sourceKind: 'image',
        });
      }
    } else if (format === 'coco') {
      // COCO import builds classes from categories and maps image_id/category_id references.
      if (!cocoJsonEntry) {
        set({ statusText: 'COCO dataset import failed: instances JSON was not found.' });
        return;
      }

      let coco: {
        images?: Array<{ id: number | string; file_name: string; width?: number; height?: number }>;
        categories?: Array<{ id: number | string; name: string }>;
        annotations?: Array<{
          image_id: number | string;
          category_id: number | string;
          bbox: [number, number, number, number];
        }>;
      };
      try {
        coco = JSON.parse(await cocoJsonEntry.file.text());
      } catch {
        set({ statusText: 'COCO dataset import failed: invalid JSON format.' });
        return;
      }

      const cocoImages = Array.isArray(coco.images) ? coco.images : [];
      const cocoCategories = Array.isArray(coco.categories) ? coco.categories : [];
      const cocoAnnotations = Array.isArray(coco.annotations) ? coco.annotations : [];
      if (cocoImages.length === 0) {
        set({ statusText: 'COCO dataset import failed: no images in instances file.' });
        return;
      }

      const classIdByCategoryId = new Map<number, string>();
      for (const category of cocoCategories) {
        const categoryId = Number(category.id);
        if (!Number.isFinite(categoryId)) continue;
        classIdByCategoryId.set(categoryId, ensureClassId(String(category.name ?? `Class_${categoryId}`)));
      }

      const imageByRelativePath = new Map(imageEntries.map((entry) => [entry.relPathLower, entry]));
      const imageByBaseName = new Map<string, DirectoryEntry[]>();
      for (const imageEntry of imageEntries) {
        const base = basename(imageEntry.relPathLower);
        const list = imageByBaseName.get(base) ?? [];
        list.push(imageEntry);
        imageByBaseName.set(base, list);
      }

      const resolveCocoImageEntry = (fileNameRaw: string): DirectoryEntry | null => {
        const normalized = fileNameRaw.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
        if (!normalized) return null;

        const direct = imageByRelativePath.get(normalized);
        if (direct) return direct;

        const normalizedWithoutImages = normalized.replace(/^images\//, '');
        const withImages = imageByRelativePath.get(`images/${normalizedWithoutImages}`);
        if (withImages) return withImages;

        const suffixMatch = imageEntries.find(
          (entry) =>
            entry.relPathLower.endsWith(`/${normalized}`) ||
            entry.relPathLower.endsWith(`/${normalizedWithoutImages}`) ||
            entry.relPathLower.endsWith(`/images/${normalizedWithoutImages}`)
        );
        if (suffixMatch) return suffixMatch;

        const byBase = imageByBaseName.get(basename(normalizedWithoutImages));
        if (!byBase || byBase.length === 0) return null;
        return byBase[0];
      };

      const importedByCocoImageId = new Map<number, ImageItem>();
      for (const cocoImage of cocoImages) {
        const cocoImageId = Number(cocoImage.id);
        if (!Number.isFinite(cocoImageId)) continue;

        const fileName = String(cocoImage.file_name ?? '').trim();
        if (!fileName) continue;
        const imageEntry = resolveCocoImageEntry(fileName);
        if (!imageEntry) continue;

        let dims: { width: number; height: number };
        const width = Number(cocoImage.width);
        const height = Number(cocoImage.height);
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
          dims = { width, height };
        } else {
          try {
            dims = await getImageDimensions(imageEntry.file);
          } catch {
            continue;
          }
        }

        const imageItem: ImageItem = {
          id: uid('img'),
          name: toUniqueName(imageEntry.file.name, takenNames),
          file: imageEntry.file,
          src: '',
          width: dims.width,
          height: dims.height,
          isBookmarked: false,
          annotations: [],
          sourceKind: 'image',
        };
        nextDisplayIdByClass[imageItem.id] = Math.max(nextDisplayIdByClass[imageItem.id] ?? 1, 1);
        newImages.push(imageItem);
        importedByCocoImageId.set(cocoImageId, imageItem);
      }

      for (const cocoAnnotation of cocoAnnotations) {
        const imageId = Number(cocoAnnotation.image_id);
        const categoryId = Number(cocoAnnotation.category_id);
        const imageItem = importedByCocoImageId.get(imageId);
        if (!imageItem) {
          skippedAnnotations += 1;
          continue;
        }

        const classId = classIdByCategoryId.get(categoryId) ?? fallbackClassId;
        const bboxRaw = Array.isArray(cocoAnnotation.bbox) ? cocoAnnotation.bbox : [];
        if (bboxRaw.length < 4) {
          skippedAnnotations += 1;
          continue;
        }
        const x = Number(bboxRaw[0]);
        const y = Number(bboxRaw[1]);
        const w = Number(bboxRaw[2]);
        const h = Number(bboxRaw[3]);
        if (![x, y, w, h].every((v) => Number.isFinite(v))) {
          skippedAnnotations += 1;
          continue;
        }

        const bbox = normalizeBBox({ x, y, width: w, height: h }, imageItem.width, imageItem.height);
        if (bbox.width < 1 || bbox.height < 1) {
          skippedAnnotations += 1;
          continue;
        }

        imageItem.annotations.push({
          id: uid('ann'),
          classId,
          bbox,
          isVisible: true,
          isAnchored: false,
          displayId: allocateDisplayId(imageItem.id),
        });
        importedAnnotationCount += 1;
      }
    } else {
      // VOC import expects image files and XML annotations (usually in an annotations folder).
      const xmlByBaseName = new Map<string, DirectoryEntry>();
      for (const xmlEntry of vocCandidateEntries) {
        if (!xmlByBaseName.has(xmlEntry.baseNameLower)) {
          xmlByBaseName.set(xmlEntry.baseNameLower, xmlEntry);
        }
      }

      const preferredImages = imageEntries.filter((e) => e.relPathLower.includes('/images/'));
      const sourceImages = preferredImages.length > 0 ? preferredImages : imageEntries;
      for (const imageEntry of sourceImages) {
        const importedImageId = uid('img');
        let dims: { width: number; height: number };
        try {
          dims = await getImageDimensions(imageEntry.file);
        } catch {
          continue;
        }

        const annotations: Annotation[] = [];
        const xmlEntry = xmlByBaseName.get(imageEntry.baseNameLower) ?? null;
        if (xmlEntry) {
          let parsedVoc: VocParsedAnnotation | null = null;
          try {
            parsedVoc = parseVocAnnotationXml(await xmlEntry.file.text());
          } catch {
            parsedVoc = null;
          }

          if (parsedVoc) {
            for (const object of parsedVoc.objects) {
              const bbox = normalizeBBox(
                {
                  x: object.xmin,
                  y: object.ymin,
                  width: object.xmax - object.xmin,
                  height: object.ymax - object.ymin,
                },
                dims.width,
                dims.height
              );
              if (bbox.width < 1 || bbox.height < 1) {
                skippedAnnotations += 1;
                continue;
              }

              const classId = ensureClassId(object.name);
              annotations.push({
                id: uid('ann'),
                classId,
                bbox,
                isVisible: true,
                isAnchored: false,
                displayId: allocateDisplayId(importedImageId),
              });
              importedAnnotationCount += 1;
            }
          }
        }

        nextDisplayIdByClass[importedImageId] = Math.max(
          nextDisplayIdByClass[importedImageId] ?? 1,
          annotations.reduce((max, ann) => Math.max(max, (ann.displayId ?? 0) + 1), 1)
        );
        newImages.push({
          id: importedImageId,
          name: toUniqueName(imageEntry.file.name, takenNames),
          file: imageEntry.file,
          src: '',
          width: dims.width,
          height: dims.height,
          isBookmarked: false,
          annotations,
          sourceKind: 'image',
        });
      }
    }

    if (newImages.length === 0) {
      set({ statusText: `No images were imported from ${format.toUpperCase()} dataset.` });
      return;
    }

    const selectedClassId =
      workingClasses.some((c) => c.id === state.selectedClassId) && state.selectedClassId
        ? state.selectedClassId
        : fallbackClassId;
    const importedImageWord = newImages.length === 1 ? 'image' : 'images';
    const importedAnnotationWord = importedAnnotationCount === 1 ? 'annotation' : 'annotations';
    const skippedPart = skippedAnnotations > 0 ? `, ${skippedAnnotations} skipped` : '';

    set((s) => ({
      classes: workingClasses,
      images: reconcileImageSourcesForSelection(
        [...s.images, ...newImages],
        s.selectedImageId ?? newImages[0]?.id ?? null
      ),
      selectedClassId,
      selectedImageId: s.selectedImageId ?? newImages[0]?.id ?? null,
      selectedAnnotationId: s.selectedImageId ? s.selectedAnnotationId : null,
      selectedAnnotationIds: s.selectedImageId ? s.selectedAnnotationIds : [],
      nextDisplayIdByClass,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
      statusText: `Imported ${format.toUpperCase()} dataset: ${newImages.length} ${importedImageWord}, ${importedAnnotationCount} ${importedAnnotationWord}${skippedPart}.`,
    }));
  },

  importWorkspaceState: async (file) => {
    const state = get();
    if (!file) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      set({ statusText: 'Workspace import failed: invalid ZIP file.' });
      return;
    }

    const stateFile = zip.file('workspace_state.json');
    if (!stateFile) {
      set({ statusText: 'Workspace import failed: workspace_state.json not found.' });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await stateFile.async('text'));
    } catch {
      set({ statusText: 'Workspace import failed: workspace_state.json is invalid.' });
      return;
    }

    const isObject = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;
    const asString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
    const asNumber = (value: unknown): number | null =>
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
    const asStringArray = (value: unknown): string[] | null =>
      Array.isArray(value)
        ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))]
        : null;
    const enumValue = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
      typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
    const clampValue = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

    const root = isObject(payload) ? payload : {};
    const rawSettings = isObject(root.settings) ? root.settings : {};
    const defaultView = getDefaultViewState();
    const importedView: ViewState = {
      interactionMode: enumValue(rawSettings.interactionMode, ['add', 'edit'] as const, defaultView.interactionMode),
      addingMode: enumValue(rawSettings.addingMode, ['click', 'drag'] as const, defaultView.addingMode),
      classAssignmentMode: enumValue(
        rawSettings.classAssignmentMode,
        ['activeClass', 'deferred'] as const,
        defaultView.classAssignmentMode
      ),
      imageSort: enumValue(
        rawSettings.imageSort,
        ['none', 'alphabetical', 'reversedAlphabetical', 'largestFirst', 'smallestFirst', 'mostAnnotations', 'fewestAnnotations'] as const,
        defaultView.imageSort
      ),
      imageFilter: enumValue(
        rawSettings.imageFilter,
        ['none', 'hideAnnotated', 'hideUnannotated', 'hideBookmarked', 'hideUnbookmarked'] as const,
        defaultView.imageFilter
      ),
      imageClassFilterMode: enumValue(
        rawSettings.imageClassFilterMode,
        ['none', 'hasAny', 'hasAll', 'hasNone'] as const,
        defaultView.imageClassFilterMode
      ),
      imageClassFilterClassIds: asStringArray(rawSettings.imageClassFilterClassIds) ?? defaultView.imageClassFilterClassIds,
      annotationSort: enumValue(
        rawSettings.annotationSort,
        ['none', 'oldest', 'newest', 'alphabetical', 'reversedAlphabetical', 'largestFirst', 'smallestFirst'] as const,
        defaultView.annotationSort
      ),
      annotationFilter: enumValue(
        rawSettings.annotationFilter,
        ['none', 'hideAssigned', 'hideUnassigned'] as const,
        defaultView.annotationFilter
      ),
      classSort: enumValue(
        rawSettings.classSort,
        ['none', 'alphabetical', 'reversedAlphabetical', 'countAscending', 'countDescending'] as const,
        defaultView.classSort
      ),
      classFilter: enumValue(rawSettings.classFilter, ['none', 'hideUsed', 'hideUnused'] as const, defaultView.classFilter),
      suppressUnassignedExportWarningDialog:
        asBoolean(rawSettings.suppressUnassignedExportWarningDialog) ?? defaultView.suppressUnassignedExportWarningDialog,
      suppressDeleteAnnotationWarningDialog:
        asBoolean(rawSettings.suppressDeleteAnnotationWarningDialog) ?? defaultView.suppressDeleteAnnotationWarningDialog,
      suppressDeleteImageWarningDialog:
        asBoolean(rawSettings.suppressDeleteImageWarningDialog) ?? defaultView.suppressDeleteImageWarningDialog,
      suppressRemoveClassInstancesWarningDialog:
        asBoolean(rawSettings.suppressRemoveClassInstancesWarningDialog) ?? defaultView.suppressRemoveClassInstancesWarningDialog,
      exportIncludeUnassigned: asBoolean(rawSettings.exportIncludeUnassigned) ?? defaultView.exportIncludeUnassigned,
      showLabels: asBoolean(rawSettings.showLabels) ?? defaultView.showLabels,
      showOnlySelectedThumbs: asBoolean(rawSettings.showOnlySelectedThumbs) ?? defaultView.showOnlySelectedThumbs,
      bboxOpacity: clampValue(asNumber(rawSettings.bboxOpacity) ?? defaultView.bboxOpacity, 0, 1),
      lineThickness: clampValue(asNumber(rawSettings.lineThickness) ?? defaultView.lineThickness, 0.5, 12),
      drawBoxFill: asBoolean(rawSettings.drawBoxFill) ?? defaultView.drawBoxFill,
      drawBoxBorder: asBoolean(rawSettings.drawBoxBorder) ?? defaultView.drawBoxBorder,
      showCrosshair: asBoolean(rawSettings.showCrosshair) ?? defaultView.showCrosshair,
      showMinimap: asBoolean(rawSettings.showMinimap) ?? defaultView.showMinimap,
      minimapLocation: enumValue(
        rawSettings.minimapLocation,
        ['topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'sidebar'] as const,
        defaultView.minimapLocation
      ),
      dragDeadzonePx: Math.max(0, Math.floor(asNumber(rawSettings.dragDeadzonePx) ?? defaultView.dragDeadzonePx)),
    };

    const rawClasses = Array.isArray(root.classes) ? root.classes : [];
    const classIds = new Set<string>();
    const importedClasses: ClassData[] = [];
    for (const rawClass of rawClasses) {
      if (!isObject(rawClass)) continue;
      let classId = asString(rawClass.id) ?? uid('class');
      while (classIds.has(classId)) {
        classId = uid('class');
      }
      classIds.add(classId);

      const rawName = asString(rawClass.name) ?? `Class_${importedClasses.length + 1}`;
      const sanitizedName = sanitizeClassName(rawName) || rawName.replace(/\s+/g, '_');
      const color = asString(rawClass.color) ?? getClassColor(importedClasses.length);
      const hotkeyRaw = asString(rawClass.hotkey);
      const hotkey = hotkeyRaw && /^[A-Z0-9]$/i.test(hotkeyRaw) ? hotkeyRaw.toUpperCase() : undefined;

      importedClasses.push({
        id: classId,
        name: sanitizedName,
        color,
        isVisible: asBoolean(rawClass.isVisible) ?? true,
        isDefault: asBoolean(rawClass.isDefault) ?? false,
        hotkey,
      });
    }

    if (importedClasses.length === 0) {
      importedClasses.push({
        id: uid('class'),
        name: FALLBACK_CLASS_NAME,
        color: '#27272A',
        isVisible: true,
        isDefault: true,
      });
    }
    const firstDefaultIndex = importedClasses.findIndex((c) => c.isDefault);
    if (firstDefaultIndex < 0) {
      importedClasses[0] = { ...importedClasses[0], isDefault: true };
    } else {
      for (let i = 0; i < importedClasses.length; i += 1) {
        if (i === firstDefaultIndex) continue;
        if (importedClasses[i].isDefault) {
          importedClasses[i] = { ...importedClasses[i], isDefault: false };
        }
      }
    }
    const fallbackClassId = importedClasses.find((c) => c.isDefault)?.id ?? importedClasses[0].id;
    const validClassIds = new Set(importedClasses.map((c) => c.id));

    const rawImages = Array.isArray(root.images) ? root.images : [];
    const importedImages: ImageItem[] = [];
    const imageIds = new Set<string>();
    const imageNames = new Set<string>();
    let skippedImages = 0;
    let skippedAnnotations = 0;

    for (const rawImage of rawImages) {
      if (!isObject(rawImage)) {
        skippedImages += 1;
        continue;
      }

      const fileName = asString(rawImage.fileName) ?? asString(rawImage.name);
      if (!fileName) {
        skippedImages += 1;
        continue;
      }
      const zipImageEntry = zip.file(`images/${fileName}`) ?? zip.file(fileName);
      if (!zipImageEntry) {
        skippedImages += 1;
        continue;
      }

      let imageBlob: Blob;
      try {
        imageBlob = await zipImageEntry.async('blob');
      } catch {
        skippedImages += 1;
        continue;
      }
      const imageFile = new File([imageBlob], fileName, {
        type: imageBlob.type || 'application/octet-stream',
        lastModified: Date.now(),
      });

      let width = asNumber(rawImage.width) ?? 0;
      let height = asNumber(rawImage.height) ?? 0;
      if (width <= 0 || height <= 0) {
        try {
          const dims = await getImageDimensions(imageFile);
          width = dims.width;
          height = dims.height;
        } catch {
          skippedImages += 1;
          continue;
        }
      }

      let imageId = asString(rawImage.id) ?? uid('img');
      while (imageIds.has(imageId)) {
        imageId = uid('img');
      }
      imageIds.add(imageId);

      const requestedName = asString(rawImage.name) ?? fileName;
      const name = toUniqueName(requestedName, imageNames);
      const rawAnnotations = Array.isArray(rawImage.annotations) ? rawImage.annotations : [];
      const annotations: Annotation[] = [];
      const annotationIds = new Set<string>();
      let nextDisplayId = 1;

      for (const rawAnn of rawAnnotations) {
        if (!isObject(rawAnn)) {
          skippedAnnotations += 1;
          continue;
        }
        const rawBbox = isObject(rawAnn.bbox) ? rawAnn.bbox : null;
        if (!rawBbox) {
          skippedAnnotations += 1;
          continue;
        }
        const x = asNumber(rawBbox.x);
        const y = asNumber(rawBbox.y);
        const w = asNumber(rawBbox.width);
        const h = asNumber(rawBbox.height);
        if (x === null || y === null || w === null || h === null) {
          skippedAnnotations += 1;
          continue;
        }
        const bbox = normalizeBBox({ x, y, width: w, height: h }, width, height);
        if (bbox.width < 1 || bbox.height < 1) {
          skippedAnnotations += 1;
          continue;
        }

        let annotationId = asString(rawAnn.id) ?? uid('ann');
        while (annotationIds.has(annotationId)) {
          annotationId = uid('ann');
        }
        annotationIds.add(annotationId);

        const requestedClassId = asString(rawAnn.classId) ?? fallbackClassId;
        const classId = validClassIds.has(requestedClassId) ? requestedClassId : fallbackClassId;
        const parsedDisplayId = asNumber(rawAnn.displayId);
        const displayId = parsedDisplayId && parsedDisplayId >= 1 ? Math.floor(parsedDisplayId) : nextDisplayId;
        nextDisplayId = Math.max(nextDisplayId, displayId + 1);

        annotations.push({
          id: annotationId,
          classId,
          bbox,
          isVisible: asBoolean(rawAnn.isVisible) ?? true,
          isAnchored: asBoolean(rawAnn.isAnchored) ?? false,
          displayId,
        });
      }

      const sourceKindRaw = asString(rawImage.sourceKind);
      const sourceKind = sourceKindRaw === 'videoFrame' ? 'videoFrame' : 'image';
      let videoMeta: ImageItem['videoMeta'] = undefined;
      if (sourceKind === 'videoFrame' && isObject(rawImage.videoMeta)) {
        const videoId = asString(rawImage.videoMeta.videoId);
        const videoName = asString(rawImage.videoMeta.videoName);
        const sourceFps = asNumber(rawImage.videoMeta.sourceFps);
        const sourceDurationMs = asNumber(rawImage.videoMeta.sourceDurationMs);
        const frameIndex = asNumber(rawImage.videoMeta.frameIndex);
        const timestampMs = asNumber(rawImage.videoMeta.timestampMs);
        if (videoId && videoName && sourceFps !== null && sourceDurationMs !== null && frameIndex !== null && timestampMs !== null) {
          videoMeta = {
            videoId,
            videoName,
            sourceFps,
            sourceDurationMs: Math.max(0, Math.round(sourceDurationMs)),
            frameIndex: Math.max(0, Math.round(frameIndex)),
            timestampMs: Math.max(0, Math.round(timestampMs)),
          };
        }
      }

      importedImages.push({
        id: imageId,
        name,
        file: imageFile,
        src: '',
        width,
        height,
        isBookmarked: asBoolean(rawImage.isBookmarked) ?? false,
        annotations,
        sourceKind,
        videoMeta,
      });
    }

    if (importedImages.length === 0) {
      set({ statusText: 'Workspace import failed: no images could be restored.' });
      return;
    }

    const rawSelection = isObject(root.selection) ? root.selection : {};
    const requestedClassId = asString(rawSelection.selectedClassId);
    const importedSelectedClassId = requestedClassId && validClassIds.has(requestedClassId) ? requestedClassId : fallbackClassId;
    const selectedClassId =
      importedView.classAssignmentMode === 'deferred'
        ? getDefaultClassId(importedClasses, fallbackClassId)
        : importedSelectedClassId;

    const imageById = new Map(importedImages.map((img) => [img.id, img]));
    const requestedImageId = asString(rawSelection.selectedImageId);
    const selectedImageId = requestedImageId && imageById.has(requestedImageId) ? requestedImageId : importedImages[0]?.id ?? null;

    const selectedImage = selectedImageId ? imageById.get(selectedImageId) ?? null : null;
    const validAnnotationIds = new Set((selectedImage?.annotations ?? []).map((ann) => ann.id));
    const rawSelectedAnnotationIds = Array.isArray(rawSelection.selectedAnnotationIds) ? rawSelection.selectedAnnotationIds : [];
    const selectedAnnotationIds = Array.from(
      new Set(
        rawSelectedAnnotationIds
          .map((value) => (typeof value === 'string' ? value : null))
          .filter((value): value is string => Boolean(value && validAnnotationIds.has(value)))
      )
    );

    const requestedAnnotationId = asString(rawSelection.selectedAnnotationId);
    const selectedAnnotationId =
      requestedAnnotationId && validAnnotationIds.has(requestedAnnotationId)
        ? requestedAnnotationId
        : selectedAnnotationIds[selectedAnnotationIds.length - 1] ?? null;

    const nextDisplayIdByClass: Record<string, number> = {};
    for (const img of importedImages) {
      const computed = img.annotations.reduce((max, ann) => Math.max(max, ann.displayId + 1), 1);
      nextDisplayIdByClass[img.id] = computed;
    }
    if (isObject(root.nextDisplayIdByClass)) {
      for (const [imageId, value] of Object.entries(root.nextDisplayIdByClass)) {
        if (!imageById.has(imageId)) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) continue;
        nextDisplayIdByClass[imageId] = Math.max(nextDisplayIdByClass[imageId] ?? 1, Math.floor(value));
      }
    }

    revokeImageSources(state.images);
    set((s) => ({
      ...importedView,
      classes: importedClasses,
      images: reconcileImageSourcesForSelection(importedImages, selectedImageId),
      selectedClassId,
      selectedImageId,
      selectedAnnotationId,
      selectedAnnotationIds,
      liveDraftBBox: null,
      liveDraftClassId: null,
      deferredLastAnnotationId: null,
      deferredLastImageId: null,
      nextDisplayIdByClass,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
      statusText: `Imported workspace state: ${importedImages.length} images${skippedImages > 0 ? `, ${skippedImages} skipped` : ''}${skippedAnnotations > 0 ? `, ${skippedAnnotations} annotations skipped` : ''}.`,
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

  selectImage: (imageId) =>
    set((s) => {
      const selectedImageId =
        imageId !== null && s.images.some((img) => img.id === imageId)
          ? imageId
          : null;
      return {
        images: reconcileImageSourcesForSelection(s.images, selectedImageId),
        selectedImageId,
        selectedAnnotationId: null,
        selectedAnnotationIds: [],
        liveDraftBBox: null,
        liveDraftClassId: null,
        deferredLastAnnotationId: null,
        deferredLastImageId: null,
      };
    }),
  toggleImageBookmark: (imageId) => {
    const state = get();
    const image = state.images.find((img) => img.id === imageId);
    if (!image) return;
    get().setImagesBookmarked([imageId], !image.isBookmarked);
  },
  setImagesBookmarked: (imageIds, bookmarked) => {
    const state = get();
    const idSet = new Set(imageIds);
    if (idSet.size === 0) return;
    const hasChanged = state.images.some((img) => idSet.has(img.id) && img.isBookmarked !== bookmarked);
    if (!hasChanged) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => (idSet.has(img.id) ? { ...img, isBookmarked: bookmarked } : img)),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },
  selectClass: (classId) => {
    const state = get();
    if (!state.classes.some((c) => c.id === classId)) return;

    const shouldAssignDeferred =
      state.interactionMode === 'add' &&
      state.classAssignmentMode === 'deferred';

    if (!shouldAssignDeferred) {
      set({ selectedClassId: classId });
      return;
    }

    const defaultClassId = getDefaultClassId(state.classes, state.selectedClassId);

    if (state.liveDraftBBox) {
      set({
        selectedClassId: defaultClassId,
        liveDraftClassId: classId,
      });
      return;
    }

    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image) {
      set({ selectedClassId: defaultClassId });
      return;
    }

    const targetId =
      state.deferredLastImageId === image.id ? state.deferredLastAnnotationId : null;
    if (!targetId || !image.annotations.some((a) => a.id === targetId)) {
      set({ selectedClassId: defaultClassId });
      return;
    }

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      selectedClassId: defaultClassId,
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                a.id === targetId ? { ...a, classId } : a
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },
  selectAnnotation: (annotationId) =>
    set({ selectedAnnotationId: annotationId, selectedAnnotationIds: annotationId ? [annotationId] : [] }),
  setAnnotationSelection: (annotationIds, latestId = null) => {
    const unique = Array.from(new Set(annotationIds));
    const resolvedLatest =
      latestId && unique.includes(latestId) ? latestId : unique.length > 0 ? unique[unique.length - 1] : null;
    set({ selectedAnnotationIds: unique, selectedAnnotationId: resolvedLatest });
  },
  toggleAnnotationSelection: (annotationId) =>
    set((s) => {
      const exists = s.selectedAnnotationIds.includes(annotationId);
      if (exists) {
        const next = s.selectedAnnotationIds.filter((id) => id !== annotationId);
        return {
          selectedAnnotationIds: next,
          selectedAnnotationId: next.length > 0 ? next[next.length - 1] : null,
        };
      }
      return {
        selectedAnnotationIds: [...s.selectedAnnotationIds, annotationId],
        selectedAnnotationId: annotationId,
      };
    }),
  clearAnnotationSelection: () => set({ selectedAnnotationId: null, selectedAnnotationIds: [] }),
  selectAllAnnotationsCurrentImage: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;
    const ids = image.annotations.map((a) => a.id);
    set({ selectedAnnotationIds: ids, selectedAnnotationId: ids[ids.length - 1] ?? null });
  },

  // --- Class management ---
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const newClass: ClassData = {
      id: uid('class'),
      name: sanitized,
      color: getClassColor(state.classes.length),
      isVisible: true,
      hotkey: undefined,
    };

    set((s) => ({
      classes: [...s.classes, newClass],
      selectedClassId: s.selectedClassId,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  renameClass: (classId, newName) => {
    const state = get();
    const cls = state.classes.find((c) => c.id === classId);
    if (!cls || cls.isDefault) return;

    const sanitized = sanitizeClassName(newName);
    if (!sanitized || !/[A-Za-z0-9]/.test(sanitized)) {
      set({ statusText: 'Class name must contain letters or digits.' });
      return;
    }
    if (state.classes.some((c) => c.id !== classId && c.name.toLowerCase() === sanitized.toLowerCase())) {
      set({ statusText: `Class "${sanitized}" already exists.` });
      return;
    }

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      classes: s.classes.map((c) => (c.id === classId ? { ...c, name: sanitized } : c)),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  setClassHotkey: (classId, hotkey) => {
    const state = get();
    const cls = state.classes.find((c) => c.id === classId);
    if (!cls) return;

    const normalized = normalizeClassHotkey(hotkey);
    if (!normalized) {
      set({ statusText: 'Hotkey must be a single letter (A-Z) or digit (0-9).' });
      return;
    }

    const conflicting = state.classes.find((c) => c.id !== classId && c.hotkey === normalized);
    if (conflicting) {
      set({ statusText: `Hotkey "${normalized}" is already assigned to "${conflicting.name}".` });
      return;
    }

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      classes: s.classes.map((c) => (c.id === classId ? { ...c, hotkey: normalized } : c)),
      statusText: `Assigned "${normalized}" to class "${cls.name}".`,
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  clearClassHotkey: (classId) => {
    const state = get();
    const cls = state.classes.find((c) => c.id === classId);
    if (!cls || !cls.hotkey) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      classes: s.classes.map((c) => (c.id === classId ? { ...c, hotkey: undefined } : c)),
      statusText: `Cleared hotkey for class "${cls.name}".`,
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const selectedImage = state.images.find((i) => i.id === state.selectedImageId) ?? null;
    const selectedAnnotation = selectedImage?.annotations.find((a) => a.id === state.selectedAnnotationId) ?? null;
    const selectedAnnotationById = new Map((selectedImage?.annotations ?? []).map((a) => [a.id, a]));
    const nextVisible = !cls.isVisible;

    set((s) => ({
      classes: s.classes.map((c) => (c.id === classId ? { ...c, isVisible: nextVisible } : c)),
      selectedAnnotationIds: !nextVisible
        ? s.selectedAnnotationIds.filter((id) => selectedAnnotationById.get(id)?.classId !== classId)
        : s.selectedAnnotationIds,
      selectedAnnotationId: !nextVisible
        ? (() => {
            const filtered = s.selectedAnnotationIds.filter((id) => selectedAnnotationById.get(id)?.classId !== classId);
            if (filtered.length > 0) return filtered[filtered.length - 1];
            return !nextVisible && selectedAnnotation?.classId === classId ? null : s.selectedAnnotationId;
          })()
        : s.selectedAnnotationId,
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: [],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.filter((a) => a.classId !== classId),
      })),
      selectedAnnotationId: null,
      selectedAnnotationIds: [],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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

  swapClassInstances: (classIds, substituteClassId, scope) => {
    const state = get();
    if (!state.classes.some((c) => c.id === substituteClassId)) return;

    const sourceIds = [...new Set(classIds)]
      .filter((classId) => classId !== substituteClassId)
      .filter((classId) => state.classes.some((c) => c.id === classId));
    if (sourceIds.length === 0) return;

    const sourceSet = new Set(sourceIds);
    const targetImageIds = getImageIdsByScope(state.images, state.selectedImageId, scope);
    if (targetImageIds.length === 0) return;
    const targetImageIdSet = new Set(targetImageIds);

    const hasAffected = state.images.some(
      (img) =>
        targetImageIdSet.has(img.id) && img.annotations.some((ann) => sourceSet.has(ann.classId))
    );
    if (!hasAffected) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        !targetImageIdSet.has(img.id)
          ? img
          : {
              ...img,
              annotations: img.annotations.map((ann) =>
                sourceSet.has(ann.classId) ? { ...ann, classId: substituteClassId } : ann
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  removeClassInstances: (classIds, scope) => {
    const state = get();
    const sourceIds = [...new Set(classIds)].filter((classId) =>
      state.classes.some((c) => c.id === classId)
    );
    if (sourceIds.length === 0) return;

    const sourceSet = new Set(sourceIds);
    const targetImageIds = getImageIdsByScope(state.images, state.selectedImageId, scope);
    if (targetImageIds.length === 0) return;
    const targetImageIdSet = new Set(targetImageIds);

    const hasAffected = state.images.some(
      (img) =>
        targetImageIdSet.has(img.id) && img.annotations.some((ann) => sourceSet.has(ann.classId))
    );
    if (!hasAffected) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const images = s.images.map((img) =>
        !targetImageIdSet.has(img.id)
          ? img
          : {
              ...img,
              annotations: img.annotations.filter((ann) => !sourceSet.has(ann.classId)),
            }
      );
      const selectedImage = images.find((img) => img.id === s.selectedImageId);
      const validSelectedIds = new Set((selectedImage?.annotations ?? []).map((ann) => ann.id));
      const selectedAnnotationIds = s.selectedAnnotationIds.filter((id) => validSelectedIds.has(id));
      const selectedAnnotationId =
        s.selectedAnnotationId && validSelectedIds.has(s.selectedAnnotationId)
          ? s.selectedAnnotationId
          : selectedAnnotationIds[0] ?? null;
      return {
        images,
        selectedAnnotationIds,
        selectedAnnotationId,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  setClassInstancesAnchoring: (classIds, anchored, scope) => {
    const state = get();
    const sourceIds = [...new Set(classIds)].filter((classId) =>
      state.classes.some((c) => c.id === classId)
    );
    if (sourceIds.length === 0) return;

    const sourceSet = new Set(sourceIds);
    const targetImageIds = getImageIdsByScope(state.images, state.selectedImageId, scope);
    if (targetImageIds.length === 0) return;
    const targetImageIdSet = new Set(targetImageIds);

    const hasAffected = state.images.some(
      (img) =>
        targetImageIdSet.has(img.id) &&
        img.annotations.some((ann) => sourceSet.has(ann.classId) && ann.isAnchored !== anchored)
    );
    if (!hasAffected) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        !targetImageIdSet.has(img.id)
          ? img
          : {
              ...img,
              annotations: img.annotations.map((ann) =>
                sourceSet.has(ann.classId) ? { ...ann, isAnchored: anchored } : ann
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  setClassInstancesVisibility: (classIds, visible, scope) => {
    const state = get();
    const sourceIds = [...new Set(classIds)].filter((classId) =>
      state.classes.some((c) => c.id === classId)
    );
    if (sourceIds.length === 0) return;

    const sourceSet = new Set(sourceIds);
    const targetImageIds = getImageIdsByScope(state.images, state.selectedImageId, scope);
    if (targetImageIds.length === 0) return;
    const targetImageIdSet = new Set(targetImageIds);

    const hasAffected = state.images.some(
      (img) =>
        targetImageIdSet.has(img.id) &&
        img.annotations.some((ann) => sourceSet.has(ann.classId) && ann.isVisible !== visible)
    );
    if (!hasAffected) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const images = s.images.map((img) =>
        !targetImageIdSet.has(img.id)
          ? img
          : {
              ...img,
              annotations: img.annotations.map((ann) =>
                sourceSet.has(ann.classId) ? { ...ann, isVisible: visible } : ann
              ),
            }
      );
      const selectedImage = images.find((img) => img.id === s.selectedImageId);
      const selectedMap = new Map((selectedImage?.annotations ?? []).map((ann) => [ann.id, ann]));
      const selectedAnnotationIds = s.selectedAnnotationIds.filter(
        (id) => selectedMap.get(id)?.isVisible ?? false
      );
      const selectedAnnotationId =
        s.selectedAnnotationId && (selectedMap.get(s.selectedAnnotationId)?.isVisible ?? false)
          ? s.selectedAnnotationId
          : selectedAnnotationIds[selectedAnnotationIds.length - 1] ?? null;
      return {
        images,
        selectedAnnotationIds,
        selectedAnnotationId,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  // --- Annotation management ---
  addAnnotation: (bbox) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image) return;

    const normalized = normalizeBBox(bbox, image.width, image.height);
    const minSize = Math.max(2, state.dragDeadzonePx);
    if (normalized.width < minSize || normalized.height < minSize) return;

    const defaultClassId = getDefaultClassId(state.classes, state.selectedClassId);
    const classId =
      state.classAssignmentMode === 'deferred'
        ? state.liveDraftClassId && state.classes.some((c) => c.id === state.liveDraftClassId)
          ? state.liveDraftClassId
          : defaultClassId
        : state.selectedClassId;
    const displayId = getNextDisplayIdForImage(state.nextDisplayIdByClass, state.images, image.id);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: [newAnn.id],
      selectedClassId:
        s.classAssignmentMode === 'deferred'
          ? getDefaultClassId(s.classes, s.selectedClassId)
          : s.selectedClassId,
      liveDraftClassId: null,
      deferredLastAnnotationId:
        s.classAssignmentMode === 'deferred' ? newAnn.id : null,
      deferredLastImageId:
        s.classAssignmentMode === 'deferred' ? image.id : null,
      nextDisplayIdByClass: {
        ...s.nextDisplayIdByClass,
        [image.id]: displayId + 1,
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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

  nudgeSelectedAnnotations: (dx, dy) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image) return;

    // Keyboard nudge follows normal drag semantics: only single selected annotation can move.
    const selectedId = state.selectedAnnotationId;
    if (!selectedId) return;
    if (state.selectedAnnotationIds.length > 1) return;
    if (state.selectedAnnotationIds.length === 1 && state.selectedAnnotationIds[0] !== selectedId) return;

    const ann = image.annotations.find((a) => a.id === selectedId);
    if (!ann || ann.isAnchored) return;

    const nextX = clamp(ann.bbox.x + dx, 0, image.width - ann.bbox.width);
    const nextY = clamp(ann.bbox.y + dy, 0, image.height - ann.bbox.height);
    if (nextX === ann.bbox.x && nextY === ann.bbox.y) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                a.id === selectedId
                  ? {
                      ...a,
                      bbox: {
                        ...a.bbox,
                        x: nextX,
                        y: nextY,
                      },
                    }
                  : a
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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

  setAnnotationsClass: (annotationIds, classId) => {
    const state = get();
    if (!state.classes.some((c) => c.id === classId)) return;
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || annotationIds.length === 0) return;
    const targetIds = new Set(annotationIds.filter((id) => image.annotations.some((a) => a.id === id)));
    if (targetIds.size === 0) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                targetIds.has(a.id) ? { ...a, classId } : a
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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

  toggleAnnotationsVisibility: (annotationIds) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || annotationIds.length === 0) return;
    const targetIds = new Set(annotationIds.filter((id) => image.annotations.some((a) => a.id === id)));
    if (targetIds.size === 0) return;
    const selected = image.annotations.filter((a) => targetIds.has(a.id));
    const setVisible = selected.some((a) => !a.isVisible);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                targetIds.has(a.id) ? { ...a, isVisible: setVisible } : a
              ),
            }
      ),
      selectedAnnotationId: setVisible ? s.selectedAnnotationId : null,
      selectedAnnotationIds: setVisible ? s.selectedAnnotationIds : [],
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAnnotationsAnchoring: (annotationIds) => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || annotationIds.length === 0) return;
    const targetIds = new Set(annotationIds.filter((id) => image.annotations.some((a) => a.id === id)));
    if (targetIds.size === 0) return;
    const selected = image.annotations.filter((a) => targetIds.has(a.id));
    const setAnchored = selected.some((a) => !a.isAnchored);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.map((a) =>
                targetIds.has(a.id) ? { ...a, isAnchored: setAnchored } : a
              ),
            }
      ),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  // --- Bulk delete helpers ---
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const selectedAnnotationIds = s.selectedAnnotationIds.filter((id) => id !== annotationId);
      return {
        images: s.images.map((img) =>
          img.id !== s.selectedImageId
            ? img
            : {
                ...img,
                annotations: img.annotations.filter((a) => a.id !== annotationId),
              }
        ),
        selectedAnnotationIds,
        selectedAnnotationId:
          selectedAnnotationIds.length > 0
            ? selectedAnnotationIds[selectedAnnotationIds.length - 1]
            : s.selectedAnnotationId === annotationId
              ? null
              : s.selectedAnnotationId,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  deleteSelectedAnnotations: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || state.selectedAnnotationIds.length === 0) return;
    const selected = new Set(state.selectedAnnotationIds);
    if (!image.annotations.some((a) => selected.has(a.id))) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id !== s.selectedImageId
          ? img
          : {
              ...img,
              annotations: img.annotations.filter((a) => !selected.has(a.id)),
            }
      ),
      selectedAnnotationId: null,
      selectedAnnotationIds: [],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        img.id === s.selectedImageId ? { ...img, annotations: [] } : img
      ),
      selectedAnnotationId: null,
      selectedAnnotationIds: [],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({ ...img, annotations: [] })),
      selectedAnnotationId: null,
      selectedAnnotationIds: [],
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  removeAllBBoxesBookmarked: () => {
    const state = get();
    const bookmarkedImageIds = new Set(state.images.filter((img) => img.isBookmarked).map((img) => img.id));
    if (bookmarkedImageIds.size === 0) return;
    const hasAny = state.images.some(
      (img) => bookmarkedImageIds.has(img.id) && img.annotations.length > 0
    );
    if (!hasAny) return;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const images = s.images.map((img) =>
        bookmarkedImageIds.has(img.id) ? { ...img, annotations: [] } : img
      );
      const selectedImage = images.find((img) => img.id === s.selectedImageId) ?? null;
      const validSelectedIds = new Set((selectedImage?.annotations ?? []).map((ann) => ann.id));
      const selectedAnnotationIds = s.selectedAnnotationIds.filter((id) => validSelectedIds.has(id));
      const selectedAnnotationId =
        s.selectedAnnotationId && validSelectedIds.has(s.selectedAnnotationId)
          ? s.selectedAnnotationId
          : selectedAnnotationIds[selectedAnnotationIds.length - 1] ?? null;
      return {
        images,
        selectedAnnotationIds,
        selectedAnnotationId,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  // --- Whole-image visibility/anchoring toggles ---
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
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
      selectedAnnotationIds: visible ? s.selectedAnnotationIds : [],
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAllAnchoringGlobal: () => {
    const state = get();
    if (!state.images.some((i) => i.annotations.length > 0)) return;
    const hasUnanchored = state.images.some((img) => img.annotations.some((a) => !a.isAnchored));
    const nextAnchored = hasUnanchored;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.map((a) => ({ ...a, isAnchored: nextAnchored })),
      })),
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAllAnchoringBookmarked: () => {
    const state = get();
    const bookmarkedImageIds = new Set(state.images.filter((img) => img.isBookmarked).map((img) => img.id));
    if (bookmarkedImageIds.size === 0) return;
    const hasAny = state.images.some(
      (img) => bookmarkedImageIds.has(img.id) && img.annotations.length > 0
    );
    if (!hasAny) return;
    const hasUnanchored = state.images.some(
      (img) => bookmarkedImageIds.has(img.id) && img.annotations.some((ann) => !ann.isAnchored)
    );
    const nextAnchored = hasUnanchored;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) =>
        !bookmarkedImageIds.has(img.id)
          ? img
          : {
              ...img,
              annotations: img.annotations.map((ann) => ({ ...ann, isAnchored: nextAnchored })),
            }
      ),
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        annotations: img.annotations.map((a) => ({ ...a, isVisible: nextVisible })),
      })),
      selectedAnnotationId: nextVisible ? s.selectedAnnotationId : null,
      selectedAnnotationIds: nextVisible ? s.selectedAnnotationIds : [],
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  toggleAllVisibilityBookmarked: () => {
    const state = get();
    const bookmarkedImageIds = new Set(state.images.filter((img) => img.isBookmarked).map((img) => img.id));
    if (bookmarkedImageIds.size === 0) return;
    const hasAny = state.images.some(
      (img) => bookmarkedImageIds.has(img.id) && img.annotations.length > 0
    );
    if (!hasAny) return;
    const hasHidden = state.images.some(
      (img) => bookmarkedImageIds.has(img.id) && img.annotations.some((ann) => !ann.isVisible)
    );
    const nextVisible = hasHidden;

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const images = s.images.map((img) =>
        !bookmarkedImageIds.has(img.id)
          ? img
          : {
              ...img,
              annotations: img.annotations.map((ann) => ({ ...ann, isVisible: nextVisible })),
            }
      );
      const selectedImage = images.find((img) => img.id === s.selectedImageId) ?? null;
      const selectedMap = new Map((selectedImage?.annotations ?? []).map((ann) => [ann.id, ann]));
      const selectedAnnotationIds = s.selectedAnnotationIds.filter(
        (id) => selectedMap.get(id)?.isVisible ?? false
      );
      const selectedAnnotationId =
        s.selectedAnnotationId && (selectedMap.get(s.selectedAnnotationId)?.isVisible ?? false)
          ? s.selectedAnnotationId
          : selectedAnnotationIds[selectedAnnotationIds.length - 1] ?? null;
      return {
        images,
        selectedAnnotationIds,
        selectedAnnotationId,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  // --- Navigation ---
  moveToNextImage: () => {
    const state = get();
    if (!state.selectedImageId || state.images.length === 0) return;
    const idx = state.images.findIndex((i) => i.id === state.selectedImageId);
    const next = state.images[(idx + 1) % state.images.length];
    get().selectImage(next.id);
  },

  moveToPrevImage: () => {
    const state = get();
    if (!state.selectedImageId || state.images.length === 0) return;
    const idx = state.images.findIndex((i) => i.id === state.selectedImageId);
    const prev = state.images[(idx - 1 + state.images.length) % state.images.length];
    get().selectImage(prev.id);
  },

  moveToFirstImage: () => {
    const state = get();
    if (state.images.length === 0) return;
    get().selectImage(state.images[0].id);
  },

  moveToLastImage: () => {
    const state = get();
    if (state.images.length === 0) return;
    get().selectImage(state.images[state.images.length - 1].id);
  },

  moveToNextAnnotation: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;

    const idx = image.annotations.findIndex((a) => a.id === state.selectedAnnotationId);
    const next = image.annotations[(idx + 1 + image.annotations.length) % image.annotations.length];
    set({ selectedAnnotationId: next.id, selectedAnnotationIds: [next.id] });
  },

  moveToPrevAnnotation: () => {
    const state = get();
    const image = state.images.find((i) => i.id === state.selectedImageId);
    if (!image || image.annotations.length === 0) return;

    const idx = image.annotations.findIndex((a) => a.id === state.selectedAnnotationId);
    const prev = image.annotations[(idx - 1 + image.annotations.length) % image.annotations.length];
    set({ selectedAnnotationId: prev.id, selectedAnnotationIds: [prev.id] });
  },

  // --- Workspace lifecycle ---
  deleteImage: (imageId) => {
    const state = get();
    if (!state.images.some((i) => i.id === imageId)) return;
    const removed = state.images.find((i) => i.id === imageId);
    if (removed) revokeObjectUrl(removed.src);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const images = s.images.filter((i) => i.id !== imageId);
      const selectedImageId = s.selectedImageId === imageId ? images[0]?.id ?? null : s.selectedImageId;
      const nextDisplayIdByClass = { ...s.nextDisplayIdByClass };
      delete nextDisplayIdByClass[imageId];
      return {
        images: reconcileImageSourcesForSelection(images, selectedImageId),
        selectedImageId,
        selectedAnnotationId: null,
        selectedAnnotationIds: [],
        nextDisplayIdByClass,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  deleteImages: (imageIds) => {
    const state = get();
    const ids = Array.from(new Set(imageIds)).filter((id) => state.images.some((img) => img.id === id));
    if (ids.length === 0) return;
    const deleted = new Set(ids);
    revokeImageSources(state.images.filter((img) => deleted.has(img.id)));

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => {
      const images = s.images.filter((img) => !deleted.has(img.id));
      const selectedImageId = s.selectedImageId && deleted.has(s.selectedImageId) ? images[0]?.id ?? null : s.selectedImageId;
      const nextDisplayIdByClass = { ...s.nextDisplayIdByClass };
      for (const id of deleted) {
        delete nextDisplayIdByClass[id];
      }
      return {
        images: reconcileImageSourcesForSelection(images, selectedImageId),
        selectedImageId,
        selectedAnnotationId: null,
        selectedAnnotationIds: [],
        nextDisplayIdByClass,
        undoStack: [...s.undoStack, cloneSnapshot(base)],
        redoStack: [],
      };
    });
  },

  closeAllImages: () => {
    const state = get();
    if (state.images.length === 0) return;
    revokeImageSources(state.images);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: [],
      selectedImageId: null,
      selectedAnnotationId: null,
      selectedAnnotationIds: [],
      liveDraftBBox: null,
      liveDraftClassId: null,
      deferredLastAnnotationId: null,
      deferredLastImageId: null,
      nextDisplayIdByClass: {},
      statusText: 'Closed all images.',
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  clearWorkspace: () => {
    const state = get();
    if (state.images.length === 0) return;
    revokeImageSources(state.images);

    const base: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    set((s) => ({
      images: [],
      selectedImageId: null,
      selectedAnnotationId: null,
      selectedAnnotationIds: [],
      liveDraftBBox: null,
      liveDraftClassId: null,
      deferredLastAnnotationId: null,
      deferredLastImageId: null,
      nextDisplayIdByClass: {},
      statusText: 'Workspace cleared.',
      undoStack: [...s.undoStack, cloneSnapshot(base)],
      redoStack: [],
    }));
  },

  // --- Undo/redo ---
  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const current: Snapshot = {
      classes: state.classes,
      images: state.images,
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const previous = state.undoStack[state.undoStack.length - 1];
    const trimmedUndo = state.undoStack.slice(0, -1);
    const restored = cloneSnapshot(previous);
    revokeImageSources(state.images);
    const hydratedImages = reconcileImageSourcesForSelection(restored.images, restored.selectedImageId);

    set({
      ...restored,
      images: hydratedImages,
      liveDraftBBox: null,
      liveDraftClassId: null,
      deferredLastAnnotationId: null,
      deferredLastImageId: null,
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
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: state.nextDisplayIdByClass,
    };

    const next = state.redoStack[state.redoStack.length - 1];
    const trimmedRedo = state.redoStack.slice(0, -1);
    const restored = cloneSnapshot(next);
    revokeImageSources(state.images);
    const hydratedImages = reconcileImageSourcesForSelection(restored.images, restored.selectedImageId);

    set({
      ...restored,
      images: hydratedImages,
      liveDraftBBox: null,
      liveDraftClassId: null,
      deferredLastAnnotationId: null,
      deferredLastImageId: null,
      redoStack: trimmedRedo,
      undoStack: [...state.undoStack, cloneSnapshot(current)],
    });
  },

  createRecoverySnapshot: () => {
    const state = get();
    const hasWorkspaceState = state.images.length > 0 || state.classes.some((c) => !c.isDefault);
    if (!hasWorkspaceState) return null;

    return {
      version: 1,
      savedAt: new Date().toISOString(),
      settings: toViewStateSnapshot(state),
      classes: state.classes.map((c) => ({ ...c })),
      images: state.images.map((img) => ({
        id: img.id,
        name: img.name,
        file: img.file,
        width: img.width,
        height: img.height,
        isBookmarked: img.isBookmarked,
        sourceKind: img.sourceKind,
        videoMeta: img.videoMeta ? { ...img.videoMeta } : undefined,
        annotations: img.annotations.map((ann) => ({
          ...ann,
          bbox: { ...ann.bbox },
        })),
      })),
      selectedClassId: state.selectedClassId,
      selectedImageId: state.selectedImageId,
      selectedAnnotationId: state.selectedAnnotationId,
      selectedAnnotationIds: [...state.selectedAnnotationIds],
      nextDisplayIdByClass: { ...state.nextDisplayIdByClass },
    };
  },

  restoreRecoverySnapshot: (snapshot) => {
    if (!snapshot || snapshot.version !== 1) {
      set({ statusText: 'Recovery snapshot is not compatible with this app version.' });
      return;
    }

    const state = get();
    const settings = sanitizeViewStateSnapshot(snapshot.settings);
    const classes: ClassData[] = snapshot.classes.map((cls) => ({
      ...cls,
      hotkey: cls.hotkey ? String(cls.hotkey).toUpperCase() : undefined,
    }));
    if (classes.length === 0) {
      classes.push({
        id: uid('class'),
        name: FALLBACK_CLASS_NAME,
        color: '#27272A',
        isVisible: true,
        isDefault: true,
        hotkey: undefined,
      });
    }
    const defaultClass = classes.find((c) => c.isDefault) ?? classes[0];
    if (!defaultClass.isDefault) {
      defaultClass.isDefault = true;
    }
    for (const cls of classes) {
      if (cls !== defaultClass && cls.isDefault) cls.isDefault = false;
    }
    const classIds = new Set(classes.map((c) => c.id));

    const images: ImageItem[] = snapshot.images.map((img) => {
      const file = img.file;
      const width = Math.max(1, Math.floor(img.width));
      const height = Math.max(1, Math.floor(img.height));
      const annotations = img.annotations
        .map((ann) => {
          const normalized = normalizeBBox(ann.bbox, width, height);
          if (normalized.width < 1 || normalized.height < 1) return null;
          const classId = classIds.has(ann.classId) ? ann.classId : defaultClass.id;
          return {
            id: ann.id,
            classId,
            bbox: normalized,
            isVisible: ann.isVisible,
            isAnchored: ann.isAnchored,
            displayId: Math.max(1, Math.floor(ann.displayId ?? 1)),
          };
        })
        .filter((ann): ann is Annotation => Boolean(ann));

      return {
        id: img.id,
        name: img.name,
        file,
        src: '',
        width,
        height,
        isBookmarked: Boolean(img.isBookmarked),
        annotations,
        sourceKind: img.sourceKind === 'videoFrame' ? 'videoFrame' : 'image',
        videoMeta: img.videoMeta ? { ...img.videoMeta } : undefined,
      };
    });

    const imageIds = new Set(images.map((img) => img.id));
    const selectedImageId =
      snapshot.selectedImageId && imageIds.has(snapshot.selectedImageId)
        ? snapshot.selectedImageId
        : images[0]?.id ?? null;
    const selectedImage = images.find((img) => img.id === selectedImageId) ?? null;
    const annotationIds = new Set((selectedImage?.annotations ?? []).map((ann) => ann.id));
    const selectedAnnotationIds = Array.from(
      new Set(snapshot.selectedAnnotationIds.filter((id) => annotationIds.has(id)))
    );
    const selectedAnnotationId =
      snapshot.selectedAnnotationId && annotationIds.has(snapshot.selectedAnnotationId)
        ? snapshot.selectedAnnotationId
        : selectedAnnotationIds[selectedAnnotationIds.length - 1] ?? null;
    const restoredSelectedClassId =
      snapshot.selectedClassId && classIds.has(snapshot.selectedClassId) ? snapshot.selectedClassId : defaultClass.id;
    const selectedClassId =
      settings.classAssignmentMode === 'deferred'
        ? getDefaultClassId(classes, defaultClass.id)
        : restoredSelectedClassId;

    const nextDisplayIdByClass: Record<string, number> = {};
    for (const image of images) {
      const computed = image.annotations.reduce((max, ann) => Math.max(max, ann.displayId + 1), 1);
      nextDisplayIdByClass[image.id] = computed;
    }
    for (const [imageId, rawValue] of Object.entries(snapshot.nextDisplayIdByClass ?? {})) {
      if (!imageIds.has(imageId)) continue;
      if (!Number.isFinite(rawValue) || rawValue < 1) continue;
      nextDisplayIdByClass[imageId] = Math.max(nextDisplayIdByClass[imageId] ?? 1, Math.floor(rawValue));
    }

    revokeImageSources(state.images);
    set({
      ...settings,
      classes,
      images: reconcileImageSourcesForSelection(images, selectedImageId),
      selectedClassId,
      selectedImageId,
      selectedAnnotationId,
      selectedAnnotationIds,
      nextDisplayIdByClass,
      liveDraftBBox: null,
      liveDraftClassId: null,
      deferredLastAnnotationId: null,
      deferredLastImageId: null,
      undoStack: [],
      redoStack: [],
      statusText: 'Recovered previous workspace state.',
    });
  },

  // --- Export ---
  exportClassesTxt: async () => {
    const state = get();
    const classNames = state.classes.filter((c) => !c.isDefault).map((c) => c.name);
    const blob = new Blob([classNames.join('\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, 'classes.txt');
  },

  exportAnnotations: async (
    format,
    scope,
    includeFallback = false,
    namingOptions = { mode: 'sequential', baseName: 'image' },
    outputOptions = { convert: false, format: 'png' },
    includeImagesWithoutAnnotations = true,
    imageMetadataOptions = { includeOriginalName: false, sanitizeImageMetadata: false }
  ) => {
    const state = get();
    const scopedImageIds = new Set(getImageIdsByScope(state.images, state.selectedImageId, scope));
    const scopedImages = state.images.filter((img) => scopedImageIds.has(img.id));
    const skippedUnsupportedCount = scopedImages.filter((img) => !isSupportedImageFileName(img.name)).length;
    const normalizedMetadataOptions = normalizeExportImageMetadataOptions(imageMetadataOptions);
    const ctx = resolveExportContext(
      state,
      scope,
      includeFallback,
      namingOptions,
      outputOptions,
      includeImagesWithoutAnnotations,
      normalizedMetadataOptions
    );
    if (!ctx) {
      if (scopedImages.length > 0 && skippedUnsupportedCount === scopedImages.length) {
        set({ statusText: 'No exportable images in selected scope.' });
      } else if (!includeImagesWithoutAnnotations) {
        set({ statusText: 'No images with exportable annotations in selected scope.' });
      }
      return;
    }

    try {
      const imageBlobById = await prepareExportImageBlobs(ctx, normalizedMetadataOptions);
      const zip = new JSZip();
      if (format === 'yolo') writeYoloDataset(zip, ctx, imageBlobById, normalizedMetadataOptions);
      if (format === 'coco') writeCocoDataset(zip, ctx, imageBlobById, normalizedMetadataOptions);
      if (format === 'voc') writeVocDataset(zip, ctx, imageBlobById, normalizedMetadataOptions);
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `dataset_${format}_${Date.now()}.zip`);
      if (skippedUnsupportedCount > 0) {
        set({
          statusText: `Export completed. Skipped ${skippedUnsupportedCount} unsupported image file${skippedUnsupportedCount === 1 ? '' : 's'}.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown conversion error.';
      set({ statusText: `Export failed: ${message}` });
    }
  },

  exportAllAnnotations: async (
    scope,
    folderName,
    includeFallback = false,
    namingOptions = { mode: 'sequential', baseName: 'image' },
    outputOptions = { convert: false, format: 'png' },
    includeImagesWithoutAnnotations = true,
    imageMetadataOptions = { includeOriginalName: false, sanitizeImageMetadata: false }
  ) => {
    const state = get();
    const scopedImageIds = new Set(getImageIdsByScope(state.images, state.selectedImageId, scope));
    const scopedImages = state.images.filter((img) => scopedImageIds.has(img.id));
    const skippedUnsupportedCount = scopedImages.filter((img) => !isSupportedImageFileName(img.name)).length;
    const normalizedMetadataOptions = normalizeExportImageMetadataOptions(imageMetadataOptions);
    const ctx = resolveExportContext(
      state,
      scope,
      includeFallback,
      namingOptions,
      outputOptions,
      includeImagesWithoutAnnotations,
      normalizedMetadataOptions
    );
    if (!ctx) {
      if (scopedImages.length > 0 && skippedUnsupportedCount === scopedImages.length) {
        set({ statusText: 'No exportable images in selected scope.' });
      } else if (!includeImagesWithoutAnnotations) {
        set({ statusText: 'No images with exportable annotations in selected scope.' });
      }
      return;
    }

    try {
      const imageBlobById = await prepareExportImageBlobs(ctx, normalizedMetadataOptions);
      const zip = new JSZip();
      const rootName = sanitizeExportFolderName(folderName);
      const root = zip.folder(rootName);
      if (!root) return;

      const yolo = root.folder('yolo');
      const coco = root.folder('coco');
      const voc = root.folder('voc');
      if (!yolo || !coco || !voc) return;

      writeYoloDataset(yolo, ctx, imageBlobById, normalizedMetadataOptions);
      writeCocoDataset(coco, ctx, imageBlobById, normalizedMetadataOptions);
      writeVocDataset(voc, ctx, imageBlobById, normalizedMetadataOptions);

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${rootName}_${Date.now()}.zip`);
      if (skippedUnsupportedCount > 0) {
        set({
          statusText: `Export completed. Skipped ${skippedUnsupportedCount} unsupported image file${skippedUnsupportedCount === 1 ? '' : 's'}.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown conversion error.';
      set({ statusText: `Export failed: ${message}` });
    }
  },

  exportWorkspaceState: async () => {
    // Workspace export captures settings, selections, classes, images and annotations.
    const state = get();
    const zip = new JSZip();
    const imagesFolder = zip.folder('images');
    if (!imagesFolder) return;

    const imageFileNameById: Record<string, string> = {};
    const usedNames = new Set<string>();
    for (const image of state.images) {
      const uniqueName = toUniqueName(image.name, usedNames);
      imageFileNameById[image.id] = uniqueName;
      imagesFolder.file(uniqueName, image.file);
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: toViewStateSnapshot(state),
      selection: {
        selectedClassId: state.selectedClassId,
        selectedImageId: state.selectedImageId,
        selectedAnnotationId: state.selectedAnnotationId,
        selectedAnnotationIds: state.selectedAnnotationIds,
      },
      classes: state.classes.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        isVisible: c.isVisible,
        isDefault: Boolean(c.isDefault),
        hotkey: c.hotkey ?? null,
      })),
      images: state.images.map((img) => ({
        id: img.id,
        name: img.name,
        fileName: imageFileNameById[img.id] ?? img.name,
        isBookmarked: img.isBookmarked,
        sourceKind: img.sourceKind ?? 'image',
        videoMeta: img.videoMeta
          ? {
              videoId: img.videoMeta.videoId,
              videoName: img.videoMeta.videoName,
              sourceFps: img.videoMeta.sourceFps,
              sourceDurationMs: img.videoMeta.sourceDurationMs,
              frameIndex: img.videoMeta.frameIndex,
              timestampMs: img.videoMeta.timestampMs,
            }
          : null,
        width: img.width,
        height: img.height,
        annotations: img.annotations.map((ann) => ({
          id: ann.id,
          classId: ann.classId,
          bbox: { ...ann.bbox },
          isVisible: ann.isVisible,
          isAnchored: ann.isAnchored,
          displayId: ann.displayId,
        })),
      })),
      nextDisplayIdByClass: { ...state.nextDisplayIdByClass },
    };

    zip.file('workspace_state.json', JSON.stringify(payload, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `workspace_state_${Date.now()}.zip`);
  },
}));
