"use client";

import { supabase } from "@/lib/supabaseClient";

export type ReferenceSource = {
  id: string;
  name: string;
  description: string | null;
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
  fileName?: string | null;
  fields: string[];
  records: Record<string, string>[];
  labelField?: string | null;
  keyField?: string | null;
  searchFields?: string[];
};

function rowToSource(row: RawReferenceSource): ReferenceSource {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
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

export async function listReferenceSources(): Promise<ReferenceSource[]> {
  const { data, error } = await supabase
    .from("reference_sources")
    .select("id, name, description, file_name, fields, records, record_count, label_field, key_field, search_fields, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw toFriendlyError(error);
  return (data ?? []).map((row) => rowToSource(row as RawReferenceSource));
}

export async function createReferenceSource(input: SaveReferenceSourceInput): Promise<ReferenceSource> {
  const row = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    file_name: input.fileName?.trim() || null,
    fields: input.fields,
    records: input.records,
    record_count: input.records.length,
    label_field: input.labelField || null,
    key_field: input.keyField || null,
    search_fields: input.searchFields ?? [],
  };
  const { data, error } = await supabase
    .from("reference_sources")
    .insert(row)
    .select("id, name, description, file_name, fields, records, record_count, label_field, key_field, search_fields, created_at, updated_at")
    .single();
  if (error) throw toFriendlyError(error);
  return rowToSource(data as RawReferenceSource);
}

export async function deleteReferenceSource(id: string): Promise<void> {
  const { error } = await supabase.from("reference_sources").delete().eq("id", id);
  if (error) throw toFriendlyError(error);
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

export function guessReferenceLabelField(fields: string[]): string {
  return fields.find((f) => /adi|adı|name|title/i.test(f)) ?? fields[0] ?? "";
}

export function guessReferenceKeyField(fields: string[]): string {
  return fields.find((f) => /kod|code|id|no/i.test(f)) ?? "";
}

