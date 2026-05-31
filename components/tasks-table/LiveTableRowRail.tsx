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
    <div className="relative flex w-full items-center justify-center">
      {urgencyStrip ? (
        <span
          className={cn("pointer-events-none absolute inset-y-0 left-0 w-[3px]", urgencyStrip)}
          aria-hidden
          title={URGENCY_LABEL[urgency]}
        />
      ) : null}
      {editors.length > 0 ? (
        <span className="pointer-events-none absolute -right-px top-1/2 z-[2] -translate-y-1/2">
          <LiveTablePresenceDot editors={editors} editorsTooltip={editorsTooltip} />
        </span>
      ) : null}
      <span
        className={cn(
          "relative shrink-0 transition-opacity duration-150 focus-within:opacity-100",
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
    </div>
  );
}

/** Pin sticky hücre — zemin rengi tbody > td kurallarından gelir. */
export function liveTablePinCellBg(_isSelected: boolean, isEditedByOthers: boolean): string {
  return isEditedByOthers ? "live-table-pin-cell--presence" : "live-table-pin-cell";
}

/** @deprecated liveTablePinCellBg kullanın */
export const liveTableSelectRailPinBg = liveTablePinCellBg;
