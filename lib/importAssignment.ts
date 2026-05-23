export type ImportAssignmentMode =
  | "file"
  | "unassigned"
  | "single"
  | "roundRobin"
  | "groupByColumn"
  | "rowRanges";

export type RowRangeAssignment = {
  start: number;
  end: number;
  assignee: string;
};

export function normalizeImportValue(raw: string | null | undefined): string {
  return String(raw ?? "").trim();
}

export function parseRowRangeAssignments(text: string): RowRangeAssignment[] {
  const emailRe = /[^\s,;:=→-]+@[^\s,;:=→-]+\.[^\s,;:=→-]+/i;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const nums = line.match(/\d+/g) ?? [];
      const email = line.match(emailRe)?.[0]?.trim().toLowerCase() ?? "";
      if (nums.length < 2 || !email) return null;
      const a = Number(nums[0]);
      const b = Number(nums[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
      return { start: Math.min(a, b), end: Math.max(a, b), assignee: email };
    })
    .filter((x): x is RowRangeAssignment => x != null);
}

export function assigneeForRowRange(rowNumber: number, ranges: RowRangeAssignment[]): string | null {
  const match = ranges.find((r) => rowNumber >= r.start && rowNumber <= r.end);
  return match?.assignee ?? null;
}

export function collectColumnValues(
  headers: string[],
  rows: string[][],
  columnKey: string,
  limit = 60
): string[] {
  const index = headers.findIndex((h) => normalizeImportValue(h) === normalizeImportValue(columnKey));
  if (index < 0) return [];
  const out = new Set<string>();
  for (const row of rows) {
    const value = normalizeImportValue(row[index]);
    if (!value) continue;
    out.add(value);
    if (out.size >= limit) break;
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base", numeric: true }));
}
