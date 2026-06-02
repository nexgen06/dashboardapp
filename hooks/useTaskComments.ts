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
  listAllCellCommentCounts,
  listCellCommentCounts,
  listTaskComments,
  type CommentScope,
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
 *
 * @param taskId Hedef görev
 * @param scope Hangi tip yorumlar (varsayılan "task" = görev seviyesi).
 *              - "task" → field_key IS NULL (eski davranış, geriye dönük)
 *              - "all"  → görev + tüm hücre yorumları
 *              - { fieldKey: "extra:Sicil No" } → sadece o hücre
 */
export function useTaskComments(
  taskId: string | null | undefined,
  scope: CommentScope = "task"
) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Scope objesi her render'da yeni referans olabilir — stable key türet
  const scopeKey =
    scope === "task" || scope === "all" ? scope : `field:${scope.fieldKey}`;

  // Client-side filter: realtime payload tüm task yorumlarını getirir;
  // bizim scope'umuza uymayanları eliyoruz.
  const matchesScope = useCallback(
    (row: { field_key: string | null }) => {
      if (scope === "all") return true;
      if (scope === "task") return row.field_key === null;
      return row.field_key === scope.fieldKey;
    },
    // scope obje ise stable key üzerinden bağla
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey]
  );

  const refresh = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      setIsLoading(false);
      return;
    }
    try {
      const rows = await listTaskComments(taskId, scope);
      setComments(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yorumlar yüklenemedi");
      setComments([]);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, scopeKey]);

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
            const mapped = mapPayloadRow(payload.new as TaskComment);
            // Realtime tüm task yorumlarını getirir; scope dışı olanları atla.
            if (!matchesScope(mapped)) return;
            setComments((prev) => {
              if (prev.find((c) => c.id === mapped.id)) return prev;
              return [...prev, mapped];
            });
          } else if (payload.eventType === "UPDATE") {
            const mapped = mapPayloadRow(payload.new as TaskComment);
            if (!matchesScope(mapped)) {
              // Scope dışına çıktıysa listeden düş
              setComments((prev) => prev.filter((c) => c.id !== mapped.id));
              return;
            }
            setComments((prev) =>
              prev.map((c) => (c.id === mapped.id ? mapped : c))
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
  const r = row as Record<string, unknown>;
  const rawField = r.field_key;
  return {
    id: String(r.id ?? ""),
    task_id: String(r.task_id ?? ""),
    user_id: String(r.user_id ?? ""),
    user_email: String(r.user_email ?? ""),
    user_display_name:
      r.user_display_name != null
        ? String(r.user_display_name)
        : null,
    body: String(r.body ?? ""),
    field_key:
      rawField != null && String(rawField).trim() !== ""
        ? String(rawField)
        : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

/**
 * Bir görevin hücre-bazlı yorum sayımlarını canlı dinler.
 *
 * Tabloda her hücrenin sağ üstündeki "💬 N" rozetini beslemek için kullanılır.
 * Realtime: bu task'taki yorumlardan biri eklendiğinde/silinince map yeniden hesaplanır.
 *
 * @returns counts: { [fieldKey]: number } — sadece hücre yorumları (field_key IS NOT NULL)
 */
export function useCellCommentCounts(taskId: string | null | undefined) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    if (!taskId) {
      setCounts({});
      setIsLoading(false);
      return;
    }
    try {
      const m = await listCellCommentCounts(taskId);
      setCounts(m);
    } catch {
      setCounts({});
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!taskId) return;
    if (isRealtimeDisabledForClient()) {
      setRealtimeConnected(false);
      return;
    }
    channelSeq += 1;
    let cancelled = false;
    setRealtimeConnected(false);
    const ch = supabase
      .channel(`cell_counts_${taskId}_${channelSeq}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `task_id=eq.${taskId}`,
        },
        // Sayım için en pratik yol: değişiklik gelince tam refresh.
        // Per-row delta yönetmek yerine küçük yeniden sorgu; volume düşük.
        () => {
          if (!cancelled) void refresh();
        }
      )
      .subscribe((status, err) => {
        if (cancelled) return;
        const s = String(status ?? "").toUpperCase();
        if (s === "SUBSCRIBED") setRealtimeConnected(true);
        else if (err || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setRealtimeConnected(false);
        }
      });
    channelRef.current = ch;
    return () => {
      cancelled = true;
      setRealtimeConnected(false);
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [taskId, refresh]);

  useEffect(() => {
    if (!taskId || realtimeConnected) return;
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void refresh();
    }, COMMENTS_FALLBACK_POLL_MS);
    return () => window.clearInterval(interval);
  }, [taskId, realtimeConnected, refresh]);

  return { counts, isLoading };
}

/**
 * Çoklu görev için hücre yorum sayımlarını tek seferde dinler.
 *
 * TasksTable'da visible satırların hepsine ait rozet sayımlarını besler.
 * Per-task hook açmak yerine TEK realtime kanal kullanılır — yüzlerce
 * satır için scaling kırılmasın diye.
 *
 * Yaklaşım: task_comments tablosunun tümünü dinler (filter yok), event
 * geldiğinde sadece taskIds set içindeyse full refresh tetikler. Volume
 * düşük (yorumlar nadiren değişir), refresh ucuz tek SELECT.
 *
 * @param taskIds Şu an görünen görev id'leri (memoized olmalı)
 * @returns countsMap[taskId]?.[fieldKey] = N
 */
export function useAllCellCommentCounts(taskIds: string[]) {
  const [countsMap, setCountsMap] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // taskIds dizisi her render'da yeni referans olabilir — stable key türet
  const idsKey = taskIds.length === 0 ? "" : taskIds.slice().sort().join(",");

  const refresh = useCallback(async () => {
    if (!taskIds || taskIds.length === 0) {
      setCountsMap({});
      setIsLoading(false);
      return;
    }
    try {
      const m = await listAllCellCommentCounts(taskIds);
      setCountsMap(m);
    } catch {
      setCountsMap({});
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  // Set ile O(1) lookup — payload.task_id visible mi?
  const visibleIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    visibleIdsRef.current = new Set(taskIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (isRealtimeDisabledForClient()) {
      setRealtimeConnected(false);
      return;
    }
    channelSeq += 1;
    let cancelled = false;
    setRealtimeConnected(false);
    const ch = supabase
      .channel(`cell_counts_agg_${channelSeq}`)
      .on(
        "postgres_changes" as never,
        // Filter yok — tüm task_comments. Volume düşük; client'ta filter.
        { event: "*", schema: "public", table: "task_comments" },
        (payload: PostgresChangePayload) => {
          if (cancelled) return;
          const newId = String((payload.new as { task_id?: string })?.task_id ?? "");
          const oldId = String((payload.old as { task_id?: string })?.task_id ?? "");
          // Bizi ilgilendiren task'tan biriyse refresh
          if (visibleIdsRef.current.has(newId) || visibleIdsRef.current.has(oldId)) {
            void refresh();
          }
        }
      )
      .subscribe((status, err) => {
        if (cancelled) return;
        const s = String(status ?? "").toUpperCase();
        if (s === "SUBSCRIBED") setRealtimeConnected(true);
        else if (err || s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setRealtimeConnected(false);
        }
      });
    channelRef.current = ch;
    return () => {
      cancelled = true;
      setRealtimeConnected(false);
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [refresh]);

  // Realtime kapalıysa fallback polling
  useEffect(() => {
    if (realtimeConnected || taskIds.length === 0) return;
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void refresh();
    }, COMMENTS_FALLBACK_POLL_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeConnected, idsKey, refresh]);

  return { countsMap, isLoading };
}
