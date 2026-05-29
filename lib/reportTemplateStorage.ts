import type { EmailTemplateMode, PdfExportScope, ReportTemplateId } from "@/lib/liveTableExport";
import type { FilterPresetId, PdfOrientationOption, PdfPageSizeOption } from "@/lib/reportTemplates";

const STORAGE_PREFIX = "dashboardapp.reportTemplates.v1:";

export type SavedReportTemplate = {
  id: string;
  name: string;
  baseTemplateId: ReportTemplateId;
  pdfTitle: string;
  emailSubject: string;
  emailMode: EmailTemplateMode;
  scope: PdfExportScope;
  visibleColumnIds: string[];
  unmaskSensitive: boolean;
  showLogo: boolean;
  coverNote: string;
  summaryBullets: string[];
  defaultFilterPresets: FilterPresetId[];
  defaultSavedViewId: string | null;
  pdfOrientation: PdfOrientationOption;
  pdfPageSize: PdfPageSizeOption;
  pdfShowFilterSummary: boolean;
  pdfShowStatusSummary: boolean;
  /** Dışa aktarımda ilk sütun olarak 1..N otomatik sıra numarası ekle. */
  includeAutoRowNumber: boolean;
  updatedAt: string;
};

function coerceFilterPreset(value: unknown): FilterPresetId | null {
  return value === "completed" || value === "overdue" || value === "last7days" || value === "last30days" || value === "highPriority"
    ? value
    : null;
}

function storageKey(userEmail?: string | null): string {
  const owner = (userEmail ?? "anonymous").trim().toLowerCase() || "anonymous";
  return `${STORAGE_PREFIX}${owner}`;
}

function normalizeTemplate(raw: unknown): SavedReportTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const name = String(row.name ?? "").trim();
  const baseTemplateId = String(row.baseTemplateId ?? "operations") as ReportTemplateId;
  const emailMode = row.emailMode === "table" ? "table" : "mobile";
  const scope = row.scope === "all" ? "all" : "current";
  const visibleColumnIds = Array.isArray(row.visibleColumnIds)
    ? row.visibleColumnIds.map((v) => String(v).trim()).filter(Boolean)
    : [];

  if (!id || !name) return null;
  return {
    id,
    name,
    baseTemplateId,
    pdfTitle: String(row.pdfTitle ?? "").trim(),
    emailSubject: String(row.emailSubject ?? "").trim(),
    emailMode,
    scope,
    visibleColumnIds,
    unmaskSensitive: row.unmaskSensitive === true,
    showLogo: row.showLogo === true,
    coverNote: typeof row.coverNote === "string" ? row.coverNote : "",
    summaryBullets: Array.isArray(row.summaryBullets)
      ? row.summaryBullets.map((v) => String(v).trim()).filter(Boolean).slice(0, 12)
      : [],
    defaultFilterPresets: Array.isArray(row.defaultFilterPresets)
      ? row.defaultFilterPresets.map(coerceFilterPreset).filter((v): v is FilterPresetId => v !== null)
      : [],
    defaultSavedViewId:
      typeof row.defaultSavedViewId === "string" && row.defaultSavedViewId.trim()
        ? row.defaultSavedViewId.trim()
        : null,
    pdfOrientation: row.pdfOrientation === "portrait" ? "portrait" : "landscape",
    pdfPageSize: row.pdfPageSize === "A3" || row.pdfPageSize === "Letter" ? row.pdfPageSize : "A4",
    pdfShowFilterSummary: row.pdfShowFilterSummary !== false,
    pdfShowStatusSummary: row.pdfShowStatusSummary !== false,
    includeAutoRowNumber: row.includeAutoRowNumber === true,
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };
}

export function loadSavedReportTemplates(userEmail?: string | null): SavedReportTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userEmail));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTemplate).filter((t): t is SavedReportTemplate => t != null);
  } catch {
    return [];
  }
}

export function persistSavedReportTemplates(userEmail: string | null | undefined, templates: SavedReportTemplate[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userEmail), JSON.stringify(templates));
}

export function makeSavedReportTemplateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `report-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
