"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

const PRESENCE_CHANNEL = "tasks-presence";
const PRESENCE_EVENT = "editing";

export type OnlineUser = {
  key: string;
  email?: string;
  name?: string;
};

export type EditingUser = {
  email?: string;
  name?: string;
};

type PresencePayload = {
  clientId: string;
  rowId: string | null;
  email?: string;
  name?: string;
};

/**
 * Sekme/pencerede benzersiz ID. sessionStorage kullanmıyoruz; sekme kopyalandığında
 * aynı ID iki sekmede de olur ve presence'ta tek kullanıcı görünür. Her mount'ta
 * yeni rastgele ID = her sekme ayrı sayılır.
 */
function createClientId(): string {
  if (typeof window === "undefined") return "server";
  return `client-${Math.random().toString(36).slice(2, 11)}-${Date.now().toString(36)}`;
}

export type UsePresenceOptions = {
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
};

/**
 * Çevrimiçi kullanıcıları (Supabase Presence) ve hangi satırın kim tarafından düzenlendiğini (Broadcast) takip eder.
 */
export function usePresence(options: UsePresenceOptions = {}) {
  const { userEmail, userName, userId } = options;
  const [editingByOthers, setEditingByOthers] = useState<Set<string>>(new Set());
  const [editingByUser, setEditingByUser] = useState<Map<string, EditingUser>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const clientIdRef = useRef<string>(createClientId());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientToRowRef = useRef<Map<string, { rowId: string | null; email?: string; name?: string }>>(new Map());

  const clientId = clientIdRef.current;

  const setEditingRow = useCallback(
    (rowId: string | null) => {
      const ch = channelRef.current;
      if (!ch) return;
      const payload: PresencePayload = {
        clientId: clientIdRef.current,
        rowId,
        email: userEmail ?? undefined,
        name: userName ?? undefined,
      };
      ch.send({
        type: "broadcast",
        event: PRESENCE_EVENT,
        payload,
      });
    },
    [userEmail, userName]
  );

  const updateOnlineFromState = useCallback((ch: RealtimeChannel) => {
    const state = ch.presenceState<{ email?: string; name?: string; clientId?: string }>();
    const list: OnlineUser[] = [];
    Object.entries(state).forEach(([key, presences]) => {
      const meta = Array.isArray(presences) ? presences[0] : (presences as { metas?: { email?: string; name?: string }[] })?.metas?.[0];
      if (meta && key) {
        const email = typeof meta === "object" && meta && "email" in meta ? meta.email : undefined;
        const name = typeof meta === "object" && meta && "name" in meta ? meta.name : undefined;
        list.push({ key, email, name });
      }
    });
    setOnlineUsers((prev) => (list.length > 0 ? list : prev));
  }, []);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: clientIdRef.current,
          enabled: true,
        },
      },
    });

    channel
      .on(
        "broadcast",
        { event: PRESENCE_EVENT },
        ({ payload }: { payload: PresencePayload }) => {
          const { clientId: otherId, rowId, email, name } = payload;
          if (otherId === clientIdRef.current) return;

          clientToRowRef.current.set(otherId, { rowId, email, name });
          const rowIds = new Set<string>();
          const rowToUser = new Map<string, EditingUser>();
          clientToRowRef.current.forEach((v) => {
            if (v.rowId) {
              rowIds.add(v.rowId);
              rowToUser.set(v.rowId, { email: v.email, name: v.name });
            }
          });
          setEditingByOthers(rowIds);
          setEditingByUser(rowToUser);
        }
      )
      .on("presence", { event: "sync" }, () => updateOnlineFromState(channel))
      .on("presence", { event: "join" }, () => updateOnlineFromState(channel))
      .on("presence", { event: "leave" }, () => updateOnlineFromState(channel))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
          await channel.track({
            clientId: clientIdRef.current,
            email: userEmail ?? undefined,
            name: userName ?? undefined,
            user_id: userId ?? undefined,
          }).catch(() => null);

          setOnlineUsers((prev) => {
            const me: OnlineUser = {
              key: clientIdRef.current,
              email: userEmail ?? undefined,
              name: userName ?? undefined,
            };
            if (prev.some((u) => u.key === me.key)) return prev;
            return [me, ...prev];
          });
          setTimeout(() => updateOnlineFromState(channel), 80);
          setTimeout(() => updateOnlineFromState(channel), 350);
        }
      });

    return () => {
      channelRef.current = null;
      channel.untrack().finally(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [clientId, userEmail, userName, userId, updateOnlineFromState]);

  return {
    editingByOthers,
    editingByUser,
    onlineUsers,
    setEditingRow,
    clientId,
  };
}
