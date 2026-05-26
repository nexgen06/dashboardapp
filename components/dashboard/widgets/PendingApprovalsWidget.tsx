"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClipboardCheck, ArrowRight, AlertCircle } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { normalizeWorkflowStatus, WORKFLOW_STATUS_LABELS } from "@/lib/taskWorkflow";
import { getTaskDisplayCard } from "@/lib/taskDisplayLabel";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";

/**
 * Onay bekleyen görevler widget'ı.
 *
 * Gösterilen kriter: workflow_status === "submitted" (Kontrol bekliyor) veya
 * "revision_requested" (Revize istendi) — kullanıcı admin/PM ise tüm,
 * değilse yalnızca kendisinin gönderdiği veya kendi projelerindeki.
 */
export function PendingApprovalsWidget({
  tasks,
  projectById,
  currentUserEmail,
  isAdminOrPM,
}: {
  tasks: Task[];
  projectById: Record<string, Project>;
  currentUserEmail: string;
  isAdminOrPM: boolean;
}) {
  const pending = useMemo(() => {
    const me = (currentUserEmail ?? "").trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      const ws = normalizeWorkflowStatus(t.workflow_status);
      if (ws !== "submitted" && ws !== "revision_requested") return false;
      if (isAdminOrPM) return true;
      // Üye için: kendisi atanmışsa veya kendi projesinde ise göster
      const assigneeEmail = (t.assignee ?? "").trim().toLowerCase();
      if (assigneeEmail === me) return true;
      const projectId = t.project_id ? String(t.project_id) : null;
      if (projectId && projectById[projectId]?.assigned_emails?.some((e) => e.trim().toLowerCase() === me)) {
        return true;
      }
      return false;
    });
    // En son güncellenen önce
    return filtered
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 6);
  }, [tasks, projectById, currentUserEmail, isAdminOrPM]);

  const totalPending = useMemo(
    () =>
      tasks.filter((t) => {
        const ws = normalizeWorkflowStatus(t.workflow_status);
        return ws === "submitted" || ws === "revision_requested";
      }).length,
    [tasks]
  );

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 sm:p-5"
      aria-label="Onay bekleyen görevler"
    >
      <SectionHeader
        level="section"
        title="Onay Bekleyen Görevler"
        icon={<ClipboardCheck className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
        actions={
          totalPending > 0 ? (
            <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
              {totalPending} bekliyor
            </Badge>
          ) : undefined
        }
      />
      {pending.length === 0 ? (
        <EmptyState
          variant="compact"
          icon={<ClipboardCheck className="h-8 w-8" />}
          title={isAdminOrPM ? "Onayınızı bekleyen iş yok 👏" : "İncelenmeyi bekleyen göreviniz yok"}
          description={isAdminOrPM ? "Tüm gönderimler kapanmış görünüyor." : "Workflow akışındaki görevler burada listelenir."}
        />
      ) : (
        <ul className="mt-3 space-y-2">
          {pending.map((task) => {
            const projectId = task.project_id ? String(task.project_id) : null;
            const project = projectId ? projectById[projectId] : undefined;
            const ws = normalizeWorkflowStatus(task.workflow_status);
            const wsLabel = WORKFLOW_STATUS_LABELS[ws];
            const href = projectId ? `/projeler/${projectId}` : "/canli-tablo";
            // Görev başlığı + alt başlık: önce task.content; boşsa projenin
            // title_column / subtitle_columns ayarıyla extra_data'dan türetilir.
            const card = getTaskDisplayCard(task, {
              projectTitleColumn: project?.title_column ?? null,
              subtitleColumns: project?.subtitle_columns ?? null,
            });
            const displayTitle = (task.content?.trim() || card.label || "").trim();
            const subtitleText = card.subtitle.map((s) => `${s.key}: ${s.value}`).join(" · ");
            return (
              <li key={task.id}>
                <Link
                  href={href}
                  className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 transition-colors hover:border-violet-300 hover:bg-violet-50/60 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-violet-700 dark:hover:bg-violet-950/20"
                >
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      ws === "submitted"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                    aria-hidden
                  >
                    {ws === "submitted" ? <ClipboardCheck className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          ws === "submitted"
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                        }`}
                      >
                        {wsLabel}
                      </span>
                      {project && (
                        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {project.name}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {displayTitle || "(başlıksız görev)"}
                    </span>
                    {subtitleText && (
                      <span className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                        {subtitleText}
                      </span>
                    )}
                    {task.assignee && (
                      <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        Gönderen: {task.assignee}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500 dark:text-slate-600 dark:group-hover:text-violet-400" aria-hidden />
                </Link>
              </li>
            );
          })}
          {totalPending > pending.length && (
            <li className="pt-1 text-center">
              <Button variant="ghost" size="sm" asChild className="text-xs text-violet-700 dark:text-violet-400">
                <Link href="/canli-tablo">
                  Tümünü gör ({totalPending})
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
