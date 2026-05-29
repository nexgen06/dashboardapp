"use client";

import { supabase } from "@/lib/supabaseClient";
import type { EmailTemplateMode, PdfExportScope, ReportTemplateId } from "@/lib/liveTableExport";
import type { SavedViewConfig } from "@/lib/savedViews";

export type ReportTemplateScope = "private" | "shared";
export type ReportTemplateAssignmentScope = "system" | "project";
export type ReportTemplateAccessMode = "all" | "admin_pm" | "project_team" | "email_list";

/** Hızlı senaryo presetleri — savedView filters'a dönüştürülür. */
export type FilterPresetId =
  | "completed"
  | "overdue"
  | "last7days"
  | "last30days"
  | "highPriority";

export const FILTER_PRESET_LABELS: Record<FilterPresetId, string> = {
  completed: "Sadece tamamlananlar",
  overdue: "Sadece gecikmiş görevler",
  last7days: "Son 7 gün",
  last30days: "Son 30 gün",
  highPriority: "Yüksek öncelik",
};

export const FILTER_PRESET_ORDER: FilterPresetId[] = [
  "completed",
  "overdue",
  "last7days",
  "last30days",
  "highPriority",
];

export type PdfOrientationOption = "landscape" | "portrait";
export type PdfPageSizeOption = "A4" | "A3" | "Letter";

export type ReportTemplateConfig = {
  baseTemplateId: ReportTemplateId;
  pdfTitle: string;
  emailSubject: string;
  emailMode: EmailTemplateMode;
  exportScope: PdfExportScope;
  visibleColumnIds: string[];
  unmaskSensitive: boolean;
  /** Logo bandını PDF/e-posta üstüne yerleştir (org_branding'ten okunur). */
  showLogo: boolean;
  /** Başlık altına italik tek paragraf (max ~400 karakter, opsiyonel). */
  coverNote: string;
  /** Yönetici özeti için bullet listesi (max 6 satır kullanılır). */
  summaryBullets: string[];
  /** Hızlı senaryo presetleri (örn ["completed", "last30days"]). */
  defaultFilterPresets: FilterPresetId[];
  /** Bağlı kayıtlı görünüm — varsa filtreleri buradan alınır. */
  defaultSavedViewId: string | null;
  pdfOrientation: PdfOrientationOption;
  pdfPageSize: PdfPageSizeOption;
  pdfShowFilterSummary: boolean;
  pdfShowStatusSummary: boolean;
  /** Dışa aktarımda 1..N otomatik sıra numarası sütunu ekle. */
  includeAutoRowNumber: boolean;
};

export type ManagedReportTemplate = {
  id: string;
  user_id: string;
  scope: ReportTemplateScope;
  assignment_scope: ReportTemplateAssignmentScope;
  project_id: string | null;
  is_default: boolean;
  access_mode: ReportTemplateAccessMode;
  allowed_emails: string[];
  name: string;
  description: string;
  template_config: ReportTemplateConfig;
  created_at: string;
  updated_at: string;
};

export type SaveManagedReportTemplateInput = {
  name: string;
  description?: string;
  scope: ReportTemplateScope;
  assignment_scope: ReportTemplateAssignmentScope;
  project_id?: string | null;
  is_default?: boolean;
  access_mode?: ReportTemplateAccessMode;
  allowed_emails?: string[];
  template_config: ReportTemplateConfig;
};

export function defaultReportTemplateConfig(): ReportTemplateConfig {
  return {
    baseTemplateId: "operations",
    pdfTitle: "Canlı Tablo Operasyon Özeti",
    emailSubject: "Canlı Tablo Operasyon Özeti",
    emailMode: "mobile",
    exportScope: "current",
    visibleColumnIds: [],
    unmaskSensitive: false,
    showLogo: false,
    coverNote: "",
    summaryBullets: [],
    defaultFilterPresets: [],
    defaultSavedViewId: null,
    pdfOrientation: "landscape",
    pdfPageSize: "A4",
    pdfShowFilterSummary: true,
    pdfShowStatusSummary: true,
    includeAutoRowNumber: false,
  };
}

function coerceFilterPreset(v: unknown): FilterPresetId | null {
  return v === "completed" || v === "overdue" || v === "last7days" || v === "last30days" || v === "highPriority"
    ? v
    : null;
}

function coercePdfOrientation(v: unknown): PdfOrientationOption {
  return v === "portrait" ? "portrait" : "landscape";
}

function coercePdfPageSize(v: unknown): PdfPageSizeOption {
  return v === "A3" || v === "Letter" ? v : "A4";
}

function normalizeConfig(raw: unknown): ReportTemplateConfig {
  const base = defaultReportTemplateConfig();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  return {
    baseTemplateId: String(row.baseTemplateId ?? base.baseTemplateId) as ReportTemplateId,
    pdfTitle: String(row.pdfTitle ?? base.pdfTitle),
    emailSubject: String(row.emailSubject ?? base.emailSubject),
    emailMode: row.emailMode === "table" ? "table" : "mobile",
    exportScope: row.exportScope === "all" ? "all" : "current",
    visibleColumnIds: Array.isArray(row.visibleColumnIds)
      ? row.visibleColumnIds.map((v) => String(v).trim()).filter(Boolean)
      : [],
    unmaskSensitive: row.unmaskSensitive === true,
    showLogo: row.showLogo === true,
    coverNote: typeof row.coverNote === "string" ? row.coverNote : "",
    summaryBullets: Array.isArray(row.summaryBullets)
      ? row.summaryBullets.map((v) => String(v).trim()).filter(Boolean).slice(0, 12)
      : [],
    defaultFilterPresets: Array.isArray(row.defaultFilterPresets)
      ? (row.defaultFilterPresets
          .map(coerceFilterPreset)
          .filter((v): v is FilterPresetId => v !== null))
      : [],
    defaultSavedViewId:
      typeof row.defaultSavedViewId === "string" && row.defaultSavedViewId.trim()
        ? row.defaultSavedViewId.trim()
        : null,
    pdfOrientation: coercePdfOrientation(row.pdfOrientation),
    pdfPageSize: coercePdfPageSize(row.pdfPageSize),
    pdfShowFilterSummary: row.pdfShowFilterSummary !== false, // default true
    pdfShowStatusSummary: row.pdfShowStatusSummary !== false, // default true
    includeAutoRowNumber: row.includeAutoRowNumber === true,
  };
}

function rowToTemplate(row: Record<string, unknown>): ManagedReportTemplate {
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? ""),
    scope: row.scope === "shared" ? "shared" : "private",
    assignment_scope: row.assignment_scope === "project" ? "project" : "system",
    project_id: row.project_id == null ? null : String(row.project_id),
    is_default: row.is_default === true,
    access_mode:
      row.access_mode === "admin_pm" ||
      row.access_mode === "project_team" ||
      row.access_mode === "email_list"
        ? row.access_mode
        : "all",
    allowed_emails: Array.isArray(row.allowed_emails)
      ? row.allowed_emails.map((email) => String(email).trim().toLowerCase()).filter(Boolean)
      : [],
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    template_config: normalizeConfig(row.template_config),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function friendlyReportTemplateError(error: { code?: string; message?: string } | null): Error {
  const raw = error?.message ?? "";
  if (error?.code === "42P01" || /report_templates/i.test(raw)) {
    return new Error("report_templates tablosu yok. scripts/report-templates.sql dosyasını Supabase SQL Editor'da çalıştırın.");
  }
  if (error?.code === "42501") {
    return new Error("Rapor şablonları için yetki yok. SQL RLS politikalarını ve kullanıcı rolünü kontrol edin.");
  }
  return new Error(raw || "Rapor şablonu işlemi tamamlanamadı.");
}

export async function listManagedReportTemplates(): Promise<ManagedReportTemplate[]> {
  const { data, error } = await supabase
    .from("report_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw friendlyReportTemplateError(error);
  return (data ?? []).map(rowToTemplate);
}

export async function createManagedReportTemplate(input: SaveManagedReportTemplateInput): Promise<string> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) throw new Error("Oturum açık değil.");
  if (input.is_default) await clearManagedReportTemplateDefault(input.assignment_scope, input.project_id ?? null);
  const { data, error } = await supabase
    .from("report_templates")
    .insert({
      user_id: uid,
      scope: input.scope,
      assignment_scope: input.assignment_scope,
      project_id: input.assignment_scope === "project" ? input.project_id ?? null : null,
      is_default: input.is_default === true,
      access_mode: input.access_mode ?? "all",
      allowed_emails: input.allowed_emails ?? [],
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      template_config: input.template_config,
    })
    .select("id")
    .single();
  if (error) throw friendlyReportTemplateError(error);
  return String(data.id);
}

export async function updateManagedReportTemplate(
  id: string,
  input: SaveManagedReportTemplateInput
): Promise<void> {
  if (input.is_default) await clearManagedReportTemplateDefault(input.assignment_scope, input.project_id ?? null, id);
  const { error } = await supabase
    .from("report_templates")
    .update({
      scope: input.scope,
      assignment_scope: input.assignment_scope,
      project_id: input.assignment_scope === "project" ? input.project_id ?? null : null,
      is_default: input.is_default === true,
      access_mode: input.access_mode ?? "all",
      allowed_emails: input.allowed_emails ?? [],
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      template_config: input.template_config,
    })
    .eq("id", id);
  if (error) throw friendlyReportTemplateError(error);
}

export async function deleteManagedReportTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("report_templates").delete().eq("id", id);
  if (error) throw friendlyReportTemplateError(error);
}

export async function clearManagedReportTemplateDefault(
  assignmentScope: ReportTemplateAssignmentScope,
  projectId?: string | null,
  exceptId?: string
): Promise<void> {
  let query = supabase
    .from("report_templates")
    .update({ is_default: false })
    .eq("assignment_scope", assignmentScope)
    .eq("is_default", true);
  if (assignmentScope === "project") {
    if (!projectId) return;
    query = query.eq("project_id", projectId);
  } else {
    query = query.is("project_id", null);
  }
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) throw friendlyReportTemplateError(error);
}

/* -------------------------------------------------------------------------- */
/* Filtre presetleri → SavedViewConfig.filters dönüşümü                        */
/* -------------------------------------------------------------------------- */

/** "Sadece tamamlananlar"da varsayılan olarak kabul edilen durum etiketleri. */
const DEFAULT_COMPLETED_STATUSES = ["Tamamlandı", "Done", "Bitti", "Closed"];
/** "Yüksek öncelik"te varsayılan olarak kabul edilen öncelik etiketleri. */
const DEFAULT_HIGH_PRIORITIES = ["High", "Yüksek", "Kritik", "Urgent"];

/** Bir preset listesini canlı tabloda uygulanabilir filtre objesine çevirir. */
export function filterPresetsToConfig(
  presets: FilterPresetId[]
): SavedViewConfig["filters"] {
  if (!presets || presets.length === 0) return undefined;
  const filters: NonNullable<SavedViewConfig["filters"]> = {};
  const today = new Date();
  const toISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  for (const preset of presets) {
    switch (preset) {
      case "completed":
        filters.statusFilter = Array.from(
          new Set([...(filters.statusFilter ?? []), ...DEFAULT_COMPLETED_STATUSES])
        );
        break;
      case "overdue":
        // Yarın 00:00'dan önce (yani bugün ve geçmiş) bitenler, henüz tamamlanmamış
        filters.dateTo = toISODate(today);
        filters.datePreset = "overdue";
        break;
      case "last7days": {
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        filters.dateFrom = toISODate(start);
        filters.dateTo = toISODate(today);
        filters.datePreset = "last7days";
        break;
      }
      case "last30days": {
        const start = new Date(today);
        start.setDate(start.getDate() - 29);
        filters.dateFrom = toISODate(start);
        filters.dateTo = toISODate(today);
        filters.datePreset = "last30days";
        break;
      }
      case "highPriority": {
        const key = "priority";
        const existing = filters.columnFilters?.[key] ?? [];
        filters.columnFilters = {
          ...(filters.columnFilters ?? {}),
          [key]: Array.from(new Set([...existing, ...DEFAULT_HIGH_PRIORITIES])),
        };
        break;
      }
    }
  }

  return filters;
}

/** Kullanıcıya gösterilecek özet (chip etiketleri). */
export function describeFilterPresets(presets: FilterPresetId[]): string[] {
  return (presets ?? []).map((id) => FILTER_PRESET_LABELS[id]).filter(Boolean);
}
