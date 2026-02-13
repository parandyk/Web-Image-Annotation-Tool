export async function pickImageFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    // Use native file picker to keep browser compatibility and avoid custom drag/drop glue.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.bmp,.tiff';
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

export async function pickSingleTextLikeFile(): Promise<File | null> {
  return new Promise((resolve) => {
    // Used for class import and other single metadata files.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.names,.yaml,.json,.xml';
    input.multiple = false;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export async function pickDirectoryFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    // `webkitdirectory` returns all files with relative paths for dataset/workspace imports.
    const input = document.createElement('input') as HTMLInputElement & {
      webkitdirectory?: boolean;
      directory?: boolean;
    };
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.directory = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
