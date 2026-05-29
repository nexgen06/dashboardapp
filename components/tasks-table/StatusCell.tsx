"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LiveTableDensity, LiveTableTemplate } from "@/contexts/settings-context";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { STATUS_OPTIONS } from "@/components/tasks-table/constants";
import {
  STATUS_BADGE_STYLES,
  STATUS_BADGE_STYLES_MODERN,
  STATUS_DOT_CLASS,
  getStatusDisplay,
  rawStatusIsCompleted,
  resolveRestoreStatus,
} from "@/components/tasks-table/statusHelpers";

export function StatusCell({
  value,
  taskId,
  onSave,
  onFocus,
  onBlur,
  statusOptions = STATUS_OPTIONS.slice(),
  defaultTaskStatus = "Yapılacak",
  density = "normal",
  template = "classic",
  disabled = false,
}: {
  value: string;
  taskId: string;
  onSave: (taskId: string, patch: Partial<Task>) => void;
  onFocus: () => void;
  onBlur: () => void;
  statusOptions?: string[];
  defaultTaskStatus?: string;
  density?: LiveTableDensity;
  template?: LiveTableTemplate;
  disabled?: boolean;
}) {
  const display = getStatusDisplay(value);
  const badgeStyles = template === "modern" ? STATUS_BADGE_STYLES_MODERN : STATUS_BADGE_STYLES;
  const badgeStyle = badgeStyles[display] ?? badgeStyles.Yapılacak;
  const dotClass = STATUS_DOT_CLASS[display] ?? STATUS_DOT_CLASS.Yapılacak;
  const [menuOpen, setMenuOpen] = useState(false);
  const statusListboxId = useId();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSingleSaveRef = useRef<{
    taskId: string;
    onSave: (taskId: string, patch: Partial<Task>) => void;
    status: string;
  } | null>(null);

  const completedLabel = statusOptions.find((s) => /tamamlandı|tamamlandi|done|completed/i.test(s)) ?? "Tamamlandı";

  const clearPendingSingleClick = useCallback(() => {
    if (singleClickTimerRef.current) {
      clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
    pendingSingleSaveRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (singleClickTimerRef.current) {
        clearTimeout(singleClickTimerRef.current);
        singleClickTimerRef.current = null;
      }
      const p = pendingSingleSaveRef.current;
      if (p) {
        pendingSingleSaveRef.current = null;
        p.onSave(p.taskId, { status: p.status, last_updated_by: "anon" });
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const node = e.target as Node;
      if (anchorRef.current?.contains(node)) return;
      if (menuRef.current?.contains(node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  const openPicker = useCallback(() => {
    clearPendingSingleClick();
    setMenuOpen(true);
  }, [clearPendingSingleClick]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      if (e.button === 2) return;

      if (menuOpen) {
        clearPendingSingleClick();
        setMenuOpen(false);
        return;
      }

      if (e.detail >= 2) {
        openPicker();
        return;
      }

      clearPendingSingleClick();
      const nextStatus = rawStatusIsCompleted(value)
        ? resolveRestoreStatus(statusOptions, defaultTaskStatus)
        : completedLabel;
      pendingSingleSaveRef.current = { taskId, onSave, status: nextStatus };
      singleClickTimerRef.current = setTimeout(() => {
        singleClickTimerRef.current = null;
        pendingSingleSaveRef.current = null;
        onSave(taskId, { status: nextStatus, last_updated_by: "anon" });
      }, 280);
    },
    [taskId, onSave, completedLabel, clearPendingSingleClick, openPicker, menuOpen, value, statusOptions, defaultTaskStatus, disabled]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      openPicker();
    },
    [openPicker, disabled]
  );

  const badgePad =
    density === "compact"
      ? "px-2 py-0.5 text-xs gap-1.5"
      : density === "comfortable"
        ? "px-3 py-1.5 text-base gap-2"
        : "px-2.5 py-1 text-sm gap-2";
  const dotHw =
    density === "compact" ? "h-1.5 w-1.5" : density === "comfortable" ? "h-2.5 w-2.5" : "h-2 w-2";

  const portal =
    menuOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={statusListboxId}
            role="listbox"
            aria-label="Durum seçin"
            className="fixed z-[300] min-w-[10rem] overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {statusOptions.map((s) => (
              <button
                key={s}
                type="button"
                role="option"
                className="flex w-full cursor-pointer items-center px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
                aria-selected={s === value}
                onClick={() => {
                  if (disabled) return;
                  onSave(taskId, { status: s, last_updated_by: "anon" });
                  setMenuOpen(false);
                }}
              >
                {s}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title="Tek tık: Tamamlandı / varsayılana dön · Çift tık: tüm durumlar"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? statusListboxId : undefined}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          "inline-flex select-none items-center border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
          template === "modern"
            ? "rounded-lg focus:ring-slate-400 dark:focus:ring-slate-500"
            : "rounded-md focus:ring-blue-500",
          disabled ? "cursor-default opacity-70" : "cursor-pointer hover:opacity-90",
          badgePad,
          badgeStyle
        )}
      >
        <span className={cn("shrink-0 rounded-full", dotClass, dotHw)} aria-hidden />
        <span>{display || "—"}</span>
      </button>
      {portal}
    </>
  );
}
