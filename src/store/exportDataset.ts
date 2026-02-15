import JSZip from 'jszip';
import { ClassData, ImageItem, ImageScope } from '../domain/types';
import { sanitizeExportImageBaseName, splitNameAndExt, toUniqueName, withExtension, getImageIdsByScope } from './classImageHelpers';
import { isSupportedImageFileName } from './directoryEntries';
import { buildVocAnnotationXml } from './datasetFormatHelpers';

export type ExportImageNamingMode = 'original' | 'sequential';
export type ExportImageNamingOptions = {
  mode: ExportImageNamingMode;
  baseName?: string;
};
export type ExportImageOutputFormat = 'jpeg' | 'png';
export type ExportImageOutputOptions = {
  convert: boolean;
  format: ExportImageOutputFormat;
};
export type ExportImageMetadataOptions = {
  includeOriginalName: boolean;
  sanitizeImageMetadata: boolean;
};

export type ExportContext = {
  images: ImageItem[];
  classes: ClassData[];
  classMap: Map<string, number>;
  fileNameByImageId: Map<string, string>;
  outputOptions: ExportImageOutputOptions;
};

type ExportScopeState = {
  images: ImageItem[];
  selectedImageId: string | null;
  classes: ClassData[];
};

function normalizeExportImageOutputOptions(
  options: ExportImageOutputOptions | undefined
): ExportImageOutputOptions {
  if (!options) return { convert: false, format: 'png' };
  return {
    convert: Boolean(options.convert),
    format: options.format === 'jpeg' ? 'jpeg' : 'png',
  };
}

export function normalizeExportImageMetadataOptions(
  options: ExportImageMetadataOptions | undefined
): ExportImageMetadataOptions {
  if (!options) {
    return { includeOriginalName: false, sanitizeImageMetadata: false };
  }
  return {
    includeOriginalName: Boolean(options.includeOriginalName),
    sanitizeImageMetadata: Boolean(options.sanitizeImageMetadata),
  };
}

function getReencodedExtensionForImage(
  imageName: string,
  outputOptions: ExportImageOutputOptions,
  metadataOptions: ExportImageMetadataOptions
): string | null {
  if (outputOptions.convert) {
    return outputOptions.format === 'jpeg' ? '.jpg' : '.png';
  }
  if (!metadataOptions.sanitizeImageMetadata) return null;
  const ext = splitNameAndExt(imageName).ext.toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return '.jpg';
  if (ext === '.png') return '.png';
  // For formats without reliable same-format canvas export (webp/bmp/tiff), sanitize via PNG re-encode.
  return '.png';
}

function getReencodedFormat(extension: string): ExportImageOutputFormat {
  return extension === '.jpg' ? 'jpeg' : 'png';
}

function getImageMetadataOriginalName(image: ImageItem): string {
  return image.name;
}

function buildExportImageFileNameMap(
  images: ImageItem[],
  namingOptions: ExportImageNamingOptions,
  outputOptions: ExportImageOutputOptions,
  metadataOptions: ExportImageMetadataOptions
): Map<string, string> {
  const mode = namingOptions.mode ?? 'sequential';
  const mapped = new Map<string, string>();
  const used = new Set<string>();

  if (mode === 'original') {
    for (const image of images) {
      const convertedExt = getReencodedExtensionForImage(image.name, outputOptions, metadataOptions);
      const sourceName = convertedExt ? withExtension(image.name, convertedExt) : image.name;
      const uniqueName = toUniqueName(sourceName, used);
      mapped.set(image.id, uniqueName);
    }
    return mapped;
  }

  const baseName = sanitizeExportImageBaseName(namingOptions.baseName ?? 'image');
  images.forEach((image, index) => {
    const { ext } = splitNameAndExt(image.name);
    const convertedExt = getReencodedExtensionForImage(image.name, outputOptions, metadataOptions);
    const resolvedExt = convertedExt ?? ext;
    const raw = `${baseName}_${index + 1}${ext}`;
    const candidate = withExtension(raw, resolvedExt);
    const uniqueName = toUniqueName(candidate, used);
    mapped.set(image.id, uniqueName);
  });
  return mapped;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const src = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(src);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(src);
      reject(error);
    };
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas conversion failed.'));
          return;
        }
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

async function convertImageFileForExport(file: File, format: ExportImageOutputFormat): Promise<Blob> {
  const image = await loadImageFromFile(file);
  const width = Math.max(1, image.naturalWidth);
  const height = Math.max(1, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable.');
  ctx.drawImage(image, 0, 0, width, height);
  if (format === 'jpeg') {
    return canvasToBlob(canvas, 'image/jpeg', 0.92);
  }
  return canvasToBlob(canvas, 'image/png');
}

export async function prepareExportImageBlobs(
  ctx: ExportContext,
  metadataOptions: ExportImageMetadataOptions
): Promise<Map<string, Blob>> {
  const blobById = new Map<string, Blob>();
  for (const image of ctx.images) {
    const targetExt = getReencodedExtensionForImage(image.name, ctx.outputOptions, metadataOptions);
    if (!targetExt) {
      blobById.set(image.id, image.file);
      continue;
    }
    const converted = await convertImageFileForExport(image.file, getReencodedFormat(targetExt));
    blobById.set(image.id, converted);
  }
  return blobById;
}

export function resolveExportContext(
  state: ExportScopeState,
  scope: ImageScope,
  includeFallback: boolean,
  namingOptions: ExportImageNamingOptions,
  outputOptions: ExportImageOutputOptions,
  includeImagesWithoutAnnotations: boolean,
  metadataOptions: ExportImageMetadataOptions
): ExportContext | null {
  const normalizedOutputOptions = normalizeExportImageOutputOptions(outputOptions);
  const normalizedMetadataOptions = normalizeExportImageMetadataOptions(metadataOptions);
  const imageIdSet = new Set(getImageIdsByScope(state.images, state.selectedImageId, scope));
  let images = state.images.filter(
    (img) => imageIdSet.has(img.id) && isSupportedImageFileName(img.name)
  );
  if (images.length === 0) return null;

  const hasAnyAnnotation = images.some((img) => img.annotations.length > 0);
  let classes = state.classes.filter((c) => includeFallback || !c.isDefault);
  if (classes.length === 0) return null;

  let classMap = new Map(classes.map((c, idx) => [c.id, idx]));
  const hasMappedAnnotation = images.some((img) =>
    img.annotations.some((ann) => classMap.has(ann.classId))
  );
  if (hasAnyAnnotation && !hasMappedAnnotation) {
    classes = state.classes;
    classMap = new Map(classes.map((c, idx) => [c.id, idx]));
  }

  if (!includeImagesWithoutAnnotations) {
    images = images.filter((img) => img.annotations.some((ann) => classMap.has(ann.classId)));
    if (images.length === 0) return null;
  }

  const fileNameByImageId = buildExportImageFileNameMap(
    images,
    namingOptions,
    normalizedOutputOptions,
    normalizedMetadataOptions
  );
  return { images, classes, classMap, fileNameByImageId, outputOptions: normalizedOutputOptions };
}

function writeImageMetadataSidecar(
  root: JSZip,
  ctx: ExportContext,
  metadataOptions: ExportImageMetadataOptions
): void {
  if (!metadataOptions.includeOriginalName) return;
  const payload = {
    images: ctx.images.map((img, idx) => ({
      id: idx + 1,
      file_name: ctx.fileNameByImageId.get(img.id) ?? img.name,
      original_file_name: getImageMetadataOriginalName(img),
    })),
  };
  root.file('image_metadata.json', JSON.stringify(payload, null, 2));
}

export function writeYoloDataset(
  root: JSZip,
  ctx: ExportContext,
  imageBlobById: Map<string, Blob>,
  metadataOptions: ExportImageMetadataOptions
): void {
  const imagesFolder = root.folder('images');
  const labelsFolder = root.folder('labels');
  if (!imagesFolder || !labelsFolder) return;

  const classNames = ctx.classes.map((c) => c.name).join('\n');
  root.file('classes.txt', classNames);

  for (const image of ctx.images) {
    const exportImageName = ctx.fileNameByImageId.get(image.id) ?? image.name;
    const exportBlob = imageBlobById.get(image.id) ?? image.file;
    imagesFolder.file(exportImageName, exportBlob);

    const lines = image.annotations
      .filter((a) => ctx.classMap.has(a.classId))
      .map((a) => {
        const clsIdx = ctx.classMap.get(a.classId) ?? 0;
        const cx = (a.bbox.x + a.bbox.width / 2) / image.width;
        const cy = (a.bbox.y + a.bbox.height / 2) / image.height;
        const w = a.bbox.width / image.width;
        const h = a.bbox.height / image.height;
        return `${clsIdx} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
      })
      .join('\n');

    const labelName = exportImageName.replace(/\.[^.]+$/, '.txt');
    labelsFolder.file(labelName, lines);
  }

  const yaml = [
    'path: .',
    'train: images',
    'val: images',
    '',
    `nc: ${ctx.classes.length}`,
    'names:',
    ...ctx.classes.map((c, idx) => `  ${idx}: '${c.name}'`),
  ].join('\n');

  root.file('data.yaml', yaml);
  writeImageMetadataSidecar(root, ctx, metadataOptions);
}

export function writeCocoDataset(
  root: JSZip,
  ctx: ExportContext,
  imageBlobById: Map<string, Blob>,
  metadataOptions: ExportImageMetadataOptions
): void {
  const imagesFolder = root.folder('images');
  if (!imagesFolder) return;
  for (const image of ctx.images) {
    const exportImageName = ctx.fileNameByImageId.get(image.id) ?? image.name;
    const exportBlob = imageBlobById.get(image.id) ?? image.file;
    imagesFolder.file(exportImageName, exportBlob);
  }

  const round = (v: number, places: number): number => {
    const m = 10 ** places;
    return Math.round(v * m) / m;
  };
  const categories = ctx.classes.map((c, idx) => ({ id: idx + 1, name: c.name }));
  const categoryById = new Map(ctx.classes.map((c, idx) => [c.id, idx + 1]));

  let annId = 1;
  const coco = {
    info: {
      description: `Export of ${ctx.images.length} images`,
      version: '1.0',
      year: new Date().getFullYear(),
      date_created: new Date().toLocaleString('sv-SE'),
    },
    images: ctx.images.map((img, idx) => {
      const base = {
        id: idx + 1,
        file_name: ctx.fileNameByImageId.get(img.id) ?? img.name,
        width: img.width,
        height: img.height,
      };
      if (!metadataOptions.includeOriginalName) return base;
      return {
        ...base,
        original_file_name: getImageMetadataOriginalName(img),
      };
    }),
    categories,
    annotations: ctx.images.flatMap((img, idx) =>
      img.annotations
        .filter((a) => categoryById.has(a.classId))
        .map((a) => ({
          id: annId++,
          image_id: idx + 1,
          category_id: categoryById.get(a.classId),
          bbox: [
            round(a.bbox.x, 2),
            round(a.bbox.y, 2),
            round(a.bbox.width, 2),
            round(a.bbox.height, 2),
          ],
          area: round(a.bbox.width * a.bbox.height, 4),
          iscrowd: 0,
        }))
    ),
  };

  root.file('instances_default.json', JSON.stringify(coco, null, 2));
  writeImageMetadataSidecar(root, ctx, metadataOptions);
}

export function writeVocDataset(
  root: JSZip,
  ctx: ExportContext,
  imageBlobById: Map<string, Blob>,
  metadataOptions: ExportImageMetadataOptions,
  fallbackClassName = 'Unassigned'
): void {
  const imagesFolder = root.folder('images');
  const annotationsFolder = root.folder('annotations');
  if (!imagesFolder || !annotationsFolder) return;

  const classById = new Map(ctx.classes.map((c) => [c.id, c]));
  for (const image of ctx.images) {
    const exportImageName = ctx.fileNameByImageId.get(image.id) ?? image.name;
    const exportBlob = imageBlobById.get(image.id) ?? image.file;
    imagesFolder.file(exportImageName, exportBlob);
    const objects = image.annotations
      .filter((ann) => classById.has(ann.classId))
      .map((ann) => ({
        className: classById.get(ann.classId)?.name ?? fallbackClassName,
        bbox: ann.bbox,
      }));
    const xml = buildVocAnnotationXml(exportImageName, image.width, image.height, objects);
    const xmlName = exportImageName.replace(/\.[^.]+$/, '.xml');
    annotationsFolder.file(xmlName, xml);
  }
  writeImageMetadataSidecar(root, ctx, metadataOptions);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
