"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportFormatButton, ExportToggleSwitch } from "@/components/tasks-table/ExportModalControls";
import {
  builtinReportTemplateSelection,
  customReportTemplateSelection,
  managedReportTemplateSelection,
  type ReportTemplateSelection,
} from "@/components/tasks-table/constants";
import {
  REPORT_TEMPLATES,
  type EmailTemplateMode,
  type PdfExportScope,
  type ReportTemplateId,
} from "@/lib/liveTableExport";
import { FILTER_PRESET_LABELS } from "@/lib/reportTemplates";
import type { SavedReportTemplate } from "@/lib/reportTemplateStorage";
import type { ManagedReportTemplate } from "@/lib/reportTemplates";
import type { Task } from "@/types/tasks";
import {
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  LockKeyhole,
  Mail,
  PlusCircle,
  Printer,
  Table2,
  Trash2,
} from "lucide-react";

export type TasksTableExportDialogsProps = {
  exportDialogOpen: boolean;
  setExportDialogOpen: Dispatch<SetStateAction<boolean>>;
  pdfDialogOpen: boolean;
  handlePdfDialogOpenChange: (open: boolean) => void;
  emailDialogOpen: boolean;
  setEmailDialogOpen: Dispatch<SetStateAction<boolean>>;
  pdfDialogScope: PdfExportScope;
  exportScopeLabel: string;
  exportSensitivityLabel: string;
  exportCurrentRows: Task[];
  exportAllRows: Task[];
  canExportSensitiveUnmasked: boolean;
  exportUnmaskSensitive: boolean;
  setExportUnmaskSensitive: Dispatch<SetStateAction<boolean>>;
  canExportAllRows: boolean;
  exportIncludeAutoRowNumber: boolean;
  setExportIncludeAutoRowNumber: Dispatch<SetStateAction<boolean>>;
  handleExportCSV: (scope: PdfExportScope) => void;
  handleExportExcel: (scope: PdfExportScope) => void;
  openPdfDialog: (scope: PdfExportScope) => void;
  openEmailDialog: (scope: PdfExportScope) => void;
  reportTemplateSelection: ReportTemplateSelection;
  applyReportTemplate: (selection: ReportTemplateSelection) => void;
  savedReportTemplates: SavedReportTemplate[];
  availableManagedReportTemplates: ManagedReportTemplate[];
  selectedReportTemplate: { label: string; description: string };
  selectedManagedReportTemplate: ManagedReportTemplate | null;
  selectedCustomReportTemplate: SavedReportTemplate | null;
  saveCurrentReportTemplate: () => void | Promise<void>;
  deleteSelectedReportTemplate: () => void;
  selectedPdfRows: Task[];
  selectedPdfTitle: string | null;
  pdfTitleInput: string;
  setPdfTitleInput: Dispatch<SetStateAction<string>>;
  pdfPreviewUrl: string | null;
  setPdfPreviewUrl: Dispatch<SetStateAction<string | null>>;
  pdfPreviewIframeRef: RefObject<HTMLIFrameElement>;
  previewExportPDF: () => void | Promise<void>;
  confirmExportPDF: () => void | Promise<void>;
  printPdfPreview: () => void;
  pdfPreviewLoading: boolean;
  pdfDownloadLoading: boolean;
  emailSubjectInput: string;
  setEmailSubjectInput: Dispatch<SetStateAction<string>>;
  emailTemplateMode: EmailTemplateMode;
  setEmailTemplateMode: Dispatch<SetStateAction<EmailTemplateMode>>;
  emailTemplate: { subject: string; text: string; html: string };
  emailCopied: boolean;
  setEmailCopied: Dispatch<SetStateAction<boolean>>;
  copyEmailTemplate: () => void | Promise<void>;
  printEmailTemplate: () => void;
};

export function TasksTableExportDialogs(props: TasksTableExportDialogsProps) {
  const {
    exportDialogOpen,
    setExportDialogOpen,
    pdfDialogOpen,
    handlePdfDialogOpenChange,
    emailDialogOpen,
    setEmailDialogOpen,
    pdfDialogScope,
    exportScopeLabel,
    exportSensitivityLabel,
    exportCurrentRows,
    exportAllRows,
    canExportSensitiveUnmasked,
    exportUnmaskSensitive,
    setExportUnmaskSensitive,
    canExportAllRows,
    exportIncludeAutoRowNumber,
    setExportIncludeAutoRowNumber,
    handleExportCSV,
    handleExportExcel,
    openPdfDialog,
    openEmailDialog,
    reportTemplateSelection,
    applyReportTemplate,
    savedReportTemplates,
    availableManagedReportTemplates,
    selectedReportTemplate,
    selectedManagedReportTemplate,
    selectedCustomReportTemplate,
    saveCurrentReportTemplate,
    deleteSelectedReportTemplate,
    selectedPdfRows,
    selectedPdfTitle,
    pdfTitleInput,
    setPdfTitleInput,
    pdfPreviewUrl,
    setPdfPreviewUrl,
    pdfPreviewIframeRef,
    previewExportPDF,
    confirmExportPDF,
    printPdfPreview,
    pdfPreviewLoading,
    pdfDownloadLoading,
    emailSubjectInput,
    setEmailSubjectInput,
    emailTemplateMode,
    setEmailTemplateMode,
    emailTemplate,
    emailCopied,
    setEmailCopied,
    copyEmailTemplate,
    printEmailTemplate,
  } = props;

  return (
    <>
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogContent
                className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-0 shadow-[0_24px_64px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95"
                showClose
              >
                <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-white/80 to-blue-50/40 px-6 py-5 dark:border-slate-700/80 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-blue-950/20">
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                      Dışa aktar
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                      Verileri güvenli kapsamınız içinde indirin veya paylaşın.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Yetki kapsamı
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{exportScopeLabel}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{exportSensitivityLabel}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100">
                      {exportCurrentRows.length} satır
                    </span>
                  </div>
                </div>

                <div className="space-y-4 px-6 py-5">
                  {canExportSensitiveUnmasked && (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm backdrop-blur-sm",
                        exportUnmaskSensitive
                          ? "border-amber-300/80 bg-amber-50/90 dark:border-amber-700/60 dark:bg-amber-950/35"
                          : "border-slate-200/80 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          exportUnmaskSensitive
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                            : "bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400"
                        )}
                      >
                        <LockKeyhole className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              Hassas verileri AÇIK indir
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                              TCKN/sicil/personel no maskeli yerine ham yazılır.{" "}
                              <span className="font-medium text-amber-700 dark:text-amber-300">Özel yetki gerekir.</span>
                            </p>
                          </div>
                          <ExportToggleSwitch
                            id="export-unmask-toggle"
                            checked={exportUnmaskSensitive}
                            onChange={setExportUnmaskSensitive}
                            aria-label="Hassas verileri açık indir"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {!canExportAllRows && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                      Üye export kapsamı yalnızca düzenleyebildiğiniz satırlarla sınırlıdır.
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Otomatik Sıra</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Dışa aktarılan her satıra 1&apos;den başlayan sıra numarası ekler.
                      </p>
                    </div>
                    <ExportToggleSwitch
                      id="export-auto-row-toggle"
                      checked={exportIncludeAutoRowNumber}
                      onChange={setExportIncludeAutoRowNumber}
                      aria-label="Otomatik sıra numarası ekle"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white/90 to-slate-50/50 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-950/40">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            Mevcut görünüm
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Filtre ve sıralama uygulanmış</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          {exportCurrentRows.length}
                        </span>
                      </div>
                      <div className="grid gap-2">
                        <ExportFormatButton
                          label="CSV"
                          sublabel=".csv indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportCSV("current");
                          }}
                        />
                        <ExportFormatButton
                          label="Excel"
                          sublabel=".xlsx indir"
                          icon={<Table2 className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportExcel("current");
                          }}
                        />
                        <ExportFormatButton
                          label="PDF"
                          sublabel="Önizleme ile indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            openPdfDialog("current");
                          }}
                        />
                        <ExportFormatButton
                          label="E-posta şablonu"
                          sublabel="HTML kopyala"
                          icon={<Mail className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            openEmailDialog("current");
                          }}
                        />
                      </div>
                    </section>

                    <section
                      className={cn(
                        "rounded-xl border p-4 shadow-sm",
                        canExportAllRows
                          ? "border-slate-200/80 bg-gradient-to-b from-white/90 to-slate-50/50 dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-950/40"
                          : "border-dashed border-slate-200 bg-slate-50/40 opacity-70 dark:border-slate-700 dark:bg-slate-900/30"
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            Tüm veri
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Ham / yetkili tam kapsam</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {exportAllRows.length}
                        </span>
                      </div>
                      <div className="grid gap-2">
                        <ExportFormatButton
                          label="CSV"
                          sublabel=".csv indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportCSV("all");
                          }}
                        />
                        <ExportFormatButton
                          label="Excel"
                          sublabel=".xlsx indir"
                          icon={<Table2 className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportExcel("all");
                          }}
                        />
                        <ExportFormatButton
                          label="PDF"
                          sublabel="Önizleme ile indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            openPdfDialog("all");
                          }}
                        />
                        <ExportFormatButton
                          label="E-posta şablonu"
                          sublabel="HTML kopyala"
                          icon={<Mail className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            openEmailDialog("all");
                          }}
                        />
                      </div>
                    </section>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
      <Dialog open={pdfDialogOpen} onOpenChange={handlePdfDialogOpenChange}>
        <DialogContent className="h-[min(92vh,920px)] max-w-[min(96vw,1440px)] overflow-hidden border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" showClose>
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 text-left dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div>
                  <DialogTitle>PDF İndir</DialogTitle>
                  <DialogDescription>
                    {pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm"} için indirilecek PDF&apos;i geniş önizleme alanında kontrol edin.
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {selectedPdfRows.length} satır
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm"}
                  </span>
                  {selectedManagedReportTemplate && (
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                      {selectedManagedReportTemplate.template_config.pdfPageSize} · {selectedManagedReportTemplate.template_config.pdfOrientation === "portrait" ? "Dikey" : "Yatay"}
                    </span>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 bg-slate-100 dark:bg-slate-950 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                <div>
                  <label htmlFor="pdf-report-template" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Rapor şablonu
                  </label>
                  <select
                    id="pdf-report-template"
                    value={reportTemplateSelection}
                    onChange={(e) => applyReportTemplate(e.target.value as ReportTemplateSelection)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {Object.entries(REPORT_TEMPLATES).map(([id, template]) => (
                      <option key={id} value={builtinReportTemplateSelection(id as ReportTemplateId)}>
                        {template.label}
                      </option>
                    ))}
                    {savedReportTemplates.length > 0 && (
                      <optgroup label="Kayıtlı özel şablonlar">
                        {savedReportTemplates.map((template) => (
                          <option key={template.id} value={customReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {availableManagedReportTemplates.length > 0 && (
                      <optgroup label="Kurumsal şablonlar">
                        {availableManagedReportTemplates.map((template) => (
                          <option key={template.id} value={managedReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedReportTemplate.description}
                  </p>
                  {selectedManagedReportTemplate &&
                    (selectedManagedReportTemplate.template_config.defaultFilterPresets.length > 0 ||
                      selectedManagedReportTemplate.template_config.defaultSavedViewId ||
                      selectedManagedReportTemplate.template_config.showLogo ||
                      selectedManagedReportTemplate.template_config.coverNote ||
                      selectedManagedReportTemplate.template_config.summaryBullets.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1.5 dark:border-blue-800 dark:bg-blue-950/30">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Şablon ayarları:
                        </span>
                        {selectedManagedReportTemplate.template_config.showLogo && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            🏷 Logo bandı
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.coverNote && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            📝 Kapak notu
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.summaryBullets.length > 0 && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            ✦ Özet ({selectedManagedReportTemplate.template_config.summaryBullets.length})
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.defaultFilterPresets.map((id) => (
                          <span key={id} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            ⚡ {FILTER_PRESET_LABELS[id]}
                          </span>
                        ))}
                        {selectedManagedReportTemplate.template_config.defaultSavedViewId && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            📌 Kayıtlı görünüm
                          </span>
                        )}
                      </div>
                    )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void saveCurrentReportTemplate()}>
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Kaydet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deleteSelectedReportTemplate}
                      disabled={!selectedCustomReportTemplate}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Sil
                    </Button>
                  </div>
                </div>
                <div>
                  <label htmlFor="pdf-title-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Belge Başlığı
                  </label>
                  <input
                    id="pdf-title-input"
                    type="text"
                    value={pdfTitleInput}
                    onChange={(e) => {
                      setPdfTitleInput(e.target.value);
                      if (pdfPreviewUrl) {
                        URL.revokeObjectURL(pdfPreviewUrl);
                        setPdfPreviewUrl(null);
                      }
                    }}
                    placeholder="Görev Listesi"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void previewExportPDF();
                      }
                    }}
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {selectedPdfRows.length} satır PDF&apos;e eklenecek
                  </div>
                  <div className="mt-1">
                    Sütunlar canlı tablodaki görünür kolonlardan alınır.
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                  <input
                    type="checkbox"
                    checked={exportIncludeAutoRowNumber}
                    onChange={(e) => {
                      setExportIncludeAutoRowNumber(e.target.checked);
                      if (pdfPreviewUrl) {
                        URL.revokeObjectURL(pdfPreviewUrl);
                        setPdfPreviewUrl(null);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500"
                  />
                  <span className="leading-snug text-slate-700 dark:text-slate-200">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Otomatik Sıra</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                      İlk sütuna 1..{selectedPdfRows.length || "N"} arası sıra numarası ekler.
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void previewExportPDF()}
                  disabled={pdfPreviewLoading || pdfDownloadLoading}
                  className="w-full justify-center"
                >
                  {pdfPreviewLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Önizle
                </Button>
              </div>
              </aside>

              <section className="flex min-h-0 flex-col p-3 sm:p-4">
                <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {selectedPdfTitle || "Görev Listesi"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {pdfPreviewUrl ? "Önizleme hazır. İçeriği kontrol edip indirebilirsiniz." : "Önizleme oluşturulmadı."}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void previewExportPDF()}
                    disabled={pdfPreviewLoading || pdfDownloadLoading}
                  >
                    {pdfPreviewLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    Önizle
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-slate-200 shadow-inner dark:border-slate-700 dark:bg-slate-950">
                  {pdfPreviewUrl ? (
                    <iframe
                      ref={pdfPreviewIframeRef}
                      title="PDF önizleme"
                      src={pdfPreviewUrl}
                      className="h-full w-full bg-white"
                    />
                  ) : (
                    <div className="flex h-full min-h-[34rem] items-center justify-center p-6">
                      <div className="max-w-sm rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                          <Eye className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">PDF önizlemesi hazır değil</div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          Şablon, başlık ve kapsamı kontrol ettikten sonra Önizle butonuna basın. PDF burada geniş görüntüleyici olarak açılır.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => handlePdfDialogOpenChange(false)} disabled={pdfDownloadLoading}>
                İptal
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={printPdfPreview}
                disabled={!pdfPreviewUrl || pdfPreviewLoading || pdfDownloadLoading}
                title={pdfPreviewUrl ? "Önizlemeyi yazıcıya gönder" : "Önce önizleme oluşturun"}
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden />
                Yazdır
              </Button>
              <Button type="button" onClick={() => void confirmExportPDF()} disabled={pdfDownloadLoading || pdfPreviewLoading}>
                {pdfDownloadLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                )}
                PDF indir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" showClose>
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-slate-200 px-5 py-4 text-left dark:border-slate-700">
              <DialogTitle>E-posta şablonu</DialogTitle>
              <DialogDescription>
                {pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm"} için e-postaya yapıştırılabilir HTML şablonu oluşturulur.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[18rem_1fr]">
              <div className="space-y-4">
                <div>
                  <label htmlFor="email-report-template" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Rapor şablonu
                  </label>
                  <select
                    id="email-report-template"
                    value={reportTemplateSelection}
                    onChange={(e) => applyReportTemplate(e.target.value as ReportTemplateSelection)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {Object.entries(REPORT_TEMPLATES).map(([id, template]) => (
                      <option key={id} value={builtinReportTemplateSelection(id as ReportTemplateId)}>
                        {template.label}
                      </option>
                    ))}
                    {savedReportTemplates.length > 0 && (
                      <optgroup label="Kayıtlı özel şablonlar">
                        {savedReportTemplates.map((template) => (
                          <option key={template.id} value={customReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {availableManagedReportTemplates.length > 0 && (
                      <optgroup label="Kurumsal şablonlar">
                        {availableManagedReportTemplates.map((template) => (
                          <option key={template.id} value={managedReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedReportTemplate.description}
                  </p>
                  {selectedManagedReportTemplate &&
                    (selectedManagedReportTemplate.template_config.defaultFilterPresets.length > 0 ||
                      selectedManagedReportTemplate.template_config.defaultSavedViewId ||
                      selectedManagedReportTemplate.template_config.showLogo ||
                      selectedManagedReportTemplate.template_config.coverNote ||
                      selectedManagedReportTemplate.template_config.summaryBullets.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1.5 dark:border-blue-800 dark:bg-blue-950/30">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Şablon ayarları:
                        </span>
                        {selectedManagedReportTemplate.template_config.showLogo && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            🏷 Logo bandı
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.coverNote && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            📝 Kapak notu
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.summaryBullets.length > 0 && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            ✦ Özet ({selectedManagedReportTemplate.template_config.summaryBullets.length})
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.defaultFilterPresets.map((id) => (
                          <span key={id} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            ⚡ {FILTER_PRESET_LABELS[id]}
                          </span>
                        ))}
                        {selectedManagedReportTemplate.template_config.defaultSavedViewId && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            📌 Kayıtlı görünüm
                          </span>
                        )}
                      </div>
                    )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void saveCurrentReportTemplate()}>
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Kaydet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deleteSelectedReportTemplate}
                      disabled={!selectedCustomReportTemplate}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Sil
                    </Button>
                  </div>
                </div>
                <div>
                  <label htmlFor="email-subject-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    E-posta konusu
                  </label>
                  <input
                    id="email-subject-input"
                    type="text"
                    value={emailSubjectInput}
                    onChange={(e) => {
                      setEmailSubjectInput(e.target.value);
                      setEmailCopied(false);
                    }}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {selectedPdfRows.length} satır e-posta şablonuna eklenecek
                  </div>
                  <div className="mt-1">
                    Mobil uyumlu mod ilk 30 kaydı kart olarak gösterir; tam liste için detaylı tabloyu seçin.
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Şablon tipi</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={emailTemplateMode === "mobile" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setEmailTemplateMode("mobile");
                        setEmailCopied(false);
                      }}
                    >
                      Mobil uyumlu
                    </Button>
                    <Button
                      type="button"
                      variant={emailTemplateMode === "table" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setEmailTemplateMode("table");
                        setEmailCopied(false);
                      }}
                    >
                      Detaylı tablo
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Düz metin önizleme</div>
                  <textarea
                    readOnly
                    value={emailTemplate.text}
                    className="h-56 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="min-h-[28rem] overflow-auto rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700">
                <div dangerouslySetInnerHTML={{ __html: emailTemplate.html }} />
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/80 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)}>
                Kapat
              </Button>
              <Button type="button" variant="outline" onClick={() => void copyEmailTemplate()}>
                {emailCopied ? (
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="mr-2 h-4 w-4" aria-hidden />
                )}
                {emailCopied ? "Kopyalandı" : "Şablonu kopyala"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={printEmailTemplate}
                title="Şablonu yazıcıya gönder veya PDF olarak kaydet"
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden />
                Yazdır
              </Button>
              <Button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:?subject=${encodeURIComponent(emailTemplate.subject)}&body=${encodeURIComponent(emailTemplate.text)}`;
                }}
              >
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                Mailde aç
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
