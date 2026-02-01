/**
 * JSON dosyasından görev listesi çıkarır.
 * Beklenen format: nesnelerin dizisi. Her nesnenin anahtarları sütun başlığı, değerleri hücre.
 * Örnek: [ { "Başlık": "Görev 1", "Açıklama": "..." }, ... ]
 */
export function parseJSON(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = JSON.parse(text) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) return { headers: [], rows: [] };
  const first = raw[0];
  if (first == null || typeof first !== "object" || Array.isArray(first)) return { headers: [], rows: [] };
  const headers = Object.keys(first as Record<string, unknown>);
  const rows: Record<string, string>[] = raw.map((row: unknown) => {
    const obj = row != null && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
    const out: Record<string, string> = {};
    for (const k of headers) {
      const v = obj[k];
      out[k] = v != null ? String(v).trim() : "";
    }
    return out;
  });
  return { headers, rows };
}
