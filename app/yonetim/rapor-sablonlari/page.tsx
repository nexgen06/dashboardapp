"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Image as ImageIcon, Layout, Loader2, Pencil, RefreshCw, Save, Shield, Sparkles, SlidersHorizontal, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { YonetimAccessDenied } from "@/components/yonetim/YonetimAccessDenied";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import { useProjects } from "@/hooks/useProjects";
import { REPORT_TEMPLATES, type EmailTemplateMode, type PdfExportScope, type ReportTemplateId } from "@/lib/liveTableExport";
import {
  createManagedReportTemplate,
  defaultReportTemplateConfig,
  deleteManagedReportTemplate,
  listManagedReportTemplates,
  updateManagedReportTemplate,
  FILTER_PRESET_LABELS,
  FILTER_PRESET_ORDER,
  type FilterPresetId,
  type ManagedReportTemplate,
  type PdfOrientationOption,
  type PdfPageSizeOption,
  type ReportTemplateAccessMode,
  type ReportTemplateAssignmentScope,
  type ReportTemplateScope,
} from "@/lib/reportTemplates";
import {
  DEFAULT_ORG_BRANDING,
  fetchOrgBranding,
  persistOrgBranding,
  type OrgBranding,
} from "@/lib/appSettingsSupabase";
import { listSavedViews, type SavedView } from "@/lib/savedViews";
import { cn } from "@/lib/utils";

type FormState = {
  id: string | null;
  name: string;
  description: string;
  scope: ReportTemplateScope;
  assignmentScope: ReportTemplateAssignmentScope;
  projectId: string;
  isDefault: boolean;
  accessMode: ReportTemplateAccessMode;
  allowedEmailsText: string;
  baseTemplateId: ReportTemplateId;
  pdfTitle: string;
  emailSubject: string;
  emailMode: EmailTemplateMode;
  exportScope: PdfExportScope;
  visibleColumnIdsText: string;
  unmaskSensitive: boolean;
  /* Yeni: Sunum & marka */
  showLogo: boolean;
  coverNote: string;
  summaryBulletsText: string;
  /* Yeni: Hazır rapor senaryosu */
  defaultFilterPresets: FilterPresetId[];
  defaultSavedViewId: string;
  /* Yeni: PDF görünümü */
  pdfOrientation: PdfOrientationOption;
  pdfPageSize: PdfPageSizeOption;
  pdfShowFilterSummary: boolean;
  pdfShowStatusSummary: boolean;
  includeAutoRowNumber: boolean;
};

function emptyForm(): FormState {
  const base = defaultReportTemplateConfig();
  return {
    id: null,
    name: "",
    description: "",
    scope: "shared",
    assignmentScope: "system",
    projectId: "",
    isDefault: false,
    accessMode: "all",
    allowedEmailsText: "",
    baseTemplateId: base.baseTemplateId,
    pdfTitle: base.pdfTitle,
    emailSubject: base.emailSubject,
    emailMode: base.emailMode,
    exportScope: base.exportScope,
    visibleColumnIdsText: "",
    unmaskSensitive: false,
    showLogo: base.showLogo,
    coverNote: base.coverNote,
    summaryBulletsText: base.summaryBullets.join("\n"),
    defaultFilterPresets: [...base.defaultFilterPresets],
    defaultSavedViewId: base.defaultSavedViewId ?? "",
    pdfOrientation: base.pdfOrientation,
    pdfPageSize: base.pdfPageSize,
    pdfShowFilterSummary: base.pdfShowFilterSummary,
    pdfShowStatusSummary: base.pdfShowStatusSummary,
    includeAutoRowNumber: base.includeAutoRowNumber,
  };
}

function formFromTemplate(template: ManagedReportTemplate): FormState {
  const config = template.template_config;
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    scope: template.scope,
    assignmentScope: template.assignment_scope,
    projectId: template.project_id ?? "",
    isDefault: template.is_default,
    accessMode: template.access_mode,
    allowedEmailsText: template.allowed_emails.join(", "),
    baseTemplateId: config.baseTemplateId,
    pdfTitle: config.pdfTitle,
    emailSubject: config.emailSubject,
    emailMode: config.emailMode,
    exportScope: config.exportScope,
    visibleColumnIdsText: config.visibleColumnIds.join(", "),
    unmaskSensitive: config.unmaskSensitive,
    showLogo: config.showLogo,
    coverNote: config.coverNote,
    summaryBulletsText: config.summaryBullets.join("\n"),
    defaultFilterPresets: [...config.defaultFilterPresets],
    defaultSavedViewId: config.defaultSavedViewId ?? "",
    pdfOrientation: config.pdfOrientation,
    pdfPageSize: config.pdfPageSize,
    pdfShowFilterSummary: config.pdfShowFilterSummary,
    pdfShowStatusSummary: config.pdfShowStatusSummary,
    includeAutoRowNumber: config.includeAutoRowNumber,
  };
}

function parseBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseColumnIds(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function parseEmails(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,\n;]/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function accessModeLabel(mode: ReportTemplateAccessMode): string {
  if (mode === "admin_pm") return "Admin/PM";
  if (mode === "project_team") return "Proje ekibi";
  if (mode === "email_list") return "E-posta listesi";
  return "Herkes";
}

export default function RaporSablonlariPage() {
  const { isLoaded, hasPermission, user, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canView =
    hasPermission("area.userManagement") ||
    (hasPermission("area.reports") && hasPermission("reports.view"));
  const canEdit = hasPermission("userManagement.edit") || user?.roleId === "project_manager" || isAdmin;
  const { projects } = useProjects();
  const [templates, setTemplates] = useState<ManagedReportTemplate[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kurumsal kimlik (app_settings.org_branding)
  const [branding, setBranding] = useState<OrgBranding>(DEFAULT_ORG_BRANDING);
  const [brandingDraft, setBrandingDraft] = useState<OrgBranding>(DEFAULT_ORG_BRANDING);
  const [brandingSaving, setBrandingSaving] = useState(false);

  // Kayıtlı görünümler (paylaşımlı)
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const sharedSavedViews = useMemo(
    () => savedViews.filter((v) => v.scope === "shared"),
    [savedViews]
  );

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      setTemplates(await listManagedReportTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rapor şablonları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Kurumsal kimliği yükle
  useEffect(() => {
    if (!canView) return;
    let active = true;
    void fetchOrgBranding().then((value) => {
      if (!active) return;
      setBranding(value);
      setBrandingDraft(value);
    });
    return () => {
      active = false;
    };
  }, [canView]);

  // Kayıtlı görünümleri yükle
  useEffect(() => {
    if (!canView) return;
    let active = true;
    void listSavedViews().then((views) => {
      if (active) setSavedViews(views);
    });
    return () => {
      active = false;
    };
  }, [canView]);

  const handleBrandingSave = async () => {
    setBrandingSaving(true);
    try {
      const ok = await persistOrgBranding(brandingDraft);
      if (ok) {
        setBranding(brandingDraft);
        toast.success("Kurumsal kimlik kaydedildi");
      } else {
        toast.error("Kurumsal kimlik kaydedilemedi (yetki veya bağlantı hatası).");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kurumsal kimlik kaydedilemedi.");
    } finally {
      setBrandingSaving(false);
    }
  };

  const brandingDirty =
    brandingDraft.logoUrl !== branding.logoUrl ||
    brandingDraft.orgName !== branding.orgName ||
    brandingDraft.pdfFooterText !== branding.pdfFooterText;

  /** Kurumsal kimlik tanımlı ama hiçbir şablonda showLogo aktif değilse uyarı göster. */
  const hasBranding = !!(branding.logoUrl || branding.orgName);
  const anyTemplateUsesLogo = templates.some((t) => t.template_config.showLogo === true);
  const showLogoNotUsedHint = hasBranding && templates.length > 0 && !anyTemplateUsesLogo;

  const selectedBuiltin = useMemo(() => REPORT_TEMPLATES[form.baseTemplateId], [form.baseTemplateId]);

  const applyBaseTemplate = (id: ReportTemplateId) => {
    const base = REPORT_TEMPLATES[id];
    setForm((prev) => ({
      ...prev,
      baseTemplateId: id,
      pdfTitle: prev.pdfTitle.trim() ? prev.pdfTitle : base.pdfTitle,
      emailSubject: prev.emailSubject.trim() ? prev.emailSubject : base.emailSubject,
      emailMode: base.emailMode,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Şablon adı girin.");
      return;
    }
    setSaving(true);
    try {
      if (form.assignmentScope === "project" && !form.projectId) {
        toast.error("Proje bazlı atama için proje seçin.");
        setSaving(false);
        return;
      }
      if (form.accessMode === "project_team" && form.assignmentScope !== "project") {
        toast.error("Proje ekibi erişimi için atama kapsamını proje bazlı seçin.");
        setSaving(false);
        return;
      }
      if (form.accessMode === "email_list" && parseEmails(form.allowedEmailsText).length === 0) {
        toast.error("E-posta listesi erişimi için en az bir e-posta girin.");
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name,
        description: form.description,
        scope: form.scope,
        assignment_scope: form.assignmentScope,
        project_id: form.assignmentScope === "project" ? form.projectId : null,
        is_default: form.isDefault,
        access_mode: form.accessMode,
        allowed_emails: form.accessMode === "email_list" ? parseEmails(form.allowedEmailsText) : [],
        template_config: {
          baseTemplateId: form.baseTemplateId,
          pdfTitle: form.pdfTitle.trim() || selectedBuiltin.pdfTitle,
          emailSubject: form.emailSubject.trim() || selectedBuiltin.emailSubject,
          emailMode: form.emailMode,
          exportScope: form.exportScope,
          visibleColumnIds: parseColumnIds(form.visibleColumnIdsText),
          unmaskSensitive: form.unmaskSensitive,
          showLogo: form.showLogo,
          coverNote: form.coverNote.trim().slice(0, 600),
          summaryBullets: parseBullets(form.summaryBulletsText),
          defaultFilterPresets: form.defaultFilterPresets,
          defaultSavedViewId: form.defaultSavedViewId.trim() || null,
          pdfOrientation: form.pdfOrientation,
          pdfPageSize: form.pdfPageSize,
          pdfShowFilterSummary: form.pdfShowFilterSummary,
          pdfShowStatusSummary: form.pdfShowStatusSummary,
          includeAutoRowNumber: form.includeAutoRowNumber,
        },
      };
      if (form.id) await updateManagedReportTemplate(form.id, payload);
      else await createManagedReportTemplate(payload);
      toast.success(form.id ? "Rapor şablonu güncellendi" : "Rapor şablonu oluşturuldu");
      setForm(emptyForm());
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rapor şablonu kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: ManagedReportTemplate) => {
    const ok = await confirm({
      title: "Rapor şablonunu sil",
      message: `"${template.name}" şablonu silinsin mi? Bu işlem export geçmişini etkilemez.`,
      confirmLabel: "Sil",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteManagedReportTemplate(template.id);
      toast.success("Rapor şablonu silindi");
      await refresh();
      if (form.id === template.id) setForm(emptyForm());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rapor şablonu silinemedi.");
    }
  };

  if (!isLoaded) {
    return <div className="container max-w-5xl py-10 text-slate-500">Yükleniyor…</div>;
  }

  if (!canView) {
    return <YonetimAccessDenied />;
  }

  return (
    <div className="container max-w-6xl space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            <FileText className="h-6 w-6 text-blue-600" aria-hidden />
            Rapor Şablonları
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            PDF ve e-posta export şablonlarını kurumsal olarak yönet; kullanıcılar canlı tablodan aynı şablonları seçebilir.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Yenile
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      )}

      {/* Kurumsal kimlik (org_branding) — tüm şablonlar için ortak */}
      {canEdit && (
        <section className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-4 dark:border-slate-700 dark:from-slate-800/70 dark:to-slate-800">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <ImageIcon className="h-4 w-4 text-blue-600" aria-hidden />
                Kurumsal Kimlik
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Logo ve kurum adı, &quot;Logoyu göster&quot; seçili tüm rapor şablonlarında kullanılır. PDF footer metnini de buradan değiştirebilirsiniz.
              </p>
            </div>
            {branding.logoUrl && (
              <div className="hidden h-12 w-32 shrink-0 items-center justify-center rounded border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-900 sm:flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={branding.logoUrl} alt="Önizleme" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
              Logo URL
              <input
                type="url"
                value={brandingDraft.logoUrl}
                onChange={(e) => setBrandingDraft((p) => ({ ...p, logoUrl: e.target.value }))}
                placeholder="https://example.com/logo.png"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                Public erişimli URL. PNG/SVG önerilir, max 200x60px ideal.
              </span>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Kurum adı
              <input
                value={brandingDraft.orgName}
                onChange={(e) => setBrandingDraft((p) => ({ ...p, orgName: e.target.value }))}
                placeholder="Örn: ACME A.Ş."
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300 sm:col-span-2">
              PDF footer metni
              <input
                value={brandingDraft.pdfFooterText}
                onChange={(e) => setBrandingDraft((p) => ({ ...p, pdfFooterText: e.target.value }))}
                placeholder="DashboardApp"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </label>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleBrandingSave()}
                disabled={brandingSaving || !brandingDirty}
                className="w-full sm:w-auto"
              >
                {brandingSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Kimliği kaydet
              </Button>
            </div>
          </div>
          {showLogoNotUsedHint && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Kurumsal kimliği tanımladınız ancak hiçbir şablonda &quot;Logo bandı&quot; aktif değil. PDF/e-posta çıktısında logo görünmesi için aşağıdaki herhangi bir rapor şablonunu düzenleyin ve <strong>&quot;Sunum &amp; Marka&quot;</strong> bölümündeki <strong>&quot;Kurum logosu &amp; adı bandı&quot;</strong> kutusunu işaretleyin.
              </span>
            </div>
          )}
        </section>
      )}

      {canEdit && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Şablon adı
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Açıklama
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kapsam
                  <select value={form.scope} onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value as ReportTemplateScope }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="shared">Kurumsal</option>
                    <option value="private">Kişisel</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Taban şablon
                  <select value={form.baseTemplateId} onChange={(e) => applyBaseTemplate(e.target.value as ReportTemplateId)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    {Object.entries(REPORT_TEMPLATES).map(([id, template]) => <option key={id} value={id}>{template.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Atama kapsamı
                  <select value={form.assignmentScope} onChange={(e) => setForm((p) => ({ ...p, assignmentScope: e.target.value as ReportTemplateAssignmentScope, projectId: e.target.value === "system" ? "" : p.projectId }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="system">Sistem geneli</option>
                    <option value="project">Proje bazlı</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Proje
                  <select value={form.projectId} disabled={form.assignmentScope !== "project"} onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="">Proje seçin</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name || "İsimsiz proje"}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Bu kapsam için varsayılan şablon yap
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kim kullanabilir?
                  <select value={form.accessMode} onChange={(e) => setForm((p) => ({ ...p, accessMode: e.target.value as ReportTemplateAccessMode }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="all">Herkes</option>
                    <option value="admin_pm">Sadece admin / proje yöneticisi</option>
                    <option value="project_team">Sadece seçili proje ekibi</option>
                    <option value="email_list">Sadece e-posta listesi</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  E-posta listesi
                  <input
                    value={form.allowedEmailsText}
                    disabled={form.accessMode !== "email_list"}
                    onChange={(e) => setForm((p) => ({ ...p, allowedEmailsText: e.target.value }))}
                    placeholder="ad@firma.com, ekip@firma.com"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                PDF başlığı
                <input value={form.pdfTitle} onChange={(e) => setForm((p) => ({ ...p, pdfTitle: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                E-posta konusu
                <input value={form.emailSubject} onChange={(e) => setForm((p) => ({ ...p, emailSubject: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  E-posta tipi
                  <select value={form.emailMode} onChange={(e) => setForm((p) => ({ ...p, emailMode: e.target.value as EmailTemplateMode }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="mobile">Mobil uyumlu</option>
                    <option value="table">Detaylı tablo</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Export kapsamı
                  <select value={form.exportScope} onChange={(e) => setForm((p) => ({ ...p, exportScope: e.target.value as PdfExportScope }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="current">Mevcut görünüm</option>
                    <option value="all">Tüm veri</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Kolon ID listesi
                <input value={form.visibleColumnIdsText} onChange={(e) => setForm((p) => ({ ...p, visibleColumnIdsText: e.target.value }))} placeholder="content,status,assignee,project" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={form.unmaskSensitive} onChange={(e) => setForm((p) => ({ ...p, unmaskSensitive: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Yetki varsa hassas veriyi maskesiz export et
              </label>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SUNUM & MARKA — logo + cover note + bullets                     */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Layout className="h-4 w-4 text-violet-600" aria-hidden />
              Sunum &amp; Marka
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">— PDF/e-postanın kurumsal görünümü</span>
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                <label
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-slate-700 transition-colors dark:text-slate-300",
                    form.showLogo
                      ? "border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30"
                      : "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.showLogo}
                    onChange={(e) => setForm((p) => ({ ...p, showLogo: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">Kurum logosu &amp; adı bandı</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {branding.logoUrl || branding.orgName
                        ? "Kurumsal kimlik tanımlı — başlık üstüne yerleştirilecek."
                        : "Kurumsal kimlik boş — üst kart üzerinden logo/ad girin."}
                    </span>
                  </span>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kapak notu (raporun amacını anlatan tek paragraf)
                  <textarea
                    value={form.coverNote}
                    onChange={(e) => setForm((p) => ({ ...p, coverNote: e.target.value.slice(0, 600) }))}
                    rows={3}
                    maxLength={600}
                    placeholder="Bu rapor, haftalık operasyon toplantısı için hazırlanmıştır…"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <span className="text-right text-[11px] font-normal text-slate-400">
                    {form.coverNote.length}/600
                  </span>
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Yönetici özeti madde madde (her satır bir bullet, max 12)
                <textarea
                  value={form.summaryBulletsText}
                  onChange={(e) => setForm((p) => ({ ...p, summaryBulletsText: e.target.value }))}
                  rows={7}
                  placeholder={"Bu hafta 14 görev tamamlandı\n3 görev geç teslim edildi\nA Projesi planlanan sürede ilerliyor"}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  PDF/e-postada bullet listesi olarak render edilir. Boş satırlar yok sayılır.
                </span>
              </label>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* HAZIR RAPOR SENARYOSU — preset filters + saved view             */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
              Hazır Rapor Senaryosu
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">— şablon çağrıldığında otomatik uygulanır</span>
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Hızlı filtre presetleri
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {FILTER_PRESET_ORDER.map((presetId) => {
                    const checked = form.defaultFilterPresets.includes(presetId);
                    return (
                      <label
                        key={presetId}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
                          checked
                            ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                            : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              defaultFilterPresets: e.target.checked
                                ? [...p.defaultFilterPresets, presetId]
                                : p.defaultFilterPresets.filter((id) => id !== presetId),
                            }))
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        {FILTER_PRESET_LABELS[presetId]}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kayıtlı görünüm bağla (opsiyonel)
                  <select
                    value={form.defaultSavedViewId}
                    onChange={(e) => setForm((p) => ({ ...p, defaultSavedViewId: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">Bağlı görünüm yok</option>
                    {sharedSavedViews.map((view) => (
                      <option key={view.id} value={view.id}>
                        {view.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    Sadece paylaşımlı (kurumsal) kayıtlı görünümler listelenir. Preset + görünüm aynı anda kullanılabilir; export sırasında ikisi de uygulanır.
                  </span>
                </label>
                {sharedSavedViews.length === 0 && (
                  <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    Henüz paylaşımlı kayıtlı görünüm yok. Canlı tablodan bir görünüm kaydedip &quot;Kurumsal&quot; olarak işaretleyin.
                  </p>
                )}
                {(form.defaultFilterPresets.length > 0 || form.defaultSavedViewId) && (
                  <div className="flex flex-wrap items-center gap-1 rounded-md bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Uygulanacak:
                    </span>
                    {form.defaultFilterPresets.map((id) => (
                      <Badge key={id} variant="outline" className="border-amber-300 bg-white text-[10px] text-amber-900 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200">
                        {FILTER_PRESET_LABELS[id]}
                      </Badge>
                    ))}
                    {form.defaultSavedViewId && (
                      <Badge variant="outline" className="border-blue-300 bg-white text-[10px] text-blue-900 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-200">
                        Görünüm: {sharedSavedViews.find((v) => v.id === form.defaultSavedViewId)?.name ?? form.defaultSavedViewId.slice(0, 8)}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* PDF GÖRÜNÜMÜ — orientation / page size / show toggles           */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/30">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <SlidersHorizontal className="h-4 w-4 text-emerald-600" aria-hidden />
              PDF Görünümü
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">— sayfa yönü ve içerik bölümleri</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Sayfa yönü
                <select
                  value={form.pdfOrientation}
                  onChange={(e) => setForm((p) => ({ ...p, pdfOrientation: e.target.value as PdfOrientationOption }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="landscape">Yatay (geniş)</option>
                  <option value="portrait">Dikey (uzun)</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Sayfa boyutu
                <select
                  value={form.pdfPageSize}
                  onChange={(e) => setForm((p) => ({ ...p, pdfPageSize: e.target.value as PdfPageSizeOption }))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="A4">A4</option>
                  <option value="A3">A3 (büyük)</option>
                  <option value="Letter">Letter (US)</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.pdfShowFilterSummary}
                  onChange={(e) => setForm((p) => ({ ...p, pdfShowFilterSummary: e.target.checked }))}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Filtre özetini göster
              </label>
              <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.pdfShowStatusSummary}
                  onChange={(e) => setForm((p) => ({ ...p, pdfShowStatusSummary: e.target.checked }))}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Durum özetini göster
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            {form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyForm())}>Yeni kayıt</Button>}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Şablon</th>
              <th className="px-4 py-3">Kapsam</th>
              <th className="px-4 py-3">Atama</th>
              <th className="px-4 py-3">Yetki</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Kolon</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {templates.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Henüz kayıtlı rapor şablonu yok.</td></tr>
            ) : templates.map((template) => (
              <tr key={template.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{template.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{template.description || template.template_config.pdfTitle}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{template.scope === "shared" ? "Kurumsal" : "Kişisel"}</Badge>
                    {template.is_default && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/60 dark:bg-amber-950/30 dark:text-amber-200">Varsayılan</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {template.assignment_scope === "project"
                    ? projects.find((project) => project.id === template.project_id)?.name ?? "Proje bazlı"
                    : "Sistem geneli"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{accessModeLabel(template.access_mode)}</Badge>
                  {template.access_mode === "email_list" && template.allowed_emails.length > 0 && (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {template.allowed_emails.length} kişi
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {template.template_config.emailMode === "mobile" ? "Mobil" : "Tablo"} · {template.template_config.exportScope === "all" ? "Tüm veri" : "Mevcut görünüm"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {template.template_config.visibleColumnIds.length || "Varsayılan"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {canEdit && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setForm(formFromTemplate(template))}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Düzenle
                      </Button>
                    )}
                    {canEdit && (
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleDelete(template)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Sil
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
