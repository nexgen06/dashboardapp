"use client";

/**
 * Proje detay — modern aktivite akışı / audit log timeline.
 * fetchProjectActivity + filtreleme + zaman grupları + sayfalama.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACTIVITY_DATE_FILTER_OPTIONS,
  ACTIVITY_FILTER_OPTIONS,
  filterProjectActivities,
  getActivityRecordHref,
  groupActivitiesByTime,
  TIME_GROUP_LABELS,
  transformAuditEntriesToActivities,
  type ProjectActivityChange,
  type ProjectActivityDateFilterKind,
  type ProjectActivityFilterKind,
  type ProjectActivityItem,
} from "@/lib/projectActivityTimeline";
import { fetchProjectActivity, type AuditLogEntry } from "@/lib/auditLog";
import { supabase } from "@/lib/supabaseClient";
import {
  ACTIVITY_FALLBACK_POLL_MS,
  isRealtimeDisabledForClient,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Task } from "@/types/tasks";
import {
  Activity,
  Bot,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  Server,
  User,
} from "lucide-react";

const PAGE_SIZE = 20;
const VISIBLE_CHANGES = 3;

const ACTION_CHIP: Record<
  ProjectActivityItem["actionType"],
  { label: string; className: string }
> = {
  task_updated: {
    label: "Görev güncellendi",
    className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  },
  status_changed: {
    label: "Durum değişti",
    className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  assignment_changed: {
    label: "Atama değişti",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  task_created: {
    label: "Görev eklendi",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  task_deleted: {
    label: "Görev silindi",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
  },
  project_updated: {
    label: "Proje güncellendi",
    className: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  system_update: {
    label: "Sistem güncellemesi",
    className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  email_sent: {
    label: "E-posta gönderildi",
    className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  },
};

function ActorIcon({ kind }: { kind: ProjectActivityItem["actorKind"] }) {
  if (kind === "automation") return <Bot className="h-4 w-4" aria-hidden />;
  if (kind === "system") return <Server className="h-4 w-4" aria-hidden />;
  return <User className="h-4 w-4" aria-hidden />;
}

function ChangeRow({ change }: { change: ProjectActivityChange }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/30 sm:border-0 sm:bg-transparent sm:p-0">
      <div className="grid gap-1.5 sm:grid-cols-[minmax(6rem,8rem)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{change.field}</span>
        <div className="flex min-w-0 items-center gap-2 sm:contents">
          <span
            className={cn(
              "min-w-0 flex-1 truncate rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-400 line-through decoration-slate-400/70 dark:bg-slate-800/60 dark:text-slate-500 sm:flex-none",
              change.sensitive && "font-mono tracking-wide"
            )}
            title={change.oldValue}
          >
            {change.oldValue}
          </span>
          <span className="text-slate-300 dark:text-slate-600 sm:text-center" aria-hidden>
            →
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 sm:flex-none",
              change.sensitive && "font-mono tracking-wide"
            )}
            title={change.newValue}
          >
            {change.newValue}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({
  item,
  projectId,
  now,
  isLast,
}: {
  item: ProjectActivityItem;
  projectId: string;
  now: Date;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const chip = ACTION_CHIP[item.actionType];
  const visibleChanges = expanded ? item.changes : item.changes.slice(0, VISIBLE_CHANGES);
  const hiddenCount = Math.max(0, item.changes.length - VISIBLE_CHANGES);
  const recordHref = getActivityRecordHref(projectId, item);
  const fullDate = new Date(item.timestamp).toLocaleString("tr-TR");

  return (
    <article className="relative flex gap-3 sm:gap-4">
      <div className="relative flex w-9 shrink-0 flex-col items-center sm:w-10">
        {!isLast && (
          <span
            className="absolute top-10 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
            aria-hidden
          />
        )}
        <div
          className={cn(
            "relative z-[1] flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800 sm:h-10 sm:w-10",
            item.actorKind === "automation" && "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
            item.actorKind === "system" && "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          {item.actorAvatar ? (
            <UserAvatar
              avatarUrl={item.actorAvatar}
              nickname={item.actorName}
              fullName={item.actorName}
              email={item.actorEmail}
              className="h-full w-full text-[10px]"
            />
          ) : (
            <ActorIcon kind={item.actorKind} />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 pb-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
                {item.summary}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    chip.className
                  )}
                >
                  {chip.label}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400" title={fullDate}>
                  {getRelativeTime(new Date(item.timestamp), now)}
                </span>
              </div>
            </div>
          </div>

          {item.tableName === "tasks" && item.taskLabel && (
            <div
              className="mt-2.5 min-w-0"
              title={item.taskSubtitle ? `${item.taskLabel} — ${item.taskSubtitle}` : item.taskLabel}
            >
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium text-slate-500 dark:text-slate-400">Görev:</span>{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">{item.taskLabel}</span>
              </p>
              {item.taskSubtitle && (
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {item.taskSubtitle}
                </p>
              )}
            </div>
          )}

          {item.tableName === "projects" && (
            <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-500 dark:text-slate-400">Kayıt:</span>{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">Proje ayarları</span>
            </p>
          )}

          {item.changes.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Değişen alanlar
              </p>
              <div className="space-y-2">
                {visibleChanges.map((change, idx) => (
                  <ChangeRow key={`${change.field}-${idx}`} change={change} />
                ))}
              </div>
              {!expanded && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-2.5 text-xs font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                >
                  +{hiddenCount} değişiklik daha
                </button>
              )}
            </div>
          )}

          {(detailsOpen || item.changes.length === 0) && (
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-400">
              <p>
                <span className="font-medium text-slate-600 dark:text-slate-300">Kullanıcı:</span> {item.actorName}
                {item.actorEmail ? ` (${item.actorEmail})` : ""}
              </p>
              <p className="mt-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">Zaman:</span> {fullDate}
              </p>
              <p className="mt-1">
                <span className="font-medium text-slate-600 dark:text-slate-300">Kayıt ID:</span>{" "}
                <span className="font-mono text-[11px]">{item.recordId}</span>
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              onClick={() => setDetailsOpen((v) => !v)}
            >
              {detailsOpen ? "Detayları gizle" : "Detayları göster"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-slate-200 px-2.5 text-xs dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
              asChild
            >
              <Link href={recordHref}>
                Kayda git
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export type ProjectActivityTimelineProps = {
  projectId: string;
  taskIds: string[];
  tasks: Task[];
  projectTitleColumn?: string | null;
  subtitleColumns?: string[] | null;
  preferredExtraKeys?: string[];
  /** Yan panel: sabit yükseklik + iç scroll (proje detay 2 sütun düzeni). */
  layout?: "default" | "panel";
  className?: string;
};

export function ProjectActivityTimeline({
  projectId,
  taskIds,
  tasks,
  projectTitleColumn,
  subtitleColumns,
  preferredExtraKeys = [],
  layout = "default",
  className,
}: ProjectActivityTimelineProps) {
  const isPanel = layout === "panel";
  const profileLookup = useProfileLookup();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchLimit, setFetchLimit] = useState(60);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState<ProjectActivityFilterKind>("all");
  const [dateFilter, setDateFilter] = useState<ProjectActivityDateFilterKind>("7d");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const taskIdsKey = useMemo(() => [...taskIds].sort().join("|"), [taskIds]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectActivity(projectId, taskIds, fetchLimit);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [projectId, taskIdsKey, fetchLimit, taskIds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!projectId) return;
    if (isRealtimeDisabledForClient()) return;
    const ch = supabase
      .channel(`audit_project_timeline_${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [projectId, load]);

  useEffect(() => {
    if (!projectId || !isRealtimeDisabledForClient()) return;
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void load();
    }, ACTIVITY_FALLBACK_POLL_MS);
    return () => window.clearInterval(interval);
  }, [projectId, load]);

  const activities = useMemo(
    () =>
      transformAuditEntriesToActivities(entries, {
        taskById,
        projectTitleColumn,
        subtitleColumns,
        preferredExtraKeys,
        profileByEmail: (email) => profileLookup.byEmail(email),
      }),
    [entries, taskById, projectTitleColumn, subtitleColumns, preferredExtraKeys, profileLookup]
  );

  const filteredActivities = useMemo(
    () =>
      filterProjectActivities(activities, {
        searchQuery,
        filterKind,
        dateFilter,
        now,
      }),
    [activities, searchQuery, filterKind, dateFilter, now]
  );

  const pagedActivities = useMemo(
    () => filteredActivities.slice(0, visibleCount),
    [filteredActivities, visibleCount]
  );

  const groupedSections = useMemo(
    () => groupActivitiesByTime(pagedActivities, now),
    [pagedActivities, now]
  );

  const lastActivityId = pagedActivities[pagedActivities.length - 1]?.id;

  const filterLabel =
    ACTIVITY_FILTER_OPTIONS.find((o) => o.value === filterKind)?.label ?? "Tüm aktiviteler";
  const dateLabel =
    ACTIVITY_DATE_FILTER_OPTIONS.find((o) => o.value === dateFilter)?.label ?? "Son 7 gün";

  const canLoadMoreVisible = visibleCount < filteredActivities.length;
  const canFetchMoreRemote = entries.length >= fetchLimit;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, filterKind, dateFilter]);

  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900/30",
        isPanel && "flex h-full min-h-0 flex-col",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
          isPanel && "shrink-0"
        )}
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Aktivite Akışı
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bu projedeki son değişiklikler ve kullanıcı işlemleri
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
          <label className="relative min-w-[12rem] flex-1 sm:min-w-[14rem] sm:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kullanıcı, görev, il veya alan ara"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-orange-500 dark:focus:ring-orange-900/30"
            />
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 justify-between gap-2 border-slate-200 bg-white px-3 text-xs font-normal dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 sm:min-w-[10.5rem]"
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Filter className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                  {filterLabel}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              {ACTIVITY_FILTER_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setFilterKind(option.value)}
                  className={cn(filterKind === option.value && "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300")}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 justify-between gap-2 border-slate-200 bg-white px-3 text-xs font-normal dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 sm:min-w-[9.5rem]"
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                  {dateLabel}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              {ACTIVITY_DATE_FILTER_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setDateFilter(option.value)}
                  className={cn(dateFilter === option.value && "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300")}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={cn("mt-5", isPanel && "min-h-0 flex-1 overflow-y-auto overscroll-contain")}>
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Aktivite yükleniyor…
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center dark:border-slate-700 dark:bg-slate-800/30">
            <Activity className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {activities.length === 0
                ? "Henüz aktivite kaydı yok. Görev eklendiğinde, güncellendiğinde ya da silindiğinde burada görünür."
                : "Seçili filtrelere uygun aktivite bulunamadı."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSections.map((section) => (
              <div key={section.group}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {TIME_GROUP_LABELS[section.group]}
                </h3>
                <div className="space-y-0">
                  {section.items.map((item) => (
                    <ActivityCard
                      key={item.id}
                      item={item}
                      projectId={projectId}
                      now={now}
                      isLast={item.id === lastActivityId}
                    />
                  ))}
                </div>
              </div>
            ))}

            {(canLoadMoreVisible || canFetchMoreRemote) && (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {canLoadMoreVisible && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-xs dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  >
                    Daha fazla göster ({filteredActivities.length - visibleCount} kaldı)
                  </Button>
                )}
                {canFetchMoreRemote && !canLoadMoreVisible && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-xs dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700"
                    disabled={loading}
                    onClick={() => setFetchLimit((n) => n + 60)}
                  >
                    {loading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    Eski kayıtları yükle
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
