export type VideoProbe = {
  durationSec: number;
  width: number;
  height: number;
};

export type VideoSamplingMode = 'everyN' | 'fps';

export type VideoParseOptions = {
  sourceFps: number;
  startFrame: number;
  endFrame: number;
  samplingMode: VideoSamplingMode;
  everyNFrames: number;
  targetFps: number;
  maxFrames: number;
  imageType: 'image/jpeg' | 'image/png';
  jpegQuality: number;
};

export type ExtractedVideoFrame = {
  file: File;
  frameIndex: number;
  timestampMs: number;
};

export type VideoExtractionResult = {
  probe: VideoProbe;
  frames: ExtractedVideoFrame[];
};

export const DEFAULT_VIDEO_PARSE_OPTIONS: VideoParseOptions = {
  sourceFps: 30,
  startFrame: 0,
  endFrame: 299,
  samplingMode: 'everyN',
  everyNFrames: 1,
  targetFps: 2,
  maxFrames: 300,
  imageType: 'image/jpeg',
  jpegQuality: 0.92,
};

const FFMPEG_ESM_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
const FFMPEG_UTIL_ESM_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';
const FFMPEG_CORE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';

type FfmpegRuntime = {
  ffmpeg: {
    load: (config: Record<string, string>) => Promise<void>;
    writeFile: (path: string, data: Uint8Array) => Promise<void>;
    exec: (args: string[]) => Promise<number | void>;
    readFile: (path: string) => Promise<Uint8Array | ArrayBuffer | number[]>;
    deleteFile?: (path: string) => Promise<void>;
  };
  fetchFile: (input: File | Blob | ArrayBuffer | Uint8Array | string) => Promise<Uint8Array>;
};

let ffmpegRuntimePromise: Promise<FfmpegRuntime> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

async function importFromCdn(url: string): Promise<Record<string, unknown>> {
  return import(/* @vite-ignore */ url);
}

function sanitizeOptions(options: VideoParseOptions, totalFrames: number): VideoParseOptions {
  const maxIndex = Math.max(0, totalFrames - 1);
  const sourceFps = clamp(Number.isFinite(options.sourceFps) ? options.sourceFps : 30, 1, 240);
  const startFrame = clamp(Math.floor(options.startFrame), 0, maxIndex);
  const endFrame = clamp(Math.floor(options.endFrame), startFrame, maxIndex);
  const everyNFrames = clamp(Math.floor(options.everyNFrames), 1, 10000);
  const targetFps = clamp(options.targetFps, 0.1, 120);
  const maxFrames = clamp(Math.floor(options.maxFrames), 1, 2000);
  const jpegQuality = clamp(options.jpegQuality, 0.4, 1);
  return {
    ...options,
    sourceFps,
    startFrame,
    endFrame,
    everyNFrames,
    targetFps,
    maxFrames,
    jpegQuality,
  };
}

function buildFrameIndices(options: VideoParseOptions): number[] {
  const start = options.startFrame;
  const end = options.endFrame;
  let frameIndices: number[] = [];

  if (options.samplingMode === 'everyN') {
    for (let frame = start; frame <= end; frame += options.everyNFrames) {
      frameIndices.push(frame);
    }
  } else {
    const startSec = start / options.sourceFps;
    const endSec = end / options.sourceFps;
    const stepSec = 1 / options.targetFps;
    const raw: number[] = [];
    for (let t = startSec; t <= endSec + 1e-9; t += stepSec) {
      raw.push(Math.round(t * options.sourceFps));
    }
    frameIndices = raw.filter((idx) => idx >= start && idx <= end);
  }

  frameIndices = Array.from(new Set(frameIndices));
  frameIndices.sort((a, b) => a - b);
  return downsampleIndices(frameIndices, options.maxFrames);
}

function makeVideoElement(src: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  return video;
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const onLoaded = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error('Could not read video metadata.'));
    };
    const cleanup = (): void => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error('Video seek failed.'));
    };
    const cleanup = (): void => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = Math.max(0, timeSec);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, imageType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Frame encoding failed.'));
          return;
        }
        resolve(blob);
      },
      imageType,
      quality
    );
  });
}

function downsampleIndices(indices: number[], targetCount: number): number[] {
  if (indices.length <= targetCount) return indices;
  if (targetCount <= 1) return [indices[0]];
  const out: number[] = [];
  const last = indices.length - 1;
  for (let i = 0; i < targetCount; i += 1) {
    const pos = (i / (targetCount - 1)) * last;
    out.push(indices[Math.round(pos)]);
  }
  return Array.from(new Set(out));
}

function toUint8Array(data: Uint8Array | ArrayBuffer | number[]): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  throw new Error('Unexpected FFmpeg output format.');
}

function toPlainArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function safeDeleteFile(ffmpeg: FfmpegRuntime['ffmpeg'], fileName: string): Promise<void> {
  if (!ffmpeg.deleteFile) return;
  try {
    await ffmpeg.deleteFile(fileName);
  } catch {
    // Best effort cleanup only.
  }
}

async function loadFfmpegRuntime(): Promise<FfmpegRuntime> {
  if (ffmpegRuntimePromise) return ffmpegRuntimePromise;

  ffmpegRuntimePromise = (async () => {
    const ffmpegModule = await withTimeout(
      importFromCdn(FFMPEG_ESM_URL),
      15000,
      'Timed out while loading FFmpeg module.'
    );
    const utilModule = await withTimeout(
      importFromCdn(FFMPEG_UTIL_ESM_URL),
      15000,
      'Timed out while loading FFmpeg utility module.'
    );

    const FFmpegCtor = ffmpegModule.FFmpeg as (new () => FfmpegRuntime['ffmpeg']) | undefined;
    const fetchFile = utilModule.fetchFile as FfmpegRuntime['fetchFile'] | undefined;
    const toBlobURL = utilModule.toBlobURL as ((url: string, mimeType: string) => Promise<string>) | undefined;

    if (!FFmpegCtor || !fetchFile || !toBlobURL) {
      throw new Error('FFmpeg module exports are unavailable.');
    }

    const ffmpeg = new FFmpegCtor();
    const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');

    let workerURL: string | undefined;
    try {
      workerURL = await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript');
    } catch {
      workerURL = undefined;
    }

    const loadConfig: Record<string, string> = { coreURL, wasmURL };
    if (workerURL) loadConfig.workerURL = workerURL;
    await withTimeout(ffmpeg.load(loadConfig), 30000, 'Timed out while initializing FFmpeg core.');

    return { ffmpeg, fetchFile };
  })().catch((error) => {
    // Reset cache when initialization fails so a later call can retry.
    ffmpegRuntimePromise = null;
    throw error;
  });

  return ffmpegRuntimePromise;
}

export function estimateExtractedFrameCount(probe: VideoProbe, rawOptions: VideoParseOptions): number {
  const totalFrames = Math.max(1, Math.floor(probe.durationSec * rawOptions.sourceFps));
  const options = sanitizeOptions(rawOptions, totalFrames);
  const indices = buildFrameIndices(options);
  return indices.length;
}

export async function probeVideoFile(file: File): Promise<VideoProbe> {
  const src = URL.createObjectURL(file);
  const video = makeVideoElement(src);
  try {
    await waitForMetadata(video);
    const durationSec = Number.isFinite(video.duration) ? Math.max(video.duration, 0) : 0;
    const width = Math.max(1, Math.floor(video.videoWidth || 0));
    const height = Math.max(1, Math.floor(video.videoHeight || 0));
    if (!durationSec || !width || !height) {
      throw new Error('Video metadata is incomplete.');
    }
    return { durationSec, width, height };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(src);
  }
}

async function extractVideoFramesWithFfmpeg(
  file: File,
  rawOptions: VideoParseOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<VideoExtractionResult> {
  const probe = await probeVideoFile(file);
  const totalSourceFrames = Math.max(1, Math.floor(probe.durationSec * rawOptions.sourceFps));
  const options = sanitizeOptions(rawOptions, totalSourceFrames);
  const frameIndices = buildFrameIndices(options);
  if (frameIndices.length === 0) {
    return { probe, frames: [] };
  }

  const runtime = await loadFfmpegRuntime();
  const ffmpeg = runtime.ffmpeg;

  const ext = options.imageType === 'image/png' ? 'png' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '');
  const inputExtMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const inputExt = inputExtMatch ? inputExtMatch[1].toLowerCase() : 'mp4';
  const inputName = `video_input.${inputExt}`;
  const outputPattern = `frame_%06d.${ext}`;

  await ffmpeg.writeFile(inputName, await runtime.fetchFile(file));

  const startSec = options.startFrame / options.sourceFps;
  const endSec = (options.endFrame + 1) / options.sourceFps;
  const samplingFps =
    options.samplingMode === 'everyN' ? options.sourceFps / options.everyNFrames : options.targetFps;
  const effectiveFps = clamp(samplingFps, 0.01, 240);

  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    String(startSec),
    '-to',
    String(endSec),
    '-i',
    inputName,
    '-vf',
    `fps=${effectiveFps}`,
    '-frames:v',
    String(options.maxFrames),
  ];
  if (ext === 'jpg') {
    args.push('-q:v', '2');
  }
  args.push(outputPattern);

  await ffmpeg.exec(args);

  const frames: ExtractedVideoFrame[] = [];
  const totalExpected = frameIndices.length;

  for (let i = 0; i < totalExpected; i += 1) {
    const sequenceIndex = i + 1;
    const outputName = `frame_${String(sequenceIndex).padStart(6, '0')}.${ext}`;
    let rawData: Uint8Array | ArrayBuffer | number[];
    try {
      rawData = await ffmpeg.readFile(outputName);
    } catch {
      break;
    }

    const bytes = toUint8Array(rawData);
    const blob = new Blob([toPlainArrayBuffer(bytes)], { type: options.imageType });
    const frameIndex = frameIndices[i];
    const frameName = `${base}_f${String(frameIndex).padStart(6, '0')}.${ext}`;
    const frameFile = new File([blob], frameName, {
      type: options.imageType,
      lastModified: Date.now(),
    });

    frames.push({
      file: frameFile,
      frameIndex,
      timestampMs: Math.round((frameIndex / options.sourceFps) * 1000),
    });
    onProgress?.(frames.length, totalExpected);
  }

  await safeDeleteFile(ffmpeg, inputName);
  for (let i = 0; i < totalExpected; i += 1) {
    const sequenceIndex = i + 1;
    const outputName = `frame_${String(sequenceIndex).padStart(6, '0')}.${ext}`;
    await safeDeleteFile(ffmpeg, outputName);
  }

  if (frames.length === 0) {
    throw new Error('FFmpeg produced no extracted frames.');
  }

  return { probe, frames };
}

async function extractVideoFramesNative(
  file: File,
  rawOptions: VideoParseOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<VideoExtractionResult> {
  const src = URL.createObjectURL(file);
  const video = makeVideoElement(src);

  try {
    await waitForMetadata(video);
    const probe: VideoProbe = {
      durationSec: Number.isFinite(video.duration) ? Math.max(video.duration, 0) : 0,
      width: Math.max(1, Math.floor(video.videoWidth || 0)),
      height: Math.max(1, Math.floor(video.videoHeight || 0)),
    };
    if (!probe.durationSec || !probe.width || !probe.height) {
      throw new Error('Video metadata is incomplete.');
    }

    const totalSourceFrames = Math.max(1, Math.floor(probe.durationSec * rawOptions.sourceFps));
    const options = sanitizeOptions(rawOptions, totalSourceFrames);
    const frameIndices = buildFrameIndices(options);

    const canvas = document.createElement('canvas');
    canvas.width = probe.width;
    canvas.height = probe.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot initialize canvas context.');
    }

    const ext = options.imageType === 'image/png' ? 'png' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '');
    const frames: ExtractedVideoFrame[] = [];
    const total = frameIndices.length;

    for (let i = 0; i < frameIndices.length; i += 1) {
      const frameIndex = frameIndices[i];
      const timeSec = clamp(frameIndex / options.sourceFps, 0, Math.max(0, probe.durationSec - 0.001));
      await seekTo(video, timeSec);
      ctx.drawImage(video, 0, 0, probe.width, probe.height);
      const blob = await canvasToBlob(canvas, options.imageType, options.jpegQuality);
      const frameName = `${base}_f${String(frameIndex).padStart(6, '0')}.${ext}`;
      const frameFile = new File([blob], frameName, {
        type: options.imageType,
        lastModified: Date.now(),
      });
      frames.push({
        file: frameFile,
        frameIndex,
        timestampMs: Math.round(timeSec * 1000),
      });
      onProgress?.(i + 1, total);
    }

    return { probe, frames };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(src);
  }
}

export async function extractVideoFrames(
  file: File,
  rawOptions: VideoParseOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<VideoExtractionResult> {
  // Hybrid path: try ffmpeg first, then gracefully fallback to native browser decode.
  try {
    return await withTimeout(
      extractVideoFramesWithFfmpeg(file, rawOptions, onProgress),
      18000,
      'FFmpeg extraction attempt timed out.'
    );
  } catch {
    return extractVideoFramesNative(file, rawOptions, onProgress);
  }
}
