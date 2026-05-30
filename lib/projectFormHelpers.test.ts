import { describe, expect, it } from "vitest";
import {
  normalizeProjectPriority,
  parseExtraColumnKeysFromForm,
  SMART_CHIP_COLUMN_PRESETS,
} from "@/lib/projectFormHelpers";

describe("normalizeProjectPriority", () => {
  it("High/Medium/Low döner", () => {
    expect(normalizeProjectPriority("high")).toBe("High");
    expect(normalizeProjectPriority("MEDIUM")).toBe("Medium");
    expect(normalizeProjectPriority("Low")).toBe("Low");
  });

  it("geçersiz değer için null", () => {
    expect(normalizeProjectPriority("urgent")).toBe(null);
    expect(normalizeProjectPriority(null)).toBe(null);
  });
});

describe("parseExtraColumnKeysFromForm", () => {
  it("satır ve virgül ile ayrılmış anahtarları birleştirir", () => {
    expect(parseExtraColumnKeysFromForm("Sicil\nTCKN, Departman")).toEqual([
      "Sicil",
      "TCKN",
      "Departman",
    ]);
  });

  it("boş satırları atlar, tekrarları kaldırır", () => {
    expect(parseExtraColumnKeysFromForm("A\n\nA, B")).toEqual(["A", "B"]);
  });
});

describe("SMART_CHIP_COLUMN_PRESETS", () => {
  it("beş hazır çip kolonu tanımlı", () => {
    expect(SMART_CHIP_COLUMN_PRESETS.map((p) => p.label)).toEqual([
      "Risk",
      "Ödeme Durumu",
      "Evrak",
      "Gizlilik",
      "Mail Durumu",
    ]);
  });
});
