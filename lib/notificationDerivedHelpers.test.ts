import { describe, expect, it } from "vitest";
import {
  buildDerivedFallbackBadges,
  buildDerivedNotificationAck,
  buildDerivedUpsertItems,
  filterOverdueTasks,
  filterProjectsAssignedToEmail,
  filterTasksAssignedToEmail,
  taskNotificationHref,
  type NotificationTaskHint,
} from "@/lib/notificationDerivedHelpers";
import type { Project } from "@/types/project";

function project(partial: Partial<Project> & Pick<Project, "id">): Project {
  return {
    name: "P",
    description: "",
    status: "Aktif",
    ...partial,
  } as Project;
}

function task(partial: Partial<NotificationTaskHint> & Pick<NotificationTaskHint, "id">): NotificationTaskHint {
  return {
    content: "Görev",
    assignee: "user@example.com",
    due_date: null,
    project_id: null,
    ...partial,
  };
}

describe("notificationDerivedHelpers", () => {
  it("filters assigned projects and tasks by email", () => {
    const projects = [
      project({ id: "p1", name: "Alpha", assigned_emails: ["User@Example.com"] }),
      project({ id: "p2", assigned_emails: ["other@example.com"] }),
    ];
    const tasks = [
      task({ id: "t1", assignee: "USER@example.com" }),
      task({ id: "t2", assignee: "other@example.com" }),
    ];
    expect(filterProjectsAssignedToEmail(projects, "user@example.com").map((p) => p.id)).toEqual(["p1"]);
    expect(filterTasksAssignedToEmail(tasks, "user@example.com").map((t) => t.id)).toEqual(["t1"]);
  });

  it("detects overdue tasks", () => {
    const tasks = [
      task({ id: "t1", due_date: "2020-01-01" }),
      task({ id: "t2", due_date: "2099-01-01" }),
    ];
    expect(filterOverdueTasks(tasks, "2026-05-29").map((t) => t.id)).toEqual(["t1"]);
  });

  it("builds task href with optional project", () => {
    expect(taskNotificationHref(task({ id: "t1" }))).toBe("/canli-tablo?task=t1");
    expect(taskNotificationHref(task({ id: "t1", project_id: "p9" }))).toBe(
      "/canli-tablo?project=p9&task=t1"
    );
  });

  it("builds ack and upsert items respecting derived ack", () => {
    const projects = [project({ id: "p1", name: "Alpha", assigned_emails: ["user@example.com"] })];
    const tasks = [
      task({ id: "t1", content: "Yeni", due_date: "2020-01-01" }),
      task({ id: "t2", content: "OK", due_date: "2099-01-01" }),
    ];
    const ack = buildDerivedNotificationAck(projects, tasks, "user@example.com");
    expect(ack.projectIds).toEqual(["p1"]);
    expect(ack.taskIds).toEqual(["t1", "t2"]);
    expect(ack.overdueTaskIds).toEqual(["t1"]);

    const upserts = buildDerivedUpsertItems(projects, tasks, "user@example.com", {
      projectIds: [],
      taskIds: [],
      overdueTaskIds: ["t1"],
    });
    expect(upserts.map((i) => i.sourceKey)).toEqual([
      "project_assigned:p1",
      "task_assigned:t1",
      "task_assigned:t2",
    ]);
  });

  it("builds aggregated fallback badges", () => {
    const projects = [
      project({ id: "p1", assigned_emails: ["user@example.com"] }),
      project({ id: "p2", assigned_emails: ["user@example.com"] }),
    ];
    const tasks = [task({ id: "t1" }), task({ id: "t2" })];
    const badges = buildDerivedFallbackBadges(projects, tasks, "user@example.com", {
      projectIds: ["p1"],
      taskIds: [],
      overdueTaskIds: [],
    });
    expect(badges).toEqual([
      { type: "project_assigned", label: "Size yeni bir proje atandı", href: "/projeler", count: 1 },
      { type: "task_assigned", label: "Size 2 yeni görev atandı", href: "/canli-tablo", count: 2 },
    ]);
  });
});
