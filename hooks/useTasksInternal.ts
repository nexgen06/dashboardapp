"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  REALTIME_SUBSCRIBE_TIMEOUT_MS,
  TASKS_FALLBACK_POLL_MS,
  isRealtimeDisabledForClient,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Task } from "@/types/tasks";

type PostgresChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

function mapRowToTask(row: Record<string, unknown>): Task {
  const updatedAt = row.updated_at != null ? String(row.updated_at) : null;
  const projectId = row.project_id != null ? String(row.project_id) : null;
  const dueDate = row.due_date != null ? String(row.due_date) : null;
  let extraData: Record<string, string> | null = null;
  if (row.extra_data != null && typeof row.extra_data === "object" && !Array.isArray(row.extra_data)) {
    extraData = {};
    for (const [k, v] of Object.entries(row.extra_data)) {
      if (typeof v === "string") extraData[k] = v;
      else if (v != null) extraData[k] = String(v);
    }
  }
  return {
    id: String(row.id),
    content: String(row.content ?? ""),
    status: String(row.status ?? ""),
    assignee: row.assignee != null ? String(row.assignee) : null,
    last_updated_by: row.last_updated_by != null ? String(row.last_updated_by) : null,
    priority: row.priority != null ? String(row.priority) : null,
    updated_at: updatedAt,
    project_id: projectId,
    due_date: dueDate,
    extra_data: extraData,
    workflow_status:
      row.workflow_status === "draft" ||
      row.workflow_status === "submitted" ||
      row.workflow_status === "revision_requested" ||
      row.workflow_status === "approved" ||
      row.workflow_status === "rejected"
        ? row.workflow_status
        : null,
    workflow_submitted_at: row.workflow_submitted_at != null ? String(row.workflow_submitted_at) : null,
    workflow_reviewed_at: row.workflow_reviewed_at != null ? String(row.workflow_reviewed_at) : null,
    workflow_reviewed_by: row.workflow_reviewed_by != null ? String(row.workflow_reviewed_by) : null,
  };
}

let tasksRealtimeChannelSeq = 0;

/** Realtime kanalı: yalnızca `live` gerçek abonelik; `connecting` bekleniyor; `disconnected` hata veya abonelik gelmedi. */
export type RealtimeConnectionState = "connecting" | "live" | "disconnected";

export type SaveTaskResult = { ok: true } | { ok: false; message: string };

export type UseTasksOptions = {
  /** @internal TasksProvider aktifken — fetch/realtime devre dışı */
  _skip?: boolean;
};

/**
 * tasks tablosunu Supabase'den çeker ve Realtime ile anlık senkronize eder.
 * Optimistic update için setTasks / updateTask kullanılır.
 */
export function useTasksInternal(options?: UseTasksOptions) {
  const skip = options?._skip === true;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnection, setRealtimeConnection] = useState<RealtimeConnectionState>("connecting");
  /**
   * Realtime ile az önce (≤3sn) gelen UPDATE/INSERT id'leri.
   * UI satırları 3 saniyeliğine flash'lar. Sadece BAŞKA kullanıcının değişikliklerinde
   * dolar — yerel kullanıcının kendi save işlemleri (updateTaskOptimistic) dahil değildir.
   */
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set());

  /** Bir id'yi 3 sn flash listesine ekle (timer otomatik temizler). */
  const markRecentlyUpdated = useCallback((id: string) => {
    setRecentlyUpdatedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setRecentlyUpdatedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 3000);
  }, []);
  /** @deprecated `realtimeConnection === "live"` ile aynı; geriye uyumluluk için. */
  const isRealtimeConnected = realtimeConnection === "live";

  const fetchTasks = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("tasks")
        .select("*")
        .order("id", { ascending: true });

      if (fetchError) {
        const parts = [fetchError.message, fetchError.code, fetchError.details, fetchError.hint]
          .filter((x) => x != null && String(x).trim() !== "");
        throw new Error(parts.length > 0 ? parts.join(" — ") : "Supabase görev listesi alınamadı");
      }
      setTasks((data ?? []).map(mapRowToTask));
      setError(null);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Veri yüklenemedi";
      setError(msg);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skip) return;
    fetchTasks();
  }, [fetchTasks, skip]);

  // Realtime: başka kullanıcıların INSERT/UPDATE/DELETE değişiklikleri anında yansır.
  // Supabase Dashboard > Database > Replication bölümünde "tasks" tablosunun publication'a eklendiğinden emin olun.
  useEffect(() => {
    if (skip) return;
    if (isRealtimeDisabledForClient()) {
      setRealtimeConnection("disconnected");
      return;
    }
    let channel: RealtimeChannel;
    let subscribeTimeout: ReturnType<typeof setTimeout> | null = null;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    setRealtimeConnection("connecting");
    subscribeTimeout = setTimeout(() => {
      if (!cancelled) setRealtimeConnection((prev) => (prev === "live" ? "live" : "disconnected"));
    }, REALTIME_SUBSCRIBE_TIMEOUT_MS);

    const scheduleSync = () => {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        if (!cancelled) fetchTasks();
        syncTimer = null;
      }, 650);
    };

    const channelTopic = `tasks-realtime-sync-${++tasksRealtimeChannelSeq}`;
    // `private: true` → Realtime postgres_changes payloadlarına `tasks` tablosu
    // RLS politikaları uygulanır; yetkisiz kullanıcıya değişiklik sızmaz.
    channel = supabase
      .channel(channelTopic, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        (payload: PostgresChangePayload) => {
          try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const newId = newRecord?.id != null ? String(newRecord.id) : null;
            const oldId = oldRecord?.id != null ? String(oldRecord.id) : null;

            setTasks((prev) => {
              switch (eventType) {
                case "INSERT":
                  if (newRecord && typeof newRecord === "object") {
                    const existing = prev.some((t) => String(t.id) === newId);
                    if (!existing) {
                      if (newId) markRecentlyUpdated(newId);
                      return [...prev, mapRowToTask(newRecord as Record<string, unknown>)];
                    }
                  }
                  return prev;
                case "UPDATE":
                  if (newRecord && typeof newRecord === "object" && newId) {
                    const updated = mapRowToTask(newRecord as Record<string, unknown>);
                    // Yerel kullanıcının kendi save'inde realtime de fire eder; o durumda
                    // mevcut row'un last_updated_by'ı zaten ayarlanmış olur. Flash'ı
                    // sadece DEĞİŞEN alanlar varsa ve yerel optimistik update'ten farklı
                    // (yani başka kullanıcı/kaynak) ise tetikle.
                    const existing = prev.find((t) => String(t.id) === newId);
                    const isChanged =
                      !existing ||
                      existing.status !== updated.status ||
                      existing.content !== updated.content ||
                      existing.assignee !== updated.assignee ||
                      existing.priority !== updated.priority ||
                      existing.due_date !== updated.due_date ||
                      JSON.stringify(existing.extra_data ?? null) !==
                        JSON.stringify(updated.extra_data ?? null);
                    if (isChanged) markRecentlyUpdated(newId);
                    return prev.map((t) =>
                      String(t.id) === newId ? { ...t, ...updated } : t
                    );
                  }
                  return prev;
                case "DELETE":
                  if (oldId) return prev.filter((t) => String(t.id) !== oldId);
                  return prev;
                default:
                  return prev;
              }
            });
            // Gösterge alanları (Toplam, Tamamlandı, Devam vb.) senkron kalsın diye
            // Realtime olayı sonrası kısa gecikmeyle bir kez tam liste çekilir (debounced).
            scheduleSync();
          } catch (e) {
            console.warn("[Tasks] Realtime payload error:", e);
            fetchTasks();
          }
        }
      )
      .subscribe((status, err) => {
        if (cancelled) return;
        const statusStr = typeof status === "string" ? status : String(status ?? "");
        const isSubscribed = statusStr.toUpperCase() === "SUBSCRIBED";
        const isFailed =
          statusStr === "CLOSED" ||
          statusStr === "CHANNEL_ERROR" ||
          statusStr === "TIMED_OUT" ||
          statusStr === "errored" ||
          statusStr === "closed";

        if (isSubscribed) {
          if (subscribeTimeout) {
            clearTimeout(subscribeTimeout);
            subscribeTimeout = null;
          }
          setRealtimeConnection("live");
        } else if (isFailed || err) {
          if (subscribeTimeout) {
            clearTimeout(subscribeTimeout);
            subscribeTimeout = null;
          }
          setRealtimeConnection("disconnected");
          if (err) console.warn("[Tasks] Realtime:", err);
        }
      });

    return () => {
      cancelled = true;
      if (subscribeTimeout) clearTimeout(subscribeTimeout);
      if (syncTimer) clearTimeout(syncTimer);
      setRealtimeConnection("disconnected");
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, markRecentlyUpdated, skip]);

  // Sekme odağı / görünürlük: en fazla ~30 sn'de bir tam yenile (Realtime kaçırsa diye, ağ tasarrufu)
  useEffect(() => {
    if (skip) return;
    const lastRefetchAt = { current: 0 };
    const throttleMs = 30_000;
    const maybeFetch = () => {
      const now = Date.now();
      if (now - lastRefetchAt.current < throttleMs) return;
      lastRefetchAt.current = now;
      fetchTasks();
    };
    if (typeof window === "undefined") return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") maybeFetch();
    };
    window.addEventListener("focus", maybeFetch);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", maybeFetch);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchTasks, skip]);

  // Kurumsal ağlarda WebSocket engellenirse güvenli HTTPS polling yedeği.
  useEffect(() => {
    if (skip) return;
    if (realtimeConnection === "live") return;
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void fetchTasks();
    }, TASKS_FALLBACK_POLL_MS);
    return () => window.clearInterval(interval);
  }, [realtimeConnection, fetchTasks, skip]);

  const updateTaskOptimistic = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  }, []);

  const saveTask = useCallback(
    async (
      taskId: string,
      patch: Partial<
        Pick<
          Task,
          | "content"
          | "status"
          | "assignee"
          | "last_updated_by"
          | "priority"
          | "project_id"
          | "due_date"
          | "extra_data"
          | "workflow_status"
          | "workflow_submitted_at"
          | "workflow_reviewed_at"
          | "workflow_reviewed_by"
        >
      >
    ): Promise<SaveTaskResult> => {
      const payload: Record<string, unknown> = {
        ...(patch ?? {}),
        last_updated_by: patch?.last_updated_by ?? "anon",
      };
      if ("project_id" in (patch ?? {})) payload.project_id = patch?.project_id ?? null;
      if ("due_date" in (patch ?? {})) payload.due_date = patch?.due_date ?? null;
      if ("priority" in (patch ?? {})) payload.priority = patch?.priority ?? null;
      if ("extra_data" in (patch ?? {})) payload.extra_data = patch?.extra_data ?? null;
      if ("workflow_status" in (patch ?? {})) payload.workflow_status = patch?.workflow_status ?? null;
      if ("workflow_submitted_at" in (patch ?? {})) payload.workflow_submitted_at = patch?.workflow_submitted_at ?? null;
      if ("workflow_reviewed_at" in (patch ?? {})) payload.workflow_reviewed_at = patch?.workflow_reviewed_at ?? null;
      if ("workflow_reviewed_by" in (patch ?? {})) payload.workflow_reviewed_by = patch?.workflow_reviewed_by ?? null;
      const { data: updatedRows, error: updateError } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", taskId)
        .select("id");

      if (updateError) {
        console.error("[Tasks] Update failed:", updateError);
        const parts = [updateError.message, updateError.code, updateError.details, updateError.hint]
          .filter((x) => x != null && String(x).trim() !== "");
        await fetchTasks();
        return { ok: false, message: parts.length > 0 ? parts.join(" — ") : "Güncelleme başarısız" };
      }

      // Sessiz RLS bloğunu yakala: update hatasız döner ama 0 satır etkilenirse
      // yetki olmamış demektir. Optimistic state ile DB'yi senkronla.
      if (!updatedRows || updatedRows.length === 0) {
        console.warn("[Tasks] Update affected 0 rows — RLS may have blocked it:", taskId);
        await fetchTasks();
        return {
          ok: false,
          message: "Bu satırı güncelleme yetkiniz yok (RLS engelledi).",
        };
      }

      if (isSupabaseConfigured() && patch.status !== undefined && patch.status !== null) {
        void supabase.rpc("notify_admins_user_completed_all_tasks").then(({ error: rpcErr }) => {
          if (
            rpcErr &&
            rpcErr.code !== "42P01" &&
            rpcErr.code !== "42883" &&
            !String(rpcErr.message ?? "").includes("admin_alerts")
          ) {
            console.warn("[Tasks] notify_admins_user_completed_all_tasks:", rpcErr);
          }
        });
      }
      return { ok: true };
    },
    [fetchTasks]
  );

  const createTask = useCallback(
    async (task: Pick<Task, "content" | "status" | "assignee"> & { priority?: string | null; project_id?: string | null; due_date?: string | null; extra_data?: Record<string, string> | null }) => {
      const row: Record<string, unknown> = {
        content: task.content || "",
        status: task.status || "Yapılacak",
        assignee: task.assignee || null,
        last_updated_by: "anon",
      };
      if (task.project_id != null) row.project_id = task.project_id;
      if (task.due_date != null && String(task.due_date).trim() !== "") row.due_date = task.due_date;
      if (task.priority != null && String(task.priority).trim() !== "") row.priority = task.priority;
      if (task.extra_data != null && Object.keys(task.extra_data).length > 0) row.extra_data = task.extra_data;
      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert(row)
        .select("id")
        .single();
      if (insertError) {
        throw insertError;
      }
      await fetchTasks();
      return (data?.id as string | undefined) ?? null;
    },
    [fetchTasks]
  );

  const BULK_INSERT_CHUNK = 100;
  type TaskInsert = Pick<Task, "content" | "status" | "assignee"> & { priority?: string | null; project_id?: string | null; due_date?: string | null; extra_data?: Record<string, string> | null };
  const createTasksBulk = useCallback(
    async (tasks: TaskInsert[]) => {
      if (tasks.length === 0) return;
      const rows = tasks.map((t) => {
        const row: Record<string, unknown> = {
          content: String(t.content ?? "").trim() || "",
          status: String(t.status ?? "Yapılacak").trim() || "Yapılacak",
          assignee: t.assignee != null && String(t.assignee).trim() !== "" ? String(t.assignee).trim() : null,
          last_updated_by: "anon",
        };
        if (t.project_id != null) row.project_id = t.project_id;
        if (t.due_date != null && String(t.due_date).trim() !== "") row.due_date = t.due_date;
        if (t.priority != null && String(t.priority).trim() !== "") row.priority = t.priority;
        if (t.extra_data != null && Object.keys(t.extra_data).length > 0) row.extra_data = t.extra_data;
        return row;
      });
      for (let i = 0; i < rows.length; i += BULK_INSERT_CHUNK) {
        const chunk = rows.slice(i, i + BULK_INSERT_CHUNK);
        const { error } = await supabase.from("tasks").insert(chunk);
        if (error) {
          throw error;
        }
      }
      await fetchTasks();
    },
    [fetchTasks]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId);
      if (deleteError) throw deleteError;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    []
  );

  const DELETE_CHUNK = 100;
  const deleteTasks = useCallback(async (taskIds: string[]) => {
    if (taskIds.length === 0) return;
    const ids = [...taskIds];
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
      const chunk = ids.slice(i, i + DELETE_CHUNK);
      const { error } = await supabase.from("tasks").delete().in("id", chunk);
      if (error) throw error;
    }
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));
  }, []);

  return useMemo(
    () => ({
      tasks,
      setTasks,
      updateTaskOptimistic,
      saveTask,
      createTask,
      createTasksBulk,
      deleteTask,
      deleteTasks,
      fetchTasks,
      isLoading,
      error,
      isRealtimeConnected,
      realtimeConnection,
      recentlyUpdatedIds,
    }),
    [
      tasks,
      setTasks,
      updateTaskOptimistic,
      saveTask,
      createTask,
      createTasksBulk,
      deleteTask,
      deleteTasks,
      fetchTasks,
      isLoading,
      error,
      isRealtimeConnected,
      realtimeConnection,
      recentlyUpdatedIds,
    ]
  );
}
