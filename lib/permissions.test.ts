import { describe, it, expect } from "vitest";
import { getEffectivePermissions, hasPermission, hasAnyPermission } from "@/lib/permissions";
import type { User } from "@/types/permissions";

describe("permissions", () => {
  const adminUser: User = {
    id: "u1",
    email: "a@x.com",
    displayName: "Admin",
    roleId: "admin",
  };
  const viewer: User = {
    id: "u2",
    email: "v@x.com",
    displayName: "Viewer",
    roleId: "viewer",
  };

  it("admin has settings.edit", () => {
    expect(hasPermission(adminUser, "settings.edit")).toBe(true);
  });

  it("viewer has settings.view but not settings.edit", () => {
    expect(hasPermission(viewer, "settings.view")).toBe(true);
    expect(hasPermission(viewer, "settings.edit")).toBe(false);
  });

  it("hasAnyPermission", () => {
    expect(hasAnyPermission(viewer, ["liveTable.view", "settings.edit"])).toBe(true);
    expect(hasAnyPermission(viewer, ["projects.create", "liveTable.importCsv"])).toBe(false);
  });

  it("permissionOverrides add/remove", () => {
    const u: User = {
      ...viewer,
      permissionOverrides: { add: ["settings.edit"], remove: ["area.liveTable"] },
    };
    const perms = getEffectivePermissions(u);
    expect(perms.includes("settings.edit")).toBe(true);
    expect(perms.includes("area.liveTable")).toBe(false);
  });
});
