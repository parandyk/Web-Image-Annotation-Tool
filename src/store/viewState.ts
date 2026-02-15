import {
  AnnotationAddingMode,
  AnnotationClassAssignmentMode,
  AnnotationFilterMode,
  AnnotationSortMode,
  ClassFilterMode,
  ClassSortMode,
  ImageClassFilterMode,
  ImageFilterMode,
  ImageSortMode,
  InteractionMode,
  MinimapLocation,
} from '../domain/types';
import { WorkspaceRecoveryViewState } from '../utils/workspaceRecovery';

export type ViewState = {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getDefaultViewState(): ViewState {
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

export function toViewStateSnapshot(state: ViewState): ViewState {
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

export function sanitizeViewStateSnapshot(raw: Partial<WorkspaceRecoveryViewState> | null | undefined): ViewState {
  const defaults = getDefaultViewState();
  const pickEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
  const pickBool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
  const pickNum = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
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
