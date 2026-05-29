"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Calendar,
  AlertTriangle,
  User,
  FolderKanban,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { AssigneeBadge } from "@/components/ui/assignee-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getStatusKind } from "@/lib/statusKind";
import {
  getDueUrgency,
  URGENCY_LABEL,
  URGENCY_BADGE_CLASS,
} from "@/lib/dueUrgency";
import { formatDate } from "@/lib/formatDate";
import type { DateFormat } from "@/contexts/settings-context";
import { isSensitiveExtraColumnKey, maskSensitiveExtraValue } from "@/lib/extraColumnSensitiveDisplay";

type TaskCardMobileProps = {
  task: Task;
  projectName?: string | null;
  projectId?: string | null;
  /** Sıralı extra anahtarlar — kart altında özet için */
  extraKeys: string[];
  /** Görev seçili mi? */
  selected: boolean;
  onToggleSelect: () => void;
  /** Ayarlar — settings.dateFormat */
  dateFormat: DateFormat;
  /** Ayarlar — urgent priority set */
  urgentPrioritySet: Set<string>;
  /** Ayarlar — bugün tarihi karşılaştırma için */
  now: Date;
  /** Eylemler — dropdown menü için */
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onOpenDetail?: () => void;
  isDeleting: boolean;
};

const STATUS_TONE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  done: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700",
    text: "text-emerald-800 dark:text-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  },
  in_progress: {
    bg: "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700",
    text: "text-amber-800 dark:text-amber-200",
    icon: <Loader2 className="h-3.5 w-3.5" aria-hidden />,
  },
  todo: {
    bg: "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600",
    text: "text-slate-700 dark:text-slate-200",
    icon: <Circle className="h-3.5 w-3.5" aria-hidden />,
  },
  other: {
    bg: "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600",
    text: "text-slate-700 dark:text-slate-200",
    icon: <Circle className="h-3.5 w-3.5" aria-hidden />,
  },
};

function isOverdue(dueDate: string | null | undefined, now: Date): boolean {
  if (!dueDate) return false;
  try {
    return new Date(dueDate) < now;
  } catch {
    return false;
  }
}

export function TaskCardMobile({
  task,
  projectName,
  projectId,
  extraKeys,
  selected,
  onToggleSelect,
  dateFormat,
  urgentPrioritySet,
  now,
  canEdit,
  canDelete,
  canCreate,
  onEdit,
  onCopy,
  onDelete,
  onOpenDetail,
  isDeleting,
}: TaskCardMobileProps) {
  const [expanded, setExpanded] = useState(false);
  const kind = getStatusKind(task.status);
  const statusStyle = STATUS_TONE[kind];
  const overdue = !isOverdue ? false : isOverdue(task.due_date, now);
  const urgency = getDueUrgency(task, now);
  const showUrgency = false;

  const populatedExtras = extraKeys.filter((k) => {
    const v = task.extra_data?.[k];
    return v != null && String(v).trim() !== "";
  });

  return (
    <article
      className={cn(
        "rounded-lg border bg-white p-3 transition-colors dark:bg-slate-800/80",
        selected
          ? "border-blue-400 ring-1 ring-blue-300 dark:border-blue-500 dark:ring-blue-700"
          : "border-slate-200 dark:border-slate-700",
        isDeleting && "opacity-60"
      )}
      aria-busy={isDeleting}
    >
      {/* Üst satır: checkbox + status + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label="Görev seç"
            className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-ui-caption font-medium",
              statusStyle.bg,
              statusStyle.text
            )}
          >
            {statusStyle.icon}
            {task.status || "Yapılacak"}
          </span>
          {task.priority && (
            <PriorityBadge priority={task.priority} urgentSet={urgentPrioritySet} />
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Görev menüsü">
              <MoreVertical className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && <DropdownMenuItem onClick={onEdit}>Düzenle</DropdownMenuItem>}
            {canCreate && <DropdownMenuItem onClick={onCopy}>Kopyala</DropdownMenuItem>}
            {(canEdit || canCreate) && canDelete && <DropdownMenuSeparator />}
            {canDelete && (
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={onDelete}
                disabled={isDeleting}
              >
                Sil
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Başlık / içerik */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="mt-2 block w-full text-left"
      >
        <p className="text-ui-body-lg font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
          {task.content || <span className="italic text-slate-400">İçerik yok</span>}
        </p>
      </button>

      {/* Meta satırı: atanan + proje + son tarih */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-caption text-slate-600 dark:text-slate-300">
        {showUrgency && (urgency === "overdue" || urgency === "today") && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              URGENCY_BADGE_CLASS[urgency]
            )}
            title={URGENCY_LABEL[urgency]}
          >
            {URGENCY_LABEL[urgency]}
          </span>
        )}
        {task.assignee && <AssigneeBadge assignee={task.assignee} />}
        {projectId && projectName && (
          <span className="inline-flex items-center gap-1">
            <FolderKanban className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            <span className="truncate max-w-[140px]">{projectName}</span>
          </span>
        )}
        {task.due_date && (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue && "font-medium text-red-700 dark:text-red-300"
            )}
          >
            {overdue ? (
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            ) : (
              <Calendar className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            )}
            {formatDate(new Date(task.due_date), dateFormat)}
            {overdue && <span className="ml-0.5">(Gecikmiş)</span>}
          </span>
        )}
      </div>

      {/* Extra alanlar — varsa kollapse panel */}
      {populatedExtras.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between text-ui-caption font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <span>
              {populatedExtras.length} ek alan {expanded ? "" : "(göster)"}
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
          </button>
          {expanded && (
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-ui-caption">
              {populatedExtras.map((k) => {
                const raw = String(task.extra_data?.[k] ?? "");
                const sensitive = isSensitiveExtraColumnKey(k);
                const display = sensitive ? maskSensitiveExtraValue(raw) : raw;
                return (
                  <>
                    <dt key={`k-${k}`} className="font-medium text-slate-500 dark:text-slate-400">
                      {k}
                    </dt>
                    <dd key={`v-${k}`} className="break-words text-slate-800 dark:text-slate-100">
                      {display}
                    </dd>
                  </>
                );
              })}
            </dl>
          )}
        </div>
      )}
    </article>
  );
}
