"use client";

import { useMemo } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";

export type NotificationSummaryItem = {
  type: "project_assigned" | "task_assigned" | "overdue";
  label: string;
  href: string;
  count: number;
};

export type NotificationSummary = {
  totalCount: number;
  items: NotificationSummaryItem[];
  isLoading: boolean;
};

/**
 * Giriş yapan kullanıcı için "dikkat gerektiren" özet: proje atamaları, size atanan görevler, gecikmiş görevler.
 * Header rozeti ve açılır panel için kullanılır. Veri mevcut projects + tasks'tan türetilir (Faz 1).
 */
export function useNotificationSummary(currentUserEmail: string | null | undefined): NotificationSummary {
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasksWithRealtime();

  const summary = useMemo(() => {
    const email = (currentUserEmail ?? "").trim().toLowerCase();
    if (!email) return { totalCount: 0, items: [] as NotificationSummaryItem[] };

    const assignedProjects = projects.filter((p) =>
      (p.assigned_emails ?? []).some((e) => e.trim().toLowerCase() === email)
    );
    const myTasks = tasks.filter((t) => (t.assignee ?? "").trim().toLowerCase() === email);
    const today = new Date().toISOString().split("T")[0];
    const overdueTasks = myTasks.filter((t) => t.due_date && String(t.due_date).trim() && String(t.due_date) < today);

    const items: NotificationSummaryItem[] = [];
    if (assignedProjects.length > 0) {
      items.push({
        type: "project_assigned",
        label: `Size ${assignedProjects.length} proje atandı`,
        href: "/projeler",
        count: assignedProjects.length,
      });
    }
    if (myTasks.length > 0) {
      items.push({
        type: "task_assigned",
        label: `Size ${myTasks.length} görev atandı`,
        href: "/canli-tablo",
        count: myTasks.length,
      });
    }
    if (overdueTasks.length > 0) {
      items.push({
        type: "overdue",
        label: `${overdueTasks.length} gecikmiş görev`,
        href: "/canli-tablo",
        count: overdueTasks.length,
      });
    }

    const totalCount = items.reduce((s, i) => s + i.count, 0);
    return { totalCount, items };
  }, [currentUserEmail, projects, tasks]);

  return {
    ...summary,
    isLoading: projectsLoading || tasksLoading,
  };
}
