import { describe, expect, it } from "vitest";
import {
  ME_LABEL,
  assigneeValueForDatabase,
  formatAssigneeForDisplay,
  isOverdueDueDate,
  isTaskOverdue,
  sortTasksByUpdatedDesc,
} from "@/lib/projectDetailPageHelpers";
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

describe("formatAssigneeForDisplay", () => {
  it("boş atanan için em dash", () => {
    expect(formatAssigneeForDisplay(null, "me@test.com")).toBe("—");
  });

  it("izleyici e-postası için Ben etiketi", () => {
    expect(formatAssigneeForDisplay("Me@Test.com", "me@test.com")).toBe(ME_LABEL);
  });

  it("başka kullanıcı e-postasını olduğu gibi gösterir", () => {
    expect(formatAssigneeForDisplay("other@test.com", "me@test.com")).toBe("other@test.com");
  });
});

describe("assigneeValueForDatabase", () => {
  it("strict modda Ben → oturum e-postası", () => {
    expect(assigneeValueForDatabase(true, ME_LABEL, "me@test.com")).toBe("me@test.com");
  });

  it("strict kapalıyken Ben literal kalır", () => {
    expect(assigneeValueForDatabase(false, ME_LABEL, "me@test.com")).toBe(ME_LABEL);
  });

  it("boş değer null", () => {
    expect(assigneeValueForDatabase(true, "  ", "me@test.com")).toBe(null);
  });
});

describe("isOverdueDueDate", () => {
  it("geçmiş tarih gecikmiş", () => {
    expect(isOverdueDueDate("2020-01-01")).toBe(true);
  });

  it("gelecek tarih gecikmiş değil", () => {
    expect(isOverdueDueDate("2099-12-31")).toBe(false);
  });
});

describe("isTaskOverdue", () => {
  it("tamamlanan görev gecikmiş sayılmaz", () => {
    expect(
      isTaskOverdue(task({ id: "1", due_date: "2020-01-01", status: "Tamamlandı" }))
    ).toBe(false);
  });

  it("açık görev geçmiş due_date ile gecikmiş", () => {
    expect(isTaskOverdue(task({ id: "2", due_date: "2020-01-01", status: "Devam ediyor" }))).toBe(true);
  });
});

describe("sortTasksByUpdatedDesc", () => {
  it("updated_at azalan sıralar", () => {
    const sorted = sortTasksByUpdatedDesc([
      task({ id: "a", updated_at: "2026-01-01T00:00:00Z" }),
      task({ id: "b", updated_at: "2026-06-01T00:00:00Z" }),
      task({ id: "c", updated_at: null }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
});
