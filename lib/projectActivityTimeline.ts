import {
  fieldLabel,
  formatAuditFieldValue,
  shouldShowAuditField,
  type AuditFieldDiff,
  type AuditLogEntry,
} from "@/lib/auditLog";
import { isSensitiveExtraColumnKey } from "@/lib/extraColumnSensitiveDisplay";
import { getTaskDisplayCard } from "@/lib/taskDisplayLabel";
import type { Task } from "@/types/tasks";

export type ProjectActivityActionType =
  | "task_updated"
  | "status_changed"
  | "assignment_changed"
  | "email_sent"
  | "system_update"
  | "task_created"
  | "task_deleted"
  | "project_updated";

export type ProjectActivityActorKind = "user" | "system" | "automation";

export type ProjectActivityChange = {
  field: string;
  oldValue: string;
  newValue: string;
  sensitive?: boolean;
};

export type ProjectActivityItem = {
  id: string;
  actorName: string;
  actorEmail: string;
  actorAvatar?: string;
  actorKind: ProjectActivityActorKind;
  actionType: ProjectActivityActionType;
  /** Görev Özeti ile aynı başlık + alt satır */
  taskLabel: string;
  taskSubtitle: string;
  recordId: string;
  tableName: string;
  summary: string;
  timestamp: string;
  changes: ProjectActivityChange[];
};

export type ProjectActivityFilterKind =
  | "all"
  | "task_updated"
  | "status_changed"
  | "assignment_changed"
  | "task_created"
  | "task_deleted"
  | "project_updated";

export type ProjectActivityDateFilterKind = "7d" | "30d" | "all";

export type ProjectActivityTimeGroup = "today" | "yesterday" | "earlier";

export const ACTIVITY_FILTER_OPTIONS: Array<{ value: ProjectActivityFilterKind; label: string }> = [
  { value: "all", label: "Tüm aktiviteler" },
  { value: "task_updated", label: "Görev güncellemeleri" },
  { value: "status_changed", label: "Durum değişiklikleri" },
  { value: "assignment_changed", label: "Atama değişiklikleri" },
  { value: "task_created", label: "Görev eklemeleri" },
  { value: "task_deleted", label: "Görev silmeleri" },
  { value: "project_updated", label: "Proje ayarları" },
];

export const ACTIVITY_DATE_FILTER_OPTIONS: Array<{ value: ProjectActivityDateFilterKind; label: string }> = [
  { value: "7d", label: "Son 7 gün" },
  { value: "30d", label: "Son 30 gün" },
  { value: "all", label: "Tüm zamanlar" },
];

export const TIME_GROUP_LABELS: Record<ProjectActivityTimeGroup, string> = {
  today: "Bugün",
  yesterday: "Dün",
  earlier: "Daha önce",
};

export type TransformProjectActivityOptions = {
  taskById: Map<string, Task>;
  projectTitleColumn?: string | null;
  subtitleColumns?: string[] | null;
  preferredExtraKeys?: string[];
  profileByEmail?: (email: string | null) => {
    nickname?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
  };
};

function resolveActorKind(entry: AuditLogEntry): ProjectActivityActorKind {
  const email = (entry.actorEmail ?? "").trim().toLowerCase();
  if (!email && !entry.actorId) return "system";
  if (
    email.includes("otomasyon") ||
    email.includes("automation") ||
    email.includes("noreply") ||
    email.startsWith("system@")
  ) {
    return "automation";
  }
  return "user";
}

function snapshotTask(entry: AuditLogEntry): { content?: string | null; extra_data?: Record<string, string> | null } | null {
  const full = entry.changedFields._full;
  if (!full || typeof full !== "object") return null;
  const snap = full as Record<string, unknown>;
  return {
    content: typeof snap.content === "string" ? snap.content : null,
    extra_data:
      snap.extra_data && typeof snap.extra_data === "object"
        ? (snap.extra_data as Record<string, string>)
        : null,
  };
}

type TaskDisplayPayload = {
  content?: string | null;
  extra_data?: Record<string, string> | null;
};

/** Bellekteki görev, audit snapshot veya update diff'inden görev verisi çıkar. */
function reconstructTaskPayload(
  entry: AuditLogEntry,
  options: TransformProjectActivityOptions
): TaskDisplayPayload | null {
  const existing = options.taskById.get(entry.recordId);
  if (existing) return existing;

  const fromSnapshot = snapshotTask(entry);
  if (fromSnapshot) return fromSnapshot;

  if (entry.action !== "update") return null;

  let content: string | null | undefined;
  let extra_data: Record<string, string> | undefined;

  for (const [field, diff] of Object.entries(entry.changedFields)) {
    if (!diff || typeof diff !== "object") continue;
    const d = diff as AuditFieldDiff;
    if (field === "content" && "after" in d) {
      content = d.after == null ? null : String(d.after);
    } else if (field === "extra_data") {
      if ("after" in d && d.after && typeof d.after === "object") {
        extra_data = { ...(extra_data ?? {}), ...(d.after as Record<string, string>) };
      }
      if ("before" in d && d.before && typeof d.before === "object") {
        extra_data = { ...(d.before as Record<string, string>), ...(extra_data ?? {}) };
      }
    }
  }

  if (content != null || (extra_data && Object.keys(extra_data).length > 0)) {
    return { content, extra_data: extra_data ?? null };
  }

  return null;
}

function resolveTaskDisplay(
  entry: AuditLogEntry,
  options: TransformProjectActivityOptions
): { taskLabel: string; taskSubtitle: string } {
  if (entry.tableName === "projects") {
    return { taskLabel: "Proje ayarları", taskSubtitle: "" };
  }

  const payload = reconstructTaskPayload(entry, options);
  if (!payload) return { taskLabel: "Görev", taskSubtitle: "" };

  const card = getTaskDisplayCard(payload, {
    projectTitleColumn: options.projectTitleColumn,
    subtitleColumns: options.subtitleColumns,
    preferredExtraKeys: options.preferredExtraKeys,
  });

  return {
    taskLabel: card.label !== "—" ? card.label : "Görev",
    taskSubtitle: card.subtitle.map((s) => s.value).join(" · "),
  };
}

function pushChange(
  changes: ProjectActivityChange[],
  fieldKey: string,
  before: unknown,
  after: unknown
) {
  const label = fieldLabel(fieldKey);
  changes.push({
    field: label,
    oldValue: formatAuditFieldValue(fieldKey, before),
    newValue: formatAuditFieldValue(fieldKey, after),
    sensitive: isSensitiveExtraColumnKey(fieldKey) || fieldKey === "extra_data",
  });
}

function extractChanges(entry: AuditLogEntry): ProjectActivityChange[] {
  if (entry.action !== "update") return [];

  const changes: ProjectActivityChange[] = [];
  const totalFields = Object.keys(entry.changedFields).length;

  for (const [field, diff] of Object.entries(entry.changedFields)) {
    if (field === "_full") continue;
    if (!shouldShowAuditField(field, totalFields)) continue;

    if (field === "extra_data" && diff && typeof diff === "object" && "before" in diff && "after" in diff) {
      const d = diff as AuditFieldDiff;
      const before = (d.before ?? {}) as Record<string, unknown>;
      const after = (d.after ?? {}) as Record<string, unknown>;
      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const key of Array.from(keys)) {
        const b = before[key];
        const a = after[key];
        if (JSON.stringify(b) === JSON.stringify(a)) continue;
        pushChange(changes, key, b, a);
      }
      continue;
    }

    if (diff && typeof diff === "object" && "before" in diff && "after" in diff) {
      pushChange(changes, field, (diff as AuditFieldDiff).before, (diff as AuditFieldDiff).after);
    }
  }

  return changes;
}

function determineActionType(
  entry: AuditLogEntry,
  changes: ProjectActivityChange[]
): ProjectActivityActionType {
  if (entry.tableName === "projects") return "project_updated";
  if (entry.action === "insert") return "task_created";
  if (entry.action === "delete") return "task_deleted";

  const normalizedFields = changes.map((c) => c.field.trim().toLowerCase());
  if (normalizedFields.includes("durum") || normalizedFields.includes("status")) {
    return "status_changed";
  }
  if (normalizedFields.includes("atanan") || normalizedFields.includes("assignee")) {
    return "assignment_changed";
  }
  if (!entry.actorEmail && !entry.actorId) return "system_update";
  return "task_updated";
}

function buildSummary(
  actorName: string,
  actionType: ProjectActivityActionType,
  actorKind: ProjectActivityActorKind
): string {
  const subject =
    actorKind === "system" ? "Sistem" : actorKind === "automation" ? "Otomasyon" : actorName;

  switch (actionType) {
    case "task_created":
      return `${subject} yeni bir görev ekledi`;
    case "task_deleted":
      return `${subject} bir görevi sildi`;
    case "status_changed":
      return `${subject} bir görevin durumunu değiştirdi`;
    case "assignment_changed":
      return `${subject} bir görevin atamasını değiştirdi`;
    case "project_updated":
      return `${subject} proje ayarlarını güncelledi`;
    case "system_update":
      return `${subject} bir güncelleme yaptı`;
    case "email_sent":
      return `${subject} e-posta gönderdi`;
    default:
      return `${subject} bir görevi güncelledi`;
  }
}

export function auditEntryToProjectActivity(
  entry: AuditLogEntry,
  options: TransformProjectActivityOptions
): ProjectActivityItem {
  const actorKind = resolveActorKind(entry);
  const actorEmail = entry.actorEmail ?? "";
  const profile = options.profileByEmail?.(entry.actorEmail) ?? {};
  const actorName =
    profile.nickname?.trim() ||
    profile.fullName?.trim() ||
    actorEmail ||
    (actorKind === "system" ? "Sistem" : actorKind === "automation" ? "Otomasyon" : "Kullanıcı");

  const changes = extractChanges(entry);
  const actionType = determineActionType(entry, changes);
  const { taskLabel, taskSubtitle } = resolveTaskDisplay(entry, options);

  return {
    id: entry.id,
    actorName,
    actorEmail,
    actorAvatar: profile.avatarUrl ?? undefined,
    actorKind,
    actionType,
    taskLabel,
    taskSubtitle,
    recordId: entry.recordId,
    tableName: entry.tableName,
    summary: buildSummary(actorName, actionType, actorKind),
    timestamp: entry.at.toISOString(),
    changes,
  };
}

export function transformAuditEntriesToActivities(
  entries: AuditLogEntry[],
  options: TransformProjectActivityOptions
): ProjectActivityItem[] {
  return entries.map((entry) => auditEntryToProjectActivity(entry, options));
}

export function getActivityTimeGroup(date: Date, now: Date = new Date()): ProjectActivityTimeGroup {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  return "earlier";
}

export function buildProjectActivityTaskHref(projectId: string, taskId: string): string {
  const pid = projectId.trim();
  const tid = taskId.trim();
  return `/projeler/${encodeURIComponent(pid)}?tab=activity&task=${encodeURIComponent(tid)}`;
}

export function filterProjectActivities(
  items: ProjectActivityItem[],
  options: {
    searchQuery: string;
    filterKind: ProjectActivityFilterKind;
    dateFilter: ProjectActivityDateFilterKind;
    taskId?: string | null;
    now?: Date;
  }
): ProjectActivityItem[] {
  const now = options.now ?? new Date();
  const q = options.searchQuery.trim().toLowerCase();
  const taskId = options.taskId?.trim() || null;

  let minDate: Date | null = null;
  if (options.dateFilter === "7d") {
    minDate = new Date(now);
    minDate.setDate(minDate.getDate() - 7);
  } else if (options.dateFilter === "30d") {
    minDate = new Date(now);
    minDate.setDate(minDate.getDate() - 30);
  }

  return items.filter((item) => {
    if (taskId && item.recordId !== taskId) return false;
    if (minDate && new Date(item.timestamp) < minDate) return false;
    if (options.filterKind !== "all" && item.actionType !== options.filterKind) return false;

    if (!q) return true;
    const haystack = [
      item.actorName,
      item.actorEmail,
      item.taskLabel,
      item.taskSubtitle,
      item.summary,
      ...item.changes.flatMap((c) => [c.field, c.oldValue, c.newValue]),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function groupActivitiesByTime(
  items: ProjectActivityItem[],
  now: Date = new Date()
): Array<{ group: ProjectActivityTimeGroup; items: ProjectActivityItem[] }> {
  const order: ProjectActivityTimeGroup[] = ["today", "yesterday", "earlier"];
  const buckets: Record<ProjectActivityTimeGroup, ProjectActivityItem[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const item of items) {
    buckets[getActivityTimeGroup(new Date(item.timestamp), now)].push(item);
  }

  return order
    .map((group) => ({ group, items: buckets[group] }))
    .filter((section) => section.items.length > 0);
}

export function getActivityRecordHref(projectId: string, item: ProjectActivityItem): string {
  if (item.tableName === "tasks") {
    return `/canli-tablo?project=${encodeURIComponent(projectId)}&task=${encodeURIComponent(item.recordId)}`;
  }
  return `/projeler/${encodeURIComponent(projectId)}`;
}
