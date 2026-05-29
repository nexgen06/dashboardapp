import { describe, expect, it } from "vitest";
import { isViewProjectDefaultFor } from "@/lib/savedViews";

describe("isViewProjectDefaultFor", () => {
  const base = {
    id: "v1",
    userId: "u1",
    scope: "shared" as const,
    name: "Ekip görünümü",
    description: null,
    target: "live_table",
    config: { version: 1 as const },
    projectId: "p1",
    isProjectDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("proje varsayılanını doğru tanır", () => {
    expect(isViewProjectDefaultFor(base, "p1")).toBe(true);
    expect(isViewProjectDefaultFor(base, "p2")).toBe(false);
  });

  it("isProjectDefault false ise false döner", () => {
    expect(isViewProjectDefaultFor({ ...base, isProjectDefault: false }, "p1")).toBe(false);
  });
});
