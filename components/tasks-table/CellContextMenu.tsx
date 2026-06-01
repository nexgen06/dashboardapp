"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hücreye sağ tıklayınca beliren minik bağlam menüsü.
 * Şu an tek action: "Yorum ekle / görüntüle". İleride daha çok eylem (kopya,
 * filtreye ekle, vb.) eklenebilir.
 *
 * Konum: cursor x/y koordinatlarına yerleşir; ekran taşarsa geri çekilir.
 * Dış tık + Esc ile kapanır.
 */
export type CellContextMenuProps = {
  open: boolean;
  x: number;
  y: number;
  /** Mevcut hücre yorumu sayısı — menü etiketini değiştirir */
  commentCount?: number;
  onAddComment: () => void;
  onClose: () => void;
};

const MENU_MIN_WIDTH = 200;
const VIEWPORT_PAD = 8;

export function CellContextMenu({
  open,
  x,
  y,
  commentCount = 0,
  onAddComment,
  onClose,
}: CellContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // mousedown — başka context menu açılırsa kapat
    document.addEventListener("mousedown", onDown);
    document.addEventListener("contextmenu", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("contextmenu", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof window === "undefined") return null;

  // Viewport'a sığdır
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;
  if (left + MENU_MIN_WIDTH + VIEWPORT_PAD > vw) {
    left = Math.max(VIEWPORT_PAD, vw - MENU_MIN_WIDTH - VIEWPORT_PAD);
  }
  // Yaklaşık menü yüksekliği (1 item ≈ 36px + padding)
  const approxHeight = 44;
  if (top + approxHeight + VIEWPORT_PAD > vh) {
    top = Math.max(VIEWPORT_PAD, y - approxHeight);
  }

  const label = commentCount > 0 ? `Yorumlar (${commentCount})` : "Yorum ekle";

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Hücre bağlam menüsü"
      style={{
        position: "fixed",
        top,
        left,
        minWidth: MENU_MIN_WIDTH,
        zIndex: 1200,
      }}
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl",
        "dark:border-slate-700 dark:bg-slate-900"
      )}
    >
      <button
        type="button"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation();
          onAddComment();
        }}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
          "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        )}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
        <span className="flex-1">{label}</span>
      </button>
    </div>,
    document.body
  );
}
