import { describe, expect, it } from "vitest";
import { normalizeSavedViewGroupingField } from "@/lib/savedViews";

describe("normalizeSavedViewGroupingField", () => {
  it("accepts valid grouping fields", () => {
    expect(normalizeSavedViewGroupingField("status")).toBe("status");
    expect(normalizeSavedViewGroupingField("dueBucket")).toBe("dueBucket");
  });

  it("returns null for empty or unknown values", () => {
    expect(normalizeSavedViewGroupingField(null)).toBeNull();
    expect(normalizeSavedViewGroupingField("")).toBeNull();
    expect(normalizeSavedViewGroupingField("extra:foo")).toBeNull();
  });
});

describe("SavedViewConfig grouping snapshot", () => {
  it("serializes grouping with filters and columns", () => {
    const config = {
      version: 1 as const,
      filters: { statusFilter: ["Devam"] },
      grouping: { field: "assignee" as const },
    };
    expect(JSON.parse(JSON.stringify(config)).grouping.field).toBe("assignee");
  });
});
