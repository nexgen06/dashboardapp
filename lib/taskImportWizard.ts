import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
import {
  detectStandardField,
  normalizeImportedPriority,
  normalizeImportedStatus,
  type StandardTaskField,
} from "@/lib/csvHeaderMapping";

export type { StandardTaskField };

export const STANDARD_FIELD_LABELS: Record<StandardTaskField, string> = {
  content: "Görev başlığı / içerik",
  status: "Durum",
  assignee: "Atanan",
  priority: "Öncelik",
  due_date: "Son tarih",
};

export type ImportColumnMapping = Partial<Record<StandardTaskField, number>>;

export type ParsedImportFile = {
  headers: string[];
  rows: string[][];
  isJson: boolean;
};

export type TaskImportRow = {
  content: string;
  status: string;
  assignee: string | null;
  priority?: string | null;
  due_date?: string | null;
  extra_data: Record<string, string> | null;
};

export type ImportValidationReport = {
  totalRows: number;
  validRows: number;
  skippedEmptyRows: number;
  duplicateHeaders: string[];
  emptyColumns: string[];
  duplicateContentWarnings: string[];
  warnings: string[];
};

export function parseImportFile(text: string, fileName: string): ParsedImportFile {
  const lower = (fileName ?? "").toLowerCase();
  if (lower.endsWith(".json")) {
    const { headers, rows: jsonRows } = parseJSON(text);
    return {
      headers,
      rows: jsonRows.map((row) => headers.map((h) => String(row[h] ?? ""))),
      isJson: true,
    };
  }
  const { headers, rows } = parseCSV(text);
  return {
    headers,
    rows: rows.map((r) => r.map((v) => String(v ?? ""))),
    isJson: false,
  };
}

/** Başlık adlarından otomatik sütun eşlemesi; içerik yoksa ilk sütunu dene. */
export function autoColumnMapping(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  const used = new Set<number>();

  headers.forEach((header, index) => {
    const field = detectStandardField(header ?? "");
    if (field && mapping[field] == null) {
      mapping[field] = index;
      used.add(index);
    }
  });

  if (mapping.content == null && headers.length > 0) {
    const firstFree = headers.findIndex((_, i) => !used.has(i));
    if (firstFree >= 0) {
      mapping.content = firstFree;
      used.add(firstFree);
    }
  }

  return mapping;
}

export function headerKey(headers: string[], index: number): string {
  return (headers[index] ?? "").trim() || `Sütun ${index + 1}`;
}

export function findDuplicateHeaders(headers: string[]): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const h of headers) {
    const key = (h ?? "").trim().toLocaleLowerCase("tr");
    if (!key) continue;
    const label = (h ?? "").trim() || h;
    if (seen.has(key)) {
      if (!duplicates.includes(seen.get(key)!)) duplicates.push(seen.get(key)!);
      if (!duplicates.includes(label)) duplicates.push(label);
    } else {
      seen.set(key, label);
    }
  }
  return duplicates;
}

export function mappedColumnIndices(mapping: ImportColumnMapping): Set<number> {
  return new Set(
    Object.values(mapping).filter((v): v is number => typeof v === "number" && v >= 0)
  );
}

export function validateImportData(
  headers: string[],
  rows: string[][],
  mapping: ImportColumnMapping
): ImportValidationReport {
  const duplicateHeaders = findDuplicateHeaders(headers);
  const emptyColumns: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    const allEmpty = rows.every((row) => !String(row[i] ?? "").trim());
    if (allEmpty) emptyColumns.push(headerKey(headers, i));
  }

  const warnings: string[] = [];
  if (duplicateHeaders.length > 0) {
    warnings.push(`Yinelenen sütun başlıkları: ${duplicateHeaders.join(", ")}`);
  }
  if (mapping.content == null) {
    warnings.push("Görev başlığı sütunu seçilmedi; satırlar boş başlıkla kaydedilebilir.");
  }

  const preview = buildTaskImportRows(headers, rows, mapping, {
    defaultStatus: "Yapılacak",
    defaultPriority: null,
  });

  return {
    ...preview.report,
    duplicateHeaders,
    emptyColumns,
    warnings: [...warnings, ...preview.report.warnings],
  };
}

export function buildTaskImportRows(
  headers: string[],
  rows: string[][],
  mapping: ImportColumnMapping,
  options: { defaultStatus: string; defaultPriority: string | null }
): { tasks: TaskImportRow[]; report: Omit<ImportValidationReport, "duplicateHeaders" | "emptyColumns"> } {
  const mapped = mappedColumnIndices(mapping);
  const tasks: TaskImportRow[] = [];
  let skippedEmptyRows = 0;
  const contentCounts = new Map<string, number>();

  const cell = (row: string[], index: number | undefined) =>
    index != null && index >= 0 ? String(row[index] ?? "").trim() : "";

  for (const row of rows) {
    const extra_data: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (mapped.has(i)) return;
      const key = headerKey(headers, i);
      extra_data[key] = cell(row, i);
    });

    const content = cell(row, mapping.content);
    const statusRaw = cell(row, mapping.status);
    const priorityRaw = cell(row, mapping.priority);
    const dueRaw = cell(row, mapping.due_date);
    const assigneeRaw = cell(row, mapping.assignee);

    const hasExtra = Object.values(extra_data).some((v) => v.trim() !== "");
    const hasStandard = content || statusRaw || priorityRaw || dueRaw || assigneeRaw;
    if (!hasExtra && !hasStandard) {
      skippedEmptyRows += 1;
      continue;
    }

    if (content) {
      contentCounts.set(content, (contentCounts.get(content) ?? 0) + 1);
    }

    tasks.push({
      content: content || "",
      status: statusRaw ? normalizeImportedStatus(statusRaw) : options.defaultStatus,
      assignee: assigneeRaw || null,
      priority: priorityRaw
        ? normalizeImportedPriority(priorityRaw) ?? options.defaultPriority ?? null
        : options.defaultPriority ?? null,
      ...(dueRaw ? { due_date: dueRaw } : {}),
      extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
    });
  }

  const duplicateContentWarnings = Array.from(contentCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([text, count]) => `"${text}" (${count} satır)`);

  const warnings: string[] = [];
  if (duplicateContentWarnings.length > 0) {
    warnings.push(
      `Olası mükerrer görev başlıkları: ${duplicateContentWarnings.slice(0, 5).join("; ")}${
        duplicateContentWarnings.length > 5 ? ` (+${duplicateContentWarnings.length - 5} daha)` : ""
      }`
    );
  }

  return {
    tasks,
    report: {
      totalRows: rows.length,
      validRows: tasks.length,
      skippedEmptyRows,
      duplicateContentWarnings,
      warnings,
    },
  };
}

export function previewRows(
  headers: string[],
  rows: string[][],
  limit = 8
): string[][] {
  return rows.slice(0, limit);
}
