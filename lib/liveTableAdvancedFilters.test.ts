import { describe, expect, it } from "vitest";
import {
  advancedFilterRuleIsActive,
  generateAdvancedFilterRuleId,
  getTaskFieldValueForFilter,
  taskMatchesAdvancedRule,
  type AdvancedFilterRule,
} from "@/lib/liveTableAdvancedFilters";
import type { Task } from "@/types/tasks";

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return {
    content: "Görev metni",
    status: "Devam ediyor",
    assignee: "user@example.com",
    priority: "High",
    due_date: "2026-06-01",
    project_id: "p1",
    extra_data: { Risk: "Orta" },
    ...partial,
  } as Task;
}

function rule(partial: Partial<AdvancedFilterRule> & Pick<AdvancedFilterRule, "op">): AdvancedFilterRule {
  return {
    id: "r1",
    field: "content",
    value: "",
    ...partial,
  };
}

describe("advancedFilterRuleIsActive", () => {
  it("is_empty / is_not_empty değer gerektirmez", () => {
    expect(advancedFilterRuleIsActive(rule({ op: "is_empty", value: "" }))).toBe(true);
    expect(advancedFilterRuleIsActive(rule({ op: "is_not_empty", value: "  " }))).toBe(true);
  });

  it("diğer operatörler boş value ile pasif", () => {
    expect(advancedFilterRuleIsActive(rule({ op: "contains", value: "" }))).toBe(false);
    expect(advancedFilterRuleIsActive(rule({ op: "equals", value: "  " }))).toBe(false);
  });
});

describe("getTaskFieldValueForFilter", () => {
  const t = task({ id: "1" });

  it("standart alanları okur", () => {
    expect(getTaskFieldValueForFilter(t, "content")).toBe("Görev metni");
    expect(getTaskFieldValueForFilter(t, "status")).toBe("Devam ediyor");
    expect(getTaskFieldValueForFilter(t, "assignee")).toBe("user@example.com");
  });

  it("extra: prefix ile extra_data okur", () => {
    expect(getTaskFieldValueForFilter(t, "extra:Risk")).toBe("Orta");
    expect(getTaskFieldValueForFilter(task({ id: "2", extra_data: {} }), "extra:Yok")).toBe("");
  });
});

describe("taskMatchesAdvancedRule", () => {
  const t = task({ id: "1", content: "Acil rapor hazırla" });

  it("contains / not_contains", () => {
    expect(taskMatchesAdvancedRule(t, rule({ op: "contains", value: "rapor" }))).toBe(true);
    expect(taskMatchesAdvancedRule(t, rule({ op: "contains", value: "xyz" }))).toBe(false);
    expect(taskMatchesAdvancedRule(t, rule({ op: "not_contains", value: "xyz" }))).toBe(true);
  });

  it("equals / not_equals büyük-küçük harf duyarsız", () => {
    expect(taskMatchesAdvancedRule(t, rule({ op: "equals", value: "ACİL RAPOR HAZIRLA" }))).toBe(false);
    expect(
      taskMatchesAdvancedRule(
        task({ id: "2", status: "Tamamlandı" }),
        rule({ field: "status", op: "equals", value: "tamamlandı" })
      )
    ).toBe(true);
  });

  it("starts_with / ends_with", () => {
    expect(taskMatchesAdvancedRule(t, rule({ op: "starts_with", value: "acil" }))).toBe(true);
    expect(taskMatchesAdvancedRule(t, rule({ op: "ends_with", value: "hazırla" }))).toBe(true);
  });

  it("is_empty / is_not_empty", () => {
    expect(
      taskMatchesAdvancedRule(task({ id: "3", assignee: null }), rule({ field: "assignee", op: "is_empty", value: "" }))
    ).toBe(true);
    expect(
      taskMatchesAdvancedRule(t, rule({ field: "assignee", op: "is_not_empty", value: "" }))
    ).toBe(true);
  });
});

describe("generateAdvancedFilterRuleId", () => {
  it("benzersiz id üretir", () => {
    const a = generateAdvancedFilterRuleId();
    const b = generateAdvancedFilterRuleId();
    expect(a).toMatch(/^afr-/);
    expect(a).not.toBe(b);
  });
});
