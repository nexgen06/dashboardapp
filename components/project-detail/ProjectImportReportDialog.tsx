"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportValidationReport } from "@/lib/taskImportWizard";

export type ProjectImportReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inserted: number;
  report: ImportValidationReport | null;
};

export function ProjectImportReportDialog({
  open,
  onOpenChange,
  inserted,
  report,
}: ProjectImportReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            İçe aktarma tamamlandı
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p className="text-slate-700 dark:text-slate-200">
            <strong>{inserted}</strong> görev projeye eklendi.
          </p>
          {report && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
              <dt className="text-slate-500 dark:text-slate-400">Dosyadaki satır</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{report.totalRows}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Eklenen</dt>
              <dd className="font-medium text-emerald-700 dark:text-emerald-300">{report.validRows}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Atlanan (boş)</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{report.skippedEmptyRows}</dd>
            </dl>
          )}
          {report && report.emptyColumns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Tamamen boş sütunlar</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{report.emptyColumns.join(", ")}</p>
            </div>
          )}
          {report && report.duplicateHeaders.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Yinelenen başlık: {report.duplicateHeaders.join(", ")}
            </p>
          )}
          {report && report.duplicateContentWarnings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Olası mükerrer başlıklar</p>
              <ul className="mt-1 list-disc ps-4 text-xs text-amber-700 dark:text-amber-300">
                {report.duplicateContentWarnings.slice(0, 5).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {report && report.warnings.length > 0 && (
            <ul className="list-disc space-y-1 ps-4 text-xs text-slate-600 dark:text-slate-400">
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)} className="bg-blue-600 hover:bg-blue-700">
            Tamam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
