import { describe, expect, it } from "vitest";
import { explainProjectHealth, computeProjectHealth } from "@/lib/projectHealth";
import { filterProjectTasks } from "@/lib/projectDetailPageHelpers";
import type { Task } from "@/types/tasks";

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return {
    content: "",
    status: "Yapılacak",
    assignee: null,
    priority: "Medium",
    project_id: "p1",
    extra_data: {},
    ...partial,
  } as Task;
}

describe("explainProjectHealth", () => {
  it("İyi durumda olumlu maddeler döner", () => {
    const explanation = explainProjectHealth({
      total: 10,
      done: 6,
      completionPct: 60,
      overdue: 0,
      dueToday: 2,
      unassigned: 1,
    });
    expect(explanation.status).toBe("İyi");
    expect(explanation.positives.some((p) => p.includes("Gecikmiş"))).toBe(true);
  });

  it("5+ gecikmiş görevde Dikkat ve neden açıklar", () => {
    const kpis = { total: 20, done: 5, completionPct: 25, overdue: 6, dueToday: 0, unassigned: 2 };
    expect(computeProjectHealth(kpis)).toBe("Dikkat");
    const explanation = explainProjectHealth(kpis);
    expect(explanation.reasons.some((r) => r.includes("6 gecikmiş"))).toBe(true);
  });

  it("yüksek atanmamış oranında Orta der", () => {
    const kpis = { total: 4, done: 1, completionPct: 25, overdue: 0, dueToday: 0, unassigned: 2 };
    expect(computeProjectHealth(kpis)).toBe("Orta");
    const explanation = explainProjectHealth(kpis);
    expect(explanation.reasons.some((r) => r.includes("atanmamış"))).toBe(true);
  });
});

describe("filterProjectTasks", () => {
  const tasks = [
    task({ id: "1", assignee: "a@x.com", status: "Yapılacak", due_date: "2020-01-01" }),
    task({ id: "2", assignee: "b@x.com", status: "Tamamlandı", due_date: "2020-01-01" }),
    task({ id: "3", assignee: null, status: "Devam ediyor" }),
  ];

  it("atanana göre filtreler", () => {
    const result = filterProjectTasks(tasks, { assignee: "a@x.com", status: "all", date: "all" });
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("atanmamış filtresi", () => {
    const result = filterProjectTasks(tasks, { assignee: "__unassigned__", status: "all", date: "all" });
    expect(result.map((t) => t.id)).toEqual(["3"]);
  });

  it("duruma göre filtreler", () => {
    const result = filterProjectTasks(tasks, { assignee: "all", status: "Tamamlandı", date: "all" });
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("gecikmiş filtresi tamamlananları hariç tutar", () => {
    const result = filterProjectTasks(tasks, { assignee: "all", status: "all", date: "overdue" });
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });
});
