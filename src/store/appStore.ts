import { create } from 'zustand';
import { ClassData } from '../domain/types';
import { uid } from '../utils/id';
import {
  getDefaultClassId,
} from './classImageHelpers';
import {
  createFallbackClass,
} from './workspaceDataHelpers';
import { AppState } from './appStore.types';
import {
  getDefaultViewState,
} from './viewState';
import { createClassManagementActions } from './classManagementActions';
import { createAnnotationManagementActions } from './annotationManagementActions';
import { createAnnotationDeletionActions } from './annotationDeletionActions';
import { createAnnotationScopeActions } from './annotationScopeActions';
import { createNavigationActions } from './navigationActions';
import { createWorkspaceLifecycleActions } from './workspaceLifecycleActions';
import { createHistoryRecoveryActions } from './historyRecoveryActions';
import { createExportActions } from './exportActions';
import { createImportOpenActions } from './importOpenActions';
import { createSelectionActions } from './selectionActions';

const FALLBACK_CLASS_NAME = 'Unassigned';

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
    const fallback: ClassData = { ...createFallbackClass(fallbackId, FALLBACK_CLASS_NAME), hotkey: undefined };

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
  ...createImportOpenActions(set, get, FALLBACK_CLASS_NAME),
  ...createSelectionActions(set, get),

  // --- Class management ---
  ...createClassManagementActions(set, get),

  // --- Annotation management ---
  ...createAnnotationManagementActions(set, get),

  // --- Bulk delete helpers ---
  ...createAnnotationDeletionActions(set, get),

  // --- Whole-image visibility/anchoring toggles ---
  ...createAnnotationScopeActions(set, get),

  // --- Navigation ---
  ...createNavigationActions(set, get),

  // --- Workspace lifecycle ---
  ...createWorkspaceLifecycleActions(set, get),

  // --- Undo/redo ---
  ...createHistoryRecoveryActions(set, get, FALLBACK_CLASS_NAME),

  // --- Export ---
  ...createExportActions(set, get, FALLBACK_CLASS_NAME),
}));
