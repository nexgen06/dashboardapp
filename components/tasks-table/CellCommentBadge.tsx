"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hücrenin sağ üst köşesinde küçük 💬 N rozeti.
 * Yorum varsa görünür; yorum yoksa hiç render edilmez.
 *
 * Konum: parent <td>'nin `position: relative` olmasını gerektirir.
 * Stil: hücrenin sağ üst köşesinde absolute, satır hover'ında belirginleşir.
 */
export function CellCommentBadge({
  count,
  onClick,
}: {
  count: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (!count || count <= 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      title={`${count} yorum — tıkla / sağ tıkla aç`}
      aria-label={`${count} hücre yorumu`}
      className={cn(
        "pointer-events-auto absolute right-0.5 top-0.5 z-[2] inline-flex h-4 items-center gap-0.5 rounded-full px-1 text-[9px] font-semibold ring-1 ring-inset transition-all",
        "bg-amber-100 text-amber-800 ring-amber-200 hover:bg-amber-200 hover:scale-110",
        "dark:bg-amber-900/60 dark:text-amber-100 dark:ring-amber-800 dark:hover:bg-amber-900",
        // Hafif soluk + hover'da belirginleş — görsel gürültü azalsın
        "opacity-70 hover:opacity-100"
      )}
    >
      <MessageSquare className="h-2.5 w-2.5" strokeWidth={2.4} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
