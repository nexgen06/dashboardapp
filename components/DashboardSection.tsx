"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { parseListOptionString, useSettings } from "@/contexts/settings-context";
import type { DateFormat } from "@/contexts/settings-context";
import { formatDate } from "@/lib/formatDate";
import { getRelativeTime } from "@/lib/relativeTime";
import { getTaskDisplayLabel } from "@/lib/taskDisplayLabel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusDonut } from "@/components/ui/status-donut";
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  Circle,
  ArrowRight,
  PlusCircle,
  Table2,
  Activity,
  LayoutGrid,
  Settings2,
  Plus,
  Check,
  RotateCcw,
  AlertTriangle,
  CreditCard,
  ShieldAlert,
  TimerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import {
  listChipCatalog,
  listRowChipValues,
  type ChipCatalog,
  type RowChipValue,
} from "@/lib/chipSystem";
import {
  WIDGET_CATALOG,
  defaultWidgetVisibility,
  loadDashboardWidgetVisibility,
  saveDashboardWidgetVisibility,
  type DashboardWidgetId,
} from "@/lib/dashboardPreferences";
import { WidgetWrapper } from "@/components/dashboard/WidgetWrapper";
import { PendingApprovalsWidget } from "@/components/dashboard/widgets/PendingApprovalsWidget";
import { NotificationsSummaryWidget } from "@/components/dashboard/widgets/NotificationsSummaryWidget";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { isStatusDone, isStatusInProgress, isStatusTodo } from "@/lib/statusKind";

const EMPTY_CHIP_CATALOG: ChipCatalog = { templates: [], options: [], bindings: [] };

/** Saate göre selamlama. */
function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

/** Banner alt metni: kullanıcının duruma göre tek cümlelik özet. */
function buildInsightSentence(insight: { myOpenCount: number; dueSoonCount: number; completedThisWeek: number }): string {
  const { myOpenCount, dueSoonCount, completedThisWeek } = insight;
  if (myOpenCount === 0 && completedThisWeek === 0) {
    return "Henüz size atanmış aktif görev yok. Yeni bir proje oluşturup başlayabilirsiniz.";
  }
  const parts: string[] = [];
  if (dueSoonCount > 0) {
    parts.push(`Bugün veya öncesine ait ${dueSoonCount} son tarihli görev`);
  } else if (myOpenCount > 0) {
    parts.push(`${myOpenCount} aktif görev`);
  }
  if (completedThisWeek > 0) {
    parts.push(`bu hafta ${completedThisWeek} tamamlanan`);
  }
  if (parts.length === 0) return "Bugün neler yapmak istersiniz?";
  return parts.join(" · ") + ".";
}

/** KPI grid'inde primary kartın yanında duran küçük secondary kart. */
function SecondaryKpi({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: "blue" | "slate" | "amber" | "emerald" | "red" | "violet";
  value: number;
  label: string;
}) {
  const toneCls = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneCls}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none text-slate-900 dark:text-slate-50">{value}</p>
          <p className="mt-1 text-ui-caption text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** Banner sağındaki üç küçük sayım kartı. */
function InsightStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "red" | "slate";
}) {
  const toneCls = {
    blue: "border-blue-300/60 bg-white/70 text-blue-700 dark:border-blue-600/50 dark:bg-slate-900/40 dark:text-blue-200",
    emerald: "border-emerald-300/60 bg-white/70 text-emerald-700 dark:border-emerald-600/50 dark:bg-slate-900/40 dark:text-emerald-200",
    red: "border-red-300/60 bg-white/70 text-red-700 dark:border-red-600/50 dark:bg-slate-900/40 dark:text-red-200",
    slate: "border-slate-300/60 bg-white/70 text-slate-700 dark:border-slate-600/50 dark:bg-slate-900/40 dark:text-slate-200",
  }[tone];
  return (
    <div className={`min-w-0 rounded-xl border px-2 py-2 text-center md:min-w-[5rem] md:px-3 md:text-left ${toneCls}`}>
      <div className="text-3xl font-bold leading-none md:text-ui-display">{value}</div>
      <div className="mt-1 text-[0.625rem] leading-tight opacity-80 md:text-ui-caption">{label}</div>
    </div>
  );
}

export function DashboardSection() {
  const { user, hasPermission } = useAuth();
  const profileLookup = useProfileLookup();
  const { settings } = useSettings();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks, isLoading: tasksLoading } = useTasksWithRealtime();

  const canProjects = hasPermission("area.projects") && hasPermission("projects.view");
  const canLiveTable = hasPermission("area.liveTable") && hasPermission("liveTable.view");
  const canCreateProject = hasPermission("projects.create");
  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const isAdmin = user?.roleId === "admin";

  // `projects` ve `tasks` Supabase RLS tarafından sunucuda filtrelenmiş geliyor.
  // Frontend de rol kapsamını tekrar daraltır: admin tümünü, diğer roller sadece
  // assigned_emails içinde oldukları projeleri Dashboard istatistiklerine dahil eder.
  const scopedProjects = useMemo(() => {
    if (isAdmin) return projects;
    if (!currentUserEmail) return [];
    return projects.filter((p) =>
      (p.assigned_emails ?? []).some((email) => email.trim().toLowerCase() === currentUserEmail)
    );
  }, [currentUserEmail, isAdmin, projects]);

  const projectById = useMemo(() => {
    const map: Record<string, Project> = {};
    scopedProjects.forEach((p) => { map[p.id] = p; });
    return map;
  }, [scopedProjects]);

  const scopedProjectIds = useMemo(
    () => new Set(scopedProjects.map((p) => p.id)),
    [scopedProjects]
  );

  /**
   * KPI hesaplaması için "projeye bağlı görevler" kapsamı kullanılır.
   * Canlı Tablo varsayılan olarak orphan görevleri (project_id = null) gizlediği için
   * Dashboard kartlarının da aynı kapsamı göstermesi gerek; aksi halde "Yapılacak 1"
   * gösterip kullanıcı tabloda göremediği bir görev sayar.
   */
  const projectLinkedTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const projectId = t.project_id != null ? String(t.project_id).trim() : "";
        if (!projectId) return false;
        return scopedProjectIds.has(projectId);
      }),
    [scopedProjectIds, tasks]
  );
  const scopedProjectIdList = useMemo(() => Array.from(scopedProjectIds), [scopedProjectIds]);
  const projectLinkedTaskIds = useMemo(() => projectLinkedTasks.map((task) => task.id), [projectLinkedTasks]);
  const [operationChipCatalog, setOperationChipCatalog] = useState<ChipCatalog>(EMPTY_CHIP_CATALOG);
  const [operationRowChips, setOperationRowChips] = useState<RowChipValue[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (scopedProjectIdList.length === 0) {
      setOperationChipCatalog(EMPTY_CHIP_CATALOG);
      return;
    }
    void (async () => {
      try {
        const catalog = await listChipCatalog(scopedProjectIdList);
        if (!cancelled) setOperationChipCatalog(catalog);
      } catch (err) {
        if (!cancelled) console.warn("[dashboard chips]", err instanceof Error ? err.message : err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopedProjectIdList]);

  useEffect(() => {
    let cancelled = false;
    if (projectLinkedTaskIds.length === 0) {
      setOperationRowChips([]);
      return;
    }
    void (async () => {
      try {
        const rows = await listRowChipValues(projectLinkedTaskIds);
        if (!cancelled) setOperationRowChips(rows);
      } catch (err) {
        if (!cancelled) console.warn("[dashboard row chips]", err instanceof Error ? err.message : err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectLinkedTaskIds]);

  const kpi = useMemo(() => {
    const totalProjects = scopedProjects.length;
    const totalTasks = projectLinkedTasks.length;
    const done = projectLinkedTasks.filter((t) => isStatusDone(t.status)).length;
    const inProgress = projectLinkedTasks.filter((t) => isStatusInProgress(t.status)).length;
    const todo = projectLinkedTasks.filter((t) => isStatusTodo(t.status)).length;
    const completionPct = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;
    return { totalProjects, totalTasks, done, inProgress, todo, completionPct };
  }, [scopedProjects.length, projectLinkedTasks]);

  const operationKpi = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskIdSet = new Set(projectLinkedTaskIds);
    const selectedRows = operationRowChips.filter((row) => taskIdSet.has(row.taskId));
    const optionById = new Map(operationChipCatalog.options.map((option) => [option.id, option]));
    const templateById = new Map(operationChipCatalog.templates.map((template) => [template.id, template]));
    const countChip = (templateName: RegExp, optionValueOrLabel: RegExp) =>
      selectedRows.filter((row) => {
        const template = templateById.get(row.templateId);
        const option = optionById.get(row.optionId);
        return !!template && !!option && templateName.test(template.name) && optionValueOrLabel.test(`${option.value} ${option.label}`);
      }).length;
    const open = projectLinkedTasks.filter((task) => !isStatusDone(task.status)).length;
    const overdue = projectLinkedTasks.filter((task) => {
      if (!task.due_date || isStatusDone(task.status)) return false;
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      return Number.isFinite(due.getTime()) && due < today;
    }).length;
    const completedToday = projectLinkedTasks.filter((task) => {
      if (!isStatusDone(task.status) || !task.updated_at) return false;
      const updated = new Date(task.updated_at);
      return updated >= today && updated < tomorrow;
    }).length;
    return {
      open,
      overdue,
      criticalRisk: countChip(/^Risk$/i, /critical|kritik/i),
      slaBreaches: countChip(/SLA/i, /breach|aşıldı|asildi/i),
      pendingApprovals: projectLinkedTasks.filter((task) => task.workflow_status === "submitted").length,
      completedToday,
      staleRows: countChip(/^Sistem$/i, /stale|hareketsiz/i),
      paymentDelays: countChip(/Ödeme|Odeme|Payment/i, /overdue|gecikti/i),
    };
  }, [operationChipCatalog, operationRowChips, projectLinkedTaskIds, projectLinkedTasks]);

  const recentTasks = useMemo(() => {
    return [...projectLinkedTasks]
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [projectLinkedTasks]);

  const recentProjects = useMemo(() => {
    return [...scopedProjects]
      .sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return tb - ta;
      })
      .slice(0, 5);
  }, [scopedProjects]);

  const statusChartData = useMemo(() => {
    const { todo, inProgress, done } = kpi;
    const total = todo + inProgress + done || 1;
    return [
      {
        label: "Yapılacak",
        value: todo,
        pct: Math.round((todo / total) * 100),
        barClass: "bg-slate-400 dark:bg-slate-500",
        donutColor: "#94a3b8", // slate-400
        dotClass: "bg-slate-400 dark:bg-slate-500",
      },
      {
        label: "Devam",
        value: inProgress,
        pct: Math.round((inProgress / total) * 100),
        barClass: "bg-amber-500 dark:bg-amber-400",
        donutColor: "#f59e0b", // amber-500
        dotClass: "bg-amber-500 dark:bg-amber-400",
      },
      {
        label: "Tamamlandı",
        value: done,
        pct: Math.round((done / total) * 100),
        barClass: "bg-emerald-500 dark:bg-emerald-400",
        donutColor: "#10b981", // emerald-500
        dotClass: "bg-emerald-500 dark:bg-emerald-400",
      },
    ];
  }, [kpi]);

  /** Kişisel içgörü: bana atanan açık, son tarihli, bu hafta tamamlanan görev sayıları. */
  const personalInsight = useMemo(() => {
    const me = currentUserEmail;
    const nowMs = Date.now();
    const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const myOpen = projectLinkedTasks.filter(
      (t) => !isStatusDone(t.status) && (t.assignee ?? "").trim().toLowerCase() === me
    );
    const dueSoon = myOpen.filter((t) => {
      if (!t.due_date) return false;
      const d = new Date(t.due_date).getTime();
      return d <= todayEnd.getTime();
    });
    const completedThisWeek = projectLinkedTasks.filter((t) => {
      if (!isStatusDone(t.status)) return false;
      if (!t.updated_at) return false;
      const ts = new Date(t.updated_at).getTime();
      return ts >= sevenDaysAgo;
    }).length;
    return {
      myOpenCount: myOpen.length,
      dueSoonCount: dueSoon.length,
      completedThisWeek,
    };
  }, [currentUserEmail, projectLinkedTasks]);

  // Profilde nickname tanımlıysa o kullanılır; aksi halde displayName / email fallback.
  const myProfile = profileLookup.byEmail(user?.email);
  const displayName =
    myProfile.nickname ||
    myProfile.fullName?.split(/\s+/)[0] ||
    user?.displayName ||
    user?.email ||
    "Kullanıcı";

  // Widget görünürlük tercihleri — kullanıcı başına localStorage'da saklanır
  const userIdKey = user?.id ?? null;
  const [widgetVisibility, setWidgetVisibility] = useState<Record<DashboardWidgetId, boolean>>(() =>
    defaultWidgetVisibility()
  );
  const [isWidgetEditMode, setIsWidgetEditMode] = useState(false);

  // İlk render'da ve user değişince tercihleri yükle
  useEffect(() => {
    setWidgetVisibility(loadDashboardWidgetVisibility(userIdKey));
  }, [userIdKey]);

  // Tercih değişince kaydet
  const updateWidgetVisibility = (id: DashboardWidgetId, visible: boolean) => {
    setWidgetVisibility((prev) => {
      const next = { ...prev, [id]: visible };
      saveDashboardWidgetVisibility(userIdKey, next);
      return next;
    });
  };

  const resetWidgetLayout = () => {
    const fresh = defaultWidgetVisibility();
    setWidgetVisibility(fresh);
    saveDashboardWidgetVisibility(userIdKey, fresh);
  };

  // Edit mode'da görünür widget'lar üzerinde gizlenecek aday + ekleme listesi için kullanılacak
  const hiddenWidgets = useMemo(
    () => WIDGET_CATALOG.filter((w) => !w.pinned && !widgetVisibility[w.id]),
    [widgetVisibility]
  );
  const isAdminOrPM = isAdmin || user?.roleId === "project_manager";

  if (projectsLoading && tasksLoading) {
    return (
      <div className="min-h-0 space-y-6" aria-busy="true" aria-label="Dashboard yükleniyor">
        {/* Hoş geldin band */}
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 p-6 dark:border-slate-700/80 sm:p-8">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        </div>
        {/* KPI grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* İki sütun kart */}
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton variant="circle" className="h-6 w-6" />
                    <Skeleton className="h-3 flex-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 space-y-6">
      {/* Widget kişiselleştirme çubuğu */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {isWidgetEditMode && hiddenWidgets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Widget Ekle ({hiddenWidgets.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">Gizli widget&apos;lar — eklemek için tıklayın</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hiddenWidgets.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onClick={() => updateWidgetVisibility(w.id, true)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">{w.label}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{w.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {isWidgetEditMode && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={resetWidgetLayout}
            title="Tüm widget&apos;ları görünür yap"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Sıfırla
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant={isWidgetEditMode ? "default" : "outline"}
          onClick={() => setIsWidgetEditMode((v) => !v)}
          className={isWidgetEditMode ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
          title={isWidgetEditMode ? "Düzenlemeyi bitir" : "Dashboard widget&apos;larını kişiselleştir"}
        >
          {isWidgetEditMode ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Düzenlemeyi bitir
            </>
          ) : (
            <>
              <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Widget&apos;ları düzenle
            </>
          )}
        </Button>
      </div>

      {/* Hoş geldin + kişisel içgörü (pinned — her zaman görünür) */}
      <WidgetWrapper
        meta={WIDGET_CATALOG.find((w) => w.id === "welcome")!}
        isEditMode={isWidgetEditMode}
      >
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-slate-50 to-emerald-500/10 dark:from-blue-600/20 dark:via-slate-800 dark:to-emerald-600/20 border border-slate-200/80 dark:border-slate-700/80 p-4 sm:p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-ui-h1 md:text-3xl">
              {greetingByHour()}, <span className="break-all">{displayName}</span>
            </h1>
            <p className="mt-2 text-ui-body text-slate-700 dark:text-slate-200">
              {buildInsightSentence(personalInsight)}
            </p>
          </div>
          {/* Hızlı sayım kartı: bana atanan açık görev / son tarihli.
              Mobilde 3 eşit kolon (overflow yok); md+'da yan yana sabit genişlik. */}
          <div className="grid grid-cols-3 gap-2 md:flex md:shrink-0 md:gap-3">
            <InsightStat
              label="Bana atanan açık"
              value={personalInsight.myOpenCount}
              tone="blue"
            />
            <InsightStat
              label="Son tarihli"
              value={personalInsight.dueSoonCount}
              tone={personalInsight.dueSoonCount > 0 ? "red" : "slate"}
            />
            <InsightStat
              label="Bu hafta biten"
              value={personalInsight.completedThisWeek}
              tone="emerald"
            />
          </div>
        </div>
      </section>

      </WidgetWrapper>

      {scopedProjects.length === 0 && canProjects && (
        <section
          className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-950/35"
          aria-label="Başlangıç adımları"
        >
          <h2 className="text-ui-h3 text-slate-800 dark:text-slate-100">Başlamak için</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ui-body text-slate-700 dark:text-slate-300">
            <li>
              {canCreateProject ? (
                <>
                  <Link href="/projeler" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 dark:text-blue-300">
                    Projeler
                  </Link>{" "}
                  sayfasında yeni proje oluşturun veya görev içe aktarın.
                </>
              ) : (
                "Yöneticiden size proje atanmasını isteyebilirsiniz."
              )}
            </li>
            <li>Görev ekleyin veya Canlı Tabloda paylaşılan liste üzerinde çalışın.</li>
            {canLiveTable && (
              <li>
                İsteğe bağlı: proje formunda «Canlı tablo ek sütunları» ile CSV beklemeden sütun başlıklarını tanımlayın (veritabanında{" "}
                <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-800">extra_column_keys</code> gerekir).
              </li>
            )}
          </ol>
        </section>
      )}

      {/* KPI kartları — 1 dominant tamamlanma + 4 secondary */}
      {widgetVisibility.kpi && (
      <WidgetWrapper
        meta={WIDGET_CATALOG.find((w) => w.id === "kpi")!}
        isEditMode={isWidgetEditMode}
        onHide={() => updateWidgetVisibility("kpi", false)}
      >
      <section>
        <SectionHeader
          level="section"
          title="Özet"
          icon={<LayoutGrid className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* Primary: Tamamlanma % */}
          <div className="rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-emerald-700/40 dark:from-emerald-900/20 dark:via-slate-800/60 dark:to-slate-800/40 sm:col-span-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-ui-caption font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Tamamlanma oranı
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold leading-none tracking-tight text-emerald-700 dark:text-emerald-300">
                {kpi.totalTasks > 0 ? Math.round((kpi.done / kpi.totalTasks) * 100) : 0}
              </span>
              <span className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">%</span>
              <span className="ml-auto text-ui-caption text-slate-500 dark:text-slate-400">
                {kpi.done} / {kpi.totalTasks} görev
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all dark:bg-emerald-400"
                style={{ width: `${kpi.totalTasks > 0 ? Math.max(2, Math.round((kpi.done / kpi.totalTasks) * 100)) : 0}%` }}
              />
            </div>
          </div>

          {/* Secondary: 4 küçük kart */}
          <SecondaryKpi icon={<FolderKanban className="h-4 w-4" />} tone="blue" value={kpi.totalProjects} label="Proje" />
          <SecondaryKpi icon={<ListTodo className="h-4 w-4" />} tone="slate" value={kpi.totalTasks} label="Toplam görev" />
          <SecondaryKpi icon={<Circle className="h-4 w-4" />} tone="slate" value={kpi.todo} label="Yapılacak" />
          <SecondaryKpi icon={<Clock className="h-4 w-4" />} tone="amber" value={kpi.inProgress} label="Devam eden" />
        </div>
      </section>
      </WidgetWrapper>
      )}

      {widgetVisibility.kpi && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          <SectionHeader
            level="card"
            title="Operasyon sağlığı"
            icon={<Activity className="h-4 w-4 text-violet-600 dark:text-violet-300" />}
            spacing="sm"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SecondaryKpi icon={<ListTodo className="h-4 w-4" />} tone="blue" value={operationKpi.open} label="Açık görev" />
            <SecondaryKpi icon={<AlertTriangle className="h-4 w-4" />} tone="red" value={operationKpi.overdue} label="Geciken görev" />
            <SecondaryKpi icon={<ShieldAlert className="h-4 w-4" />} tone="red" value={operationKpi.criticalRisk} label="Kritik risk" />
            <SecondaryKpi icon={<Clock className="h-4 w-4" />} tone="amber" value={operationKpi.slaBreaches} label="SLA ihlali" />
            <SecondaryKpi icon={<CheckCircle2 className="h-4 w-4" />} tone="violet" value={operationKpi.pendingApprovals} label="Onay bekleyen" />
            <SecondaryKpi icon={<Check className="h-4 w-4" />} tone="emerald" value={operationKpi.completedToday} label="Bugün tamamlanan" />
            <SecondaryKpi icon={<TimerOff className="h-4 w-4" />} tone="slate" value={operationKpi.staleRows} label="Hareketsiz satır" />
            <SecondaryKpi icon={<CreditCard className="h-4 w-4" />} tone="amber" value={operationKpi.paymentDelays} label="Ödeme gecikmesi" />
          </div>
        </section>
      )}

      {/* YENİ — Onay bekleyen görevler + Bildirim özeti (2 kolon grid) */}
      {(widgetVisibility.pendingApprovals || widgetVisibility.notificationsSummary) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {widgetVisibility.pendingApprovals && (
            <WidgetWrapper
              meta={WIDGET_CATALOG.find((w) => w.id === "pendingApprovals")!}
              isEditMode={isWidgetEditMode}
              onHide={() => updateWidgetVisibility("pendingApprovals", false)}
            >
              <PendingApprovalsWidget
                tasks={projectLinkedTasks}
                projectById={projectById}
                currentUserEmail={currentUserEmail}
                isAdminOrPM={isAdminOrPM}
              />
            </WidgetWrapper>
          )}
          {widgetVisibility.notificationsSummary && (
            <WidgetWrapper
              meta={WIDGET_CATALOG.find((w) => w.id === "notificationsSummary")!}
              isEditMode={isWidgetEditMode}
              onHide={() => updateWidgetVisibility("notificationsSummary", false)}
            >
              <NotificationsSummaryWidget />
            </WidgetWrapper>
          )}
        </div>
      )}

      {/* Görev durum dağılımı: donut + detay çubukları */}
      {widgetVisibility.status && kpi.totalTasks > 0 && (
        <WidgetWrapper
          meta={WIDGET_CATALOG.find((w) => w.id === "status")!}
          isEditMode={isWidgetEditMode}
          onHide={() => updateWidgetVisibility("status", false)}
        >
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
          <SectionHeader level="card" title="Görev durum dağılımı" spacing="sm" />
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <StatusDonut
              size={160}
              segments={statusChartData.map((s) => ({
                label: s.label,
                value: s.value,
                color: s.donutColor,
                dotClass: s.dotClass,
              }))}
              centerValue={`%${kpi.completionPct}`}
              centerLabel="Tamamlanma"
              showLegend={false}
            />
            <div className="space-y-2.5">
              {statusChartData.map(({ label, value, pct, barClass }) => {
                /**
                 * Bar yeterince geniş ise sayı/oran içine beyaz; değilse dışında.
                 * Eşik: ~%18 — "12 · %47" 4-5 karakter, bunun altında sıkışır.
                 */
                const labelInside = pct >= 18;
                const labelText = `${value} · %${pct}`;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-ui-caption font-medium text-slate-600 dark:text-slate-300">
                      {label}
                    </span>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className={cn(
                          "flex h-full items-center justify-end rounded-full pr-2.5 transition-all",
                          barClass
                        )}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      >
                        {labelInside && (
                          <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-white drop-shadow-sm">
                            {labelText}
                          </span>
                        )}
                      </div>
                      {!labelInside && (
                        <span
                          className="absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200"
                        >
                          {labelText}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        </WidgetWrapper>
      )}

      {/* Hızlı aksiyonlar (her zaman görünür — widget değil) */}
      <section>
        <SectionHeader
          level="section"
          title="Hızlı aksiyonlar"
          icon={<ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        />
        <div className="flex flex-wrap gap-3">
          {canProjects && (
            <Button asChild variant="outline" size="sm" className="rounded-lg border-slate-200 dark:border-slate-600">
              <Link href="/projeler">
                <FolderKanban className="mr-2 h-4 w-4" />
                Projelere git
              </Link>
            </Button>
          )}
          {canLiveTable && (
            <Button asChild variant="outline" size="sm" className="rounded-lg border-slate-200 dark:border-slate-600">
              <Link href="/canli-tablo">
                <Table2 className="mr-2 h-4 w-4" />
                Canlı Tabloya git
              </Link>
            </Button>
          )}
          {canProjects && canCreateProject && (
            <Button asChild size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
              <Link href="/projeler">
                <PlusCircle className="mr-2 h-4 w-4" />
                Yeni proje
              </Link>
            </Button>
          )}
        </div>
      </section>

      {(widgetVisibility.recentTasks || widgetVisibility.recentProjects) && (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Son aktiviteler */}
        {widgetVisibility.recentTasks && (
        <WidgetWrapper
          meta={WIDGET_CATALOG.find((w) => w.id === "recentTasks")!}
          isEditMode={isWidgetEditMode}
          onHide={() => updateWidgetVisibility("recentTasks", false)}
        >
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <SectionHeader
              level="section"
              title="Son aktiviteler"
              spacing="none"
              icon={<Activity className="h-5 w-5 text-amber-500 dark:text-amber-400" />}
              actions={
                canLiveTable ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/canli-tablo">Tümünü gör</Link>
                  </Button>
                ) : null
              }
            />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
            {recentTasks.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={<ListTodo className="h-8 w-8" />}
                title="Henüz aktivite yok"
                description="Görev oluşturuldukça son aktiviteler burada listelenir."
              />
            ) : (
              recentTasks.map((task) => (
                <RecentTaskRow
                  key={task.id}
                  task={task}
                  project={task.project_id ? projectById[task.project_id] ?? null : null}
                  dateFormat={settings.dateFormat}
                  preferredExtraKeys={parseListOptionString(settings.taskSummaryPreferredExtraKeys)}
                />
              ))
            )}
          </div>
        </section>
        </WidgetWrapper>
        )}

        {/* Son projeler */}
        {widgetVisibility.recentProjects && (
        <WidgetWrapper
          meta={WIDGET_CATALOG.find((w) => w.id === "recentProjects")!}
          isEditMode={isWidgetEditMode}
          onHide={() => updateWidgetVisibility("recentProjects", false)}
        >
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80 overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <SectionHeader
              level="section"
              title="Son projeler"
              spacing="none"
              icon={<FolderKanban className="h-5 w-5 text-blue-500 dark:text-blue-400" />}
              actions={
                canProjects ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/projeler">Tümünü gör</Link>
                  </Button>
                ) : null
              }
            />
          </div>
          <div className="p-4 grid gap-3 sm:grid-cols-2">
            {recentProjects.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  variant="inline"
                  icon={<FolderKanban className="h-8 w-8" />}
                  title="Henüz proje yok"
                  description={
                    canCreateProject ? "Projeler sayfasından ilk projenizi oluşturun." : undefined
                  }
                  action={
                    canCreateProject ? (
                      <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Link href="/projeler">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Yeni proje
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projeler/${project.id}`}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 transition-colors hover:bg-slate-100 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/30 dark:hover:bg-slate-700/50"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{project.name || "İsimsiz proje"}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{project.description || "—"}</p>
                  <Badge variant="outline" className="mt-2 text-xs font-normal">
                    {project.status}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </section>
        </WidgetWrapper>
        )}
      </div>
      )}
    </div>
  );
}

function RecentTaskRow({
  task,
  project,
  dateFormat,
  preferredExtraKeys,
}: {
  task: Task;
  project: Project | null;
  dateFormat: DateFormat;
  preferredExtraKeys: string[];
}) {
  const statusLabel = task.status?.trim() || "—";
  const isDone = isStatusDone(task.status);
  const isProgress = isStatusInProgress(task.status);
  const taskLabel = getTaskDisplayLabel(task, {
    projectTitleColumn: project?.title_column ?? null,
    preferredExtraKeys,
  });
  const actor = (task.last_updated_by ?? "").trim();
  const actorLabel = actor && actor.toLowerCase() !== "anon" ? actor : null;
  const updatedAt = task.updated_at ? new Date(task.updated_at) : null;
  const actionText = isDone
    ? "görevi tamamlandı"
    : isProgress
      ? "görevi devam ediyor olarak güncellendi"
      : statusLabel !== "—"
        ? `görevi ${statusLabel} olarak güncellendi`
        : "görevi güncellendi";

  return (
    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          <span>{taskLabel}</span>
          <span className="font-normal text-slate-600 dark:text-slate-300"> {actionText}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          {project?.name ? (
            <span className="max-w-[14rem] truncate">{project.name}</span>
          ) : (
            <span>—</span>
          )}
          {actorLabel && (
            <>
              <span aria-hidden>·</span>
              <span className="max-w-[14rem] truncate">{actorLabel}</span>
            </>
          )}
          {updatedAt && (
            <>
              <span aria-hidden>·</span>
              <span title={formatDate(updatedAt, dateFormat)}>{getRelativeTime(updatedAt)}</span>
            </>
          )}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "w-fit text-xs font-normal mt-1 sm:mt-0",
          isDone && "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
          isProgress && "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
          !isDone && !isProgress && "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
        )}
      >
        {statusLabel}
      </Badge>
    </div>
  );
}
