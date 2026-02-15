import { Annotation, ClassData, ImageItem, ImageScope } from '../domain/types';
import {
  getScopedImageIdSet,
  getValidScopedClassIds,
  hasScopedClassMatch,
} from './scopedClassMutations';

export type ScopedClassMutationContext = {
  sourceIds: string[];
  sourceSet: Set<string>;
  targetImageIdSet: Set<string>;
};

export function resolveScopedClassMutationContext(params: {
  classIds: string[];
  classes: ClassData[];
  images: ImageItem[];
  selectedImageId: string | null;
  scope: ImageScope;
  excludedClassId?: string;
}): ScopedClassMutationContext | null {
  const sourceIds = getValidScopedClassIds(
    params.classIds,
    params.classes,
    params.excludedClassId
  );
  if (sourceIds.length === 0) return null;

  const targetImageIdSet = getScopedImageIdSet(
    params.images,
    params.selectedImageId,
    params.scope
  );
  if (targetImageIdSet.size === 0) return null;

  return {
    sourceIds,
    sourceSet: new Set(sourceIds),
    targetImageIdSet,
  };
}

export function resolveScopedClassAffectedContext(params: {
  classIds: string[];
  classes: ClassData[];
  images: ImageItem[];
  selectedImageId: string | null;
  scope: ImageScope;
  excludedClassId?: string;
  annotationPredicate?: (annotation: Annotation) => boolean;
}): ScopedClassMutationContext | null {
  const context = resolveScopedClassMutationContext(params);
  if (!context) return null;

  const hasAffected = hasScopedClassMatch(
    params.images,
    context.targetImageIdSet,
    context.sourceSet,
    params.annotationPredicate
  );
  if (!hasAffected) return null;

  return context;
}
