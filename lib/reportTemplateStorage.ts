import type { EmailTemplateMode, PdfExportScope, ReportTemplateId } from "@/lib/liveTableExport";

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
  updatedAt: string;
};

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
