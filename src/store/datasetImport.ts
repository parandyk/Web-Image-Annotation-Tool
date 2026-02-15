import { Annotation, ClassData, ImageItem } from '../domain/types';
import { getClassColor } from '../utils/colors';
import { uid } from '../utils/id';
import { normalizeBBox } from './bboxMath';
import { parseVocAnnotationXml, parseYoloNamesFromYaml, VocParsedAnnotation } from './datasetFormatHelpers';
import { DirectoryEntry, basename, isImageEntry, toDirectoryEntries } from './directoryEntries';
import { getImageDimensions } from './imageDecode';
import { sanitizeClassName, toUniqueName } from './classImageHelpers';
import { createFallbackClass } from './workspaceDataHelpers';

type DatasetImportFailure = {
  ok: false;
  statusText: string;
};

type DatasetImportSuccess = {
  ok: true;
  classes: ClassData[];
  images: ImageItem[];
  selectedClassId: string;
  nextDisplayIdByClass: Record<string, number>;
  statusText: string;
};

export type DatasetImportResult = DatasetImportFailure | DatasetImportSuccess;

type DatasetImportInput = {
  files: File[];
  existingClasses: ClassData[];
  existingImages: ImageItem[];
  selectedClassId: string;
  nextDisplayIdByClass: Record<string, number>;
  fallbackClassName: string;
};

export async function parseDatasetImportPayload(input: DatasetImportInput): Promise<DatasetImportResult> {
  const entries = toDirectoryEntries(input.files);
  const imageEntries = entries.filter(isImageEntry);
  if (imageEntries.length === 0) {
    return { ok: false, statusText: 'No images found in selected folder.' };
  }

  const jsonEntries = entries.filter((e) => e.extLower === '.json');
  const cocoJsonEntry =
    jsonEntries.find((e) => basename(e.relPathLower) === 'instances_default.json') ??
    jsonEntries.find((e) => basename(e.relPathLower).startsWith('instances'));
  const classesEntry = entries.find((e) => e.nameLower === 'classes.txt') ?? null;
  const yoloYamlEntry =
    entries.find((e) => e.nameLower === 'data.yaml') ??
    entries.find((e) => e.nameLower === 'data.yml') ??
    null;
  const yoloLabelEntries = entries.filter((e) => e.extLower === '.txt' && e.relPathLower.includes('/labels/'));
  const xmlEntries = entries.filter((e) => e.extLower === '.xml');
  const vocXmlEntries =
    xmlEntries.filter((e) => e.relPathLower.includes('/annotations/') || e.relPathLower.includes('/annotation/'));
  const vocCandidateEntries = vocXmlEntries.length > 0 ? vocXmlEntries : xmlEntries;

  const format: 'coco' | 'yolo' | 'voc' | null = cocoJsonEntry
    ? 'coco'
    : classesEntry || yoloYamlEntry || yoloLabelEntries.length > 0
      ? 'yolo'
      : vocCandidateEntries.length > 0
        ? 'voc'
        : null;

  if (!format) {
    return {
      ok: false,
      statusText: 'Dataset format not recognized. Expected COCO, YOLO, or VOC export folder.',
    };
  }

  const workingClasses = input.existingClasses.map((c) => ({ ...c }));
  const takenNames = new Set(input.existingImages.map((i) => i.name));
  const nextDisplayIdByClass: Record<string, number> = { ...input.nextDisplayIdByClass };
  for (const img of input.existingImages) {
    const nextValue = img.annotations.reduce((max, ann) => Math.max(max, (ann.displayId ?? 0) + 1), 1);
    nextDisplayIdByClass[img.id] = Math.max(nextDisplayIdByClass[img.id] ?? 1, nextValue);
  }

  const classIdByLowerName = new Map(workingClasses.map((c) => [c.name.toLowerCase(), c.id]));
  const ensureFallbackClass = (): string => {
    const existing = workingClasses.find((c) => c.isDefault);
    if (existing) {
      return existing.id;
    }
    const fallbackId = uid('class');
    const fallback: ClassData = { ...createFallbackClass(fallbackId, input.fallbackClassName), hotkey: undefined };
    workingClasses.unshift(fallback);
    classIdByLowerName.set(fallback.name.toLowerCase(), fallback.id);
    return fallback.id;
  };
  const fallbackClassId = ensureFallbackClass();

  const ensureClassId = (rawName: string): string => {
    const trimmed = rawName.trim();
    if (!trimmed) return fallbackClassId;
    const existing = classIdByLowerName.get(trimmed.toLowerCase());
    if (existing) return existing;

    const sanitized = sanitizeClassName(trimmed) || trimmed.replace(/\s+/g, '_');
    const newClass: ClassData = {
      id: uid('class'),
      name: sanitized,
      color: getClassColor(workingClasses.length),
      isVisible: true,
      hotkey: undefined,
    };
    workingClasses.push(newClass);
    classIdByLowerName.set(trimmed.toLowerCase(), newClass.id);
    classIdByLowerName.set(newClass.name.toLowerCase(), newClass.id);
    return newClass.id;
  };

  const allocateDisplayId = (imageId: string): number => {
    const current = nextDisplayIdByClass[imageId] ?? 1;
    nextDisplayIdByClass[imageId] = current + 1;
    return current;
  };

  const newImages: ImageItem[] = [];
  let importedAnnotationCount = 0;
  let skippedAnnotations = 0;

  if (format === 'yolo') {
    // YOLO import expects class names + per-image txt labels in normalized coordinates.
    let classNames: string[] = [];
    if (classesEntry) {
      classNames = (await classesEntry.file.text())
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (classNames.length === 0 && yoloYamlEntry) {
      classNames = parseYoloNamesFromYaml(await yoloYamlEntry.file.text());
    }
    if (classNames.length === 0) {
      return { ok: false, statusText: 'YOLO dataset import failed: classes.txt or names in data.yaml not found.' };
    }

    const classIdsByIndex = classNames.map((name) => ensureClassId(name));
    const labelByBaseName = new Map<string, File>();
    for (const labelEntry of yoloLabelEntries) {
      if (!labelByBaseName.has(labelEntry.baseNameLower)) {
        labelByBaseName.set(labelEntry.baseNameLower, labelEntry.file);
      }
    }

    const preferredImages = imageEntries.filter((e) => e.relPathLower.includes('/images/'));
    const sourceImages = preferredImages.length > 0 ? preferredImages : imageEntries;
    for (const imageEntry of sourceImages) {
      const importedImageId = uid('img');
      let dims: { width: number; height: number };
      try {
        dims = await getImageDimensions(imageEntry.file);
      } catch {
        continue;
      }

      const annotations: Annotation[] = [];
      const labelFile = labelByBaseName.get(imageEntry.baseNameLower) ?? null;
      if (labelFile) {
        const labelContent = await labelFile.text();
        for (const line of labelContent.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length < 5) {
            skippedAnnotations += 1;
            continue;
          }
          const classIdx = Number(parts[0]);
          const cx = Number(parts[1]);
          const cy = Number(parts[2]);
          const w = Number(parts[3]);
          const h = Number(parts[4]);
          if (!Number.isInteger(classIdx) || classIdx < 0 || classIdx >= classIdsByIndex.length) {
            skippedAnnotations += 1;
            continue;
          }
          if (![cx, cy, w, h].every((v) => Number.isFinite(v))) {
            skippedAnnotations += 1;
            continue;
          }

          const widthPx = w * dims.width;
          const heightPx = h * dims.height;
          const bbox = normalizeBBox(
            {
              x: cx * dims.width - widthPx / 2,
              y: cy * dims.height - heightPx / 2,
              width: widthPx,
              height: heightPx,
            },
            dims.width,
            dims.height
          );
          if (bbox.width < 1 || bbox.height < 1) {
            skippedAnnotations += 1;
            continue;
          }

          const classId = classIdsByIndex[classIdx];
          annotations.push({
            id: uid('ann'),
            classId,
            bbox,
            isVisible: true,
            isAnchored: false,
            displayId: allocateDisplayId(importedImageId),
          });
          importedAnnotationCount += 1;
        }
      }

      nextDisplayIdByClass[importedImageId] = Math.max(
        nextDisplayIdByClass[importedImageId] ?? 1,
        annotations.reduce((max, ann) => Math.max(max, (ann.displayId ?? 0) + 1), 1)
      );
      newImages.push({
        id: importedImageId,
        name: toUniqueName(imageEntry.file.name, takenNames),
        file: imageEntry.file,
        src: '',
        width: dims.width,
        height: dims.height,
        isBookmarked: false,
        annotations,
        sourceKind: 'image',
      });
    }
  } else if (format === 'coco') {
    // COCO import builds classes from categories and maps image_id/category_id references.
    if (!cocoJsonEntry) {
      return { ok: false, statusText: 'COCO dataset import failed: instances JSON was not found.' };
    }

    let coco: {
      images?: Array<{ id: number | string; file_name: string; width?: number; height?: number }>;
      categories?: Array<{ id: number | string; name: string }>;
      annotations?: Array<{
        image_id: number | string;
        category_id: number | string;
        bbox: [number, number, number, number];
      }>;
    };
    try {
      coco = JSON.parse(await cocoJsonEntry.file.text());
    } catch {
      return { ok: false, statusText: 'COCO dataset import failed: invalid JSON format.' };
    }

    const cocoImages = Array.isArray(coco.images) ? coco.images : [];
    const cocoCategories = Array.isArray(coco.categories) ? coco.categories : [];
    const cocoAnnotations = Array.isArray(coco.annotations) ? coco.annotations : [];
    if (cocoImages.length === 0) {
      return { ok: false, statusText: 'COCO dataset import failed: no images in instances file.' };
    }

    const classIdByCategoryId = new Map<number, string>();
    for (const category of cocoCategories) {
      const categoryId = Number(category.id);
      if (!Number.isFinite(categoryId)) continue;
      classIdByCategoryId.set(categoryId, ensureClassId(String(category.name ?? `Class_${categoryId}`)));
    }

    const imageByRelativePath = new Map(imageEntries.map((entry) => [entry.relPathLower, entry]));
    const imageByBaseName = new Map<string, DirectoryEntry[]>();
    for (const imageEntry of imageEntries) {
      const base = basename(imageEntry.relPathLower);
      const list = imageByBaseName.get(base) ?? [];
      list.push(imageEntry);
      imageByBaseName.set(base, list);
    }

    const resolveCocoImageEntry = (fileNameRaw: string): DirectoryEntry | null => {
      const normalized = fileNameRaw.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
      if (!normalized) return null;

      const direct = imageByRelativePath.get(normalized);
      if (direct) return direct;

      const normalizedWithoutImages = normalized.replace(/^images\//, '');
      const withImages = imageByRelativePath.get(`images/${normalizedWithoutImages}`);
      if (withImages) return withImages;

      const suffixMatch = imageEntries.find(
        (entry) =>
          entry.relPathLower.endsWith(`/${normalized}`) ||
          entry.relPathLower.endsWith(`/${normalizedWithoutImages}`) ||
          entry.relPathLower.endsWith(`/images/${normalizedWithoutImages}`)
      );
      if (suffixMatch) return suffixMatch;

      const byBase = imageByBaseName.get(basename(normalizedWithoutImages));
      if (!byBase || byBase.length === 0) return null;
      return byBase[0];
    };

    const importedByCocoImageId = new Map<number, ImageItem>();
    for (const cocoImage of cocoImages) {
      const cocoImageId = Number(cocoImage.id);
      if (!Number.isFinite(cocoImageId)) continue;

      const fileName = String(cocoImage.file_name ?? '').trim();
      if (!fileName) continue;
      const imageEntry = resolveCocoImageEntry(fileName);
      if (!imageEntry) continue;

      let dims: { width: number; height: number };
      const width = Number(cocoImage.width);
      const height = Number(cocoImage.height);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        dims = { width, height };
      } else {
        try {
          dims = await getImageDimensions(imageEntry.file);
        } catch {
          continue;
        }
      }

      const imageItem: ImageItem = {
        id: uid('img'),
        name: toUniqueName(imageEntry.file.name, takenNames),
        file: imageEntry.file,
        src: '',
        width: dims.width,
        height: dims.height,
        isBookmarked: false,
        annotations: [],
        sourceKind: 'image',
      };
      nextDisplayIdByClass[imageItem.id] = Math.max(nextDisplayIdByClass[imageItem.id] ?? 1, 1);
      newImages.push(imageItem);
      importedByCocoImageId.set(cocoImageId, imageItem);
    }

    for (const cocoAnnotation of cocoAnnotations) {
      const imageId = Number(cocoAnnotation.image_id);
      const categoryId = Number(cocoAnnotation.category_id);
      const imageItem = importedByCocoImageId.get(imageId);
      if (!imageItem) {
        skippedAnnotations += 1;
        continue;
      }

      const classId = classIdByCategoryId.get(categoryId) ?? fallbackClassId;
      const bboxRaw = Array.isArray(cocoAnnotation.bbox) ? cocoAnnotation.bbox : [];
      if (bboxRaw.length < 4) {
        skippedAnnotations += 1;
        continue;
      }
      const x = Number(bboxRaw[0]);
      const y = Number(bboxRaw[1]);
      const w = Number(bboxRaw[2]);
      const h = Number(bboxRaw[3]);
      if (![x, y, w, h].every((v) => Number.isFinite(v))) {
        skippedAnnotations += 1;
        continue;
      }

      const bbox = normalizeBBox({ x, y, width: w, height: h }, imageItem.width, imageItem.height);
      if (bbox.width < 1 || bbox.height < 1) {
        skippedAnnotations += 1;
        continue;
      }

      imageItem.annotations.push({
        id: uid('ann'),
        classId,
        bbox,
        isVisible: true,
        isAnchored: false,
        displayId: allocateDisplayId(imageItem.id),
      });
      importedAnnotationCount += 1;
    }
  } else {
    // VOC import expects image files and XML annotations (usually in an annotations folder).
    const xmlByBaseName = new Map<string, DirectoryEntry>();
    for (const xmlEntry of vocCandidateEntries) {
      if (!xmlByBaseName.has(xmlEntry.baseNameLower)) {
        xmlByBaseName.set(xmlEntry.baseNameLower, xmlEntry);
      }
    }

    const preferredImages = imageEntries.filter((e) => e.relPathLower.includes('/images/'));
    const sourceImages = preferredImages.length > 0 ? preferredImages : imageEntries;
    for (const imageEntry of sourceImages) {
      const importedImageId = uid('img');
      let dims: { width: number; height: number };
      try {
        dims = await getImageDimensions(imageEntry.file);
      } catch {
        continue;
      }

      const annotations: Annotation[] = [];
      const xmlEntry = xmlByBaseName.get(imageEntry.baseNameLower) ?? null;
      if (xmlEntry) {
        let parsedVoc: VocParsedAnnotation | null = null;
        try {
          parsedVoc = parseVocAnnotationXml(await xmlEntry.file.text());
        } catch {
          parsedVoc = null;
        }

        if (parsedVoc) {
          for (const object of parsedVoc.objects) {
            const bbox = normalizeBBox(
              {
                x: object.xmin,
                y: object.ymin,
                width: object.xmax - object.xmin,
                height: object.ymax - object.ymin,
              },
              dims.width,
              dims.height
            );
            if (bbox.width < 1 || bbox.height < 1) {
              skippedAnnotations += 1;
              continue;
            }

            const classId = ensureClassId(object.name);
            annotations.push({
              id: uid('ann'),
              classId,
              bbox,
              isVisible: true,
              isAnchored: false,
              displayId: allocateDisplayId(importedImageId),
            });
            importedAnnotationCount += 1;
          }
        }
      }

      nextDisplayIdByClass[importedImageId] = Math.max(
        nextDisplayIdByClass[importedImageId] ?? 1,
        annotations.reduce((max, ann) => Math.max(max, (ann.displayId ?? 0) + 1), 1)
      );
      newImages.push({
        id: importedImageId,
        name: toUniqueName(imageEntry.file.name, takenNames),
        file: imageEntry.file,
        src: '',
        width: dims.width,
        height: dims.height,
        isBookmarked: false,
        annotations,
        sourceKind: 'image',
      });
    }
  }

  if (newImages.length === 0) {
    return { ok: false, statusText: `No images were imported from ${format.toUpperCase()} dataset.` };
  }

  const selectedClassId =
    workingClasses.some((c) => c.id === input.selectedClassId) && input.selectedClassId
      ? input.selectedClassId
      : fallbackClassId;
  const importedImageWord = newImages.length === 1 ? 'image' : 'images';
  const importedAnnotationWord = importedAnnotationCount === 1 ? 'annotation' : 'annotations';
  const skippedPart = skippedAnnotations > 0 ? `, ${skippedAnnotations} skipped` : '';

  return {
    ok: true,
    classes: workingClasses,
    images: newImages,
    selectedClassId,
    nextDisplayIdByClass,
    statusText: `Imported ${format.toUpperCase()} dataset: ${newImages.length} ${importedImageWord}, ${importedAnnotationCount} ${importedAnnotationWord}${skippedPart}.`,
  };
}
