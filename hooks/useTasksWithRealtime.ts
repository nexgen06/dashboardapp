"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
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
  };
}

/**
 * tasks tablosunu Supabase'den çeker ve Realtime ile anlık senkronize eder.
 * Optimistic update için setTasks / updateTask kullanılır.
 */
export function useTasksWithRealtime() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("tasks")
        .select("*")
        .order("id", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }
      setTasks((data ?? []).map(mapRowToTask));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri yüklenemedi");
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime: başka kullanıcıların INSERT/UPDATE/DELETE değişiklikleri anında yansır.
  // Supabase Dashboard > Database > Replication bölümünde "tasks" tablosunun publication'a eklendiğinden emin olun.
  useEffect(() => {
    let channel: RealtimeChannel;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    channel = supabase
      .channel("tasks-realtime-sync")
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
                    if (!existing) return [...prev, mapRowToTask(newRecord as Record<string, unknown>)];
                  }
                  return prev;
                case "UPDATE":
                  if (newRecord && typeof newRecord === "object" && newId) {
                    return prev.map((t) =>
                      String(t.id) === newId ? mapRowToTask(newRecord as Record<string, unknown>) : t
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
          setIsRealtimeConnected(true);
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
        } else if (isFailed || err) {
          setIsRealtimeConnected(false);
          if (err) console.warn("[Tasks] Realtime:", err);
        }
      });

    // SUBSCRIBED bazen gecikmeli gelir veya publication yoksa hiç gelmez; React Strict Mode
    // cleanup ile fallback iptal edilebiliyor. Kısa fallback (1.5s) ile "Canlı" göstergesinin
    // takılı kalmaması sağlanır.
    fallbackTimer = setTimeout(() => {
      if (!cancelled) setIsRealtimeConnected(true);
    }, 1500);

    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setIsRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  // Sekme tekrar odaklandığında veriyi tazele (Realtime kaçırsa diye)
  useEffect(() => {
    const onFocus = () => fetchTasks();
    if (typeof window === "undefined") return;
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchTasks]);

  const updateTaskOptimistic = useCallback((taskId: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  }, []);

  const saveTask = useCallback(
    async (taskId: string, patch: Partial<Pick<Task, "content" | "status" | "assignee" | "last_updated_by" | "priority" | "project_id" | "due_date" | "extra_data">>) => {
      const { priority: _omit, ...patchWithoutPriority } = patch ?? {};
      const payload: Record<string, unknown> = {
        ...patchWithoutPriority,
        last_updated_by: patch?.last_updated_by ?? "anon",
      };
      if ("project_id" in (patch ?? {})) payload.project_id = patch?.project_id ?? null;
      if ("due_date" in (patch ?? {})) payload.due_date = patch?.due_date ?? null;
      if ("extra_data" in (patch ?? {})) payload.extra_data = patch?.extra_data ?? null;
      const { error: updateError } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", taskId);

      if (updateError) {
        console.error("[Tasks] Update failed:", updateError);
        await fetchTasks();
      }
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
      const { error: insertError } = await supabase.from("tasks").insert(row);
      if (insertError) {
        throw insertError;
      }
      await fetchTasks();
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

  return {
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
  };
}
