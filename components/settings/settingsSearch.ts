export function matchesSearch(query: string, label: string, description?: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return label.toLowerCase().includes(q) || (description?.toLowerCase().includes(q) ?? false);
}
