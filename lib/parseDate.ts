/**
 * Tolerant tarih parser. Aşağıdaki formatları destekler:
 *   - ISO: 2026-06-01, 2026-06-01T00:00:00Z, 2026-06-01T12:34:56.789+03:00
 *   - Türkçe nokta: 01.06.2026
 *   - Türkçe tire / slash: 01-06-2026, 01/06/2026
 *   - 2 haneli yıl: 01.06.26 → 2026 (50 yıl kuralı)
 *   - Sayı (Date.parse epoch)
 *
 * Geçersizse null döner.
 */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;
const TR_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/;

export function parseDateFlexible(input: string | number | null | undefined): Date | null {
  if (input == null) return null;
  if (typeof input === "number") {
    const d = new Date(input);
    return isFinite(d.getTime()) ? d : null;
  }
  const s = String(input).trim();
  if (!s) return null;

  // ISO — Date constructor doğrudan parse eder
  if (ISO_RE.test(s)) {
    const d = new Date(s);
    return isFinite(d.getTime()) ? d : null;
  }

  // Türkçe gün-ay-yıl
  const trMatch = TR_RE.exec(s);
  if (trMatch) {
    const day = Number(trMatch[1]);
    const month = Number(trMatch[2]);
    let year = Number(trMatch[3]);
    if (year < 100) year += year >= 50 ? 1900 : 2000;
    if (
      day >= 1 && day <= 31 &&
      month >= 1 && month <= 12 &&
      year >= 1900 && year <= 2999
    ) {
      const d = new Date(year, month - 1, day);
      return isFinite(d.getTime()) ? d : null;
    }
  }

  // Son çare: native parser
  const d = new Date(s);
  return isFinite(d.getTime()) ? d : null;
}
