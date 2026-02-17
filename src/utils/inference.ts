import type { BBox } from '../domain/types';

const ORT_VERSION = '1.24.1';
const ORT_DIST_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist`;
const ORT_ESM_URL = `${ORT_DIST_BASE}/ort.min.mjs`;
const NMS_ENABLED = true;
const NMS_CLASS_AGNOSTIC = true; // Proposal-only mode maps detections to fallback class, so cross-class dedup is desired.

type NumericArray =
  | Float32Array
  | Float64Array
  | Int32Array
  | Int16Array
  | Int8Array
  | Uint32Array
  | Uint16Array
  | Uint8Array;

type OrtTensorLike = {
  data: NumericArray;
  dims: readonly number[];
};

type OrtSessionLike = {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, OrtTensorLike>) => Promise<Record<string, OrtTensorLike>>;
  inputMetadata?: Record<string, { dimensions?: Array<number | string | null | undefined> }>;
};

type OrtRuntimeLike = {
  env?: {
    wasm?: {
      wasmPaths?: string | Record<string, string>;
    };
  };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => OrtTensorLike;
  InferenceSession: {
    create: (modelUrl: string, options?: Record<string, unknown>) => Promise<OrtSessionLike>;
  };
};

type CandidateMatrix = {
  candidateCount: number;
  featureCount: number;
  get: (candidateIdx: number, featureIdx: number) => number;
};

type RawDetection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
  classIndex: number;
};

type ModelInputShape = {
  layout: 'nchw' | 'nhwc';
  inputWidth: number;
  inputHeight: number;
  tensorDims: number[];
};

type PreprocessResult = ModelInputShape & {
  tensorData: Float32Array;
  originalWidth: number;
  originalHeight: number;
  letterboxScale: number;
  letterboxPadX: number;
  letterboxPadY: number;
};

export type InferenceCandidate = {
  bbox: BBox;
  score: number;
  classIndex: number;
};

export type RunImageInferenceOptions = {
  modelUrl: string;
  confidenceThreshold: number;
  classCountHint?: number;
  iouThreshold?: number;
  maxDetections?: number;
  defaultInputSize?: number;
};

export type InferenceRunResult = {
  detections: InferenceCandidate[];
  durationMs: number;
};

export type InferenceModelValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

let ortRuntimePromise: Promise<OrtRuntimeLike> | null = null;
const sessionPromiseByModelUrl = new Map<string, Promise<OrtSessionLike>>();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
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

function toPositiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const floored = Math.floor(value);
  return floored > 0 ? floored : null;
}

function normalizeThreshold(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return clamp(value, 0, 1);
}

function toFloat32Array(data: NumericArray): Float32Array {
  if (data instanceof Float32Array) return data;
  return Float32Array.from(data);
}

function importFromCdn(url: string): Promise<Record<string, unknown>> {
  return import(/* @vite-ignore */ url);
}

function isTensorLike(value: unknown): value is OrtTensorLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OrtTensorLike>;
  return Array.isArray(candidate.dims) && Boolean(candidate.data);
}

async function loadOrtRuntime(): Promise<OrtRuntimeLike> {
  if (ortRuntimePromise) return ortRuntimePromise;

  ortRuntimePromise = (async () => {
    const module = await withTimeout(importFromCdn(ORT_ESM_URL), 15000, 'Timed out while loading ONNX runtime module.');
    const runtime = module as unknown as Partial<OrtRuntimeLike>;
    if (!runtime.InferenceSession || !runtime.Tensor) {
      throw new Error('ONNX runtime module did not expose expected exports.');
    }

    if (runtime.env?.wasm) {
      runtime.env.wasm.wasmPaths = `${ORT_DIST_BASE}/`;
    }

    return runtime as OrtRuntimeLike;
  })().catch((error) => {
    ortRuntimePromise = null;
    throw error;
  });

  return ortRuntimePromise;
}

async function getSession(modelUrl: string): Promise<OrtSessionLike> {
  const normalizedModelUrl = modelUrl.trim();
  let sessionPromise = sessionPromiseByModelUrl.get(normalizedModelUrl);
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await loadOrtRuntime();
      return withTimeout(
        ort.InferenceSession.create(normalizedModelUrl, { executionProviders: ['wasm'] }),
        30000,
        'Timed out while loading the ONNX model.'
      );
    })();
    sessionPromiseByModelUrl.set(normalizedModelUrl, sessionPromise);
  }

  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromiseByModelUrl.delete(normalizedModelUrl);
    throw error;
  }
}

function resolveModelInputShape(session: OrtSessionLike, defaultInputSize: number): ModelInputShape {
  const fallbackSize = clamp(Math.floor(defaultInputSize), 64, 2048);
  const inputName = session.inputNames[0];
  const dimensions = inputName ? session.inputMetadata?.[inputName]?.dimensions : undefined;

  let layout: 'nchw' | 'nhwc' = 'nchw';
  let inputWidth = fallbackSize;
  let inputHeight = fallbackSize;

  if (Array.isArray(dimensions) && dimensions.length >= 4) {
    const d1 = toPositiveInt(dimensions[1]);
    const d2 = toPositiveInt(dimensions[2]);
    const d3 = toPositiveInt(dimensions[3]);

    if (d3 === 3 || d3 === 1) {
      layout = 'nhwc';
      inputHeight = d1 ?? fallbackSize;
      inputWidth = d2 ?? fallbackSize;
    } else {
      layout = 'nchw';
      inputHeight = d2 ?? fallbackSize;
      inputWidth = d3 ?? fallbackSize;
    }
  }

  inputWidth = clamp(Math.floor(inputWidth), 64, 4096);
  inputHeight = clamp(Math.floor(inputHeight), 64, 4096);
  const tensorDims = layout === 'nchw' ? [1, 3, inputHeight, inputWidth] : [1, inputHeight, inputWidth, 3];

  return {
    layout,
    inputWidth,
    inputHeight,
    tensorDims,
  };
}

async function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; cleanup: () => void }> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';

  await new Promise<void>((resolve, reject) => {
    const onLoad = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error(`Failed to decode image "${file.name}".`));
    };
    const cleanup = (): void => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    };

    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    image.src = objectUrl;
  });

  return {
    image,
    cleanup: () => {
      image.removeAttribute('src');
      URL.revokeObjectURL(objectUrl);
    },
  };
}

async function preprocessImage(file: File, shape: ModelInputShape): Promise<PreprocessResult> {
  const { image, cleanup } = await loadImageFromFile(file);
  try {
    const originalWidth = Math.max(1, Math.floor(image.naturalWidth || image.width || 1));
    const originalHeight = Math.max(1, Math.floor(image.naturalHeight || image.height || 1));

    const letterboxScale = Math.min(shape.inputWidth / originalWidth, shape.inputHeight / originalHeight);
    const drawWidth = Math.max(1, Math.round(originalWidth * letterboxScale));
    const drawHeight = Math.max(1, Math.round(originalHeight * letterboxScale));
    const letterboxPadX = (shape.inputWidth - drawWidth) / 2;
    const letterboxPadY = (shape.inputHeight - drawHeight) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = shape.inputWidth;
    canvas.height = shape.inputHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to create image preprocessing canvas context.');
    }

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, shape.inputWidth, shape.inputHeight);
    ctx.drawImage(image, 0, 0, originalWidth, originalHeight, letterboxPadX, letterboxPadY, drawWidth, drawHeight);

    const pixels = ctx.getImageData(0, 0, shape.inputWidth, shape.inputHeight).data;
    const pixelCount = shape.inputWidth * shape.inputHeight;
    const tensorData = new Float32Array(pixelCount * 3);

    if (shape.layout === 'nchw') {
      for (let i = 0; i < pixelCount; i += 1) {
        const offset = i * 4;
        tensorData[i] = pixels[offset] / 255;
        tensorData[pixelCount + i] = pixels[offset + 1] / 255;
        tensorData[pixelCount * 2 + i] = pixels[offset + 2] / 255;
      }
    } else {
      for (let i = 0; i < pixelCount; i += 1) {
        const offset = i * 4;
        const out = i * 3;
        tensorData[out] = pixels[offset] / 255;
        tensorData[out + 1] = pixels[offset + 1] / 255;
        tensorData[out + 2] = pixels[offset + 2] / 255;
      }
    }

    return {
      ...shape,
      tensorData,
      originalWidth,
      originalHeight,
      letterboxScale,
      letterboxPadX,
      letterboxPadY,
    };
  } finally {
    cleanup();
  }
}

function buildCandidateMatrix(tensor: OrtTensorLike): CandidateMatrix | null {
  const dims = tensor.dims.map((value) => (Number.isFinite(value) ? Math.floor(value) : 0)).filter((value) => value > 0);
  if (dims.length < 2 || dims.length > 3) return null;

  const data = toFloat32Array(tensor.data);

  if (dims.length === 2) {
    const [d0, d1] = dims;
    const featureCount = Math.min(d0, d1);
    const candidateCount = Math.max(d0, d1);
    if (featureCount < 6) return null;

    if (d0 === featureCount) {
      return {
        candidateCount,
        featureCount,
        get: (candidateIdx, featureIdx) => data[featureIdx * candidateCount + candidateIdx] ?? 0,
      };
    }

    return {
      candidateCount,
      featureCount,
      get: (candidateIdx, featureIdx) => data[candidateIdx * featureCount + featureIdx] ?? 0,
    };
  }

  const [, d1, d2] = dims;
  const featureCount = Math.min(d1, d2);
  const candidateCount = Math.max(d1, d2);
  if (featureCount < 6) return null;

  if (d1 === featureCount) {
    return {
      candidateCount,
      featureCount,
      get: (candidateIdx, featureIdx) => data[featureIdx * candidateCount + candidateIdx] ?? 0,
    };
  }

  return {
    candidateCount,
    featureCount,
    get: (candidateIdx, featureIdx) => data[candidateIdx * featureCount + featureIdx] ?? 0,
  };
}

function resolveClassOffset(featureCount: number, classCountHint: number | undefined, objectnessValue: number): 4 | 5 {
  const noObjectnessClassCount = featureCount - 4;
  const withObjectnessClassCount = featureCount - 5;

  if (classCountHint && classCountHint > 0) {
    if (noObjectnessClassCount === classCountHint && withObjectnessClassCount !== classCountHint) return 4;
    if (withObjectnessClassCount === classCountHint && noObjectnessClassCount !== classCountHint) return 5;
  }

  if (featureCount === 85) return 5;
  if (featureCount === 84) return 4;
  if (objectnessValue < 0 || objectnessValue > 1.2) return 4;
  if (featureCount <= 8) return 4;
  return 5;
}

function decodeMatrixToRawDetections(
  matrix: CandidateMatrix,
  confidenceThreshold: number,
  inputWidth: number,
  inputHeight: number,
  classCountHint: number | undefined
): RawDetection[] {
  const detections: RawDetection[] = [];
  const featureCount = matrix.featureCount;

  for (let i = 0; i < matrix.candidateCount; i += 1) {
    const p0 = matrix.get(i, 0);
    const p1 = matrix.get(i, 1);
    const p2 = matrix.get(i, 2);
    const p3 = matrix.get(i, 3);
    if (!Number.isFinite(p0) || !Number.isFinite(p1) || !Number.isFinite(p2) || !Number.isFinite(p3)) continue;

    // Nx6 is commonly emitted after graph-level NMS: [x1, y1, x2, y2, score, class].
    if (featureCount === 6) {
      const rawScore = matrix.get(i, 4);
      const rawClass = matrix.get(i, 5);
      if (!Number.isFinite(rawScore) || !Number.isFinite(rawClass)) continue;

      const score = clamp01(rawScore);
      if (score < confidenceThreshold) continue;

      let x1 = p0;
      let y1 = p1;
      let x2 = p2;
      let y2 = p3;
      if (Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2)) <= 2.2) {
        x1 *= inputWidth;
        x2 *= inputWidth;
        y1 *= inputHeight;
        y2 *= inputHeight;
      }

      // If the tensor stores [cx, cy, w, h], convert to corners.
      if (!(x2 > x1 && y2 > y1)) {
        const cx = p0;
        const cy = p1;
        const w = p2;
        const h = p3;
        const scaleX = Math.max(Math.abs(cx), Math.abs(w)) <= 2.2 ? inputWidth : 1;
        const scaleY = Math.max(Math.abs(cy), Math.abs(h)) <= 2.2 ? inputHeight : 1;
        const cxScaled = cx * scaleX;
        const cyScaled = cy * scaleY;
        const wScaled = w * scaleX;
        const hScaled = h * scaleY;
        x1 = cxScaled - wScaled / 2;
        x2 = cxScaled + wScaled / 2;
        y1 = cyScaled - hScaled / 2;
        y2 = cyScaled + hScaled / 2;
      }

      if (x2 <= x1 || y2 <= y1) continue;
      detections.push({
        x1,
        y1,
        x2,
        y2,
        score,
        classIndex: Math.max(0, Math.floor(rawClass)),
      });
      continue;
    }

    const objectnessValue = matrix.get(i, 4);
    const classOffset = resolveClassOffset(featureCount, classCountHint, objectnessValue);
    if (classOffset >= featureCount) continue;

    let bestClassScore = Number.NEGATIVE_INFINITY;
    let bestClassIndex = 0;
    for (let featureIdx = classOffset; featureIdx < featureCount; featureIdx += 1) {
      const value = matrix.get(i, featureIdx);
      if (!Number.isFinite(value)) continue;
      if (value > bestClassScore) {
        bestClassScore = value;
        bestClassIndex = featureIdx - classOffset;
      }
    }
    if (!Number.isFinite(bestClassScore)) continue;

    const classScore = clamp01(bestClassScore);
    const objectness = classOffset === 5 ? clamp01(objectnessValue) : 1;
    const score = classScore * objectness;
    if (score < confidenceThreshold) continue;

    let cx = p0;
    let cy = p1;
    let width = p2;
    let height = p3;
    if (Math.max(Math.abs(cx), Math.abs(cy), Math.abs(width), Math.abs(height)) <= 2.2) {
      cx *= inputWidth;
      width *= inputWidth;
      cy *= inputHeight;
      height *= inputHeight;
    }

    if (width <= 0 || height <= 0) continue;
    const x1 = cx - width / 2;
    const y1 = cy - height / 2;
    const x2 = cx + width / 2;
    const y2 = cy + height / 2;
    if (x2 <= x1 || y2 <= y1) continue;

    detections.push({
      x1,
      y1,
      x2,
      y2,
      score,
      classIndex: bestClassIndex,
    });
  }

  return detections;
}

function boxIoU(a: RawDetection, b: RawDetection): number {
  const left = Math.max(a.x1, b.x1);
  const top = Math.max(a.y1, b.y1);
  const right = Math.min(a.x2, b.x2);
  const bottom = Math.min(a.y2, b.y2);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const intersection = width * height;
  if (intersection <= 0) return 0;
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  if (areaA <= 0 || areaB <= 0) return 0;
  return intersection / (areaA + areaB - intersection);
}

function applyNms(
  detections: RawDetection[],
  iouThreshold: number,
  maxDetections: number,
  classAgnostic: boolean
): RawDetection[] {
  const pending = [...detections].sort((a, b) => b.score - a.score);
  const kept: RawDetection[] = [];

  while (pending.length > 0 && kept.length < maxDetections) {
    const next = pending.shift();
    if (!next) break;
    kept.push(next);

    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const candidate = pending[i];
      if (!candidate) continue;
      if (!classAgnostic && candidate.classIndex !== next.classIndex) continue;
      if (boxIoU(next, candidate) > iouThreshold) {
        pending.splice(i, 1);
      }
    }
  }

  return kept;
}

function rankDetectionsWithoutNms(detections: RawDetection[], maxDetections: number): RawDetection[] {
  return [...detections].sort((a, b) => b.score - a.score).slice(0, maxDetections);
}

function mapRawDetectionsToImageSpace(raw: RawDetection[], prep: PreprocessResult): InferenceCandidate[] {
  const mapped: InferenceCandidate[] = [];
  for (const det of raw) {
    const imageX1 = (det.x1 - prep.letterboxPadX) / prep.letterboxScale;
    const imageY1 = (det.y1 - prep.letterboxPadY) / prep.letterboxScale;
    const imageX2 = (det.x2 - prep.letterboxPadX) / prep.letterboxScale;
    const imageY2 = (det.y2 - prep.letterboxPadY) / prep.letterboxScale;

    const x1 = clamp(Math.min(imageX1, imageX2), 0, prep.originalWidth);
    const y1 = clamp(Math.min(imageY1, imageY2), 0, prep.originalHeight);
    const x2 = clamp(Math.max(imageX1, imageX2), 0, prep.originalWidth);
    const y2 = clamp(Math.max(imageY1, imageY2), 0, prep.originalHeight);

    const width = Math.max(0, x2 - x1);
    const height = Math.max(0, y2 - y1);
    if (width < 1 || height < 1) continue;

    mapped.push({
      bbox: { x: x1, y: y1, width, height },
      score: clamp01(det.score),
      classIndex: Math.max(0, Math.floor(det.classIndex)),
    });
  }
  return mapped;
}

function pickBestCandidateMatrix(outputs: Record<string, OrtTensorLike>): CandidateMatrix | null {
  let best: CandidateMatrix | null = null;
  for (const tensor of Object.values(outputs)) {
    if (!isTensorLike(tensor)) continue;
    const matrix = buildCandidateMatrix(tensor);
    if (!matrix) continue;
    if (!best || matrix.candidateCount > best.candidateCount) {
      best = matrix;
    }
  }
  return best;
}

async function probeModelByGet(modelUrl: string): Promise<InferenceModelValidationResult> {
  try {
    const response = await withTimeout(
      fetch(modelUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store',
      }),
      15000,
      'Timed out while probing model URL.'
    );
    if (response.ok || response.status === 206) {
      return { ok: true };
    }
    return { ok: false, reason: `HTTP ${response.status}` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Network error.';
    return { ok: false, reason };
  }
}

export async function validateInferenceModelUrl(modelUrl: string): Promise<InferenceModelValidationResult> {
  const normalizedModelUrl = modelUrl.trim();
  if (!normalizedModelUrl) {
    return { ok: false, reason: 'Model URL/path is empty.' };
  }

  if (normalizedModelUrl.startsWith('blob:')) {
    try {
      const response = await withTimeout(
        fetch(normalizedModelUrl, { method: 'GET', cache: 'no-store' }),
        10000,
        'Timed out while probing model URL.'
      );
      return response.ok ? { ok: true } : { ok: false, reason: `HTTP ${response.status}` };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Network error.';
      return { ok: false, reason };
    }
  }

  try {
    const response = await withTimeout(
      fetch(normalizedModelUrl, { method: 'HEAD', cache: 'no-store' }),
      10000,
      'Timed out while probing model URL.'
    );
    if (response.ok) {
      return { ok: true };
    }
    if (response.status === 405 || response.status === 501) {
      return probeModelByGet(normalizedModelUrl);
    }
    return { ok: false, reason: `HTTP ${response.status}` };
  } catch {
    return probeModelByGet(normalizedModelUrl);
  }
}

export async function runModelInferenceOnImage(file: File, options: RunImageInferenceOptions): Promise<InferenceRunResult> {
  const modelUrl = options.modelUrl.trim();
  if (!modelUrl) {
    throw new Error('No model path or URL configured.');
  }

  const validation = await validateInferenceModelUrl(modelUrl);
  if (!validation.ok) {
    throw new Error(`Model URL is not reachable (${validation.reason}).`);
  }

  const confidenceThreshold = normalizeThreshold(options.confidenceThreshold, 0.5);
  const iouThreshold = normalizeThreshold(options.iouThreshold ?? 0.45, 0.45);
  const maxDetections = Math.max(1, Math.floor(options.maxDetections ?? 300));
  const defaultInputSize = Math.max(64, Math.floor(options.defaultInputSize ?? 640));
  const startedAt = performance.now();

  const [ort, session] = await Promise.all([loadOrtRuntime(), getSession(modelUrl)]);
  const inputName = session.inputNames[0];
  if (!inputName) {
    throw new Error('Model has no input tensor.');
  }

  const inputShape = resolveModelInputShape(session, defaultInputSize);
  const prep = await preprocessImage(file, inputShape);
  const inputTensor = new ort.Tensor('float32', prep.tensorData, prep.tensorDims);
  const outputs = await withTimeout(
    session.run({ [inputName]: inputTensor }),
    45000,
    'Timed out while running model inference.'
  );

  const matrix = pickBestCandidateMatrix(outputs);
  if (!matrix) {
    throw new Error('Unsupported model output shape. Expected YOLO-style detection output.');
  }

  const rawDetections = decodeMatrixToRawDetections(
    matrix,
    confidenceThreshold,
    prep.inputWidth,
    prep.inputHeight,
    options.classCountHint
  );
  const filtered = NMS_ENABLED
    ? applyNms(rawDetections, iouThreshold, maxDetections, NMS_CLASS_AGNOSTIC)
    : rankDetectionsWithoutNms(rawDetections, maxDetections);
  const detections = mapRawDetectionsToImageSpace(filtered, prep);

  return {
    detections,
    durationMs: performance.now() - startedAt,
  };
}
