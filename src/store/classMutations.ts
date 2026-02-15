import { ClassData, ImageItem } from '../domain/types';

export function addClassToList(
  classes: ClassData[],
  nextClass: ClassData
): ClassData[] {
  return [...classes, nextClass];
}

export function renameClassInList(
  classes: ClassData[],
  classId: string,
  nextName: string
): ClassData[] {
  return classes.map((cls) => (cls.id === classId ? { ...cls, name: nextName } : cls));
}

export function setClassHotkeyInList(
  classes: ClassData[],
  classId: string,
  nextHotkey: string | undefined
): ClassData[] {
  return classes.map((cls) => (cls.id === classId ? { ...cls, hotkey: nextHotkey } : cls));
}

export function setClassVisibilityInList(
  classes: ClassData[],
  classId: string,
  isVisible: boolean
): ClassData[] {
  return classes.map((cls) => (cls.id === classId ? { ...cls, isVisible } : cls));
}

export function removeClassFromList(
  classes: ClassData[],
  classId: string
): ClassData[] {
  return classes.filter((cls) => cls.id !== classId);
}

export function remapAnnotationsClass(
  images: ImageItem[],
  sourceClassId: string,
  targetClassId: string
): ImageItem[] {
  return images.map((img) => ({
    ...img,
    annotations: img.annotations.map((annotation) =>
      annotation.classId === sourceClassId
        ? { ...annotation, classId: targetClassId }
        : annotation
    ),
  }));
}

export function removeAnnotationsByClass(
  images: ImageItem[],
  classId: string
): ImageItem[] {
  return images.map((img) => ({
    ...img,
    annotations: img.annotations.filter((annotation) => annotation.classId !== classId),
  }));
}

export function setAnchoringForClassInstances(
  images: ImageItem[],
  classId: string,
  anchored: boolean
): ImageItem[] {
  return images.map((img) => ({
    ...img,
    annotations: img.annotations.map((annotation) =>
      annotation.classId === classId
        ? { ...annotation, isAnchored: anchored }
        : annotation
    ),
  }));
}

export function hasAnyClassInstance(
  images: ImageItem[],
  classId: string
): boolean {
  return images.some((img) => img.annotations.some((annotation) => annotation.classId === classId));
}

export function hasAnyUnanchoredClassInstance(
  images: ImageItem[],
  classId: string
): boolean {
  return images.some(
    (img) => img.annotations.some((annotation) => annotation.classId === classId && !annotation.isAnchored)
  );
}

export function filterSelectionByClassVisibility(
  selectedImage: ImageItem | null,
  selectedAnnotationIds: string[],
  selectedAnnotationId: string | null,
  hiddenClassId: string
): { selectedAnnotationIds: string[]; selectedAnnotationId: string | null } {
  const byId = new Map((selectedImage?.annotations ?? []).map((annotation) => [annotation.id, annotation]));
  const nextSelectedAnnotationIds = selectedAnnotationIds.filter(
    (id) => byId.get(id)?.classId !== hiddenClassId
  );
  const nextSelectedAnnotationId = (() => {
    if (nextSelectedAnnotationIds.length > 0) return nextSelectedAnnotationIds[nextSelectedAnnotationIds.length - 1];
    return selectedAnnotationId && byId.get(selectedAnnotationId)?.classId === hiddenClassId
      ? null
      : selectedAnnotationId;
  })();

  return {
    selectedAnnotationIds: nextSelectedAnnotationIds,
    selectedAnnotationId: nextSelectedAnnotationId,
  };
}
