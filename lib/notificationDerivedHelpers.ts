import type { DerivedNotificationAck } from "@/lib/notificationAck";
import type { NotificationUpsertInput } from "@/lib/notifications";
import type { Project } from "@/types/project";

/** Bildirim türetimi için yalnızca gerekli görev alanları. */
export type NotificationTaskHint = {
  id: string;
  content: string;
  assignee: string | null;
  due_date: string | null;
  project_id: string | null;
};

export type DerivedNotificationBadge = {
  type: "project_assigned" | "task_assigned" | "overdue";
  label: string;
  href: string;
  count: number;
};

export function normalizeNotificationEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function filterProjectsAssignedToEmail(projects: Project[], email: string): Project[] {
  const normalized = normalizeNotificationEmail(email);
  if (!normalized) return [];
  return projects.filter((p) =>
    (p.assigned_emails ?? []).some((e) => normalizeNotificationEmail(e) === normalized)
  );
}

export function filterTasksAssignedToEmail(
  tasks: NotificationTaskHint[],
  email: string
): NotificationTaskHint[] {
  const normalized = normalizeNotificationEmail(email);
  if (!normalized) return [];
  return tasks.filter((t) => normalizeNotificationEmail(t.assignee) === normalized);
}

export function filterOverdueTasks(
  tasks: NotificationTaskHint[],
  today?: string
): NotificationTaskHint[] {
  const day = today ?? new Date().toISOString().split("T")[0];
  return tasks.filter(
    (t) => t.due_date && String(t.due_date).trim() && String(t.due_date) < day
  );
}

export function taskNotificationHref(task: NotificationTaskHint): string {
  return task.project_id
    ? `/canli-tablo?project=${task.project_id}&task=${task.id}`
    : `/canli-tablo?task=${task.id}`;
}

export function buildDerivedNotificationAck(
  projects: Project[],
  tasks: NotificationTaskHint[],
  email: string
): DerivedNotificationAck {
  const assignedProjects = filterProjectsAssignedToEmail(projects, email);
  const myTasks = filterTasksAssignedToEmail(tasks, email);
  const overdueTasks = filterOverdueTasks(myTasks);
  return {
    projectIds: assignedProjects.map((p) => p.id),
    taskIds: myTasks.map((t) => t.id),
    overdueTaskIds: overdueTasks.map((t) => t.id),
  };
}

export function buildDerivedUpsertItems(
  projects: Project[],
  tasks: NotificationTaskHint[],
  email: string,
  derivedAck: DerivedNotificationAck
): NotificationUpsertInput[] {
  const items: NotificationUpsertInput[] = [];
  const assignedProjects = filterProjectsAssignedToEmail(projects, email);
  const myTasks = filterTasksAssignedToEmail(tasks, email);
  const overdueTasks = filterOverdueTasks(myTasks);
  const seenProjects = new Set(derivedAck.projectIds);
  const seenTasks = new Set(derivedAck.taskIds);
  const seenOverdue = new Set(derivedAck.overdueTaskIds);

  for (const p of assignedProjects.filter((p) => !seenProjects.has(p.id))) {
    items.push({
      type: "project_assigned",
      title: `Size "${p.name}" projesi atandı`,
      href: `/projeler/${p.id}`,
      sourceTable: "projects",
      sourceId: p.id,
      sourceKey: `project_assigned:${p.id}`,
    });
  }

  for (const t of myTasks.filter((t) => !seenTasks.has(t.id))) {
    items.push({
      type: "task_assigned",
      title: "Size yeni bir görev atandı",
      body: t.content || null,
      href: taskNotificationHref(t),
      sourceTable: "tasks",
      sourceId: t.id,
      sourceKey: `task_assigned:${t.id}`,
      payload: { project_id: t.project_id ?? null },
    });
  }

  for (const t of overdueTasks.filter((t) => !seenOverdue.has(t.id))) {
    items.push({
      type: "overdue",
      title: "Gecikmiş göreviniz var",
      body: t.content || null,
      href: taskNotificationHref(t),
      sourceTable: "tasks",
      sourceId: t.id,
      sourceKey: `overdue:${t.id}`,
      payload: { due_date: t.due_date ?? null, project_id: t.project_id ?? null },
    });
  }

  return items;
}

export function buildDerivedFallbackBadges(
  projects: Project[],
  tasks: NotificationTaskHint[],
  email: string,
  derivedAck: DerivedNotificationAck
): DerivedNotificationBadge[] {
  const assignedProjects = filterProjectsAssignedToEmail(projects, email);
  const myTasks = filterTasksAssignedToEmail(tasks, email);
  const overdueTasks = filterOverdueTasks(myTasks);
  const seenProjects = new Set(derivedAck.projectIds);
  const seenTasks = new Set(derivedAck.taskIds);
  const seenOverdue = new Set(derivedAck.overdueTaskIds);

  const newProjects = assignedProjects.filter((p) => !seenProjects.has(p.id));
  const newTasks = myTasks.filter((t) => !seenTasks.has(t.id));
  const newOverdue = overdueTasks.filter((t) => !seenOverdue.has(t.id));

  const badges: DerivedNotificationBadge[] = [];

  if (newProjects.length > 0) {
    badges.push({
      type: "project_assigned",
      label:
        newProjects.length === 1
          ? "Size yeni bir proje atandı"
          : `Size ${newProjects.length} yeni proje atandı`,
      href: "/projeler",
      count: newProjects.length,
    });
  }
  if (newTasks.length > 0) {
    badges.push({
      type: "task_assigned",
      label:
        newTasks.length === 1 ? "Size yeni bir görev atandı" : `Size ${newTasks.length} yeni görev atandı`,
      href: "/canli-tablo",
      count: newTasks.length,
    });
  }
  if (newOverdue.length > 0) {
    badges.push({
      type: "overdue",
      label:
        newOverdue.length === 1
          ? "1 yeni gecikmiş görev"
          : `${newOverdue.length} yeni gecikmiş görev`,
      href: "/canli-tablo",
      count: newOverdue.length,
    });
  }

  return badges;
}
