import JSZip from 'jszip';
import { Annotation, ClassData, ImageItem } from '../domain/types';
import { getClassColor } from '../utils/colors';
import { uid } from '../utils/id';
import { normalizeBBox } from './bboxMath';
import { getDefaultClassId, sanitizeClassName, toUniqueName } from './classImageHelpers';
import { getImageDimensions } from './imageDecode';
import { sanitizeViewStateSnapshot, ViewState } from './viewState';
import { computeNextDisplayIdByImage, createFallbackClass, enforceSingleDefaultClass } from './workspaceDataHelpers';

type WorkspaceImportFailure = {
  ok: false;
  statusText: string;
};

type WorkspaceImportLoadSuccess = {
  ok: true;
  zip: JSZip;
  payload: unknown;
};

type WorkspaceImportSuccess = {
  ok: true;
  importedView: ViewState;
  importedClasses: ClassData[];
  importedImages: ImageItem[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  nextDisplayIdByClass: Record<string, number>;
  skippedImages: number;
  skippedAnnotations: number;
};

export type WorkspaceImportParseResult = WorkspaceImportFailure | WorkspaceImportSuccess;
export type WorkspaceImportLoadResult = WorkspaceImportFailure | WorkspaceImportLoadSuccess;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export async function parseWorkspaceImportPayload(
  payload: unknown,
  zip: JSZip,
  fallbackClassName: string
): Promise<WorkspaceImportParseResult> {
  const root = isObject(payload) ? payload : {};
  const rawSettings = isObject(root.settings) ? root.settings : null;
  const importedView = sanitizeViewStateSnapshot(rawSettings);

  const rawClasses = Array.isArray(root.classes) ? root.classes : [];
  const classIds = new Set<string>();
  const importedClasses: ClassData[] = [];
  for (const rawClass of rawClasses) {
    if (!isObject(rawClass)) continue;
    let classId = asString(rawClass.id) ?? uid('class');
    while (classIds.has(classId)) {
      classId = uid('class');
    }
    classIds.add(classId);

    const rawName = asString(rawClass.name) ?? `Class_${importedClasses.length + 1}`;
    const sanitizedName = sanitizeClassName(rawName) || rawName.replace(/\s+/g, '_');
    const color = asString(rawClass.color) ?? getClassColor(importedClasses.length);
    const hotkeyRaw = asString(rawClass.hotkey);
    const hotkey = hotkeyRaw && /^[A-Z0-9]$/i.test(hotkeyRaw) ? hotkeyRaw.toUpperCase() : undefined;

    importedClasses.push({
      id: classId,
      name: sanitizedName,
      color,
      isVisible: asBoolean(rawClass.isVisible) ?? true,
      isDefault: asBoolean(rawClass.isDefault) ?? false,
      hotkey,
    });
  }

  if (importedClasses.length === 0) {
    importedClasses.push(createFallbackClass(uid('class'), fallbackClassName));
  }
  enforceSingleDefaultClass(importedClasses);
  const fallbackClassId = importedClasses.find((c) => c.isDefault)?.id ?? importedClasses[0].id;
  const validClassIds = new Set(importedClasses.map((c) => c.id));

  const rawImages = Array.isArray(root.images) ? root.images : [];
  const importedImages: ImageItem[] = [];
  const imageIds = new Set<string>();
  const imageNames = new Set<string>();
  let skippedImages = 0;
  let skippedAnnotations = 0;

  for (const rawImage of rawImages) {
    if (!isObject(rawImage)) {
      skippedImages += 1;
      continue;
    }

    const fileName = asString(rawImage.fileName) ?? asString(rawImage.name);
    if (!fileName) {
      skippedImages += 1;
      continue;
    }
    const zipImageEntry = zip.file(`images/${fileName}`) ?? zip.file(fileName);
    if (!zipImageEntry) {
      skippedImages += 1;
      continue;
    }

    let imageBlob: Blob;
    try {
      imageBlob = await zipImageEntry.async('blob');
    } catch {
      skippedImages += 1;
      continue;
    }
    const imageFile = new File([imageBlob], fileName, {
      type: imageBlob.type || 'application/octet-stream',
      lastModified: Date.now(),
    });

    let width = asNumber(rawImage.width) ?? 0;
    let height = asNumber(rawImage.height) ?? 0;
    if (width <= 0 || height <= 0) {
      try {
        const dims = await getImageDimensions(imageFile);
        width = dims.width;
        height = dims.height;
      } catch {
        skippedImages += 1;
        continue;
      }
    }

    let imageId = asString(rawImage.id) ?? uid('img');
    while (imageIds.has(imageId)) {
      imageId = uid('img');
    }
    imageIds.add(imageId);

    const requestedName = asString(rawImage.name) ?? fileName;
    const name = toUniqueName(requestedName, imageNames);
    const rawAnnotations = Array.isArray(rawImage.annotations) ? rawImage.annotations : [];
    const annotations: Annotation[] = [];
    const annotationIds = new Set<string>();
    let nextDisplayId = 1;

    for (const rawAnn of rawAnnotations) {
      if (!isObject(rawAnn)) {
        skippedAnnotations += 1;
        continue;
      }
      const rawBbox = isObject(rawAnn.bbox) ? rawAnn.bbox : null;
      if (!rawBbox) {
        skippedAnnotations += 1;
        continue;
      }
      const x = asNumber(rawBbox.x);
      const y = asNumber(rawBbox.y);
      const w = asNumber(rawBbox.width);
      const h = asNumber(rawBbox.height);
      if (x === null || y === null || w === null || h === null) {
        skippedAnnotations += 1;
        continue;
      }
      const bbox = normalizeBBox({ x, y, width: w, height: h }, width, height);
      if (bbox.width < 1 || bbox.height < 1) {
        skippedAnnotations += 1;
        continue;
      }

      let annotationId = asString(rawAnn.id) ?? uid('ann');
      while (annotationIds.has(annotationId)) {
        annotationId = uid('ann');
      }
      annotationIds.add(annotationId);

      const requestedClassId = asString(rawAnn.classId) ?? fallbackClassId;
      const classId = validClassIds.has(requestedClassId) ? requestedClassId : fallbackClassId;
      const parsedDisplayId = asNumber(rawAnn.displayId);
      const displayId = parsedDisplayId && parsedDisplayId >= 1 ? Math.floor(parsedDisplayId) : nextDisplayId;
      nextDisplayId = Math.max(nextDisplayId, displayId + 1);

      annotations.push({
        id: annotationId,
        classId,
        bbox,
        isVisible: asBoolean(rawAnn.isVisible) ?? true,
        isAnchored: asBoolean(rawAnn.isAnchored) ?? false,
        displayId,
      });
    }

    const sourceKindRaw = asString(rawImage.sourceKind);
    const sourceKind = sourceKindRaw === 'videoFrame' ? 'videoFrame' : 'image';
    let videoMeta: ImageItem['videoMeta'] = undefined;
    const rawVideoMeta = isObject(rawImage.videoMeta) ? rawImage.videoMeta : null;
    if (sourceKind === 'videoFrame' && rawVideoMeta) {
      const videoId = asString(rawVideoMeta.videoId);
      const videoName = asString(rawVideoMeta.videoName);
      const sourceFps = asNumber(rawVideoMeta.sourceFps);
      const sourceDurationMs = asNumber(rawVideoMeta.sourceDurationMs);
      const frameIndex = asNumber(rawVideoMeta.frameIndex);
      const timestampMs = asNumber(rawVideoMeta.timestampMs);
      if (videoId && videoName && sourceFps !== null && sourceDurationMs !== null && frameIndex !== null && timestampMs !== null) {
        videoMeta = {
          videoId,
          videoName,
          sourceFps,
          sourceDurationMs: Math.max(0, Math.round(sourceDurationMs)),
          frameIndex: Math.max(0, Math.round(frameIndex)),
          timestampMs: Math.max(0, Math.round(timestampMs)),
        };
      }
    }

    importedImages.push({
      id: imageId,
      name,
      file: imageFile,
      src: '',
      width,
      height,
      isBookmarked: asBoolean(rawImage.isBookmarked) ?? false,
      annotations,
      sourceKind,
      videoMeta,
    });
  }

  if (importedImages.length === 0) {
    return { ok: false, statusText: 'Workspace import failed: no images could be restored.' };
  }

  const rawSelection = isObject(root.selection) ? root.selection : {};
  const requestedClassId = asString(rawSelection.selectedClassId);
  const importedSelectedClassId = requestedClassId && validClassIds.has(requestedClassId) ? requestedClassId : fallbackClassId;
  const selectedClassId =
    importedView.classAssignmentMode === 'deferred'
      ? getDefaultClassId(importedClasses, fallbackClassId)
      : importedSelectedClassId;

  const imageById = new Map(importedImages.map((img) => [img.id, img]));
  const requestedImageId = asString(rawSelection.selectedImageId);
  const selectedImageId = requestedImageId && imageById.has(requestedImageId) ? requestedImageId : importedImages[0]?.id ?? null;

  const selectedImage = selectedImageId ? imageById.get(selectedImageId) ?? null : null;
  const validAnnotationIds = new Set((selectedImage?.annotations ?? []).map((ann) => ann.id));
  const rawSelectedAnnotationIds = Array.isArray(rawSelection.selectedAnnotationIds) ? rawSelection.selectedAnnotationIds : [];
  const selectedAnnotationIds = Array.from(
    new Set(
      rawSelectedAnnotationIds
        .map((value) => (typeof value === 'string' ? value : null))
        .filter((value): value is string => Boolean(value && validAnnotationIds.has(value)))
    )
  );

  const requestedAnnotationId = asString(rawSelection.selectedAnnotationId);
  const selectedAnnotationId =
    requestedAnnotationId && validAnnotationIds.has(requestedAnnotationId)
      ? requestedAnnotationId
      : selectedAnnotationIds[selectedAnnotationIds.length - 1] ?? null;

  const nextDisplayIdByClass = computeNextDisplayIdByImage(importedImages);
  if (isObject(root.nextDisplayIdByClass)) {
    for (const [imageId, value] of Object.entries(root.nextDisplayIdByClass)) {
      if (!imageById.has(imageId)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) continue;
      nextDisplayIdByClass[imageId] = Math.max(nextDisplayIdByClass[imageId] ?? 1, Math.floor(value));
    }
  }

  return {
    ok: true,
    importedView,
    importedClasses,
    importedImages,
    selectedClassId,
    selectedImageId,
    selectedAnnotationId,
    selectedAnnotationIds,
    nextDisplayIdByClass,
    skippedImages,
    skippedAnnotations,
  };
}

export async function loadWorkspaceImportPayload(file: File): Promise<WorkspaceImportLoadResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return { ok: false, statusText: 'Workspace import failed: invalid ZIP file.' };
  }

  const stateFile = zip.file('workspace_state.json');
  if (!stateFile) {
    return { ok: false, statusText: 'Workspace import failed: workspace_state.json not found.' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await stateFile.async('text'));
  } catch {
    return { ok: false, statusText: 'Workspace import failed: workspace_state.json is invalid.' };
  }

  return { ok: true, zip, payload };
}
