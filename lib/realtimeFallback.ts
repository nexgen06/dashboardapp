export const REALTIME_SUBSCRIBE_TIMEOUT_MS = 15_000;
export const TASKS_FALLBACK_POLL_MS = 12_000;
export const PROJECTS_FALLBACK_POLL_MS = 20_000;
export const COMMENTS_FALLBACK_POLL_MS = 15_000;
export const CHAT_FALLBACK_POLL_MS = 10_000;
export const CHAT_UNREAD_FALLBACK_POLL_MS = 20_000;
export const ADMIN_ALERTS_FALLBACK_POLL_MS = 30_000;
export const NOTIFICATIONS_FALLBACK_POLL_MS = 15_000;
export const TASK_COUNT_FALLBACK_POLL_MS = 20_000;
export const ACTIVITY_FALLBACK_POLL_MS = 30_000;
export const SETTINGS_FALLBACK_POLL_MS = 60_000;
export const PRESENCE_HEARTBEAT_WRITE_MS = 25_000;
export const PRESENCE_HEARTBEAT_READ_MS = 15_000;

export function isRealtimeDisabledForClient(): boolean {
  return String(process.env.NEXT_PUBLIC_DISABLE_REALTIME ?? "").trim().toLowerCase() === "true";
}

export function shouldPollInBrowser(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}
