"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isStatusDone } from "@/lib/statusKind";

export type ProjectTaskStats = {
  /** Toplam görev sayısı (RLS ile görünür olanlar). */
  total: number;
  /** Tamamlanmış görev sayısı. */
  done: number;
};

/** Proje id → toplam ve tamamlanmış görev sayıları. */
export function useTaskCountByProject(): Record<string, ProjectTaskStats> {
  const [stats, setStats] = useState<Record<string, ProjectTaskStats>>({});

  const fetchCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("project_id, status");
    if (error) {
      setStats({});
      return;
    }
    const map: Record<string, ProjectTaskStats> = {};
    (data ?? []).forEach((row: { project_id: string | null; status: string | null }) => {
      const id = row.project_id;
      if (!id) return;
      if (!map[id]) map[id] = { total: 0, done: 0 };
      map[id].total += 1;
      if (isStatusDone(row.status)) map[id].done += 1;
    });
    setStats(map);
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const channel = supabase
      .channel("task-count-by-project", { config: { private: true } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => { fetchCounts(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  return stats;
}
