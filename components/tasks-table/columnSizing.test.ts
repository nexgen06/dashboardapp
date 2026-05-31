import { describe, expect, it } from "vitest";
import type { Task } from "@/types/tasks";
import { computeBalancedColumnSizing } from "@/components/tasks-table/columnSizing";

const emptyTasks: Task[] = [];

describe("computeBalancedColumnSizing", () => {
  it("preserves intrinsic widths when sum exceeds viewport (imported wide tables)", () => {
    const visibleIds = [
      "select",
      "status",
      "content",
      ...Array.from({ length: 12 }, (_, i) => `extra:col${i}`),
      "actions",
    ];
    const sized = computeBalancedColumnSizing(emptyTasks, visibleIds, 1200, "normal");
    const sum = visibleIds.reduce((s, id) => s + (sized[id] ?? 0), 0);
    expect(sum).toBeGreaterThan(1200);
    expect(sized.select).toBe(24);
    expect(sized.actions).toBe(24);
  });
});
