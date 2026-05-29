"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  ExternalLink,
  Filter,
  Info,
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
import { useConfirm } from "@/components/ui/modals";
import {
  deleteAutomationRule,
  duplicateAutomationRule,
  listRecentAutomationLogs,
  listAutomationRules,
  ruleMatchesTask,
  runAutomationRuleNow,
  saveAutomationRule,
  type AutomationLog,
  type AutomationActionType,
  type AutomationCondition,
  type AutomationConditionLogic,
  type AutomationConditionOperator,
  type AutomationRule,
} from "@/lib/automationRules";
import { listChipCatalog, listRowChipValues, type ChipCatalog, type RowChipValue } from "@/lib/chipSystem";
import { listReferenceSources, type ReferenceSource } from "@/lib/referenceSources";
import { getTaskDisplayLabel } from "@/lib/taskDisplayLabel";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import {
  fetchSpotlightEnabledFromServer,
  persistSpotlightEnabledToServer,
} from "@/lib/appSettingsSupabase";
import {
  actionLabel,
  actionTypes,
  defaultAction,
  defaultCondition,
  draftId,
  operatorLabel,
  operators,
  rowColorOptions,
  toDatetimeLocalInput,
  type DraftAction,
  type DraftCondition,
} from "@/lib/automationCenterHelpers";

export function AutomationCenterView() {
  const { isLoaded, hasPermission, user } = useAuth();
  const { projects } = useProjects();
  const { tasks } = useTasksWithRealtime();
  const toast = useToast();
  const confirm = useConfirm();
  const canView = hasPermission("automation.view") || hasPermission("userManagement.view");
  const canManage = hasPermission("automation.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [catalog, setCatalog] = useState<ChipCatalog>({ templates: [], options: [], bindings: [] });
  const [rowChipValues, setRowChipValues] = useState<RowChipValue[]>([]);
  const [referenceSources, setReferenceSources] = useState<ReferenceSource[]>([]);
  const [spotlightEnabled, setSpotlightEnabled] = useState(true);
  const [spotlightSaving, setSpotlightSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState<AutomationLog["status"] | "all">("all");
  const [logRuleFilter, setLogRuleFilter] = useState("all");
  const [logProjectFilter, setLogProjectFilter] = useState("all");
  const [form, setForm] = useState({
    name: "Geciken görev riski",
    projectId: "",
    enabled: true,
    triggerType: "row_saved" as AutomationRule["triggerType"],
    conditionLogic: "and" as AutomationConditionLogic,
    priority: 0,
    conditions: [
      defaultCondition({ field: "due_date", op: "date_before_today" }),
      defaultCondition({ field: "status", op: "status_not_done" }),
    ] as DraftCondition[],
    actions: [defaultAction({ actionType: "set_risk", templateName: "Risk", optionValue: "critical" })] as DraftAction[],
  });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const projectIds = projects.map((project) => project.id);
      const taskIds = tasks.map((task) => task.id);
      const [nextRules, nextCatalog, nextLogs, nextRowChipValues, nextRefs] = await Promise.all([
        listAutomationRules(projectIds),
        listChipCatalog(projectIds),
        listRecentAutomationLogs(),
        taskIds.length > 0 ? listRowChipValues(taskIds) : Promise.resolve([]),
        listReferenceSources().catch(() => [] as ReferenceSource[]),
      ]);
      const spotlightMode = await fetchSpotlightEnabledFromServer().catch(() => null);
      setRules(nextRules);
      setCatalog(nextCatalog);
      setLogs(nextLogs);
      setRowChipValues(nextRowChipValues);
      setReferenceSources(nextRefs);
      setSpotlightEnabled(spotlightMode ?? true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Otomasyonlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [canView, projects, tasks, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const draftRule = useMemo<Pick<AutomationRule, "conditions" | "projectId" | "conditionLogic">>(() => ({
    projectId: form.projectId || null,
    conditionLogic: form.conditionLogic,
    conditions: form.conditions.map(({ field, op, value }) => ({ field, op, value })),
  }), [form.conditions, form.conditionLogic, form.projectId]);
  const previewTasks = useMemo(
    () => tasks.filter((task) => ruleMatchesTask(draftRule, task, { rowChipValues, catalog })),
    [catalog, draftRule, rowChipValues, tasks]
  );
  const previewCount = previewTasks.length;
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const ruleById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);
  // RPC eksikliği tespiti: loglarda "create_automation_notification" hatası varsa
  // veya kural notify aksiyonu içeriyor ama Bildirim başarısız oluyorsa banner göster.
  const notifyRpcMissing = useMemo(() => {
    return logs.some(
      (log) =>
        log.status === "failed" &&
        (log.message ?? "").toLowerCase().includes("create_automation_notification")
    );
  }, [logs]);

  const hasAnyNotifyAction = useMemo(
    () => rules.some((rule) => rule.actions.some((action) => action.actionType === "notify")),
    [rules]
  );

  /**
   * Koşul "değer" inputu için referans önerisi:
   * Field adı bir referans kaynağının adı veya kategorisi ile eşleşiyorsa,
   * o kaynağın labelField değerleri öneri olarak listelenir.
   * Türkçe normalize edilmiş eşleşme.
   */
  const findReferenceForField = useCallback(
    (field: string): ReferenceSource | null => {
      const f = field.trim().toLocaleLowerCase("tr");
      if (!f) return null;
      // 1) name tam eşleşme
      const byName = referenceSources.find((s) => s.name.trim().toLocaleLowerCase("tr") === f);
      if (byName) return byName;
      // 2) name içeriyor (ör. field "Şehir", source "Şehir Listesi")
      const byNameLike = referenceSources.find((s) => {
        const n = s.name.trim().toLocaleLowerCase("tr");
        return n.includes(f) || f.includes(n);
      });
      if (byNameLike) return byNameLike;
      // 3) Kategori eşleşmesi
      const byCategory = referenceSources.find(
        (s) => s.category && s.category.trim().toLocaleLowerCase("tr") === f
      );
      return byCategory ?? null;
    },
    [referenceSources]
  );

  /**
   * Koşul "alan" inputu için dinamik öneri listesi.
   * Kategoriler:
   *   1. Standart: content, status, assignee, priority, due_date, updated_at
   *   2. Proje ek kolonları: projects.extra_column_keys + chip bindings
   *   3. Gözlemlenen: tasks.extra_data anahtarlarında geçen (önceki ikisinde yoksa)
   *
   * form.projectId boşsa tüm projelerin alanları, doluysa sadece o projeninkiler.
   */
  const availableFields = useMemo(() => {
    const standard: Array<{ value: string; label: string }> = [
      { value: "content", label: "İçerik (content)" },
      { value: "status", label: "Durum (status)" },
      { value: "assignee", label: "Atanan (assignee)" },
      { value: "priority", label: "Öncelik (priority)" },
      { value: "due_date", label: "Son tarih (due_date)" },
      { value: "updated_at", label: "Güncellenme (updated_at)" },
    ];
    const standardSet = new Set(standard.map((s) => s.value));
    const fromProjectKeys = new Set<string>();
    const fromChips = new Set<string>();
    const fromTasks = new Set<string>();

    const scopedProjects = form.projectId
      ? projects.filter((p) => p.id === form.projectId)
      : projects;
    for (const project of scopedProjects) {
      for (const key of project.extra_column_keys ?? []) {
        const k = String(key ?? "").trim();
        if (k && !standardSet.has(k)) fromProjectKeys.add(k);
      }
    }

    for (const binding of catalog.bindings) {
      if (form.projectId && binding.projectId !== form.projectId) continue;
      const k = (binding.columnKey ?? "").trim();
      if (k && !standardSet.has(k)) fromChips.add(k);
    }

    const scopedTasks = form.projectId
      ? tasks.filter((t) => String(t.project_id ?? "") === form.projectId)
      : tasks;
    for (const task of scopedTasks) {
      if (!task.extra_data) continue;
      for (const k of Object.keys(task.extra_data)) {
        const key = k.trim();
        if (!key || standardSet.has(key)) continue;
        if (!fromProjectKeys.has(key) && !fromChips.has(key)) fromTasks.add(key);
      }
    }

    const combinedExtras = new Set<string>();
    fromProjectKeys.forEach((k) => combinedExtras.add(k));
    fromChips.forEach((k) => combinedExtras.add(k));
    const extras = Array.from(combinedExtras).sort((a, b) =>
      a.localeCompare(b, "tr", { sensitivity: "base" })
    );
    const observed = Array.from(fromTasks).sort((a, b) =>
      a.localeCompare(b, "tr", { sensitivity: "base" })
    );
    return { standard, extras, observed };
  }, [catalog.bindings, form.projectId, projects, tasks]);

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
    if (
      form.actions.some(
        (action) =>
          action.actionType === "color_row" &&
          action.spotlightEnabled &&
          (!action.spotlightColumn.trim() || !action.spotlightValues.trim())
      )
    ) {
      toast.error("Spotlight için sütun ve en az bir değer girilmeli.");
      return;
    }
    if (
      form.actions.some(
        (action) =>
          action.actionType === "color_row" &&
          action.spotlightEnabled &&
          action.spotlightStartsAt &&
          Number.isNaN(new Date(action.spotlightStartsAt).getTime())
      )
    ) {
      toast.error("Spotlight başlangıç zamanı geçersiz.");
      return;
    }
    if (
      form.actions.some(
        (action) =>
          action.actionType === "color_row" &&
          action.spotlightEnabled &&
          action.spotlightEndsAt &&
          Number.isNaN(new Date(action.spotlightEndsAt).getTime())
      )
    ) {
      toast.error("Spotlight bitiş zamanı geçersiz.");
      return;
    }
    if (
      form.actions.some((action) => {
        if (action.actionType !== "color_row" || !action.spotlightEnabled) return false;
        if (!action.spotlightStartsAt || !action.spotlightEndsAt) return false;
        return new Date(action.spotlightStartsAt).getTime() >= new Date(action.spotlightEndsAt).getTime();
      })
    ) {
      toast.error("Spotlight başlangıç zamanı bitişten önce olmalı.");
      return;
    }
    try {
      await saveAutomationRule({
        id: editingRuleId ?? undefined,
        name: form.name,
        projectId: form.projectId || null,
        enabled: form.enabled,
        triggerType: form.triggerType,
        conditionLogic: form.conditionLogic,
        priority: form.priority,
        conditions: draftRule.conditions,
        actions: form.actions.map((action, index) => ({
          actionType: action.actionType,
          sortOrder: index,
          payload:
            action.actionType === "notify"
              ? { title: action.title, body: action.body }
              : action.actionType === "color_row"
                ? {
                    rowColor: action.rowColor,
                    spotlight: action.spotlightEnabled,
                    spotlightColumn: action.spotlightColumn.trim(),
                    spotlightValues: action.spotlightValues
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                    spotlightStartsAt: action.spotlightStartsAt ? new Date(action.spotlightStartsAt).toISOString() : null,
                    spotlightEndsAt: action.spotlightEndsAt ? new Date(action.spotlightEndsAt).toISOString() : null,
                  }
                : action.actionType === "lock_row"
                  ? { body: action.body || form.name }
              : action.actionType === "log_only"
                ? { message: action.body || form.name }
                : { templateName: action.templateName, optionValue: action.optionValue },
        })),
      });
      toast.success(editingRuleId ? "Kural güncellendi" : "Otomasyon kuralı kaydedildi");
      setEditingRuleId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kural kaydedilemedi.");
    }
  };

  /** Mevcut bir kuralı düzenleme moduna al — form alanlarını kuralın değerleriyle doldurur. */
  const handleEditRule = (rule: AutomationRule) => {
    setEditingRuleId(rule.id);
    setForm({
      name: rule.name,
      projectId: rule.projectId ?? "",
      enabled: rule.enabled,
      triggerType: rule.triggerType ?? "row_saved",
      conditionLogic: rule.conditionLogic ?? "and",
      priority: rule.priority ?? 0,
      conditions: rule.conditions.map((c) => defaultCondition({ field: c.field, op: c.op, value: c.value })),
      actions: rule.actions.map((a) => {
        const payload = a.payload ?? {};
        return defaultAction({
          actionType: a.actionType,
          templateName: String(payload.templateName ?? "Risk"),
          optionValue: String(payload.optionValue ?? payload.optionLabel ?? ""),
          rowColor: String(payload.rowColor ?? payload.color ?? "red"),
          spotlightEnabled: Boolean(payload.spotlight),
          spotlightColumn: String(payload.spotlightColumn ?? ""),
          spotlightValues: Array.isArray(payload.spotlightValues)
            ? payload.spotlightValues.map((item) => String(item)).join(", ")
            : String(payload.spotlightValues ?? ""),
          spotlightStartsAt: toDatetimeLocalInput(String(payload.spotlightStartsAt ?? "")),
          spotlightEndsAt: toDatetimeLocalInput(String(payload.spotlightEndsAt ?? "")),
          title: String(payload.title ?? "Otomasyon bildirimi"),
          body: String(payload.body ?? payload.reason ?? payload.message ?? ""),
        });
      }),
    });
    setPreviewOpen(true);
    // Sayfa başına scroll — form üstte
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setForm({
      name: "Yeni kural",
      projectId: "",
      enabled: true,
      triggerType: "row_saved",
      conditionLogic: "and",
      priority: 0,
      conditions: [defaultCondition({ field: "due_date", op: "date_before_today" })],
      actions: [defaultAction()],
    });
  };

  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);

  const handleToggleSpotlight = async () => {
    if (!canManage || spotlightSaving) return;
    const next = !spotlightEnabled;
    setSpotlightSaving(true);
    try {
      const ok = await persistSpotlightEnabledToServer(next);
      if (!ok) throw new Error("Spotlight ayarı kaydedilemedi.");
      setSpotlightEnabled(next);
      toast.success(next ? "Merkezi Spotlight açıldı" : "Merkezi Spotlight kapatıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Spotlight ayarı güncellenemedi.");
    } finally {
      setSpotlightSaving(false);
    }
  };

  const handleRunRule = async (rule: AutomationRule) => {
    const matchCount = tasks.filter((task) => ruleMatchesTask(rule, task, { rowChipValues, catalog })).length;
    if (matchCount === 0) {
      toast.info("Bu kural mevcut veride hiç satıra uymuyor — çalıştırma atlandı.");
      return;
    }
    const ok = await confirm({
      title: "Kuralı şimdi çalıştır?",
      message: `"${rule.name}" kuralı ${matchCount} satıra uygulanacak. Aksiyonlar (çip atama / renklendirme / kilit / bildirim) hemen tetiklenir. Devam edilsin mi?`,
      confirmLabel: "Çalıştır",
    });
    if (!ok) return;
    setRunningRuleId(rule.id);
    try {
      const result = await runAutomationRuleNow(rule, tasks, catalog);
      toast.success(`Kural çalıştırıldı: ${result.matched} eşleşme, ${result.applied} aksiyon uygulandı.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kural çalıştırılamadı.");
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleDuplicateRule = async (rule: AutomationRule) => {
    try {
      await duplicateAutomationRule(rule.id);
      toast.success(`"${rule.name}" kopyalandı (pasif olarak)`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kural kopyalanamadı.");
    }
  };

  const handleDeleteRule = async (rule: AutomationRule) => {
    const ok = await confirm({
      title: "Kuralı sil?",
      message: `"${rule.name}" kuralı, tüm aksiyonları ve log geçmişi silinecek. Geri alınamaz.`,
      variant: "destructive",
      confirmLabel: "Evet, sil",
    });
    if (!ok) return;
    try {
      await deleteAutomationRule(rule.id);
      toast.success("Kural silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kural silinemedi.");
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

      {/* RPC eksikliği bildirim banner */}
      {notifyRpcMissing && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              Bildirim aksiyonları çalışmıyor
            </p>
            <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-200/80">
              <code className="font-mono">create_automation_notification</code> RPC veritabanında bulunamadı.
              Notify tipi aksiyon içeren kurallar bildirim üretmeyecek.{" "}
              <code className="font-mono">scripts/automation-notifications.sql</code> dosyasını
              Supabase SQL Editor&apos;da çalıştırın.
            </p>
          </div>
        </div>
      )}
      {!notifyRpcMissing && hasAnyNotifyAction && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Bildirim aksiyonu içeren kurallar, satır kaydedildiğinde admin/proje yetkilisi/atanan kullanıcıya merkezi bildirim üretir.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("risk")}>Geciken görev riski</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("payment")}>Ödeme gecikmesi</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("stale")}>Hareketsiz satır</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("document")}>Eksik evrak</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => seedPreset("approval")}>Onay bekliyor</Button>
      </div>

      <section className="rounded-lg border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-700 dark:bg-violet-950/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">Merkezi Reflektör (Spotlight)</p>
            <p className="text-xs text-violet-700/90 dark:text-violet-200/85">
              Bu anahtar kapalıysa canlı tabloda spotlight satır vurgusu ve dimming geçici olarak devre dışı kalır.
            </p>
          </div>
          <Button
            type="button"
            variant={spotlightEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => void handleToggleSpotlight()}
            disabled={!canManage || spotlightSaving}
            className={spotlightEnabled ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}
          >
            {spotlightSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {spotlightEnabled ? "Spotlight açık" : "Spotlight kapalı"}
          </Button>
        </div>
      </section>

      {canManage && (
        <form onSubmit={saveRule} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          {/* Tek datalist — tüm koşul input'ları aynı öneri listesini kullanır.
              Kategoriler optgroup ile ayrıştırılır. */}
          <datalist id="automation-field-suggestions">
            {availableFields.standard.map((f) => (
              <option key={`std-${f.value}`} value={f.value}>{f.label}</option>
            ))}
            {availableFields.extras.map((f) => (
              <option key={`ext-${f}`} value={f}>{f} (proje kolonu)</option>
            ))}
            {availableFields.observed.map((f) => (
              <option key={`obs-${f}`} value={f}>{f} (görev verisinden)</option>
            ))}
          </datalist>

          {editingRuleId && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-700 dark:bg-blue-950/30">
              <span className="font-medium text-blue-800 dark:text-blue-200">
                Düzenleme modu — değişiklikler kaydedilince mevcut kurala uygulanır.
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
                <X className="mr-1 h-3.5 w-3.5" />
                İptal
              </Button>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_auto_auto]">
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
            <select
              value={form.triggerType}
              onChange={(e) => setForm((p) => ({ ...p, triggerType: e.target.value as AutomationRule["triggerType"] }))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              title="Kural ne zaman tetiklenecek?"
            >
              <option value="row_saved">Satır kaydedildiğinde</option>
              <option value="status_changed">Durum değiştiğinde</option>
              <option value="manual">Sadece manuel (Şimdi çalıştır)</option>
              <option value="scheduled">Planlanmış (yakında)</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300" title="Öncelik — küçük sayı önce çalışır">
              <span className="text-xs text-slate-400">P</span>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value) || 0 }))}
                className="w-12 bg-transparent text-sm focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
              Aktif
            </label>
          </div>

          <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <ListChecks className="h-4 w-4" />
                Eğer
              </h2>
              <div className="flex items-center gap-2">
                {/* Logic toggle: AND / OR */}
                <div
                  className="inline-flex overflow-hidden rounded-full border border-slate-200 text-[11px] dark:border-slate-600"
                  role="group"
                  aria-label="Koşul birleştirme mantığı"
                >
                  {(["and", "or"] as AutomationConditionLogic[]).map((logic) => {
                    const active = form.conditionLogic === logic;
                    return (
                      <button
                        key={logic}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, conditionLogic: logic }))}
                        className={cn(
                          "px-2.5 py-1 font-semibold uppercase transition-colors",
                          active
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                        )}
                        title={
                          logic === "and"
                            ? "Tüm koşullar geçerli olmalı"
                            : "Herhangi bir koşul yeterli"
                        }
                      >
                        {logic === "and" ? "Hepsi" : "Herhangi"}
                      </button>
                    );
                  })}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addCondition}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Koşul ekle
                </Button>
              </div>
            </div>
            <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
              Alan kutusuna tıklayınca {availableFields.standard.length} standart
              {availableFields.extras.length > 0 && ` + ${availableFields.extras.length} proje kolonu`}
              {availableFields.observed.length > 0 && ` + ${availableFields.observed.length} görev verisi`} alanı önerilir.
              {form.projectId
                ? " Sadece seçili projedeki alanlar listelenir."
                : " Tüm projelerdeki alanlar dahildir."}
              {" "}
              Listelenmeyen bir alanı elle de yazabilirsiniz.
            </p>
            <div className="space-y-2">
              {form.conditions.map((condition, index) => {
                const operator = operators.find((item) => item.value === condition.op);
                const needsValue = operator?.needsValue === true;
                // Bu koşul field'ı bir referans kaynağıyla eşleşiyor mu?
                const matchedRef = needsValue ? findReferenceForField(condition.field) : null;
                const refLabels = matchedRef?.labelField
                  ? Array.from(
                      new Set(
                        matchedRef.records
                          .map((r) => String(r[matchedRef.labelField!] ?? "").trim())
                          .filter(Boolean)
                      )
                    ).slice(0, 200) // Performans — datalist 200'den fazla item taşımasın
                  : [];
                const valueDatalistId = matchedRef ? `ref-values-${condition.id}` : undefined;
                return (
                  <div key={condition.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-700 dark:bg-slate-900/30 lg:grid-cols-[auto_1fr_1fr_1fr_auto]">
                    <span className="flex items-center text-xs font-semibold uppercase text-slate-400">
                      {index === 0 ? "Eğer" : form.conditionLogic === "or" ? "Veya" : "Ve"}
                    </span>
                    <input
                      value={condition.field}
                      onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                      list="automation-field-suggestions"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="Alan adı — listeden seç veya yaz"
                    />
                    <select
                      value={condition.op}
                      onChange={(e) => updateCondition(condition.id, { op: e.target.value as AutomationConditionOperator })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {operators.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <div className="flex flex-col gap-0.5">
                      <input
                        value={condition.value ?? ""}
                        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                        disabled={!needsValue}
                        list={valueDatalistId}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                        placeholder={needsValue ? (matchedRef ? `${matchedRef.name} kaynağından seç` : "Değer") : "Değer gerekmez"}
                      />
                      {valueDatalistId && refLabels.length > 0 && (
                        <>
                          <datalist id={valueDatalistId}>
                            {refLabels.map((label) => (
                              <option key={label} value={label} />
                            ))}
                          </datalist>
                          <span className="px-1 text-[10px] text-violet-600 dark:text-violet-300">
                            🔗 {matchedRef!.name} ({refLabels.length}{refLabels.length === 200 ? "+" : ""} kayıt)
                          </span>
                        </>
                      )}
                    </div>
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
                        <div className="flex flex-col gap-1">
                          <select
                            value={action.rowColor}
                            onChange={(e) => updateAction(action.id, { rowColor: e.target.value })}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {rowColorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={action.spotlightEnabled}
                              onChange={(e) => updateAction(action.id, { spotlightEnabled: e.target.checked })}
                            />
                            Spotlight reflektörü olarak uygula
                          </label>
                        </div>
                        <div className="flex flex-col gap-1">
                          {action.spotlightEnabled ? (
                            <>
                              <input
                                value={action.spotlightColumn}
                                onChange={(e) => updateAction(action.id, { spotlightColumn: e.target.value })}
                                list="automation-field-suggestions"
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                placeholder="Spotlight sütunu (örn: İl)"
                              />
                              <input
                                value={action.spotlightValues}
                                onChange={(e) => updateAction(action.id, { spotlightValues: e.target.value })}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                placeholder="Değerler (virgülle): İstanbul, İzmir"
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={action.spotlightStartsAt}
                                  onChange={(e) => updateAction(action.id, { spotlightStartsAt: e.target.value })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                  title="Reflektör başlangıç zamanı (opsiyonel)"
                                />
                                <input
                                  type="datetime-local"
                                  value={action.spotlightEndsAt}
                                  onChange={(e) => updateAction(action.id, { spotlightEndsAt: e.target.value })}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                                  title="Reflektör bitiş zamanı (opsiyonel)"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateAction(action.id, { spotlightStartsAt: toDatetimeLocalInput(new Date().toISOString()) })}
                                >
                                  Şimdi başlat
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const d = new Date();
                                    d.setMinutes(d.getMinutes() + 120);
                                    updateAction(action.id, {
                                      spotlightStartsAt: action.spotlightStartsAt || toDatetimeLocalInput(new Date().toISOString()),
                                      spotlightEndsAt: toDatetimeLocalInput(d.toISOString()),
                                    });
                                  }}
                                >
                                  +2 saat
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateAction(action.id, { spotlightStartsAt: "", spotlightEndsAt: "" })}
                                >
                                  Süresiz
                                </Button>
                              </div>
                            </>
                          ) : (
                            <span className="flex h-full items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                              Satır tablo üzerinde renklendirilir
                            </span>
                          )}
                        </div>
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
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {previewTasks.map((task) => {
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
            <Button type="submit">
              <Plus className="mr-2 h-4 w-4" />
              {editingRuleId ? "Kuralı güncelle" : "Kuralı kaydet"}
            </Button>
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
                      {rule.conditionLogic === "or" && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                          Herhangi
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] text-slate-500" title="Çalışma önceliği — küçük sayı önce">
                        P{rule.priority ?? 0}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] text-slate-500"
                        title="Tetikleyici"
                      >
                        {rule.triggerType === "row_saved"
                          ? "Satır kaydında"
                          : rule.triggerType === "status_changed"
                            ? "Durum değişiminde"
                            : rule.triggerType === "manual"
                              ? "Manuel"
                              : "Planlı"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {rule.conditions.map((condition, index) => (
                        <Badge key={`${rule.id}-condition-${index}`} variant="outline" className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          {index === 0 ? "Eğer" : rule.conditionLogic === "or" ? "Veya" : "Ve"} {condition.field} {operatorLabel(condition.op)} {condition.value ? condition.value : ""}
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
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRunRule(rule)}
                        disabled={runningRuleId === rule.id}
                        title="Bu kuralı şimdi tüm satırlara uygula"
                        className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                      >
                        {runningRuleId === rule.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-3.5 w-3.5" />
                        )}
                        Şimdi çalıştır
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRule(rule)}
                        title="Bu kuralı düzenle"
                      >
                        Düzenle
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-blue-600"
                        onClick={() => void handleDuplicateRule(rule)}
                        title="Kuralı kopyala (pasif olarak)"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-red-600"
                        onClick={() => void handleDeleteRule(rule)}
                        title="Kuralı sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
