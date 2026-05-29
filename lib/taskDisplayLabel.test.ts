import { describe, expect, it } from "vitest";
import { getTaskDisplayCard, getTaskDisplayLabel } from "./taskDisplayLabel";

describe("getTaskDisplayLabel", () => {
  it("content doluysa content döner", () => {
    expect(getTaskDisplayLabel({ content: "  Ankara  ", extra_data: { İl: "X" } })).toBe("Ankara");
  });

  it("projectTitleColumn extra_data'dan okur", () => {
    expect(
      getTaskDisplayLabel(
        { content: "", extra_data: { İl: "Adana", Bölge: "A" } },
        { projectTitleColumn: "İl" }
      )
    ).toBe("Adana");
  });

  it("hiç veri yoksa em dash döner", () => {
    expect(getTaskDisplayLabel({ content: "", extra_data: {} })).toBe("—");
  });
});

describe("getTaskDisplayCard", () => {
  it("subtitle_columns sırasını korur", () => {
    const card = getTaskDisplayCard(
      {
        content: "",
        extra_data: { İl: "Ankara", Bölge: "Marmara", Durum: "Aktif" },
      },
      {
        projectTitleColumn: "İl",
        subtitleColumns: ["Bölge", "Durum"],
      }
    );
    expect(card.label).toBe("Ankara");
    expect(card.subtitle).toEqual([
      { key: "Bölge", value: "Marmara" },
      { key: "Durum", value: "Aktif" },
    ]);
  });

  it("boş subtitle key atlanır", () => {
    const card = getTaskDisplayCard(
      { content: "Görev", extra_data: { İl: "X" } },
      { subtitleColumns: ["İl", "Eksik"] }
    );
    expect(card.subtitle).toEqual([{ key: "İl", value: "X" }]);
  });
});
