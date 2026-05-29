import { describe, expect, it } from "vitest";
import {
  buildProjectCardStats,
  computeTaskCompletionByProject,
  filterProjectsList,
} from "@/lib/projectListFilters";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

function project(partial: Partial<Project> & Pick<Project, "id">): Project {
  return {
    name: "P",
    description: "",
    status: "Aktif",
    ...partial,
  } as Project;
}

describe("filterProjectsList", () => {
  const projects = [
    project({ id: "1", name: "Alpha", status: "Aktif", assigned_emails: ["a@test.com"] }),
    project({ id: "2", name: "Beta", status: "Beklemede", assigned_emails: ["b@test.com"] }),
  ];

  it("filters by search and status", () => {
    expect(
      filterProjectsList(projects, {
        search: "alpha",
        statusFilter: "Tümü",
        assignedToMeOnly: false,
        currentUserEmail: "",
        dateFrom: "",
        dateTo: "",
      }).map((p) => p.id)
    ).toEqual(["1"]);

    expect(
      filterProjectsList(projects, {
        search: "",
        statusFilter: "Beklemede",
        assignedToMeOnly: false,
        currentUserEmail: "",
        dateFrom: "",
        dateTo: "",
      }).map((p) => p.id)
    ).toEqual(["2"]);
  });

  it("filters assigned to me", () => {
    expect(
      filterProjectsList(projects, {
        search: "",
        statusFilter: "Tümü",
        assignedToMeOnly: true,
        currentUserEmail: "a@test.com",
        dateFrom: "",
        dateTo: "",
      }).map((p) => p.id)
    ).toEqual(["1"]);
  });
});

describe("computeTaskCompletionByProject", () => {
  it("aggregates done and approved counts", () => {
    const tasks: Task[] = [
      { id: "t1", content: "", status: "Tamamlandı", project_id: "p1", workflow_status: "approved" } as Task,
      { id: "t2", content: "", status: "Devam", project_id: "p1", workflow_status: null } as Task,
    ];
    const map = computeTaskCompletionByProject(tasks);
    expect(map.p1).toEqual({ total: 2, done: 1, approved: 1 });
  });
});

describe("buildProjectCardStats", () => {
  it("uses approved count when workflow enabled", () => {
    const stats = buildProjectCardStats(
      project({ id: "p1", workflow_enabled: true }),
      { p1: { total: 2, done: 1 } },
      { p1: { total: 2, done: 1, approved: 2 } }
    );
    expect(stats.isProjectCompleted).toBe(true);
    expect(stats.taskDone).toBe(2);
  });
});
