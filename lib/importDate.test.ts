import { describe, expect, it } from "vitest";
import { normalizeImportedDueDate } from "@/lib/importDate";

describe("normalizeImportedDueDate", () => {
  it("DD.MM.YYYY → ISO", () => {
    expect(normalizeImportedDueDate("21.01.2015")).toBe("2015-01-21");
  });

  it("DD/MM/YYYY → ISO", () => {
    expect(normalizeImportedDueDate("21/01/2015")).toBe("2015-01-21");
  });

  it("ISO kalır", () => {
    expect(normalizeImportedDueDate("2015-01-21")).toBe("2015-01-21");
  });

  it("ISO datetime öneki", () => {
    expect(normalizeImportedDueDate("2015-01-21T10:00:00")).toBe("2015-01-21");
  });

  it("boş → null", () => {
    expect(normalizeImportedDueDate("")).toBeNull();
    expect(normalizeImportedDueDate("   ")).toBeNull();
  });

  it("geçersiz tarih → null", () => {
    expect(normalizeImportedDueDate("32.01.2015")).toBeNull();
    expect(normalizeImportedDueDate("not-a-date")).toBeNull();
  });
});
