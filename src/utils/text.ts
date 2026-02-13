export function truncateMiddle(input: string, max = 36): string {
  if (input.length <= max) return input;
  const keep = Math.max(4, Math.floor((max - 3) / 2));
  return `${input.slice(0, keep)}...${input.slice(input.length - keep)}`;
}
