import { Annotation, BBox, ImageItem } from '../domain/types';

export function mapSelectedImageAnnotations(
  images: ImageItem[],
  selectedImageId: string | null,
  mapper: (annotation: Annotation) => Annotation
): ImageItem[] {
  return images.map((img) =>
    img.id !== selectedImageId
      ? img
      : {
          ...img,
          annotations: img.annotations.map((annotation) => mapper(annotation)),
        }
  );
}

export function filterSelectedImageAnnotations(
  images: ImageItem[],
  selectedImageId: string | null,
  predicate: (annotation: Annotation) => boolean
): ImageItem[] {
  return images.map((img) =>
    img.id !== selectedImageId
      ? img
      : {
          ...img,
          annotations: img.annotations.filter((annotation) => predicate(annotation)),
        }
  );
}

export function appendSelectedImageAnnotation(
  images: ImageItem[],
  selectedImageId: string | null,
  annotation: Annotation
): ImageItem[] {
  return images.map((img) =>
    img.id !== selectedImageId
      ? img
      : {
          ...img,
          annotations: [...img.annotations, annotation],
        }
  );
}

export function getAnnotationIdsPresentInImage(
  image: ImageItem,
  annotationIds: string[]
): Set<string> {
  const existing = new Set(image.annotations.map((annotation) => annotation.id));
  return new Set(annotationIds.filter((id) => existing.has(id)));
}

export type SelectedImageAnnotationTargets = {
  image: ImageItem;
  targetIds: Set<string>;
};

export type SelectedImageAnnotationToggle = {
  image: ImageItem;
  targetIds: Set<string>;
  nextValue: boolean;
};

export type SelectedImageAnnotationRef = {
  image: ImageItem;
  annotation: Annotation;
};

export type NudgableSelectedAnnotation = {
  image: ImageItem;
  annotation: Annotation;
  annotationId: string;
};

export function resolveSelectedImageAnnotationTargets(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationIds: string[]
): SelectedImageAnnotationTargets | null {
  if (!selectedImageId || annotationIds.length === 0) return null;
  const image = images.find((img) => img.id === selectedImageId);
  if (!image) return null;
  const targetIds = getAnnotationIdsPresentInImage(image, annotationIds);
  if (targetIds.size === 0) return null;
  return {
    image,
    targetIds,
  };
}

export function resolveSelectedImageAnnotationFlagToggle(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationIds: string[],
  flag: SelectedImageAnnotationFlag
): SelectedImageAnnotationToggle | null {
  const targets = resolveSelectedImageAnnotationTargets(
    images,
    selectedImageId,
    annotationIds
  );
  if (!targets) return null;

  const nextValue = targets.image.annotations
    .filter((annotation) => targets.targetIds.has(annotation.id))
    .some((annotation) => !annotation[flag]);

  return {
    image: targets.image,
    targetIds: targets.targetIds,
    nextValue,
  };
}

export function resolveSelectedImageAnnotation(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationId: string
): SelectedImageAnnotationRef | null {
  const image = selectedImageId
    ? images.find((img) => img.id === selectedImageId)
    : null;
  if (!image) return null;
  const annotation = image.annotations.find((item) => item.id === annotationId);
  if (!annotation) return null;
  return {
    image,
    annotation,
  };
}

export function resolveEditableSelectedImageAnnotation(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationId: string
): SelectedImageAnnotationRef | null {
  const resolved = resolveSelectedImageAnnotation(
    images,
    selectedImageId,
    annotationId
  );
  if (!resolved || resolved.annotation.isAnchored) return null;
  return resolved;
}

export function resolveLastSelectedImageAnnotationId(
  images: ImageItem[],
  selectedImageId: string | null
): string | null {
  if (!selectedImageId) return null;
  const image = images.find((img) => img.id === selectedImageId);
  if (!image || image.annotations.length === 0) return null;
  return image.annotations[image.annotations.length - 1].id;
}

export function resolveNudgableSelectedAnnotation(
  images: ImageItem[],
  selectedImageId: string | null,
  selectedAnnotationId: string | null,
  selectedAnnotationIds: string[]
): NudgableSelectedAnnotation | null {
  if (!selectedAnnotationId) return null;
  if (selectedAnnotationIds.length > 1) return null;
  if (
    selectedAnnotationIds.length === 1 &&
    selectedAnnotationIds[0] !== selectedAnnotationId
  ) {
    return null;
  }

  const image = selectedImageId
    ? images.find((img) => img.id === selectedImageId)
    : null;
  if (!image) return null;
  const annotation = image.annotations.find((item) => item.id === selectedAnnotationId);
  if (!annotation || annotation.isAnchored) return null;

  return {
    image,
    annotation,
    annotationId: selectedAnnotationId,
  };
}

export type SelectedImageAnnotationFlag = 'isVisible' | 'isAnchored';

export function hasAnnotationInSelectedImage(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationId: string
): boolean {
  return resolveSelectedImageAnnotation(images, selectedImageId, annotationId) !== null;
}

export function mapSelectedImageAnnotationById(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationId: string,
  mapper: (annotation: Annotation) => Annotation
): ImageItem[] {
  return mapSelectedImageAnnotations(images, selectedImageId, (annotation) =>
    annotation.id === annotationId ? mapper(annotation) : annotation
  );
}

type SingleSelectedAnnotationPatchState = {
  images: ImageItem[];
  selectedImageId: string | null;
};

export function buildUpdateSelectedAnnotationBBoxPatch(
  state: SingleSelectedAnnotationPatchState,
  annotationId: string,
  bbox: BBox
): { images: ImageItem[] } {
  return {
    images: mapSelectedImageAnnotationById(
      state.images,
      state.selectedImageId,
      annotationId,
      (annotation) => ({ ...annotation, bbox })
    ),
  };
}

export function buildSetSelectedAnnotationClassPatch(
  state: SingleSelectedAnnotationPatchState,
  annotationId: string,
  classId: string
): { images: ImageItem[] } {
  return {
    images: mapSelectedImageAnnotationById(
      state.images,
      state.selectedImageId,
      annotationId,
      (annotation) => ({ ...annotation, classId })
    ),
  };
}

export function buildNudgeSelectedAnnotationPatch(
  state: SingleSelectedAnnotationPatchState,
  annotationId: string,
  x: number,
  y: number
): { images: ImageItem[] } {
  return {
    images: mapSelectedImageAnnotationById(
      state.images,
      state.selectedImageId,
      annotationId,
      (annotation) => ({
        ...annotation,
        bbox: {
          ...annotation.bbox,
          x,
          y,
        },
      })
    ),
  };
}

export function toggleSelectedImageAnnotationFlag(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationId: string,
  flag: SelectedImageAnnotationFlag
): ImageItem[] {
  return mapSelectedImageAnnotations(images, selectedImageId, (annotation) =>
    annotation.id === annotationId
      ? { ...annotation, [flag]: !annotation[flag] }
      : annotation
  );
}

export function setSelectedImageAnnotationFlags(
  images: ImageItem[],
  selectedImageId: string | null,
  annotationIds: Set<string>,
  flag: SelectedImageAnnotationFlag,
  value: boolean
): ImageItem[] {
  return mapSelectedImageAnnotations(images, selectedImageId, (annotation) =>
    annotationIds.has(annotation.id)
      ? { ...annotation, [flag]: value }
      : annotation
  );
}
