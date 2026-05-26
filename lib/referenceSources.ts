"use client";

import { supabase } from "@/lib/supabaseClient";
import { parseCSV } from "@/lib/csvParser";

export type ReferenceSource = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  fileName: string | null;
  fields: string[];
  records: Record<string, string>[];
  recordCount: number;
  labelField: string | null;
  keyField: string | null;
  searchFields: string[];
  createdAt: Date;
  updatedAt: Date;
};

type RawReferenceSource = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  file_name: string | null;
  fields: string[] | null;
  records: Record<string, string>[] | null;
  record_count: number | null;
  label_field: string | null;
  key_field: string | null;
  search_fields: string[] | null;
  created_at: string;
  updated_at: string;
};

export type SaveReferenceSourceInput = {
  name: string;
  description?: string | null;
  category?: string | null;
  fileName?: string | null;
  fields: string[];
  records: Record<string, string>[];
  labelField?: string | null;
  keyField?: string | null;
  searchFields?: string[];
};

export type UpdateReferenceSourceInput = Partial<SaveReferenceSourceInput>;

function rowToSource(row: RawReferenceSource): ReferenceSource {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    fileName: row.file_name ?? null,
    fields: row.fields ?? [],
    records: row.records ?? [],
    recordCount: row.record_count ?? row.records?.length ?? 0,
    labelField: row.label_field ?? null,
    keyField: row.key_field ?? null,
    searchFields: row.search_fields ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toFriendlyError(err: unknown): Error {
  if (!err || typeof err !== "object") return new Error("Bilinmeyen hata");
  const e = err as { message?: string; code?: string };
  if (e.code === "42P01" || /reference_sources/i.test(e.message ?? "")) {
    return new Error(
      "reference_sources tablosu Supabase'de yok. scripts/reference-sources.sql dosyasını Supabase Studio SQL Editor'da çalıştırın."
    );
  }
  if (e.code === "42501" || /row-level security|permission denied/i.test(e.message ?? "")) {
    return new Error("Referans kaynakları yönetmek için yetkiniz yok.");
  }
  return new Error(e.message ?? "Bilinmeyen hata");
}

const FULL_SELECT =
  "id, name, description, category, file_name, fields, records, record_count, label_field, key_field, search_fields, created_at, updated_at";

const FALLBACK_SELECT =
  "id, name, description, file_name, fields, records, record_count, label_field, key_field, search_fields, created_at, updated_at";

async function fetchSources(select: string) {
  return supabase.from("reference_sources").select(select).order("updated_at", { ascending: false });
}

export async function listReferenceSources(): Promise<ReferenceSource[]> {
  // Önce yeni şema (category dahil), kolon yoksa eski şemaya düş
  let { data, error } = await fetchSources(FULL_SELECT);
  if (error && (error.code === "42703" || /category/i.test(error.message ?? ""))) {
    const fallback = await fetchSources(FALLBACK_SELECT);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw toFriendlyError(error);
  return ((data ?? []) as unknown as RawReferenceSource[]).map(rowToSource);
}

export async function createReferenceSource(input: SaveReferenceSourceInput): Promise<ReferenceSource> {
  const row: Record<string, unknown> = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    file_name: input.fileName?.trim() || null,
    fields: input.fields,
    records: input.records,
    record_count: input.records.length,
    label_field: input.labelField || null,
    key_field: input.keyField || null,
    search_fields: input.searchFields ?? [],
  };
  const performInsert = async (payload: Record<string, unknown>, select: string) =>
    supabase.from("reference_sources").insert(payload).select(select).single();

  let { data, error } = await performInsert(row, FULL_SELECT);
  if (error && (error.code === "42703" || /category/i.test(error.message ?? ""))) {
    const fallback = { ...row };
    delete fallback.category;
    const retry = await performInsert(fallback, FALLBACK_SELECT);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw toFriendlyError(error);
  return rowToSource(data as unknown as RawReferenceSource);
}

/**
 * Mevcut bir referans kaynağını günceller. Sadece verilen alanlar yazılır.
 * `records` güncellenirse `record_count` da otomatik senkronlanır.
 */
export async function updateReferenceSource(
  id: string,
  patch: UpdateReferenceSourceInput
): Promise<ReferenceSource> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.category !== undefined) row.category = patch.category?.trim() || null;
  if (patch.fileName !== undefined) row.file_name = patch.fileName?.trim() || null;
  if (patch.fields !== undefined) row.fields = patch.fields;
  if (patch.records !== undefined) {
    row.records = patch.records;
    row.record_count = patch.records.length;
  }
  if (patch.labelField !== undefined) row.label_field = patch.labelField || null;
  if (patch.keyField !== undefined) row.key_field = patch.keyField || null;
  if (patch.searchFields !== undefined) row.search_fields = patch.searchFields;

  const performUpdate = async (payload: Record<string, unknown>, select: string) =>
    supabase.from("reference_sources").update(payload).eq("id", id).select(select).single();

  let { data, error } = await performUpdate(row, FULL_SELECT);
  if (error && (error.code === "42703" || /category/i.test(error.message ?? ""))) {
    const fallback = { ...row };
    delete fallback.category;
    const retry = await performUpdate(fallback, FALLBACK_SELECT);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw toFriendlyError(error);
  return rowToSource(data as unknown as RawReferenceSource);
}

export async function deleteReferenceSource(id: string): Promise<void> {
  const { error } = await supabase.from("reference_sources").delete().eq("id", id);
  if (error) throw toFriendlyError(error);
}

/**
 * Bir referans kaynağının kaç project_column tarafından kullanıldığını sayar.
 * project_columns.config JSONB içinde reference.sourceName veya reference.sourceId
 * eşleştirmesi arar. Tablo yoksa 0 döner (graceful).
 */
export async function countReferenceUsage(sourceId: string, sourceName: string): Promise<number> {
  // project_columns tablosunu config içinden reference.sourceName veya sourceId ile filtrele
  // Postgres JSONB sorgusu: config @> '{"reference":{"sourceName":"..."}}'
  const queries = await Promise.all([
    supabase
      .from("project_columns")
      .select("id", { count: "exact", head: true })
      .contains("config", { reference: { sourceName } } as never),
    supabase
      .from("project_columns")
      .select("id", { count: "exact", head: true })
      .contains("config", { reference: { sourceId } } as never),
  ]);
  const totals: number[] = [];
  for (const q of queries) {
    // Tablo yoksa veya başka bir hata varsa atla
    if (q.error) {
      const code = String(q.error.code ?? "");
      if (code === "42P01") return 0;
      // Diğer hatalarda sessiz geç
      continue;
    }
    if (typeof q.count === "number") totals.push(q.count);
  }
  return totals.length > 0 ? Math.max(...totals) : 0;
}

export function parseReferenceJson(text: string): { fields: string[]; records: Record<string, string>[] } {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed as Record<string, unknown>).flatMap((value) => (Array.isArray(value) ? value : []))
      : [];
  const objectRows = rows.filter(
    (row): row is Record<string, unknown> => row != null && typeof row === "object" && !Array.isArray(row)
  );
  if (objectRows.length === 0) throw new Error("JSON içinde obje dizisi bulunamadı.");
  const fields = Array.from(
    objectRows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  ).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
  const records = objectRows.map((row) =>
    Object.fromEntries(fields.map((field) => [field, String(row[field] ?? "").trim()]))
  );
  return { fields, records };
}

/**
 * CSV metnini referans formatına dönüştürür: ilk satır başlık, sonrakiler kayıt.
 * Boş hücreler boş string olarak gelir.
 */
export function parseReferenceCsv(text: string): { fields: string[]; records: Record<string, string>[] } {
  const { headers, rows } = parseCSV(text);
  const fields = headers.map((h) => h.trim()).filter((h) => h.length > 0);
  if (fields.length === 0) throw new Error("CSV başlık satırı bulunamadı.");
  const records: Record<string, string>[] = [];
  for (const row of rows) {
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue; // boş satır atla
    const record: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 1) {
      record[fields[i]] = String(row[i] ?? "").trim();
    }
    records.push(record);
  }
  if (records.length === 0) throw new Error("CSV içinde veri satırı bulunamadı.");
  return { fields, records };
}

/**
 * Dosya uzantısına bakarak JSON veya CSV parse eder.
 */
export function parseReferenceFile(
  fileName: string,
  text: string
): { fields: string[]; records: Record<string, string>[] } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return parseReferenceCsv(text);
  return parseReferenceJson(text);
}

export function guessReferenceLabelField(fields: string[]): string {
  return fields.find((f) => /adi|adı|name|title/i.test(f)) ?? fields[0] ?? "";
}

export function guessReferenceKeyField(fields: string[]): string {
  return fields.find((f) => /kod|code|id|no/i.test(f)) ?? "";
}

