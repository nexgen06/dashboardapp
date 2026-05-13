/** Başlık normalize: karşılaştırma için (Türkçe / alt çizgi / boşluk) */
function normalizeExtraColumnKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ");
}

/**
 * Sicil, TCKN vb. için: ekranda maskeli, kopyalamada tam metin.
 * Yanlış pozitifi azaltmak için belirli anahtar kalıplarına göre.
 */
export function isSensitiveExtraColumnKey(key: string): boolean {
  const n = normalizeExtraColumnKey(key);
  const compact = n.replace(/\s/g, "");

  if (/\btckn\b/.test(n) || compact.includes("tckn")) return true;
  if (/\btc\s*kimlik\b/.test(n) || compact === "tckimlik" || compact.startsWith("tckimlik")) return true;
  if (n.includes("tc kimlik") || compact.includes("tckimlikno")) return true;
  if (/\bsicil\b/.test(n) || compact.includes("sicil")) return true;
  if (n.includes("personel no") || compact.includes("personelno")) return true;
  if (n.includes("kimlik no") || compact.includes("kimlikno")) return true;

  return false;
}

/** Görünür maske: tam değer düzenleme / pano ile aynı kalır (pano ayrı). */
export function maskSensitiveExtraValue(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";

  if (t.length <= 4) return "•".repeat(t.length);

  if (t.length <= 6) {
    return `${t.slice(0, 1)}${"•".repeat(t.length - 2)}${t.slice(-1)}`;
  }

  const mid = Math.min(8, Math.max(4, t.length - 4));
  return `${t.slice(0, 2)}${"•".repeat(mid)}${t.slice(-2)}`;
}
