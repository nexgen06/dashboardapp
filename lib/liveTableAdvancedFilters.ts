import type { Task } from "@/types/tasks";

export type AdvancedFilterOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty";

export type AdvancedFilterRule = {
  id: string;
  field: string;
  op: AdvancedFilterOperator;
  value: string;
};

export const ADVANCED_FILTER_OP_OPTIONS: { value: AdvancedFilterOperator; label: string }[] = [
  { value: "contains", label: "İçerir" },
  { value: "not_contains", label: "İçermez" },
  { value: "equals", label: "Eşittir" },
  { value: "not_equals", label: "Eşit değildir" },
  { value: "starts_with", label: "İle başlar" },
  { value: "ends_with", label: "İle biter" },
  { value: "is_empty", label: "Boştur" },
  { value: "is_not_empty", label: "Boş değildir" },
];

export function advancedFilterRuleIsActive(rule: AdvancedFilterRule): boolean {
  if (rule.op === "is_empty" || rule.op === "is_not_empty") return true;
  return rule.value.trim() !== "";
}

export function getTaskFieldValueForFilter(task: Task, fieldId: string): string {
  if (fieldId === "content") return task.content ?? "";
  if (fieldId === "status") return task.status ?? "";
  if (fieldId === "assignee") return task.assignee ?? "";
  if (fieldId === "priority") return String(task.priority ?? "");
  if (fieldId === "due_date") return task.due_date ?? "";
  if (fieldId.startsWith("extra:") && task.extra_data) {
    const k = fieldId.slice("extra:".length);
    return String(task.extra_data[k] ?? "");
  }
  return "";
}

export function taskMatchesAdvancedRule(task: Task, rule: AdvancedFilterRule): boolean {
  const raw = getTaskFieldValueForFilter(task, rule.field);
  const cell = raw.trim().toLowerCase();
  const val = rule.value.trim().toLowerCase();

  switch (rule.op) {
    case "is_empty":
      return raw.trim() === "";
    case "is_not_empty":
      return raw.trim() !== "";
    case "contains":
      return val === "" || cell.includes(val);
    case "not_contains":
      return val === "" || !cell.includes(val);
    case "equals":
      return cell === val;
    case "not_equals":
      return cell !== val;
    case "starts_with":
      return val === "" || cell.startsWith(val);
    case "ends_with":
      return val === "" || cell.endsWith(val);
    default:
      return true;
  }
}

export function generateAdvancedFilterRuleId(): string {
  return `afr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
