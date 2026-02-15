import { ClassData } from '../domain/types';
import { normalizeClassHotkey, sanitizeClassName } from './classImageHelpers';

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; statusText: string };

export function validateClassNameInput(
  rawName: string,
  classes: ClassData[],
  opts: { excludeClassId?: string } = {}
): ValidationResult<string> {
  const sanitized = sanitizeClassName(rawName);
  if (!sanitized || !/[A-Za-z0-9]/.test(sanitized)) {
    return { ok: false, statusText: 'Class name must contain letters or digits.' };
  }
  const duplicate = classes.some(
    (cls) =>
      cls.id !== opts.excludeClassId &&
      cls.name.toLowerCase() === sanitized.toLowerCase()
  );
  if (duplicate) {
    return { ok: false, statusText: `Class "${sanitized}" already exists.` };
  }
  return { ok: true, value: sanitized };
}

export function validateClassHotkeyInput(
  rawHotkey: string,
  classes: ClassData[],
  classId: string
): ValidationResult<string> {
  const normalized = normalizeClassHotkey(rawHotkey);
  if (!normalized) {
    return { ok: false, statusText: 'Hotkey must be a single letter (A-Z) or digit (0-9).' };
  }
  const conflicting = classes.find((cls) => cls.id !== classId && cls.hotkey === normalized);
  if (conflicting) {
    return {
      ok: false,
      statusText: `Hotkey "${normalized}" is already assigned to "${conflicting.name}".`,
    };
  }
  return { ok: true, value: normalized };
}

