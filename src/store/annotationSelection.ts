export type AnnotationSelectionState = {
  selectedAnnotationIds: string[];
  selectedAnnotationId: string | null;
};

export function buildSingleAnnotationSelection(
  annotationId: string | null
): AnnotationSelectionState {
  return {
    selectedAnnotationIds: annotationId ? [annotationId] : [],
    selectedAnnotationId: annotationId,
  };
}

export function buildNormalizedAnnotationSelection(
  annotationIds: string[],
  latestId: string | null = null
): AnnotationSelectionState {
  const unique = Array.from(new Set(annotationIds));
  const resolvedLatest =
    latestId && unique.includes(latestId)
      ? latestId
      : unique.length > 0
        ? unique[unique.length - 1]
        : null;

  return {
    selectedAnnotationIds: unique,
    selectedAnnotationId: resolvedLatest,
  };
}

export function toggleAnnotationSelectionState(
  selectedAnnotationIds: string[],
  annotationId: string
): AnnotationSelectionState {
  const exists = selectedAnnotationIds.includes(annotationId);
  if (exists) {
    const next = selectedAnnotationIds.filter((id) => id !== annotationId);
    return {
      selectedAnnotationIds: next,
      selectedAnnotationId: next.length > 0 ? next[next.length - 1] : null,
    };
  }
  return {
    selectedAnnotationIds: [...selectedAnnotationIds, annotationId],
    selectedAnnotationId: annotationId,
  };
}

export function removeAnnotationFromSelectionState(
  selectedAnnotationIds: string[],
  selectedAnnotationId: string | null,
  removedAnnotationId: string
): AnnotationSelectionState {
  const nextSelectedIds = selectedAnnotationIds.filter((id) => id !== removedAnnotationId);
  const nextSelectedId =
    nextSelectedIds.length > 0
      ? nextSelectedIds[nextSelectedIds.length - 1]
      : selectedAnnotationId === removedAnnotationId
        ? null
        : selectedAnnotationId;

  return {
    selectedAnnotationIds: nextSelectedIds,
    selectedAnnotationId: nextSelectedId,
  };
}

export function buildVisibilitySelectionState(
  visible: boolean,
  selectedAnnotationIds: string[],
  selectedAnnotationId: string | null
): AnnotationSelectionState {
  return visible
    ? {
        selectedAnnotationIds,
        selectedAnnotationId,
      }
    : buildSingleAnnotationSelection(null);
}
