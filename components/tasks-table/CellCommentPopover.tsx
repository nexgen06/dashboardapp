"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, X } from "lucide-react";
import { TaskCommentsSection } from "@/components/TaskCommentsSection";
import { cn } from "@/lib/utils";

/**
 * Hücre üzerine sağ tık → bağlam menüden "Yorum ekle" tetiklenince açılan
 * yüzen panel. TaskCommentsSection'ı sarar (mention autocomplete, edit, sil
 * dahil tüm özellikler hazır), sadece scope `fieldKey` ile hücreye bağlanır.
 *
 * Konumlandırma: anchorRect ekran koordinatları + sağa açılır; ekran taşarsa
 * sola hizalanır. Esc ve outside-click ile kapanır.
 */
export type CellCommentPopoverProps = {
  open: boolean;
  taskId: string;
  fieldKey: string;
  fieldLabel: string;
  taskContent?: string;
  projectId?: string | null;
  /** Hücrenin DOMRect'i — popover bunun yanına konumlanır */
  anchorRect: DOMRect | null;
  canComment?: boolean;
  onClose: () => void;
};

const POPOVER_WIDTH = 380;
const POPOVER_MAX_HEIGHT = 480;
const VIEWPORT_PAD = 8;

export function CellCommentPopover({
  open,
  taskId,
  fieldKey,
  fieldLabel,
  taskContent,
  projectId = null,
  anchorRect,
  canComment = true,
  onClose,
}: CellCommentPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dış tık + Esc ile kapan
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      // Mention autocomplete dropdown'una tıklandıysa kapanma — body sonuna portal'a render edilir
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-mention-autocomplete]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof window === "undefined" || !anchorRect) return null;

  // Konum hesabı — viewport içine sığdır
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchorRect.right + 6;
  if (left + POPOVER_WIDTH + VIEWPORT_PAD > vw) {
    // Sağa sığmıyor → sola hizala (hücrenin sol kenarından geri)
    left = Math.max(VIEWPORT_PAD, anchorRect.left - POPOVER_WIDTH - 6);
  }
  let top = anchorRect.top;
  if (top + POPOVER_MAX_HEIGHT + VIEWPORT_PAD > vh) {
    top = Math.max(VIEWPORT_PAD, vh - POPOVER_MAX_HEIGHT - VIEWPORT_PAD);
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`${fieldLabel} hücresi için yorumlar`}
      style={{
        position: "fixed",
        top,
        left,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
        zIndex: 1100,
      }}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl",
        "dark:border-slate-700 dark:bg-slate-900"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <MessageSquare className="h-3 w-3" aria-hidden /> Hücre yorumu
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={fieldLabel}>
            {fieldLabel}
          </div>
          {taskContent && (
            <div
              className="truncate text-[11px] text-slate-500 dark:text-slate-400"
              title={taskContent}
            >
              {taskContent}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          title="Kapat (Esc)"
          className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {/* Yorum thread'i — mevcut TaskCommentsSection reuse */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <TaskCommentsSection
          taskId={taskId}
          fieldKey={fieldKey}
          projectId={projectId}
          canComment={canComment}
          className="border-0 p-3"
        />
      </div>
    </div>,
    document.body
  );
}
