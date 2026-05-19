"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useAuth } from "@/contexts/auth-context";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { markProjectChatRead } from "@/lib/projectChatApi";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  loadDerivedNotificationAck,
  saveDerivedNotificationAck,
  type DerivedNotificationAck,
} from "@/lib/notificationAck";
import {
  listAnnouncements,
  getMyReadAnnouncementIds,
  markAllAnnouncementsRead,
  type Announcement,
} from "@/lib/announcements";

export type NotificationSummaryItem = {
  type:
    | "project_assigned"
    | "task_assigned"
    | "overdue"
    | "admin_team_done"
    | "chat_unread"
    | "announcement";
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
  /** "Hepsini okundu işaretle" — tüm proje sohbet bildirimleri dahil hepsini temizle */
  onMarkAllRead?: () => void | Promise<void>;
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
  const { unreadByProjectId, refresh: refreshChatUnread } = useProjectChatUnread();

  const [adminUnread, setAdminUnread] = useState<AdminAlertRow[]>([]);
  const [adminAlertsLoading, setAdminAlertsLoading] = useState(false);
  const adminUnreadRef = useRef<AdminAlertRow[]>([]);
  adminUnreadRef.current = adminUnread;

  // Duyurular (announcements) — herkes okur
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(new Set());
  const announcementsRef = useRef<Announcement[]>([]);
  announcementsRef.current = announcements;

  const fetchAnnouncements = useCallback(async () => {
    if (!isSupabaseConfigured() || !userId || userId === "demo") {
      setAnnouncements([]);
      setReadAnnouncementIds(new Set());
      return;
    }
    try {
      const [list, reads] = await Promise.all([
        listAnnouncements(),
        getMyReadAnnouncementIds(),
      ]);
      setAnnouncements(list);
      setReadAnnouncementIds(reads);
    } catch (e) {
      console.warn("[Notifications] announcements:", e);
      setAnnouncements([]);
      setReadAnnouncementIds(new Set());
    }
  }, [userId]);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Realtime: yeni duyuru gelirse anında listeye düşer
  useEffect(() => {
    if (!isSupabaseConfigured() || !userId || userId === "demo") return;
    const ch: RealtimeChannel = supabase
      .channel("announcements-notify")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => {
          void fetchAnnouncements();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, fetchAnnouncements]);

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
      .channel("admin-alerts-notify", { config: { private: true } })
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

    // Tüm okunmamış duyuruları okundu işaretle
    const unreadAnnouncements = announcementsRef.current.filter(
      (a) => !readAnnouncementIds.has(a.id)
    );
    if (unreadAnnouncements.length > 0) {
      await markAllAnnouncementsRead(unreadAnnouncements);
      setReadAnnouncementIds((prev) => {
        const next = new Set(prev);
        for (const a of unreadAnnouncements) next.add(a.id);
        return next;
      });
    }
  }, [userId, canAdminNotifications, currentUserEmail, projects, tasks, readAnnouncementIds]);

  const summary = useMemo(() => {
    const email = (currentUserEmail ?? "").trim().toLowerCase();
    const items: NotificationSummaryItem[] = [];

    // Okunmamış duyurular (herkes görür) — pinli olanlar önce
    const unreadAnnouncements = announcements
      .filter((a) => !readAnnouncementIds.has(a.id))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    for (const a of unreadAnnouncements) {
      items.push({
        type: "announcement",
        id: a.id,
        label: a.title,
        href: "/bildirimler",
        count: 1,
      });
    }

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

    // Proje sohbet okunmamış mesajları — her proje için ayrı item (proje sayfasına link)
    for (const p of projects) {
      const n = unreadByProjectId[p.id] ?? 0;
      if (n > 0) {
        items.push({
          type: "chat_unread",
          id: p.id,
          label:
            n === 1
              ? `${p.name}: 1 yeni mesaj`
              : `${p.name}: ${n} yeni mesaj`,
          href: `/projeler/${p.id}`,
          count: n,
        });
      }
    }

    const totalCount = items.reduce((s, i) => s + i.count, 0);
    return { totalCount, items };
  }, [currentUserEmail, projects, tasks, canAdminNotifications, adminUnread, derivedAck, unreadByProjectId, announcements, readAnnouncementIds]);

  /**
   * "Hepsini okundu işaretle": türetilmiş ack + admin alert read + proje sohbet read'leri.
   * Bell popover'daki butona bağlanır; auto-ACK ile aynı sonucu verir, kullanıcıya kontrol verir.
   */
  const onMarkAllRead = useCallback(async () => {
    await onPanelOpened();
    const email = (currentUserEmail ?? "").trim().toLowerCase();
    if (!email) return;
    const unreadProjectIds = Object.entries(unreadByProjectId)
      .filter(([, n]) => n > 0)
      .map(([id]) => id);
    if (unreadProjectIds.length === 0) return;
    await Promise.allSettled(
      unreadProjectIds.map((pid) => markProjectChatRead(pid, email))
    );
    refreshChatUnread();
  }, [onPanelOpened, currentUserEmail, unreadByProjectId, refreshChatUnread]);

  return {
    ...summary,
    isLoading: projectsLoading || tasksLoading || (canAdminNotifications && adminAlertsLoading),
    onPanelOpened: userId ? () => void onPanelOpened() : undefined,
    onMarkAllRead: userId ? () => void onMarkAllRead() : undefined,
  };
}
