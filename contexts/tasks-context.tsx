"use client";

import { createContext, useContext } from "react";
import { useTasksInternal } from "@/hooks/useTasksInternal";

export type TasksContextValue = ReturnType<typeof useTasksInternal>;

const TasksContext = createContext<TasksContextValue | null>(null);

/** Tüm oturumlu sayfalarda tek görev listesi + Realtime aboneliği. */
export function TasksProvider({ children }: { children: React.ReactNode }) {
  const value = useTasksInternal();
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasksContextOptional(): TasksContextValue | null {
  return useContext(TasksContext);
}
