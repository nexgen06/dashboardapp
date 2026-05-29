import { describe, expect, it } from "vitest";
import {
  countActiveLiveTableFilters,
  filterLiveTableTasks,
  getSmartFilterCounts,
  taskStatusMatchesToolbarChip,
  type LiveTableFilterInput,
} from "@/lib/liveTableFilters";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return {
    content: "Test görevi",
    status: "Yapılacak",
    assignee: null,
    priority: "Medium",
    project_id: "p1",
    due_date: null,
    extra_data: {},
    ...partial,
  } as Task;
}

function baseFilter(overrides: Partial<LiveTableFilterInput> = {}): LiveTableFilterInput {
  return {
    tasks: [],
    projectLinkedFilter: "tümü",
    projectFilter: [],
    globalSearch: "",
    statusFilter: [],
    assigneeFilter: [],
    dateFrom: "",
    dateTo: "",
    columnFilters: {},
    advancedFilterRules: [],
    ...overrides,
  };
}

describe("taskStatusMatchesToolbarChip", () => {
  it("Devam ediyor chip eşleşmeleri", () => {
    expect(taskStatusMatchesToolbarChip("Devam ediyor", "Devam ediyor")).toBe(true);
    expect(taskStatusMatchesToolbarChip("Sürüyor", "Devam")).toBe(true);
  });

  it("Tamamlandı varyasyonları", () => {
    expect(taskStatusMatchesToolbarChip("Done", "Tamamlandı")).toBe(true);
    expect(taskStatusMatchesToolbarChip("Yapılacak", "Tamamlandı")).toBe(false);
  });
});

describe("filterLiveTableTasks", () => {
  const tasks = [
    task({ id: "1", content: "Alpha", project_id: "p1", status: "Yapılacak", assignee: "a@test.com" }),
    task({ id: "2", content: "Beta", project_id: null, status: "Devam ediyor" }),
    task({ id: "3", content: "Gamma", project_id: "p2", status: "Tamamlandı", assignee: "b@test.com" }),
  ];

  it("proje bağlı filtresi project_id olmayanları çıkarır", () => {
    const result = filterLiveTableTasks(baseFilter({ tasks, projectLinkedFilter: "proje" }));
    expect(result.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("projectFilter seçili projeleri daraltır", () => {
    const result = filterLiveTableTasks(baseFilter({ tasks, projectFilter: ["p1"] }));
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("statusFilter toolbar chip mantığı ile eşleşir", () => {
    const result = filterLiveTableTasks(
      baseFilter({ tasks, statusFilter: ["Devam ediyor"] })
    );
    expect(result.map((t) => t.id)).toEqual(["2"]);
  });

  it("assigneeFilter atanmamış ve e-posta", () => {
    const unassigned = filterLiveTableTasks(baseFilter({ tasks, assigneeFilter: ["__unassigned__"] }));
    expect(unassigned.map((t) => t.id)).toEqual(["2"]);

    const mine = filterLiveTableTasks(baseFilter({ tasks, assigneeFilter: ["a@test.com"] }));
    expect(mine.map((t) => t.id)).toEqual(["1"]);
  });

  it("globalSearch Türkçe içerikte arar", () => {
    const trTasks = [
      task({ id: "10", content: "İstanbul raporu", project_id: "p1" }),
      task({ id: "11", content: "Ankara", project_id: "p1" }),
    ];
    const result = filterLiveTableTasks(baseFilter({ tasks: trTasks, globalSearch: "istanbul" }));
    expect(result.map((t) => t.id)).toEqual(["10"]);
  });

  it("advancedFilterRules AND ile uygulanır", () => {
    const result = filterLiveTableTasks(
      baseFilter({
        tasks,
        advancedFilterRules: [
          { id: "r1", field: "content", op: "contains", value: "a" },
          { id: "r2", field: "status", op: "equals", value: "yapılacak" },
        ],
      })
    );
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });
});

describe("countActiveLiveTableFilters", () => {
  it("aktif filtre sayısını toplar", () => {
    expect(
      countActiveLiveTableFilters({
        globalSearch: "x",
        statusFilter: ["Yapılacak"],
        assigneeFilter: [],
        projectFilter: ["p1"],
        dateFrom: "",
        dateTo: "",
        datePreset: "custom",
        columnFilters: { content: ["a"] },
        activeAdvancedFilterRuleCount: 2,
      })
    ).toBe(6);
  });
});

describe("getSmartFilterCounts", () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const tasks = [
    task({ id: "1", project_id: "p1", due_date: yStr, status: "Yapılacak", assignee: "me@test.com" }),
    task({ id: "2", project_id: "p1", due_date: null, assignee: null, status: "Devam ediyor" }),
    task({ id: "3", project_id: null, due_date: yStr, status: "Yapılacak" }),
  ];

  const projectById = new Map<string, Project>([
    ["p1", { id: "p1", name: "P1", description: "", status: "Aktif", created_at: null, updated_at: null, priority: "High" }],
  ]);

  it("proje kapsamında akıllı sayaçları hesaplar", () => {
    const counts = getSmartFilterCounts({
      tasks,
      projectFilter: [],
      projectById,
      urgentPrioritySet: new Set(["high"]),
      currentUserEmail: "me@test.com",
    });
    expect(counts.overdue).toBe(1);
    expect(counts.mine).toBe(1);
    expect(counts.unassigned).toBe(1);
    expect(counts.priority).toBeGreaterThanOrEqual(1);
  });
});
