"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Table, VisibilityState } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import type { DateFormat } from "@/contexts/settings-context";
import type { AdvancedFilterRule } from "@/lib/liveTableAdvancedFilters";
import { advancedFilterRuleIsActive } from "@/lib/liveTableAdvancedFilters";
import {
  builtinReportTemplateSelection,
  customReportTemplateSelection,
  managedReportTemplateSelection,
  COLUMN_LABELS,
  type ReportTemplateSelection,
} from "@/components/tasks-table/constants";
import {
  REPORT_TEMPLATES,
  createEmailTemplate,
  createPDFPreviewUrl,
  downloadCSV,
  downloadExcel,
  downloadPDF,
  buildExportColumnIds,
  type EmailTemplateMode,
  type PdfExportMetadata,
  type PdfExportScope,
  type PdfRenderOptions,
  type ReportTemplateId,
} from "@/lib/liveTableExport";
import { DEFAULT_ORG_BRANDING, fetchOrgBranding, type OrgBranding } from "@/lib/appSettingsSupabase";
import { filterPresetsToConfig } from "@/lib/reportTemplates";
import {
  loadSavedReportTemplates,
  makeSavedReportTemplateId,
  persistSavedReportTemplates,
  type SavedReportTemplate,
} from "@/lib/reportTemplateStorage";
import { listManagedReportTemplates, type ManagedReportTemplate } from "@/lib/reportTemplates";
import { listSavedViews, type SavedView, type SavedViewConfig } from "@/lib/savedViews";
import { isSensitiveExtraColumnKey } from "@/lib/extraColumnSensitiveDisplay";
import { logPiiAccess } from "@/lib/piiAccessLog";
import { isStatusDone, isStatusInProgress } from "@/lib/statusKind";
import type { buildChipValueResolver } from "@/lib/chipSystem";

type ToastApi = {
  error: (msg: string) => void;
  success: (msg: string, opts?: { durationMs?: number }) => void;
  info: (msg: string, opts?: { durationMs?: number }) => void;
  warning: (msg: string) => void;
};

type AuthUser = {
  id?: string;
  email?: string | null;
  displayName?: string | null;
  roleId?: string | null;
};

export type UseTasksTableExportOptions = {
  table: Table<Task>;
  tasks: Task[];
  filteredData: Task[];
  canExportRow: (task: Task) => boolean;
  canExportUnmaskedRow: (task: Task) => boolean;
  canExportSensitiveUnmasked: boolean;
  canExportAllRows: boolean;
  projectPermissionsAvailable: boolean;
  currentUserEmail: string;
  user: AuthUser | null;
  isAdmin: boolean;
  projectById: Map<string, Project>;
  projectFilter: string[];
  dateFormat: DateFormat;
  chipResolver: ReturnType<typeof buildChipValueResolver>;
  logSensitivePolicyDecision: (args: {
    fieldKey: string;
    action: "view" | "edit" | "copy" | "export_masked" | "export_unmasked";
    legacyDecision: "allow" | "deny";
    task?: Task | null;
    context?: Record<string, unknown>;
    projectId?: string | null;
  }) => void | Promise<void>;
  toast: ToastApi;
  promptUser: (args: {
    title: string;
    message: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
  }) => Promise<string | null | undefined>;
  projectLinkedFilter: "proje" | "tümü";
  globalSearch: string;
  statusFilter: string[];
  assigneeFilter: string[];
  dateFrom: string;
  dateTo: string;
  datePreset: string;
  columnFilters: Record<string, string[]>;
  advancedFilterRules: AdvancedFilterRule[];
  applyViewConfig: (config: SavedViewConfig) => void;
  applyFilterConfigPatch: (filters?: SavedViewConfig["filters"]) => void;
  setColumnVisibility: Dispatch<SetStateAction<VisibilityState>>;
};

export function useTasksTableExport({
  table,
  tasks,
  filteredData,
  canExportRow,
  canExportUnmaskedRow,
  canExportSensitiveUnmasked,
  canExportAllRows,
  projectPermissionsAvailable,
  currentUserEmail,
  user,
  isAdmin,
  projectById,
  projectFilter,
  dateFormat,
  chipResolver,
  logSensitivePolicyDecision,
  toast,
  promptUser,
  projectLinkedFilter,
  globalSearch,
  statusFilter,
  assigneeFilter,
  dateFrom,
  dateTo,
  datePreset,
  columnFilters,
  advancedFilterRules,
  applyViewConfig,
  applyFilterConfigPatch,
  setColumnVisibility,
}: UseTasksTableExportOptions) {
  const [reportTemplateSelection, setReportTemplateSelection] = useState<ReportTemplateSelection>(builtinReportTemplateSelection("operations"));
  const [savedReportTemplates, setSavedReportTemplates] = useState<SavedReportTemplate[]>([]);
  const [managedReportTemplates, setManagedReportTemplates] = useState<ManagedReportTemplate[]>([]);
  const [reportSavedViews, setReportSavedViews] = useState<SavedView[]>([]);
  const [orgBranding, setOrgBranding] = useState<OrgBranding>(DEFAULT_ORG_BRANDING);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pdfDialogScope, setPdfDialogScope] = useState<PdfExportScope>("current");
  const [pdfTitleInput, setPdfTitleInput] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const pdfPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfDownloadLoading, setPdfDownloadLoading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubjectInput, setEmailSubjectInput] = useState("Canlı Tablo Görev Raporu");
  const [emailTemplateMode, setEmailTemplateMode] = useState<EmailTemplateMode>("mobile");
  const [emailCopied, setEmailCopied] = useState(false);
  const [exportUnmaskSensitive, setExportUnmaskSensitive] = useState(false);
  const [exportIncludeAutoRowNumber, setExportIncludeAutoRowNumber] = useState(false);

  useEffect(() => {
    if (!canExportSensitiveUnmasked && exportUnmaskSensitive) {
      setExportUnmaskSensitive(false);
    }
  }, [canExportSensitiveUnmasked, exportUnmaskSensitive]);

  useEffect(() => {
    setSavedReportTemplates(loadSavedReportTemplates(currentUserEmail));
  }, [currentUserEmail]);

  useEffect(() => {
    let cancelled = false;
    void listManagedReportTemplates()
      .then((templates) => {
        if (!cancelled) setManagedReportTemplates(templates);
      })
      .catch(() => {
        if (!cancelled) setManagedReportTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listSavedViews("live_table")
      .then((views) => {
        if (!cancelled) setReportSavedViews(views);
      })
      .catch(() => {
        if (!cancelled) setReportSavedViews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Kurumsal kimlik (logo / kurum adı / footer) — şablonlarda kullanılır
  useEffect(() => {
    let cancelled = false;
    void fetchOrgBranding().then((value) => {
      if (!cancelled) setOrgBranding(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const getExportRows = useCallback(
    (scope: PdfExportScope) => {
      const baseRows = scope === "all" ? tasks : filteredData;
      return baseRows.filter((task) => canExportRow(task));
    },
    [canExportRow, filteredData, tasks]
  );

  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => (c.id ?? (c as { accessorKey?: string }).accessorKey ?? "").toString()).filter(Boolean);
  const exportColumnIds = useMemo(
    () => buildExportColumnIds(visibleColumnIds, exportIncludeAutoRowNumber),
    [visibleColumnIds, exportIncludeAutoRowNumber]
  );
  /** Export sırasında hassas sütunların ham olarak yazılıp yazılmayacağı.
   *  Ayrı izin yoksa toggle görünse bile ham veri yazılmaz.
   */
  const selectedPdfRows = useMemo(
    () => getExportRows(pdfDialogScope),
    [getExportRows, pdfDialogScope]
  );
  const exportCurrentRows = useMemo(() => getExportRows("current"), [getExportRows]);
  const exportAllRows = useMemo(() => getExportRows("all"), [getExportRows]);
  const canUnmaskExportRows = useCallback(
    (rows: Task[]) => canExportSensitiveUnmasked && exportUnmaskSensitive && rows.every((task) => canExportUnmaskedRow(task)),
    [canExportSensitiveUnmasked, canExportUnmaskedRow, exportUnmaskSensitive]
  );
  const effectiveUnmaskSensitive = canUnmaskExportRows(selectedPdfRows);
  const exportScopeLabel = projectPermissionsAvailable
    ? "Proje bazlı izin verilen satırlar"
    : canExportAllRows
      ? "Tüm erişilebilir satırlar"
      : "Sadece düzenleyebildiğin satırlar";
  const exportSensitivityLabel = effectiveUnmaskSensitive ? "Hassas veri açık" : "Hassas veri maskeli";
  const availableManagedReportTemplates = useMemo(() => {
    const isStaff = isAdmin || user?.roleId === "project_manager";
    return managedReportTemplates.filter((template) => {
      if (template.template_config.unmaskSensitive && !canExportSensitiveUnmasked) return false;
      if (template.user_id && user?.id === template.user_id) return true;
      if (isStaff) return true;
      if (template.access_mode === "all") return true;
      if (template.access_mode === "admin_pm") return false;
      if (template.access_mode === "email_list") {
        return !!currentUserEmail && template.allowed_emails.includes(currentUserEmail);
      }
      if (template.access_mode === "project_team") {
        const project = template.project_id ? projectById.get(template.project_id) : null;
        return !!project && (project.assigned_emails ?? []).some((email) => email.trim().toLowerCase() === currentUserEmail);
      }
      return false;
    });
  }, [canExportSensitiveUnmasked, currentUserEmail, isAdmin, managedReportTemplates, projectById, user?.id, user?.roleId]);
  const selectedCustomReportTemplate = reportTemplateSelection.startsWith("custom:")
    ? savedReportTemplates.find((template) => customReportTemplateSelection(template.id) === reportTemplateSelection) ?? null
    : null;
  const selectedManagedReportTemplate = reportTemplateSelection.startsWith("managed:")
    ? availableManagedReportTemplates.find((template) => managedReportTemplateSelection(template.id) === reportTemplateSelection) ?? null
    : null;
  const selectedBaseReportTemplateId: ReportTemplateId = reportTemplateSelection.startsWith("builtin:")
    ? (reportTemplateSelection.replace("builtin:", "") as ReportTemplateId)
    : selectedCustomReportTemplate?.baseTemplateId ?? selectedManagedReportTemplate?.template_config.baseTemplateId ?? "operations";
  const selectedBuiltInReportTemplate = REPORT_TEMPLATES[selectedBaseReportTemplateId] ?? REPORT_TEMPLATES.operations;
  const selectedReportTemplate = selectedCustomReportTemplate || selectedManagedReportTemplate
    ? {
        label: selectedCustomReportTemplate?.name ?? selectedManagedReportTemplate?.name ?? selectedBuiltInReportTemplate.label,
        description: selectedCustomReportTemplate
          ? `Kayıtlı özel şablon · ${selectedBuiltInReportTemplate.label} tabanlı`
          : `Kurumsal şablon · ${selectedBuiltInReportTemplate.label} tabanlı`,
      }
    : selectedBuiltInReportTemplate;
  const selectedPdfTitle = pdfTitleInput.trim() || null;

  /**
   * Yönetilen şablonun sunum/marka/PDF görünüm ayarlarını ve org_branding'i
   * tek bir PdfRenderOptions objesine birleştirir. Builtin/custom şablonlarda
   * yalnızca org_branding (logo gerekirse) etkili olur.
   */
  const pdfRenderOptions = useMemo<PdfRenderOptions>(() => {
    const config = selectedManagedReportTemplate?.template_config ?? selectedCustomReportTemplate;
    const includeLogo = config?.showLogo === true;
    const brandingForRender = includeLogo
      ? {
          logoUrl: orgBranding.logoUrl || undefined,
          orgName: orgBranding.orgName || undefined,
          footerText: orgBranding.pdfFooterText || undefined,
        }
      : {
          // Logo gösterilmese de footer metni kurumsal olarak kalır
          footerText: orgBranding.pdfFooterText || undefined,
        };
    return {
      orientation: config?.pdfOrientation,
      pageSize: config?.pdfPageSize,
      showFilterSummary: config?.pdfShowFilterSummary,
      showStatusSummary: config?.pdfShowStatusSummary,
      branding: brandingForRender,
      coverNote: config?.coverNote || undefined,
      summaryBullets: config?.summaryBullets,
    };
  }, [selectedCustomReportTemplate, selectedManagedReportTemplate, orgBranding]);
  const pdfExportMetadata = useMemo<PdfExportMetadata>(() => {
    const generatedAt = new Date().toLocaleString("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const exportedBy = (user?.displayName || user?.email || "Bilinmeyen kullanıcı").trim();
    const doneCount = selectedPdfRows.filter((task) => isStatusDone(task.status)).length;
    const inProgressCount = selectedPdfRows.filter((task) => isStatusInProgress(task.status)).length;
    const todoCount = Math.max(0, selectedPdfRows.length - doneCount - inProgressCount);
    const statusSummary = `Yapılacak: ${todoCount}, Devam ediyor: ${inProgressCount}, Tamamlandı: ${doneCount}`;

    const datePresetLabels: Record<string, string> = {
      today: "Bugün",
      tomorrow: "Yarın",
      thisWeek: "Bu hafta",
      nextWeek: "Gelecek hafta",
      thisMonth: "Bu ay",
      nextMonth: "Gelecek ay",
      last7days: "Son 7 gün",
      last30days: "Son 30 gün",
    };

    const filterSummary: string[] = [];
    if (pdfDialogScope === "all") {
      filterSummary.push(
        canExportAllRows
          ? "Tüm erişilebilir veri dışa aktarıldı; ekrandaki filtreler uygulanmadı."
          : "Tüm veri isteği, yetki nedeniyle sadece düzenleyebildiğiniz satırlarla sınırlandı."
      );
    } else {
      filterSummary.push(
        projectLinkedFilter === "proje"
          ? "Görev kapsamı: Sadece proje görevleri"
          : "Görev kapsamı: Tüm görevler"
      );
      if (globalSearch.trim()) filterSummary.push(`Arama: ${globalSearch.trim()}`);
      if (statusFilter.length > 0) filterSummary.push(`Durum: ${statusFilter.join(", ")}`);
      if (assigneeFilter.length > 0) {
        filterSummary.push(
          `Atanan: ${assigneeFilter.map((value) => (value === "__unassigned__" ? "Atanmamış" : value)).join(", ")}`
        );
      }
      if (projectFilter.length > 0) {
        filterSummary.push(
          `Proje: ${projectFilter
            .map((id) => (projectById.get(id)?.name ?? id).trim() || "(adsız proje)")
            .join(", ")}`
        );
      }
      if (dateFrom || dateTo || datePreset !== "custom") {
        const dateLabel =
          datePreset !== "custom"
            ? `${datePresetLabels[datePreset] ?? datePreset}${dateFrom || dateTo ? ` (${dateFrom || "..."} → ${dateTo || "..."})` : ""}`
            : dateFrom && dateTo
              ? `${dateFrom} → ${dateTo}`
              : dateFrom
                ? `${dateFrom}'den itibaren`
                : `${dateTo}'e kadar`;
        filterSummary.push(`Tarih aralığı: ${dateLabel}`);
      }
      const activeColumnFilters = Object.entries(columnFilters).filter(([, values]) => values.length > 0);
      if (activeColumnFilters.length > 0) {
        filterSummary.push(
          `Sütun filtreleri: ${activeColumnFilters
            .map(([id, values]) => {
              const label = COLUMN_LABELS[id] ?? (id.startsWith("extra:") ? id.replace(/^extra:/, "") : id);
              return `${label} (${values.length})`;
            })
            .join(", ")}`
        );
      }
      const activeAdvancedCount = advancedFilterRules.filter(advancedFilterRuleIsActive).length;
      if (activeAdvancedCount > 0) filterSummary.push(`Gelişmiş filtre kuralları: ${activeAdvancedCount}`);
      if (filterSummary.length === 1) filterSummary.push("Ek filtre uygulanmadı.");
    }
    if (!canExportAllRows) {
      filterSummary.push("Yetki kapsamı: sadece düzenleyebildiğiniz satırlar dışa aktarılır.");
    }

    return {
      generatedAt,
      scopeLabel: pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm",
      exportedBy,
      reportTemplateLabel: selectedReportTemplate.label,
      sensitivityLabel: effectiveUnmaskSensitive ? "Ham hassas veriler dahil" : "Hassas veriler maskeli",
      filterSummary,
      statusSummary,
    };
  }, [
    selectedPdfRows,
    user,
    pdfDialogScope,
    projectLinkedFilter,
    globalSearch,
    statusFilter,
    assigneeFilter,
    projectFilter,
    projectById,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    effectiveUnmaskSensitive,
    selectedReportTemplate.label,
    canExportAllRows,
  ]);
  const emailTemplate = useMemo(
    () =>
      createEmailTemplate(
        selectedPdfRows,
        exportColumnIds,
        dateFormat,
        projectById,
        effectiveUnmaskSensitive,
        emailSubjectInput,
        pdfExportMetadata,
        emailTemplateMode,
        pdfRenderOptions,
        chipResolver
      ),
    [
      selectedPdfRows,
      exportColumnIds,
      dateFormat,
      projectById,
      effectiveUnmaskSensitive,
      emailSubjectInput,
      pdfExportMetadata,
      emailTemplateMode,
      pdfRenderOptions,
      chipResolver,
    ]
  );

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  /**
   * Export sonrası shadow policy logu (masked/unmasked) + unmasked ise PII denetim logu.
   */
  const logSensitiveExport = useCallback(
    async (rows: Task[], unmasked: boolean, scope: "current" | "all") => {
      if (!user?.id || !user?.email) return;
      const sensitiveKeys = new Set<string>();
      for (const id of visibleColumnIds) {
        if (id.startsWith("extra:")) {
          const k = id.replace(/^extra:/, "");
          if (isSensitiveExtraColumnKey(k)) sensitiveKeys.add(k);
        }
      }
      if (sensitiveKeys.size === 0) return;
      const projectIds = Array.from(
        new Set(rows.map((row) => (row.project_id ? String(row.project_id) : "")).filter(Boolean))
      );
      const resolvedProjectId = projectIds.length === 1 ? projectIds[0] : null;
      const action = unmasked ? "export_unmasked" : "export_masked";
      await Promise.all(
        Array.from(sensitiveKeys).map(async (key) => {
          await logSensitivePolicyDecision({
            fieldKey: key,
            action,
            legacyDecision: "allow",
            projectId: resolvedProjectId,
            context: {
              source: "export",
              scope,
              rowCount: rows.length,
              projectIds,
            },
          });
          if (!unmasked || !user?.email) return;
          await logPiiAccess({
            userEmail: user.email,
            action: "export",
            fieldName: key,
            recordCount: rows.length,
          });
        })
      );
      if (unmasked) {
        toast.info("Hassas alanlar denetim kayıtlarına yazıldı", { durationMs: 2500 });
      }
    },
    [user, visibleColumnIds, toast, logSensitivePolicyDecision]
  );

  const handleExportCSV = useCallback(
    (scope: "current" | "all") => {
      const rows = getExportRows(scope);
      if (rows.length === 0) {
        toast.error("Dışa aktarılacak yetkili satır bulunamadı.");
        return;
      }
      const unmaskSensitive = canUnmaskExportRows(rows);
      downloadCSV(
        rows,
        exportColumnIds,
        dateFormat,
        `gorevler-${scope === "all" ? "tum" : "gorunum"}${unmaskSensitive ? "-ham" : ""}-${Date.now()}.csv`,
        projectById,
        unmaskSensitive,
        chipResolver
      );
      void logSensitiveExport(rows, unmaskSensitive, scope);
      if (unmaskSensitive) {
        toast.success("Hassas veriler AÇIK olarak indirildi (yetkili onay)");
      }
    },
    [getExportRows, canUnmaskExportRows, exportColumnIds, dateFormat, projectById, chipResolver, toast, logSensitiveExport]
  );
  const handleExportExcel = useCallback(
    (scope: "current" | "all") => {
      const rows = getExportRows(scope);
      if (rows.length === 0) {
        toast.error("Dışa aktarılacak yetkili satır bulunamadı.");
        return;
      }
      const unmaskSensitive = canUnmaskExportRows(rows);
      downloadExcel(
        rows,
        exportColumnIds,
        dateFormat,
        `gorevler-${scope === "all" ? "tum" : "gorunum"}${unmaskSensitive ? "-ham" : ""}-${Date.now()}.xlsx`,
        projectById,
        unmaskSensitive,
        chipResolver
      );
      void logSensitiveExport(rows, unmaskSensitive, scope);
      if (unmaskSensitive) {
        toast.success("Hassas veriler AÇIK olarak indirildi (yetkili onay)");
      }
    },
    [getExportRows, canUnmaskExportRows, exportColumnIds, dateFormat, projectById, chipResolver, toast, logSensitiveExport]
  );
  const applyReportTemplate = useCallback((selection: ReportTemplateSelection) => {
    const isCustom = selection.startsWith("custom:");
    const customTemplate = isCustom
      ? savedReportTemplates.find((template) => customReportTemplateSelection(template.id) === selection) ?? null
      : null;
    const managedTemplate = selection.startsWith("managed:")
      ? availableManagedReportTemplates.find((template) => managedReportTemplateSelection(template.id) === selection) ?? null
      : null;
    const managedConfig = managedTemplate?.template_config;
    const builtinId = selection.startsWith("builtin:")
      ? (selection.replace("builtin:", "") as ReportTemplateId)
      : customTemplate?.baseTemplateId ?? managedConfig?.baseTemplateId ?? "operations";
    const template = REPORT_TEMPLATES[builtinId] ?? REPORT_TEMPLATES.operations;

    setReportTemplateSelection(selection);
    setPdfTitleInput(customTemplate?.pdfTitle || managedConfig?.pdfTitle || template.pdfTitle);
    setEmailSubjectInput(customTemplate?.emailSubject || managedConfig?.emailSubject || template.emailSubject);
    setEmailTemplateMode(customTemplate?.emailMode ?? managedConfig?.emailMode ?? template.emailMode);
    setEmailCopied(false);

    const reusableConfig = customTemplate
      ? {
          exportScope: customTemplate.scope,
          visibleColumnIds: customTemplate.visibleColumnIds,
          unmaskSensitive: customTemplate.unmaskSensitive,
          defaultSavedViewId: customTemplate.defaultSavedViewId,
          defaultFilterPresets: customTemplate.defaultFilterPresets,
        }
      : managedConfig;

    if (reusableConfig) {
      setPdfDialogScope(reusableConfig.exportScope);
      setExportUnmaskSensitive(canExportSensitiveUnmasked && reusableConfig.unmaskSensitive);
      setExportIncludeAutoRowNumber(
        customTemplate?.includeAutoRowNumber === true ||
          (managedConfig != null && managedConfig.includeAutoRowNumber === true)
      );
      const savedVisible = new Set(reusableConfig.visibleColumnIds);
      if (savedVisible.size > 0) {
        const allColumnIds = table
          .getAllLeafColumns()
          .map((column) => (column.id ?? (column as { accessorKey?: string }).accessorKey ?? "").toString())
          .filter(Boolean);
        setColumnVisibility((prev) => {
          const next = { ...prev };
          for (const id of allColumnIds) {
            if (savedVisible.has(id)) delete next[id];
            else next[id] = false;
          }
          return next;
        });
      }

      const savedViewId = reusableConfig.defaultSavedViewId;
      if (savedViewId) {
        const savedView = reportSavedViews.find((view) => view.id === savedViewId);
        if (savedView) {
          applyViewConfig(savedView.config);
        } else {
          toast.warning("Şablona bağlı kayıtlı görünüm bulunamadı.");
        }
      }
      const presetFilters = filterPresetsToConfig(reusableConfig.defaultFilterPresets ?? []);
      if (presetFilters) {
        applyFilterConfigPatch(presetFilters);
      }
    }

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  }, [
    applyFilterConfigPatch,
    applyViewConfig,
    availableManagedReportTemplates,
    canExportSensitiveUnmasked,
    pdfPreviewUrl,
    reportSavedViews,
    savedReportTemplates,
    table,
    toast,
  ]);

  const saveCurrentReportTemplate = useCallback(async () => {
    const name = await promptUser({
      title: "Rapor şablonu kaydet",
      message: "Mevcut export ayarlarını tekrar kullanmak için bir şablon adı gir:",
      defaultValue: selectedReportTemplate.label,
      placeholder: "Örn. Haftalık yönetici özeti",
      confirmLabel: "Kaydet",
    });
    const cleanName = name?.trim();
    if (!cleanName) return;
    const id = makeSavedReportTemplateId();
    const presentationConfig = selectedManagedReportTemplate?.template_config ?? selectedCustomReportTemplate;
    const template: SavedReportTemplate = {
      id,
      name: cleanName,
      baseTemplateId: selectedBaseReportTemplateId,
      pdfTitle: pdfTitleInput.trim() || selectedBuiltInReportTemplate.pdfTitle,
      emailSubject: emailSubjectInput.trim() || selectedBuiltInReportTemplate.emailSubject,
      emailMode: emailTemplateMode,
      scope: pdfDialogScope,
      visibleColumnIds,
      unmaskSensitive: effectiveUnmaskSensitive,
      showLogo: presentationConfig?.showLogo ?? false,
      coverNote: presentationConfig?.coverNote ?? "",
      summaryBullets: presentationConfig?.summaryBullets ?? [],
      defaultFilterPresets: presentationConfig?.defaultFilterPresets ?? [],
      defaultSavedViewId: presentationConfig?.defaultSavedViewId ?? null,
      pdfOrientation: presentationConfig?.pdfOrientation ?? "landscape",
      pdfPageSize: presentationConfig?.pdfPageSize ?? "A4",
      pdfShowFilterSummary: presentationConfig?.pdfShowFilterSummary ?? true,
      pdfShowStatusSummary: presentationConfig?.pdfShowStatusSummary ?? true,
      includeAutoRowNumber: exportIncludeAutoRowNumber,
      updatedAt: new Date().toISOString(),
    };
    const next = [template, ...savedReportTemplates].slice(0, 30);
    setSavedReportTemplates(next);
    persistSavedReportTemplates(currentUserEmail, next);
    setReportTemplateSelection(customReportTemplateSelection(id));
    toast.success("Rapor şablonu kaydedildi");
  }, [
    currentUserEmail,
    effectiveUnmaskSensitive,
    emailSubjectInput,
    emailTemplateMode,
    pdfDialogScope,
    pdfTitleInput,
    promptUser,
    savedReportTemplates,
    selectedBaseReportTemplateId,
    selectedBuiltInReportTemplate.emailSubject,
    selectedBuiltInReportTemplate.pdfTitle,
    selectedCustomReportTemplate,
    selectedManagedReportTemplate,
    selectedReportTemplate.label,
    toast,
    exportIncludeAutoRowNumber,
    visibleColumnIds,
  ]);

  const deleteSelectedReportTemplate = useCallback(() => {
    if (!selectedCustomReportTemplate) return;
    const next = savedReportTemplates.filter((template) => template.id !== selectedCustomReportTemplate.id);
    setSavedReportTemplates(next);
    persistSavedReportTemplates(currentUserEmail, next);
    setReportTemplateSelection(builtinReportTemplateSelection(selectedCustomReportTemplate.baseTemplateId));
    toast.success("Rapor şablonu silindi");
  }, [currentUserEmail, savedReportTemplates, selectedCustomReportTemplate, toast]);

  const getDefaultManagedReportTemplate = useCallback(() => {
    const selectedProjectId = projectFilter.length === 1 ? projectFilter[0] : null;
    if (selectedProjectId) {
      const projectDefault = availableManagedReportTemplates.find(
        (template) =>
          template.is_default &&
          template.assignment_scope === "project" &&
          template.project_id === selectedProjectId
      );
      if (projectDefault) return projectDefault;
    }
    return availableManagedReportTemplates.find(
      (template) =>
        template.is_default &&
        template.assignment_scope === "system"
    ) ?? null;
  }, [availableManagedReportTemplates, projectFilter]);

  const openPdfDialog = useCallback((scope: PdfExportScope) => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    const defaultTemplate = getDefaultManagedReportTemplate();
    if (defaultTemplate) {
      applyReportTemplate(managedReportTemplateSelection(defaultTemplate.id));
    } else {
      setReportTemplateSelection(builtinReportTemplateSelection("operations"));
      setPdfTitleInput(REPORT_TEMPLATES.operations.pdfTitle);
      setEmailSubjectInput(REPORT_TEMPLATES.operations.emailSubject);
      setEmailTemplateMode(REPORT_TEMPLATES.operations.emailMode);
      setPdfDialogScope(scope);
    }
    setPdfDialogOpen(true);
  }, [applyReportTemplate, getDefaultManagedReportTemplate, pdfPreviewUrl]);

  const openEmailDialog = useCallback((scope: PdfExportScope) => {
    const template = scope === "all" ? REPORT_TEMPLATES.fullTable : REPORT_TEMPLATES.mobileBrief;
    const templateId: ReportTemplateId = scope === "all" ? "fullTable" : "mobileBrief";
    const defaultTemplate = getDefaultManagedReportTemplate();
    if (defaultTemplate) {
      applyReportTemplate(managedReportTemplateSelection(defaultTemplate.id));
    } else {
      setPdfDialogScope(scope);
      setReportTemplateSelection(builtinReportTemplateSelection(templateId));
      setPdfTitleInput(template.pdfTitle);
      setEmailSubjectInput(template.emailSubject);
      setEmailTemplateMode(template.emailMode);
    }
    setEmailCopied(false);
    setEmailDialogOpen(true);
  }, [applyReportTemplate, getDefaultManagedReportTemplate]);

  const copyEmailTemplate = useCallback(async () => {
    if (selectedPdfRows.length === 0) {
      toast.error("Kopyalanacak yetkili satır bulunamadı.");
      return;
    }
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([emailTemplate.html], { type: "text/html" }),
            "text/plain": new Blob([emailTemplate.text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(emailTemplate.text);
      }
      setEmailCopied(true);
      toast.success("E-posta şablonu panoya kopyalandı");
    } catch (e) {
      console.error("[Export] E-posta şablonu kopyalanamadı:", e);
      toast.error("E-posta şablonu kopyalanamadı");
    }
  }, [emailTemplate, selectedPdfRows.length, toast]);

  const handlePdfDialogOpenChange = useCallback((open: boolean) => {
    setPdfDialogOpen(open);
    if (open) return;
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    setPdfPreviewLoading(false);
    setPdfDownloadLoading(false);
  }, [pdfPreviewUrl]);

  /**
   * PDF önizleme iframe'ini yazdır.
   * Same-origin blob URL olduğu için contentWindow.print() çalışmalı; başarısız
   * olursa (örn. tarayıcı PDF viewer'ı izin vermezse) URL yeni sekmede açılır.
   */
  const printPdfPreview = useCallback(() => {
    if (!pdfPreviewUrl) {
      toast.error("Önce önizleme oluşturun.");
      return;
    }
    const iframe = pdfPreviewIframeRef.current;
    try {
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      }
    } catch (err) {
      console.warn("[Export] iframe.print() başarısız, yeni sekme deneniyor:", err);
    }
    // Fallback — yeni sekmede aç, kullanıcı oradan yazdırır
    const opened = window.open(pdfPreviewUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.error("Yazdırma penceresi açılamadı (pop-up engellenmiş olabilir).");
    }
  }, [pdfPreviewUrl, toast]);

  /**
   * E-posta şablonu HTML'ini yeni pencerede aç ve yazdırma diyaloğunu tetikle.
   * Bu sayede kullanıcı şablonu yazıcıya gönderebilir veya "PDF olarak kaydet" seçeneğiyle PDF üretebilir.
   */
  const printEmailTemplate = useCallback(() => {
    if (!emailTemplate?.html) {
      toast.error("Yazdırılacak şablon yok.");
      return;
    }
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      toast.error("Yazdırma penceresi açılamadı (pop-up engellenmiş olabilir).");
      return;
    }
    const safeTitle = (emailTemplate.subject || "E-posta şablonu").replace(/[<>]/g, "");
    w.document.open();
    w.document.write(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    @page { margin: 16mm; }
    body { margin: 0; padding: 20px; background: white; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
${emailTemplate.html}
<script>
  (function(){
    function startPrint(){
      try { window.focus(); window.print(); } catch (e) {}
    }
    if (document.readyState === "complete") {
      setTimeout(startPrint, 250);
    } else {
      window.addEventListener("load", function(){ setTimeout(startPrint, 250); });
    }
  })();
</script>
</body>
</html>`);
    w.document.close();
  }, [emailTemplate, toast]);

  const previewExportPDF = useCallback(async () => {
    if (selectedPdfRows.length === 0) {
      toast.error("Önizlenecek yetkili satır bulunamadı.");
      return;
    }
    setPdfPreviewLoading(true);
    try {
      const nextUrl = await createPDFPreviewUrl(
        selectedPdfRows,
        exportColumnIds,
        dateFormat,
        projectById,
        effectiveUnmaskSensitive,
        selectedPdfTitle,
        pdfExportMetadata,
        pdfRenderOptions,
        chipResolver
      );
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch (e) {
      console.error("[Export] PDF önizleme oluşturulamadı:", e);
      toast.error("PDF önizleme oluşturulamadı");
    } finally {
      setPdfPreviewLoading(false);
    }
  }, [selectedPdfRows, exportColumnIds, dateFormat, projectById, effectiveUnmaskSensitive, selectedPdfTitle, pdfExportMetadata, pdfRenderOptions, chipResolver, toast]);

  const confirmExportPDF = useCallback(
    async () => {
      if (selectedPdfRows.length === 0) {
        toast.error("Dışa aktarılacak yetkili satır bulunamadı.");
        return;
      }
      setPdfDownloadLoading(true);
      try {
        await downloadPDF(
          selectedPdfRows,
          exportColumnIds,
          dateFormat,
          `gorevler-${pdfDialogScope === "all" ? "tum" : "gorunum"}${effectiveUnmaskSensitive ? "-ham" : ""}-${Date.now()}.pdf`,
          projectById,
          effectiveUnmaskSensitive,
          selectedPdfTitle,
          pdfExportMetadata,
          pdfRenderOptions,
          chipResolver
        );
        void logSensitiveExport(selectedPdfRows, effectiveUnmaskSensitive, pdfDialogScope);
        if (effectiveUnmaskSensitive) {
          toast.success("Hassas veriler AÇIK olarak indirildi (yetkili onay)");
        }
      } catch (e) {
        console.error("[Export] PDF oluşturulamadı:", e);
        toast.error("PDF oluşturulamadı");
      } finally {
        setPdfDownloadLoading(false);
        handlePdfDialogOpenChange(false);
      }
    },
    [selectedPdfRows, exportColumnIds, dateFormat, pdfDialogScope, effectiveUnmaskSensitive, projectById, selectedPdfTitle, pdfExportMetadata, pdfRenderOptions, chipResolver, toast, logSensitiveExport, handlePdfDialogOpenChange]
  );
  return {
    exportDialogOpen,
    setExportDialogOpen,
    pdfDialogOpen,
    handlePdfDialogOpenChange,
    emailDialogOpen,
    setEmailDialogOpen,
    pdfDialogScope,
    exportScopeLabel,
    exportSensitivityLabel,
    exportCurrentRows,
    exportAllRows,
    exportUnmaskSensitive,
    setExportUnmaskSensitive,
    exportIncludeAutoRowNumber,
    setExportIncludeAutoRowNumber,
    handleExportCSV,
    handleExportExcel,
    openPdfDialog,
    openEmailDialog,
    reportTemplateSelection,
    applyReportTemplate,
    savedReportTemplates,
    availableManagedReportTemplates,
    selectedReportTemplate,
    selectedManagedReportTemplate,
    selectedCustomReportTemplate,
    saveCurrentReportTemplate,
    deleteSelectedReportTemplate,
    selectedPdfRows,
    selectedPdfTitle,
    pdfTitleInput,
    setPdfTitleInput,
    pdfPreviewUrl,
    setPdfPreviewUrl,
    pdfPreviewIframeRef,
    previewExportPDF,
    confirmExportPDF,
    printPdfPreview,
    pdfPreviewLoading,
    pdfDownloadLoading,
    emailSubjectInput,
    setEmailSubjectInput,
    emailTemplateMode,
    setEmailTemplateMode,
    emailTemplate,
    emailCopied,
    setEmailCopied,
    copyEmailTemplate,
    printEmailTemplate,
  };
}
