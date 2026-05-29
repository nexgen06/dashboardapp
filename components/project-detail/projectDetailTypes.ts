export type ProjectDetailTab = "overview" | "tasks" | "activity" | "scoreboard";

export type ProjectKpiSnapshot = {
  total: number;
  done: number;
  completionPct: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
};

export type ProjectHealthStatus = "İyi" | "Orta" | "Dikkat";

export function computeProjectHealth(kpis: ProjectKpiSnapshot): ProjectHealthStatus {
  if (kpis.overdue >= 5) return "Dikkat";
  if (kpis.overdue > 0 || kpis.dueToday >= 8) return "Orta";
  if (kpis.total > 0 && kpis.unassigned / kpis.total > 0.25) return "Orta";
  return "İyi";
}

export const PROJECT_HEALTH_STYLES: Record<
  ProjectHealthStatus,
  { badge: string; dot: string }
> = {
  İyi: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  Orta: {
    badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  Dikkat: {
    badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    dot: "bg-red-500 dark:bg-red-400",
  },
};
