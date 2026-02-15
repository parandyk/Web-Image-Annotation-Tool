export type DirectoryEntry = {
  file: File;
  relPath: string;
  relPathLower: string;
  nameLower: string;
  baseNameLower: string;
  extLower: string;
};

const IMAGE_FILE_RE = /\.(jpg|jpeg|png|bmp|tiff|tif|webp)$/i;

export function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function basenameWithoutExt(path: string): string {
  return basename(path).replace(/\.[^.]+$/, '');
}

function fileRelativePath(file: File): string {
  const withRelative = file as File & { webkitRelativePath?: string };
  return (withRelative.webkitRelativePath || file.name).replace(/\\/g, '/').replace(/^\.?\//, '');
}

export function toDirectoryEntries(files: File[]): DirectoryEntry[] {
  // Keep both original relative paths and lowercase variants for robust dataset matching.
  return files.map((file) => {
    const relPath = fileRelativePath(file);
    const relPathLower = relPath.toLowerCase();
    const name = basename(relPath);
    const extIdx = name.lastIndexOf('.');
    return {
      file,
      relPath,
      relPathLower,
      nameLower: name.toLowerCase(),
      baseNameLower: basenameWithoutExt(name).toLowerCase(),
      extLower: extIdx >= 0 ? name.slice(extIdx).toLowerCase() : '',
    };
  });
}

export function isImageEntry(entry: DirectoryEntry): boolean {
  return isSupportedImageFileName(entry.nameLower);
}

export function isSupportedImageFileName(name: string): boolean {
  return IMAGE_FILE_RE.test(name.toLowerCase());
}
