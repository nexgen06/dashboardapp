import { describe, expect, it } from "vitest";
import {
  actionLabel,
  defaultCondition,
  operatorLabel,
  toDatetimeLocalInput,
} from "@/lib/automationCenterHelpers";

describe("automationCenterHelpers", () => {
  it("formats datetime-local input", () => {
    expect(toDatetimeLocalInput("2026-05-29T14:30:00.000Z")).toMatch(/^2026-05-29T\d{2}:\d{2}$/);
    expect(toDatetimeLocalInput("")).toBe("");
  });

  it("labels operators", () => {
    expect(operatorLabel("equals")).toBe("eşit");
  });

  it("builds default condition with id", () => {
    const c = defaultCondition({ field: "status", op: "equals", value: "Açık" });
    expect(c.field).toBe("status");
    expect(c.id).toMatch(/^condition-/);
  });

  it("describes notify and color_row actions", () => {
    expect(actionLabel({ actionType: "notify", payload: { title: "Uyarı" } })).toBe("Bildirim: Uyarı");
    expect(actionLabel({ actionType: "color_row", payload: { rowColor: "red" } })).toBe("Satır rengi: red");
  });
});
