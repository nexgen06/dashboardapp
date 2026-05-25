"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Bot,
  CheckCircle2,
  Eye,
  ExternalLink,
  Filter,
  ListChecks,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  deleteAutomationRule,
  listRecentAutomationLogs,
  listAutomationRules,
  ruleMatchesTask,
  saveAutomationRule,
  type AutomationLog,
  type AutomationActionType,
  type AutomationCondition,
  type AutomationConditionOperator,
  type AutomationRule,
} from "@/lib/automationRules";
import { listChipCatalog, listRowChipValues, type ChipCatalog, type RowChipValue } from "@/lib/chipSystem";
import { getTaskDisplayLabel } from "@/lib/taskDisplayLabel";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

const operators: Array<{ value: AutomationConditionOperator; label: string; needsValue?: boolean }> = [
  { value: "date_before_today", label: "tarih geçti" },
  { value: "date_today", label: "bugün" },
  { value: "status_not_done", label: "durum tamamlanmadı" },
  { value: "equals", label: "eşit", needsValue: true },
  { value: "not_equals", label: "eşit değil", needsValue: true },
  { value: "is_empty", label: "boş" },
  { value: "is_not_empty", label: "dolu" },
  { value: "updated_before_days", label: "X gündür güncellenmedi", needsValue: true },
  { value: "number_gt", label: "büyük", needsValue: true },
  { value: "number_lt", label: "küçük", needsValue: true },
];

const actionTypes: Array<{ value: AutomationActionType; label: string; description: string }> = [
  { value: "assign_chip", label: "Çip ata", description: "Seçilen merkezi çip değerini satıra uygular." },
  { value: "set_risk", label: "Risk değiştir", description: "Risk şablonunu hızlı günceller." },
  { value: "color_row", label: "Satırı renklendir", description: "Eşleşen satırın tablo üzerinde dikkat çekmesini sağlar." },
  { value: "lock_row", label: "Satırı kilitle", description: "Eşleşen satırı ekip üyeleri için düzenlemeye kapatır." },
  { value: "notify", label: "Bildirim gönder", description: "Yönetici, proje yetkilileri ve atanmış kullanıcı için merkezi bildirim oluşturur." },
  { value: "log_only", label: "Sadece logla", description: "Kuralı test/izleme amacıyla saklar." },
];

const rowColorOptions = [
  { value: "red", label: "Kırmızı" },
  { value: "amber", label: "Sarı" },
  { value: "emerald", label: "Yeşil" },
  { value: "blue", label: "Mavi" },
  { value: "purple", label: "Mor" },
  { value: "slate", label: "Gri" },
] as const;

type DraftCondition = AutomationCondition & { id: string };
type DraftAction = {
  id: string;
  actionType: AutomationActionType;
  templateName: string;
  optionValue: string;
  rowColor: string;
  title: string;
  body: string;
};

function draftId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultCondition(overrides?: Partial<AutomationCondition>): DraftCondition {
  return {
    id: draftId("condition"),
    field: overrides?.field ?? "due_date",
    op: overrides?.op ?? "date_before_today",
    value: overrides?.value ?? "",
  };
}

function defaultAction(overrides?: Partial<DraftAction>): DraftAction {
  return {
    id: draftId("action"),
    actionType: overrides?.actionType ?? "set_risk",
    templateName: overrides?.templateName ?? "Risk",
    optionValue: overrides?.optionValue ?? "critical",
    rowColor: overrides?.rowColor ?? "red",
    title: overrides?.title ?? "Otomasyon bildirimi",
    body: overrides?.body ?? "",
  };
}

function operatorLabel(op: AutomationConditionOperator): string {
  return operators.find((item) => item.value === op)?.label ?? op;
}

function actionLabel(action: { actionType: AutomationActionType; payload: Record<string, unknown> }): string {
  if (action.actionType === "assign_chip" || action.actionType === "set_risk") {
    return `${String(action.payload.templateName ?? "Çip")} = ${String(action.payload.optionValue ?? action.payload.optionLabel ?? "—")}`;
  }
  if (action.actionType === "notify") return `Bildirim: ${String(action.payload.title ?? "Otomasyon bildirimi")}`;
  if (action.actionType === "color_row") return `Satır rengi: ${String(action.payload.rowColor ?? action.payload.color ?? "—")}`;
  if (action.actionType === "lock_row") return `Satır kilidi: ${String(action.payload.body ?? action.payload.reason ?? "Otomasyon kilidi")}`;
  if (action.actionType === "log_only") return "Sadece logla";
  return action.actionType;
}

export default function OtomasyonMerkeziPage() {
  const { isLoaded, hasPermission, user } = useAuth();
  const { projects } = useProjects();
  const { tasks } = useTasksWithRealtime();
  const toast = useToast();
  const canView = hasPermission("automation.view") || hasPermission("userManagement.view");
  const canManage = hasPermission("automation.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [catalog, setCatalog] = useState<ChipCatalog>({ templates: [], options: [], bindings: [] });
  const [rowChipValues, setRowChipValues] = useState<RowChipValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState<AutomationLog["status"] | "all">("all");
  const [logRuleFilter, setLogRuleFilter] = useState("all");
  const [logProjectFilter, setLogProjectFilter] = useState("all");
  const [form, setForm] = useState({
    name: "Geciken görev riski",
    projectId: "",
    enabled: true,
    conditions: [
      defaultCondition({ field: "due_date", op: "date_before_today" }),
      defaultCondition({ field: "status", op: "status_not_done" }),
    ] as DraftCondition[],
    actions: [defaultAction({ actionType: "set_risk", templateName: "Risk", optionValue: "critical" })] as DraftAction[],
  });
  const [previewOpen, setPreviewOpen] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const projectIds = projects.map((project) => project.id);
      const taskIds = tasks.map((task) => task.id);
      const [nextRules, nextCatalog, nextLogs, nextRowChipValues] = await Promise.all([
        listAutomationRules(projectIds),
        listChipCatalog(projectIds),
        listRecentAutomationLogs(),
        taskIds.length > 0 ? listRowChipValues(taskIds) : Promise.resolve([]),
      ]);
      setRules(nextRules);
      setCatalog(nextCatalog);
      setLogs(nextLogs);
      setRowChipValues(nextRowChipValues);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Otomasyonlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [canView, projects, tasks, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const draftRule = useMemo<Pick<AutomationRule, "conditions" | "projectId">>(() => ({
    projectId: form.projectId || null,
    conditions: form.conditions.map(({ field, op, value }) => ({ field, op, value })),
  }), [form.conditions, form.projectId]);
  const previewTasks = useMemo(
    () => tasks.filter((task) => ruleMatchesTask(draftRule, task, { rowChipValues, catalog })),
    [catalog, draftRule, rowChipValues, tasks]
  );
  const previewCount = previewTasks.length;
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const ruleById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logStatusFilter !== "all" && log.status !== logStatusFilter) return false;
      if (logRuleFilter !== "all" && log.ruleId !== logRuleFilter) return false;
      if (logProjectFilter !== "all") {
        const task = log.taskId ? taskById.get(log.taskId) : null;
        if (String(task?.project_id ?? "") !== logProjectFilter) return false;
      }
      return true;
    });
  }, [logProjectFilter, logRuleFilter, logStatusFilter, logs, taskById]);

  const addCondition = () => {
    setForm((prev) => ({ ...prev, conditions: [...prev.conditions, defaultCondition({ field: "status", op: "equals" })] }));
  };

  const updateCondition = (id: string, patch: Partial<AutomationCondition>) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition) => condition.id === id ? { ...condition, ...patch } : condition),
    }));
  };

  const removeCondition = (id: string) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.length <= 1 ? prev.conditions : prev.conditions.filter((condition) => condition.id !== id),
    }));
  };

  const addAction = () => {
    setForm((prev) => ({ ...prev, actions: [...prev.actions, defaultAction()] }));
  };

  const updateAction = (id: string, patch: Partial<DraftAction>) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((action) => action.id === id ? { ...action, ...patch } : action),
    }));
  };

  const removeAction = (id: string) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.length <= 1 ? prev.actions : prev.actions.filter((action) => action.id !== id),
    }));
  };

  const saveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Kural adı girin.");
      return;
    }
    if (form.conditions.some((condition) => !condition.field.trim())) {
      toast.error("Tüm koşullarda alan adı girilmeli.");
      return;
    }
    if (form.actions.some((action) => (action.actionType === "assign_chip" || action.actionType === "set_risk") && (!action.templateName || !action.optionValue))) {
      toast.error("Çip aksiyonlarında şablon ve seçenek seçilmeli.");
      return;
    }
    if (form.actions.some((action) => action.actionType === "color_row" && !action.rowColor)) {
      toast.error("Satır rengi aksiyonunda renk seçilmeli.");
      return;
    }
    try {
      await saveAutomationRule({
        name: form.name,
        projectId: form.projectId || null,
        enabled: form.enabled,
        conditions: draftRule.conditions,
        actions: form.actions.map((action, index) => ({
          actionType: action.actionType,
          sortOrder: index,
          payload:
            action.actionType === "notify"
              ? { title: action.title, body: action.body }
              : action.actionType === "color_row"
                ? { rowColor: action.rowColor }
                : action.actionType === "lock_row"
                  ? { body: action.body || form.name }
              : action.actionType === "log_only"
                ? { message: action.body || form.name }
                : { templateName: action.templateName, optionValue: action.optionValue },
        })),
      });
      toast.success("Otomasyon kuralı kaydedildi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kural kaydedilemedi.");
    }
  };

  const seedPreset = (kind: "risk" | "payment" | "stale" | "document" | "approval") => {
    const presets = {
      risk: {
        name: "Geciken görev riski",
        conditions: [
          defaultCondition({ field: "due_date", op: "date_before_today" }),
          defaultCondition({ field: "status", op: "status_not_done" }),
        ],
        actions: [defaultAction({ actionType: "set_risk", templateName: "Risk", optionValue: "critical" })],
      },
      payment: {
        name: "Ödeme gecikmesi",
        conditions: [
          defaultCondition({ field: "Ödeme Tarihi", op: "date_before_today" }),
          defaultCondition({ field: "Ödeme Durumu", op: "not_equals", value: "Ödendi" }),
        ],
        actions: [defaultAction({ actionType: "assign_chip", templateName: "Ödeme Durumu", optionValue: "overdue" })],
      },
      stale: {
        name: "Hareketsiz satır",
        conditions: [defaultCondition({ field: "updated_at", op: "updated_before_days", value: "7" })],
        actions: [defaultAction({ actionType: "assign_chip", templateName: "Sistem", optionValue: "stale" })],
      },
      document: {
        name: "Eksik evrak",
        conditions: [defaultCondition({ field: "Evrak", op: "is_empty" })],
        actions: [defaultAction({ actionType: "assign_chip", templateName: "Evrak", optionValue: "missing" })],
      },
      approval: {
        name: "Onay bekliyor",
        conditions: [defaultCondition({ field: "Onay", op: "is_empty" })],
        actions: [defaultAction({ actionType: "log_only", body: "Onay alanı boş. Kontrol bekliyor." })],
      },
    }[kind];
    setForm((prev) => ({ ...prev, ...presets }));
    setPreviewOpen(true);
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
            Koşul zincirleri ve birden çok aksiyonla operasyon kuralları tanımlayın. Kural test alanı hangi satırların etkileneceğini kaydetmeden önce gösterir.
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
        <form onSubmit={saveRule} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_auto]">
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Kural adı"
            />
            <select
              value={form.projectId}
              onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Tüm projeler</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
              Aktif
            </label>
          </div>

          <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <ListChecks className="h-4 w-4" />
                Eğer
              </h2>
              <Button type="button" size="sm" variant="outline" onClick={addCondition}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Koşul ekle
              </Button>
            </div>
            <div className="space-y-2">
              {form.conditions.map((condition, index) => {
                const operator = operators.find((item) => item.value === condition.op);
                const needsValue = operator?.needsValue === true;
                return (
                  <div key={condition.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-700 dark:bg-slate-900/30 lg:grid-cols-[auto_1fr_1fr_1fr_auto]">
                    <span className="flex items-center text-xs font-semibold uppercase text-slate-400">{index === 0 ? "Eğer" : "Ve"}</span>
                    <input
                      value={condition.field}
                      onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="Alan: due_date, status, Ödeme Tarihi..."
                    />
                    <select
                      value={condition.op}
                      onChange={(e) => updateCondition(condition.id, { op: e.target.value as AutomationConditionOperator })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {operators.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <input
                      value={condition.value ?? ""}
                      onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                      disabled={!needsValue}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                      placeholder={needsValue ? "Değer" : "Değer gerekmez"}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(condition.id)} disabled={form.conditions.length <= 1}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Bot className="h-4 w-4" />
                O halde
              </h2>
              <Button type="button" size="sm" variant="outline" onClick={addAction}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Aksiyon ekle
              </Button>
            </div>
            <div className="space-y-2">
              {form.actions.map((action, index) => {
                const selectedTemplate = catalog.templates.find((template) => template.name === action.templateName) ?? catalog.templates[0] ?? null;
                const selectedOptions = selectedTemplate ? catalog.options.filter((option) => option.templateId === selectedTemplate.id) : [];
                const isChipAction = action.actionType === "assign_chip" || action.actionType === "set_risk";
                const isColorAction = action.actionType === "color_row";
                const isLockAction = action.actionType === "lock_row";
                return (
                  <div key={action.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-700 dark:bg-slate-900/30 lg:grid-cols-[auto_1fr_1fr_1fr_auto]">
                    <span className="flex items-center text-xs font-semibold uppercase text-slate-400">#{index + 1}</span>
                    <select
                      value={action.actionType}
                      onChange={(e) => updateAction(action.id, { actionType: e.target.value as AutomationActionType })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {actionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    {isChipAction ? (
                      <>
                        <select
                          value={action.templateName}
                          onChange={(e) => updateAction(action.id, { templateName: e.target.value, optionValue: "" })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          {catalog.templates.map((template) => <option key={template.id} value={template.name}>{template.name}</option>)}
                        </select>
                        <select
                          value={action.optionValue}
                          onChange={(e) => updateAction(action.id, { optionValue: e.target.value })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="">Çip seçeneği seç</option>
                          {selectedOptions.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
                        </select>
                      </>
                    ) : isColorAction ? (
                      <>
                        <select
                          value={action.rowColor}
                          onChange={(e) => updateAction(action.id, { rowColor: e.target.value })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          {rowColorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <span className="flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                          Satır tablo üzerinde renklendirilir
                        </span>
                      </>
                    ) : isLockAction ? (
                      <>
                        <input
                          value={action.body}
                          onChange={(e) => updateAction(action.id, { body: e.target.value })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Kilit nedeni"
                        />
                        <span className="flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                          Admin ve proje yöneticisi düzenleyebilir
                        </span>
                      </>
                    ) : (
                      <>
                        <input
                          value={action.title}
                          onChange={(e) => updateAction(action.id, { title: e.target.value })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Başlık"
                        />
                        <input
                          value={action.body}
                          onChange={(e) => updateAction(action.id, { body: e.target.value })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Mesaj / log notu"
                        />
                      </>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAction(action.id)} disabled={form.actions.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800 dark:bg-blue-950/20">
            <button type="button" onClick={() => setPreviewOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                <Eye className="h-4 w-4" />
                Kural testi
              </span>
              <Badge variant="outline" className="border-blue-300 bg-white/70 text-blue-800 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-100">
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {previewCount} satır etkilenir
              </Badge>
            </button>
            {previewOpen && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-slate-900">
                {previewTasks.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Bu kural mevcut veride satır eşleştirmiyor.</p>
                ) : (
                  <div className="space-y-2">
                    {previewTasks.slice(0, 8).map((task) => {
                      const project = task.project_id ? projects.find((item) => item.id === task.project_id) : null;
                      return (
                        <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                          <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">
                            {getTaskDisplayLabel(task)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{project?.name ?? "Projesiz"}</span>
                        </div>
                      );
                    })}
                    {previewTasks.length > 8 && <p className="text-xs text-slate-500">+{previewTasks.length - 8} satır daha</p>}
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Bell className="h-3.5 w-3.5" />
              Bildirim aksiyonu merkezi bildirim kutusuna kayıt üretir; SQL köprüsü uygulanmadıysa otomasyon loglarında uyarı görünür.
            </p>
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
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{rule.name}</p>
                      <Badge variant={rule.enabled ? "default" : "outline"}>{rule.enabled ? "Aktif" : "Pasif"}</Badge>
                      <Badge variant="outline">{project?.name ?? "Tüm projeler"}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {rule.conditions.map((condition, index) => (
                        <Badge key={`${rule.id}-condition-${index}`} variant="outline" className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          {index === 0 ? "Eğer" : "Ve"} {condition.field} {operatorLabel(condition.op)} {condition.value ? condition.value : ""}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {rule.actions.map((action) => (
                        <Badge key={action.id} variant="outline" className={cn("bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200", action.actionType === "notify" && "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200")}>
                          {actionLabel(action)}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {rule.conditions.length} koşul · {rule.actions.length} aksiyon · {tasks.filter((task) => ruleMatchesTask(rule, task, { rowChipValues, catalog })).length} mevcut eşleşme
                    </p>
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

      <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <Filter className="h-4 w-4 text-blue-600" />
              Otomasyon logları
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Son çalışmalar, hata nedenleri ve etkilenen satırlar.
            </p>
          </div>
          <Badge variant="outline">{filteredLogs.length} kayıt</Badge>
        </div>

        <div className="grid gap-2 border-b border-slate-200 p-3 dark:border-slate-700 md:grid-cols-3">
          <select
            value={logStatusFilter}
            onChange={(e) => setLogStatusFilter(e.target.value as AutomationLog["status"] | "all")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm durumlar</option>
            <option value="applied">Başarılı</option>
            <option value="failed">Başarısız</option>
            <option value="skipped">Atlandı</option>
          </select>
          <select
            value={logRuleFilter}
            onChange={(e) => setLogRuleFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm kurallar</option>
            {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
          </select>
          <select
            value={logProjectFilter}
            onChange={(e) => setLogProjectFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="all">Tüm projeler</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
            Bu filtrelerle otomasyon logu bulunamadı.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredLogs.slice(0, 80).map((log) => {
              const task = log.taskId ? taskById.get(log.taskId) : null;
              const project = task?.project_id ? projects.find((item) => item.id === task.project_id) : null;
              const rule = log.ruleId ? ruleById.get(log.ruleId) : null;
              const ok = log.status === "applied";
              const failed = log.status === "failed";
              return (
                <div key={log.id} className="grid gap-3 p-4 md:grid-cols-[auto_1fr_auto]">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full",
                      ok && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300",
                      failed && "bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-300",
                      !ok && !failed && "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    )}
                    aria-hidden
                  >
                    {ok ? <CheckCircle2 className="h-4 w-4" /> : failed ? <XCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={ok ? "default" : failed ? "destructive" : "outline"}>
                        {ok ? "Başarılı" : failed ? "Başarısız" : "Atlandı"}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {getRelativeTime(new Date(log.createdAt))}
                      </span>
                      {project && <Badge variant="outline">{project.name}</Badge>}
                      {rule && <Badge variant="outline">{rule.name}</Badge>}
                    </div>
                    <p className="mt-2 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                      {log.message ?? log.status}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {task ? getTaskDisplayLabel(task) : log.taskId ? `Satır: ${log.taskId}` : "Satır bilgisi yok"}
                    </p>
                  </div>
                  <div className="flex items-center justify-start md:justify-end">
                    {log.taskId ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/canli-tablo?task=${log.taskId}`}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Satıra git
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Bağlantı yok</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
