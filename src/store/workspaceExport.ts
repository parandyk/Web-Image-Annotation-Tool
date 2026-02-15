import JSZip from 'jszip';
import type { AppState } from './appStore.types';
import { toUniqueName } from './classImageHelpers';
import { buildWorkspaceExportPayload } from './workspaceSerialization';

export async function createWorkspaceExportArchive(
  state: AppState
): Promise<{ blob: Blob; fileName: string } | null> {
  const zip = new JSZip();
  const imagesFolder = zip.folder('images');
  if (!imagesFolder) return null;

  const imageFileNameById: Record<string, string> = {};
  const usedNames = new Set<string>();
  for (const image of state.images) {
    const uniqueName = toUniqueName(image.name, usedNames);
    imageFileNameById[image.id] = uniqueName;
    imagesFolder.file(uniqueName, image.file);
  }

  const payload = buildWorkspaceExportPayload(state, imageFileNameById);
  zip.file('workspace_state.json', JSON.stringify(payload, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, fileName: `workspace_state_${Date.now()}.zip` };
}

