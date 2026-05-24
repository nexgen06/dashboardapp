"use client";

/**
 * Dashboard widget görünürlük tercihleri — localStorage tabanlı, kullanıcı başına.
 *
 * Kapsam: yalnızca tarayıcı; sunucuya yansımaz. Birden fazla cihaz arasında
 * senkron olmaz — UX kararı: bu hızlı bir kişiselleştirme, server roundtrip
 * gerektirmez. İleride app_settings ile sync eklenebilir.
 *
 * Anahtar: `dashboard_widgets_<userId>` veya `dashboard_widgets_guest`
 * Değer: `Record<WidgetId, boolean>` — true = göster, false = gizle
 */

export type DashboardWidgetId =
  | "welcome" // Hoş geldin bandı (her zaman görünür, gizlenmez)
  | "onboarding" // Başlangıç adımları (otomatik — proje yoksa)
  | "kpi" // Tamamlanma + 4 secondary KPI
  | "status" // Durum dağılımı + grafik
  | "pendingApprovals" // YENİ — onay bekleyen görevler
  | "notificationsSummary" // YENİ — bildirim özeti
  | "recentProjects" // Son projeler
  | "recentTasks"; // Son güncellenen görevler

/** Her widget'ın metadata'sı — UI'da listelemek için. */
export type WidgetMeta = {
  id: DashboardWidgetId;
  label: string;
  description: string;
  /** true → kullanıcı gizleyemez (örn. welcome banner). */
  pinned?: boolean;
};

/** Kullanıcının görebilir/gizleyebilir olduğu widget'lar. `onboarding` listede yok — otomatik. */
export const WIDGET_CATALOG: WidgetMeta[] = [
  { id: "welcome", label: "Hoş geldin bandı", description: "Selamlama ve kişisel içgörü kartları", pinned: true },
  { id: "kpi", label: "Özet KPI'lar", description: "Tamamlanma oranı, toplam proje, görev sayıları" },
  { id: "status", label: "Durum dağılımı", description: "Yapılacak / Devam / Tamamlandı dağılım grafiği" },
  { id: "pendingApprovals", label: "Onay bekleyenler", description: "Workflow akışında onayınızı bekleyen görevler" },
  { id: "notificationsSummary", label: "Bildirim özeti", description: "Son okunmamış bildirimler ve hızlı erişim" },
  { id: "recentTasks", label: "Son aktiviteler", description: "Son güncellenen görevler listesi" },
  { id: "recentProjects", label: "Son projeler", description: "Son güncellenen projeler listesi" },
];

/** Varsayılan durum: her şey görünür. */
export function defaultWidgetVisibility(): Record<DashboardWidgetId, boolean> {
  const v: Record<DashboardWidgetId, boolean> = {} as Record<DashboardWidgetId, boolean>;
  for (const w of WIDGET_CATALOG) v[w.id] = true;
  v.onboarding = true;
  return v;
}

function storageKeyForUser(userId?: string | null): string {
  return `dashboard_widgets_${userId && userId.trim() ? userId : "guest"}`;
}

export function loadDashboardWidgetVisibility(userId?: string | null): Record<DashboardWidgetId, boolean> {
  if (typeof window === "undefined") return defaultWidgetVisibility();
  try {
    const raw = window.localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return defaultWidgetVisibility();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaultWidgetVisibility();
    const base = defaultWidgetVisibility();
    const merged = { ...base };
    for (const w of WIDGET_CATALOG) {
      const v = (parsed as Record<string, unknown>)[w.id];
      if (typeof v === "boolean") merged[w.id] = v;
    }
    // Pinned widget'lar her zaman görünür kalır
    for (const w of WIDGET_CATALOG) {
      if (w.pinned) merged[w.id] = true;
    }
    return merged;
  } catch {
    return defaultWidgetVisibility();
  }
}

export function saveDashboardWidgetVisibility(
  userId: string | null | undefined,
  visibility: Record<DashboardWidgetId, boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKeyForUser(userId), JSON.stringify(visibility));
  } catch {
    // localStorage dolu/disabled — sessizce yok say
  }
}
