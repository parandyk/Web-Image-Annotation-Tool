import { Annotation, ClassData, ImageSourceKind, VideoFrameMeta } from '../domain/types';

const RECOVERY_DB_NAME = 'image-annotation-tool-recovery';
const RECOVERY_DB_VERSION = 1;
const RECOVERY_STORE = 'snapshots';
const RECOVERY_KEY = 'latest';

export type WorkspaceRecoveryViewState = {
  interactionMode: 'add' | 'edit';
  addingMode: 'click' | 'drag';
  classAssignmentMode: 'activeClass' | 'deferred';
  fastClassSwapMode: boolean;
  imageSort:
    | 'none'
    | 'alphabetical'
    | 'reversedAlphabetical'
    | 'largestFirst'
    | 'smallestFirst'
    | 'mostAnnotations'
    | 'fewestAnnotations';
  imageFilter: 'none' | 'hideAnnotated' | 'hideUnannotated' | 'hideBookmarked' | 'hideUnbookmarked';
  imageClassFilterMode: 'none' | 'hasAny' | 'hasAll' | 'hasNone';
  imageClassFilterClassIds: string[];
  annotationSort:
    | 'none'
    | 'oldest'
    | 'newest'
    | 'alphabetical'
    | 'reversedAlphabetical'
    | 'largestFirst'
    | 'smallestFirst';
  annotationFilter: 'none' | 'hideAssigned' | 'hideUnassigned';
  classSort: 'none' | 'alphabetical' | 'reversedAlphabetical' | 'countAscending' | 'countDescending';
  classFilter: 'none' | 'hideUsed' | 'hideUnused';
  suppressUnassignedExportWarningDialog: boolean;
  suppressDeleteAnnotationWarningDialog: boolean;
  suppressDeleteImageWarningDialog: boolean;
  suppressRemoveClassInstancesWarningDialog: boolean;
  exportIncludeUnassigned: boolean;
  showLabels: boolean;
  showOnlySelectedThumbs: boolean;
  bboxOpacity: number;
  lineThickness: number;
  drawBoxFill: boolean;
  drawBoxBorder: boolean;
  showCrosshair: boolean;
  showMinimap: boolean;
  minimapLocation: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'sidebar';
  dragDeadzonePx: number;
  inferenceEnabled: boolean;
  inferenceConfidenceThreshold: number;
  inferenceModelUrl: string;
};

export type WorkspaceRecoveryImage = {
  id: string;
  name: string;
  file: File;
  width: number;
  height: number;
  isBookmarked: boolean;
  annotations: Annotation[];
  sourceKind?: ImageSourceKind;
  videoMeta?: VideoFrameMeta;
};

export type WorkspaceRecoverySnapshot = {
  version: 1;
  savedAt: string;
  settings: WorkspaceRecoveryViewState;
  classes: ClassData[];
  images: WorkspaceRecoveryImage[];
  selectedClassId: string;
  selectedImageId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  nextDisplayIdByClass: Record<string, number>;
};

type RecoveryRecord = {
  id: typeof RECOVERY_KEY;
  snapshot: WorkspaceRecoverySnapshot;
};

function openRecoveryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RECOVERY_DB_NAME, RECOVERY_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECOVERY_STORE)) {
        db.createObjectStore(RECOVERY_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open recovery database.'));
  });
}

function runTransaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECOVERY_STORE, mode);
    const store = tx.objectStore(RECOVERY_STORE);
    action(store, resolve, reject);
  });
}

export async function saveWorkspaceRecoverySnapshot(snapshot: WorkspaceRecoverySnapshot): Promise<void> {
  const db = await openRecoveryDb();
  try {
    await runTransaction<void>(db, 'readwrite', (store, resolve, reject) => {
      const req = store.put({ id: RECOVERY_KEY, snapshot } satisfies RecoveryRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to persist workspace recovery snapshot.'));
    });
  } finally {
    db.close();
  }
}

export async function loadWorkspaceRecoverySnapshot(): Promise<WorkspaceRecoverySnapshot | null> {
  const db = await openRecoveryDb();
  try {
    return await runTransaction<WorkspaceRecoverySnapshot | null>(db, 'readonly', (store, resolve, reject) => {
      const req = store.get(RECOVERY_KEY);
      req.onsuccess = () => {
        const value = req.result as RecoveryRecord | undefined;
        resolve(value?.snapshot ?? null);
      };
      req.onerror = () => reject(req.error ?? new Error('Failed to read workspace recovery snapshot.'));
    });
  } finally {
    db.close();
  }
}

export async function clearWorkspaceRecoverySnapshot(): Promise<void> {
  const db = await openRecoveryDb();
  try {
    await runTransaction<void>(db, 'readwrite', (store, resolve, reject) => {
      const req = store.delete(RECOVERY_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('Failed to clear workspace recovery snapshot.'));
    });
  } finally {
    db.close();
  }
}
