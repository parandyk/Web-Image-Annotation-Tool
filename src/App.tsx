import { useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { WorkspaceCanvas } from './components/WorkspaceCanvas';
import { useAppStore } from './store/appStore';
import { useSelectedImage } from './store/selectors';
import { Sidebar } from './components/Sidebar';

export default function App(): JSX.Element {
  const initializeDefaults = useAppStore((s) => s.initializeDefaults);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const selectedImage = useSelectedImage();
  const [sidebarTab, setSidebarTab] = useState<'general' | 'images' | 'classes' | 'settings'>('general');

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

  const emptyState = useMemo(
    () => (
      <div className="workspace-empty">
        <h2>No image selected</h2>
        <p>Use Open Images to start annotating.</p>
      </div>
    ),
    []
  );

  return (
    // Main shell: top command bar + workspace/canvas + right sidebar.
    <div className="app-shell">
      <TopBar />
      <div className="main-content">
        <div className="workspace-panel">{selectedImage ? <WorkspaceCanvas image={selectedImage} /> : emptyState}</div>
        <Sidebar tab={sidebarTab} onTabChange={setSidebarTab} />
      </div>
    </div>
  );
}
