import { ImageItem } from '../domain/types';
import { reconcileImageSourcesForSelection } from './imageSources';
import { Snapshot, pushUndoHistory } from './snapshot';

type ImageAppendState = {
  images: ImageItem[];
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
};

type ImageAppendWithDisplayState = ImageAppendState & {
  nextDisplayIdByClass: Record<string, number>;
};

type ImageAppendWithDisplayHistoryState = ImageAppendWithDisplayState & {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  statusText: string | null;
};

type ImageAppendPatch = Pick<
  ImageAppendState,
  'images' | 'selectedImageId' | 'selectedAnnotationId' | 'selectedAnnotationIds'
>;

type ImageAppendWithDisplayPatch = ImageAppendPatch &
  Pick<ImageAppendWithDisplayState, 'nextDisplayIdByClass'>;

type ImageAppendWithDisplayHistoryPatch = ImageAppendWithDisplayPatch & {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  statusText?: string;
};

export function buildAppendedImagesPatch(
  state: ImageAppendState,
  appendedImages: ImageItem[]
): ImageAppendPatch {
  const selectedImageId = state.selectedImageId ?? appendedImages[0]?.id ?? null;
  return {
    images: reconcileImageSourcesForSelection(
      [...state.images, ...appendedImages],
      selectedImageId
    ),
    selectedImageId,
    selectedAnnotationId: state.selectedImageId ? state.selectedAnnotationId : null,
    selectedAnnotationIds: state.selectedImageId ? state.selectedAnnotationIds : [],
  };
}

export function buildNextDisplaySeedsForImages(
  images: ImageItem[]
): Record<string, number> {
  return Object.fromEntries(images.map((img) => [img.id, 1]));
}

export function buildAppendedImagesWithDisplayPatch(
  state: ImageAppendWithDisplayState,
  appendedImages: ImageItem[]
): ImageAppendWithDisplayPatch {
  return {
    ...buildAppendedImagesPatch(state, appendedImages),
    nextDisplayIdByClass: {
      ...state.nextDisplayIdByClass,
      ...buildNextDisplaySeedsForImages(appendedImages),
    },
  };
}

export function buildAppendedImagesWithDisplayHistoryPatch(
  state: ImageAppendWithDisplayHistoryState,
  base: Snapshot,
  appendedImages: ImageItem[],
  statusText?: string
): ImageAppendWithDisplayHistoryPatch {
  return {
    ...buildAppendedImagesWithDisplayPatch(state, appendedImages),
    ...pushUndoHistory(state, base),
    ...(statusText === undefined ? {} : { statusText }),
  };
}
