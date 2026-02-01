"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PostgresChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

/**
 * tasks tablosu üzerinde Realtime Subscription (Canlı Dinleme) kurar.
 * INSERT, UPDATE, DELETE olduğunda console'a log düşer.
 */
export function useTasksRealtime() {
  useEffect(() => {
    let channel: RealtimeChannel;

    channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        (payload: PostgresChangePayload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          switch (eventType) {
            case "INSERT":
              console.log("[Realtime] tasks INSERT:", newRecord);
              break;
            case "UPDATE":
              console.log("[Realtime] tasks UPDATE:", { old: oldRecord, new: newRecord });
              break;
            case "DELETE":
              console.log("[Realtime] tasks DELETE:", oldRecord);
              break;
            default:
              console.log("[Realtime] tasks unknown event:", eventType, payload);
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] tasks subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
