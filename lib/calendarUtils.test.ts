import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatDisplayDate,
  isBetweenDaysInclusive,
  parseIsoDateLocal,
  toIsoDateLocal,
} from "@/lib/calendarUtils";

describe("calendarUtils", () => {
  it("round-trips local ISO dates without UTC shift", () => {
    const date = new Date(2026, 4, 29);
    expect(toIsoDateLocal(date)).toBe("2026-05-29");
    expect(parseIsoDateLocal("2026-05-29")?.getDate()).toBe(29);
  });

  it("formats display dates as DD.MM.YYYY", () => {
    expect(formatDisplayDate("2026-05-29")).toBe("29.05.2026");
  });

  it("builds a 42-cell month grid starting on Monday", () => {
    const grid = buildMonthGrid(2026, 4);
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
  });

  it("detects inclusive ranges", () => {
    const from = parseIsoDateLocal("2026-05-10")!;
    const to = parseIsoDateLocal("2026-05-15")!;
    const mid = parseIsoDateLocal("2026-05-12")!;
    expect(isBetweenDaysInclusive(mid, from, to)).toBe(true);
    expect(isBetweenDaysInclusive(from, from, to)).toBe(true);
  });
});
