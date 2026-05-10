"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  createBrowserClientId,
  onlineUsersFromPresenceState,
  type OnlineUser,
} from "@/lib/supabasePresenceHelpers";

export type { OnlineUser };

const PRESENCE_CHANNEL = "tasks-presence";
const PRESENCE_EVENT = "editing";

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
  /** Başka oturumların o an düzenlediği görev satırları (kendi oturumunuz dahil değil). */
  const [editorsByRowId, setEditorsByRowId] = useState<Map<string, EditingUser[]>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const clientIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientToRowRef = useRef<Map<string, { rowId: string | null; email?: string; name?: string }>>(new Map());

  const setEditingRow = useCallback(
    (rowId: string | null) => {
      const ch = channelRef.current;
      const cid = clientIdRef.current;
      if (!ch || !cid) return;
      const payload: PresencePayload = {
        clientId: cid,
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
    const list = onlineUsersFromPresenceState(ch);
    setOnlineUsers((prev) => (list.length > 0 ? list : prev));
  }, []);

  useEffect(() => {
    const myClientId = createBrowserClientId();
    clientIdRef.current = myClientId;

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: myClientId,
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
          if (otherId === myClientId) return;

          clientToRowRef.current.set(otherId, { rowId, email, name });

          const rowToEditors = new Map<string, EditingUser[]>();
          clientToRowRef.current.forEach((v) => {
            if (!v.rowId) return;
            const list = rowToEditors.get(v.rowId) ?? [];
            list.push({ email: v.email, name: v.name });
            rowToEditors.set(v.rowId, list);
          });

          // Aynı satırda iki kişi: Map tek değer tutmasın diye dizi; aynı e-posta (iki sekme) tekilleştirilir.
          rowToEditors.forEach((list, rid) => {
            const seen = new Set<string>();
            const deduped: EditingUser[] = [];
            for (const e of list) {
              const k = (e.email ?? e.name ?? "").trim().toLowerCase();
              if (!k || seen.has(k)) continue;
              seen.add(k);
              deduped.push(e);
            }
            rowToEditors.set(rid, deduped);
          });

          setEditorsByRowId(rowToEditors);
        }
      )
      .on("presence", { event: "sync" }, () => updateOnlineFromState(channel))
      .on("presence", { event: "join" }, () => {
        updateOnlineFromState(channel);
        setTimeout(() => updateOnlineFromState(channel), 120);
      })
      .on("presence", { event: "leave" }, () => {
        updateOnlineFromState(channel);
        setTimeout(() => updateOnlineFromState(channel), 120);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          channelRef.current = channel;
          await channel
            .track({
              clientId: myClientId,
              email: userEmail ?? undefined,
              name: userName ?? undefined,
              user_id: userId ?? undefined,
            })
            .catch(() => null);

          setOnlineUsers((prev) => {
            const me: OnlineUser = {
              key: myClientId,
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

    const intervalMs = 3000;
    const intervalId = setInterval(() => {
      if (channelRef.current) updateOnlineFromState(channelRef.current);
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      channelRef.current = null;
      clientIdRef.current = null;
      channel.untrack().finally(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [userEmail, userName, userId, updateOnlineFromState]);

  return {
    /** rowId -> başka oturumların düzenleyicileri (aynı satırda birden fazla kişi olabilir) */
    editorsByRowId,
    onlineUsers,
    setEditingRow,
    clientId: clientIdRef.current ?? "",
  };
}
