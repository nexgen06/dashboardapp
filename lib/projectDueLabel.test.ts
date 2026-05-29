import { describe, expect, it } from "vitest";
import { getProjectDueLabel } from "@/lib/projectDueLabel";

describe("getProjectDueLabel", () => {
  it("tamamlanan projede etiket göstermez", () => {
    expect(getProjectDueLabel({ status: "Tamamlandı", due_date: "2020-01-01" })).toBeNull();
  });

  it("geçmiş tarihte Gecikmiş döner", () => {
    expect(getProjectDueLabel({ status: "Aktif", due_date: "2020-01-01" })).toBe("Gecikmiş");
  });

  it("30 gün içinde Yaklaşan döner", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const iso = soon.toISOString().slice(0, 10);
    expect(getProjectDueLabel({ status: "Aktif", due_date: iso })).toBe("Yaklaşan");
  });
});
