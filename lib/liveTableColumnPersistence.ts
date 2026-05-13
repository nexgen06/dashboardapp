import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";

const STORAGE_KEY_PREFIX = "dashboardapp.liveTable.prefs.v1:";

export type LiveTablePersistedPrefs = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
  columnPinning: ColumnPinningState;
  columnSizing: ColumnSizingState;
  sorting: SortingState;
};

const CORE_START = ["select", "status", "content"] as const;
const CORE_END = ["actions"] as const;

export function liveTableStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export function loadLiveTablePrefs(userId: string): LiveTablePersistedPrefs | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(liveTableStorageKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<LiveTablePersistedPrefs>;
    if (!p || typeof p !== "object") return null;

    const left = p.columnPinning?.left;
    const right = p.columnPinning?.right;

    return {
      columnVisibility: p.columnVisibility && typeof p.columnVisibility === "object" ? p.columnVisibility : {},
      columnOrder: Array.isArray(p.columnOrder) ? p.columnOrder : [],
      columnPinning: {
        left: Array.isArray(left) ? left : [],
        right: Array.isArray(right) ? right : [],
      },
      columnSizing: p.columnSizing && typeof p.columnSizing === "object" ? p.columnSizing : {},
      sorting: Array.isArray(p.sorting) && p.sorting.length > 0 ? p.sorting : [{ id: "updated", desc: true }],
    };
  } catch {
    return null;
  }
}

export function saveLiveTablePrefs(userId: string, prefs: LiveTablePersistedPrefs): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(liveTableStorageKey(userId), JSON.stringify(prefs));
  } catch {
    /* depolama dolu / gizli mod */
  }
}

/**
 * Mevcut veya kayıtlı sırayı korur; tabloda yeni görünen extra:* sütunlarını ekler; artık olmayan id'leri atlar.
 */
export function mergeColumnOrderWithDynamics(
  persistedOrCurrent: ColumnOrderState | undefined,
  dynamicIds: string[]
): ColumnOrderState {
  const defaultOrder: ColumnOrderState = [...CORE_START, ...dynamicIds, ...CORE_END];
  const allowed = new Set<string>([...CORE_START, ...CORE_END, ...dynamicIds]);

  if (!persistedOrCurrent?.length) {
    return defaultOrder;
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of persistedOrCurrent) {
    if (allowed.has(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of defaultOrder) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out;
}
