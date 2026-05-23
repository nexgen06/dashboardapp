"use client";

import * as XLSX from "xlsx";
import type { DateFormat } from "@/contexts/settings-context";
import { isSensitiveExtraColumnKey, maskSensitiveExtraValue } from "@/lib/extraColumnSensitiveDisplay";
import { formatDate } from "@/lib/formatDate";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

const EXPORT_COLUMN_LABELS: Record<string, string> = {
  content: "Açıklama",
  status: "Durum",
  assignee: "Atanan",
  priority: "Öncelik",
  project: "Proje",
  updated: "Son güncelleme",
};

const EXPORT_SKIP_IDS = new Set(["select", "actions", "presence"]);
const EXPORT_DEFAULT_COLUMNS = ["status", "content", "assignee", "priority", "updated", "due_date"];

export type PdfExportScope = "current" | "all";
export type PdfExportMetadata = {
  generatedAt: string;
  scopeLabel: string;
  exportedBy: string;
  sensitivityLabel: string;
  filterSummary: string[];
  statusSummary: string;
  reportTemplateLabel: string;
};
export type EmailTemplateMode = "mobile" | "table";
export type ReportTemplateId = "operations" | "executive" | "mobileBrief" | "fullTable";

export const REPORT_TEMPLATES: Record<
  ReportTemplateId,
  {
    label: string;
    description: string;
    pdfTitle: string;
    emailSubject: string;
    emailMode: EmailTemplateMode;
  }
> = {
  operations: {
    label: "Operasyon özeti",
    description: "Günlük takip için kapsam, filtreler, durum özeti ve görev listesi.",
    pdfTitle: "Canlı Tablo Operasyon Özeti",
    emailSubject: "Canlı Tablo Operasyon Özeti",
    emailMode: "mobile",
  },
  executive: {
    label: "Yönetici özeti",
    description: "Karar vericiler için kısa, okunabilir ve mobil uyumlu rapor.",
    pdfTitle: "Yönetici Görev Özeti",
    emailSubject: "Yönetici Görev Özeti",
    emailMode: "mobile",
  },
  mobileBrief: {
    label: "Mobil özet",
    description: "Telefon ve tabletlerde okunması kolay kart tabanlı e-posta.",
    pdfTitle: "Mobil Görev Özeti",
    emailSubject: "Mobil Görev Özeti",
    emailMode: "mobile",
  },
  fullTable: {
    label: "Detaylı tablo",
    description: "Tüm görünür kolonları tablo mantığıyla paylaşmak için.",
    pdfTitle: "Detaylı Görev Raporu",
    emailSubject: "Detaylı Görev Raporu",
    emailMode: "table",
  },
};

function getExportValue(
  columnId: string,
  task: Task,
  dateFormat: DateFormat,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
): string {
  const t = task as Record<string, unknown>;
  switch (columnId) {
    case "content":
      return String(t.content ?? task.content ?? "");
    case "status":
      return String(t.status ?? task.status ?? "");
    case "assignee":
      return String(t.assignee ?? task.assignee ?? "");
    case "priority":
      return String(t.priority ?? task.priority ?? "");
    case "project": {
      const pid = task.project_id != null ? String(task.project_id) : "";
      if (!pid) return "";
      const p = projectById?.get(pid);
      return (p?.name ?? "").trim() || pid;
    }
    case "updated":
    case "updated_at": {
      const ut = t.updated_at ?? task.updated_at;
      return ut ? formatDate(new Date(String(ut)), dateFormat) : "";
    }
    case "due_date":
      return String(t.due_date ?? task.due_date ?? "");
    default:
      if (columnId.startsWith("extra:")) {
        const key = columnId.replace(/^extra:/, "");
        const raw = String(task.extra_data?.[key] ?? (t.extra_data as Record<string, string>)?.[key] ?? "");
        return isSensitiveExtraColumnKey(key) && !unmaskSensitive ? maskSensitiveExtraValue(raw) : raw;
      }
      if (columnId === "detay") {
        if (!task.extra_data) return "";
        const safe: Record<string, string> = {};
        for (const [k, v] of Object.entries(task.extra_data)) {
          const raw = String(v ?? "");
          safe[k] = isSensitiveExtraColumnKey(k) && !unmaskSensitive ? maskSensitiveExtraValue(raw) : raw;
        }
        return JSON.stringify(safe);
      }
      return t[columnId] != null ? String(t[columnId]) : "";
  }
}

export function getExportData(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
) {
  let dataColumns = visibleColumnIds.filter(
    (id) =>
      !EXPORT_SKIP_IDS.has(id) &&
      (EXPORT_COLUMN_LABELS[id] != null ||
        id.startsWith("extra:") ||
        id === "due_date" ||
        id === "updated" ||
        id === "updated_at" ||
        id === "assignee" ||
        id === "priority" ||
        id === "content" ||
        id === "status" ||
        id === "project" ||
        id === "detay")
  );
  if (dataColumns.length === 0 && rows.length > 0) {
    const first = rows[0];
    const extraKeys = first.extra_data ? Object.keys(first.extra_data) : [];
    dataColumns = [...EXPORT_DEFAULT_COLUMNS, ...extraKeys.map((k) => `extra:${k}`)];
  }
  const headers = dataColumns.map((id) =>
    EXPORT_COLUMN_LABELS[id] ??
    (id === "due_date"
      ? "Son tarih"
      : id === "updated_at"
        ? "Son güncelleme"
        : id.startsWith("extra:")
          ? id.replace(/^extra:/, "")
          : id === "detay"
            ? "Detay"
            : id)
  );
  const rowArrays = rows.map((task) =>
    dataColumns.map((id) => getExportValue(id, task, dateFormat, projectById, unmaskSensitive))
  );
  return { headers, rowArrays };
}

export function downloadCSV(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  filename: string,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const lines = [headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(",")];
  for (const values of rowArrays) {
    lines.push(values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  }
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadExcel(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  filename: string,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const sheetData: string[][] = [headers, ...rowArrays];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Görevler");
  const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([xlsxBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const name = filename.replace(/\.xls$/i, ".xlsx");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function createTaskPDF(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false,
  documentTitle?: string | null,
  metadata?: PdfExportMetadata
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const [{ default: pdfMake }, vfsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const vfs = vfsMod.default ?? (vfsMod as unknown as Record<string, string>);
  pdfMake.addVirtualFileSystem(vfs);

  const body: unknown[][] = [
    headers.map((h) => ({ text: String(h), style: "th" })),
    ...rowArrays.map((row) => row.map((cell) => String(cell))),
  ];

  const uniqueAssignees = Array.from(
    new Set(rows.map((r) => r.assignee).filter((a) => a && String(a).trim() !== ""))
  );
  const assigneesText =
    uniqueAssignees.length > 0
      ? `Çalışan Kişiler: ${uniqueAssignees.join(", ")}`
      : "Çalışan Kişiler: Belirtilmemiş";
  const rowCountText = `Toplam Görev Sayısı: ${rows.length}`;
  const titleText = documentTitle || "Görev Listesi";
  const metadataLines = metadata
    ? [
        `Oluşturulma: ${metadata.generatedAt}`,
        `Kapsam: ${metadata.scopeLabel}`,
        `Dışa aktaran: ${metadata.exportedBy}`,
        `Rapor şablonu: ${metadata.reportTemplateLabel}`,
        `Hassas veri: ${metadata.sensitivityLabel}`,
        `Durum özeti: ${metadata.statusSummary}`,
      ]
    : [];
  const filterLines = metadata?.filterSummary?.length
    ? metadata.filterSummary.map((line) => `• ${line}`)
    : [];

  const docDefinition = {
    pageSize: "A4" as const,
    pageOrientation: "landscape" as const,
    pageMargins: [36, 44, 36, 44] as [number, number, number, number],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: "DashboardApp", alignment: "left" },
        { text: `Sayfa ${currentPage} / ${pageCount}`, alignment: "right" },
      ],
      margin: [36, 0, 36, 18] as [number, number, number, number],
      fontSize: 8,
      color: "#777777",
    }),
    content: [
      { text: titleText, style: "h1", margin: [0, 0, 0, 8] as [number, number, number, number] },
      { text: rowCountText, style: "subheader", margin: [0, 0, 0, 4] as [number, number, number, number] },
      { text: assigneesText, style: "subheader", margin: [0, 0, 0, 8] as [number, number, number, number] },
      ...(metadataLines.length > 0
        ? [
            {
              text: metadataLines.join("\n"),
              style: "meta",
              margin: [0, 0, 0, filterLines.length > 0 ? 6 : 14] as [number, number, number, number],
            },
          ]
        : []),
      ...(filterLines.length > 0
        ? [
            { text: "Filtre özeti", style: "metaTitle", margin: [0, 0, 0, 3] as [number, number, number, number] },
            {
              text: filterLines.join("\n"),
              style: "meta",
              margin: [0, 0, 0, 14] as [number, number, number, number],
            },
          ]
        : []),
      {
        table: {
          headerRows: 1,
          widths: Array(headers.length).fill("*"),
          dontBreakRows: false,
          body,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#cccccc",
          vLineColor: () => "#cccccc",
          fillColor: (rowIndex: number) => {
            if (rowIndex === 0) return "#e8eef4";
            return rowIndex % 2 === 0 ? "#f9fafb" : null;
          },
        },
      },
    ],
    styles: {
      h1: { fontSize: 14, bold: true },
      subheader: { fontSize: 10, color: "#555555" },
      metaTitle: { fontSize: 9, bold: true, color: "#333333" },
      meta: { fontSize: 8, color: "#555555" },
      th: { bold: true, fontSize: 9 },
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 8,
    },
  };

  return pdfMake.createPdf(docDefinition);
}

export async function downloadPDF(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  filename: string,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false,
  documentTitle?: string | null,
  metadata?: PdfExportMetadata
) {
  const pdf = await createTaskPDF(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive, documentTitle, metadata);
  const baseName = filename.replace(/\.pdf$/i, "");
  await pdf.download(`${baseName}.pdf`);
}

export async function createPDFPreviewUrl(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  projectById?: Map<string, Project>,
  unmaskSensitive: boolean = false,
  documentTitle?: string | null,
  metadata?: PdfExportMetadata
) {
  const pdf = await createTaskPDF(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive, documentTitle, metadata);
  const blob = await pdf.getBlob();
  return URL.createObjectURL(blob);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createEmailTemplate(
  rows: Task[],
  visibleColumnIds: string[],
  dateFormat: DateFormat,
  projectById: Map<string, Project> | undefined,
  unmaskSensitive: boolean,
  subject: string,
  metadata: PdfExportMetadata,
  mode: EmailTemplateMode
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const title = subject.trim() || "Canlı Tablo Görev Raporu";
  const summaryRows = [
    ["Kapsam", metadata.scopeLabel],
    ["Oluşturulma", metadata.generatedAt],
    ["Dışa aktaran", metadata.exportedBy],
    ["Rapor şablonu", metadata.reportTemplateLabel],
    ["Hassas veri", metadata.sensitivityLabel],
    ["Toplam görev", String(rows.length)],
    ["Durum özeti", metadata.statusSummary],
  ];
  const filterItems = metadata.filterSummary.length > 0 ? metadata.filterSummary : ["Ek filtre uygulanmadı."];
  const maxMobileRows = 30;
  const mobileRows = rowArrays.slice(0, maxMobileRows);
  const hiddenMobileRowCount = Math.max(0, rowArrays.length - mobileRows.length);
  const tableHead = headers
    .map((header) => `<th style="border:1px solid #cbd5e1;background:#e8eef4;padding:6px;text-align:left;font-size:12px;">${escapeHtml(header)}</th>`)
    .join("");
  const tableRows = rowArrays
    .map((row) => {
      const cells = row
        .map((cell) => `<td style="border:1px solid #cbd5e1;padding:6px;font-size:12px;vertical-align:top;">${escapeHtml(cell)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const mobileCards = mobileRows
    .map((row, rowIndex) => {
      const fieldRows = row
        .map((cell, cellIndex) => {
          const header = headers[cellIndex] ?? `Alan ${cellIndex + 1}`;
          const value = String(cell ?? "").trim() || "—";
          return `
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:12px;width:34%;vertical-align:top;">${escapeHtml(header)}</td>
              <td style="padding:4px 0;color:#0f172a;font-size:13px;vertical-align:top;">${escapeHtml(value)}</td>
            </tr>`;
        })
        .join("");
      return `
        <table role="presentation" style="border-collapse:collapse;width:100%;max-width:640px;margin:0 0 10px;border:1px solid #cbd5e1;border-radius:6px;">
          <tbody>
            <tr>
              <td style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 10px;font-size:13px;font-weight:bold;color:#0f172a;">Görev ${rowIndex + 1}</td>
            </tr>
            <tr>
              <td style="padding:8px 10px;">
                <table role="presentation" style="border-collapse:collapse;width:100%;">
                  <tbody>${fieldRows}</tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>`;
    })
    .join("");
  const bodyContent =
    mode === "mobile"
      ? `
  <h3 style="font-size:14px;margin:16px 0 8px;">Görevler</h3>
  ${mobileCards}
  ${
    hiddenMobileRowCount > 0
      ? `<p style="margin:10px 0 0;color:#64748b;font-size:12px;">Mobil okunabilirlik için ilk ${maxMobileRows} görev gösterildi. Tam liste için PDF/Excel çıktısını kullanın.</p>`
      : ""
  }`
      : `
  <table style="border-collapse:collapse;width:100%;">
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>`;
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.45;max-width:680px;">
  <p>Merhaba,</p>
  <p>${escapeHtml(title)} aşağıdadır.</p>
  <h2 style="font-size:18px;margin:18px 0 10px;">${escapeHtml(title)}</h2>
  <table style="border-collapse:collapse;margin:0 0 14px;width:100%;max-width:760px;">
    <tbody>
      ${summaryRows
        .map(
          ([label, value]) =>
            `<tr><th style="border:1px solid #cbd5e1;background:#f8fafc;padding:6px;text-align:left;width:160px;font-size:12px;">${escapeHtml(label)}</th><td style="border:1px solid #cbd5e1;padding:6px;font-size:12px;">${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
  <h3 style="font-size:14px;margin:16px 0 8px;">Filtre özeti</h3>
  <ul style="margin:0 0 16px;padding-left:20px;">
    ${filterItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
  </ul>
  ${bodyContent}
  <p style="margin-top:16px;color:#64748b;font-size:12px;">DashboardApp üzerinden oluşturuldu.</p>
</div>`.trim();
  const text = [
    "Merhaba,",
    "",
    `${title} aşağıdadır.`,
    "",
    ...summaryRows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Filtre özeti:",
    ...filterItems.map((item) => `- ${item}`),
    "",
    mode === "mobile" && hiddenMobileRowCount > 0
      ? `Görevler: İlk ${maxMobileRows} kayıt gösteriliyor, ${hiddenMobileRowCount} kayıt e-posta gövdesinde gizlendi.`
      : "Görevler:",
    [headers.join("\t"), ...(mode === "mobile" ? mobileRows : rowArrays).map((row) => row.join("\t"))].join("\n"),
  ].join("\n");
  return { subject: title, html, text };
}
