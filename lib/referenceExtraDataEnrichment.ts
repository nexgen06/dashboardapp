import type { ProjectColumn } from "@/lib/projectColumns";
import { REFERENCE_WARNINGS_KEY } from "@/components/tasks-table/constants";

function normalizeReferenceFieldName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function compactReferenceFieldName(value: string): string {
  return normalizeReferenceFieldName(value).replace(/\s+/g, "");
}

const REFERENCE_FIELD_TARGET_ALIASES: Record<string, string[]> = {
  il: ["İl", "Il"],
  i_l: ["İl", "Il"],
  ilce: ["İlçe", "Ilce"],
  i_lce: ["İlçe", "Ilce"],
  kurumadi: ["Kurum Adı", "Kurum"],
  kurum_adi: ["Kurum Adı", "Kurum"],
  kurumkodu: ["Kurum Kodu"],
  kurum_kodu: ["Kurum Kodu"],
  kurumturu: ["Kurum Türü"],
  kurum_turu: ["Kurum Türü"],
  detsiskodu: ["DETSİS Kodu", "Detsis Kodu", "DETSIS Kodu"],
  detsi_s_kodu: ["DETSİS Kodu", "Detsis Kodu", "DETSIS Kodu"],
  sirano: ["Sıra No", "Sira No"],
  sira_no: ["Sıra No", "Sira No"],
};

function preferredReferenceTargets(field: string): string[] {
  const compact = compactReferenceFieldName(field);
  return REFERENCE_FIELD_TARGET_ALIASES[compact] ?? REFERENCE_FIELD_TARGET_ALIASES[field] ?? [field];
}

export function resolveReferenceTargetKey(field: string, availableKeys: string[]): string | null {
  const available = availableKeys.map((key) => ({
    key,
    normalized: normalizeReferenceFieldName(key),
    compact: compactReferenceFieldName(key),
  }));
  const candidates = preferredReferenceTargets(field);
  for (const candidate of candidates) {
    const normalized = normalizeReferenceFieldName(candidate);
    const compact = compactReferenceFieldName(candidate);
    const found = available.find((item) => item.normalized === normalized || item.compact === compact);
    if (found) return found.key;
  }
  const fieldNormalized = normalizeReferenceFieldName(field);
  const fieldCompact = compactReferenceFieldName(field);
  return available.find((item) => item.normalized === fieldNormalized || item.compact === fieldCompact)?.key ?? null;
}

export function valuesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const av = String(a ?? "").trim();
  const bv = String(b ?? "").trim();
  if (!av || !bv) return false;
  return normalizeReferenceFieldName(av) === normalizeReferenceFieldName(bv);
}

function numbersMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const av = String(a ?? "").replace(/\D/g, "");
  const bv = String(b ?? "").replace(/\D/g, "");
  return av !== "" && av === bv;
}

function textIncludesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const av = normalizeReferenceFieldName(String(a ?? ""));
  const bv = normalizeReferenceFieldName(String(b ?? ""));
  return av.length >= 4 && bv.length >= 4 && (av.includes(bv) || bv.includes(av));
}

function findBestReferenceRecord(
  extraData: Record<string, string>,
  records: Record<string, string>[],
  availableKeys: string[]
): Record<string, string> | null {
  let best: { record: Record<string, string>; score: number } | null = null;
  for (const record of records) {
    let score = 0;
    for (const [field, recordValue] of Object.entries(record)) {
      const targetKey = resolveReferenceTargetKey(field, availableKeys);
      const inputValue = targetKey ? extraData[targetKey] : extraData[field];
      if (!inputValue) continue;
      if (numbersMatch(inputValue, recordValue)) score += 20;
      else if (valuesMatch(inputValue, recordValue)) score += 10;
      else if (/adi|ad[ıi]|kurum/i.test(normalizeReferenceFieldName(field)) && textIncludesMatch(inputValue, recordValue)) {
        score += 4;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { record, score };
    }
  }
  return best?.record ?? null;
}

export function referenceWarningsFromRecord(
  extraData: Record<string, string>,
  record: Record<string, string>,
  availableKeys: string[],
  labelField?: string
): string[] {
  const warnings: string[] = [];
  for (const [field, recordValue] of Object.entries(record)) {
    if (field === labelField) continue;
    const targetKey = resolveReferenceTargetKey(field, availableKeys);
    if (!targetKey) continue;
    const currentValue = String(extraData[targetKey] ?? "").trim();
    const expectedValue = String(recordValue ?? "").trim();
    if (!currentValue || !expectedValue) continue;
    if (!valuesMatch(currentValue, expectedValue) && !numbersMatch(currentValue, expectedValue)) {
      warnings.push(`${targetKey}: "${currentValue}" yerine referansta "${expectedValue}"`);
    }
  }
  return warnings;
}

export function enrichExtraDataFromReferenceRecords(
  extraData: Record<string, string> | null | undefined,
  referenceColumns: ProjectColumn[],
  knownKeys: string[]
): Record<string, string> | null {
  if (!extraData || Object.keys(extraData).length === 0) return extraData ?? null;
  const next: Record<string, string> = { ...extraData };
  const availableKeys = Array.from(new Set([...knownKeys, ...Object.keys(next)]));

  for (const column of referenceColumns) {
    const reference = column.config.reference;
    const records = reference?.records ?? [];
    if (!reference?.labelField || records.length === 0) continue;

    const matchedRecord = findBestReferenceRecord(next, records, availableKeys);
    if (!matchedRecord) continue;
    const warnings = referenceWarningsFromRecord(next, matchedRecord, availableKeys, reference.labelField);

    for (const [field, recordValue] of Object.entries(matchedRecord)) {
      const cellValue = String(recordValue ?? "").trim();
      if (!cellValue) continue;
      const targetKey = resolveReferenceTargetKey(field, availableKeys);
      if (!targetKey) continue;
      if (String(next[targetKey] ?? "").trim() === "") {
        next[targetKey] = cellValue;
      }
    }
    if (warnings.length > 0) {
      next[REFERENCE_WARNINGS_KEY] = warnings.join(" | ");
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}
