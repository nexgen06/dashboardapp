"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { removeRealtimeChannelsByTopic } from "@/lib/removeRealtimeChannelTopic";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  createBrowserClientId,
  onlineUsersFromPresenceState,
  type OnlineUser,
} from "@/lib/supabasePresenceHelpers";

export type { OnlineUser };

const VIEWER_BROADCAST = "project_viewer_active";

export type ProjectViewerNotice = {
  id: string;
  message: string;
  name?: string;
  email?: string;
};

type ViewerPayload = {
  sessionId: string;
  projectId: string;
  email?: string;
  name?: string;
  at: number;
};

export type UseProjectPresenceOptions = {
  projectId: string;
  enabled?: boolean;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
  soundEnabled?: boolean;
  browserPushEnabled?: boolean;
  projectTitle?: string;
};

function playSoftBeep() {
  try {
    const Ctx =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : null;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.value = 0.04;
    o.frequency.value = 740;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => {});
    }, 90);
  } catch {
    /* sessiz */
  }
}

function channelNameForProject(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `proj-${safe}-presence`;
}

/**
 * Proje detay: çevrimiçi kullanıcılar + “X katıldı” broadcast (diğer oturumlara kısa bildirim).
 * Sohbet mesajları `useProjectChatRoom` + `project_chat_messages` tablosunda.
 */
export function useProjectPresence(options: UseProjectPresenceOptions) {
  const {
    projectId,
    enabled = true,
    userEmail,
    userName,
    userId,
    soundEnabled = false,
    browserPushEnabled = false,
    projectTitle = "Proje",
  } = options;

  const userOptsRef = useRef({ userEmail, userName, userId });
  userOptsRef.current = { userEmail, userName, userId };
  const soundRef = useRef(soundEnabled);
  const browserPushRef = useRef(browserPushEnabled);
  soundRef.current = soundEnabled;
  browserPushRef.current = browserPushEnabled;

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [viewerNotice, setViewerNotice] = useState<ProjectViewerNotice | null>(null);
  const [presenceReady, setPresenceReady] = useState(false);

  const clientIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const lastJoinNoticeAtRef = useRef<Map<string, number>>(new Map());
  const projectTitleRef = useRef(projectTitle);
  projectTitleRef.current = projectTitle;

  const dismissViewerNotice = useCallback(() => setViewerNotice(null), []);

  /** Balon birkaç saniye sonra kendiliğinden kaybolur */
  useEffect(() => {
    if (!viewerNotice) return;
    const t = window.setTimeout(() => setViewerNotice(null), 5200);
    return () => window.clearTimeout(t);
  }, [viewerNotice?.id]);

  const updateOnlineFromState = useCallback((ch: RealtimeChannel) => {
    if (!subscribedRef.current) return;
    const u = userOptsRef.current;
    const list = onlineUsersFromPresenceState(ch);
    const cid = clientIdRef.current;
    let next = list;
    if (cid) {
      const hasSelf = next.some((entry) => entry.key === cid || entry.key.startsWith(`${cid}:`));
      if (!hasSelf) {
        next = [{ key: cid, email: u.userEmail ?? undefined, name: u.userName ?? undefined }, ...list];
      }
    }
    setOnlineUsers(
      next.length > 0 ? next : cid ? [{ key: cid, email: u.userEmail ?? undefined, name: u.userName ?? undefined }] : []
    );
  }, []);

  useEffect(() => {
    if (!enabled || !projectId.trim()) {
      setPresenceReady(false);
      return;
    }

    let cancelled = false;
    setPresenceReady(false);
    subscribedRef.current = false;
    activeChannelRef.current = null;

    const myClientId = createBrowserClientId();
    clientIdRef.current = myClientId;
    const topic = channelNameForProject(projectId);

    const intervalId = setInterval(() => {
      if (channelRef.current) updateOnlineFromState(channelRef.current);
    }, 4000);

    void (async () => {
      try {
        await removeRealtimeChannelsByTopic(supabase, topic);
      } catch {
        /* yok say */
      }
      if (cancelled) return;

      const channel = supabase.channel(topic, {
        config: {
          presence: { key: myClientId, enabled: true },
          broadcast: { self: false },
        },
      });
      activeChannelRef.current = channel;

      const notifyOthers = (payload: ViewerPayload) => {
        void channel.send({ type: "broadcast", event: VIEWER_BROADCAST, payload });
      };

      const maybeBrowserNotify = (label: string, body: string, uniqueTag: string) => {
        if (!browserPushRef.current || typeof window === "undefined" || typeof Notification === "undefined") return;
        if (Notification.permission !== "granted") return;
        try {
          new Notification(label, {
            body,
            tag: `pv-${projectId}-${uniqueTag}`.slice(0, 120),
            requireInteraction: false,
            silent: false,
          });
        } catch {
          /* yok say */
        }
      };

      channel
        .on("broadcast", { event: VIEWER_BROADCAST }, ({ payload }: { payload: ViewerPayload }) => {
          const p = payload;
          if (!p || p.sessionId === myClientId || p.projectId !== projectId) return;

          const noticeKey = (p.email ?? "").trim().toLowerCase() || `sid:${p.sessionId}`;
          const now = Date.now();
          const last = lastJoinNoticeAtRef.current.get(noticeKey) ?? 0;
          if (now - last < 45_000) return;
          lastJoinNoticeAtRef.current.set(noticeKey, now);

          const who = (p.name && p.name.trim()) || (p.email && p.email.trim()) || "Bir kullanıcı";
          const message = `${who} katıldı`;

          setViewerNotice({
            id: `${p.sessionId}-${p.at}`,
            message,
            name: p.name,
            email: p.email,
          });

          if (soundRef.current) playSoftBeep();
          maybeBrowserNotify(projectTitleRef.current, message, `${p.sessionId}-${p.at}`);
        })
        .on("presence", { event: "sync" }, () => updateOnlineFromState(channel))
        .on("presence", { event: "join" }, () => {
          updateOnlineFromState(channel);
          setTimeout(() => updateOnlineFromState(channel), 120);
        })
        .on("presence", { event: "leave" }, () => {
          updateOnlineFromState(channel);
          setTimeout(() => updateOnlineFromState(channel), 120);
        })
        .subscribe(async (status, err) => {
          if (cancelled) return;
          const ok = String(status ?? "").toUpperCase() === "SUBSCRIBED";
          if (ok) {
            subscribedRef.current = true;
            channelRef.current = channel;
            setPresenceReady(true);

            await channel
              .track({
                sessionId: myClientId,
                project_id: projectId,
                email: userOptsRef.current.userEmail ?? undefined,
                name: userOptsRef.current.userName ?? undefined,
                user_id: userOptsRef.current.userId ?? undefined,
              })
              .catch(() => null);

            const at = Date.now();
            notifyOthers({
              sessionId: myClientId,
              projectId,
              email: userOptsRef.current.userEmail ?? undefined,
              name: userOptsRef.current.userName ?? undefined,
              at,
            });

            setOnlineUsers((prev) => {
              const me: OnlineUser = {
                key: myClientId,
                email: userOptsRef.current.userEmail ?? undefined,
                name: userOptsRef.current.userName ?? undefined,
              };
              if (prev.some((u) => u.key === me.key)) return prev;
              return [me, ...prev];
            });
            setTimeout(() => updateOnlineFromState(channel), 80);
            setTimeout(() => updateOnlineFromState(channel), 350);
          } else {
            const s = String(status ?? "");
            const failed =
              s === "CLOSED" ||
              s === "CHANNEL_ERROR" ||
              s === "TIMED_OUT" ||
              String(s).toLowerCase() === "errored";
            if (failed || err) {
              console.warn("[Presence] proje kanalı:", topic, s, err ?? "");
            }
          }
        });
    })();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      channelRef.current = null;
      clientIdRef.current = null;
      subscribedRef.current = false;
      setPresenceReady(false);
      const chToRemove = activeChannelRef.current;
      activeChannelRef.current = null;
      void (async () => {
        if (chToRemove) {
          try {
            await chToRemove.untrack();
          } catch {
            /* yok say */
          }
          await supabase.removeChannel(chToRemove);
        } else {
          await removeRealtimeChannelsByTopic(supabase, topic);
        }
      })();
    };
  }, [enabled, projectId, updateOnlineFromState]);

  useEffect(() => {
    if (!enabled || !projectId.trim()) return;
    const ch = channelRef.current;
    const cid = clientIdRef.current;
    if (!ch || !subscribedRef.current || !cid) return;
    void ch
      .track({
        sessionId: cid,
        project_id: projectId,
        email: userEmail ?? undefined,
        name: userName ?? undefined,
        user_id: userId ?? undefined,
      })
      .catch(() => null);
    updateOnlineFromState(ch);
  }, [enabled, projectId, userEmail, userName, userId, updateOnlineFromState]);

  return {
    onlineUsers,
    viewerNotice,
    dismissViewerNotice,
    sessionId: clientIdRef.current ?? "",
    presenceReady,
  };
}
