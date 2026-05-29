"use client";

import { useMemo } from "react";
import { useTasksContextOptional } from "@/contexts/tasks-context";
import { useTasksInternal } from "@/hooks/useTasksInternal";

export type { RealtimeConnectionState, SaveTaskResult, UseTasksOptions } from "@/hooks/useTasksInternal";

/**
 * Görev listesi — `TasksProvider` içindeyse paylaşımlı instance;
 * dışında (test / izole render) doğrudan fetch.
 */
export function useTasksWithRealtime() {
  const shared = useTasksContextOptional();
  const standalone = useTasksInternal(shared ? { _skip: true } : undefined);

  return useMemo(() => {
    if (shared) return shared;
    return standalone;
  }, [shared, standalone]);
}

export { useTasksInternal } from "@/hooks/useTasksInternal";
