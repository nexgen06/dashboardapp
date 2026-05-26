/**
 * Project Columns — dinamik sütun tipleri (Faz A.3.1).
 *
 * Mevcut `extra_data` JSON'ı dokunulmaz; bu tablo şema/metadata katmanıdır.
 * UI tablonun nasıl render edileceğine (A.3.2'de) buradan bakar.
 */
import { supabase } from "@/lib/supabaseClient";

export type ProjectColumnType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url"
  | "email"
  | "person"
  | "progress"
  | "formula";

export type ProjectColumnConfig = {
  /** select / multi_select: önceden tanımlı seçenekler */
  options?: string[];
  /** JSON / CSV gibi dış referans kaynaklardan seçenek üretildiğinde metadata.
   *
   * Strateji:
   *  - sourceId: tercih edilen ID — canlı bağlantı; kaynak düzenlenirse sütun otomatik güncellenir
   *  - sourceName: insan-okuyucu fallback (eski kayıtlarda da var)
   *  - records: snapshot (eski şema); sourceId yoksa fallback olarak kullanılır
   *
   * Render önceliği: sourceId → referenceSources lookup → live records
   *                  yoksa records snapshot fallback
   */
  reference?: {
    sourceId?: string;
    sourceName: string;
    labelField: string;
    valueField?: string;
    fields: string[];
    recordCount: number;
    records?: Record<string, string>[];
  };
  /** number: format (örn. "TL", "%", "x") */
  format?: string;
  /** number: ondalık basamak sayısı */
  decimals?: number;
  /** date: format (örn. "DD.MM.YYYY") */
  dateFormat?: string;
  /** formula: ifade */
  expression?: string;
};

export type ProjectColumn = {
  id: string;
  projectId: string;
  key: string;
  type: ProjectColumnType;
  config: ProjectColumnConfig;
  position: number;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const PROJECT_COLUMN_TYPE_LABELS: Record<ProjectColumnType, string> = {
  text: "Metin",
  number: "Sayı",
  date: "Tarih",
  select: "Tek seçim",
  multi_select: "Çoklu seçim",
  checkbox: "Onay kutusu",
  url: "Bağlantı",
  email: "E-posta",
  person: "Kişi",
  progress: "İlerleme %",
  formula: "Formül",
};

export const PROJECT_COLUMN_TYPE_HINTS: Record<ProjectColumnType, string> = {
  text: "Serbest metin",
  number: "Sayısal değer; sıralanır, toplanır",
  date: "Takvimden seçilir; gecikme hesabı için temel",
  select: "Sabit seçenek listesi; chip ile gösterilir",
  multi_select: "Birden fazla etiket; virgülle saklanır",
  checkbox: "Var / yok",
  url: "Otomatik link; tıklanır",
  email: "Otomatik mailto:",
  person: "Sistemdeki bir kullanıcı (yakında)",
  progress: "0-100 arası; bar olarak gösterilir",
  formula: "Diğer sütunlardan hesaplanır (yakında)",
};

type RawRow = {
  id: string;
  project_id: string;
  key: string;
  type: string;
  config: ProjectColumnConfig | null;
  position: number;
  required: boolean;
  created_at: string;
  updated_at: string;
};

function rowToColumn(r: RawRow): ProjectColumn {
  const t = (r.type as ProjectColumnType) ?? "text";
  return {
    id: r.id,
    projectId: r.project_id,
    key: r.key,
    type: PROJECT_COLUMN_TYPE_LABELS[t] ? t : "text",
    config: (r.config ?? {}) as ProjectColumnConfig,
    position: r.position ?? 0,
    required: !!r.required,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function toFriendlyError(err: unknown): Error {
  if (!err || typeof err !== "object") return new Error("Bilinmeyen hata");
  const e = err as { message?: string; code?: string };
  if (e.code === "42P01" || /relation\s+"?(public\.)?project_columns"?\s+does not exist/i.test(e.message ?? "")) {
    return new Error(
      "project_columns tablosu Supabase'de yok. scripts/project-columns.sql dosyasını Supabase Studio → SQL Editor'da çalıştırman gerek."
    );
  }
  if (e.code === "42501" || /row-level security|permission denied/i.test(e.message ?? "")) {
    return new Error("Bu işlem için admin / proje yöneticisi yetkisi gerekir.");
  }
  if (e.code === "23505") {
    return new Error("Aynı anahtarla başka bir sütun zaten var.");
  }
  return new Error(e.message ?? "Bilinmeyen hata");
}

export async function listProjectColumns(projectId: string): Promise<ProjectColumn[]> {
  const { data, error } = await supabase
    .from("project_columns")
    .select("id, project_id, key, type, config, position, required, created_at, updated_at")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) {
    console.warn("[projectColumns] list failed:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToColumn(r as RawRow));
}

export type SaveProjectColumnInput = {
  projectId: string;
  key: string;
  type: ProjectColumnType;
  config?: ProjectColumnConfig;
  position?: number;
  required?: boolean;
};

export async function upsertProjectColumn(input: SaveProjectColumnInput): Promise<ProjectColumn> {
  const row = {
    project_id: input.projectId,
    key: input.key.trim(),
    type: input.type,
    config: input.config ?? {},
    position: input.position ?? 0,
    required: input.required ?? false,
  };
  const { data, error } = await supabase
    .from("project_columns")
    .upsert(row, { onConflict: "project_id,key" })
    .select("id, project_id, key, type, config, position, required, created_at, updated_at")
    .single();
  if (error) {
    console.error("[projectColumns] upsert failed:", error);
    throw toFriendlyError(error);
  }
  return rowToColumn(data as RawRow);
}

export async function updateProjectColumn(
  id: string,
  patch: Partial<Omit<SaveProjectColumnInput, "projectId">>
): Promise<ProjectColumn> {
  const row: Record<string, unknown> = {};
  if (patch.key !== undefined) row.key = patch.key.trim();
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.config !== undefined) row.config = patch.config;
  if (patch.position !== undefined) row.position = patch.position;
  if (patch.required !== undefined) row.required = patch.required;
  const { data, error } = await supabase
    .from("project_columns")
    .update(row)
    .eq("id", id)
    .select("id, project_id, key, type, config, position, required, created_at, updated_at")
    .single();
  if (error) {
    console.error("[projectColumns] update failed:", error);
    throw toFriendlyError(error);
  }
  return rowToColumn(data as RawRow);
}

export async function deleteProjectColumn(id: string): Promise<void> {
  const { error } = await supabase.from("project_columns").delete().eq("id", id);
  if (error) {
    console.error("[projectColumns] delete failed:", error);
    throw toFriendlyError(error);
  }
}

/**
 * Otomatik tip tahmini — bir extra_data anahtarı + örnek değerler.
 * Migration / "akıllı varsayılan" için kullanılır.
 */
export function inferColumnType(key: string, sampleValues: string[]): ProjectColumnType {
  const k = key.toLowerCase().trim();
  const samples = sampleValues
    .map((s) => String(s ?? "").trim())
    .filter((s) => s !== "")
    .slice(0, 20);

  // Anahtar isminden ipuçları
  if (/^(tarih|date|bitiş|başlangıç|son|deadline)/i.test(k)) return "date";
  if (/^(durum|status|aciliyet|öncelik|priority|kategori)/i.test(k)) return "select";
  if (/^(email|e-?posta|mail)/i.test(k)) return "email";
  if (/^(url|link|web|adres)/i.test(k)) return "url";
  if (/^(yapıldı|tamamlandı|done|onay|check)/i.test(k)) return "checkbox";
  if (/^(tutar|miktar|sayı|adet|fiyat|bütçe|skor|count)/i.test(k)) return "number";
  if (/(progress|ilerleme|%)/i.test(k)) return "progress";

  if (samples.length === 0) return "text";

  // Değerlerden tip tahmini
  const allNumeric = samples.every((s) => /^-?\d+([.,]\d+)?$/.test(s));
  if (allNumeric) {
    const allInt = samples.every((s) => /^-?\d+$/.test(s));
    const allInRange = samples.every((s) => {
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) && n >= 0 && n <= 100;
    });
    if (allInt && allInRange && /(%|progress|ilerleme)/i.test(k)) return "progress";
    return "number";
  }
  const allDate = samples.every((s) =>
    /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(s)
  );
  if (allDate) return "date";
  const allEmail = samples.every((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  if (allEmail) return "email";
  const allUrl = samples.every((s) => /^https?:\/\//i.test(s));
  if (allUrl) return "url";
  const allBool = samples.every((s) =>
    /^(true|false|evet|hayır|yes|no|✓|x|1|0)$/i.test(s)
  );
  if (allBool) return "checkbox";
  // Az sayıda farklı değer (≤ 8) varsa select öner
  const unique = new Set(samples.map((s) => s.toLowerCase()));
  if (unique.size > 1 && unique.size <= 8 && samples.length >= 4) return "select";
  return "text";
}
