"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  Circle,
  Flag,
  Loader2,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

/**
 * Sticky bottom floating bulk action bar — Notion/Linear pattern.
 * - Glassmorphism: backdrop-blur-xl, transparent white/dark
 * - Aksiyon grupları: Durum / Atama / Öncelik | Sil | Kapat
 * - Klavye kısayolu ipuçları (Esc = temizle)
 * - Mobile responsive (kompakt görünüm)
 * - aria-live="polite" → ekran okuyucu seçim sayısını duyurur
 */
export type TasksTableSelectionBarProps = {
  selectedCount: number;
  selectedCanBulkUpdate: boolean;
  selectedCanBulkDelete: boolean;
  bulkStatusOpen: boolean;
  setBulkStatusOpen: Dispatch<SetStateAction<boolean>>;
  statusOptions: string[];
  priorityOptions?: string[];
  assigneeOptions?: string[]; // proje üyeleri
  onBulkStatusUpdate: (status: string) => void;
  onBulkPriorityUpdate?: (priority: string) => void;
  onBulkAssign?: (assignee: string | null) => void;
  onBulkDeleteRequest: () => void;
  onClearSelection: () => void;
};

export function TasksTableSelectionBar({
  selectedCount,
  selectedCanBulkUpdate,
  selectedCanBulkDelete,
  bulkStatusOpen,
  setBulkStatusOpen,
  statusOptions,
  priorityOptions,
  assigneeOptions,
  onBulkStatusUpdate,
  onBulkPriorityUpdate,
  onBulkAssign,
  onBulkDeleteRequest,
  onClearSelection,
}: TasksTableSelectionBarProps) {
  // Esc tuşu ile temizle (sadece bar açıkken)
  useEffect(() => {
    if (selectedCount <= 0) return;
    const handler = (e: KeyboardEvent) => {
      // Input/textarea içinde değilse Esc temizler
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable === true;
      if (isTyping) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedCount, onClearSelection]);

  // Atama dropdown için unique kullanıcı listesi (varsa)
  const uniqueAssignees = useMemo(() => {
    if (!assigneeOptions) return [];
    return Array.from(new Set(assigneeOptions.map((s) => s.trim()).filter(Boolean)));
  }, [assigneeOptions]);

  if (selectedCount <= 0) return null;

  // Status için ikon eşleştir
  const statusIcon = (status: string) => {
    const s = status.toLocaleLowerCase("tr");
    if (/tamamla|done|completed|yapıld/.test(s)) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
    if (/devam|progress|sürüyor/.test(s)) return <Loader2 className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
    return <Circle className="h-3.5 w-3.5 text-slate-400" aria-hidden />;
  };

  const priorityIcon = (priority: string) => {
    const p = priority.toLocaleLowerCase("tr");
    if (/high|yüksek|kritik|acil/.test(p)) return <Flag className="h-3.5 w-3.5 text-red-600" aria-hidden />;
    if (/medium|orta|normal/.test(p)) return <Flag className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
    if (/low|düşük/.test(p)) return <Flag className="h-3.5 w-3.5 text-blue-600" aria-hidden />;
    return <Flag className="h-3.5 w-3.5 text-slate-400" aria-hidden />;
  };

  return (
    <div
      role="region"
      aria-label="Toplu işlemler"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3",
        "animate-in fade-in slide-in-from-bottom-4 duration-200"
      )}
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)",
      }}
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-2xl",
          "border border-slate-200/70 bg-white/85 px-2 py-1.5",
          "shadow-2xl shadow-slate-900/15 backdrop-blur-xl backdrop-saturate-150",
          "dark:border-slate-700/60 dark:bg-slate-900/85 dark:shadow-black/40",
          "md:bottom-4 sm:gap-1.5 sm:px-3"
        )}
      >
        {/* Seçim sayacı — büyük, vurgulu */}
        <div className="flex items-center gap-2 pl-1.5 pr-1">
          <span
            className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 px-2 text-xs font-bold tabular-nums text-white shadow-sm shadow-blue-900/30"
            aria-label={`${selectedCount} kayıt seçili`}
          >
            {selectedCount}
          </span>
          <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-100 sm:inline">
            seçili
          </span>
        </div>

        <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />

        {/* Aksiyon grubu 1 — Düzenleme */}
        {selectedCanBulkUpdate && (
          <>
            {/* Durum */}
            <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">Durum</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="top" sideOffset={8} className="min-w-[180px]">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">
                  Yeni durum
                </DropdownMenuLabel>
                {statusOptions.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onBulkStatusUpdate(s)} className="gap-2">
                    {statusIcon(s)}
                    <span>{s}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Atama */}
            {onBulkAssign && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <UserPlus className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Ata</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" sideOffset={8} className="min-w-[200px]">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">
                    Atama
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onBulkAssign(null)} className="gap-2 text-amber-700 focus:text-amber-700 dark:text-amber-300 dark:focus:text-amber-300">
                    <UserMinus className="h-3.5 w-3.5" aria-hidden />
                    Atamayı kaldır
                  </DropdownMenuItem>
                  {uniqueAssignees.length > 0 && <DropdownMenuSeparator />}
                  {uniqueAssignees.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs text-slate-400">
                      Proje ekibinde atanabilir üye yok
                    </DropdownMenuItem>
                  ) : (
                    uniqueAssignees.map((email) => (
                      <DropdownMenuItem key={email} onClick={() => onBulkAssign(email)} className="gap-2">
                        <UserPlus className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                        <span className="truncate">{email}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Öncelik */}
            {onBulkPriorityUpdate && priorityOptions && priorityOptions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Öncelik</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" sideOffset={8} className="min-w-[160px]">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500">
                    Öncelik
                  </DropdownMenuLabel>
                  {priorityOptions.map((p) => (
                    <DropdownMenuItem key={p} onClick={() => onBulkPriorityUpdate(p)} className="gap-2">
                      {priorityIcon(p)}
                      <span>{p}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onBulkPriorityUpdate("")} className="gap-2 text-slate-500">
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Önceliği temizle
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}

        {/* Silme — ayrı grup */}
        {selectedCanBulkDelete && (
          <>
            <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              onClick={onBulkDeleteRequest}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Sil</span>
            </Button>
          </>
        )}

        {/* Temizle — sağda, kompakt + kısayol ipucu */}
        <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          onClick={onClearSelection}
          aria-label="Seçimi temizle (Esc)"
          title="Seçimi temizle (Esc)"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          <kbd className="hidden rounded border border-slate-300 bg-slate-50 px-1 text-[10px] font-mono font-medium text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 md:inline">
            Esc
          </kbd>
        </Button>
      </div>
    </div>
  );
}
