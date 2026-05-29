"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchNotificationTaskHints } from "@/lib/notificationDerivedTasks";
import type { NotificationTaskHint } from "@/lib/notificationDerivedHelpers";
import { NOTIFICATIONS_FALLBACK_POLL_MS, shouldPollInBrowser } from "@/lib/realtimeFallback";

/**
 * Sunucu tetikleyicileri kapalıyken bildirim türetimi için hafif görev sorgusu.
 * `useTasksWithRealtime` yerine yalnızca assignee eşleşen birkaç alan çeker.
 */
export function useNotificationDerivedTasks(
  assigneeEmail: string | null | undefined,
  enabled: boolean
): { tasks: NotificationTaskHint[]; isLoading: boolean; refresh: () => Promise<void> } {
  const [tasks, setTasks] = useState<NotificationTaskHint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const email = (assigneeEmail ?? "").trim();
    if (!enabled || !email) {
      setTasks([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setTasks(await fetchNotificationTaskHints(email));
    } finally {
      setIsLoading(false);
    }
  }, [assigneeEmail, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void refresh();
    }, NOTIFICATIONS_FALLBACK_POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [enabled, refresh]);

  return { tasks, isLoading, refresh };
}
