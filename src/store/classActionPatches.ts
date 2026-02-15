import { ClassData, ImageItem } from '../domain/types';
import { findSelectedImage } from './annotationScopeHelpers';
import { buildSingleAnnotationSelection } from './annotationSelection';
import {
  filterSelectionByClassVisibility,
  removeAnnotationsByClass,
  removeClassFromList,
  remapAnnotationsClass,
  setAnchoringForClassInstances,
  setClassVisibilityInList,
} from './classMutations';

type ClassSelectionState = {
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
};

type ToggleClassVisibilityPatchState = {
  classes: ClassData[];
  images: ImageItem[];
  selectedImageId: string | null;
} & ClassSelectionState;

export function buildToggleClassVisibilityPatch(
  state: ToggleClassVisibilityPatchState,
  classId: string,
  nextVisible: boolean
): {
  classes: ClassData[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  const selectedImage = findSelectedImage(state.images, state.selectedImageId);
  const selection = !nextVisible
    ? filterSelectionByClassVisibility(
        selectedImage,
        state.selectedAnnotationIds,
        state.selectedAnnotationId,
        classId
      )
    : null;

  return {
    classes: setClassVisibilityInList(state.classes, classId, nextVisible),
    selectedAnnotationIds: selection
      ? selection.selectedAnnotationIds
      : state.selectedAnnotationIds,
    selectedAnnotationId: selection
      ? selection.selectedAnnotationId
      : state.selectedAnnotationId,
  };
}

type DeleteClassSwapPatchState = {
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
};

export function buildDeleteClassSwapPatch(
  state: DeleteClassSwapPatchState,
  classId: string,
  substituteClassId: string
): {
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
} {
  return {
    classes: removeClassFromList(state.classes, classId),
    images: remapAnnotationsClass(state.images, classId, substituteClassId),
    selectedClassId:
      state.selectedClassId === classId
        ? (state.classes.find((cls) => cls.isDefault)?.id ?? substituteClassId)
        : state.selectedClassId,
  };
}

type DeleteClassAndAffectedPatchState = DeleteClassSwapPatchState & ClassSelectionState;

export function buildDeleteClassAndAffectedPatch(
  state: DeleteClassAndAffectedPatchState,
  classId: string
): {
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  return {
    classes: removeClassFromList(state.classes, classId),
    images: removeAnnotationsByClass(state.images, classId),
    selectedClassId:
      state.classes.find((cls) => cls.isDefault)?.id ?? state.selectedClassId,
    ...buildSingleAnnotationSelection(null),
  };
}

type RemoveClassInstancesGlobalPatchState = {
  images: ImageItem[];
} & ClassSelectionState;

export function buildRemoveClassInstancesGlobalPatch(
  state: RemoveClassInstancesGlobalPatchState,
  classId: string
): {
  images: ImageItem[];
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
} {
  return {
    images: removeAnnotationsByClass(state.images, classId),
    ...buildSingleAnnotationSelection(null),
  };
}

type ToggleClassInstancesAnchoringGlobalPatchState = {
  images: ImageItem[];
};

export function buildToggleClassInstancesAnchoringGlobalPatch(
  state: ToggleClassInstancesAnchoringGlobalPatchState,
  classId: string,
  anchored: boolean
): {
  images: ImageItem[];
} {
  return {
    images: setAnchoringForClassInstances(state.images, classId, anchored),
  };
}
