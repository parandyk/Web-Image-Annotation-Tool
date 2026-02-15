import { ImageItem } from '../domain/types';
import { uid } from '../utils/id';
import { isSupportedImageFileName } from './directoryEntries';
import { getImageDimensionsWithRetry } from './imageDecode';
import { toUniqueName } from './classImageHelpers';

type OpenImagesFailure = {
  ok: false;
  statusText: string;
};

type OpenImagesSuccess = {
  ok: true;
  images: ImageItem[];
  statusText: string | null;
};

export type OpenImagesResult = OpenImagesFailure | OpenImagesSuccess;

export async function parseOpenImagesPayload(
  files: File[],
  existingImages: ImageItem[]
): Promise<OpenImagesResult> {
  const supportedFiles = files.filter((f) => isSupportedImageFileName(f.name));
  const skippedUnsupportedCount = files.length - supportedFiles.length;
  if (supportedFiles.length === 0) {
    return { ok: false, statusText: 'No supported image files selected.' };
  }

  const takenNames = new Set(existingImages.map((i) => i.name));
  const newImages: ImageItem[] = [];
  const failedNames: string[] = [];
  for (const file of supportedFiles) {
    try {
      const dims = await getImageDimensionsWithRetry(file, 3);
      newImages.push({
        id: uid('img'),
        name: toUniqueName(file.name, takenNames),
        file,
        src: '',
        width: dims.width,
        height: dims.height,
        isBookmarked: false,
        annotations: [],
        sourceKind: 'image',
      });
    } catch {
      failedNames.push(file.name);
    }
  }

  if (newImages.length === 0) {
    const openFailure =
      failedNames.length === 1
        ? `Couldn't open "${failedNames[0]}".`
        : `Couldn't open ${failedNames.length} selected images.`;
    if (skippedUnsupportedCount > 0) {
      return {
        ok: false,
        statusText: `${openFailure} Skipped ${skippedUnsupportedCount} unsupported file${skippedUnsupportedCount === 1 ? '' : 's'}.`,
      };
    }
    return { ok: false, statusText: openFailure };
  }

  const partialFailureStatus =
    failedNames.length > 0
      ? `Opened ${newImages.length}/${supportedFiles.length} images. ${failedNames.length} failed to decode.`
      : skippedUnsupportedCount > 0
        ? `Opened ${newImages.length} images. Skipped ${skippedUnsupportedCount} unsupported file${skippedUnsupportedCount === 1 ? '' : 's'}.`
        : null;

  return { ok: true, images: newImages, statusText: partialFailureStatus };
}
