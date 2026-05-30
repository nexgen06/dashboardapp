"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RenameExtraColumnDraft } from "@/components/tasks-table/useTasksTableRenameExtraColumn";

export type RenameExtraColumnImpact = {
  projects: Project[];
  taskCount: number;
};

export type RenameExtraColumnDialogProps = {
  draft: RenameExtraColumnDraft | null;
  onDraftChange: Dispatch<SetStateAction<RenameExtraColumnDraft | null>>;
  renaming: boolean;
  impact: RenameExtraColumnImpact;
  onConfirm: () => void | Promise<void>;
};

export function RenameExtraColumnDialog({
  draft,
  onDraftChange,
  renaming,
  impact,
  onConfirm,
}: RenameExtraColumnDialogProps) {
  return (
    <Dialog
      open={draft != null}
      onOpenChange={(open) => {
        if (!open && !renaming) onDraftChange(null);
      }}
    >
      <DialogContent className="sm:max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>Sütunu yeniden adlandır</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Sütun adı proje şemasında, görev verilerinde ve çip bağlantılarında birlikte güncellenir.
              </p>
              {impact.projects.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Etkilenen: <strong>{impact.projects.length}</strong> proje,{" "}
                  <strong>{impact.taskCount}</strong> görev satırı
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Mevcut ad
              <input
                value={draft.oldKey}
                readOnly
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Yeni ad
              <input
                value={draft.newKey}
                onChange={(e) =>
                  onDraftChange((prev) => (prev ? { ...prev, newKey: e.target.value } : prev))
                }
                placeholder="Mail Durumu"
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Akıllı çip preset&apos;leri için tam eşleşme gerekir (ör. <strong>Mail Durumu</strong>).
            </p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={renaming}
            onClick={() => onDraftChange(null)}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            disabled={renaming || !draft?.newKey.trim()}
            onClick={() => void onConfirm()}
          >
            {renaming ? "Kaydediliyor…" : "Yeniden adlandır"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
