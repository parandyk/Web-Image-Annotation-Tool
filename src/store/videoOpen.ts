import { ImageItem } from '../domain/types';
import { uid } from '../utils/id';
import { extractVideoFrames, VideoParseOptions } from '../utils/video';
import { toUniqueName } from './classImageHelpers';

type OpenVideoFramesFailure = {
  ok: false;
  statusText: string;
};

type OpenVideoFramesSuccess = {
  ok: true;
  images: ImageItem[];
  statusText: string;
};

export type OpenVideoFramesResult = OpenVideoFramesFailure | OpenVideoFramesSuccess;

export async function parseOpenVideoFramesPayload(
  file: File,
  options: VideoParseOptions,
  existingImages: ImageItem[],
  onProgress?: (done: number, total: number) => void
): Promise<OpenVideoFramesResult> {
  let parsed: Awaited<ReturnType<typeof extractVideoFrames>>;
  try {
    parsed = await extractVideoFrames(file, options, onProgress);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, statusText: `Video parsing failed: ${message}` };
  }

  if (parsed.frames.length === 0) {
    return { ok: false, statusText: 'No frames were extracted from the selected video.' };
  }

  const videoId = uid('video');
  const takenNames = new Set(existingImages.map((img) => img.name));
  const images: ImageItem[] = parsed.frames.map((frame) => {
    const name = toUniqueName(frame.file.name, takenNames);
    return {
      id: uid('img'),
      name,
      file: frame.file,
      src: '',
      width: parsed.probe.width,
      height: parsed.probe.height,
      isBookmarked: false,
      annotations: [],
      sourceKind: 'videoFrame',
      videoMeta: {
        videoId,
        videoName: file.name,
        sourceFps: options.sourceFps,
        sourceDurationMs: Math.round(parsed.probe.durationSec * 1000),
        frameIndex: frame.frameIndex,
        timestampMs: frame.timestampMs,
      },
    };
  });

  return {
    ok: true,
    images,
    statusText: `Imported ${images.length} frames from "${file.name}".`,
  };
}
