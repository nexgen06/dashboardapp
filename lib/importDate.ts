function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDateString(year: number, month: number, day: number): string | null {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * CSV/JSON import ve bulk insert için due_date → PostgreSQL `date` (YYYY-MM-DD).
 * Türkiye/EU: gün.ay.yıl, gün/ay/yıl; ISO YYYY-MM-DD de kabul edilir.
 */
export function normalizeImportedDueDate(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return toIsoDateString(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    return toIsoDateString(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  const ymdAlt = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdAlt) {
    return toIsoDateString(Number(ymdAlt[1]), Number(ymdAlt[2]), Number(ymdAlt[3]));
  }

  return null;
}
