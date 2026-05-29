import type { AutomationRule } from "@/lib/automationRules";
import type { Task } from "@/types/tasks";

export type SpotlightDescriptor = {
  columnKey: string;
  values: string[];
  badgeColor: string;
  startsAt: string | null;
  endsAt: string | null;
};

export function normalizeSpotlightToken(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("tr");
}

export function parseSpotlightDescriptor(rule: AutomationRule): SpotlightDescriptor[] {
  return rule.actions.flatMap((action) => {
    if (action.actionType !== "color_row") return [];
    const spotlight = Boolean(action.payload?.spotlight);
    if (!spotlight) return [];
    const columnKey = String(action.payload?.spotlightColumn ?? "").trim();
    const values = Array.isArray(action.payload?.spotlightValues)
      ? action.payload.spotlightValues.map((item) => String(item).trim()).filter(Boolean)
      : [];
    if (!columnKey || values.length === 0) return [];
    const badgeColor = String(action.payload?.rowColor ?? action.payload?.color ?? "purple")
      .trim()
      .toLowerCase();
    const startsAtRaw = String(action.payload?.spotlightStartsAt ?? "").trim();
    const endsAtRaw = String(action.payload?.spotlightEndsAt ?? "").trim();
    return [{ columnKey, values, badgeColor, startsAt: startsAtRaw || null, endsAt: endsAtRaw || null }];
  });
}

export function isSpotlightDescriptorActive(descriptor: SpotlightDescriptor, nowMs: number): boolean {
  if (descriptor.startsAt) {
    const startMs = new Date(descriptor.startsAt).getTime();
    if (Number.isFinite(startMs) && nowMs < startMs) return false;
  }
  if (!descriptor.endsAt) return true;
  const endMs = new Date(descriptor.endsAt).getTime();
  if (Number.isNaN(endMs)) return true;
  return nowMs <= endMs;
}

export function taskValueForSpotlight(task: Task, columnKey: string): string {
  const key = columnKey.trim();
  if (!key) return "";
  const normalized = normalizeSpotlightToken(key);
  if (normalized === "content" || normalized === "açıklama" || normalized === "aciklama") {
    return String(task.content ?? "");
  }
  if (normalized === "status" || normalized === "durum") return String(task.status ?? "");
  if (normalized === "assignee" || normalized === "atanan") return String(task.assignee ?? "");
  if (normalized === "priority" || normalized === "oncelik" || normalized === "öncelik") {
    return String(task.priority ?? "");
  }
  if (normalized === "project" || normalized === "proje") return String(task.project_name ?? "");
  return String(task.extra_data?.[key] ?? "");
}

export function isSpotlightCellMatch(
  descriptor: SpotlightDescriptor,
  columnKey: string,
  value: string
): boolean {
  if (normalizeSpotlightToken(descriptor.columnKey) !== normalizeSpotlightToken(columnKey)) {
    return false;
  }
  const normalizedValue = normalizeSpotlightToken(value);
  if (!normalizedValue) return false;
  return descriptor.values.some((candidate) => normalizeSpotlightToken(candidate) === normalizedValue);
}
