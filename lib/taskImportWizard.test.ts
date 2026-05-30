import { describe, expect, it } from "vitest";
import {
  autoColumnMapping,
  buildTaskImportRows,
  findDuplicateHeaders,
  parseImportFile,
} from "@/lib/taskImportWizard";

describe("parseImportFile", () => {
  it("CSV parse eder", () => {
    const parsed = parseImportFile("Başlık,Durum\nGörev 1,Yapılacak\n", "data.csv");
    expect(parsed.headers).toEqual(["Başlık", "Durum"]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.isJson).toBe(false);
  });
});

describe("autoColumnMapping", () => {
  it("durum ve içerik sütunlarını eşler", () => {
    const mapping = autoColumnMapping(["Görev Adı", "Durum", "İl"]);
    expect(mapping.content).toBe(0);
    expect(mapping.status).toBe(1);
    expect(mapping.due_date).toBeUndefined();
  });
});

describe("findDuplicateHeaders", () => {
  it("yinelenen başlıkları bulur", () => {
    const dupes = findDuplicateHeaders(["İl", "Durum", "il"]);
    expect(dupes.length).toBeGreaterThan(0);
  });
});

describe("buildTaskImportRows", () => {
  it("standart alanları extra_data dışında tutar", () => {
    const headers = ["Başlık", "Durum", "İl"];
    const rows = [["Ankara Merkez", "Tamamlandı", "Ankara"]];
    const mapping = autoColumnMapping(headers);
    const { tasks } = buildTaskImportRows(headers, rows, mapping, {
      defaultStatus: "Yapılacak",
      defaultPriority: "Medium",
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.content).toBe("Ankara Merkez");
    expect(tasks[0]?.status).toBe("Tamamlandı");
    expect(tasks[0]?.extra_data?.İl).toBe("Ankara");
    expect(tasks[0]?.extra_data?.Durum).toBeUndefined();
  });

  it("boş satırları atlar", () => {
    const headers = ["Başlık"];
    const rows = [["Görev"], [""]];
    const mapping = autoColumnMapping(headers);
    const { report } = buildTaskImportRows(headers, rows, mapping, {
      defaultStatus: "Yapılacak",
      defaultPriority: null,
    });
    expect(report.validRows).toBe(1);
    expect(report.skippedEmptyRows).toBe(1);
  });

  it("son tarihi ISO'ya çevirir", () => {
    const headers = ["Başlık", "Son Tarih"];
    const rows = [["Görev A", "21.01.2015"]];
    const mapping = autoColumnMapping(headers);
    mapping.due_date = 1;
    const { tasks } = buildTaskImportRows(headers, rows, mapping, {
      defaultStatus: "Yapılacak",
      defaultPriority: null,
    });
    expect(tasks[0]?.due_date).toBe("2015-01-21");
  });
});
