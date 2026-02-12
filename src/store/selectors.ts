import { useMemo } from 'react';
import {
  Annotation,
  ClassData,
  ImageItem,
} from '../domain/types';
import { useAppStore } from './appStore';

export function useSelectedImage(): ImageItem | null {
  const images = useAppStore((s) => s.images);
  const selectedImageId = useAppStore((s) => s.selectedImageId);

  return useMemo(
    () => images.find((i) => i.id === selectedImageId) ?? null,
    [images, selectedImageId]
  );
}

export function useSortedFilteredImages(): ImageItem[] {
  const images = useAppStore((s) => s.images);
  const imageFilter = useAppStore((s) => s.imageFilter);
  const imageSort = useAppStore((s) => s.imageSort);

  return useMemo(() => {
    let list = [...images];

    if (imageFilter === 'hideAnnotated') {
      list = list.filter((i) => i.annotations.length === 0);
    }

    if (imageFilter === 'hideUnannotated') {
      list = list.filter((i) => i.annotations.length > 0);
    }

    switch (imageSort) {
      case 'alphabetical':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'reversedAlphabetical':
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'largestFirst':
        list.sort((a, b) => b.width * b.height - a.width * a.height);
        break;
      case 'smallestFirst':
        list.sort((a, b) => a.width * a.height - b.width * b.height);
        break;
      case 'mostAnnotations':
        list.sort((a, b) => b.annotations.length - a.annotations.length);
        break;
      case 'fewestAnnotations':
        list.sort((a, b) => a.annotations.length - b.annotations.length);
        break;
      default:
        break;
    }

    return list;
  }, [images, imageFilter, imageSort]);
}

export function useSortedFilteredAnnotations(image: ImageItem | null): Annotation[] {
  const classes = useAppStore((s) => s.classes);
  const annotationFilter = useAppStore((s) => s.annotationFilter);
  const annotationSort = useAppStore((s) => s.annotationSort);

  return useMemo(() => {
    if (!image) return [];

    const defaultClass = classes.find((c) => c.isDefault);
    let list = [...image.annotations];

    if (annotationFilter === 'hideAssigned' && defaultClass) {
      list = list.filter((a) => a.classId === defaultClass.id);
    }

    if (annotationFilter === 'hideUnassigned' && defaultClass) {
      list = list.filter((a) => a.classId !== defaultClass.id);
    }

    const classById = new Map(classes.map((c) => [c.id, c]));

    switch (annotationSort) {
      case 'oldest':
        list.sort((a, b) => a.displayId - b.displayId);
        break;
      case 'newest':
        list.sort((a, b) => b.displayId - a.displayId);
        break;
      case 'alphabetical':
        list.sort((a, b) => (classById.get(a.classId)?.name ?? '').localeCompare(classById.get(b.classId)?.name ?? ''));
        break;
      case 'reversedAlphabetical':
        list.sort((a, b) => (classById.get(b.classId)?.name ?? '').localeCompare(classById.get(a.classId)?.name ?? ''));
        break;
      case 'largestFirst':
        list.sort((a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height);
        break;
      case 'smallestFirst':
        list.sort((a, b) => a.bbox.width * a.bbox.height - b.bbox.width * b.bbox.height);
        break;
      default:
        break;
    }

    return list;
  }, [classes, annotationFilter, annotationSort, image]);
}

export function useSortedFilteredClasses(): ClassData[] {
  const classes = useAppStore((s) => s.classes);
  const images = useAppStore((s) => s.images);
  const classFilter = useAppStore((s) => s.classFilter);
  const classSort = useAppStore((s) => s.classSort);

  return useMemo(() => {
    const countMap = new Map<string, number>();

    for (const c of classes) {
      countMap.set(c.id, 0);
    }

    for (const image of images) {
      for (const ann of image.annotations) {
        countMap.set(ann.classId, (countMap.get(ann.classId) ?? 0) + 1);
      }
    }

    let list = [...classes];

    if (classFilter === 'hideUsed') {
      list = list.filter((c) => (countMap.get(c.id) ?? 0) === 0);
    }

    if (classFilter === 'hideUnused') {
      list = list.filter((c) => (countMap.get(c.id) ?? 0) > 0);
    }

    switch (classSort) {
      case 'alphabetical':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'reversedAlphabetical':
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'countAscending':
        list.sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0));
        break;
      case 'countDescending':
        list.sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0));
        break;
      default:
        break;
    }

    return list;
  }, [classes, images, classFilter, classSort]);
}

export function useClassCountMap(): Map<string, number> {
  const classes = useAppStore((s) => s.classes);
  const images = useAppStore((s) => s.images);

  return useMemo(() => {
    const m = new Map<string, number>();
    for (const c of classes) m.set(c.id, 0);

    for (const image of images) {
      for (const ann of image.annotations) {
        m.set(ann.classId, (m.get(ann.classId) ?? 0) + 1);
      }
    }

    return m;
  }, [classes, images]);
}
