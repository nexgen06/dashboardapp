import { describe, expect, it } from "vitest";
import { normalizeLiveTableColumnVisibility } from "@/lib/liveTableColumnVisibility";

describe("normalizeLiveTableColumnVisibility", () => {
  it("removes select/actions from hidden visibility state", () => {
    expect(
      normalizeLiveTableColumnVisibility({
        select: false,
        actions: false,
        status: false,
        "extra:foo": false,
      })
    ).toEqual({
      status: false,
      "extra:foo": false,
    });
  });

  it("returns empty object for undefined", () => {
    expect(normalizeLiveTableColumnVisibility(undefined)).toEqual({});
  });
});
