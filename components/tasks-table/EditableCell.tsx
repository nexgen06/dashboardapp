"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import type { LiveTableDensity } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

/**
 * onSave artık `void | Promise<{ok, message?}>` döndürebilir. Promise
 * dönerse hücre "saving" göstergesi sürer; başarısız olursa inline
 * "Tekrar dene" butonu çıkar. Eski (void) çağırıcılar bozulmaz.
 */
type SaveResult = { ok: boolean; message?: string };
type OnSave = (taskId: string, patch: Record<string, unknown>) => void | Promise<SaveResult>;

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
  onSave: OnSave;
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
  /** "saving" — Promise dönen onSave için spinner; "error" — kaydedilemedi */
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Hata sonrası inline "Tekrar dene" için son denenen değer */
  const lastAttemptRef = useRef<string | null>(null);
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
    if (isEditing) {
      const node = inputRef.current;
      if (node) {
        node.focus();
        // Excel/Sheets davranışı — focus'ta mevcut metin seçili gelsin
        // ki kullanıcı yazınca üzerine yazsın.
        try {
          node.select();
        } catch {
          /* select desteklenmiyor — sessizce geç */
        }
      }
    }
  }, [isEditing]);

  /**
   * Değeri kaydet. onSave Promise dönerse saving/error state'i sürdürülür;
   * eski void caller'lar fire-and-forget olarak davranır.
   * @param attemptValue açıkça verilebilir (retry için); aksi halde localValue
   */
  const handleSave = useCallback(
    (attemptValue?: string) => {
      const raw = attemptValue !== undefined ? attemptValue : localValue;
      const trimmed = raw.trim();
      if (trimmed === value) {
        setIsEditing(false);
        onBlur();
        setSaveState("idle");
        setSaveError(null);
        return;
      }
      lastAttemptRef.current = trimmed;
      const result = onSave(taskId, { [field]: trimmed, last_updated_by: "anon" });
      if (result && typeof (result as Promise<SaveResult>).then === "function") {
        setSaveState("saving");
        setSaveError(null);
        // Edit modu açık kalır — kullanıcı hata sonrası retry edebilsin
        void (result as Promise<SaveResult>).then((r) => {
          if (r && r.ok) {
            setSaveState("idle");
            setSaveError(null);
            setIsEditing(false);
            onBlur();
          } else {
            setSaveState("error");
            setSaveError(r?.message ?? "Kaydedilemedi");
          }
        }).catch((err) => {
          setSaveState("error");
          setSaveError(err instanceof Error ? err.message : "Kaydedilemedi");
        });
      } else {
        // Geriye uyumlu: void caller'lar için optimistic kapatma
        setIsEditing(false);
        onBlur();
        setSaveState("idle");
        setSaveError(null);
      }
    },
    [localValue, value, taskId, field, onSave, onBlur]
  );

  const handleRetry = useCallback(() => {
    if (lastAttemptRef.current !== null) {
      handleSave(lastAttemptRef.current);
    } else {
      handleSave();
    }
  }, [handleSave]);

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
    // Tab → kaydet + sonraki hücre (Shift+Tab geri için — şimdilik forward only)
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
      onNavigateNext?.(taskId, editableColumnId);
    }
    if (e.key === "Escape") {
      setLocalValue(value);
      setIsEditing(false);
      setSaveState("idle");
      setSaveError(null);
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
    const hasError = saveState === "error";
    const isSaving = saveState === "saving";
    return (
      <div className="flex flex-col gap-1">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              // Kullanıcı yazmaya başladıysa eski hatayı temizle
              if (saveState === "error") setSaveState("idle");
            }}
            onBlur={() => {
              // Hata varken blur'da otomatik kapanma — kullanıcı retry seçebilsin
              if (saveState !== "error") handleSave();
            }}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            data-live-editable-cell="true"
            data-row-id={taskId}
            data-col-id={editableColumnId}
            data-disabled={disabled ? "true" : undefined}
            className={cn(
              "w-full min-w-0 rounded border outline-none text-slate-900 dark:text-slate-100",
              hasError
                ? "border-red-400 bg-red-50/60 ring-2 ring-red-400 dark:border-red-600 dark:bg-red-900/20"
                : "border-blue-300 bg-blue-50/50 ring-2 ring-blue-500 focus:border-blue-500 focus:bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 dark:focus:bg-blue-900/30",
              isSaving && "opacity-70",
              cellText,
              cellPad
            )}
          />
          {isSaving && (
            <span
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400"
              aria-label="Kaydediliyor"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            </span>
          )}
        </div>
        {hasError ? (
          <div className="flex items-center justify-between gap-2 rounded bg-red-50 px-1.5 py-1 text-xs dark:bg-red-900/20">
            <span className="flex min-w-0 items-center gap-1 text-red-700 dark:text-red-300">
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{saveError ?? "Kaydedilemedi"}</span>
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-red-300 bg-white px-1.5 py-0.5 font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Tekrar dene
            </button>
          </div>
        ) : isSaving ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">Kaydediliyor…</span>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Enter veya Tab ile kaydet · Esc ile iptal
          </span>
        )}
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
