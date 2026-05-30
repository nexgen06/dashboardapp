import type { NewProjectSubmitData } from "@/components/projects/ProjectFormModal";
import { parseCSV } from "@/lib/csvParser";
import {
  buildStandardFieldMap,
  normalizeImportedStatus,
  normalizeImportedPriority,
} from "@/lib/csvHeaderMapping";
import { parseJSON } from "@/lib/jsonParser";
import {
  assigneeForRowRange,
  parseRowRangeAssignments,
} from "@/lib/importAssignment";
import {
  findAssigneeColumnIndex,
  findAssigneeJsonKey,
  normalizeTaskAssigneeEmail,
  pickRoundRobinAssignee,
} from "@/lib/projectImportAssignee";
import { normalizeImportedDueDate } from "@/lib/importDate";
import { normalizeProjectPriority } from "@/lib/projectFormHelpers";

export type TaskInsert = {
  content: string;
  status: string;
  assignee: string | null;
  project_id: string;
  extra_data: Record<string, string> | null;
  priority?: string | null;
  due_date?: string | null;
};

export async function buildProjectImportTasks(
  data: NewProjectSubmitData,
  projectId: string,
  effectiveAssignedEmails: string[]
): Promise<TaskInsert[]> {
  if (!data.importFile) return [];

  const text = await data.importFile.text();
  const fileName = (data.importFile.name || "").toLowerCase();
  const isJson = fileName.endsWith(".json");
  const recipients = effectiveAssignedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const importMode = data.importAssignmentMode ?? "unassigned";
  const roundRobin = importMode === "roundRobin" && recipients.length >= 2;
  const defaultRaw = (data.assignee ?? "").trim();
  const defaultAssignee =
    importMode === "single" ? normalizeTaskAssigneeEmail(defaultRaw) ?? (defaultRaw || null) : null;
  if (importMode === "single" && !defaultAssignee) {
    throw new Error("Tek kişiye atama için e-posta girilmeli.");
  }
  if (importMode === "roundRobin" && recipients.length < 2) {
    throw new Error("Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.");
  }
  const rangeAssignments =
    importMode === "rowRanges" ? parseRowRangeAssignments(data.importRowRangesText ?? "") : [];
  if (importMode === "rowRanges" && rangeAssignments.length === 0) {
    throw new Error("Satır aralığına göre dağıtım için en az bir aralık girilmeli.");
  }
  if (importMode === "groupByColumn" && !(data.importGroupByColumn ?? "").trim()) {
    throw new Error("Sütuna göre dağıtım için bir sütun seçilmeli.");
  }
  const projectPriority = normalizeProjectPriority(data.priority);
  /**
   * Kullanıcı önizleme üzerinden bazı sütunları kapatmış olabilir.
   * Whitelist (trimlenmiş başlık adı). Undefined → tüm sütunlar dahil (geriye uyumluluk).
   */
  const columnWhitelist = data.selectedImportColumns
    ? new Set(data.selectedImportColumns.map((s) => (s ?? "").trim()))
    : null;
  const isColumnIncluded = (rawKey: string) =>
    columnWhitelist == null || columnWhitelist.has(rawKey.trim());
  const tasksToInsert: TaskInsert[] = [];
  let distributeIndex = 0;
  if (isJson) {
    const { headers, rows } = parseJSON(text);
    const assigneeKey = importMode === "file" && !roundRobin ? findAssigneeJsonKey(headers) : null;
    const groupJsonKey =
      importMode === "groupByColumn" && data.importGroupByColumn
        ? headers.find((h) => ((h ?? "").trim() || h) === data.importGroupByColumn) ?? data.importGroupByColumn
        : null;
    // Standart alan eşlemesi (DURUM → status, AÇIKLAMA → content vs.)
    // Bu sütunlar extra_data'ya yazılmaz, doğrudan task field'ına gider.
    const stdMap = buildStandardFieldMap(headers);
    const mappedHeaders = new Set(Object.values(stdMap).map((m) => m!.header));
    if (headers.length > 0 && rows.length > 0) {
      for (const row of rows) {
        const extra_data: Record<string, string> = {};
        headers.forEach((h) => {
          const key = (h ?? "").trim() || "Sütun";
          if (!isColumnIncluded(key)) return;
          if (mappedHeaders.has(h)) return; // standart alanlar extra_data'ya gitmez
          extra_data[key] = row[key] ?? "";
        });
        const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
        if (hasAnyData) {
          const fromCol =
            assigneeKey != null ? normalizeTaskAssigneeEmail(row[assigneeKey]) : null;
          const groupValue = groupJsonKey != null ? String(row[groupJsonKey] ?? "").trim() : "";
          const fromGroup =
            importMode === "groupByColumn"
              ? normalizeTaskAssigneeEmail(data.importGroupAssignments?.[groupValue])
              : null;
          const fromRange =
            importMode === "rowRanges" ? assigneeForRowRange(distributeIndex + 1, rangeAssignments) : null;
          const assignee = roundRobin
            ? pickRoundRobinAssignee(recipients, distributeIndex)
            : importMode === "groupByColumn"
              ? fromGroup
              : importMode === "rowRanges"
                ? fromRange
                : (fromCol ?? defaultAssignee);
          distributeIndex += 1;
          // Standart alanları stdMap'ten doldur (JSON)
          const stdContent = stdMap.content ? String(row[stdMap.content.header] ?? "").trim() : "";
          const stdStatusRaw = stdMap.status ? String(row[stdMap.status.header] ?? "").trim() : "";
          const stdPriorityRaw = stdMap.priority ? String(row[stdMap.priority.header] ?? "").trim() : "";
          const stdDueRaw = stdMap.due_date ? String(row[stdMap.due_date.header] ?? "").trim() : "";
          // assignee: stdMap.assignee varsa onu da kullan (mevcut findAssigneeJsonKey ile tutarlı)
          const finalAssignee = stdMap.assignee && !assignee
            ? normalizeTaskAssigneeEmail(row[stdMap.assignee.header]) ?? assignee
            : assignee;
          tasksToInsert.push({
            content: stdContent,
            status: stdStatusRaw ? normalizeImportedStatus(stdStatusRaw) : "Yapılacak",
            assignee: finalAssignee,
            project_id: projectId,
            extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
            priority: stdPriorityRaw ? (normalizeImportedPriority(stdPriorityRaw) ?? projectPriority ?? undefined) : (projectPriority ?? undefined),
            ...(stdDueRaw ? { due_date: normalizeImportedDueDate(stdDueRaw) } : {}),
          } as TaskInsert);
        }
      }
    }
  } else {
    const { headers, rows } = parseCSV(text);
    const assigneeCol = importMode === "file" && !roundRobin ? findAssigneeColumnIndex(headers) : null;
    const groupCol =
      importMode === "groupByColumn" && data.importGroupByColumn
        ? headers.findIndex((h) => ((h ?? "").trim() || h) === data.importGroupByColumn)
        : -1;
    // Standart alan eşlemesi (DURUM → status, AÇIKLAMA → content vs.)
    const stdMap = buildStandardFieldMap(headers);
    const mappedIndices = new Set(Object.values(stdMap).map((m) => m!.index));
    if (headers.length > 0 && rows.length > 0) {
      for (const row of rows) {
        const extra_data: Record<string, string> = {};
        headers.forEach((h, i) => {
          if (mappedIndices.has(i)) return; // standart alanlar extra_data'ya gitmez
          const key = (h ?? "").trim() || `Sütun ${i + 1}`;
          if (!isColumnIncluded(key)) return;
          extra_data[key] = (row[i] != null ? String(row[i]).trim() : "") ?? "";
        });
        // Standart alanları çek
        const stdContent = stdMap.content ? String(row[stdMap.content.index] ?? "").trim() : "";
        const stdStatusRaw = stdMap.status ? String(row[stdMap.status.index] ?? "").trim() : "";
        const stdPriorityRaw = stdMap.priority ? String(row[stdMap.priority.index] ?? "").trim() : "";
        const stdDueRaw = stdMap.due_date ? String(row[stdMap.due_date.index] ?? "").trim() : "";

        const hasAnyData = stdContent.length > 0 || Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
        if (hasAnyData) {
          const fromCol =
            assigneeCol != null ? normalizeTaskAssigneeEmail(row[assigneeCol]) : null;
          const fromStdAssignee = stdMap.assignee
            ? normalizeTaskAssigneeEmail(row[stdMap.assignee.index])
            : null;
          const groupValue = groupCol >= 0 ? String(row[groupCol] ?? "").trim() : "";
          const fromGroup =
            importMode === "groupByColumn"
              ? normalizeTaskAssigneeEmail(data.importGroupAssignments?.[groupValue])
              : null;
          const fromRange =
            importMode === "rowRanges" ? assigneeForRowRange(distributeIndex + 1, rangeAssignments) : null;
          const assignee = roundRobin
            ? pickRoundRobinAssignee(recipients, distributeIndex)
            : importMode === "groupByColumn"
              ? fromGroup
              : importMode === "rowRanges"
                ? fromRange
                : (fromCol ?? fromStdAssignee ?? defaultAssignee);
          distributeIndex += 1;
          tasksToInsert.push({
            content: stdContent,
            status: stdStatusRaw ? normalizeImportedStatus(stdStatusRaw) : "Yapılacak",
            assignee,
            project_id: projectId,
            extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
            priority: stdPriorityRaw
              ? (normalizeImportedPriority(stdPriorityRaw) ?? projectPriority ?? undefined)
              : (projectPriority ?? undefined),
            ...(stdDueRaw ? { due_date: normalizeImportedDueDate(stdDueRaw) } : {}),
          });
        }
      }
    }
  }
  return tasksToInsert;
}
