"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LiveTableDensity } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

export type EditableCellProps = {
  value: string;
  /** Düzenleme dışında gösterilecek metin (örn. maskeli TCKN); verilmezse value kullanılır */
  displayValue?: string;
  highlightAsBadge?: boolean;
  highlightBadgeTone?: "red" | "amber" | "emerald" | "blue" | "purple" | "slate";
  taskId: string;
  field: string;
  navigationColumnId?: string;
  activeEdit?: boolean;
  onSave: (taskId: string, patch: Record<string, unknown>) => void;
  onFocus: () => void;
  onBlur: () => void;
  density?: LiveTableDensity;
  /** Hücreyi mount'ta doğrudan edit moduna sok ve odakla (hızlı satır ekleme akışı için). */
  autoEdit?: boolean;
  /** Enter ile kaydedildikten sonra çağrılır — boş hızlı girişte bir sonraki satırı doğurur. */
  onChainEnter?: (value: string) => void;
  /** Enter ile kayıttan sonra aynı satırdaki bir sonraki düzenlenebilir hücreye geçer. */
  onNavigateNext?: (taskId: string, columnId: string) => void;
  disabled?: boolean;
};

export function cssAttrValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}


export function EditableCell({
  value,
  displayValue,
  highlightAsBadge = false,
  highlightBadgeTone = "purple",
  taskId,
  field,
  navigationColumnId,
  activeEdit = false,
  onSave,
  onFocus,
  onBlur,
  density = "normal",
  autoEdit = false,
  onChainEnter,
  onNavigateNext,
  disabled = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(autoEdit || activeEdit);
  const [localValue, setLocalValue] = useState(value);
  const editableColumnId = navigationColumnId ?? field;
  useEffect(() => {
    if ((autoEdit || activeEdit) && !disabled) {
      setIsEditing(true);
      onFocus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEdit, autoEdit, disabled]);
  const cellText =
    density === "compact" ? "text-xs" : density === "comfortable" ? "text-base" : "text-sm";
  const cellPad =
    density === "compact"
      ? "px-1.5 py-1"
      : density === "comfortable"
        ? "px-2.5 py-2"
        : "px-2 py-1.5";
  const badgeToneClass = useMemo(() => {
    if (highlightBadgeTone === "red") {
      return "border-red-300 bg-red-100/85 text-red-800 shadow-[0_0_0_1px_rgba(239,68,68,0.22),0_0_14px_rgba(239,68,68,0.22)] dark:border-red-700 dark:bg-red-900/35 dark:text-red-100";
    }
    if (highlightBadgeTone === "amber") {
      return "border-amber-300 bg-amber-100/85 text-amber-800 shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_0_14px_rgba(245,158,11,0.22)] dark:border-amber-700 dark:bg-amber-900/35 dark:text-amber-100";
    }
    if (highlightBadgeTone === "emerald") {
      return "border-emerald-300 bg-emerald-100/85 text-emerald-800 shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_0_14px_rgba(16,185,129,0.22)] dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-100";
    }
    if (highlightBadgeTone === "blue") {
      return "border-blue-300 bg-blue-100/85 text-blue-800 shadow-[0_0_0_1px_rgba(59,130,246,0.22),0_0_14px_rgba(59,130,246,0.22)] dark:border-blue-700 dark:bg-blue-900/35 dark:text-blue-100";
    }
    if (highlightBadgeTone === "slate") {
      return "border-slate-300 bg-slate-100/90 text-slate-800 shadow-[0_0_0_1px_rgba(100,116,139,0.22),0_0_14px_rgba(100,116,139,0.20)] dark:border-slate-600 dark:bg-slate-800/55 dark:text-slate-100";
    }
    return "border-violet-300 bg-violet-100/85 text-violet-800 shadow-[0_0_0_1px_rgba(139,92,246,0.22),0_0_14px_rgba(139,92,246,0.22)] dark:border-violet-700 dark:bg-violet-900/35 dark:text-violet-100";
  }, [highlightBadgeTone]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setLocalValue(value);
  }, [isEditing, value]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = localValue.trim();
    if (trimmed !== value) {
      onSave(taskId, { [field]: trimmed, last_updated_by: "anon" });
    }
    setIsEditing(false);
    onBlur();
  }, [localValue, value, taskId, field, onSave, onBlur]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextValue = localValue.trim();
      handleSave();
      if (onChainEnter && nextValue === "") {
        onChainEnter(nextValue);
        return;
      }
      onNavigateNext?.(taskId, editableColumnId);
    }
    if (e.key === "Escape") {
      setLocalValue(value);
      setIsEditing(false);
      onBlur();
    }
  };

  if (disabled) {
    return (
      <span
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 rounded text-left text-slate-500 dark:text-slate-400",
          cellText,
          cellPad
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            highlightAsBadge &&
              "inline-flex max-w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            highlightAsBadge && badgeToneClass
          )}
          title={displayValue !== undefined ? undefined : value || undefined}
        >
          {(displayValue !== undefined ? displayValue : value) || "—"}
        </span>
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          data-live-editable-cell="true"
          data-row-id={taskId}
          data-col-id={editableColumnId}
          data-disabled={disabled ? "true" : undefined}
          className={cn(
            "w-full min-w-0 rounded border border-blue-300 bg-blue-50/50 text-slate-900 outline-none ring-2 ring-blue-500 focus:border-blue-500 focus:bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 dark:text-slate-100 dark:focus:bg-blue-900/30",
            cellText,
            cellPad
          )}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400">Enter ile kaydet, Esc ile iptal</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onFocus();
        setIsEditing(true);
      }}
      data-live-editable-cell="true"
      data-row-id={taskId}
      data-col-id={editableColumnId}
      data-disabled={disabled ? "true" : undefined}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700",
        cellText,
        cellPad
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          highlightAsBadge &&
            "inline-flex max-w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
          highlightAsBadge && badgeToneClass
        )}
        title={displayValue !== undefined ? undefined : value || undefined}
      >
        {(displayValue !== undefined ? displayValue : value) || "—"}
      </span>
    </button>
  );
}
