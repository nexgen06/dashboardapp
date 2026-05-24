"use client";

import { EyeOff, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WidgetMeta } from "@/lib/dashboardPreferences";

/**
 * Dashboard widget wrapper.
 * - Düzenleme modu KAPALIYKEN: tamamen şeffaf, içeriği geçirir
 * - Düzenleme modu AÇIKKEN: ince mavi kesik kenarlık + sağ üstte "Gizle" rozeti
 *
 * Pinned widget'lar (welcome banner gibi) "Gizle" butonu yerine kilit ikonu gösterir.
 */
export function WidgetWrapper({
  meta,
  isEditMode,
  onHide,
  children,
  className,
}: {
  meta: WidgetMeta;
  isEditMode: boolean;
  onHide?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (!isEditMode) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl ring-2 ring-blue-300/60 ring-offset-2 transition-all dark:ring-blue-700/60",
        meta.pinned ? "ring-slate-300/60 dark:ring-slate-600/60" : "hover:ring-blue-400",
        className
      )}
      data-widget-id={meta.id}
    >
      <div className="absolute -top-3 right-3 z-20 flex items-center gap-1.5">
        <span
          className={cn(
            "rounded-full border bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm dark:bg-slate-900",
            meta.pinned
              ? "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
              : "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
          )}
          title={meta.description}
        >
          {meta.label}
        </span>
        {meta.pinned ? (
          <span
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white p-1 text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
            title="Bu widget kaldırılamaz"
          >
            <Pin className="h-3 w-3" aria-hidden />
          </span>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onHide}
            className="h-6 w-6 rounded-full border-rose-300 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
            title="Bu widget'ı gizle"
            aria-label="Widget'ı gizle"
          >
            <EyeOff className="h-3 w-3" aria-hidden />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}
