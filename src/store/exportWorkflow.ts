import JSZip from 'jszip';
import { ClassData, ExportAnnotationFormat, ImageItem, ImageScope } from '../domain/types';
import { getImageIdsByScope, sanitizeExportFolderName } from './classImageHelpers';
import { isSupportedImageFileName } from './directoryEntries';
import {
  downloadBlob,
  ExportImageMetadataOptions,
  ExportImageNamingOptions,
  ExportImageOutputOptions,
  normalizeExportImageMetadataOptions,
  prepareExportImageBlobs,
  resolveExportContext,
  writeCocoDataset,
  writeVocDataset,
  writeYoloDataset,
} from './exportDataset';

type ExportState = {
  images: ImageItem[];
  selectedImageId: string | null;
  classes: ClassData[];
};

type ExportWorkflowFailure = {
  ok: false;
  statusText?: string;
};

type ExportWorkflowSuccess = {
  ok: true;
  statusText?: string;
};

export type ExportWorkflowResult = ExportWorkflowFailure | ExportWorkflowSuccess;

function resolveNoContextStatus(
  scopedImages: ImageItem[],
  skippedUnsupportedCount: number,
  includeImagesWithoutAnnotations: boolean
): string | undefined {
  if (scopedImages.length > 0 && skippedUnsupportedCount === scopedImages.length) {
    return 'No exportable images in selected scope.';
  }
  if (!includeImagesWithoutAnnotations) {
    return 'No images with exportable annotations in selected scope.';
  }
  return undefined;
}

function resolveSkippedStatus(skippedUnsupportedCount: number): string | undefined {
  if (skippedUnsupportedCount <= 0) return undefined;
  return `Export completed. Skipped ${skippedUnsupportedCount} unsupported image file${skippedUnsupportedCount === 1 ? '' : 's'}.`;
}

export async function exportAnnotationsFromState(
  state: ExportState,
  format: ExportAnnotationFormat,
  scope: ImageScope,
  includeFallback: boolean,
  namingOptions: ExportImageNamingOptions,
  outputOptions: ExportImageOutputOptions,
  includeImagesWithoutAnnotations: boolean,
  imageMetadataOptions: ExportImageMetadataOptions,
  fallbackClassName: string
): Promise<ExportWorkflowResult> {
  const scopedImageIds = new Set(getImageIdsByScope(state.images, state.selectedImageId, scope));
  const scopedImages = state.images.filter((img) => scopedImageIds.has(img.id));
  const skippedUnsupportedCount = scopedImages.filter((img) => !isSupportedImageFileName(img.name)).length;
  const normalizedMetadataOptions = normalizeExportImageMetadataOptions(imageMetadataOptions);
  const ctx = resolveExportContext(
    state,
    scope,
    includeFallback,
    namingOptions,
    outputOptions,
    includeImagesWithoutAnnotations,
    normalizedMetadataOptions
  );
  if (!ctx) {
    return {
      ok: false,
      statusText: resolveNoContextStatus(scopedImages, skippedUnsupportedCount, includeImagesWithoutAnnotations),
    };
  }

  try {
    const imageBlobById = await prepareExportImageBlobs(ctx, normalizedMetadataOptions);
    const zip = new JSZip();
    if (format === 'yolo') writeYoloDataset(zip, ctx, imageBlobById, normalizedMetadataOptions);
    if (format === 'coco') writeCocoDataset(zip, ctx, imageBlobById, normalizedMetadataOptions);
    if (format === 'voc') writeVocDataset(zip, ctx, imageBlobById, normalizedMetadataOptions, fallbackClassName);
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `dataset_${format}_${Date.now()}.zip`);
    return { ok: true, statusText: resolveSkippedStatus(skippedUnsupportedCount) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown conversion error.';
    return { ok: false, statusText: `Export failed: ${message}` };
  }
}

export async function exportAllAnnotationsFromState(
  state: ExportState,
  scope: ImageScope,
  folderName: string,
  includeFallback: boolean,
  namingOptions: ExportImageNamingOptions,
  outputOptions: ExportImageOutputOptions,
  includeImagesWithoutAnnotations: boolean,
  imageMetadataOptions: ExportImageMetadataOptions,
  fallbackClassName: string
): Promise<ExportWorkflowResult> {
  const scopedImageIds = new Set(getImageIdsByScope(state.images, state.selectedImageId, scope));
  const scopedImages = state.images.filter((img) => scopedImageIds.has(img.id));
  const skippedUnsupportedCount = scopedImages.filter((img) => !isSupportedImageFileName(img.name)).length;
  const normalizedMetadataOptions = normalizeExportImageMetadataOptions(imageMetadataOptions);
  const ctx = resolveExportContext(
    state,
    scope,
    includeFallback,
    namingOptions,
    outputOptions,
    includeImagesWithoutAnnotations,
    normalizedMetadataOptions
  );
  if (!ctx) {
    return {
      ok: false,
      statusText: resolveNoContextStatus(scopedImages, skippedUnsupportedCount, includeImagesWithoutAnnotations),
    };
  }

  try {
    const imageBlobById = await prepareExportImageBlobs(ctx, normalizedMetadataOptions);
    const zip = new JSZip();
    const rootName = sanitizeExportFolderName(folderName);
    const root = zip.folder(rootName);
    if (!root) {
      return { ok: false };
    }

    const yolo = root.folder('yolo');
    const coco = root.folder('coco');
    const voc = root.folder('voc');
    if (!yolo || !coco || !voc) {
      return { ok: false };
    }

    writeYoloDataset(yolo, ctx, imageBlobById, normalizedMetadataOptions);
    writeCocoDataset(coco, ctx, imageBlobById, normalizedMetadataOptions);
    writeVocDataset(voc, ctx, imageBlobById, normalizedMetadataOptions, fallbackClassName);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${rootName}_${Date.now()}.zip`);
    return { ok: true, statusText: resolveSkippedStatus(skippedUnsupportedCount) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown conversion error.';
    return { ok: false, statusText: `Export failed: ${message}` };
  }
}
