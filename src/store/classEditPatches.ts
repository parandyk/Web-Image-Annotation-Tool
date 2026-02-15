import { ClassData } from '../domain/types';
import { addClassToList, renameClassInList, setClassHotkeyInList } from './classMutations';

type ClassEditState = {
  classes: ClassData[];
  selectedClassId: string;
};

export function buildAddClassPatch(
  state: ClassEditState,
  nextClass: ClassData
): { classes: ClassData[]; selectedClassId: string } {
  return {
    classes: addClassToList(state.classes, nextClass),
    selectedClassId: state.selectedClassId,
  };
}

export function buildRenameClassPatch(
  state: Pick<ClassEditState, 'classes'>,
  classId: string,
  nextName: string
): { classes: ClassData[] } {
  return {
    classes: renameClassInList(state.classes, classId, nextName),
  };
}

export function buildSetClassHotkeyPatch(
  state: Pick<ClassEditState, 'classes'>,
  classId: string,
  nextHotkey: string,
  className: string
): { classes: ClassData[]; statusText: string } {
  return {
    classes: setClassHotkeyInList(state.classes, classId, nextHotkey),
    statusText: `Assigned "${nextHotkey}" to class "${className}".`,
  };
}

export function buildClearClassHotkeyPatch(
  state: Pick<ClassEditState, 'classes'>,
  classId: string,
  className: string
): { classes: ClassData[]; statusText: string } {
  return {
    classes: setClassHotkeyInList(state.classes, classId, undefined),
    statusText: `Cleared hotkey for class "${className}".`,
  };
}
