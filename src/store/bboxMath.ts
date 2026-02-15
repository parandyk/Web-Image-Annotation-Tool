import { BBox } from '../domain/types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeBBox(b: BBox, maxW: number, maxH: number): BBox {
  const x1 = Math.max(0, Math.min(maxW, b.x));
  const y1 = Math.max(0, Math.min(maxH, b.y));
  const x2 = Math.max(0, Math.min(maxW, b.x + b.width));
  const y2 = Math.max(0, Math.min(maxH, b.y + b.height));

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return { x, y, width, height };
}
