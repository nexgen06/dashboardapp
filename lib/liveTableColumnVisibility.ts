import type { VisibilityState } from "@tanstack/react-table";

/** Sol seçim + sağ işlem rayı asla gizlenmez. */
export const LIVE_TABLE_RAIL_COLUMN_IDS = ["select", "actions"] as const;

export function isLiveTableRailColumn(columnId: string): boolean {
  return (LIVE_TABLE_RAIL_COLUMN_IDS as readonly string[]).includes(columnId);
}

/** Kayıtlı görünüm / localStorage select|actions:false içerse sticky raylar kaybolur — temizle. */
export function normalizeLiveTableColumnVisibility(
  visibility: VisibilityState | undefined
): VisibilityState {
  if (!visibility || typeof visibility !== "object") return {};
  let changed = false;
  const next = { ...visibility };
  for (const id of LIVE_TABLE_RAIL_COLUMN_IDS) {
    if (id in next) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : visibility;
}
