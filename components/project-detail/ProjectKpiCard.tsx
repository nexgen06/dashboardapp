"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectKpiCardProps = {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  progressPct?: number;
  className?: string;
};

const VARIANT_STYLES = {
  default: {
    card: "border-slate-200 bg-white",
    label: "text-slate-500",
    value: "text-slate-900",
    icon: "text-slate-400",
  },
  success: {
    card: "border-emerald-200 bg-emerald-50/80",
    label: "text-emerald-700",
    value: "text-emerald-900",
    icon: "text-emerald-600",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/80",
    label: "text-amber-700",
    value: "text-amber-900",
    icon: "text-amber-600",
  },
  danger: {
    card: "border-red-200 bg-red-50/80",
    label: "text-red-700",
    value: "text-red-900",
    icon: "text-red-600",
  },
} as const;

export function ProjectKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  variant = "default",
  progressPct,
  className,
}: ProjectKpiCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/40",
        styles.card,
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium", styles.label)}>{label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", styles.value)}>
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm dark:bg-slate-800/80",
            styles.icon
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      {progressPct != null && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/40">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all dark:bg-emerald-400"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}
    </div>
  );
}
