import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIVE_TABLE_COLUMN_PINNING,
  normalizeLiveTableColumnPinning,
} from "@/lib/liveTableColumnPinning";

describe("liveTableColumnPinning", () => {
  it("keeps select/actions rails in default pinning", () => {
    expect(DEFAULT_LIVE_TABLE_COLUMN_PINNING.left).toContain("select");
    expect(DEFAULT_LIVE_TABLE_COLUMN_PINNING.right).toContain("actions");
  });

  it("re-adds select/actions when saved pinning cleared them", () => {
    expect(
      normalizeLiveTableColumnPinning({ left: ["status"], right: [] }, [
        "select",
        "status",
        "actions",
      ])
    ).toEqual({
      left: ["select", "status"],
      right: ["actions"],
    });
  });

  it("drops unknown column ids after import schema change", () => {
    expect(
      normalizeLiveTableColumnPinning(
        { left: ["select", "extra:removed"], right: ["actions"] },
        ["select", "status", "actions"]
      )
    ).toEqual({
      left: ["select"],
      right: ["actions"],
    });
  });
});
