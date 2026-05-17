import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { isSensitiveExtraColumnKey } from "@/lib/extraColumnSensitiveDisplay";

const STORAGE_KEY_PREFIX = "dashboardapp.liveTable.prefs.v1:";

/**
 * Kalıcı tutulan Canlı Tablo filtreleri (sayfa yenilemede korunur).
 *
 * NOT persisted: modal açık/kapalı durumu, satır seçimleri, açık dropdown,
 * mutasyon banner'ı, hover state'leri.
 */
export type LiveTablePersistedFilters = {
  globalSearch: string;
  projectLinkedFilter: "proje" | "tümü";
  statusFilter: string[];
  assigneeFilter: string[];
  projectFilter: string[];
  dateFrom: string;
  dateTo: string;
  datePreset: string;
  columnFilters: Record<string, string[]>;
  /** Opaque JSON — caller'da AdvancedFilterRule[] olarak parse edilir. */
  advancedFilterRules: unknown[];
};

export type LiveTablePersistedPrefs = {
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
  columnPinning: ColumnPinningState;
  columnSizing: ColumnSizingState;
  sorting: SortingState;
  filters?: LiveTablePersistedFilters;
};

export const EMPTY_LIVE_TABLE_FILTERS: LiveTablePersistedFilters = {
  globalSearch: "",
  projectLinkedFilter: "proje",
  statusFilter: [],
  assigneeFilter: [],
  projectFilter: [],
  dateFrom: "",
  dateTo: "",
  datePreset: "custom",
  columnFilters: {},
  advancedFilterRules: [],
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
      // Geçersiz/kaldırılmış sütun id'lerini ("updated" gibi) filtrele;
      // boş kalırsa default sort'u uygula
      sorting: Array.isArray(p.sorting)
        ? p.sorting.filter((s) => s && typeof s.id === "string" && s.id !== "updated" && s.id !== "updated_at")
        : [],
      filters: normalizeFilters(p.filters),
    };
  } catch {
    return null;
  }
}

function normalizeFilters(raw: unknown): LiveTablePersistedFilters | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const f = raw as Partial<LiveTablePersistedFilters>;
  const projectLinked = f.projectLinkedFilter === "tümü" || f.projectLinkedFilter === "proje"
    ? f.projectLinkedFilter
    : "proje";
  return {
    globalSearch: typeof f.globalSearch === "string" ? f.globalSearch : "",
    projectLinkedFilter: projectLinked,
    statusFilter: Array.isArray(f.statusFilter) ? f.statusFilter.filter((x): x is string => typeof x === "string") : [],
    assigneeFilter: Array.isArray(f.assigneeFilter) ? f.assigneeFilter.filter((x): x is string => typeof x === "string") : [],
    projectFilter: Array.isArray(f.projectFilter) ? f.projectFilter.filter((x): x is string => typeof x === "string") : [],
    dateFrom: typeof f.dateFrom === "string" ? f.dateFrom : "",
    dateTo: typeof f.dateTo === "string" ? f.dateTo : "",
    datePreset: typeof f.datePreset === "string" ? f.datePreset : "custom",
    columnFilters: f.columnFilters && typeof f.columnFilters === "object" ? (f.columnFilters as Record<string, string[]>) : {},
    advancedFilterRules: Array.isArray(f.advancedFilterRules) ? f.advancedFilterRules : [],
  };
}

/**
 * GIZLILIK: TCKN / sicil / personel no gibi hassas sütunlara uygulanan filtre
 * değerleri localStorage'a yazılmamalı (XSS, browser geçmişi, paylaşılan cihaz
 * gibi senaryolarda sızıntı riski). Persist'ten önce strip ediliyor.
 *
 * `isSensitiveExtraColumnKey` runtime'da `extra:KEY` formatında key bekler;
 * hem ham (`KEY`) hem prefixli (`extra:KEY`) varyantları kontrol edilir.
 */
function stripSensitiveFiltersForStorage(
  prefs: LiveTablePersistedPrefs
): LiveTablePersistedPrefs {
  if (!prefs.filters) return prefs;
  const filters = prefs.filters;
  const safeColumnFilters: Record<string, string[]> = {};
  for (const [colId, values] of Object.entries(filters.columnFilters ?? {})) {
    const key = colId.startsWith("extra:") ? colId.slice("extra:".length) : colId;
    if (!isSensitiveExtraColumnKey(key)) {
      safeColumnFilters[colId] = values;
    }
  }
  const safeAdvancedRules = (filters.advancedFilterRules ?? []).filter((rule) => {
    const r = rule as { field?: unknown };
    const field = typeof r?.field === "string" ? r.field : "";
    const key = field.startsWith("extra:") ? field.slice("extra:".length) : field;
    return !isSensitiveExtraColumnKey(key);
  });
  return {
    ...prefs,
    filters: {
      ...filters,
      columnFilters: safeColumnFilters,
      advancedFilterRules: safeAdvancedRules,
    },
  };
}

export function saveLiveTablePrefs(userId: string, prefs: LiveTablePersistedPrefs): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const safe = stripSensitiveFiltersForStorage(prefs);
    localStorage.setItem(liveTableStorageKey(userId), JSON.stringify(safe));
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
