"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useAuth } from "@/contexts/auth-context";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  loadDerivedNotificationAck,
  saveDerivedNotificationAck,
  type DerivedNotificationAck,
} from "@/lib/notificationAck";

export type NotificationSummaryItem = {
  type: "project_assigned" | "task_assigned" | "overdue" | "admin_team_done";
  id?: string;
  label: string;
  href: string;
  count: number;
};

export type NotificationSummary = {
  totalCount: number;
  items: NotificationSummaryItem[];
  isLoading: boolean;
  /** Bildirim paneli açıldığında: yönetici uyarıları + türetilmiş (proje/görev) okundu işaretleri */
  onPanelOpened?: () => void | Promise<void>;
};

type AdminAlertRow = {
  id: string;
  summary: string;
  created_at: string;
};

export function useNotificationSummary(): NotificationSummary {
  const { user, isAdmin, hasPermission } = useAuth();
  const canAdminNotifications = isAdmin && hasPermission("notifications.send");
  const currentUserEmail = user?.email ?? null;
  const userId = user?.id ?? null;
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasksWithRealtime();

  const [adminUnread, setAdminUnread] = useState<AdminAlertRow[]>([]);
  const [adminAlertsLoading, setAdminAlertsLoading] = useState(false);
  const adminUnreadRef = useRef<AdminAlertRow[]>([]);
  adminUnreadRef.current = adminUnread;

  const [derivedAck, setDerivedAck] = useState<DerivedNotificationAck>({
    projectIds: [],
    taskIds: [],
    overdueTaskIds: [],
  });

  useEffect(() => {
    if (!userId) {
      setDerivedAck({ projectIds: [], taskIds: [], overdueTaskIds: [] });
      return;
    }
    setDerivedAck(loadDerivedNotificationAck(userId));
  }, [userId]);

  const fetchAdminUnread = useCallback(async () => {
    if (!isSupabaseConfigured() || !canAdminNotifications || !userId || userId === "demo") {
      setAdminUnread([]);
      return;
    }
    setAdminAlertsLoading(true);
    try {
      const [alertsRes, readsRes] = await Promise.all([
        supabase.from("admin_alerts").select("id, summary, created_at").order("created_at", { ascending: false }).limit(40),
        supabase.from("admin_alert_reads").select("alert_id").eq("reader_id", userId),
      ]);
      if (alertsRes.error) throw alertsRes.error;
      if (readsRes.error) throw readsRes.error;
      const readSet = new Set((readsRes.data ?? []).map((r) => String((r as { alert_id: string }).alert_id)));
      const rows = (alertsRes.data ?? []) as AdminAlertRow[];
      setAdminUnread(rows.filter((a) => !readSet.has(a.id)));
    } catch (e) {
      console.warn("[Notifications] admin_alerts:", e);
      setAdminUnread([]);
    } finally {
      setAdminAlertsLoading(false);
    }
  }, [canAdminNotifications, userId]);

  useEffect(() => {
    void fetchAdminUnread();
  }, [fetchAdminUnread]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !canAdminNotifications || !userId || userId === "demo") return;
    const ch: RealtimeChannel = supabase
      .channel("admin-alerts-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_alerts" },
        () => {
          void fetchAdminUnread();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [canAdminNotifications, userId, fetchAdminUnread]);

  const onPanelOpened = useCallback(async () => {
    const snapshot = adminUnreadRef.current;
    if (userId && userId !== "demo" && canAdminNotifications && snapshot.length > 0) {
      const rows = snapshot.map((a) => ({ alert_id: a.id, reader_id: userId }));
      const { error } = await supabase.from("admin_alert_reads").upsert(rows, {
        onConflict: "alert_id,reader_id",
      });
      if (error) console.warn("[Notifications] mark admin read:", error);
      else setAdminUnread([]);
    }

    if (!userId) return;
    const email = (currentUserEmail ?? "").trim().toLowerCase();
    if (!email) return;

    const assignedProjects = projects.filter((p) =>
      (p.assigned_emails ?? []).some((e) => e.trim().toLowerCase() === email)
    );
    const myTasks = tasks.filter((t) => (t.assignee ?? "").trim().toLowerCase() === email);
    const today = new Date().toISOString().split("T")[0];
    const overdueTasks = myTasks.filter(
      (t) => t.due_date && String(t.due_date).trim() && String(t.due_date) < today
    );

    const next: DerivedNotificationAck = {
      projectIds: assignedProjects.map((p) => p.id),
      taskIds: myTasks.map((t) => t.id),
      overdueTaskIds: overdueTasks.map((t) => t.id),
    };
    saveDerivedNotificationAck(userId, next);
    setDerivedAck(next);
  }, [userId, canAdminNotifications, currentUserEmail, projects, tasks]);

  const summary = useMemo(() => {
    const email = (currentUserEmail ?? "").trim().toLowerCase();
    const items: NotificationSummaryItem[] = [];

    if (canAdminNotifications && adminUnread.length > 0) {
      for (const a of adminUnread) {
        items.push({
          type: "admin_team_done",
          id: a.id,
          label: a.summary,
          href: "/canli-tablo",
          count: 1,
        });
      }
    }

    if (email) {
      const assignedProjects = projects.filter((p) =>
        (p.assigned_emails ?? []).some((e) => e.trim().toLowerCase() === email)
      );
      const myTasks = tasks.filter((t) => (t.assignee ?? "").trim().toLowerCase() === email);
      const today = new Date().toISOString().split("T")[0];
      const overdueTasks = myTasks.filter(
        (t) => t.due_date && String(t.due_date).trim() && String(t.due_date) < today
      );

      const seenProjects = new Set(derivedAck.projectIds);
      const seenTasks = new Set(derivedAck.taskIds);
      const seenOverdue = new Set(derivedAck.overdueTaskIds);

      const newProjects = assignedProjects.filter((p) => !seenProjects.has(p.id));
      const newTasks = myTasks.filter((t) => !seenTasks.has(t.id));
      const newOverdue = overdueTasks.filter((t) => !seenOverdue.has(t.id));

      if (newProjects.length > 0) {
        items.push({
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
        items.push({
          type: "task_assigned",
          label:
            newTasks.length === 1 ? "Size yeni bir görev atandı" : `Size ${newTasks.length} yeni görev atandı`,
          href: "/canli-tablo",
          count: newTasks.length,
        });
      }
      if (newOverdue.length > 0) {
        items.push({
          type: "overdue",
          label:
            newOverdue.length === 1
              ? "1 yeni gecikmiş görev"
              : `${newOverdue.length} yeni gecikmiş görev`,
          href: "/canli-tablo",
          count: newOverdue.length,
        });
      }
    }

    const totalCount = items.reduce((s, i) => s + i.count, 0);
    return { totalCount, items };
  }, [currentUserEmail, projects, tasks, canAdminNotifications, adminUnread, derivedAck]);

  return {
    ...summary,
    isLoading: projectsLoading || tasksLoading || (canAdminNotifications && adminAlertsLoading),
    onPanelOpened: userId ? () => void onPanelOpened() : undefined,
  };
}
