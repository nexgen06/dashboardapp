/** Ayarlarda boş bırakılırsa acil özetinde kullanılan varsayılan `priority` eşleşmeleri (küçük harf). */
export const DEFAULT_URGENT_PRIORITY_TOKENS = ["high", "yüksek", "kritik", "p1", "acil", "urgent"] as const;

function splitCsvOrLines(value: string): string[] {
  return String(value)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Virgül/satırla ayrılmış öncelik etiketleri → küçük harf kümesi. Boşsa varsayılanlar. */
export function urgentPrioritySetFromCsv(csv: string | undefined | null): Set<string> {
  const parts = splitCsvOrLines(String(csv ?? ""));
  const list = parts.length > 0 ? parts.map((p) => p.toLowerCase()) : [...DEFAULT_URGENT_PRIORITY_TOKENS];
  return new Set(list);
}

export function isUrgentPriorityValue(priority: string | null | undefined, set: Set<string>): boolean {
  const p = (priority ?? "").trim().toLowerCase();
  return p.length > 0 && set.has(p);
}
