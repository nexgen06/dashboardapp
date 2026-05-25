"use client";

import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  CreditCard,
  FileText,
  FileX,
  Lock,
  LockKeyhole,
  Loader2,
  PauseCircle,
  Shield,
  ShieldAlert,
  Sparkles,
  TimerOff,
  Unlock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChipOption, ChipTemplate, RowChipValue } from "@/lib/chipSystem";

const colorClass: Record<string, string> = {
  slate: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
};

const selectColorClass: Record<string, string> = {
  slate: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
  blue: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-100",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100",
  amber: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100",
  red: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-100",
  violet: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100",
  cyan: "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-100",
};

const iconMap = {
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  archive: Archive,
  calendar: Calendar,
  "check-circle": CheckCircle2,
  circle: Circle,
  "circle-dot": CircleDot,
  clock: Clock,
  "credit-card": CreditCard,
  "file-text": FileText,
  "file-x": FileX,
  lock: Lock,
  "lock-keyhole": LockKeyhole,
  loader: Loader2,
  "pause-circle": PauseCircle,
  shield: Shield,
  "shield-alert": ShieldAlert,
  sparkles: Sparkles,
  "timer-off": TimerOff,
  unlock: Unlock,
  "x-circle": XCircle,
};

function resolveIcon(icon?: string | null) {
  if (!icon) return Circle;
  return iconMap[icon as keyof typeof iconMap] ?? Circle;
}

function isReflectorChip(option: ChipOption): boolean {
  const value = `${option.value} ${option.label}`.toLocaleLowerCase("tr");
  return [
    "critical",
    "kritik",
    "overdue",
    "gecikti",
    "gecikmiş",
    "breached",
    "sla aşıldı",
    "missing",
    "eksik",
    "rejected",
    "reddedildi",
    "revision",
    "revize",
    "blocked",
    "engellendi",
  ].some((token) => value.includes(token));
}

export function ChipBadge({
  template,
  option,
  rowValue,
  className,
}: {
  template?: ChipTemplate | null;
  option: ChipOption;
  rowValue?: RowChipValue | null;
  className?: string;
}) {
  const Icon = resolveIcon(option.icon ?? template?.icon);
  const reflector = isReflectorChip(option);
  const title = [
    template?.name,
    reflector ? "dikkat efekti" : null,
    rowValue?.source === "automation" ? "otomasyon" : rowValue?.source === "system" ? "sistem" : null,
  ].filter(Boolean).join(" · ");
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm",
        colorClass[option.color] ?? colorClass[template?.color ?? "slate"] ?? colorClass.slate,
        reflector && "chip-reflector",
        reflector && (option.color === "red" || /critical|kritik|rejected|reddedildi|blocked|engellendi/i.test(`${option.value} ${option.label}`)) && "chip-reflector-red",
        reflector && (option.color === "amber" || /overdue|gecikti|gecikmiş|missing|eksik|revision|revize/i.test(`${option.value} ${option.label}`)) && "chip-reflector-amber",
        reflector && option.color === "violet" && "chip-reflector-violet",
        className
      )}
      title={title || undefined}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{option.label}</span>
      {rowValue?.source === "automation" && <Sparkles className="h-3 w-3 shrink-0 opacity-75" aria-label="Otomasyon" />}
      {template?.managerOnly && <Lock className="h-3 w-3 shrink-0 opacity-75" aria-label="Yönetici çipi" />}
    </span>
  );
}

export function ChipSelectCell({
  template,
  options,
  value,
  disabled,
  onChange,
}: {
  template: ChipTemplate;
  options: ChipOption[];
  value?: string | null;
  disabled?: boolean;
  onChange: (optionId: string) => void;
}) {
  const current = options.find((option) => option.id === value) ?? null;
  if (disabled) {
    return current ? <ChipBadge template={template} option={current} /> : <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <select
      value={value ?? ""}
      onChange={(event) => event.target.value && onChange(event.target.value)}
      className={cn(
        "h-7 max-w-full rounded-full border px-2 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-60",
        current
          ? selectColorClass[current.color] ?? selectColorClass[template.color] ?? selectColorClass.slate
          : "border-slate-200 bg-white text-slate-500 focus:border-blue-500 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
        current?.color === "red" && "focus:border-red-500 focus:ring-red-500/25",
        current?.color === "amber" && "focus:border-amber-500 focus:ring-amber-500/25",
        current?.color === "emerald" && "focus:border-emerald-500 focus:ring-emerald-500/25",
        current?.color === "blue" && "focus:border-blue-500 focus:ring-blue-500/25",
        current?.color === "violet" && "focus:border-violet-500 focus:ring-violet-500/25",
        current?.color === "cyan" && "focus:border-cyan-500 focus:ring-cyan-500/25",
        current && isReflectorChip(current) && "chip-reflector",
        current && isReflectorChip(current) && (current.color === "red" || /critical|kritik|rejected|reddedildi|blocked|engellendi/i.test(`${current.value} ${current.label}`)) && "chip-reflector-red",
        current && isReflectorChip(current) && (current.color === "amber" || /overdue|gecikti|gecikmiş|missing|eksik|revision|revize/i.test(`${current.value} ${current.label}`)) && "chip-reflector-amber",
        current && isReflectorChip(current) && current.color === "violet" && "chip-reflector-violet"
      )}
      title={template.name}
    >
      <option value="">—</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  );
}
