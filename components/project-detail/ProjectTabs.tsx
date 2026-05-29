"use client";

import { useState } from "react";
import { Info, Activity, BarChart3, LayoutDashboard, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROJECT_HEALTH_STYLES,
  explainProjectHealth,
  type ProjectHealthStatus,
  type ProjectKpiSnapshot,
} from "@/lib/projectHealth";
import type { ProjectDetailTab } from "@/components/project-detail/projectDetailTypes";

const TABS: Array<{
  id: ProjectDetailTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Genel Bakış", icon: LayoutDashboard },
  { id: "tasks", label: "Görevler", icon: ListTodo },
  { id: "activity", label: "Aktivite", icon: Activity },
  { id: "scoreboard", label: "Skor Panosu", icon: BarChart3 },
];

export type ProjectTabsProps = {
  activeTab: ProjectDetailTab;
  onTabChange: (tab: ProjectDetailTab) => void;
  health: ProjectHealthStatus;
  kpis: ProjectKpiSnapshot;
};

function ProjectHealthBadge({ health, kpis }: { health: ProjectHealthStatus; kpis: ProjectKpiSnapshot }) {
  const [open, setOpen] = useState(false);
  const healthStyle = PROJECT_HEALTH_STYLES[health];
  const explanation = explainProjectHealth(kpis);

  return (
    <div className="relative shrink-0 self-start sm:self-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
          healthStyle.badge,
          "transition-opacity hover:opacity-90"
        )}
        aria-expanded={open}
        aria-controls="project-health-explanation"
      >
        <span className={cn("h-2 w-2 rounded-full", healthStyle.dot)} aria-hidden />
        Proje sağlığı: {health}
        <Info className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </button>
      {open && (
        <div
          id="project-health-explanation"
          className="absolute end-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="mb-2 font-medium text-slate-800 dark:text-slate-100">Neden &quot;{health}&quot;?</p>
          {explanation.reasons.length > 0 && (
            <ul className="mb-2 list-disc space-y-1 ps-4 text-slate-600 dark:text-slate-300">
              {explanation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {explanation.positives.length > 0 && (
            <ul className="list-disc space-y-1 ps-4 text-emerald-700 dark:text-emerald-300">
              {explanation.positives.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {explanation.reasons.length === 0 && explanation.positives.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400">Metrikler dengeli görünüyor.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectTabs({ activeTab, onTabChange, health, kpis }: ProjectTabsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/30">
      <div className="flex min-w-0 flex-wrap gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
      <ProjectHealthBadge health={health} kpis={kpis} />
    </div>
  );
}
