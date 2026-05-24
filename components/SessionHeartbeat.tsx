"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { upsertPresenceHeartbeat } from "@/lib/presenceHeartbeat";
import {
  PRESENCE_HEARTBEAT_WRITE_MS,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";

export function SessionHeartbeat() {
  const { user, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded || !user || user.id === "demo") return;

    const write = () => {
      if (!shouldPollInBrowser()) return;
      void upsertPresenceHeartbeat({
        scope: "app",
        userId: user.id,
        userEmail: user.email,
        userName: user.displayName ?? user.email,
      });
    };

    write();
    const interval = window.setInterval(write, PRESENCE_HEARTBEAT_WRITE_MS);
    const onFocus = write;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") write();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isLoaded, user]);

  return null;
}
