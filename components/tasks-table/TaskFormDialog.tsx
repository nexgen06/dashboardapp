"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Task } from "@/types/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeExtraDataBySmartRules } from "@/lib/extraColumnFormatRules";
import { STATUS_OPTIONS } from "@/components/tasks-table/constants";
import {
  DEFAULT_PRIORITY_OPTIONS,
  EXTRA_DATA_LINK_KEY,
  type TaskFormData,
  toExtraDataRows,
} from "@/components/tasks-table/taskFormHelpers";

export type { TaskFormData };

export function TaskFormDialog({
  open,
  onOpenChange,
  initialTask,
  onSubmit,
  submitLabel,
  title,
  statusOptions = STATUS_OPTIONS.slice(),
  priorityOptions = DEFAULT_PRIORITY_OPTIONS,
  defaultStatus = "Yapılacak",
  defaultPriority = "Medium",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTask?: Task | null;
  onSubmit: (data: TaskFormData) => void | Promise<void>;
  submitLabel: string;
  title: string;
  statusOptions?: string[];
  priorityOptions?: string[];
  defaultStatus?: string;
  defaultPriority?: string;
}) {
  const [content, setContent] = useState(initialTask?.content ?? "");
  const [status, setStatus] = useState(initialTask?.status ?? defaultStatus);
  const [assignee, setAssignee] = useState(initialTask?.assignee ?? "");
  const [priority, setPriority] = useState(initialTask?.priority ?? defaultPriority);
  const [linkUrl, setLinkUrl] = useState(initialTask?.extra_data?.[EXTRA_DATA_LINK_KEY] ?? "");
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>(() => toExtraDataRows(initialTask?.extra_data ?? undefined, [EXTRA_DATA_LINK_KEY]));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setContent(initialTask?.content ?? "");
    setStatus(initialTask?.status ?? defaultStatus);
    setAssignee(initialTask?.assignee ?? "");
    setPriority(initialTask?.priority ?? defaultPriority);
    setLinkUrl(initialTask?.extra_data?.[EXTRA_DATA_LINK_KEY] ?? "");
    setCustomFields(toExtraDataRows(initialTask?.extra_data ?? undefined, [EXTRA_DATA_LINK_KEY]));
    setFormError(null);
  }, [initialTask, open, defaultStatus, defaultPriority]);

  const addCustomField = () => setCustomFields((prev) => [...prev, { key: "", value: "" }]);
  const removeCustomField = (index: number) =>
    setCustomFields((prev) => (prev.length <= 1 ? [{ key: "", value: "" }] : prev.filter((_, i) => i !== index)));
  const updateCustomField = (index: number, field: "key" | "value", value: string) =>
    setCustomFields((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const extra_data = customFields
      .filter((r) => r.key.trim() !== "")
      .reduce((acc, { key, value }) => ({ ...acc, [key.trim()]: value.trim() }), {} as Record<string, string>);
    if (linkUrl.trim() !== "") extra_data[EXTRA_DATA_LINK_KEY] = linkUrl.trim();
    const formattedExtraData = normalizeExtraDataBySmartRules(extra_data);
    if (formattedExtraData.errors.length > 0) {
      setFormError(formattedExtraData.errors.map((err) => err.message).join("\n"));
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await onSubmit({
        content: content.trim(),
        status: status || defaultStatus,
        assignee: assignee.trim() || "",
        priority: priority && priorityOptions.includes(priority) ? priority : defaultPriority,
        extra_data: formattedExtraData.data,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label htmlFor="task-content" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              İçerik
            </label>
            <textarea
              id="task-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Görev açıklaması (çok satır yazabilirsiniz)"
              rows={3}
              className="w-full min-h-[4.5rem] resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-link" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Link (URL, opsiyonel)
            </label>
            <input
              id="task-link"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-status" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Durum
            </label>
            <select
              id="task-status"
              value={statusOptions.includes(status) ? status : statusOptions[0]}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-priority" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Öncelik
            </label>
            <select
              id="task-priority"
              value={priorityOptions.includes(priority) ? priority : priorityOptions[0]}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {priorityOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="task-assignee" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Atanan
            </label>
            <input
              id="task-assignee"
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="İsim (opsiyonel)"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Özel alanlar (opsiyonel)</label>
              <Button type="button" variant="ghost" size="sm" onClick={addCustomField} className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Alan ekle
              </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Referans no, müşteri adı, etiket vb. Alan adı + değer olarak saklanır.</p>
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-600 dark:bg-slate-800/50">
              {customFields.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateCustomField(index, "key", e.target.value)}
                    placeholder="Alan adı"
                    className="flex-1 min-w-0 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateCustomField(index, "value", e.target.value)}
                    placeholder="Değer"
                    className="flex-1 min-w-0 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-500 hover:text-red-600"
                    onClick={() => removeCustomField(index)}
                    aria-label="Alanı kaldır"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {formError && (
              <p className="whitespace-pre-line text-sm text-red-600 dark:text-red-400">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Kaydediliyor…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
