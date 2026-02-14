import { useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { WorkspaceCanvas } from './components/WorkspaceCanvas';
import { useAppStore } from './store/appStore';
import { useSelectedImage } from './store/selectors';
import { Sidebar } from './components/Sidebar';
import {
  clearWorkspaceRecoverySnapshot,
  loadWorkspaceRecoverySnapshot,
  saveWorkspaceRecoverySnapshot,
  WorkspaceRecoverySnapshot,
} from './utils/workspaceRecovery';

export default function App(): JSX.Element {
  const initializeDefaults = useAppStore((s) => s.initializeDefaults);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const moveToNextImage = useAppStore((s) => s.moveToNextImage);
  const moveToPrevImage = useAppStore((s) => s.moveToPrevImage);
  const moveToFirstImage = useAppStore((s) => s.moveToFirstImage);
  const moveToLastImage = useAppStore((s) => s.moveToLastImage);
  const moveToNextAnnotation = useAppStore((s) => s.moveToNextAnnotation);
  const moveToPrevAnnotation = useAppStore((s) => s.moveToPrevAnnotation);
  const createRecoverySnapshot = useAppStore((s) => s.createRecoverySnapshot);
  const restoreRecoverySnapshot = useAppStore((s) => s.restoreRecoverySnapshot);
  const images = useAppStore((s) => s.images);
  const classes = useAppStore((s) => s.classes);
  const selectedImage = useSelectedImage();
  const [sidebarTab, setSidebarTab] = useState<'general' | 'images' | 'classes' | 'settings'>('general');
  const [pendingRecovery, setPendingRecovery] = useState<WorkspaceRecoverySnapshot | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const hasWorkspaceStateToLose = useMemo(
    () => images.length > 0 || classes.some((c) => !c.isDefault),
    [classes, images]
  );
  const pendingRecoverySavedAt = useMemo(
    () => (pendingRecovery ? new Date(pendingRecovery.savedAt).toLocaleString() : ''),
    [pendingRecovery]
  );

  // Ensure the fallback class/default view state exists before any user action.
  useEffect(() => {
    initializeDefaults();
  }, [initializeDefaults]);

  // Global undo/redo shortcuts mirror desktop editors on both macOS and non-macOS.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlOrCmd) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'y' && !isMac) || (isMac && key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redo, undo]);

  useEffect(() => {
    // Arrow-key navigation is disabled while typing/editing to avoid hijacking text inputs.
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.modal-backdrop')) return;

      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('input,textarea,select,[contenteditable="true"],.class-hotkey-btn.active')) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) moveToFirstImage();
        else moveToPrevImage();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) moveToLastImage();
        else moveToNextImage();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveToPrevAnnotation();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveToNextAnnotation();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    moveToFirstImage,
    moveToLastImage,
    moveToNextAnnotation,
    moveToNextImage,
    moveToPrevAnnotation,
    moveToPrevImage,
  ]);

  useEffect(() => {
    let cancelled = false;
    const loadRecovery = async (): Promise<void> => {
      try {
        const snapshot = await loadWorkspaceRecoverySnapshot();
        if (!cancelled && snapshot?.version === 1) {
          setPendingRecovery(snapshot);
        }
      } catch {
        // Ignore recovery read errors and continue normal startup.
      } finally {
        if (!cancelled) setRecoveryReady(true);
      }
    };
    void loadRecovery();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recoveryReady || pendingRecovery) return;

    let disposed = false;
    let debounceId: number | null = null;
    let inFlight = false;
    let queued = false;

    const runSave = async (): Promise<void> => {
      if (disposed || inFlight) {
        if (!disposed) queued = true;
        return;
      }
      inFlight = true;
      try {
        const snapshot = createRecoverySnapshot();
        if (snapshot) {
          await saveWorkspaceRecoverySnapshot(snapshot);
        } else {
          await clearWorkspaceRecoverySnapshot();
        }
      } catch {
        // Best-effort persistence only; failures should not break app interaction.
      } finally {
        inFlight = false;
        if (queued && !disposed) {
          queued = false;
          schedule(900);
        }
      }
    };

    const schedule = (delayMs = 1400): void => {
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
      }
      debounceId = window.setTimeout(() => {
        debounceId = null;
        void runSave();
      }, delayMs);
    };

    const unsubscribe = useAppStore.subscribe(() => {
      schedule();
    });

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        schedule(0);
      }
    };

    const onPageHide = (): void => {
      schedule(0);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    // Capture current workspace immediately once autosave is active.
    schedule(0);
    return () => {
      disposed = true;
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
      }
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [createRecoverySnapshot, pendingRecovery, recoveryReady]);

  useEffect(() => {
    if (!hasWorkspaceStateToLose) return;

    const onBeforeUnload = (event: BeforeUnloadEvent): string => {
      // Native browser warning helps prevent accidental refresh/close data loss.
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasWorkspaceStateToLose]);

  const emptyState = useMemo(
    () => (
      <div className="workspace-empty">
        <h2>No image selected</h2>
        <p>Use Open Images to start annotating.</p>
      </div>
    ),
    []
  );

  const restorePendingRecovery = (): void => {
    if (!pendingRecovery) return;
    restoreRecoverySnapshot(pendingRecovery);
    setPendingRecovery(null);
  };

  const discardPendingRecovery = async (): Promise<void> => {
    try {
      await clearWorkspaceRecoverySnapshot();
    } finally {
      setPendingRecovery(null);
    }
  };

  return (
    // Main shell: top command bar + workspace/canvas + right sidebar.
    <div className="app-shell">
      <TopBar />
      <div className="main-content">
        <div className="workspace-panel">{selectedImage ? <WorkspaceCanvas image={selectedImage} /> : emptyState}</div>
        <Sidebar tab={sidebarTab} onTabChange={setSidebarTab} />
      </div>
      {pendingRecovery && (
        <div className="modal-backdrop">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h3>Restore workspace</h3>
            <p>
              A previously saved workspace state was found
              {pendingRecoverySavedAt ? ` (${pendingRecoverySavedAt})` : ''}.
              Restore it?
            </p>
            <div className="row dialog-actions">
              <button onClick={() => void discardPendingRecovery()}>Discard</button>
              <button onClick={restorePendingRecovery}>Restore</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
