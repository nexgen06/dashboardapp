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

export type RemoveExtraColumnImpact = {
  projects: Project[];
  taskCount: number;
};

export type RemoveExtraColumnDialogProps = {
  columnKey: string | null;
  onColumnKeyChange: Dispatch<SetStateAction<string | null>>;
  removing: boolean;
  impact: RemoveExtraColumnImpact;
  onConfirm: () => void | Promise<void>;
};

export function RemoveExtraColumnDialog({
  columnKey,
  onColumnKeyChange,
  removing,
  impact,
  onConfirm,
}: RemoveExtraColumnDialogProps) {
  return (
    <Dialog
      open={columnKey != null}
      onOpenChange={(open) => {
        if (!open && !removing) onColumnKeyChange(null);
      }}
    >
      <DialogContent className="sm:max-w-md" showClose>
        <DialogHeader>
          <DialogTitle>Sütunu kaldır: “{columnKey}”</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              {impact.projects.length === 0 && impact.taskCount === 0 ? (
                <p>Bu sütun aktif kapsamda görünmüyor; kaldıracak bir şey yok.</p>
              ) : (
                <>
                  <p>
                    Aşağıdaki değişiklikler uygulanacak. <strong>Bu işlem geri alınamaz.</strong>
                  </p>
                  <ul className="ml-4 list-disc space-y-1">
                    <li>
                      <strong>{impact.projects.length}</strong> projenin şemasından (“Canlı tablo ek sütunları”)
                      kaldırılacak.
                    </li>
                    <li>
                      <strong>{impact.taskCount}</strong> görevdeki bu alanın verisi silinecek.
                    </li>
                  </ul>
                  {impact.projects.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Etkilenen projeler:{" "}
                      {impact.projects
                        .slice(0, 3)
                        .map((p) => p.name)
                        .join(", ")}
                      {impact.projects.length > 3 ? ` +${impact.projects.length - 3} daha` : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onColumnKeyChange(null)}
            disabled={removing}
          >
            İptal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={removing || (impact.projects.length === 0 && impact.taskCount === 0)}
          >
            {removing ? "Kaldırılıyor…" : "Sütunu kaldır"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
