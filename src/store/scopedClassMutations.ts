import { Annotation, ClassData, ImageItem, ImageScope } from '../domain/types';
import { getImageIdsByScope } from './classImageHelpers';

type AnnotationPredicate = (annotation: Annotation) => boolean;
type AnnotationMapper = (annotation: Annotation) => Annotation;

export function getValidScopedClassIds(
  classIds: string[],
  classes: ClassData[],
  excludedClassId?: string
): string[] {
  const classIdSet = new Set(classes.map((c) => c.id));
  const unique = [...new Set(classIds)];
  return unique.filter((classId) => classId !== excludedClassId && classIdSet.has(classId));
}

export function getScopedImageIdSet(
  images: ImageItem[],
  selectedImageId: string | null,
  scope: ImageScope
): Set<string> {
  return new Set(getImageIdsByScope(images, selectedImageId, scope));
}

export function hasScopedClassMatch(
  images: ImageItem[],
  scopedImageIdSet: Set<string>,
  classIdSet: Set<string>,
  predicate?: AnnotationPredicate
): boolean {
  return images.some(
    (img) =>
      scopedImageIdSet.has(img.id) &&
      img.annotations.some((ann) => classIdSet.has(ann.classId) && (predicate ? predicate(ann) : true))
  );
}

export function mapScopedClassAnnotations(
  images: ImageItem[],
  scopedImageIdSet: Set<string>,
  classIdSet: Set<string>,
  mapper: AnnotationMapper
): ImageItem[] {
  return images.map((img) =>
    !scopedImageIdSet.has(img.id)
      ? img
      : {
          ...img,
          annotations: img.annotations.map((ann) =>
            classIdSet.has(ann.classId) ? mapper(ann) : ann
          ),
        }
  );
}

export function filterScopedClassAnnotations(
  images: ImageItem[],
  scopedImageIdSet: Set<string>,
  classIdSet: Set<string>
): ImageItem[] {
  return images.map((img) =>
    !scopedImageIdSet.has(img.id)
      ? img
      : {
          ...img,
          annotations: img.annotations.filter((ann) => !classIdSet.has(ann.classId)),
        }
  );
}

export function reconcileSelectedAnnotations(
  images: ImageItem[],
  selectedImageId: string | null,
  selectedAnnotationIds: string[],
  selectedAnnotationId: string | null,
  opts: { visibleOnly?: boolean; fallback?: 'first' | 'last' } = {}
): { selectedAnnotationIds: string[]; selectedAnnotationId: string | null } {
  const selectedImage = images.find((img) => img.id === selectedImageId);
  const selectedMap = new Map((selectedImage?.annotations ?? []).map((ann) => [ann.id, ann]));
  const visibleOnly = opts.visibleOnly ?? false;
  const fallback = opts.fallback ?? 'last';

  const filteredIds = selectedAnnotationIds.filter((id) => {
    const ann = selectedMap.get(id);
    if (!ann) return false;
    return visibleOnly ? ann.isVisible : true;
  });

  const keepCurrent =
    selectedAnnotationId !== null &&
    (() => {
      const ann = selectedMap.get(selectedAnnotationId);
      if (!ann) return false;
      return visibleOnly ? ann.isVisible : true;
    })();

  const nextSelectedAnnotationId = keepCurrent
    ? selectedAnnotationId
    : filteredIds.length === 0
      ? null
      : fallback === 'first'
        ? filteredIds[0]
        : filteredIds[filteredIds.length - 1];

  return {
    selectedAnnotationIds: filteredIds,
    selectedAnnotationId: nextSelectedAnnotationId,
  };
}

