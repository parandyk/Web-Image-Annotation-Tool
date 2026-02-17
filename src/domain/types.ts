export type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClassData = {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  defaultAnchored?: boolean;
  isDefault?: boolean;
  hotkey?: string;
};

export type Annotation = {
  id: string;
  classId: string;
  bbox: BBox;
  isVisible: boolean;
  isAnchored: boolean;
  displayId: number;
};

export type InferenceDetection = {
  id: string;
  classId: string;
  classIndex: number;
  score: number;
  bbox: BBox;
};

export type ImageSourceKind = 'image' | 'videoFrame';

export type VideoFrameMeta = {
  videoId: string;
  videoName: string;
  sourceFps: number;
  sourceDurationMs: number;
  frameIndex: number;
  timestampMs: number;
};

export type ImageItem = {
  id: string;
  name: string;
  file: File;
  src: string;
  width: number;
  height: number;
  isBookmarked: boolean;
  annotations: Annotation[];
  sourceKind?: ImageSourceKind;
  videoMeta?: VideoFrameMeta;
};

export type AnnotationAddingMode = 'click' | 'drag';
export type AnnotationClassAssignmentMode = 'activeClass' | 'deferred';
export type InteractionMode = 'add' | 'edit';
export type MinimapLocation = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'sidebar';

export type AnnotationFilterMode = 'none' | 'hideAssigned' | 'hideUnassigned';
export type AnnotationSortMode =
  | 'none'
  | 'oldest'
  | 'newest'
  | 'alphabetical'
  | 'reversedAlphabetical'
  | 'largestFirst'
  | 'smallestFirst';

export type ImageFilterMode =
  | 'none'
  | 'hideAnnotated'
  | 'hideUnannotated'
  | 'hideBookmarked'
  | 'hideUnbookmarked';
export type ImageClassFilterMode = 'none' | 'hasAny' | 'hasAll' | 'hasNone';
export type ImageSortMode =
  | 'none'
  | 'alphabetical'
  | 'reversedAlphabetical'
  | 'largestFirst'
  | 'smallestFirst'
  | 'mostAnnotations'
  | 'fewestAnnotations';

export type ClassFilterMode = 'none' | 'hideUsed' | 'hideUnused';
export type ClassSortMode =
  | 'none'
  | 'alphabetical'
  | 'reversedAlphabetical'
  | 'countAscending'
  | 'countDescending';

export type ExportAnnotationFormat = 'yolo' | 'coco' | 'voc';
export type ImageScope = 'currentImage' | 'bookmarkedImages' | 'allImages';
