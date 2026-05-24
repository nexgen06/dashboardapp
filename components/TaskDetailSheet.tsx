"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/ui/priority-badge";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  FolderKanban,
  Clock,
  ExternalLink,
  Pencil,
  History,
  Plus,
  Trash2,
  Send,
  RotateCcw,
  XCircle,
  GitMerge,
} from "lucide-react";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";
import { getStatusKind } from "@/lib/statusKind";
import { formatDate } from "@/lib/formatDate";
import { getRelativeTime } from "@/lib/relativeTime";
import { TaskCommentsSection } from "@/components/TaskCommentsSection";
import { supabase } from "@/lib/supabaseClient";
import {
  ACTIVITY_FALLBACK_POLL_MS,
  isRealtimeDisabledForClient,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
import {
  fetchAuditLog,
  fieldLabel,
  formatAuditValue,
  type AuditLogEntry,
  type AuditFieldDiff,
} from "@/lib/auditLog";
import type { DateFormat } from "@/contexts/settings-context";
import {
  isSensitiveExtraColumnKey,
  maskSensitiveExtraValue,
} from "@/lib/extraColumnSensitiveDisplay";
import {
  normalizeWorkflowStatus,
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUS_CLASS,
} from "@/lib/taskWorkflow";

const EXTRA_DATA_LINK_KEY = "link";

function isSafeUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const STATUS_TONE: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  done: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700",
    text: "text-emerald-800 dark:text-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
    label: "Tamamlandı",
  },
  in_progress: {
    bg: "bg-amber-100 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700",
    text: "text-amber-800 dark:text-amber-200",
    icon: <Loader2 className="h-3.5 w-3.5" aria-hidden />,
    label: "Devam ediyor",
  },
  todo: {
    bg: "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600",
    text: "text-slate-700 dark:text-slate-200",
    icon: <Circle className="h-3.5 w-3.5" aria-hidden />,
    label: "Yapılacak",
  },
  other: {
    bg: "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600",
    text: "text-slate-700 dark:text-slate-200",
    icon: <Circle className="h-3.5 w-3.5" aria-hidden />,
    label: "Diğer",
  },
};

/** Onay süreci adım adım görsel çubuk */
const WORKFLOW_STEPS: Array<{
  key: "draft" | "submitted" | "approved" | "rejected" | "revision_requested";
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "draft", label: "Taslak", icon: <GitMerge className="h-3.5 w-3.5" aria-hidden /> },
  { key: "submitted", label: "Kontrolde", icon: <Send className="h-3.5 w-3.5" aria-hidden /> },
  { key: "approved", label: "Onaylandı", icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> },
];

function WorkflowProgressBar({ task }: { task: Task }) {
  const status = normalizeWorkflowStatus(task.workflow_status);
  const isRejected = status === "rejected";
  const isRevision = status === "revision_requested";

  // Adım indeksi: draft=0, submitted=1, approved=2 (ya da rejected/revision için submitted=1 hatalı renk)
  const stepIndex =
    status === "draft" ? 0
    : status === "submitted" || status === "revision_requested" ? 1
    : status === "approved" ? 2
    : status === "rejected" ? 1
    : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      {/* Adım göstergesi */}
      <div className="flex items-center gap-0">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isCurrent = stepIndex === idx && !isRejected && !isRevision;
          const isPast = stepIndex > idx;
          const isFinal = step.key === "approved";

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                    isCurrent && !isRejected
                      ? "border-blue-500 bg-blue-500 text-white"
                      : isPast && !isRejected && !isRevision
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isRejected && idx === 1
                          ? "border-red-400 bg-red-50 text-red-600 dark:bg-red-950/40"
                          : isRevision && idx === 1
                            ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40"
                            : "border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800"
                  )}
                >
                  {step.icon}
                </span>
                <span className={cn(
                  "text-[10px] font-medium leading-none text-center",
                  isCurrent ? "text-blue-700 dark:text-blue-300"
                  : isPast && !isRejected && !isRevision ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-slate-400"
                )}>
                  {isRejected && idx === 1 ? "Reddedildi"
                  : isRevision && idx === 1 ? "Revize İstendi"
                  : step.label}
                </span>
              </div>
              {!isFinal && (
                <div className={cn(
                  "mx-1 h-0.5 flex-1 rounded-full",
                  isPast && !isRejected && !isRevision
                    ? "bg-emerald-400"
                    : isCurrent
                      ? "bg-gradient-to-r from-blue-400 to-slate-200 dark:to-slate-600"
                      : "bg-slate-200 dark:bg-slate-600"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Durum özeti */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          WORKFLOW_STATUS_CLASS[status]
        )}>
          {isRejected ? <XCircle className="h-3 w-3" aria-hidden /> : isRevision ? <RotateCcw className="h-3 w-3" aria-hidden /> : null}
          {WORKFLOW_STATUS_LABELS[status]}
        </span>
        {task.workflow_submitted_at && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Gönderildi: {new Date(task.workflow_submitted_at).toLocaleDateString("tr-TR")}
          </span>
        )}
        {task.workflow_reviewed_at && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            · İncelendi: {new Date(task.workflow_reviewed_at).toLocaleDateString("tr-TR")}
          </span>
        )}
      </div>
    </div>
  );
}

type TaskDetailSheetProps = {
  task: Task | null;
  onClose: () => void;
  /** Aynı görev listesindeki bir önceki / sonraki görev (filtreli + sıralı + sayfalı). */
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  /** "3 / 47" gibi konum etiketi */
  positionLabel?: string;
  projectName?: string | null;
  dateFormat: DateFormat;
  urgentPrioritySet: Set<string>;
  canEdit: boolean;
  canComment?: boolean;
  onEdit?: () => void;
};

export function TaskDetailSheet({
  task,
  onClose,
  onPrev,
  onNext,
  canPrev = false,
  canNext = false,
  positionLabel,
  projectName,
  dateFormat,
  urgentPrioritySet,
  canEdit,
  canComment = canEdit,
  onEdit,
}: TaskDetailSheetProps) {
  /**
   * Audit log timeline state.
   * Görev değiştikçe audit_log realtime INSERT'leri ile anında güncellenir.
   */
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (!task) {
      setAuditLog([]);
      return;
    }
    let cancelled = false;
    setAuditLoading(true);
    void fetchAuditLog("tasks", task.id, 50).then((entries) => {
      if (cancelled) return;
      setAuditLog(entries);
      setAuditLoading(false);
    });

    if (isRealtimeDisabledForClient()) {
      const interval = window.setInterval(() => {
        if (!shouldPollInBrowser()) return;
        void fetchAuditLog("tasks", task.id, 50).then((entries) => {
          if (!cancelled) setAuditLog(entries);
        });
      }, ACTIVITY_FALLBACK_POLL_MS);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    // Realtime: bu görev için yeni audit_log INSERT olursa listeye ekle
    const channel = supabase
      .channel(`audit-${task.id}`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_log",
          filter: `record_id=eq.${task.id}`,
        },
        () => {
          // Tam yeniden fetch — yeni satırı RLS'le doğru hidrate etmek için
          void fetchAuditLog("tasks", task.id, 50).then((entries) => {
            if (!cancelled) setAuditLog(entries);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [task]);

  /**
   * Klavye gezinmesi: Sheet açıkken
   *  - j veya ↓ → sonraki satır
   *  - k veya ↑ → önceki satır
   *  - Esc Radix tarafından zaten kapatır
   * Yazı alanına odaklanıldığında devre dışı.
   */
  useEffect(() => {
    if (!task) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        if (canNext && onNext) {
          e.preventDefault();
          onNext();
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        if (canPrev && onPrev) {
          e.preventDefault();
          onPrev();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [task, canNext, canPrev, onNext, onPrev]);

  if (!task) return null;

  const statusKind = getStatusKind(task.status);
  const statusStyle = STATUS_TONE[statusKind];
  const statusLabel = task.status?.trim() || statusStyle.label;

  const extraEntries = task.extra_data
    ? Object.entries(task.extra_data).filter(([k, v]) => k !== "__reference_warnings" && String(v ?? "").trim() !== "")
    : [];
  const linkValue =
    task.extra_data?.[EXTRA_DATA_LINK_KEY] && isSafeUrl(String(task.extra_data[EXTRA_DATA_LINK_KEY]))
      ? String(task.extra_data[EXTRA_DATA_LINK_KEY])
      : null;
  const nonLinkExtras = extraEntries.filter(([k]) => k !== EXTRA_DATA_LINK_KEY);

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent widthClass="w-full max-w-md sm:max-w-lg">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 pr-8">
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                statusStyle.bg,
                statusStyle.text
              )}
            >
              {statusStyle.icon}
              {statusLabel}
            </span>
            {task.priority && (
              <PriorityBadge priority={task.priority} urgentSet={urgentPrioritySet} />
            )}
            {positionLabel && (
              <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
                {positionLabel}
              </span>
            )}
          </div>
          <SheetTitle className="break-words">
            {task.content?.trim() || (
              <span className="italic font-normal text-slate-400">İçerik yok</span>
            )}
          </SheetTitle>
          {linkValue && (
            <a
              href={linkValue}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{linkValue}</span>
            </a>
          )}
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Meta grid */}
          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Detaylar
            </h3>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <User className="h-3.5 w-3.5" aria-hidden />
                Atanan
              </dt>
              <dd className="break-words text-slate-800 dark:text-slate-100">
                {task.assignee?.trim() || (
                  <span className="italic text-slate-400">Atanmamış</span>
                )}
              </dd>

              {projectName !== undefined && (
                <>
                  <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <FolderKanban className="h-3.5 w-3.5" aria-hidden />
                    Proje
                  </dt>
                  <dd className="break-words text-slate-800 dark:text-slate-100">
                    {projectName?.trim() || <span className="italic text-slate-400">—</span>}
                  </dd>
                </>
              )}

              <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                Bitiş
              </dt>
              <dd className="text-slate-800 dark:text-slate-100">
                {task.due_date ? (
                  formatDate(new Date(task.due_date), dateFormat)
                ) : (
                  <span className="italic text-slate-400">—</span>
                )}
              </dd>

              {task.updated_at && (
                <>
                  <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Güncellendi
                  </dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {formatDate(new Date(task.updated_at), dateFormat)}
                    {task.last_updated_by && (
                      <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                        · {task.last_updated_by}
                      </span>
                    )}
                  </dd>
                </>
              )}
            </dl>
          </section>

          {/* Ek alanlar */}
          {nonLinkExtras.length > 0 && (
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ek alanlar ({nonLinkExtras.length})
              </h3>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                {nonLinkExtras.map(([key, value]) => {
                  const raw = String(value ?? "");
                  const sensitive = isSensitiveExtraColumnKey(key);
                  const display = sensitive ? maskSensitiveExtraValue(raw) : raw;
                  return (
                    <div key={key} className="contents">
                      <dt className="break-words font-medium text-slate-600 dark:text-slate-300">
                        {key}
                      </dt>
                      <dd className="break-words text-slate-800 dark:text-slate-100">{display}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}

          {/* Onay workflow progress bar — yalnızca workflow_status varsa göster */}
          {task.workflow_status && (
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Onay Süreci
              </h3>
              <WorkflowProgressBar task={task} />
            </section>
          )}

          {/* Yorumlar — task_comments üzerinden, realtime senkron */}
          {task && <TaskCommentsSection taskId={task.id} canComment={canComment} />}

          {/* Aktivite timeline — audit_log üzerinden, realtime senkron */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <History className="h-3 w-3" aria-hidden />
              Aktivite
              {auditLog.length > 0 && (
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {auditLog.length}
                </span>
              )}
            </h3>
            {auditLoading && auditLog.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Yükleniyor…
              </div>
            ) : auditLog.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                Henüz değişiklik kaydı yok. Görevde yapılacak değişiklikler
                burada otomatik listelenir.
              </div>
            ) : (
              <ol className="space-y-2.5">
                {auditLog.map((entry) => (
                  <AuditEntryLine key={entry.id} entry={entry} />
                ))}
              </ol>
            )}
          </section>
        </SheetBody>

        <SheetFooter className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!canPrev}
              onClick={() => onPrev?.()}
              aria-label="Önceki görev"
              title="Önceki görev (k / ↑)"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!canNext}
              onClick={() => onNext?.()}
              aria-label="Sonraki görev"
              title="Sonraki görev (j / ↓)"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            <span className="ml-2 hidden text-[11px] text-slate-500 dark:text-slate-400 sm:inline">
              <kbd className="rounded border border-slate-300 bg-white px-1 text-[10px] font-medium dark:border-slate-600 dark:bg-slate-700">
                j
              </kbd>
              /
              <kbd className="rounded border border-slate-300 bg-white px-1 text-[10px] font-medium dark:border-slate-600 dark:bg-slate-700">
                k
              </kbd>{" "}
              ile gez
            </span>
          </div>
          {canEdit && onEdit && (
            <Button type="button" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Düzenle
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Tek aktivite satırı.
 * action'a göre icon + renk; UPDATE ise değişen her alanı kısa diff ile gösterir.
 * Tarih: relativeTime ("2 saat önce"); hover'da tam tarih.
 */
function AuditEntryLine({ entry }: { entry: AuditLogEntry }) {
  const actorLabel = entry.actorEmail || (entry.actorId ? `Kullanıcı ${entry.actorId.slice(0, 6)}` : "Sistem");
  const relative = getRelativeTime(entry.at);
  const fullDate = entry.at.toLocaleString("tr-TR");

  const config =
    entry.action === "insert"
      ? {
          icon: <Plus className="h-3 w-3" aria-hidden />,
          dotClass:
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
          verb: "oluşturdu",
        }
      : entry.action === "delete"
        ? {
            icon: <Trash2 className="h-3 w-3" aria-hidden />,
            dotClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
            verb: "sildi",
          }
        : {
            icon: <Pencil className="h-3 w-3" aria-hidden />,
            dotClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
            verb: "güncelledi",
          };

  return (
    <li className="flex gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          config.dotClass
        )}
        aria-hidden
      >
        {config.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug text-slate-700 dark:text-slate-200">
          <span className="font-medium">{actorLabel}</span>{" "}
          <span className="text-slate-500 dark:text-slate-400">{config.verb}</span>
          <span className="ml-1.5 text-slate-400 dark:text-slate-500" title={fullDate}>
            · {relative}
          </span>
        </p>
        {entry.action === "update" && (
          <ul className="mt-1 space-y-0.5">
            {Object.entries(entry.changedFields).map(([field, diff]) => {
              const d = diff as AuditFieldDiff;
              return (
                <li
                  key={field}
                  className="rounded-md bg-slate-50 px-2 py-1 text-[11px] leading-snug text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {fieldLabel(field)}:
                  </span>{" "}
                  <span className="text-slate-500 dark:text-slate-400 line-through">
                    {formatAuditValue(d?.before)}
                  </span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span className="text-slate-800 dark:text-slate-100">
                    {formatAuditValue(d?.after)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}
