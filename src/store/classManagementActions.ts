import { ClassData } from '../domain/types';
import { getClassColor } from '../utils/colors';
import { uid } from '../utils/id';
import { createSnapshotFromState, pushUndoHistory } from './snapshot';
import { validateClassHotkeyInput, validateClassNameInput } from './classValidation';
import {
  findClassById,
  hasClassId,
  hasDistinctClassPair,
  resolveDeleteClassContext,
  resolveDeleteToDefaultClassContext,
  resolveDeletableClass,
  resolveSwapToClassContext,
} from './classLookup';
import {
  buildDeleteClassAndAffectedPatch,
  buildDeleteClassSwapPatch,
  buildRemoveClassInstancesGlobalPatch,
  buildToggleClassInstancesAnchoringGlobalPatch,
  buildToggleClassVisibilityPatch,
} from './classActionPatches';
import {
  buildAddClassPatch,
  buildClearClassHotkeyPatch,
  buildRenameClassPatch,
  buildSetClassHotkeyPatch,
} from './classEditPatches';
import { hasAnyClassInstance, hasAnyUnanchoredClassInstance, remapAnnotationsClass } from './classMutations';
import { resolveScopedClassAffectedContext } from './scopedClassContext';
import {
  buildScopedClassAnchoringPatch,
  buildScopedClassRemoveWithSelectionPatch,
  buildScopedClassSwapPatch,
  buildScopedClassVisibilityWithSelectionPatch,
} from './scopedClassActionPatches';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type ClassManagementActionKeys =
  | 'addClass'
  | 'renameClass'
  | 'setClassHotkey'
  | 'clearClassHotkey'
  | 'toggleClassVisibility'
  | 'deleteClassSwapTo'
  | 'deleteClassAndAffected'
  | 'deleteClassToUnassigned'
  | 'swapClassInstancesGlobal'
  | 'removeClassInstancesGlobal'
  | 'toggleClassInstancesAnchoringGlobal'
  | 'swapClassInstances'
  | 'removeClassInstances'
  | 'setClassInstancesAnchoring'
  | 'setClassInstancesVisibility';

export function createClassManagementActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, ClassManagementActionKeys> {
  return {
    addClass: (name) => {
      const state = get();
      const validated = validateClassNameInput(name, state.classes);
      if (!validated.ok) {
        set({ statusText: validated.statusText });
        return;
      }
      const sanitized = validated.value;

      const base = createSnapshotFromState(state);

      const newClass: ClassData = {
        id: uid('class'),
        name: sanitized,
        color: getClassColor(state.classes.length),
        isVisible: true,
        defaultAnchored: false,
        hotkey: undefined,
      };

      set((s) => ({
        ...buildAddClassPatch(s, newClass),
        ...pushUndoHistory(s, base),
      }));
    },

    renameClass: (classId, newName) => {
      const state = get();
      if (!resolveDeletableClass(state.classes, classId)) return;

      const validated = validateClassNameInput(newName, state.classes, { excludeClassId: classId });
      if (!validated.ok) {
        set({ statusText: validated.statusText });
        return;
      }
      const sanitized = validated.value;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildRenameClassPatch(s, classId, sanitized),
        ...pushUndoHistory(s, base),
      }));
    },

    setClassHotkey: (classId, hotkey) => {
      const state = get();
      const cls = findClassById(state.classes, classId);
      if (!cls) return;

      const validated = validateClassHotkeyInput(hotkey, state.classes, classId);
      if (!validated.ok) {
        set({ statusText: validated.statusText });
        return;
      }
      const normalized = validated.value;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildSetClassHotkeyPatch(s, classId, normalized, cls.name),
        ...pushUndoHistory(s, base),
      }));
    },

    clearClassHotkey: (classId) => {
      const state = get();
      const cls = findClassById(state.classes, classId);
      if (!cls || !cls.hotkey) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildClearClassHotkeyPatch(s, classId, cls.name),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleClassVisibility: (classId) => {
      const state = get();
      const cls = findClassById(state.classes, classId);
      if (!cls) return;

      const base = createSnapshotFromState(state);
      const nextVisible = !cls.isVisible;

      set((s) => ({
        ...buildToggleClassVisibilityPatch(s, classId, nextVisible),
        ...pushUndoHistory(s, base),
      }));
    },

    deleteClassSwapTo: (classId, substituteClassId) => {
      const state = get();
      const context = resolveSwapToClassContext(state.classes, classId, substituteClassId);
      if (!context) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildDeleteClassSwapPatch(
          s,
          context.classId,
          context.substituteClassId
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    deleteClassAndAffected: (classId) => {
      const state = get();
      const context = resolveDeleteClassContext(state.classes, classId);
      if (!context) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildDeleteClassAndAffectedPatch(s, context.classId),
        ...pushUndoHistory(s, base),
      }));
    },

    deleteClassToUnassigned: (classId) => {
      const state = get();
      const context = resolveDeleteToDefaultClassContext(state.classes, classId);
      if (!context) return;
      get().deleteClassSwapTo(context.classId, context.defaultClassId);
    },

    swapClassInstancesGlobal: (classId, substituteClassId) => {
      const state = get();
      if (!hasDistinctClassPair(state.classes, classId, substituteClassId)) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        images: remapAnnotationsClass(s.images, classId, substituteClassId),
        ...pushUndoHistory(s, base),
      }));
    },

    removeClassInstancesGlobal: (classId) => {
      const state = get();
      if (!hasClassId(state.classes, classId)) return;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildRemoveClassInstancesGlobalPatch(s, classId),
        ...pushUndoHistory(s, base),
      }));
    },

    toggleClassInstancesAnchoringGlobal: (classId) => {
      const state = get();
      const cls = findClassById(state.classes, classId);
      if (!cls) return;

      const shouldAnchor = hasAnyClassInstance(state.images, classId)
        ? hasAnyUnanchoredClassInstance(state.images, classId)
        : !Boolean(cls.defaultAnchored);

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildToggleClassInstancesAnchoringGlobalPatch(
          s,
          classId,
          shouldAnchor
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    swapClassInstances: (classIds, substituteClassId, scope) => {
      const state = get();
      if (!hasClassId(state.classes, substituteClassId)) return;

      const context = resolveScopedClassAffectedContext({
        classIds,
        classes: state.classes,
        images: state.images,
        selectedImageId: state.selectedImageId,
        scope,
        excludedClassId: substituteClassId,
      });
      if (!context) return;
      const { sourceSet, targetImageIdSet } = context;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildScopedClassSwapPatch(
          s,
          targetImageIdSet,
          sourceSet,
          substituteClassId
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    removeClassInstances: (classIds, scope) => {
      const state = get();
      const context = resolveScopedClassAffectedContext({
        classIds,
        classes: state.classes,
        images: state.images,
        selectedImageId: state.selectedImageId,
        scope,
      });
      if (!context) return;
      const { sourceSet, targetImageIdSet } = context;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildScopedClassRemoveWithSelectionPatch(
          s,
          targetImageIdSet,
          sourceSet
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    setClassInstancesAnchoring: (classIds, anchored, scope) => {
      const state = get();
      const context = resolveScopedClassAffectedContext({
        classIds,
        classes: state.classes,
        images: state.images,
        selectedImageId: state.selectedImageId,
        scope,
        annotationPredicate: (ann) => ann.isAnchored !== anchored,
      });
      if (!context) return;
      const { sourceSet, targetImageIdSet } = context;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildScopedClassAnchoringPatch(
          s,
          targetImageIdSet,
          sourceSet,
          anchored
        ),
        ...pushUndoHistory(s, base),
      }));
    },

    setClassInstancesVisibility: (classIds, visible, scope) => {
      const state = get();
      const context = resolveScopedClassAffectedContext({
        classIds,
        classes: state.classes,
        images: state.images,
        selectedImageId: state.selectedImageId,
        scope,
        annotationPredicate: (ann) => ann.isVisible !== visible,
      });
      if (!context) return;
      const { sourceSet, targetImageIdSet } = context;

      const base = createSnapshotFromState(state);

      set((s) => ({
        ...buildScopedClassVisibilityWithSelectionPatch(
          s,
          targetImageIdSet,
          sourceSet,
          visible
        ),
        ...pushUndoHistory(s, base),
      }));
    },
  };
}
