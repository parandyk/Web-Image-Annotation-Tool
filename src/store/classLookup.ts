import { ClassData } from '../domain/types';

export function findClassById(
  classes: ClassData[],
  classId: string
): ClassData | null {
  return classes.find((cls) => cls.id === classId) ?? null;
}

export function hasClassId(classes: ClassData[], classId: string): boolean {
  return classes.some((cls) => cls.id === classId);
}

export function findDefaultClassId(classes: ClassData[]): string | null {
  return classes.find((cls) => cls.isDefault)?.id ?? null;
}

export function resolveDeletableClass(
  classes: ClassData[],
  classId: string
): ClassData | null {
  const cls = findClassById(classes, classId);
  if (!cls || cls.isDefault) return null;
  return cls;
}

export function hasDistinctClassPair(
  classes: ClassData[],
  classId: string,
  substituteClassId: string
): boolean {
  if (classId === substituteClassId) return false;
  return hasClassId(classes, classId) && hasClassId(classes, substituteClassId);
}

export function resolveSwapToClassContext(
  classes: ClassData[],
  classId: string,
  substituteClassId: string
): { classId: string; substituteClassId: string } | null {
  if (!hasDistinctClassPair(classes, classId, substituteClassId)) return null;
  if (!resolveDeletableClass(classes, classId)) return null;
  return { classId, substituteClassId };
}

export function resolveDeleteClassContext(
  classes: ClassData[],
  classId: string
): { classId: string } | null {
  if (!resolveDeletableClass(classes, classId)) return null;
  return { classId };
}

export function resolveDeleteToDefaultClassContext(
  classes: ClassData[],
  classId: string
): { classId: string; defaultClassId: string } | null {
  if (!resolveDeletableClass(classes, classId)) return null;
  const defaultClassId = findDefaultClassId(classes);
  if (!defaultClassId) return null;
  if (defaultClassId === classId) return null;
  return {
    classId,
    defaultClassId,
  };
}
