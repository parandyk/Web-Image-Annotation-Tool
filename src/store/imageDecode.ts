export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(src);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(src);
      reject(error);
    };
    image.src = src;
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function getImageDimensionsWithRetry(file: File, attempts = 3): Promise<{ width: number; height: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await getImageDimensions(file);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(120 * attempt);
      }
    }
  }
  throw lastError ?? new Error('Image decode failed');
}
