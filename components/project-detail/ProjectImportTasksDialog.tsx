"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { collectColumnValues, type ImportAssignmentMode } from "@/lib/importAssignment";
import { findAssigneeColumnIndex } from "@/lib/projectImportAssignee";
import {
  applyProjectImportAssignment,
  validateImportAssignmentOptions,
} from "@/lib/projectImportApplyAssignment";
import {
  STANDARD_FIELD_LABELS,
  autoColumnMapping,
  buildTaskImportRows,
  headerKey,
  parseImportFile,
  validateImportData,
  type ImportColumnMapping,
  type ImportValidationReport,
  type ParsedImportFile,
  type StandardTaskField,
  type TaskImportRow,
} from "@/lib/taskImportWizard";

const STANDARD_FIELDS: StandardTaskField[] = [
  "content",
  "status",
  "assignee",
  "priority",
  "due_date",
];

type WizardStep = "file" | "mapping" | "assignment" | "confirm";

const STEP_LABELS: Record<WizardStep, string> = {
  file: "Dosya",
  mapping: "Eşleme",
  assignment: "Atama",
  confirm: "Özet",
};

export type ProjectImportTasksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedEmails: string[];
  defaultStatus?: string;
  defaultPriority?: string | null;
  importing?: boolean;
  onImport: (tasks: TaskImportRow[], report: ImportValidationReport) => Promise<void>;
};

export function ProjectImportTasksDialog({
  open,
  onOpenChange,
  assignedEmails,
  defaultStatus = "Yapılacak",
  defaultPriority = null,
  importing = false,
  onImport,
}: ProjectImportTasksDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({});
  const [error, setError] = useState<string | null>(null);

  const [importAssignmentMode, setImportAssignmentMode] = useState<ImportAssignmentMode>("unassigned");
  const [importDefaultAssignee, setImportDefaultAssignee] = useState("");
  const [importColumnValueOptions, setImportColumnValueOptions] = useState<Record<string, string[]>>({});
  const [importGroupByColumn, setImportGroupByColumn] = useState("");
  const [importGroupAssignments, setImportGroupAssignments] = useState<Record<string, string>>({});
  const [importRowRangesText, setImportRowRangesText] = useState("");

  const reset = useCallback(() => {
    setStep("file");
    setImportFile(null);
    setParsed(null);
    setColumnMapping({});
    setError(null);
    setImportAssignmentMode("unassigned");
    setImportDefaultAssignee("");
    setImportColumnValueOptions({});
    setImportGroupByColumn("");
    setImportGroupAssignments({});
    setImportRowRangesText("");
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const next = parseImportFile(text, file.name);
      if (next.headers.length === 0) {
        setError("Dosyada sütun başlığı bulunamadı.");
        return;
      }
      const mapping = autoColumnMapping(next.headers);
      const valueOptions: Record<string, string[]> = {};
      for (const h of next.headers) {
        const key = (h ?? "").trim() || h;
        valueOptions[key] = collectColumnValues(next.headers, next.rows, key);
      }
      const hasAssignee = findAssigneeColumnIndex(next.headers) != null || mapping.assignee != null;
      setImportFile(file);
      setParsed(next);
      setColumnMapping(mapping);
      setImportColumnValueOptions(valueOptions);
      setImportGroupByColumn("");
      setImportGroupAssignments({});
      setImportRowRangesText("");
      setImportAssignmentMode(hasAssignee ? "file" : "unassigned");
      setStep("file");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dosya okunamadı.");
    }
  }, []);

  const validationReport = useMemo(() => {
    if (!parsed) return null;
    return validateImportData(parsed.headers, parsed.rows, columnMapping);
  }, [parsed, columnMapping]);

  const builtPreview = useMemo(() => {
    if (!parsed) return null;
    return buildTaskImportRows(parsed.headers, parsed.rows, columnMapping, {
      defaultStatus,
      defaultPriority,
    });
  }, [parsed, columnMapping, defaultStatus, defaultPriority]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const setMappingField = (field: StandardTaskField, index: number | null) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (index == null || index < 0) {
        delete next[field];
      } else {
        next[field] = index;
      }
      return next;
    });
  };

  const goNext = () => {
    setError(null);
    if (step === "file") {
      if (!parsed) {
        setError("Önce bir dosya seçin.");
        return;
      }
      setStep("mapping");
      return;
    }
    if (step === "mapping") {
      if (validationReport && validationReport.duplicateHeaders.length > 0) {
        setError(`Yinelenen sütun başlıkları düzeltilmeli: ${validationReport.duplicateHeaders.join(", ")}`);
        return;
      }
      setStep("assignment");
      return;
    }
    if (step === "assignment") {
      const defaultAssignee = importDefaultAssignee.trim().toLowerCase() || null;
      const assignmentError = validateImportAssignmentOptions(importAssignmentMode, {
        defaultAssignee,
        assignedEmails,
        rowRangesText: importRowRangesText,
        groupByColumn: importGroupByColumn,
      });
      if (assignmentError) {
        setError(assignmentError);
        return;
      }
      setStep("confirm");
    }
  };

  const goBack = () => {
    setError(null);
    if (step === "mapping") setStep("file");
    else if (step === "assignment") setStep("mapping");
    else if (step === "confirm") setStep("assignment");
  };

  const handleImport = async () => {
    if (!parsed || !builtPreview) return;
    setError(null);
    const defaultAssignee = importDefaultAssignee.trim().toLowerCase() || null;
    const assignmentError = validateImportAssignmentOptions(importAssignmentMode, {
      defaultAssignee,
      assignedEmails,
      rowRangesText: importRowRangesText,
      groupByColumn: importGroupByColumn,
    });
    if (assignmentError) {
      setError(assignmentError);
      return;
    }

    let tasks = builtPreview.tasks;
    tasks = applyProjectImportAssignment(tasks, {
      mode: importAssignmentMode,
      assignedEmails,
      defaultAssignee,
      groupByColumn: importGroupByColumn,
      groupAssignments: importGroupAssignments,
      rowRangesText: importRowRangesText,
      headers: parsed.headers,
      sourceRows: parsed.rows,
    });

    if (tasks.length === 0) {
      setError("İçe aktarılacak geçerli satır bulunamadı.");
      return;
    }

    const report: ImportValidationReport = {
      ...(validationReport ?? builtPreview.report),
      duplicateHeaders: validationReport?.duplicateHeaders ?? [],
      emptyColumns: validationReport?.emptyColumns ?? [],
      validRows: tasks.length,
    };

    try {
      await onImport(tasks, report);
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "İçe aktarma tamamlanamadı.");
    }
  };

  const importHasAssigneeColumn =
    findAssigneeColumnIndex(parsed?.headers ?? []) != null || columnMapping.assignee != null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CSV / JSON ile toplu görev ekle</DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adım {Object.keys(STEP_LABELS).indexOf(step) + 1}/4 · {STEP_LABELS[step]}
          </p>
        </DialogHeader>

        <div className="flex gap-1 py-1">
          {(Object.keys(STEP_LABELS) as WizardStep[]).map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full",
                step === s ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
              )}
            />
          ))}
        </div>

        <div className="space-y-4 py-2">
          {step === "file" && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                CSV veya JSON dosyası seçin. Sonraki adımda sütun eşlemesi ve önizleme gösterilir.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void processFile(file);
                }}
                className="hidden"
                aria-hidden
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {importFile ? importFile.name : "Dosya seç"}
              </Button>
              {parsed && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
                  <p className="font-medium text-emerald-800 dark:text-emerald-200">
                    {parsed.headers.length} sütun · {parsed.rows.length} satır
                  </p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    {parsed.headers.slice(0, 6).join(", ")}
                    {parsed.headers.length > 6 ? ` +${parsed.headers.length - 6} daha` : ""}
                  </p>
                </div>
              )}
              {parsed && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        {parsed.headers.map((h, i) => (
                          <th key={`${h}-${i}`} className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300">
                            {headerKey(parsed.headers, i)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 8).map((row, ri) => (
                        <tr key={ri} className="border-t border-slate-100 dark:border-slate-700">
                          {row.map((cell, ci) => (
                            <td key={ci} className="max-w-[8rem] truncate px-2 py-1 text-slate-700 dark:text-slate-200">
                              {cell || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > 8 && (
                    <p className="border-t border-slate-100 px-2 py-1 text-[10px] text-slate-500 dark:border-slate-700">
                      +{parsed.rows.length - 8} satır daha
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {step === "mapping" && parsed && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sistem alanlarını dosya sütunlarıyla eşleştirin. Eşlenmeyen sütunlar{" "}
                <code className="text-xs">extra_data</code> olarak kaydedilir (örn. İl → extra_data.İl).
              </p>
              <div className="space-y-2">
                {STANDARD_FIELDS.map((field) => (
                  <label key={field} className="grid gap-1 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {STANDARD_FIELD_LABELS[field]}
                    </span>
                    <select
                      value={columnMapping[field] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMappingField(field, v === "" ? null : Number(v));
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">— Eşleme yok —</option>
                      {parsed.headers.map((h, i) => (
                        <option key={`${field}-${i}`} value={i}>
                          {headerKey(parsed.headers, i)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === "assignment" && parsed && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {importHasAssigneeColumn
                  ? "Dosyada atanan sütunu var; istersen farklı bir dağıtım seçebilirsin."
                  : "Satırların nasıl atanacağını seç."}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {importHasAssigneeColumn && (
                  <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs", importAssignmentMode === "file" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 dark:border-slate-700 dark:text-slate-300")}>
                    <input type="radio" name="project-import-assignment-mode" checked={importAssignmentMode === "file"} onChange={() => setImportAssignmentMode("file")} className="mt-0.5" />
                    <span><strong>Dosyadaki atanan</strong><br />Sütun / eşlemeden gelir.</span>
                  </label>
                )}
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs", importAssignmentMode === "unassigned" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 dark:border-slate-700 dark:text-slate-300")}>
                  <input type="radio" name="project-import-assignment-mode" checked={importAssignmentMode === "unassigned"} onChange={() => setImportAssignmentMode("unassigned")} className="mt-0.5" />
                  <span><strong>Atanmamış</strong></span>
                </label>
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs", importAssignmentMode === "single" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 dark:border-slate-700 dark:text-slate-300")}>
                  <input type="radio" name="project-import-assignment-mode" checked={importAssignmentMode === "single"} onChange={() => setImportAssignmentMode("single")} className="mt-0.5" />
                  <span><strong>Tek kişiye ata</strong></span>
                </label>
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs", importAssignmentMode === "roundRobin" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 dark:border-slate-700 dark:text-slate-300", assignedEmails.length < 2 && "opacity-60")}>
                  <input type="radio" name="project-import-assignment-mode" checked={importAssignmentMode === "roundRobin"} disabled={assignedEmails.length < 2} onChange={() => setImportAssignmentMode("roundRobin")} className="mt-0.5" />
                  <span><strong>Eşit dağıt</strong></span>
                </label>
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs", importAssignmentMode === "groupByColumn" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 dark:border-slate-700 dark:text-slate-300")}>
                  <input type="radio" name="project-import-assignment-mode" checked={importAssignmentMode === "groupByColumn"} onChange={() => setImportAssignmentMode("groupByColumn")} className="mt-0.5" />
                  <span><strong>Sütuna göre</strong></span>
                </label>
                <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs", importAssignmentMode === "rowRanges" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 dark:border-slate-700 dark:text-slate-300")}>
                  <input type="radio" name="project-import-assignment-mode" checked={importAssignmentMode === "rowRanges"} onChange={() => setImportAssignmentMode("rowRanges")} className="mt-0.5" />
                  <span><strong>Satır aralığı</strong></span>
                </label>
              </div>
              {importAssignmentMode === "single" && (
                <input
                  type="email"
                  value={importDefaultAssignee}
                  onChange={(e) => setImportDefaultAssignee(e.target.value)}
                  placeholder="atanan@ornek.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              )}
              {importAssignmentMode === "groupByColumn" && (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <select
                    value={importGroupByColumn}
                    onChange={(e) => {
                      setImportGroupByColumn(e.target.value);
                      setImportGroupAssignments({});
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="">Sütun seç</option>
                    {parsed.headers.map((h, i) => (
                      <option key={i} value={(h ?? "").trim() || h}>
                        {headerKey(parsed.headers, i)}
                      </option>
                    ))}
                  </select>
                  {importGroupByColumn &&
                    (importColumnValueOptions[importGroupByColumn] ?? []).map((value) => (
                      <label key={value} className="grid gap-1 text-xs sm:grid-cols-2">
                        <span className="truncate rounded bg-slate-50 px-2 py-1 dark:bg-slate-800">{value}</span>
                        <input
                          type="email"
                          value={importGroupAssignments[value] ?? ""}
                          onChange={(e) =>
                            setImportGroupAssignments((prev) => ({
                              ...prev,
                              [value]: e.target.value.trim().toLowerCase(),
                            }))
                          }
                          placeholder="atanan@ornek.com"
                          className="rounded border border-slate-200 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                        />
                      </label>
                    ))}
                </div>
              )}
              {importAssignmentMode === "rowRanges" && (
                <textarea
                  value={importRowRangesText}
                  onChange={(e) => setImportRowRangesText(e.target.value)}
                  rows={4}
                  placeholder={"1-25 ugur@example.com\n26-50 ayse@example.com"}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              )}
            </>
          )}

          {step === "confirm" && validationReport && builtPreview && (
            <>
              <dl className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                <dt className="text-slate-500">Eklenecek görev</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">{builtPreview.tasks.length}</dd>
                <dt className="text-slate-500">Atlanan boş satır</dt>
                <dd>{validationReport.skippedEmptyRows}</dd>
                <dt className="text-slate-500">Boş sütun</dt>
                <dd>{validationReport.emptyColumns.length}</dd>
              </dl>
              {validationReport.warnings.length > 0 && (
                <ul className="list-disc space-y-1 ps-4 text-xs text-amber-700 dark:text-amber-300">
                  {validationReport.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {builtPreview.tasks[0] && (
                <div className="rounded border border-slate-200 p-2 text-xs dark:border-slate-700">
                  <p className="font-medium text-slate-600 dark:text-slate-300">Örnek ilk görev</p>
                  <p className="mt-1 truncate text-slate-800 dark:text-slate-100">
                    {builtPreview.tasks[0].content || "—"} · {builtPreview.tasks[0].status}
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step !== "file" && (
              <Button type="button" variant="ghost" size="sm" onClick={goBack} disabled={importing}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Geri
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
              İptal
            </Button>
            {step !== "confirm" ? (
              <Button type="button" onClick={goNext} disabled={!parsed || importing} className="bg-blue-600 hover:bg-blue-700">
                İleri
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleImport()} disabled={importing} className="bg-blue-600 hover:bg-blue-700">
                {importing ? "Ekleniyor…" : "Görevleri ekle"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
