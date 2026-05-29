import { INTERNAL_EXTRA_DATA_KEYS } from "@/components/tasks-table/constants";

export type TaskFormData = {
  content: string;
  status: string;
  assignee: string;
  priority?: string | null;
  extra_data?: Record<string, string> | null;
};

export const EXTRA_DATA_LINK_KEY = "link";

export function toExtraDataRows(
  extra_data: Record<string, string> | null | undefined,
  excludeKeys: string[] = []
): Array<{ key: string; value: string }> {
  if (!extra_data || Object.keys(extra_data).length === 0) return [{ key: "", value: "" }];
  const set = new Set([...excludeKeys, ...Array.from(INTERNAL_EXTRA_DATA_KEYS)]);
  const entries = Object.entries(extra_data)
    .filter(([k]) => !set.has(k))
    .map(([key, value]) => ({ key, value: String(value ?? "") }));
  return entries.length > 0 ? entries : [{ key: "", value: "" }];
}

export function isSafeUrl(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://");
}

export const DEFAULT_PRIORITY_OPTIONS = ["High", "Medium", "Low"];
