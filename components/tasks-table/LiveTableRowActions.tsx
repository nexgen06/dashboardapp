"use client";

import { useCallback, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import { buildCommandPaletteTaskHref } from "@/lib/commandPaletteSearch";
import {
  WORKFLOW_ACTION_LABELS,
  type TaskWorkflowAction,
} from "@/lib/taskWorkflow";
import {
  Copy as CopyIcon,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

const iconBtnClass =
  "rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200";

type ToastApi = {
  success: (msg: string) => void;
  error: (msg: string) => void;
};

export function LiveTableRowActions({
  task,
  rowCanEdit,
  isDeleting,
  canShowCopy,
  canShowDelete,
  workflowActions,
  iconClass,
  onDetail,
  onEdit,
  onDuplicate,
  onDelete,
  onWorkflow,
  toast,
}: {
  task: Task;
  rowCanEdit: boolean;
  isDeleting: boolean;
  canShowCopy: boolean;
  canShowDelete: boolean;
  workflowActions: TaskWorkflowAction[];
  iconClass: string;
  onDetail: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onWorkflow: (action: TaskWorkflowAction) => void;
  toast: ToastApi;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const copyTaskLink = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("Panoya kopyalama bu tarayıcıda desteklenmiyor.");
      return;
    }
    const path = buildCommandPaletteTaskHref(task);
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Görev bağlantısı kopyalandı.");
    } catch {
      toast.error("Bağlantı kopyalanamadı.");
    }
  }, [task, toast]);

  const hasMenuItems =
    rowCanEdit || canShowCopy || canShowDelete || workflowActions.length > 0;

  return (
    <div
      className="row-actions relative inline-flex items-center justify-end gap-0.5 pr-0.5"
      data-keep={menuOpen ? "true" : undefined}
      aria-label="Satır işlemleri"
    >
      {rowCanEdit ? (
        <button
          type="button"
          onClick={onDetail}
          className={iconBtnClass}
          aria-label="Detay aç"
          title="Detay aç"
        >
          <MessageSquare className={iconClass} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void copyTaskLink()}
        className={iconBtnClass}
        aria-label="Bağlantıyı kopyala"
        title="Bağlantıyı kopyala"
      >
        <Link2 className={iconClass} aria-hidden />
      </button>
      {hasMenuItems ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={iconBtnClass}
              aria-label="Daha fazla işlem"
              title="Daha fazla"
            >
              <MoreHorizontal className={iconClass} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {rowCanEdit ? (
              <DropdownMenuItem onClick={onDetail}>
                <MessageSquare className="mr-2 h-3.5 w-3.5" aria-hidden />
                Detay / Yorumlar
              </DropdownMenuItem>
            ) : null}
            {rowCanEdit ? (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden />
                Düzenle
              </DropdownMenuItem>
            ) : null}
            {canShowCopy ? (
              <DropdownMenuItem onClick={onDuplicate}>
                <CopyIcon className="mr-2 h-3.5 w-3.5" aria-hidden />
                Satırı çoğalt
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => void copyTaskLink()}>
              <Link2 className="mr-2 h-3.5 w-3.5" aria-hidden />
              Bağlantıyı kopyala
            </DropdownMenuItem>
            {workflowActions.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Onay akışı
                </div>
                {workflowActions.map((action) => (
                  <DropdownMenuItem
                    key={action}
                    onClick={() => onWorkflow(action)}
                    className={cn(
                      action === "approve" &&
                        "text-emerald-700 focus:text-emerald-700 dark:text-emerald-300 dark:focus:text-emerald-300",
                      action === "reject" &&
                        "text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300"
                    )}
                  >
                    {WORKFLOW_ACTION_LABELS[action]}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            {canShowDelete ? (
              <>
                {(rowCanEdit || canShowCopy || workflowActions.length > 0) && (
                  <DropdownMenuSeparator />
                )}
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Sil
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
