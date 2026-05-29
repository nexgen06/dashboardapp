"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useAuth } from "@/contexts/auth-context";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import { useToast } from "@/components/ui/toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  ADMIN_ALERTS_FALLBACK_POLL_MS,
  isRealtimeDisabledForClient,
  NOTIFICATIONS_FALLBACK_POLL_MS,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
import {
  listMyNotifications,
  markAllMyNotificationsRead,
  markNotificationSourceRead,
  markNotificationTypesRead,
  upsertMyNotifications,
  type CentralNotification,
  type NotificationType,
} from "@/lib/notifications";
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
  markAnnouncementRead as markAnnouncementReadFn,
  type Announcement,
} from "@/lib/announcements";
import {
  collectAssignmentToasts,
  fetchNotificationPhase2Status,
  isNotificationPhase2Active,
  shouldToastCentralNotification,
  notificationToastDedupKey,
  type AssignmentToastInput,
} from "@/lib/notificationPhase2";

export type NotificationSummaryItem = {
  type: NotificationType;
  id?: string;
  notificationId?: string;
  sourceKey?: string;
  sourceId?: string;
  label: string;
  body?: string | null;
  href: string;
  count: number;
  createdAt?: string;
  readAt?: string | null;
  /** Ham notification payload (workflow için action, project_id vs.) */
  payload?: Record<string, unknown> | null;
};

export type NotificationSummary = {
  totalCount: number;
  items: NotificationSummaryItem[];
  isLoading: boolean;
  /** Bildirim paneli açıldığında: yönetici uyarıları + türetilmiş (proje/görev) okundu işaretleri */
  onPanelOpened?: () => void | Promise<void>;
  /** "Hepsini okundu işaretle" — tüm proje sohbet bildirimleri dahil hepsini temizle */
  onMarkAllRead?: () => void | Promise<void>;
  /** Tüm aktif duyurular — sayfada body göstermek için */
  announcements?: Announcement[];
  /** Okunmuş duyuru id'leri */
  readAnnouncementIds?: Set<string>;
  /** Tek bir duyuruyu okundu işaretle (sayfa içi tıklama) */
  markAnnouncementRead?: (id: string) => void | Promise<void>;
  /** Tek bir bildirimi okundu işaretle (source_key bazında — çan içi tek tek okuma) */
  markSingleRead?: (sourceKey: string) => void | Promise<void>;
};

type AdminAlertRow = {
  id: string;
  summary: string;
  created_at: string;
};

export function useNotificationSummary(): NotificationSummary {
  const { user, isAdmin, hasPermission } = useAuth();
  const toast = useToast();
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

  const [centralNotifications, setCentralNotifications] = useState<CentralNotification[]>([]);
  const [centralNotificationsAvailable, setCentralNotificationsAvailable] = useState(false);
  const [centralNotificationsLoading, setCentralNotificationsLoading] = useState(false);
  const centralNotificationsRef = useRef<CentralNotification[]>([]);
  centralNotificationsRef.current = centralNotifications;

  /** Sunucu tetikleyicileri aktifse istemci türetilmiş atama/gecikme upsert'i atlanır. */
  const [serverTriggersActive, setServerTriggersActive] = useState(false);
  const serverTriggersCheckedRef = useRef(false);
  const notificationToastBaselineRef = useRef(false);
  const toastedNotificationKeysRef = useRef<Set<string>>(new Set());

  // Duyurular (announcements) — herkes okur
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(new Set());
  const announcementsRef = useRef<Announcement[]>([]);
  announcementsRef.current = announcements;

  /**
   * Bu hook'un her instance'ı için sabit unique kanal id'si. Header + MobileBottomNav
   * gibi iki yerde çağrılırsa channel name çakışmaz; cleanup sırasında race olmaz.
   */
  const channelIdRef = useRef<string | null>(null);
  if (channelIdRef.current === null) {
    channelIdRef.current = `${Math.random().toString(36).slice(2, 10)}`;
  }

  const toastAssignmentNotification = useCallback(
    (row: AssignmentToastInput | Record<string, unknown>) => {
      if (!shouldToastCentralNotification(row)) return;
      const title = String(row.title ?? "Yeni bildirim");
      const body = row.body != null ? String(row.body) : undefined;
      const type = String(row.type ?? "");
      const prefix =
        type === "project_assigned"
          ? "📁 "
          : type === "task_assigned"
            ? "✅ "
            : type === "overdue"
              ? "⏰ "
              : "";
      toast.info(`${prefix}${title}`, {
        description: body,
        durationMs: 6500,
      });
    },
    [toast]
  );

  const processAssignmentToasts = useCallback(
    (rows: CentralNotification[]) => {
      const result = collectAssignmentToasts(rows, {
        baselineReady: notificationToastBaselineRef.current,
        seenKeys: toastedNotificationKeysRef.current,
      });
      notificationToastBaselineRef.current = result.baselineReady;
      for (const row of result.toToast) {
        toastAssignmentNotification(row);
      }
    },
    [toastAssignmentNotification]
  );

  const fetchCentralNotifications = useCallback(async () => {
    if (!isSupabaseConfigured() || !userId || userId === "demo") {
      setCentralNotifications([]);
      setCentralNotificationsAvailable(false);
      return;
    }
    setCentralNotificationsLoading(true);
    try {
      const result = await listMyNotifications(120);
      if (!result.ok) {
        setCentralNotificationsAvailable(false);
        return;
      }
      setCentralNotificationsAvailable(true);
      processAssignmentToasts(result.data);
      setCentralNotifications(result.data);
    } finally {
      setCentralNotificationsLoading(false);
    }
  }, [userId, processAssignmentToasts]);

  useEffect(() => {
    if (!userId || userId === "demo") {
      setServerTriggersActive(false);
      serverTriggersCheckedRef.current = false;
      notificationToastBaselineRef.current = false;
      toastedNotificationKeysRef.current = new Set();
      return;
    }
    notificationToastBaselineRef.current = false;
    toastedNotificationKeysRef.current = new Set();
    let cancelled = false;
    void fetchNotificationPhase2Status().then((status) => {
      if (cancelled) return;
      serverTriggersCheckedRef.current = true;
      setServerTriggersActive(isNotificationPhase2Active(status));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    void fetchCentralNotifications();
  }, [fetchCentralNotifications]);

  useEffect(() => {
    if (!userId) return;
    const onFocus = () => void fetchCentralNotifications();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void fetchCentralNotifications();
    }, NOTIFICATIONS_FALLBACK_POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [userId, fetchCentralNotifications]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !userId || userId === "demo") return;
    if (isRealtimeDisabledForClient()) return;
    const ch: RealtimeChannel = supabase
      .channel(`notifications-${userId}-${channelIdRef.current}`, { config: { private: true } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const row = payload.new as Record<string, unknown>;
            if (shouldToastCentralNotification(row) && notificationToastBaselineRef.current) {
              const key = notificationToastDedupKey({
                source_key: row.source_key as string | null,
                id: row.id as string | null,
                updated_at: row.updated_at as string | null,
              });
              if (!toastedNotificationKeysRef.current.has(key)) {
                toastedNotificationKeysRef.current.add(key);
                toastAssignmentNotification(row);
              }
            }
          }
          void fetchCentralNotifications();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, fetchCentralNotifications, toastAssignmentNotification]);

  const fetchAnnouncements = useCallback(async () => {
    if (!isSupabaseConfigured() || !userId || userId === "demo") {
      setAnnouncements([]);
      setReadAnnouncementIds(new Set());
      return;
    }
    // İki sorguyu bağımsız çek — biri başarısız olsa diğeri çalışsın.
    // Önceki başarılı state'i ASLA boşa çekme; sadece güncel olanları üstüne yaz.
    const [listResult, readsResult] = await Promise.allSettled([
      listAnnouncements(),
      getMyReadAnnouncementIds(),
    ]);
    if (listResult.status === "fulfilled") {
      setAnnouncements(listResult.value);
    } else if (typeof console !== "undefined") {
      console.warn("[Notifications] listAnnouncements failed:", listResult.reason);
    }
    if (readsResult.status === "fulfilled") {
      setReadAnnouncementIds(readsResult.value);
    } else if (typeof console !== "undefined") {
      console.warn("[Notifications] getMyReadAnnouncementIds failed:", readsResult.reason);
    }
  }, [userId]);

  useEffect(() => {
    void fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Sekme tekrar odaklandığında veya 60 saniyede bir tekrar çek — realtime
  // başarısız olursa kullanıcı yine de güncel listeyi görür.
  useEffect(() => {
    if (!userId) return;
    const onFocus = () => void fetchAnnouncements();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (!document.hidden) void fetchAnnouncements();
    }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [userId, fetchAnnouncements]);

  // Realtime: yeni duyuru gelirse anında listeye düşer + okuma durumu da senkron
  useEffect(() => {
    if (!isSupabaseConfigured() || !userId || userId === "demo") return;
    if (isRealtimeDisabledForClient()) return;
    const ch: RealtimeChannel = supabase
      .channel(`announcements-${userId}-${channelIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        (payload) => {
          if (typeof console !== "undefined") {
            console.log("[notif] announcement event:", payload.eventType);
          }
          // Yeni duyuru gelir gelmez kullanıcıya görsel uyarı (toast)
          if (payload.eventType === "INSERT") {
            const newRow = payload.new as { title?: string; author_email?: string };
            const title = (newRow?.title ?? "").toString();
            toast.info(
              title ? `📢 Yeni duyuru: ${title}` : "📢 Yeni duyuru",
              {
                description: newRow?.author_email
                  ? `${newRow.author_email} bir duyuru yayımladı`
                  : "Detaylar için bildirim merkezine bakın",
                durationMs: 6000,
              }
            );
          }
          void fetchAnnouncements();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcement_reads", filter: `reader_id=eq.${userId}` },
        () => {
          // Başka cihazda/tab'de okuduysa aynı oturumda yansısın
          void fetchAnnouncements();
        }
      )
      .subscribe((status) => {
        if (typeof console !== "undefined") {
          console.log("[notif] announcements channel:", status);
        }
      });
    return () => {
      void supabase.removeChannel(ch);
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

  // Admin uyarıları WebSocket kapalı ağlarda da kaçmasın diye HTTPS yedeği.
  useEffect(() => {
    if (!isSupabaseConfigured() || !canAdminNotifications || !userId || userId === "demo") return;
    const onFocus = () => void fetchAdminUnread();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void fetchAdminUnread();
    }, ADMIN_ALERTS_FALLBACK_POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [canAdminNotifications, userId, fetchAdminUnread]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !canAdminNotifications || !userId || userId === "demo") return;
    if (isRealtimeDisabledForClient()) return;
    const ch: RealtimeChannel = supabase
      .channel(`admin-alerts-${userId}-${channelIdRef.current}`, { config: { private: true } })
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

  useEffect(() => {
    if (!centralNotificationsAvailable || !userId || userId === "demo") return;
    if (!serverTriggersCheckedRef.current) return;
    const email = (currentUserEmail ?? "").trim().toLowerCase();
    const items: Parameters<typeof upsertMyNotifications>[0] = [];

    for (const a of announcements) {
      if (readAnnouncementIds.has(a.id)) continue;
      items.push({
        type: "announcement",
        title: a.title,
        body: a.body,
        href: "/bildirimler",
        sourceTable: "announcements",
        sourceId: a.id,
        sourceKey: `announcement:${a.id}`,
        payload: {
          author_email: a.author_email,
          pinned: a.pinned,
          expires_at: a.expires_at,
        },
      });
    }

    if (canAdminNotifications) {
      for (const a of adminUnread) {
        items.push({
          type: "admin_team_done",
          title: a.summary,
          href: "/canli-tablo",
          sourceTable: "admin_alerts",
          sourceId: a.id,
          sourceKey: `admin_alert:${a.id}`,
        });
      }
    }

    // Faz 2 sunucu tetikleyicileri yoksa yedek: istemci türetilmiş atama/gecikme kayıtları.
    if (!serverTriggersActive && email) {
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
        const href = t.project_id
          ? `/canli-tablo?project=${t.project_id}&task=${t.id}`
          : `/canli-tablo?task=${t.id}`;
        items.push({
          type: "task_assigned",
          title: "Size yeni bir görev atandı",
          body: t.content || null,
          href,
          sourceTable: "tasks",
          sourceId: t.id,
          sourceKey: `task_assigned:${t.id}`,
          payload: { project_id: t.project_id ?? null },
        });
      }

      for (const t of overdueTasks.filter((t) => !seenOverdue.has(t.id))) {
        const href = t.project_id
          ? `/canli-tablo?project=${t.project_id}&task=${t.id}`
          : `/canli-tablo?task=${t.id}`;
        items.push({
          type: "overdue",
          title: "Gecikmiş göreviniz var",
          body: t.content || null,
          href,
          sourceTable: "tasks",
          sourceId: t.id,
          sourceKey: `overdue:${t.id}`,
          payload: { due_date: t.due_date ?? null, project_id: t.project_id ?? null },
        });
      }
    }

    for (const p of projects) {
      const n = unreadByProjectId[p.id] ?? 0;
      if (n > 0) {
        items.push({
          type: "chat_unread",
          title: n === 1 ? `${p.name}: 1 yeni mesaj` : `${p.name}: ${n} yeni mesaj`,
          href: `/projeler/${p.id}`,
          count: n,
          sourceTable: "project_chat_messages",
          sourceId: p.id,
          sourceKey: `project_chat:${p.id}`,
          resetRead: true,
        });
      }
    }

    if (items.length === 0) return;
    void upsertMyNotifications(items).then((ok) => {
      if (ok) void fetchCentralNotifications();
    });
  }, [
    centralNotificationsAvailable,
    userId,
    currentUserEmail,
    announcements,
    readAnnouncementIds,
    canAdminNotifications,
    adminUnread,
    projects,
    tasks,
    derivedAck,
    unreadByProjectId,
    fetchCentralNotifications,
    serverTriggersActive,
  ]);

  const onPanelOpened = useCallback(async () => {
    if (centralNotificationsAvailable) {
      await markNotificationTypesRead(["project_assigned", "task_assigned", "overdue", "admin_team_done"]);
      void fetchCentralNotifications();
    }

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
    // NOT: Duyuruları (announcements) burada OKUNDU işaretlemiyoruz — kullanıcı
    // sadece dropdown'ı açtı diye duyurular silinmemeli. /bildirimler sayfasında
    // bireysel tıklama veya "Hepsini okundu işaretle" butonuyla manuel olarak işaretlenir.
  }, [centralNotificationsAvailable, fetchCentralNotifications, userId, canAdminNotifications, currentUserEmail, projects, tasks]);

  const summary = useMemo(() => {
    if (centralNotificationsAvailable) {
      const items: NotificationSummaryItem[] = centralNotifications.map((n) => ({
        type: n.type,
        id: n.source_id ?? n.id,
        notificationId: n.id,
        sourceId: n.source_id ?? undefined,
        sourceKey: n.source_key,
        label: n.title,
        body: n.body,
        href: n.href || "/bildirimler",
        count: n.read_at ? 0 : Math.max(1, Number(n.count ?? 1)),
        createdAt: n.created_at,
        payload: n.payload ?? null,
        readAt: n.read_at,
      }));
      const totalCount = items.reduce((s, i) => s + i.count, 0);
      return { totalCount, items };
    }

    const email = (currentUserEmail ?? "").trim().toLowerCase();
    const items: NotificationSummaryItem[] = [];

    // TÜM duyurular items'a eklenir; okunmuş olanların count'u 0 — bu sayede
    // bell totalCount'ta sayılmaz ama /bildirimler sayfasında görünmeye devam
    // eder (kullanıcı geçmiş duyuruları okuyabilir).
    const sortedAnnouncements = [...announcements].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    for (const a of sortedAnnouncements) {
      const isRead = readAnnouncementIds.has(a.id);
      items.push({
        type: "announcement",
        id: a.id,
        label: a.title,
        href: "/bildirimler",
        count: isRead ? 0 : 1,
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

    if (email && !serverTriggersActive) {
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
  }, [
    centralNotificationsAvailable,
    centralNotifications,
    currentUserEmail,
    projects,
    tasks,
    canAdminNotifications,
    adminUnread,
    derivedAck,
    unreadByProjectId,
    announcements,
    readAnnouncementIds,
    serverTriggersActive,
  ]);

  /**
   * "Hepsini okundu işaretle": türetilmiş ack + admin alert read + proje sohbet read'leri.
   * Bell popover'daki butona bağlanır; auto-ACK ile aynı sonucu verir, kullanıcıya kontrol verir.
   */
  const onMarkAllRead = useCallback(async () => {
    if (centralNotificationsAvailable) {
      await markAllMyNotificationsRead();
      void fetchCentralNotifications();
    }

    await onPanelOpened();

    // Tüm duyuruları okundu işaretle (manuel buton)
    const unreadAnnouncements = announcementsRef.current.filter(
      (a) => !readAnnouncementIds.has(a.id)
    );
    if (unreadAnnouncements.length > 0) {
      await markAllAnnouncementsRead(unreadAnnouncements);
      setReadAnnouncementIds((prev) => {
        const nextSet = new Set(prev);
        for (const a of unreadAnnouncements) nextSet.add(a.id);
        return nextSet;
      });
    }

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
  }, [
    centralNotificationsAvailable,
    fetchCentralNotifications,
    onPanelOpened,
    currentUserEmail,
    unreadByProjectId,
    refreshChatUnread,
    readAnnouncementIds,
  ]);

  const markSingleRead = useCallback(
    async (sourceKey: string) => {
      if (!sourceKey || !centralNotificationsAvailable) return;
      await markNotificationSourceRead(sourceKey);
      void fetchCentralNotifications();
    },
    [centralNotificationsAvailable, fetchCentralNotifications]
  );

  const markAnnouncementRead = useCallback(
    async (id: string) => {
      if (centralNotificationsAvailable) {
        await markNotificationSourceRead(`announcement:${id}`);
        void fetchCentralNotifications();
      }
      await markAnnouncementReadFn(id);
      setReadAnnouncementIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.add(id);
        return nextSet;
      });
    },
    [centralNotificationsAvailable, fetchCentralNotifications]
  );

  return {
    ...summary,
    isLoading:
      projectsLoading ||
      tasksLoading ||
      centralNotificationsLoading ||
      (canAdminNotifications && adminAlertsLoading),
    onPanelOpened: userId ? () => void onPanelOpened() : undefined,
    onMarkAllRead: userId ? () => void onMarkAllRead() : undefined,
    announcements,
    readAnnouncementIds,
    markAnnouncementRead: userId ? markAnnouncementRead : undefined,
    markSingleRead: userId && centralNotificationsAvailable ? markSingleRead : undefined,
  };
}
