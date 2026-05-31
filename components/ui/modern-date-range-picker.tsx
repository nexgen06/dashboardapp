"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TR_MONTH_NAMES,
  TR_WEEKDAY_SHORT,
  buildMonthGrid,
  formatDisplayDate,
  isBeforeDay,
  isBetweenDaysInclusive,
  isSameDay,
  parseIsoDateLocal,
  startOfDay,
  toIsoDateLocal,
} from "@/lib/calendarUtils";

export type ModernDateRangePickerProps = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClear?: () => void;
  active?: boolean;
  className?: string;
};

type RangeAnchor = "from" | "to";

export function ModernDateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onClear,
  active = false,
  className,
}: ModernDateRangePickerProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const seed = parseIsoDateLocal(dateFrom) ?? parseIsoDateLocal(dateTo) ?? new Date();
    return { year: seed.getFullYear(), month: seed.getMonth() };
  });
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<RangeAnchor>("from");

  const fromDate = useMemo(() => parseIsoDateLocal(dateFrom), [dateFrom]);
  const toDate = useMemo(() => parseIsoDateLocal(dateTo), [dateTo]);
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    if (!open) return;
    const seed = fromDate ?? toDate ?? new Date();
    setViewMonth({ year: seed.getFullYear(), month: seed.getMonth() });
    setSelecting(fromDate && !toDate ? "to" : "from");
    setHoverDate(null);
  }, [open, fromDate, toDate]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const grid = useMemo(
    () => buildMonthGrid(viewMonth.year, viewMonth.month),
    [viewMonth.year, viewMonth.month]
  );

  const previewEnd = hoverDate && fromDate && selecting === "to" ? hoverDate : toDate;

  const handleDaySelect = useCallback(
    (day: Date) => {
      const iso = toIsoDateLocal(day);

      if (selecting === "from" || !fromDate) {
        onDateFromChange(iso);
        onDateToChange("");
        setSelecting("to");
        return;
      }

      if (isBeforeDay(day, fromDate)) {
        onDateToChange(toIsoDateLocal(fromDate));
        onDateFromChange(iso);
      } else {
        onDateToChange(iso);
      }
      setSelecting("from");
      setHoverDate(null);
    },
    [fromDate, onDateFromChange, onDateToChange, selecting]
  );

  const shiftMonth = (delta: number) => {
    setViewMonth((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const rangeLabel =
    dateFrom && dateTo
      ? `${formatDisplayDate(dateFrom)} – ${formatDisplayDate(dateTo)}`
      : dateFrom
        ? `${formatDisplayDate(dateFrom)} – …`
        : dateTo
          ? `… – ${formatDisplayDate(dateTo)}`
          : "Tarih seç";

  return (
    <div ref={rootRef} className={cn("relative inline-flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        className={cn(
          "inline-flex h-8 max-w-[min(100%,20rem)] items-center gap-1.5 overflow-hidden rounded-md border px-2.5 text-xs font-medium shadow-sm transition-all",
          "bg-white/90 backdrop-blur-sm dark:bg-slate-900/90",
          active || open
            ? "border-indigo-300 text-indigo-900 ring-1 ring-indigo-200/70 dark:border-indigo-600 dark:text-indigo-100 dark:ring-indigo-900/50"
            : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800/70"
        )}
      >
        <CalendarDays
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            active || open ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400"
          )}
          aria-hidden
        />
        <span className="truncate">{rangeLabel}</span>
      </button>
      {active && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          title="Tarih aralığını temizle"
          aria-label="Temizle"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Tarih aralığı seçici"
          className={cn(
            "absolute left-0 top-[calc(100%+0.375rem)] z-[60] w-[min(100vw-1.5rem,20.5rem)] overflow-hidden rounded-2xl border",
            "border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/10 backdrop-blur-xl",
            "dark:border-slate-700/80 dark:bg-slate-950/95 dark:shadow-black/50",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200"
          )}
        >
          <div className="border-b border-slate-200/80 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/80 px-4 py-3 dark:border-slate-800 dark:from-indigo-950/40 dark:via-slate-950 dark:to-violet-950/30">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200"
                aria-label="Önceki ay"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {TR_MONTH_NAMES[viewMonth.month]} {viewMonth.year}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {selecting === "from" ? "Başlangıç tarihi" : "Bitiş tarihi"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200"
                aria-label="Sonraki ay"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="px-3 pb-3 pt-2">
            <div className="mb-1 grid grid-cols-7 gap-1 px-0.5">
              {TR_WEEKDAY_SHORT.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Takvim">
              {grid.map((day) => {
                const inCurrentMonth = day.getMonth() === viewMonth.month;
                const isToday = isSameDay(day, today);
                const isStart = fromDate ? isSameDay(day, fromDate) : false;
                const isEnd = toDate ? isSameDay(day, toDate) : false;
                const inRange =
                  fromDate && previewEnd
                    ? isBetweenDaysInclusive(day, fromDate, previewEnd) && !isStart && !isEnd
                    : false;
                const isEndpoint = isStart || isEnd;

                return (
                  <button
                    key={toIsoDateLocal(day)}
                    type="button"
                    role="gridcell"
                    aria-label={formatDisplayDate(toIsoDateLocal(day))}
                    aria-pressed={isEndpoint}
                    onClick={() => handleDaySelect(day)}
                    onMouseEnter={() => {
                      if (selecting === "to" && fromDate) setHoverDate(day);
                    }}
                    onMouseLeave={() => setHoverDate(null)}
                    className={cn(
                      "relative flex h-9 w-full items-center justify-center rounded-xl text-xs font-medium transition-all",
                      !inCurrentMonth && "text-slate-300 dark:text-slate-600",
                      inCurrentMonth && !isEndpoint && !inRange && "text-slate-700 dark:text-slate-200",
                      inCurrentMonth &&
                        !isEndpoint &&
                        !inRange &&
                        "hover:bg-indigo-50 hover:text-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-100",
                      inRange &&
                        "bg-indigo-100/90 text-indigo-800 dark:bg-indigo-900/35 dark:text-indigo-100",
                      isEndpoint &&
                        "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 dark:from-indigo-400 dark:to-violet-500 dark:shadow-indigo-900/40",
                      isToday &&
                        !isEndpoint &&
                        "ring-1 ring-inset ring-indigo-300/80 dark:ring-indigo-500/50"
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/70 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex min-w-0 items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className={cn("truncate", dateFrom && "font-medium text-indigo-700 dark:text-indigo-300")}>
                {dateFrom ? formatDisplayDate(dateFrom) : "Başlangıç"}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              <span className={cn("truncate", dateTo && "font-medium text-indigo-700 dark:text-indigo-300")}>
                {dateTo ? formatDisplayDate(dateTo) : "Bitiş"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const iso = toIsoDateLocal(today);
                  onDateFromChange(iso);
                  onDateToChange(iso);
                  setSelecting("from");
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-200"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm shadow-indigo-500/20 transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
