"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, RefreshCw, Shield, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ChipBadge } from "@/components/chips/ChipBadge";
import {
  CHIP_CATEGORY_LABELS,
  CHIP_COLORS,
  createChipOption,
  createChipTemplate,
  deleteTableChipBinding,
  listChipCatalog,
  upsertTableChipBinding,
  type ChipCatalog,
  type ChipCategory,
} from "@/lib/chipSystem";

const categories = Object.keys(CHIP_CATEGORY_LABELS) as ChipCategory[];

export default function CipKutuphanesiPage() {
  const { isLoaded, hasPermission, user } = useAuth();
  const { projects } = useProjects();
  const toast = useToast();
  const canView = hasPermission("chipTemplates.view") || hasPermission("userManagement.view");
  const canManage = hasPermission("chipTemplates.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const [catalog, setCatalog] = useState<ChipCatalog>({ templates: [], options: [], bindings: [] });
  const [loading, setLoading] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "status" as ChipCategory,
    color: "blue",
    managerOnly: false,
    description: "",
  });
  const [optionForm, setOptionForm] = useState({ templateId: "", label: "", color: "slate", icon: "circle" });
  const [bindingForm, setBindingForm] = useState({ projectId: "", columnKey: "", templateId: "" });

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      setCatalog(await listChipCatalog(projects.map((project) => project.id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çip kütüphanesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [canView, projects, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const templatesByCategory = useMemo(() => {
    return categories.map((category) => ({
      category,
      templates: catalog.templates.filter((template) => template.category === category),
    }));
  }, [catalog.templates]);

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!templateForm.name.trim()) {
      toast.error("Çip şablonu adı girin.");
      return;
    }
    try {
      await createChipTemplate({
        name: templateForm.name,
        category: templateForm.category,
        color: templateForm.color,
        managerOnly: templateForm.managerOnly,
        description: templateForm.description,
      });
      toast.success("Çip şablonu oluşturuldu");
      setTemplateForm((prev) => ({ ...prev, name: "", description: "" }));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şablon oluşturulamadı.");
    }
  };

  const saveOption = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!optionForm.templateId || !optionForm.label.trim()) {
      toast.error("Şablon ve seçenek etiketi gerekli.");
      return;
    }
    try {
      await createChipOption({
        templateId: optionForm.templateId,
        label: optionForm.label,
        color: optionForm.color,
        icon: optionForm.icon,
        sortOrder: catalog.options.filter((option) => option.templateId === optionForm.templateId).length + 1,
      });
      toast.success("Çip seçeneği eklendi");
      setOptionForm((prev) => ({ ...prev, label: "" }));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seçenek eklenemedi.");
    }
  };

  const saveBinding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bindingForm.projectId || !bindingForm.columnKey.trim() || !bindingForm.templateId) {
      toast.error("Proje, kolon ve şablon seçin.");
      return;
    }
    try {
      await upsertTableChipBinding({
        projectId: bindingForm.projectId,
        columnKey: bindingForm.columnKey,
        templateId: bindingForm.templateId,
      });
      toast.success("Çip tablo kolonuna bağlandı");
      setBindingForm((prev) => ({ ...prev, columnKey: "" }));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlantı kaydedilemedi.");
    }
  };

  if (!isLoaded) return <div className="container py-10 text-slate-500">Yükleniyor…</div>;
  if (!canView) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-10 w-10 text-amber-600" />
          <p className="font-medium text-slate-800 dark:text-slate-100">Bu sayfaya erişim yetkiniz yok.</p>
          <Button asChild variant="outline" className="mt-4"><Link href="/">Ana sayfaya dön</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl space-y-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            <Sparkles className="h-6 w-6 text-blue-600" />
            Çip Kütüphanesi
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Merkezi çip şablonları, seçenekler ve proje/kolon bağlantıları. Çipler tabloya gömülmez; satırlar template referansı kullanır.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Yenile
        </Button>
      </div>

      {canManage && (
        <div className="grid gap-4 xl:grid-cols-3">
          <form onSubmit={saveTemplate} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Yeni şablon</h2>
            <div className="space-y-3">
              <input value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} placeholder="Risk, Ödeme Durumu..." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
              <select value={templateForm.category} onChange={(e) => setTemplateForm((p) => ({ ...p, category: e.target.value as ChipCategory }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {categories.map((category) => <option key={category} value={category}>{CHIP_CATEGORY_LABELS[category]}</option>)}
              </select>
              <select value={templateForm.color} onChange={(e) => setTemplateForm((p) => ({ ...p, color: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {CHIP_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
              <textarea value={templateForm.description} onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))} placeholder="Açıklama" rows={2} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={templateForm.managerOnly} onChange={(e) => setTemplateForm((p) => ({ ...p, managerOnly: e.target.checked }))} />
                Sadece yönetici değiştirebilir
              </label>
              <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Şablon oluştur</Button>
            </div>
          </form>

          <form onSubmit={saveOption} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Seçenek ekle</h2>
            <div className="space-y-3">
              <select value={optionForm.templateId} onChange={(e) => setOptionForm((p) => ({ ...p, templateId: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                <option value="">Şablon seç</option>
                {catalog.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <input value={optionForm.label} onChange={(e) => setOptionForm((p) => ({ ...p, label: e.target.value }))} placeholder="Kritik Risk, Gecikti..." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
              <select value={optionForm.color} onChange={(e) => setOptionForm((p) => ({ ...p, color: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                {CHIP_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
              <input value={optionForm.icon} onChange={(e) => setOptionForm((p) => ({ ...p, icon: e.target.value }))} placeholder="alert-triangle" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
              <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Seçenek ekle</Button>
            </div>
          </form>

          <form onSubmit={saveBinding} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Kolona bağla</h2>
            <div className="space-y-3">
              <select value={bindingForm.projectId} onChange={(e) => setBindingForm((p) => ({ ...p, projectId: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                <option value="">Proje seç</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <input value={bindingForm.columnKey} onChange={(e) => setBindingForm((p) => ({ ...p, columnKey: e.target.value }))} placeholder="extra_data kolon adı: Risk, Ödeme Durumu..." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" />
              <select value={bindingForm.templateId} onChange={(e) => setBindingForm((p) => ({ ...p, templateId: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
                <option value="">Çip şablonu seç</option>
                {catalog.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Bağla</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {templatesByCategory.map(({ category, templates }) => (
            <section key={category} className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">{CHIP_CATEGORY_LABELS[category]}</h2>
              </div>
              {templates.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Bu kategoride şablon yok.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {templates.map((template) => {
                    const options = catalog.options.filter((option) => option.templateId === template.id);
                    return (
                      <div key={template.id} className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-slate-900 dark:text-slate-100">{template.name}</h3>
                          {template.isSystem && <Badge variant="outline">Sistem</Badge>}
                          {template.managerOnly && <Badge variant="outline">Yönetici</Badge>}
                        </div>
                        {template.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{template.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {options.length === 0 ? <span className="text-xs text-slate-400">Seçenek yok</span> : options.map((option) => <ChipBadge key={option.id} template={template} option={option} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Kolon bağlantıları</h2>
          </div>
          {catalog.bindings.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Henüz bağlı kolon yok.</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {catalog.bindings.map((binding) => {
                const project = projects.find((item) => item.id === binding.projectId);
                const template = catalog.templates.find((item) => item.id === binding.templateId);
                return (
                  <div key={binding.id} className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">{project?.name ?? "Proje"}</p>
                      <p className="text-xs text-slate-500">{binding.columnKey} → {template?.name ?? "Çip"}</p>
                    </div>
                    {canManage && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => void deleteTableChipBinding(binding.id).then(refresh)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

