"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

/** Proje id → o projeye ait görev sayısı. */
export function useTaskCountByProject(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("project_id");
    if (error) {
      setCounts({});
      return;
    }
    const map: Record<string, number> = {};
    (data ?? []).forEach((row: { project_id: string | null }) => {
      const id = row.project_id;
      if (id) {
        map[id] = (map[id] ?? 0) + 1;
      }
    });
    setCounts(map);
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const channel = supabase
      .channel("task-count-by-project")
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

  return counts;
}
