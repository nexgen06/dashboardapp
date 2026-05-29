"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useLayoutEffect,
  useCallback,
  useDeferredValue,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveTableDensity } from "@/contexts/settings-context";

export function ReferenceSelectCell({
  value,
  options,
  disabled,
  density,
  title,
  onSave,
}: {
  value: string;
  options: string[];
  disabled: boolean;
  density: LiveTableDensity;
  title?: string;
  onSave: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 260,
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isFocusedRef = useRef(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    if (isFocusedRef.current) return;
    setLocalValue(value);
  }, [value]);

  const MAX_DROPDOWN = 40;
  const LARGE_LIST_THRESHOLD = 200;

  const deferredLocalValue = useDeferredValue(localValue);
  const normalizedQuery = hasTyped ? deferredLocalValue.trim().toLocaleLowerCase("tr") : "";
  const isLargeList = options.length >= LARGE_LIST_THRESHOLD;

  const filteredOptions = useMemo(() => {
    if (isLargeList && !normalizedQuery) {
      return options.slice(0, 20);
    }
    if (!normalizedQuery) {
      return options.slice(0, MAX_DROPDOWN);
    }
    const out: string[] = [];
    for (const opt of options) {
      if (opt.toLocaleLowerCase("tr").includes(normalizedQuery)) {
        out.push(opt);
        if (out.length >= MAX_DROPDOWN) break;
      }
    }
    return out;
  }, [isLargeList, normalizedQuery, options]);

  const totalMatches = useMemo(() => {
    if (!normalizedQuery) return options.length;
    if (options.length < LARGE_LIST_THRESHOLD) return filteredOptions.length;
    let count = 0;
    for (const opt of options) {
      if (opt.toLocaleLowerCase("tr").includes(normalizedQuery)) count += 1;
    }
    return count;
  }, [normalizedQuery, options, filteredOptions.length]);

  const commitValue = useCallback(
    (nextValue = localValue) => {
      const trimmed = nextValue.trim();
      setOpen(false);
      if (trimmed !== value) {
        onSave(trimmed);
      }
    },
    [localValue, onSave, value]
  );

  const cellText =
    density === "compact" ? "text-xs" : density === "comfortable" ? "text-base" : "text-sm";
  const inputPad =
    density === "compact"
      ? "px-1.5 py-0.5"
      : density === "comfortable"
        ? "px-2.5 py-2"
        : "px-2 py-1";

  const updateMenuPos = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 428)),
      width: Math.max(240, Math.min(420, Math.max(rect.width, 280))),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPos();
    window.addEventListener("scroll", updateMenuPos, true);
    window.addEventListener("resize", updateMenuPos);
    return () => {
      window.removeEventListener("scroll", updateMenuPos, true);
      window.removeEventListener("resize", updateMenuPos);
    };
  }, [open, updateMenuPos]);

  if (disabled) {
    return (
      <span
        className={cn("block w-full min-w-0 truncate text-slate-500 dark:text-slate-400", cellText)}
        title={value || undefined}
      >
        {value || "—"}
      </span>
    );
  }

  const isEditing = open;

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0 max-w-full">
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onFocus={(e) => {
          isFocusedRef.current = true;
          setHasTyped(false);
          if (!open) setOpen(true);
          updateMenuPos();
          if (localValue) {
            requestAnimationFrame(() => e.target.select?.());
          }
        }}
        onChange={(e) => {
          setLocalValue(e.target.value);
          setHasTyped(true);
          if (!open) setOpen(true);
        }}
        onClick={() => {
          if (!open) {
            setHasTyped(false);
            setOpen(true);
            updateMenuPos();
          }
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          window.setTimeout(() => {
            if (!wrapperRef.current?.contains(document.activeElement)) {
              commitValue();
            }
          }, 0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitValue();
          }
          if (e.key === "Escape") {
            setLocalValue(value);
            setHasTyped(false);
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={
          isEditing
            ? isLargeList
              ? `${options.length} kayıt — aramak için yazın`
              : "Ara ve seç"
            : value
              ? ""
              : "—"
        }
        title={title || value || undefined}
        className={cn(
          "w-full min-w-0 rounded pr-6 outline-none transition-colors",
          cellText,
          inputPad,
          isEditing
            ? "border border-blue-400 bg-white text-slate-800 ring-1 ring-blue-400 dark:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
            : "cursor-pointer border border-slate-200 bg-white/60 text-slate-800 shadow-sm hover:border-blue-300 hover:bg-white dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-100 dark:hover:border-blue-500/60 dark:hover:bg-slate-700/60",
          !value && !isEditing && "text-slate-400 dark:text-slate-500"
        )}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors",
          isEditing ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
        )}
      />
      {open &&
        filteredOptions.length > 0 &&
        createPortal(
          <div
            className="fixed z-[9999] max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            {filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setLocalValue(opt);
                  setHasTyped(false);
                  commitValue(opt);
                }}
                className={cn(
                  "block w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-200",
                  opt === value
                    ? "bg-blue-50/60 font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"
                    : "text-slate-700 dark:text-slate-200"
                )}
                title={opt}
              >
                {opt}
              </button>
            ))}
            {totalMatches > filteredOptions.length && (
              <p className="px-2 py-1 text-[10px] text-slate-500 dark:text-slate-400">
                {normalizedQuery
                  ? `${filteredOptions.length} / ${totalMatches} eşleşme — daha sınırlamak için yazmaya devam edin.`
                  : `İlk ${filteredOptions.length} kayıt — aramak için yazmaya başlayın (${options.length} toplam).`}
              </p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
