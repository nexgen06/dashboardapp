"use client";

import { supabase } from "@/lib/supabaseClient";
import type { Task } from "@/types/tasks";
import type { ChipCatalog, RowChipValue } from "@/lib/chipSystem";
import { listChipCatalog, listRowChipValues, setRowChipValue } from "@/lib/chipSystem";
import { isStatusDone } from "@/lib/statusKind";
import {
  listTaskAutomationStates,
  upsertTaskAutomationState,
  type AutomationRowColor,
} from "@/lib/taskAutomationState";

export type AutomationConditionOperator =
  | "is_empty"
  | "is_not_empty"
  | "equals"
  | "not_equals"
  | "date_before_today"
  | "date_today"
  | "number_gt"
  | "number_lt"
  | "updated_before_days"
  | "status_not_done";

export type AutomationCondition = {
  field: string;
  op: AutomationConditionOperator;
  value?: string;
};

export type AutomationActionType = "assign_chip" | "notify" | "lock_row" | "set_risk" | "color_row" | "log_only";

export type AutomationAction = {
  id: string;
  ruleId: string;
  actionType: AutomationActionType;
  payload: Record<string, unknown>;
  sortOrder: number;
};

export type AutomationRule = {
  id: string;
  projectId: string | null;
  name: string;
  enabled: boolean;
  triggerType: "row_saved" | "scheduled" | "manual";
  conditions: AutomationCondition[];
  createdAt: string;
  updatedAt: string;
  actions: AutomationAction[];
};

export type AutomationLog = {
  id: string;
  ruleId: string | null;
  taskId: string | null;
  status: "applied" | "skipped" | "failed";
  message: string | null;
  createdAt: string;
};

type RuleRow = {
  id: string;
  project_id: string | null;
  name: string;
  enabled: boolean;
  trigger_type: AutomationRule["triggerType"];
  conditions: AutomationCondition[] | null;
  created_at: string;
  updated_at: string;
};

type ActionRow = {
  id: string;
  rule_id: string;
  action_type: AutomationActionType;
  payload: Record<string, unknown> | null;
  sort_order: number;
};

type LogRow = {
  id: string;
  rule_id: string | null;
  task_id: string | null;
  status: AutomationLog["status"];
  message: string | null;
  created_at: string;
};

function friendlyAutomationError(err: unknown): Error {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "42P01" || /automation_rules|automation_actions|automation_logs/i.test(e?.message ?? "")) {
    return new Error("Otomasyon tabloları yok. scripts/automation-rules.sql dosyasını Supabase SQL Editor'da çalıştırın.");
  }
  if (e?.code === "42501" || /row-level security|permission denied/i.test(e?.message ?? "")) {
    return new Error("Bu otomasyon işlemi için yetkiniz yok.");
  }
  return new Error(e?.message ?? "Otomasyon işlemi başarısız.");
}

function mapRule(row: RuleRow, actions: AutomationAction[]): AutomationRule {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    enabled: row.enabled,
    triggerType: row.trigger_type,
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    actions: actions.filter((action) => action.ruleId === row.id).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function mapAction(row: ActionRow): AutomationAction {
  return {
    id: row.id,
    ruleId: row.rule_id,
    actionType: row.action_type,
    payload: row.payload ?? {},
    sortOrder: row.sort_order,
  };
}

export async function listAutomationRules(projectIds: string[] = []): Promise<AutomationRule[]> {
  const rulesQuery = supabase
    .from("automation_rules")
    .select("id,project_id,name,enabled,trigger_type,conditions,created_at,updated_at")
    .order("updated_at", { ascending: false });
  const filteredRulesQuery = projectIds.length > 0
    ? rulesQuery.or(`project_id.is.null,project_id.in.(${projectIds.join(",")})`)
    : rulesQuery;
  const [rulesRes, actionsRes] = await Promise.all([
    filteredRulesQuery,
    supabase
      .from("automation_actions")
      .select("id,rule_id,action_type,payload,sort_order")
      .order("sort_order", { ascending: true }),
  ]);
  if (rulesRes.error) throw friendlyAutomationError(rulesRes.error);
  if (actionsRes.error) throw friendlyAutomationError(actionsRes.error);
  const actions = ((actionsRes.data ?? []) as ActionRow[]).map(mapAction);
  return ((rulesRes.data ?? []) as RuleRow[]).map((row) => mapRule(row, actions));
}

export async function saveAutomationRule(input: {
  id?: string;
  projectId?: string | null;
  name: string;
  enabled: boolean;
  triggerType?: AutomationRule["triggerType"];
  conditions: AutomationCondition[];
  actions: Array<{ actionType: AutomationActionType; payload: Record<string, unknown>; sortOrder?: number }>;
}): Promise<void> {
  const rulePayload = {
    project_id: input.projectId ?? null,
    name: input.name.trim(),
    enabled: input.enabled,
    trigger_type: input.triggerType ?? "row_saved",
    conditions: input.conditions,
  };
  const ruleRes = input.id
    ? await supabase
        .from("automation_rules")
        .update(rulePayload)
        .eq("id", input.id)
        .select("id")
        .single()
    : await supabase
        .from("automation_rules")
        .insert(rulePayload)
        .select("id")
        .single();
  if (ruleRes.error) throw friendlyAutomationError(ruleRes.error);
  const ruleId = String(ruleRes.data.id);
  const del = await supabase.from("automation_actions").delete().eq("rule_id", ruleId);
  if (del.error) throw friendlyAutomationError(del.error);
  if (input.actions.length > 0) {
    const { error } = await supabase.from("automation_actions").insert(
      input.actions.map((action, index) => ({
        rule_id: ruleId,
        action_type: action.actionType,
        payload: action.payload,
        sort_order: action.sortOrder ?? index,
      }))
    );
    if (error) throw friendlyAutomationError(error);
  }
}

export async function deleteAutomationRule(id: string): Promise<void> {
  const { error } = await supabase.from("automation_rules").delete().eq("id", id);
  if (error) throw friendlyAutomationError(error);
}

/**
 * Bir otomasyon kuralını (koşul + tüm aksiyonlarıyla) kopyalar.
 * Yeni kural pasif (enabled=false) olarak başlar — kullanıcı önce gözden geçirip aktif etsin.
 */
export async function duplicateAutomationRule(id: string): Promise<string> {
  // 1) Kaynak kural
  const { data: srcRule, error: ruleErr } = await supabase
    .from("automation_rules")
    .select("name,project_id,trigger_type,conditions")
    .eq("id", id)
    .single();
  if (ruleErr || !srcRule) throw friendlyAutomationError(ruleErr ?? new Error("Kaynak kural bulunamadı"));

  // 2) Yeni kural (pasif)
  const { data: created, error: createErr } = await supabase
    .from("automation_rules")
    .insert({
      name: `${srcRule.name} (kopya)`,
      project_id: srcRule.project_id,
      trigger_type: srcRule.trigger_type,
      enabled: false,
      conditions: srcRule.conditions ?? [],
    })
    .select("id")
    .single();
  if (createErr || !created) throw friendlyAutomationError(createErr ?? new Error("Kural kopyalanamadı"));
  const newId = String(created.id);

  // 3) Aksiyonları çek + yeni kurala ekle
  const { data: srcActions, error: actErr } = await supabase
    .from("automation_actions")
    .select("action_type,payload,sort_order")
    .eq("rule_id", id)
    .order("sort_order", { ascending: true });
  if (actErr) throw friendlyAutomationError(actErr);
  if (srcActions && srcActions.length > 0) {
    const { error: insErr } = await supabase
      .from("automation_actions")
      .insert(srcActions.map((a) => ({ ...a, rule_id: newId })));
    if (insErr) throw friendlyAutomationError(insErr);
  }
  return newId;
}

export async function listAutomationLogs(taskId: string): Promise<AutomationLog[]> {
  const { data, error } = await supabase
    .from("automation_logs")
    .select("id,rule_id,task_id,status,message,created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw friendlyAutomationError(error);
  return ((data ?? []) as LogRow[]).map((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    taskId: row.task_id,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function listRecentAutomationLogs(limit = 120): Promise<AutomationLog[]> {
  const { data, error } = await supabase
    .from("automation_logs")
    .select("id,rule_id,task_id,status,message,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(20, Math.min(300, Math.floor(limit))));
  if (error) throw friendlyAutomationError(error);
  return ((data ?? []) as LogRow[]).map((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    taskId: row.task_id,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
  }));
}

function taskFieldValue(task: Task, field: string): string {
  if (field === "content") return String(task.content ?? "");
  if (field === "status") return String(task.status ?? "");
  if (field === "assignee") return String(task.assignee ?? "");
  if (field === "priority") return String(task.priority ?? "");
  if (field === "due_date") return String(task.due_date ?? "");
  if (field === "updated_at") return String(task.updated_at ?? "");
  return String(task.extra_data?.[field] ?? "");
}

function normalizeConditionText(value: string): string {
  return value.trim().toLocaleLowerCase("tr");
}

function taskConditionValues(task: Task, field: string, rowChipValues?: RowChipValue[], catalog?: ChipCatalog): string[] {
  const values = [taskFieldValue(task, field)];
  if (rowChipValues && catalog && task.project_id) {
    const normalizedField = normalizeConditionText(field);
    const binding = catalog.bindings.find(
      (item) =>
        item.projectId === String(task.project_id) &&
        normalizeConditionText(item.columnKey) === normalizedField
    );
    if (binding) {
      const row = rowChipValues.find((item) => item.taskId === task.id && item.templateId === binding.templateId);
      const option = row ? catalog.options.find((item) => item.id === row.optionId) : null;
      if (option) values.push(option.label, option.value);
    }
  }
  return Array.from(new Set(values.map((value) => String(value ?? "").trim())));
}

function isToday(value: string): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function isBeforeToday(value: string): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export function ruleMatchesTask(
  rule: Pick<AutomationRule, "conditions" | "projectId">,
  task: Task,
  context?: { rowChipValues?: RowChipValue[]; catalog?: ChipCatalog }
): boolean {
  if (rule.projectId && String(task.project_id ?? "") !== rule.projectId) return false;
  return rule.conditions.every((condition) => {
    const values = taskConditionValues(task, condition.field, context?.rowChipValues, context?.catalog);
    const raw = values[0] ?? "";
    const target = String(condition.value ?? "").trim();
    if (condition.op === "is_empty") return values.every((value) => value === "");
    if (condition.op === "is_not_empty") return values.some((value) => value !== "");
    if (condition.op === "equals") return values.some((value) => normalizeConditionText(value) === normalizeConditionText(target));
    if (condition.op === "not_equals") return values.every((value) => normalizeConditionText(value) !== normalizeConditionText(target));
    if (condition.op === "date_before_today") return values.some(isBeforeToday);
    if (condition.op === "date_today") return values.some(isToday);
    if (condition.op === "number_gt") return values.some((value) => Number(value.replace(",", ".")) > Number(target.replace(",", ".")));
    if (condition.op === "number_lt") return values.some((value) => Number(value.replace(",", ".")) < Number(target.replace(",", ".")));
    if (condition.op === "updated_before_days") {
      if (!raw) return false;
      const d = new Date(raw).getTime();
      const days = Number(target || "7");
      return Number.isFinite(d) && Date.now() - d > days * 24 * 60 * 60 * 1000;
    }
    if (condition.op === "status_not_done") return !isStatusDone(task.status);
    return false;
  });
}

export function countRuleMatches(rule: Pick<AutomationRule, "conditions" | "projectId">, tasks: Task[]): number {
  return tasks.filter((task) => ruleMatchesTask(rule, task)).length;
}

async function logAutomation(input: {
  ruleId: string | null;
  taskId: string;
  status: AutomationLog["status"];
  message: string;
  before?: unknown;
  after?: unknown;
}) {
  const { error } = await supabase.from("automation_logs").insert({
    rule_id: input.ruleId,
    task_id: input.taskId,
    status: input.status,
    message: input.message,
    before_snapshot: input.before ?? {},
    after_snapshot: input.after ?? {},
  });
  if (error) console.warn("[automation log]", error.message);
}

async function createAutomationNotification(input: {
  taskId: string;
  ruleId: string;
  title: string;
  body?: string | null;
}): Promise<number> {
  const { data, error } = await supabase.rpc("create_automation_notification", {
    p_task_id: input.taskId,
    p_rule_id: input.ruleId,
    p_title: input.title,
    p_body: input.body ?? null,
  });
  if (error) {
    const message = String(error.message ?? "");
    if (/create_automation_notification|function/i.test(message)) return 0;
    throw new Error(message || "Otomasyon bildirimi oluşturulamadı.");
  }
  return Number(data ?? 0);
}

function findOption(catalog: ChipCatalog, templateName: string, optionValueOrLabel: string) {
  const template = catalog.templates.find((item) => item.name.toLocaleLowerCase("tr") === templateName.toLocaleLowerCase("tr"));
  if (!template) return null;
  const option = catalog.options.find(
    (item) =>
      item.templateId === template.id &&
      (item.value.toLocaleLowerCase("tr") === optionValueOrLabel.toLocaleLowerCase("tr") ||
        item.label.toLocaleLowerCase("tr") === optionValueOrLabel.toLocaleLowerCase("tr"))
  );
  return option ? { template, option } : null;
}

const AUTOMATION_ROW_COLORS = new Set<AutomationRowColor>(["red", "amber", "emerald", "blue", "purple", "slate"]);

function normalizeRowColor(value: unknown): AutomationRowColor | null {
  const color = String(value ?? "").trim().toLowerCase();
  return AUTOMATION_ROW_COLORS.has(color as AutomationRowColor) ? color as AutomationRowColor : null;
}

export async function applyAutomationRulesForTasks(tasks: Task[], rules: AutomationRule[], catalog?: ChipCatalog): Promise<number> {
  const activeRules = rules.filter((rule) => rule.enabled);
  if (tasks.length === 0) return 0;
  const effectiveCatalog = catalog ?? await listChipCatalog(Array.from(new Set(tasks.map((task) => String(task.project_id ?? "")).filter(Boolean))));
  const currentRows = await listRowChipValues(tasks.map((task) => task.id));
  const currentStates = await listTaskAutomationStates(tasks.map((task) => task.id));
  const stateByTaskId = new Map(currentStates.map((state) => [state.taskId, state]));
  const hasChip = (taskId: string, templateId: string, optionId: string) =>
    currentRows.some((row) => row.taskId === taskId && row.templateId === templateId && row.optionId === optionId);
  let applied = 0;
  for (const task of tasks) {
    let matchedRowColor: AutomationRowColor | null = null;
    for (const rule of activeRules) {
      if (!ruleMatchesTask(rule, task, { rowChipValues: currentRows, catalog: effectiveCatalog })) continue;
      for (const action of rule.actions) {
        if (action.actionType === "log_only") {
          continue;
        }
        if (action.actionType === "notify") {
          const title = String(action.payload.title ?? "Otomasyon bildirimi").trim() || "Otomasyon bildirimi";
          const body = String(action.payload.body ?? rule.name ?? "").trim();
          try {
            const notified = await createAutomationNotification({
              taskId: task.id,
              ruleId: rule.id,
              title,
              body,
            });
            if (notified > 0) {
              await logAutomation({
                ruleId: rule.id,
                taskId: task.id,
                status: "applied",
                message: `Bildirim gönderildi (${notified})`,
                after: { title, body, notified },
              });
              applied += 1;
            }
          } catch (err) {
            await logAutomation({
              ruleId: rule.id,
              taskId: task.id,
              status: "failed",
              message: err instanceof Error ? err.message : "Bildirim oluşturulamadı.",
            });
          }
          continue;
        }
        if (action.actionType === "color_row") {
          const rowColor = normalizeRowColor(action.payload.rowColor ?? action.payload.color);
          if (!rowColor) {
            await logAutomation({ ruleId: rule.id, taskId: task.id, status: "failed", message: "Satır rengi geçersiz." });
            continue;
          }
          matchedRowColor = rowColor;
          const existing = stateByTaskId.get(task.id);
          if (existing?.rowColor === rowColor) continue;
          const ok = await upsertTaskAutomationState(task.id, { rowColor });
          if (!ok) {
            await logAutomation({
              ruleId: rule.id,
              taskId: task.id,
              status: "failed",
              message: "Satır rengi yazılamadı. scripts/task-automation-state.sql uygulanmamış olabilir.",
            });
            continue;
          }
          stateByTaskId.set(task.id, {
            taskId: task.id,
            rowColor,
            locked: existing?.locked ?? false,
            lockedReason: existing?.lockedReason ?? null,
            updatedAt: new Date().toISOString(),
          });
          await logAutomation({
            ruleId: rule.id,
            taskId: task.id,
            status: "applied",
            message: `Satır rengi = ${rowColor}`,
            after: { rowColor },
          });
          applied += 1;
          continue;
        }
        if (action.actionType === "lock_row") {
          const existing = stateByTaskId.get(task.id);
          const reason = String(action.payload.body ?? action.payload.reason ?? rule.name ?? "Otomasyon kilidi").trim();
          if (existing?.locked && (existing.lockedReason ?? "") === reason) continue;
          const ok = await upsertTaskAutomationState(task.id, { locked: true, lockedReason: reason });
          if (!ok) {
            await logAutomation({
              ruleId: rule.id,
              taskId: task.id,
              status: "failed",
              message: "Satır kilidi yazılamadı. scripts/task-automation-state.sql uygulanmamış olabilir.",
            });
            continue;
          }
          stateByTaskId.set(task.id, {
            taskId: task.id,
            rowColor: existing?.rowColor ?? null,
            locked: true,
            lockedReason: reason,
            updatedAt: new Date().toISOString(),
          });
          await logAutomation({
            ruleId: rule.id,
            taskId: task.id,
            status: "applied",
            message: `Satır kilitlendi: ${reason}`,
            after: { locked: true, lockedReason: reason },
          });
          applied += 1;
          continue;
        }
        if (action.actionType !== "assign_chip" && action.actionType !== "set_risk") continue;
        const templateName = String(action.payload.templateName ?? (action.actionType === "set_risk" ? "Risk" : ""));
        const optionValue = String(action.payload.optionValue ?? action.payload.optionLabel ?? "");
        const found = findOption(effectiveCatalog, templateName, optionValue);
        if (!found) {
          await logAutomation({ ruleId: rule.id, taskId: task.id, status: "failed", message: `${templateName}/${optionValue} çipi bulunamadı.` });
          continue;
        }
        if (hasChip(task.id, found.template.id, found.option.id)) continue;
        await setRowChipValue({
          taskId: task.id,
          templateId: found.template.id,
          optionId: found.option.id,
          source: "automation",
        });
        await logAutomation({
          ruleId: rule.id,
          taskId: task.id,
          status: "applied",
          message: `${found.template.name} = ${found.option.label}`,
          after: { template: found.template.name, option: found.option.label },
        });
        applied += 1;
      }
    }
    const existingAfterRules = stateByTaskId.get(task.id);
    if (existingAfterRules?.rowColor && matchedRowColor == null) {
      const ok = await upsertTaskAutomationState(task.id, { rowColor: null });
      if (ok) {
        stateByTaskId.set(task.id, {
          ...existingAfterRules,
          rowColor: null,
          updatedAt: new Date().toISOString(),
        });
        await logAutomation({
          ruleId: null,
          taskId: task.id,
          status: "applied",
          message: "Satır rengi temizlendi: renk kuralı artık eşleşmiyor.",
          before: { rowColor: existingAfterRules.rowColor },
          after: { rowColor: null },
        });
        applied += 1;
      }
    }
  }
  return applied;
}

export async function applyBuiltInOperationalRules(tasks: Task[], existingRows?: RowChipValue[], catalog?: ChipCatalog): Promise<number> {
  const effectiveCatalog = catalog ?? await listChipCatalog(Array.from(new Set(tasks.map((task) => String(task.project_id ?? "")).filter(Boolean))));
  const currentRows = existingRows ?? await listRowChipValues(tasks.map((task) => task.id));
  const hasChip = (taskId: string, templateId: string, optionId: string) =>
    currentRows.some((row) => row.taskId === taskId && row.templateId === templateId && row.optionId === optionId);
  let applied = 0;
  const actions = [
    { template: "Risk", option: "critical", test: (task: Task) => !!task.due_date && isBeforeToday(task.due_date) && !isStatusDone(task.status) },
    { template: "Sistem", option: "due_today", test: (task: Task) => !!task.due_date && isToday(task.due_date) },
    {
      template: "Ödeme Durumu",
      option: "overdue",
      test: (task: Task) => {
        const paymentDate = taskFieldValue(task, "Ödeme Tarihi") || taskFieldValue(task, "Odeme Tarihi") || taskFieldValue(task, "payment_date");
        const paymentStatus = taskFieldValue(task, "Ödeme Durumu") || taskFieldValue(task, "Odeme Durumu") || taskFieldValue(task, "payment_status");
        return isBeforeToday(paymentDate) && !/ödendi|odendi|paid/i.test(paymentStatus);
      },
    },
    { template: "Sistem", option: "stale", test: (task: Task) => !!task.updated_at && Date.now() - new Date(task.updated_at).getTime() > 7 * 24 * 60 * 60 * 1000 },
  ];
  for (const task of tasks) {
    for (const action of actions) {
      if (!action.test(task)) continue;
      const found = findOption(effectiveCatalog, action.template, action.option);
      if (!found || hasChip(task.id, found.template.id, found.option.id)) continue;
      await setRowChipValue({ taskId: task.id, templateId: found.template.id, optionId: found.option.id, source: "automation" });
      await logAutomation({
        ruleId: null,
        taskId: task.id,
        status: "applied",
        message: `Yerleşik kural: ${found.template.name} = ${found.option.label}`,
        after: { template: found.template.name, option: found.option.label },
      });
      applied += 1;
    }
  }
  return applied;
}
