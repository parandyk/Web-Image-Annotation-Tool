const palette = [
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#14B8A6',
  '#F97316',
  '#84CC16',
  '#06B6D4',
  '#EAB308',
  '#FB7185'
];

export function getClassColor(index: number): string {
  return palette[index % palette.length];
}
