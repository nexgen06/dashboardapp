import { describe, expect, it } from "vitest";
import { computeProjectScoreRows, summarizeProjectScoreRows } from "./projectScoreboard";
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

describe("computeProjectScoreRows", () => {
  it("atanmamış görevleri atlar", () => {
    const rows = computeProjectScoreRows([task({ id: "1", assignee: null })]);
    expect(rows).toHaveLength(0);
  });

  it("tamamlanan görev skorunu artırır", () => {
    const rows = computeProjectScoreRows([
      task({ id: "1", assignee: "a@x.com", status: "Tamamlandı", updated_at: new Date().toISOString() }),
    ]);
    expect(rows[0]?.score).toBe(16);
    expect(rows[0]?.done).toBe(1);
  });

  it("gecikmiş açık görev skoru düşürür", () => {
    const rows = computeProjectScoreRows([
      task({
        id: "1",
        assignee: "a@x.com",
        status: "Devam ediyor",
        due_date: "2020-01-01",
      }),
    ]);
    expect(rows[0]?.score).toBe(-4);
    expect(rows[0]?.overdueOpen).toBe(1);
  });
});

describe("summarizeProjectScoreRows", () => {
  it("ortalama ve lideri hesaplar", () => {
    const rows = computeProjectScoreRows([
      task({ id: "1", assignee: "a@x.com", status: "Tamamlandı", updated_at: new Date().toISOString() }),
      task({ id: "2", assignee: "b@x.com", status: "Yapılacak" }),
    ]);
    const summary = summarizeProjectScoreRows(rows);
    expect(summary.teamCount).toBe(2);
    expect(summary.leader?.assignee).toBe("a@x.com");
    expect(summary.averageScore).toBe(8);
  });
});
