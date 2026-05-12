import type { RealtimeChannel } from "@supabase/supabase-js";

export type OnlineUser = {
  key: string;
  email?: string;
  name?: string;
};

/**
 * Supabase Presence `config.presence.key` için tarayıcıda üretilen benzersiz ID.
 * SSR ile paylaşılan sabit anahtar kullanılmaz (bkz. usePresence / useProjectPresence yorumları).
 */
export function createBrowserClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `client-${crypto.randomUUID()}`;
  }
  return `client-${Math.random().toString(36).slice(2, 11)}-${Date.now().toString(36)}`;
}

/** Kanaldaki presence state → çevrimiçi satırlar (çoklu meta / sekmeler dahil). */
export function onlineUsersFromPresenceState(ch: RealtimeChannel): OnlineUser[] {
  const state = ch.presenceState<Record<string, unknown>>();
  const list: OnlineUser[] = [];
  for (const key of Object.keys(state)) {
    if (!key) continue;
    const entry = state[key];
    let metas: unknown[] = [];
    if (Array.isArray(entry)) {
      metas = entry;
    } else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      if (Array.isArray(o.metas)) {
        metas = o.metas;
      } else if (
        typeof o.email === "string" ||
        typeof o.name === "string" ||
        typeof o.clientId === "string" ||
        typeof o.sessionId === "string" ||
        typeof o.user_id === "string"
      ) {
        metas = [entry];
      }
    }
    metas.forEach((raw, idx) => {
      if (!raw || typeof raw !== "object") return;
      const m = raw as Record<string, unknown>;
      const email = typeof m.email === "string" ? m.email : undefined;
      const name = typeof m.name === "string" ? m.name : undefined;
      const ref =
        typeof m.presence_ref === "string" ? m.presence_ref : String(idx);
      const rowKey = metas.length > 1 ? `${key}:${ref}` : key;
      list.push({ key: rowKey, email, name });
    });
  }
  return list;
}
