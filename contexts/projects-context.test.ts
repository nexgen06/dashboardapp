import { describe, expect, it } from "vitest";
import { filterProjectsByArchived, isProjectArchived } from "@/contexts/projects-context";
import type { Project } from "@/types/project";

function project(partial: Partial<Project> & Pick<Project, "id">): Project {
  return {
    name: "P",
    description: "",
    status: "Aktif",
    ...partial,
  } as Project;
}

describe("isProjectArchived", () => {
  it("archived_at dolu ise arşivli", () => {
    expect(isProjectArchived(project({ id: "1", archived_at: "2026-01-01" }))).toBe(true);
  });

  it("archived_at boş/null ise aktif", () => {
    expect(isProjectArchived(project({ id: "2", archived_at: null }))).toBe(false);
    expect(isProjectArchived(project({ id: "3" }))).toBe(false);
  });
});

describe("filterProjectsByArchived", () => {
  const projects = [
    project({ id: "a", archived_at: null }),
    project({ id: "b", archived_at: "2026-05-01" }),
  ];

  it("includeArchived false iken arşivlileri çıkarır", () => {
    expect(filterProjectsByArchived(projects, false).map((p) => p.id)).toEqual(["a"]);
  });

  it("includeArchived true iken hepsini döner", () => {
    expect(filterProjectsByArchived(projects, true).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
