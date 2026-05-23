"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { removeRealtimeChannelsByTopic } from "@/lib/removeRealtimeChannelTopic";
import { listPresenceHeartbeats, upsertPresenceHeartbeat } from "@/lib/presenceHeartbeat";
import {
  PRESENCE_HEARTBEAT_READ_MS,
  PRESENCE_HEARTBEAT_WRITE_MS,
  isRealtimeDisabledForClient,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
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

export function usePresence(options: UsePresenceOptions = {}) {
  const { userEmail, userName, userId } = options;
  const optsRef = useRef(options);
  optsRef.current = options;

  const [editorsByRowId, setEditorsByRowId] = useState<Map<string, EditingUser[]>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const clientIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const clientToRowRef = useRef<Map<string, { rowId: string | null; email?: string; name?: string }>>(new Map());
  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const editingRowRef = useRef<string | null>(null);

  const setEditingRow = useCallback((rowId: string | null) => {
    editingRowRef.current = rowId;
    const ch = channelRef.current;
    const cid = clientIdRef.current;
    const o = optsRef.current;
    void upsertPresenceHeartbeat({
      scope: "tasks",
      rowId,
      clientId: cid,
      userId: o.userId,
      userEmail: o.userEmail,
      userName: o.userName,
    });
    if (!ch || !cid) return;
    const payload: PresencePayload = {
      clientId: cid,
      rowId,
      email: o.userEmail ?? undefined,
      name: o.userName ?? undefined,
    };
    void ch.send({ type: "broadcast", event: PRESENCE_EVENT, payload }).catch(() => {});
  }, []);

  const updateOnlineFromState = useCallback((ch: RealtimeChannel) => {
    if (!subscribedRef.current) return;
    const o = optsRef.current;
    const list = onlineUsersFromPresenceState(ch);
    const cid = clientIdRef.current;
    let next = list;
    if (cid) {
      const hasSelf = next.some((entry) => entry.key === cid || entry.key.startsWith(`${cid}:`));
      if (!hasSelf) {
        next = [{ key: cid, email: o.userEmail ?? undefined, name: o.userName ?? undefined }, ...list];
      }
    }
    setOnlineUsers(
      next.length > 0 ? next : cid ? [{ key: cid, email: o.userEmail ?? undefined, name: o.userName ?? undefined }] : []
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const myClientId = createBrowserClientId();
    clientIdRef.current = myClientId;
    subscribedRef.current = false;
    activeChannelRef.current = null;
    clientToRowRef.current = new Map();

    const intervalId = setInterval(() => {
      if (channelRef.current) updateOnlineFromState(channelRef.current);
    }, 3000);

    if (isRealtimeDisabledForClient()) {
      return () => {
        clearInterval(intervalId);
        subscribedRef.current = false;
        channelRef.current = null;
        clientIdRef.current = null;
        setEditorsByRowId(new Map());
      };
    }

    void (async () => {
      try {
        await removeRealtimeChannelsByTopic(supabase, PRESENCE_CHANNEL);
      } catch {
        /* yok say */
      }
      if (cancelled) return;

      const channel = supabase.channel(PRESENCE_CHANNEL, {
        config: {
          presence: { key: myClientId, enabled: true },
        },
      });
      activeChannelRef.current = channel;

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
        .subscribe(async (status, err) => {
          if (cancelled) return;
          const ok = String(status ?? "").toUpperCase() === "SUBSCRIBED";
          if (ok) {
            subscribedRef.current = true;
            channelRef.current = channel;
            const o = optsRef.current;
            await channel
              .track({
                clientId: myClientId,
                email: o.userEmail ?? undefined,
                name: o.userName ?? undefined,
                user_id: o.userId ?? undefined,
              })
              .catch(() => null);

            setOnlineUsers((prev) => {
              const me: OnlineUser = {
                key: myClientId,
                email: o.userEmail ?? undefined,
                name: o.userName ?? undefined,
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
              console.warn("[Presence] tasks-presence kanalı:", s, err ?? "");
            }
          }
        });
    })();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      subscribedRef.current = false;
      channelRef.current = null;
      clientIdRef.current = null;
      const chToRemove = activeChannelRef.current;
      activeChannelRef.current = null;
      setEditorsByRowId(new Map());
      void (async () => {
        if (chToRemove) {
          try {
            await chToRemove.untrack();
          } catch {
            /* yok say */
          }
          await supabase.removeChannel(chToRemove);
        } else {
          await removeRealtimeChannelsByTopic(supabase, PRESENCE_CHANNEL);
        }
      })();
    };
  }, [updateOnlineFromState]);

  useEffect(() => {
    const ch = channelRef.current;
    const cid = clientIdRef.current;
    if (!ch || !subscribedRef.current || !cid) return;
    void ch
      .track({
        clientId: cid,
        email: userEmail ?? undefined,
        name: userName ?? undefined,
        user_id: userId ?? undefined,
      })
      .catch(() => null);
    updateOnlineFromState(ch);
  }, [userEmail, userName, userId, updateOnlineFromState]);

  useEffect(() => {
    const write = () => {
      const o = optsRef.current;
      void upsertPresenceHeartbeat({
        scope: "tasks",
        rowId: editingRowRef.current,
        clientId: clientIdRef.current,
        userId: o.userId,
        userEmail: o.userEmail,
        userName: o.userName,
      });
    };
    const read = async () => {
      if (!shouldPollInBrowser()) return;
      const fallbackUsers = await listPresenceHeartbeats("tasks");
      if (fallbackUsers.length === 0) return;
      setOnlineUsers((prev) => {
        if (!subscribedRef.current) return fallbackUsers;
        const seen = new Set(prev.map((u) => (u.email ?? u.key).trim().toLowerCase()));
        const merged = [...prev];
        for (const user of fallbackUsers) {
          const key = (user.email ?? user.key).trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(user);
        }
        return merged;
      });
    };
    write();
    void read();
    const writeInterval = window.setInterval(write, PRESENCE_HEARTBEAT_WRITE_MS);
    const readInterval = window.setInterval(() => void read(), PRESENCE_HEARTBEAT_READ_MS);
    return () => {
      window.clearInterval(writeInterval);
      window.clearInterval(readInterval);
    };
  }, []);

  return {
    editorsByRowId,
    onlineUsers,
    setEditingRow,
    clientId: clientIdRef.current ?? "",
  };
}
