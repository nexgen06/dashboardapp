import type { CSSProperties } from "react";
import type { Column, ColumnPinningState } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";

/** Seçim + işlem rayı her zaman sabit kalır. */
export const DEFAULT_LIVE_TABLE_COLUMN_PINNING: ColumnPinningState = {
  left: ["select"],
  right: ["actions"],
};

export function normalizeLiveTableColumnPinning(
  pinning: ColumnPinningState | undefined,
  allowedColumnIds?: string[]
): ColumnPinningState {
  const allowed = allowedColumnIds?.length ? new Set(allowedColumnIds) : null;
  const filterIds = (ids: string[]) => (allowed ? ids.filter((id) => allowed.has(id)) : ids);

  const left = filterIds([...(pinning?.left ?? DEFAULT_LIVE_TABLE_COLUMN_PINNING.left ?? [])]);
  const right = filterIds([...(pinning?.right ?? DEFAULT_LIVE_TABLE_COLUMN_PINNING.right ?? [])]);

  if ((!allowed || allowed.has("select")) && !left.includes("select")) {
    left.unshift("select");
  }
  if ((!allowed || allowed.has("actions")) && !right.includes("actions")) {
    right.push("actions");
  }

  return {
    left: Array.from(new Set(left)),
    right: Array.from(new Set(right)),
  };
}

export function isLiveTableStickyLeft(column: Column<Task, unknown>): boolean {
  return column.id === "select" || column.getIsPinned() === "left";
}

export function isLiveTableStickyRight(column: Column<Task, unknown>): boolean {
  return column.id === "actions" || column.getIsPinned() === "right";
}

/** TanStack pinning offset — çoklu sol/sağ sabit sütunlar üst üste binmesin. */
export function liveTableStickyCellStyle(column: Column<Task, unknown>): CSSProperties {
  if (column.id === "select") {
    return { left: 0 };
  }
  if (column.id === "actions") {
    return { right: 0 };
  }
  const style: CSSProperties = {};
  if (isLiveTableStickyLeft(column)) {
    style.left = column.getStart("left");
  }
  if (isLiveTableStickyRight(column)) {
    style.right = column.getAfter("right");
  }
  return style;
}
