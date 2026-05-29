import { describe, expect, it } from "vitest";
import { matchesSearch } from "@/components/settings/settingsSearch";

describe("settingsSearch", () => {
  it("matches label or description case-insensitively", () => {
    expect(matchesSearch("tema", "Tema", "Açık veya koyu")).toBe(true);
    expect(matchesSearch("koyu", "Tema", "Açık veya koyu")).toBe(true);
    expect(matchesSearch("api", "Dil", "Arayüz dilini seçin.")).toBe(false);
  });

  it("returns true when query empty", () => {
    expect(matchesSearch("", "Herhangi")).toBe(true);
  });
});
