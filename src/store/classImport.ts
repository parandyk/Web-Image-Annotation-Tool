export function parseClassNamesFromText(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}
