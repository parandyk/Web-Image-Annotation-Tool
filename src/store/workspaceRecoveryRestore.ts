import { Annotation, ClassData, ImageItem } from '../domain/types';
import { uid } from '../utils/id';
import { WorkspaceRecoverySnapshot } from '../utils/workspaceRecovery';
import { normalizeBBox } from './bboxMath';
import { getDefaultClassId } from './classImageHelpers';
import { ViewState, sanitizeViewStateSnapshot } from './viewState';
import { computeNextDisplayIdByImage, createFallbackClass, enforceSingleDefaultClass } from './workspaceDataHelpers';

type RecoveryRestoreFailure = {
  ok: false;
  statusText: string;
};

type RecoveryRestoreSuccess = {
  ok: true;
  settings: ViewState;
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  nextDisplayIdByClass: Record<string, number>;
};

export type RecoveryRestoreResult = RecoveryRestoreFailure | RecoveryRestoreSuccess;

export function restoreRecoverySnapshotPayload(
  snapshot: WorkspaceRecoverySnapshot | null,
  fallbackClassName: string
): RecoveryRestoreResult {
  if (!snapshot || snapshot.version !== 1) {
    return { ok: false, statusText: 'Recovery snapshot is not compatible with this app version.' };
  }

  const settings = sanitizeViewStateSnapshot(snapshot.settings);
  const classes: ClassData[] = snapshot.classes.map((cls) => ({
    ...cls,
    defaultAnchored: Boolean(cls.defaultAnchored),
    hotkey: cls.hotkey ? String(cls.hotkey).toUpperCase() : undefined,
  }));
  if (classes.length === 0) {
    classes.push({ ...createFallbackClass(uid('class'), fallbackClassName), hotkey: undefined });
  }
  enforceSingleDefaultClass(classes);
  const defaultClass = classes.find((c) => c.isDefault) ?? classes[0];
  const classIds = new Set(classes.map((c) => c.id));

  const images: ImageItem[] = snapshot.images.map((img) => {
    const file = img.file;
    const width = Math.max(1, Math.floor(img.width));
    const height = Math.max(1, Math.floor(img.height));
    const annotations = img.annotations
      .map((ann) => {
        const normalized = normalizeBBox(ann.bbox, width, height);
        if (normalized.width < 1 || normalized.height < 1) return null;
        const classId = classIds.has(ann.classId) ? ann.classId : defaultClass.id;
        return {
          id: ann.id,
          classId,
          bbox: normalized,
          isVisible: ann.isVisible,
          isAnchored: ann.isAnchored,
          displayId: Math.max(1, Math.floor(ann.displayId ?? 1)),
        };
      })
      .filter((ann): ann is Annotation => Boolean(ann));

    return {
      id: img.id,
      name: img.name,
      file,
      src: '',
      width,
      height,
      isBookmarked: Boolean(img.isBookmarked),
      annotations,
      sourceKind: img.sourceKind === 'videoFrame' ? 'videoFrame' : 'image',
      videoMeta: img.videoMeta ? { ...img.videoMeta } : undefined,
    };
  });

  const imageIds = new Set(images.map((img) => img.id));
  const selectedImageId =
    snapshot.selectedImageId && imageIds.has(snapshot.selectedImageId)
      ? snapshot.selectedImageId
      : images[0]?.id ?? null;
  const selectedImage = images.find((img) => img.id === selectedImageId) ?? null;
  const annotationIds = new Set((selectedImage?.annotations ?? []).map((ann) => ann.id));
  const selectedAnnotationIds = Array.from(
    new Set(snapshot.selectedAnnotationIds.filter((id) => annotationIds.has(id)))
  );
  const selectedAnnotationId =
    snapshot.selectedAnnotationId && annotationIds.has(snapshot.selectedAnnotationId)
      ? snapshot.selectedAnnotationId
      : selectedAnnotationIds[selectedAnnotationIds.length - 1] ?? null;
  const restoredSelectedClassId =
    snapshot.selectedClassId && classIds.has(snapshot.selectedClassId) ? snapshot.selectedClassId : defaultClass.id;
  const selectedClassId =
    settings.classAssignmentMode === 'deferred'
      ? getDefaultClassId(classes, defaultClass.id)
      : restoredSelectedClassId;

  const nextDisplayIdByClass = computeNextDisplayIdByImage(images);
  for (const [imageId, rawValue] of Object.entries(snapshot.nextDisplayIdByClass ?? {})) {
    if (!imageIds.has(imageId)) continue;
    if (!Number.isFinite(rawValue) || rawValue < 1) continue;
    nextDisplayIdByClass[imageId] = Math.max(nextDisplayIdByClass[imageId] ?? 1, Math.floor(rawValue));
  }

  return {
    ok: true,
    settings,
    classes,
    images,
    selectedClassId,
    selectedImageId,
    selectedAnnotationId,
    selectedAnnotationIds,
    nextDisplayIdByClass,
  };
}
