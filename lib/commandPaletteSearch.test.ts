import { describe, expect, it } from "vitest";
import {
  buildCommandPaletteTaskHref,
  buildIlikePattern,
  buildPostgrestOrIlikeFilter,
  escapePostgrestIlike,
  shouldRunCommandPaletteSearch,
  truncatePaletteLabel,
  COMMAND_PALETTE_MIN_SEARCH_LENGTH,
} from "@/lib/commandPaletteSearch";

describe("commandPaletteSearch helpers", () => {
  it("requires minimum query length", () => {
    expect(COMMAND_PALETTE_MIN_SEARCH_LENGTH).toBe(2);
    expect(shouldRunCommandPaletteSearch("")).toBe(false);
    expect(shouldRunCommandPaletteSearch("a")).toBe(false);
    expect(shouldRunCommandPaletteSearch("ab")).toBe(true);
    expect(shouldRunCommandPaletteSearch("  xy ")).toBe(true);
  });

  it("escapes ilike wildcards", () => {
    expect(escapePostgrestIlike("100%")).toBe("100\\%");
    expect(escapePostgrestIlike("a_b")).toBe("a\\_b");
    expect(buildIlikePattern("foo%bar")).toBe("%foo\\%bar%");
  });

  it("builds postgrest or filter with quoted pattern", () => {
    const filter = buildPostgrestOrIlikeFilter(["name", "description"], "%test%");
    expect(filter).toBe('name.ilike."%test%",description.ilike."%test%"');
  });

  it("builds task deep links", () => {
    expect(buildCommandPaletteTaskHref({ id: "t1" })).toBe("/canli-tablo?task=t1");
    expect(buildCommandPaletteTaskHref({ id: "t1", project_id: "p9" })).toBe(
      "/canli-tablo?project=p9&task=t1"
    );
  });

  it("truncates long labels", () => {
    const long = "a".repeat(80);
    expect(truncatePaletteLabel(long, 72)).toHaveLength(72);
    expect(truncatePaletteLabel(long, 72).endsWith("…")).toBe(true);
  });
});
