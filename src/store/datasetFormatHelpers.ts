import { BBox } from '../domain/types';

export type VocObjectRecord = {
  name: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

export type VocParsedAnnotation = {
  filename: string | null;
  width: number | null;
  height: number | null;
  objects: VocObjectRecord[];
};

export function parseYoloNamesFromYaml(content: string): string[] {
  // Accept both "names: [..]" and indexed "0: name" YAML styles.
  const mapped: Array<[number, string]> = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    const idx = Number(match[1]);
    const name = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (Number.isFinite(idx) && name) {
      mapped.push([idx, name]);
    }
  }
  if (mapped.length > 0) {
    mapped.sort((a, b) => a[0] - b[0]);
    return mapped.map(([, name]) => name).filter(Boolean);
  }

  const inline = content.match(/names\s*:\s*\[(.*?)\]/s);
  if (inline) {
    return inline[1]
      .split(',')
      .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return [];
}

export function parseVocAnnotationXml(content: string): VocParsedAnnotation | null {
  if (typeof DOMParser === 'undefined') return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');
  if (doc.querySelector('parsererror')) return null;

  const root = doc.querySelector('annotation');
  if (!root) return null;

  const readText = (scope: ParentNode, selector: string): string | null => {
    const node = scope.querySelector(selector);
    const raw = node?.textContent?.trim() ?? '';
    return raw.length > 0 ? raw : null;
  };

  const readNumber = (scope: ParentNode, selector: string): number | null => {
    const text = readText(scope, selector);
    if (!text) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  };

  const filename = readText(root, 'filename');
  const width = readNumber(root, 'size > width');
  const height = readNumber(root, 'size > height');

  const objects: VocObjectRecord[] = [];
  for (const objectNode of Array.from(root.querySelectorAll('object'))) {
    const name = readText(objectNode, 'name');
    const xmin = readNumber(objectNode, 'bndbox > xmin');
    const ymin = readNumber(objectNode, 'bndbox > ymin');
    const xmax = readNumber(objectNode, 'bndbox > xmax');
    const ymax = readNumber(objectNode, 'bndbox > ymax');
    if (!name || xmin === null || ymin === null || xmax === null || ymax === null) continue;
    objects.push({
      name,
      xmin: Math.min(xmin, xmax),
      ymin: Math.min(ymin, ymax),
      xmax: Math.max(xmin, xmax),
      ymax: Math.max(ymin, ymax),
    });
  }

  return {
    filename,
    width: width && width > 0 ? width : null,
    height: height && height > 0 ? height : null,
    objects,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatVocNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function buildVocAnnotationXml(
  imageName: string,
  width: number,
  height: number,
  objects: Array<{ className: string; bbox: BBox }>
): string {
  const objectXml = objects
    .map((obj) => {
      const x1 = clamp(obj.bbox.x, 0, width);
      const y1 = clamp(obj.bbox.y, 0, height);
      const x2 = clamp(obj.bbox.x + obj.bbox.width, 0, width);
      const y2 = clamp(obj.bbox.y + obj.bbox.height, 0, height);
      return [
        '  <object>',
        `    <name>${escapeXml(obj.className)}</name>`,
        '    <pose>Unspecified</pose>',
        '    <truncated>0</truncated>',
        '    <difficult>0</difficult>',
        '    <bndbox>',
        `      <xmin>${formatVocNumber(Math.min(x1, x2))}</xmin>`,
        `      <ymin>${formatVocNumber(Math.min(y1, y2))}</ymin>`,
        `      <xmax>${formatVocNumber(Math.max(x1, x2))}</xmax>`,
        `      <ymax>${formatVocNumber(Math.max(y1, y2))}</ymax>`,
        '    </bndbox>',
        '  </object>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<annotation>',
    '  <folder>images</folder>',
    `  <filename>${escapeXml(imageName)}</filename>`,
    `  <path>images/${escapeXml(imageName)}</path>`,
    '  <source>',
    '    <database>Unknown</database>',
    '  </source>',
    '  <size>',
    `    <width>${Math.max(1, Math.round(width))}</width>`,
    `    <height>${Math.max(1, Math.round(height))}</height>`,
    '    <depth>3</depth>',
    '  </size>',
    '  <segmented>0</segmented>',
    objectXml,
    '</annotation>',
  ].join('\n');
}
