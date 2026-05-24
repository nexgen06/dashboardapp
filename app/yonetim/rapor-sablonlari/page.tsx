"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Pencil, RefreshCw, Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
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
  type ManagedReportTemplate,
  type ReportTemplateAccessMode,
  type ReportTemplateAssignmentScope,
  type ReportTemplateScope,
} from "@/lib/reportTemplates";

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
  };
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
  const canView = hasPermission("userManagement.view");
  const canEdit = hasPermission("userManagement.edit") || user?.roleId === "project_manager" || isAdmin;
  const { projects } = useProjects();
  const [templates, setTemplates] = useState<ManagedReportTemplate[]>([]);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return (
      <div className="container max-w-4xl py-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-10 w-10 text-amber-600" />
          <p className="font-medium text-slate-800 dark:text-slate-100">Bu sayfaya erişim yetkiniz yok.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </div>
      </div>
    );
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
          <div className="mt-4 flex justify-end gap-2">
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
