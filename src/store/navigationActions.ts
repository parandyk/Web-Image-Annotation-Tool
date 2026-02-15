import { buildSingleAnnotationSelection } from './annotationSelection';
import {
  resolveAdjacentAnnotationId,
  resolveAdjacentImageId,
  resolveBoundaryImageId,
} from './navigationSelection';
import { AppState } from './appStore.types';
import { AppStoreGet, AppStoreSet } from './storeActionTypes';

type NavigationActionKeys =
  | 'moveToNextImage'
  | 'moveToPrevImage'
  | 'moveToFirstImage'
  | 'moveToLastImage'
  | 'moveToNextAnnotation'
  | 'moveToPrevAnnotation';

export function createNavigationActions(
  set: AppStoreSet,
  get: AppStoreGet
): Pick<AppState, NavigationActionKeys> {
  return {
    moveToNextImage: () => {
      const state = get();
      const nextId = resolveAdjacentImageId(
        state.images,
        state.selectedImageId,
        'next'
      );
      if (!nextId) return;
      get().selectImage(nextId);
    },

    moveToPrevImage: () => {
      const state = get();
      const prevId = resolveAdjacentImageId(
        state.images,
        state.selectedImageId,
        'prev'
      );
      if (!prevId) return;
      get().selectImage(prevId);
    },

    moveToFirstImage: () => {
      const state = get();
      const firstId = resolveBoundaryImageId(state.images, 'first');
      if (!firstId) return;
      get().selectImage(firstId);
    },

    moveToLastImage: () => {
      const state = get();
      const lastId = resolveBoundaryImageId(state.images, 'last');
      if (!lastId) return;
      get().selectImage(lastId);
    },

    moveToNextAnnotation: () => {
      const state = get();
      const nextId = resolveAdjacentAnnotationId(
        state.images,
        state.selectedImageId,
        state.selectedAnnotationId,
        'next'
      );
      if (!nextId) return;
      set(buildSingleAnnotationSelection(nextId));
    },

    moveToPrevAnnotation: () => {
      const state = get();
      const prevId = resolveAdjacentAnnotationId(
        state.images,
        state.selectedImageId,
        state.selectedAnnotationId,
        'prev'
      );
      if (!prevId) return;
      set(buildSingleAnnotationSelection(prevId));
    },
  };
}
