"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Play, Plus, RefreshCw, Shield, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  countRuleMatches,
  deleteAutomationRule,
  listAutomationRules,
  saveAutomationRule,
  type AutomationConditionOperator,
  type AutomationRule,
} from "@/lib/automationRules";
import { listChipCatalog, type ChipCatalog } from "@/lib/chipSystem";

const operators: Array<{ value: AutomationConditionOperator; label: string }> = [
  { value: "date_before_today", label: "tarih geçti" },
  { value: "date_today", label: "bugün" },
  { value: "status_not_done", label: "durum tamamlanmadı" },
  { value: "equals", label: "eşit" },
  { value: "not_equals", label: "eşit değil" },
  { value: "is_empty", label: "boş" },
  { value: "is_not_empty", label: "dolu" },
  { value: "updated_before_days", label: "X gündür güncellenmedi" },
  { value: "number_gt", label: "büyük" },
  { value: "number_lt", label: "küçük" },
];

export default function OtomasyonMerkeziPage() {
  const { isLoaded, hasPermission, user } = useAuth();
  const { projects } = useProjects();
  const { tasks } = useTasksWithRealtime();
  const toast = useToast();
  const canView = hasPermission("automation.view") || hasPermission("userManagement.view");
  const canManage = hasPermission("automation.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [catalog, setCatalog] = useState<ChipCatalog>({ templates: [], options: [], bindings: [] });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "Geciken görev riski",
    projectId: "",
    field: "due_date",
    op: "date_before_today" as AutomationConditionOperator,
    value: "",
    templateName: "Risk",
    optionValue: "critical",
    enabled: true,
  });

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const projectIds = projects.map((project) => project.id);
      const [nextRules, nextCatalog] = await Promise.all([
        listAutomationRules(projectIds),
        listChipCatalog(projectIds),
      ]);
      setRules(nextRules);
      setCatalog(nextCatalog);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Otomasyonlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [canView, projects, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedTemplate = catalog.templates.find((template) => template.name === form.templateName) ?? catalog.templates[0] ?? null;
  const selectedOptions = selectedTemplate ? catalog.options.filter((option) => option.templateId === selectedTemplate.id) : [];
  const draftRule = useMemo<Pick<AutomationRule, "conditions" | "projectId">>(() => ({
    projectId: form.projectId || null,
    conditions: [
      { field: form.field, op: form.op, value: form.value },
      ...(form.field === "due_date" && form.op === "date_before_today"
        ? [{ field: "status", op: "status_not_done" as AutomationConditionOperator, value: "" }]
        : []),
    ],
  }), [form.field, form.op, form.projectId, form.value]);
  const previewCount = countRuleMatches(draftRule, tasks);

  const saveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Kural adı girin.");
      return;
    }
    try {
      await saveAutomationRule({
        name: form.name,
        projectId: form.projectId || null,
        enabled: form.enabled,
        conditions: draftRule.conditions,
        actions: [
          {
            actionType: form.templateName === "Risk" ? "set_risk" : "assign_chip",
            payload: { templateName: form.templateName, optionValue: form.optionValue },
          },
        ],
      });
      toast.success("Otomasyon kuralı kaydedildi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kural kaydedilemedi.");
    }
  };

  const seedPreset = (kind: "risk" | "payment" | "stale" | "document" | "approval") => {
    const presets = {
      risk: { name: "Geciken görev riski", field: "due_date", op: "date_before_today" as AutomationConditionOperator, value: "", templateName: "Risk", optionValue: "critical" },
      payment: { name: "Ödeme gecikmesi", field: "Ödeme Tarihi", op: "date_before_today" as AutomationConditionOperator, value: "", templateName: "Ödeme Durumu", optionValue: "overdue" },
      stale: { name: "Hareketsiz satır", field: "updated_at", op: "updated_before_days" as AutomationConditionOperator, value: "7", templateName: "Sistem", optionValue: "stale" },
      document: { name: "Eksik evrak", field: "Evrak", op: "is_empty" as AutomationConditionOperator, value: "", templateName: "Evrak", optionValue: "missing" },
      approval: { name: "Onay bekliyor", field: "Onay", op: "is_empty" as AutomationConditionOperator, value: "", templateName: "Sistem", optionValue: "due_today" },
    }[kind];
    setForm((prev) => ({ ...prev, ...presets }));
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
            <Bot className="h-6 w-6 text-blue-600" />
            Otomasyon Merkezi
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Teknik bilgi gerektirmeden koşul ve aksiyon kuralları tanımlayın. İlk sürüm satır kaydı/yüklemesi sonrası client tetikli güvenli motorla çalışır.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Yenile
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("risk")}>Geciken görev riski</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("payment")}>Ödeme gecikmesi</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("stale")}>Hareketsiz satır</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("document")}>Eksik evrak</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("approval")}>Onay bekliyor</Button>
      </div>

      {canManage && (
        <form onSubmit={saveRule} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" placeholder="Kural adı" />
            <select value={form.projectId} onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              <option value="">Tüm projeler</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <input value={form.field} onChange={(e) => setForm((p) => ({ ...p, field: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" placeholder="Alan" />
            <select value={form.op} onChange={(e) => setForm((p) => ({ ...p, op: e.target.value as AutomationConditionOperator }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              {operators.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
            </select>
            <input value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" placeholder="Değer" />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
              Aktif
            </label>
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_auto_auto]">
            <select value={form.templateName} onChange={(e) => setForm((p) => ({ ...p, templateName: e.target.value, optionValue: "" }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              {catalog.templates.map((template) => <option key={template.id} value={template.name}>{template.name}</option>)}
            </select>
            <select value={form.optionValue} onChange={(e) => setForm((p) => ({ ...p, optionValue: e.target.value }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              <option value="">Çip seçeneği seç</option>
              {selectedOptions.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
            </select>
            <Badge variant="outline" className="justify-center py-2">
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {previewCount} satır etkilenir
            </Badge>
            <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Kuralı kaydet</Button>
          </div>
        </form>
      )}

      <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Kayıtlı kurallar</h2>
        </div>
        {rules.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Henüz otomasyon kuralı yok.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {rules.map((rule) => {
              const project = projects.find((item) => item.id === rule.projectId);
              return (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{rule.name}</p>
                      <Badge variant={rule.enabled ? "default" : "outline"}>{rule.enabled ? "Aktif" : "Pasif"}</Badge>
                      <Badge variant="outline">{project?.name ?? "Tüm projeler"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{rule.conditions.length} koşul · {rule.actions.length} aksiyon · {countRuleMatches(rule, tasks)} mevcut eşleşme</p>
                  </div>
                  {canManage && (
                    <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => void deleteAutomationRule(rule.id).then(refresh)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

