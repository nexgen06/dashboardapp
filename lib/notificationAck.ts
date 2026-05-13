/** Bildirim çanında görülen (türetilmiş) öğeler: panel açıldığında anlık durum burada saklanır. */

export type DerivedNotificationAck = {
  projectIds: string[];
  taskIds: string[];
  overdueTaskIds: string[];
};

const STORAGE_PREFIX = "notif_derived_ack_v1_";

export function loadDerivedNotificationAck(userId: string): DerivedNotificationAck {
  if (typeof window === "undefined") {
    return { projectIds: [], taskIds: [], overdueTaskIds: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return { projectIds: [], taskIds: [], overdueTaskIds: [] };
    const p = JSON.parse(raw) as Partial<DerivedNotificationAck>;
    return {
      projectIds: Array.isArray(p.projectIds) ? p.projectIds.map(String) : [],
      taskIds: Array.isArray(p.taskIds) ? p.taskIds.map(String) : [],
      overdueTaskIds: Array.isArray(p.overdueTaskIds) ? p.overdueTaskIds.map(String) : [],
    };
  } catch {
    return { projectIds: [], taskIds: [], overdueTaskIds: [] };
  }
}

export function saveDerivedNotificationAck(userId: string, ack: DerivedNotificationAck): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_PREFIX + userId,
      JSON.stringify({
        projectIds: Array.from(new Set(ack.projectIds)).sort(),
        taskIds: Array.from(new Set(ack.taskIds)).sort(),
        overdueTaskIds: Array.from(new Set(ack.overdueTaskIds)).sort(),
      })
    );
  } catch (e) {
    console.warn("[notificationAck] save failed", e);
  }
}
