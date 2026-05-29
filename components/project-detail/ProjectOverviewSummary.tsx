"use client";

import { BarChart3, CheckCircle2, Clock, ListTodo, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectKpiSnapshot } from "@/components/project-detail/projectDetailTypes";

type SummaryRow = {
  label: string;
  value: number;
  icon: typeof ListTodo;
  tone?: "default" | "success" | "warning" | "danger";
};

export function ProjectOverviewSummary({
  kpis,
  onOpenScoreboard,
}: {
  kpis: ProjectKpiSnapshot;
  onOpenScoreboard: () => void;
}) {
  const inProgress = Math.max(0, kpis.total - kpis.done);

  const rows: SummaryRow[] = [
    { label: "Tamamlanan", value: kpis.done, icon: CheckCircle2, tone: "success" },
    { label: "Devam eden", value: inProgress, icon: ListTodo },
    { label: "Gecikmiş", value: kpis.overdue, icon: Clock, tone: kpis.overdue > 0 ? "danger" : "default" },
    { label: "Atanmamış", value: kpis.unassigned, icon: UserX, tone: kpis.unassigned > 0 ? "warning" : "default" },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Proje özeti</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Görev dağılımı ve ilerleme</p>
      </div>
      <div className="flex-1 space-y-2 p-4">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    row.tone === "success" && "text-emerald-600 dark:text-emerald-400",
                    row.tone === "warning" && "text-amber-600 dark:text-amber-400",
                    row.tone === "danger" && "text-red-600 dark:text-red-400",
                    (!row.tone || row.tone === "default") && "text-slate-400 dark:text-slate-500"
                  )}
                  aria-hidden
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">{row.label}</span>
              </div>
              <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {row.value}
              </span>
            </div>
          );
        })}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Tamamlanma oranı</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
            %{kpis.completionPct}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/40">
            <div className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400" style={{ width: `${kpis.completionPct}%` }} />
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 p-3 dark:border-slate-700">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full gap-1.5 border-slate-200 text-xs dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
          onClick={onOpenScoreboard}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Detaylı skor panosu
        </Button>
      </div>
    </section>
  );
}
