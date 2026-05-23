"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  COMMENTS_FALLBACK_POLL_MS,
  REALTIME_SUBSCRIBE_TIMEOUT_MS,
  isRealtimeDisabledForClient,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  listTaskComments,
  type TaskComment,
} from "@/lib/taskComments";

let channelSeq = 0;

type PostgresChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

/**
 * Bir görevin yorumlarını canlı dinler.
 * taskId değiştiğinde yeniden bağlanır; null/empty olursa boş döner.
 */
export function useTaskComments(taskId: string | null | undefined) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      setIsLoading(false);
      return;
    }
    try {
      const rows = await listTaskComments(taskId);
      setComments(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yorumlar yüklenemedi");
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  // Realtime: bu task'a ait yorum eklemeleri/güncellemeleri/silmeleri anında uygula.
  useEffect(() => {
    if (!taskId) return;
    if (isRealtimeDisabledForClient()) {
      setRealtimeConnected(false);
      return;
    }
    channelSeq += 1;
    let cancelled = false;
    let subscribeTimeout: ReturnType<typeof setTimeout> | null = null;
    setRealtimeConnected(false);
    subscribeTimeout = setTimeout(() => {
      if (!cancelled) setRealtimeConnected(false);
    }, REALTIME_SUBSCRIBE_TIMEOUT_MS);
    const ch = supabase
      .channel(`task_comments_${taskId}_${channelSeq}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `task_id=eq.${taskId}`,
        },
        (payload: PostgresChangePayload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as unknown as TaskComment;
            setComments((prev) => {
              if (prev.find((c) => c.id === String(row.id))) return prev;
              return [...prev, mapPayloadRow(row)];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as unknown as TaskComment;
            setComments((prev) =>
              prev.map((c) => (c.id === String(row.id) ? mapPayloadRow(row) : c))
            );
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string };
            const oldId = oldRow?.id ? String(oldRow.id) : null;
            if (oldId) setComments((prev) => prev.filter((c) => c.id !== oldId));
          }
        }
      )
      .subscribe((status, err) => {
        if (cancelled) return;
        const statusStr = String(status ?? "").toUpperCase();
        if (statusStr === "SUBSCRIBED") {
          if (subscribeTimeout) {
            clearTimeout(subscribeTimeout);
            subscribeTimeout = null;
          }
          setRealtimeConnected(true);
        } else if (err || statusStr === "CHANNEL_ERROR" || statusStr === "TIMED_OUT" || statusStr === "CLOSED") {
          if (subscribeTimeout) {
            clearTimeout(subscribeTimeout);
            subscribeTimeout = null;
          }
          setRealtimeConnected(false);
        }
      });
    channelRef.current = ch;
    return () => {
      cancelled = true;
      if (subscribeTimeout) clearTimeout(subscribeTimeout);
      setRealtimeConnected(false);
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [taskId]);

  useEffect(() => {
    if (!taskId || realtimeConnected) return;
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void refresh();
    }, COMMENTS_FALLBACK_POLL_MS);
    return () => window.clearInterval(interval);
  }, [taskId, realtimeConnected, refresh]);

  return { comments, isLoading, error, refresh };
}

function mapPayloadRow(row: TaskComment | Record<string, unknown>): TaskComment {
  return {
    id: String((row as Record<string, unknown>).id ?? ""),
    task_id: String((row as Record<string, unknown>).task_id ?? ""),
    user_id: String((row as Record<string, unknown>).user_id ?? ""),
    user_email: String((row as Record<string, unknown>).user_email ?? ""),
    user_display_name:
      (row as Record<string, unknown>).user_display_name != null
        ? String((row as Record<string, unknown>).user_display_name)
        : null,
    body: String((row as Record<string, unknown>).body ?? ""),
    created_at: String((row as Record<string, unknown>).created_at ?? ""),
    updated_at: String((row as Record<string, unknown>).updated_at ?? ""),
  };
}
