"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { ChipBadge, ChipSelectCell } from "@/components/chips/ChipBadge";
import {
  listChipCatalog,
  listRowChipValues,
  setRowChipValue,
  type ChipCatalog,
  type RowChipValue,
} from "@/lib/chipSystem";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";

export function TaskChipsPanel({
  task,
  canEdit,
  canManageSensitive,
  className,
}: {
  task: Task;
  canEdit: boolean;
  canManageSensitive: boolean;
  className?: string;
}) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<ChipCatalog | null>(null);
  const [rows, setRows] = useState<RowChipValue[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextCatalog, nextRows] = await Promise.all([
        listChipCatalog(task.project_id ? [String(task.project_id)] : []),
        listRowChipValues([task.id]),
      ]);
      setCatalog(nextCatalog);
      setRows(nextRows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çipler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, task.project_id]);

  const templates = catalog?.templates ?? [];
  const options = catalog?.options ?? [];
  const bindings = useMemo(
    () => (catalog?.bindings ?? []).filter((binding) => !task.project_id || binding.projectId === String(task.project_id)),
    [catalog?.bindings, task.project_id]
  );
  const visibleTemplates = useMemo(() => {
    const byId = new Map(templates.map((template) => [template.id, template]));
    const bound = bindings.map((binding) => byId.get(binding.templateId)).filter(Boolean) as typeof templates;
    const selected = rows.map((row) => byId.get(row.templateId)).filter(Boolean) as typeof templates;
    return Array.from(new Map([...bound, ...selected].map((template) => [template.id, template])).values());
  }, [bindings, rows, templates]);

  const updateChip = async (templateId: string, optionId: string) => {
    try {
      await setRowChipValue({ taskId: task.id, templateId, optionId, source: "manual" });
      toast.success("Çip güncellendi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çip güncellenemedi.");
    }
  };

  return (
    <section className={cn("rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/40", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Sparkles className="h-3 w-3" aria-hidden />
          Çipler
        </h3>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>
      {visibleTemplates.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Bu satır için bağlı çip yok.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleTemplates.map((template) => {
            const row = rows.find((item) => item.templateId === template.id) ?? null;
            const templateOptions = options.filter((option) => option.templateId === template.id);
            const option = row ? templateOptions.find((item) => item.id === row.optionId) ?? null : null;
            const disabled = !canEdit || (template.managerOnly && !canManageSensitive);
            return (
              <div key={template.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{template.name}</p>
                  {row?.source === "automation" && <p className="text-[10px] text-slate-500 dark:text-slate-400">Otomasyon tarafından atandı</p>}
                </div>
                <div className="min-w-0 shrink-0">
                  {option && disabled ? (
                    <ChipBadge template={template} option={option} rowValue={row} />
                  ) : (
                    <ChipSelectCell
                      template={template}
                      options={templateOptions}
                      value={row?.optionId ?? ""}
                      disabled={disabled}
                      onChange={(optionId) => void updateChip(template.id, optionId)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

