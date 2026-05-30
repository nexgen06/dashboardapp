"use client";

import type { ChangeEventHandler } from "react";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { getDueUrgency, URGENCY_LABEL, type DueUrgency } from "@/lib/dueUrgency";

/** Sol ray — bitiş aciliyet şeridi renkleri (prototip table.jsx ile uyumlu). */
export const LIVE_TABLE_URGENCY_STRIP_CLASS: Record<DueUrgency, string> = {
  overdue: "bg-rose-500",
  today: "bg-amber-500",
  soon: "bg-yellow-400",
  upcoming: "",
  none: "",
};

type PresenceEditor = {
  primary: string;
  emailLine?: string | null;
};

export function LiveTablePresenceDot({
  editors,
  editorsTooltip,
}: {
  editors: PresenceEditor[];
  editorsTooltip: string;
}) {
  if (editors.length === 0) {
    return <span className="inline-block h-1.5 w-1.5 shrink-0" aria-hidden />;
  }

  return (
    <span
      className="inline-flex shrink-0 items-center"
      title={editorsTooltip || `${editors.map((e) => e.primary).join(", ")} düzenliyor`}
      aria-label={`Düzenleyen: ${editors.map((e) => e.primary).join(", ")}`}
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
      </span>
    </span>
  );
}

export function LiveTableRowRail({
  task,
  checked,
  disabled,
  onToggle,
  checkboxClassName,
  editors,
  editorsTooltip,
}: {
  task: Task;
  checked: boolean;
  disabled: boolean;
  onToggle: ChangeEventHandler<HTMLInputElement>;
  checkboxClassName: string;
  editors: PresenceEditor[];
  editorsTooltip: string;
}) {
  const urgency = getDueUrgency(task);
  const urgencyStrip = LIVE_TABLE_URGENCY_STRIP_CLASS[urgency];

  return (
    <div className="relative flex min-w-0 items-center gap-1.5 pl-1">
      {urgencyStrip ? (
        <span
          className={cn("absolute inset-y-0 left-0 w-[3px]", urgencyStrip)}
          aria-hidden
          title={URGENCY_LABEL[urgency]}
        />
      ) : null}
      <span
        className={cn(
          "shrink-0 transition-opacity duration-150 focus-within:opacity-100",
          checked ? "opacity-100" : "opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100"
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className={checkboxClassName}
          aria-label="Satırı seç"
        />
      </span>
      <LiveTablePresenceDot editors={editors} editorsTooltip={editorsTooltip} />
    </div>
  );
}

/** Select sütunu sticky hücre arka planı — satır hover/seçim ile senkron. */
export function liveTableSelectRailPinBg(isSelected: boolean, isEditedByOthers: boolean): string {
  if (isEditedByOthers) return "bg-inherit";
  if (isSelected) return "bg-blue-50/40 dark:bg-blue-950/15";
  return "bg-white group-hover/row:bg-slate-50/70 dark:bg-slate-900 dark:group-hover/row:bg-slate-800/40";
}
