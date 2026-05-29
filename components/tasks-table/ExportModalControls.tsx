"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ExportToggleSwitch({
  checked,
  onChange,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 dark:focus:ring-offset-slate-900",
        checked
          ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500"
          : "border-slate-200 bg-slate-200 dark:border-slate-600 dark:bg-slate-700"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function ExportFormatButton({
  label,
  sublabel,
  icon,
  iconWrapClass,
  onClick,
  disabled,
}: {
  label: string;
  sublabel: string;
  icon: ReactNode;
  iconWrapClass: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200/90 bg-white/90 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:border-slate-600 dark:hover:bg-slate-900"
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm", iconWrapClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">{label}</div>
        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{sublabel}</div>
      </div>
    </button>
  );
}
