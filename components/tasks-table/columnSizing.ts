import type { ColumnSizingState } from "@tanstack/react-table";
import type { LiveTableDensity } from "@/contexts/settings-context";
import type { Task } from "@/types/tasks";
import {
  COLUMN_SIZE_BOUNDS,
  COLUMN_VISIBILITY_LABELS,
  DEFAULT_EXTRA_BOUNDS,
  LIVE_TABLE_GHOST_ACTIONS_RAIL_WIDTH,
  LIVE_TABLE_SELECT_COLUMN_WIDTH,
} from "@/components/tasks-table/constants";

function charPxForDensity(d: LiveTableDensity): number {
  if (d === "compact") return 7;
  if (d === "comfortable") return 9;
  return 8;
}

function paddingForDensity(d: LiveTableDensity): number {
  if (d === "compact") return 28;
  if (d === "comfortable") return 40;
  return 32;
}

function getColumnSizeBounds(columnId: string): { min: number; max: number } | null {
  const b = COLUMN_SIZE_BOUNDS[columnId];
  if (b) return b;
  if (columnId.startsWith("extra:")) return DEFAULT_EXTRA_BOUNDS;
  return null;
}

function getCellTextLength(columnId: string, task: Task): number {
  if (columnId === "select" || columnId === "actions") return 0;
  if (columnId === "status") return String(task.status ?? "").length;
  if (columnId === "content") return String(task.content ?? "—").length;
  if (columnId.startsWith("extra:")) {
    const key = columnId.replace(/^extra:/, "");
    return String(task.extra_data?.[key] ?? "—").length;
  }
  return 0;
}

function effectiveCharLengthForSizing(columnId: string, tasks: Task[], headerLen: number): number {
  if (columnId === "select" || columnId === "actions") {
    return Math.max(headerLen, columnId === "select" ? 4 : 6);
  }
  const lens: number[] = [];
  for (const t of tasks) lens.push(getCellTextLength(columnId, t));
  lens.sort((a, b) => a - b);
  if (lens.length === 0) return Math.max(headerLen, 8);

  const pick = (q: number) => lens[Math.min(lens.length - 1, Math.floor((lens.length - 1) * q))];

  if (columnId === "content") {
    const p90 = pick(0.9);
    const pMax = lens[lens.length - 1];
    const blended = Math.round(p90 * 0.82 + Math.min(pMax, p90 * 2.2) * 0.18);
    return Math.max(headerLen, Math.min(blended, Math.max(headerLen + 12, pMax)));
  }
  if (columnId.startsWith("extra:")) {
    const p85 = pick(0.85);
    return Math.max(headerLen, p85);
  }
  if (columnId === "status") {
    return Math.max(headerLen, lens[lens.length - 1]);
  }
  return headerLen;
}

export function measureIntrinsicColumnWidths(
  filteredData: Task[],
  visibleColumnIds: string[],
  density: LiveTableDensity
): ColumnSizingState {
  const charPx = charPxForDensity(density);
  const pad = paddingForDensity(density);
  const next: ColumnSizingState = {};
  for (const id of visibleColumnIds) {
    if (id === "select") {
      next[id] = LIVE_TABLE_SELECT_COLUMN_WIDTH;
      continue;
    }
    if (id === "actions") {
      next[id] = LIVE_TABLE_GHOST_ACTIONS_RAIL_WIDTH;
      continue;
    }
    const bounds = getColumnSizeBounds(id);
    if (!bounds) continue;
    const headerLabel =
      COLUMN_VISIBILITY_LABELS[id] ?? (id.startsWith("extra:") ? id.replace(/^extra:/, "") : id);
    const effLen = effectiveCharLengthForSizing(id, filteredData, headerLabel.length);
    next[id] = Math.min(bounds.max, Math.max(bounds.min, effLen * charPx + pad));
  }
  return next;
}

function growPriorityForBalance(id: string): number {
  if (id === "content") return 4;
  if (id.startsWith("extra:")) return 3;
  if (id === "status") return 2;
  if (id === "actions") return 1;
  return 0;
}

function shrinkPriorityForBalance(id: string): number {
  if (id === "content") return 0;
  if (id.startsWith("extra:")) return 1;
  if (id === "status") return 2;
  if (id === "actions") return 3;
  return 4;
}

function sumSizedColumns(orderedIds: string[], w: Record<string, number>): number {
  return orderedIds.reduce((s, id) => s + (w[id] ?? 0), 0);
}

function balanceColumnWidthsToTarget(
  intrinsic: Record<string, number>,
  orderedIds: string[],
  target: number
): Record<string, number> {
  const w: Record<string, number> = {};
  for (const id of orderedIds) {
    const b = getColumnSizeBounds(id);
    if (!b) continue;
    const x = intrinsic[id] ?? b.min;
    w[id] = Math.min(b.max, Math.max(b.min, x));
  }
  let sum = sumSizedColumns(orderedIds, w);
  if (sum <= 0) return w;

  if (sum > target) {
    const scale = target / sum;
    for (const id of orderedIds) {
      const b = getColumnSizeBounds(id);
      if (!b) continue;
      w[id] = Math.max(b.min, Math.floor(w[id] * scale));
    }
    sum = sumSizedColumns(orderedIds, w);
    let guard = 0;
    while (sum > target && guard++ < 4000) {
      const candidates = orderedIds.filter((id) => {
        const b = getColumnSizeBounds(id);
        return b != null && w[id] > b.min;
      });
      if (candidates.length === 0) break;
      candidates.sort(
        (a, b) => shrinkPriorityForBalance(a) - shrinkPriorityForBalance(b) || w[b] - w[a]
      );
      w[candidates[0]] -= 1;
      sum -= 1;
    }
  } else if (sum < target) {
    const scale = target / sum;
    for (const id of orderedIds) {
      const b = getColumnSizeBounds(id);
      if (!b) continue;
      w[id] = Math.min(b.max, Math.max(b.min, Math.round(w[id] * scale)));
    }
    sum = sumSizedColumns(orderedIds, w);
    let guard = 0;
    while (sum < target && guard++ < 4000) {
      const candidates = orderedIds.filter((id) => {
        const b = getColumnSizeBounds(id);
        return b != null && w[id] < b.max;
      });
      if (candidates.length === 0) break;
      candidates.sort(
        (a, b) => growPriorityForBalance(b) - growPriorityForBalance(a) || w[b] - w[a]
      );
      w[candidates[0]] += 1;
      sum += 1;
    }
  }
  return w;
}

/** Görünür sütunlar + veri + görünüm genişliği ile dengeli ColumnSizingState. */
export function computeBalancedColumnSizing(
  filteredData: Task[],
  visibleColumnIds: string[],
  viewportWidthPx: number,
  density: LiveTableDensity
): ColumnSizingState {
  const intrinsic = measureIntrinsicColumnWidths(filteredData, visibleColumnIds, density);
  const ordered = visibleColumnIds.filter((id) => intrinsic[id] != null);
  if (ordered.length === 0) return {};

  const rawSum = sumSizedColumns(ordered, intrinsic);
  if (viewportWidthPx <= 0 || rawSum <= 0) return intrinsic;

  const target = Math.max(280, Math.floor(viewportWidthPx) - 6);
  if (Math.abs(rawSum - target) <= 2) return intrinsic;

  return balanceColumnWidthsToTarget(intrinsic, ordered, target);
}
