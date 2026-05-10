/**
 * Tarayıcı bildirimi (Notification API) — Web Push / servis worker değil;
 * kullanıcı izni olmadan çalışmaz.
 */
export function notificationApiAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!notificationApiAvailable()) return null;
  return Notification.permission;
}

/** `default` durumunda izin penceresini açar (mümkünse tıklama ile çağırın). granted / denied ise tekrar sormaz. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationApiAvailable()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const r = await Notification.requestPermission();
    return r === "granted";
  } catch {
    return false;
  }
}
