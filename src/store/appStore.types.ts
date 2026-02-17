import {
  AnnotationAddingMode,
  AnnotationClassAssignmentMode,
  AnnotationFilterMode,
  AnnotationSortMode,
  BBox,
  ClassData,
  ClassFilterMode,
  ClassSortMode,
  ExportAnnotationFormat,
  InferenceDetection,
  ImageClassFilterMode,
  ImageFilterMode,
  ImageItem,
  ImageScope,
  ImageSortMode,
  InteractionMode,
  MinimapLocation,
} from '../domain/types';
import { VideoParseOptions } from '../utils/video';
import { WorkspaceRecoverySnapshot } from '../utils/workspaceRecovery';
import { ExportImageMetadataOptions, ExportImageNamingOptions, ExportImageOutputOptions } from './exportDataset';
import { Snapshot } from './snapshot';
import { ViewState } from './viewState';

type ClassInstanceScope = ImageScope;

export type AppState = ViewState & {
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
  pendingDetectionsByImageId: Record<string, InferenceDetection[]>;
  selectedPendingDetectionIds: string[];
  inferenceBusy: boolean;

  initializeDefaults: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setAddingMode: (mode: AnnotationAddingMode) => void;
  setClassAssignmentMode: (mode: AnnotationClassAssignmentMode) => void;
  setFastClassSwapMode: (v: boolean) => void;
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
  setInferenceEnabled: (v: boolean) => void;
  setInferenceConfidenceThreshold: (v: number) => void;
  setInferenceModelUrl: (v: string) => void;
  setSuppressUnassignedExportWarningDialog: (v: boolean) => void;
  setSuppressDeleteAnnotationWarningDialog: (v: boolean) => void;
  setSuppressDeleteImageWarningDialog: (v: boolean) => void;
  setSuppressRemoveClassInstancesWarningDialog: (v: boolean) => void;
  setExportIncludeUnassigned: (v: boolean) => void;
  setStatusText: (v: string | null) => void;
  setLiveDraftBBox: (bbox: BBox | null) => void;
  setLiveDraftClassId: (classId: string | null) => void;
  setSelectedPendingDetectionIds: (detectionIds: string[]) => void;

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
  runInferenceCurrentImage: () => Promise<void>;
  acceptDetection: (detectionId: string) => void;
  rejectDetection: (detectionId: string) => void;
  rejectDetections: (detectionIds: string[]) => void;
  acceptAllDetectionsCurrentImage: () => void;
  clearDetectionsCurrentImage: () => void;

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
