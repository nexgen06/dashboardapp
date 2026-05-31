import { describe, expect, it } from "vitest";
import {
  collectProjectAssigneeEmails,
  resolveBulkAssigneeProjectIds,
} from "@/lib/projectAssignees";
import type { Project } from "@/types/project";

function project(id: string, emails: string[]): Project {
  return {
    id,
    name: id,
    description: "",
    status: "Aktif",
    created_at: null,
    updated_at: null,
    assigned_emails: emails,
  };
}

describe("projectAssignees", () => {
  it("collects assigned_emails from scoped projects", () => {
    const projects = [
      project("p1", ["a@x.com", "b@x.com"]),
      project("p2", ["c@x.com"]),
    ];
    expect(collectProjectAssigneeEmails(projects, ["p1"])).toEqual(["a@x.com", "b@x.com"]);
  });

  it("includes members without tasks when all projects in scope", () => {
    const projects = [project("p1", ["assigned@x.com", "idle@x.com"])];
    expect(collectProjectAssigneeEmails(projects)).toEqual(["assigned@x.com", "idle@x.com"]);
  });

  it("prefers selected task project ids over filter", () => {
    expect(
      resolveBulkAssigneeProjectIds({
        selectedProjectIds: ["p2"],
        projectFilter: ["p1"],
      })
    ).toEqual(["p2"]);
  });
});
