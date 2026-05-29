"use client";

import { Activity, BarChart3, LayoutDashboard, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROJECT_HEALTH_STYLES,
  type ProjectDetailTab,
  type ProjectHealthStatus,
} from "@/components/project-detail/projectDetailTypes";

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
};

export function ProjectTabs({ activeTab, onTabChange, health }: ProjectTabsProps) {
  const healthStyle = PROJECT_HEALTH_STYLES[health];

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
      <div
        className={cn(
          "inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium sm:self-auto",
          healthStyle.badge
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", healthStyle.dot)} aria-hidden />
        Proje sağlığı: {health}
      </div>
    </div>
  );
}
