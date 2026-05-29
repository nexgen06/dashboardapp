"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ME_LABEL } from "@/lib/projectDetailPageHelpers";

export type ProjectAddTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  content: string;
  onContentChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  assignee: string;
  onAssigneeChange: (value: string) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  statusOptions: string[];
  priorityOptions: string[];
  strictAssigneeVisibility?: boolean;
  currentUserEmail: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export function ProjectAddTaskDialog({
  open,
  onOpenChange,
  error,
  content,
  onContentChange,
  status,
  onStatusChange,
  assignee,
  onAssigneeChange,
  dueDate,
  onDueDateChange,
  priority,
  onPriorityChange,
  statusOptions,
  priorityOptions,
  strictAssigneeVisibility,
  currentUserEmail,
  submitting,
  onSubmit,
}: ProjectAddTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={true}>
        <DialogHeader>
          <DialogTitle>Bu projeye görev ekle</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 py-2">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="proje-task-content" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Görev adı / İçerik
            </label>
            <input
              id="proje-task-content"
              type="text"
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Görev açıklaması"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="proje-task-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Durum
            </label>
            <select
              id="proje-task-status"
              value={statusOptions.includes(status) ? status : statusOptions[0]}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="proje-task-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Atanan kişi (opsiyonel)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              Görevin sorumlusu olarak görünecek isim veya e-posta. Listede &quot;Atayana göre&quot; filtresinde kullanılır; yetki vermez.
            </p>
            <div className="flex gap-2">
              <input
                id="proje-task-assignee"
                type="text"
                value={assignee}
                onChange={(e) => onAssigneeChange(e.target.value)}
                placeholder="Örn. Ahmet veya ahmet@firma.com"
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onAssigneeChange(strictAssigneeVisibility ? currentUserEmail : ME_LABEL)
                }
                className="shrink-0"
              >
                Bana ata
              </Button>
            </div>
          </div>
          <div>
            <label htmlFor="proje-task-due" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Son tarih (opsiyonel)
            </label>
            <input
              id="proje-task-due"
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="proje-task-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Öncelik
            </label>
            <select
              id="proje-task-priority"
              value={priorityOptions.includes(priority) ? priority : priorityOptions[0]}
              onChange={(e) => onPriorityChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {priorityOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? "Ekleniyor…" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
