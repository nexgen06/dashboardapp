"use client";

import * as XLSX from "xlsx";
import type { DateFormat } from "@/contexts/settings-context";
import { isSensitiveExtraColumnKey, maskSensitiveExtraValue } from "@/lib/extraColumnSensitiveDisplay";
import { formatDate } from "@/lib/formatDate";
import { normalizeWorkflowStatus, WORKFLOW_STATUS_LABELS } from "@/lib/taskWorkflow";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";

const EXPORT_COLUMN_LABELS: Record<string, string> = {
  content: "Açıklama",
  status: "Durum",
  workflow: "Onay",
  assignee: "Atanan",
  priority: "Öncelik",
  project: "Proje",
  updated: "Son güncelleme",
};

const EXPORT_SKIP_IDS = new Set(["select", "actions", "presence"]);
const EXPORT_DEFAULT_COLUMNS = ["status", "content", "assignee", "priority", "updated", "due_date"];
const INTERNAL_EXTRA_DATA_KEYS = new Set(["__reference_warnings"]);

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

/**
 * PDF/e-posta üretiminde isteğe bağlı sunum seçenekleri.
 * Boş bırakılırsa eski varsayılan davranışlar korunur (geri uyumlu).
 */
export type PdfRenderOptions = {
  orientation?: "landscape" | "portrait";
  pageSize?: "A4" | "A3" | "Letter";
  /** "Filtre özeti" bloğunu PDF'te göster (varsayılan: true) */
  showFilterSummary?: boolean;
  /** "Durum özeti" satırını PDF/e-posta meta bloğunda göster (varsayılan: true) */
  showStatusSummary?: boolean;
  /** Kurumsal kimlik — logo + ad + footer metni */
  branding?: {
    logoUrl?: string;
    orgName?: string;
    footerText?: string;
  };
  /** Başlık altında italik tek paragraf (max ~400 karakter) */
  coverNote?: string;
  /** Yönetici özeti madde madde (max 6 öğe gösterilir) */
  summaryBullets?: string[];
};

/** URL'den base64 data-uri yükle — pdfmake `image: dataUri` için. */
async function loadImageDataUri(url: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const trimmed = (url ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  try {
    const res = await fetch(trimmed, { credentials: "omit", mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("[liveTableExport] logo yüklenemedi:", err);
    return null;
  }
}

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
    case "workflow":
      return WORKFLOW_STATUS_LABELS[normalizeWorkflowStatus(task.workflow_status)];
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
          if (INTERNAL_EXTRA_DATA_KEYS.has(k)) continue;
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
  metadata?: PdfExportMetadata,
  options?: PdfRenderOptions
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const [{ default: pdfMake }, vfsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const vfs = vfsMod.default ?? (vfsMod as unknown as Record<string, string>);
  pdfMake.addVirtualFileSystem(vfs);

  const orientation = options?.orientation === "portrait" ? "portrait" : "landscape";
  const pageSize = options?.pageSize === "A3" || options?.pageSize === "Letter" ? options.pageSize : "A4";
  const showFilterSummary = options?.showFilterSummary !== false;
  const showStatusSummary = options?.showStatusSummary !== false;
  const branding = options?.branding;
  const footerText = (branding?.footerText ?? "").trim() || "DashboardApp";
  const orgName = (branding?.orgName ?? "").trim();
  const coverNote = (options?.coverNote ?? "").trim();
  const summaryBullets = (options?.summaryBullets ?? [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);

  // Logo verisi (paralel olarak data-uri'ye dönüştür)
  const logoDataUri = branding?.logoUrl ? await loadImageDataUri(branding.logoUrl) : null;

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
        ...(showStatusSummary ? [`Durum özeti: ${metadata.statusSummary}`] : []),
      ]
    : [];
  const filterLines = showFilterSummary && metadata?.filterSummary?.length
    ? metadata.filterSummary.map((line) => `• ${line}`)
    : [];

  // Üst marj — kurumsal başlık varsa biraz daha geniş
  const hasBrandingBand = !!(logoDataUri || orgName);
  const topMargin = hasBrandingBand ? 86 : 44;

  type Content = Record<string, unknown>;
  const content: Content[] = [];

  // Kurumsal kimlik bandı (logo solda + ad sağda)
  if (hasBrandingBand) {
    content.push({
      columns: [
        logoDataUri
          ? { image: logoDataUri, fit: [120, 42], alignment: "left" as const, width: 130 }
          : { text: "", width: 130 },
        {
          text: orgName,
          alignment: "right" as const,
          style: "brand",
        },
      ],
      margin: [0, 0, 0, 12] as [number, number, number, number],
    });
  }

  // Başlık + temel metrikler
  content.push(
    { text: titleText, style: "h1", margin: [0, 0, 0, 6] as [number, number, number, number] }
  );

  // Cover note — italik tek paragraf
  if (coverNote) {
    content.push({
      text: coverNote,
      style: "coverNote",
      margin: [0, 0, 0, 8] as [number, number, number, number],
    });
  }

  content.push(
    { text: rowCountText, style: "subheader", margin: [0, 0, 0, 4] as [number, number, number, number] },
    { text: assigneesText, style: "subheader", margin: [0, 0, 0, 8] as [number, number, number, number] }
  );

  // Yönetici özeti — bullet liste
  if (summaryBullets.length > 0) {
    content.push(
      { text: "Yönetici Özeti", style: "metaTitle", margin: [0, 2, 0, 3] as [number, number, number, number] },
      {
        ul: summaryBullets,
        style: "summaryBullet",
        margin: [0, 0, 0, 12] as [number, number, number, number],
      }
    );
  }

  if (metadataLines.length > 0) {
    content.push({
      text: metadataLines.join("\n"),
      style: "meta",
      margin: [0, 0, 0, filterLines.length > 0 ? 6 : 14] as [number, number, number, number],
    });
  }
  if (filterLines.length > 0) {
    content.push(
      { text: "Filtre özeti", style: "metaTitle", margin: [0, 0, 0, 3] as [number, number, number, number] },
      {
        text: filterLines.join("\n"),
        style: "meta",
        margin: [0, 0, 0, 14] as [number, number, number, number],
      }
    );
  }
  content.push({
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
  });

  const docDefinition = {
    pageSize,
    pageOrientation: orientation,
    pageMargins: [36, topMargin, 36, 44] as [number, number, number, number],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: footerText, alignment: "left" as const },
        { text: `Sayfa ${currentPage} / ${pageCount}`, alignment: "right" as const },
      ],
      margin: [36, 0, 36, 18] as [number, number, number, number],
      fontSize: 8,
      color: "#777777",
    }),
    content,
    styles: {
      h1: { fontSize: 14, bold: true },
      brand: { fontSize: 11, bold: true, color: "#334155" },
      coverNote: { fontSize: 10, italics: true, color: "#475569" },
      summaryBullet: { fontSize: 9, color: "#1f2937", lineHeight: 1.25 },
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
  metadata?: PdfExportMetadata,
  options?: PdfRenderOptions
) {
  const pdf = await createTaskPDF(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive, documentTitle, metadata, options);
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
  metadata?: PdfExportMetadata,
  options?: PdfRenderOptions
) {
  const pdf = await createTaskPDF(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive, documentTitle, metadata, options);
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
  mode: EmailTemplateMode,
  options?: PdfRenderOptions
) {
  const { headers, rowArrays } = getExportData(rows, visibleColumnIds, dateFormat, projectById, unmaskSensitive);
  const title = subject.trim() || "Canlı Tablo Görev Raporu";
  const showStatusSummary = options?.showStatusSummary !== false;
  const showFilterSummary = options?.showFilterSummary !== false;
  const branding = options?.branding;
  const footerText = (branding?.footerText ?? "").trim() || "DashboardApp";
  const orgName = (branding?.orgName ?? "").trim();
  const logoUrl = (branding?.logoUrl ?? "").trim();
  const coverNote = (options?.coverNote ?? "").trim();
  const summaryBullets = (options?.summaryBullets ?? [])
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .slice(0, 6);
  const summaryRows = [
    ["Kapsam", metadata.scopeLabel],
    ["Oluşturulma", metadata.generatedAt],
    ["Dışa aktaran", metadata.exportedBy],
    ["Rapor şablonu", metadata.reportTemplateLabel],
    ["Hassas veri", metadata.sensitivityLabel],
    ["Toplam görev", String(rows.length)],
    ...(showStatusSummary ? ([["Durum özeti", metadata.statusSummary]] as Array<[string, string]>) : []),
  ];
  const filterItems = showFilterSummary
    ? metadata.filterSummary.length > 0
      ? metadata.filterSummary
      : ["Ek filtre uygulanmadı."]
    : [];
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
  const brandingBand =
    logoUrl || orgName
      ? `
  <table role="presentation" style="border-collapse:collapse;width:100%;max-width:680px;margin:0 0 14px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">
    <tbody>
      <tr>
        <td style="vertical-align:middle;padding:0 0 10px;">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(orgName || "Kurum logosu")}" style="max-height:42px;max-width:200px;display:block;" />` : ""}
        </td>
        <td style="vertical-align:middle;text-align:right;padding:0 0 10px;font-size:13px;font-weight:600;color:#334155;">
          ${escapeHtml(orgName)}
        </td>
      </tr>
    </tbody>
  </table>`
      : "";

  const coverNoteBlock = coverNote
    ? `<p style="font-style:italic;color:#475569;font-size:13px;margin:0 0 14px;">${escapeHtml(coverNote)}</p>`
    : "";

  const summaryBulletsBlock =
    summaryBullets.length > 0
      ? `
  <h3 style="font-size:14px;margin:14px 0 6px;color:#1f2937;">Yönetici Özeti</h3>
  <ul style="margin:0 0 16px;padding-left:20px;color:#0f172a;font-size:13px;line-height:1.5;">
    ${summaryBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
  </ul>`
      : "";

  const filterBlock =
    filterItems.length > 0
      ? `
  <h3 style="font-size:14px;margin:16px 0 8px;">Filtre özeti</h3>
  <ul style="margin:0 0 16px;padding-left:20px;">
    ${filterItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
  </ul>`
      : "";

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.45;max-width:680px;">
  ${brandingBand}
  <p>Merhaba,</p>
  <p>${escapeHtml(title)} aşağıdadır.</p>
  <h2 style="font-size:18px;margin:18px 0 10px;">${escapeHtml(title)}</h2>
  ${coverNoteBlock}
  ${summaryBulletsBlock}
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
  ${filterBlock}
  ${bodyContent}
  <p style="margin-top:16px;color:#64748b;font-size:12px;">${escapeHtml(footerText)} üzerinden oluşturuldu.</p>
</div>`.trim();
  const text = [
    ...(orgName ? [orgName, ""] : []),
    "Merhaba,",
    "",
    `${title} aşağıdadır.`,
    ...(coverNote ? ["", coverNote] : []),
    ...(summaryBullets.length > 0
      ? ["", "Yönetici Özeti:", ...summaryBullets.map((b) => `- ${b}`)]
      : []),
    "",
    ...summaryRows.map(([label, value]) => `${label}: ${value}`),
    ...(filterItems.length > 0 ? ["", "Filtre özeti:", ...filterItems.map((item) => `- ${item}`)] : []),
    "",
    mode === "mobile" && hiddenMobileRowCount > 0
      ? `Görevler: İlk ${maxMobileRows} kayıt gösteriliyor, ${hiddenMobileRowCount} kayıt e-posta gövdesinde gizlendi.`
      : "Görevler:",
    [headers.join("\t"), ...(mode === "mobile" ? mobileRows : rowArrays).map((row) => row.join("\t"))].join("\n"),
    "",
    `— ${footerText}`,
  ].join("\n");
  return { subject: title, html, text };
}
