"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useAuth } from "@/contexts/auth-context";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  /** Yönetici: bildirim paneli açıldığında çağrılır */
  onPanelOpened?: () => void;
};

type AdminAlertRow = {
  id: string;
  summary: string;
  created_at: string;
};

export function useNotificationSummary(): NotificationSummary {
  const { user, isAdmin } = useAuth();
  const currentUserEmail = user?.email ?? null;
  const userId = user?.id ?? null;
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasksWithRealtime();

  const [adminUnread, setAdminUnread] = useState<AdminAlertRow[]>([]);
  const [adminAlertsLoading, setAdminAlertsLoading] = useState(false);
  const adminUnreadRef = useRef<AdminAlertRow[]>([]);
  adminUnreadRef.current = adminUnread;

  const fetchAdminUnread = useCallback(async () => {
    if (!isSupabaseConfigured() || !isAdmin || !userId || userId === "demo") {
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
  }, [isAdmin, userId]);

  useEffect(() => {
    void fetchAdminUnread();
  }, [fetchAdminUnread]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !isAdmin || !userId || userId === "demo") return;
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
  }, [isAdmin, userId, fetchAdminUnread]);

  const onPanelOpened = useCallback(async () => {
    const snapshot = adminUnreadRef.current;
    if (!userId || userId === "demo" || snapshot.length === 0) return;
    const rows = snapshot.map((a) => ({ alert_id: a.id, reader_id: userId }));
    const { error } = await supabase.from("admin_alert_reads").upsert(rows, {
      onConflict: "alert_id,reader_id",
    });
    if (error) {
      console.warn("[Notifications] mark read:", error);
      return;
    }
    setAdminUnread([]);
  }, [userId]);

  const summary = useMemo(() => {
    const email = (currentUserEmail ?? "").trim().toLowerCase();
    const items: NotificationSummaryItem[] = [];

    if (isAdmin && adminUnread.length > 0) {
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
      const overdueTasks = myTasks.filter((t) => t.due_date && String(t.due_date).trim() && String(t.due_date) < today);

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
    }

    const totalCount = items.reduce((s, i) => s + i.count, 0);
    return { totalCount, items };
  }, [currentUserEmail, projects, tasks, isAdmin, adminUnread]);

  return {
    ...summary,
    isLoading: projectsLoading || tasksLoading || (isAdmin && adminAlertsLoading),
    onPanelOpened: isAdmin ? () => void onPanelOpened() : undefined,
  };
}
