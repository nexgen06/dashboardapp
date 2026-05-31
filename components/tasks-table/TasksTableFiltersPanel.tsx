"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import type { LiveTableDensity, LiveTableTemplate, Settings } from "@/contexts/settings-context";
import type { AdvancedFilterRule } from "@/lib/liveTableAdvancedFilters";
import { cn } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/calendarUtils";
import { ModernDateRangePicker } from "@/components/ui/modern-date-range-picker";
import {
  LIVE_TABLE_TOOLBAR_BTN_CLASS,
  LIVE_TABLE_TOOLBAR_ICON_BTN_CLASS,
  LIVE_TABLE_TOOLBAR_INPUT_CLASS,
  LIVE_TABLE_TOOLBAR_SELECT_CLASS,
} from "@/components/tasks-table/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Expand,
  Filter,
  Flame,
  FolderKanban,
  History,
  ListFilter,
  ListTodo,
  Loader2,
  Maximize2,
  Minimize2,
  Search,
  SlidersHorizontal,
  Shrink,
  Sunrise,
  User,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

export type TasksTableFiltersPanelProps = {
  isModernTemplate: boolean;
  quickFiltersOpen: boolean;
  setQuickFiltersOpen: Dispatch<SetStateAction<boolean>>;
  smartFilterCounts: {
    overdue: number;
    thisWeek: number;
    priority: number;
    mine: number;
    unassigned: number;
  };
  activeSmartFilter: "overdue" | "thisWeek" | "priority" | "mine" | "unassigned" | null;
  applySmartFilter: (id: "overdue" | "thisWeek" | "priority" | "mine" | "unassigned") => void;
  clearFilters: () => void;
  currentUserEmail: string;
  globalSearch: string;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  projectLinkedFilter: "proje" | "tümü";
  setProjectLinkedFilter: Dispatch<SetStateAction<"proje" | "tümü">>;
  activeAdvancedFilterRuleCount: number;
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
  statusDropdownOpen: boolean;
  setStatusDropdownOpen: Dispatch<SetStateAction<boolean>>;
  statusFilter: string[];
  setStatusFilter: Dispatch<SetStateAction<string[]>>;
  statusOptions: string[];
  assigneeDropdownOpen: boolean;
  setAssigneeDropdownOpen: Dispatch<SetStateAction<boolean>>;
  assigneeFilter: string[];
  setAssigneeFilter: Dispatch<SetStateAction<string[]>>;
  assigneeFilterOptions: string[];
  datePreset: string;
  setDatePreset: Dispatch<SetStateAction<string>>;
  dateFrom: string;
  setDateFrom: Dispatch<SetStateAction<string>>;
  dateTo: string;
  setDateTo: Dispatch<SetStateAction<string>>;
  applyDatePreset: (preset: string) => void;
  canAutoSizeColumns: boolean;
  fitToContent: boolean;
  handleAutoSizeColumns: () => void;
  tableDensity: LiveTableDensity;
  tableTemplate: LiveTableTemplate;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  isFullWidth: boolean;
  setIsFullWidth: Dispatch<SetStateAction<boolean>>;
  table: Table<Task>;
  tasks: Task[];
  activeFilterCount: number;
  projectFilter: string[];
  setProjectFilter: Dispatch<SetStateAction<string[]>>;
  projectDropdownOpen: boolean;
  setProjectDropdownOpen: Dispatch<SetStateAction<boolean>>;
  projectFilterOptions: { id: string; name: string }[];
  projectById: Map<string, Project>;
  setAdvancedFilterRules: Dispatch<SetStateAction<AdvancedFilterRule[]>>;
  columnFilters: Record<string, string[]>;
  clearColumnFilter: (colId: string) => void;
};

export function TasksTableFiltersPanel(props: TasksTableFiltersPanelProps) {
  const {
    isModernTemplate,
    quickFiltersOpen,
    setQuickFiltersOpen,
    smartFilterCounts,
    activeSmartFilter,
    applySmartFilter,
    clearFilters,
    currentUserEmail,
    globalSearch,
    setGlobalSearch,
    projectLinkedFilter,
    setProjectLinkedFilter,
    activeAdvancedFilterRuleCount,
    setAdvancedFilterOpen,
    statusDropdownOpen,
    setStatusDropdownOpen,
    statusFilter,
    setStatusFilter,
    statusOptions,
    assigneeDropdownOpen,
    setAssigneeDropdownOpen,
    assigneeFilter,
    setAssigneeFilter,
    assigneeFilterOptions,
    datePreset,
    setDatePreset,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    applyDatePreset,
    canAutoSizeColumns,
    fitToContent,
    handleAutoSizeColumns,
    tableDensity,
    tableTemplate,
    updateSetting,
    isFullWidth,
    setIsFullWidth,
    table,
    tasks,
    activeFilterCount,
    projectFilter,
    setProjectFilter,
    projectDropdownOpen,
    setProjectDropdownOpen,
    projectFilterOptions,
    projectById,
    setAdvancedFilterRules,
    columnFilters,
    clearColumnFilter,
  } = props;

  return (
      <div className="order-[-1] flex shrink-0 flex-col gap-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        {/* Akıllı filtreler */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <button
            type="button"
            aria-expanded={quickFiltersOpen}
            onClick={() => setQuickFiltersOpen((o) => !o)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100/80 dark:text-slate-500 dark:hover:bg-slate-900"
          >
            Hızlı filtre
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform dark:text-slate-400", quickFiltersOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {/* ─── SmartRail — Claude Design "Hızlı filtre" chip stili ───
              Rounded-full chip + ikon + label + count rozeti.
              Aktif state: doygun bg + ring. Tekrar tıklayınca toggle. */}
          <div className={cn("flex flex-wrap items-center gap-1.5", !quickFiltersOpen && "hidden")} role="toolbar" aria-label="Hızlı filtreler">
            {[
              { id: "overdue" as const,    icon: AlertTriangle, label: "Gecikmiş",     count: smartFilterCounts.overdue,    tone: "rose" as const },
              { id: "thisWeek" as const,   icon: Calendar,      label: "Bu hafta",     count: smartFilterCounts.thisWeek,   tone: "indigo" as const },
              { id: "priority" as const,   icon: Flame,         label: "Öncelikli",    count: smartFilterCounts.priority,   tone: "amber" as const },
              ...(currentUserEmail ? [{ id: "mine" as const, icon: UserCheck, label: "Bana atanan", count: smartFilterCounts.mine, tone: "emerald" as const }] : []),
              { id: "unassigned" as const, icon: UserX,         label: "Atanmamış",    count: smartFilterCounts.unassigned, tone: "slate" as const },
            ].map((chip) => {
              const Ic = chip.icon;
              const isActive = activeSmartFilter === chip.id;
              const isEmpty = chip.count === 0;
              // Tone bazlı renk paleti — aktif/pasif/empty
              const toneMap = isModernTemplate
                ? {
                    rose: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    indigo: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    amber: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    emerald: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    slate: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                  }
                : {
                rose:    { active: "border-rose-500 bg-rose-500 text-white ring-rose-300/50 dark:ring-rose-400/40 shadow-rose-500/20",       idle: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70",                badge: "bg-rose-600 text-white dark:bg-rose-500" },
                indigo:  { active: "border-indigo-500 bg-indigo-500 text-white ring-indigo-300/50 dark:ring-indigo-400/40 shadow-indigo-500/20", idle: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70", badge: "bg-indigo-600 text-white dark:bg-indigo-500" },
                amber:   { active: "border-amber-500 bg-amber-500 text-white ring-amber-300/50 dark:ring-amber-400/40 shadow-amber-500/20",    idle: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70",            badge: "bg-amber-600 text-white dark:bg-amber-500" },
                emerald: { active: "border-emerald-500 bg-emerald-500 text-white ring-emerald-300/50 dark:ring-emerald-400/40 shadow-emerald-500/20", idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70", badge: "bg-emerald-600 text-white dark:bg-emerald-500" },
                slate:   { active: "border-slate-600 bg-slate-700 text-white ring-slate-400/50 dark:ring-slate-500/40 shadow-slate-700/20",   idle: "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-800/70",          badge: "bg-slate-600 text-white dark:bg-slate-500" },
                };
              const tone = toneMap[chip.tone];
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => applySmartFilter(chip.id)}
                  disabled={isEmpty && !isActive}
                  aria-pressed={isActive}
                  data-tk-focus="true"
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all",
                    isActive
                      ? cn("shadow-sm ring-2 ring-offset-1 dark:ring-offset-slate-900", tone.active)
                      : tone.idle,
                    isEmpty && !isActive && "cursor-not-allowed opacity-50"
                  )}
                >
                  <Ic className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{chip.label}</span>
                  {chip.count > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                        isActive ? "bg-white/25 text-white" : tone.badge
                      )}
                    >
                      {chip.count > 99 ? "99+" : chip.count}
                    </span>
                  )}
                </button>
              );
            })}
            {activeSmartFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium",
                  isModernTemplate
                    ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-300 dark:hover:bg-slate-800"
                    : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                )}
                title="Hızlı filtreyi kapat"
              >
                <X className="h-3 w-3" aria-hidden />
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Filtreler — arama, kapsam ve alan filtreleri tek sakin bantta */}
        <div className={cn("px-3 py-2", isModernTemplate && "live-table-modern-toolbar")}>
        <div className="sr-only mb-2 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filtreler
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Grup A — Arama (h-8 toolbar standardı) */}
          <div className="relative w-full max-w-sm flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              placeholder="Görev veya kişi ara…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className={LIVE_TABLE_TOOLBAR_INPUT_CLASS}
            />
          </div>

          {/* Grup B — Kapsam + Gelişmiş filtre (h-8 toolbar standardı) */}
          <select
            value={projectLinkedFilter}
            onChange={(e) => setProjectLinkedFilter(e.target.value as "proje" | "tümü")}
            className={LIVE_TABLE_TOOLBAR_SELECT_CLASS}
            title="Canlı tabloda varsayılan olarak sadece projeye bağlı görevler gösterilir"
          >
            <option value="proje">Proje görevleri</option>
            <option value="tümü">Tüm görevler</option>
          </select>
          <button
            type="button"
            className={cn(
              LIVE_TABLE_TOOLBAR_BTN_CLASS,
              activeAdvancedFilterRuleCount > 0
                ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
            onClick={() => setAdvancedFilterOpen(true)}
            title="Tüm alanlarda metin koşulları (VE ile birleşir)"
          >
            <ListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Gelişmiş filtre
            {activeAdvancedFilterRuleCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-blue-500">
                {activeAdvancedFilterRuleCount}
              </span>
            )}
          </button>
          {/* /Grup B */}

          {/* Hızlı filtre dropdownları (Durum / Atanan / Öncelik / Tarih) — aynı flex row */}
          {/* Çoklu Durum Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className={cn(
                LIVE_TABLE_TOOLBAR_BTN_CLASS,
                Array.isArray(statusFilter) && statusFilter.length > 0
                  ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <ListTodo className="h-4 w-4" />
              {!Array.isArray(statusFilter) || statusFilter.length === 0 ? "Durum" : `Durum (${statusFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setStatusDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Durum seç</span>
                    {Array.isArray(statusFilter) && statusFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {statusOptions.map((status) => (
                    <label
                      key={status}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Array.isArray(statusFilter) && statusFilter.includes(status)}
                        onChange={(e) => {
                          const current = Array.isArray(statusFilter) ? statusFilter : [];
                          if (e.target.checked) {
                            setStatusFilter([...current, status]);
                          } else {
                            setStatusFilter(current.filter((s) => s !== status));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={cn(
                        "flex items-center gap-1.5",
                        /yapılacak|yapilacak|todo/i.test(status) && "text-slate-600 dark:text-slate-300",
                        /devam|sürüyor|progress/i.test(status) && "text-blue-600 dark:text-blue-400",
                        /tamamlandı|tamamlandi|done|completed/i.test(status) && "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {/yapılacak|yapilacak|todo/i.test(status) && <Circle className="h-3.5 w-3.5" />}
                        {/devam|sürüyor|progress/i.test(status) && <Loader2 className="h-3.5 w-3.5" />}
                        {/tamamlandı|tamamlandi|done|completed/i.test(status) && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {status}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Çoklu Atanan Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                Array.isArray(assigneeFilter) && assigneeFilter.length > 0
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <User className="h-4 w-4" />
              {!Array.isArray(assigneeFilter) || assigneeFilter.length === 0 ? "Atanan" : `Atanan (${assigneeFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {assigneeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAssigneeDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[300px] min-w-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Kişi seç</span>
                    {Array.isArray(assigneeFilter) && assigneeFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAssigneeFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {/* Atanmamış seçeneği */}
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={Array.isArray(assigneeFilter) && assigneeFilter.includes("__unassigned__")}
                      onChange={(e) => {
                        const current = Array.isArray(assigneeFilter) ? assigneeFilter : [];
                        if (e.target.checked) {
                          setAssigneeFilter([...current, "__unassigned__"]);
                        } else {
                          setAssigneeFilter(current.filter((a) => a !== "__unassigned__"));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <UserX className="h-3.5 w-3.5" />
                      Atanmamış
                    </span>
                  </label>
                  {/* Kişiler */}
                  {assigneeFilterOptions.map((assignee) => (
                    <label
                      key={assignee}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Array.isArray(assigneeFilter) && assigneeFilter.includes(assignee)}
                        onChange={(e) => {
                          const current = Array.isArray(assigneeFilter) ? assigneeFilter : [];
                          if (e.target.checked) {
                            setAssigneeFilter([...current, assignee]);
                          } else {
                            setAssigneeFilter(current.filter((a) => a !== assignee));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <User className="h-3.5 w-3.5" />
                        {assignee.length > 25 ? assignee.slice(0, 25) + "..." : assignee}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Çoklu Proje Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                Array.isArray(projectFilter) && projectFilter.length > 0
                  ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
              title="Görevleri ait oldukları projeye göre filtrele"
            >
              <FolderKanban className="h-4 w-4" />
              {!Array.isArray(projectFilter) || projectFilter.length === 0 ? "Proje" : `Proje (${projectFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {projectDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[320px] min-w-[240px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Proje seç</span>
                    {Array.isArray(projectFilter) && projectFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProjectFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {projectFilterOptions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                      Görüntülenebilir proje yok.
                    </div>
                  ) : (
                    projectFilterOptions.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={Array.isArray(projectFilter) && projectFilter.includes(p.id)}
                          onChange={(e) => {
                            const current = Array.isArray(projectFilter) ? projectFilter : [];
                            if (e.target.checked) {
                              setProjectFilter([...current, p.id]);
                            } else {
                              setProjectFilter(current.filter((id) => id !== p.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <FolderKanban className="h-3.5 w-3.5" />
                          {p.name.length > 28 ? p.name.slice(0, 28) + "..." : p.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Tarih kontrolü — modern dropdown + custom range kapsülü */}
          {(() => {
            // Preset etiketleri ve ikonları — modern lucide ile
            const datePresetMeta: Record<string, { label: string; icon: typeof Calendar; tint: string }> = {
              custom: { label: "Tarih aralığı", icon: CalendarRange, tint: "text-slate-500" },
              today: { label: "Bugün", icon: CalendarClock, tint: "text-blue-600" },
              tomorrow: { label: "Yarın", icon: Sunrise, tint: "text-amber-600" },
              thisWeek: { label: "Bu hafta", icon: CalendarDays, tint: "text-indigo-600" },
              nextWeek: { label: "Gelecek hafta", icon: CalendarDays, tint: "text-indigo-600" },
              thisMonth: { label: "Bu ay", icon: Calendar, tint: "text-violet-600" },
              nextMonth: { label: "Gelecek ay", icon: Calendar, tint: "text-violet-600" },
              last7days: { label: "Son 7 gün", icon: History, tint: "text-slate-600" },
              last30days: { label: "Son 30 gün", icon: History, tint: "text-slate-600" },
            };
            const meta = datePresetMeta[datePreset] ?? datePresetMeta.custom;
            const PresetIcon = meta.icon;
            const isActive = Boolean(dateFrom || dateTo);

            const presetButton = (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                      "bg-white dark:bg-slate-900",
                      isActive
                        ? "border-indigo-300 text-indigo-800 hover:border-indigo-400 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                    )}
                    aria-label="Tarih aralığı seç"
                  >
                    <PresetIcon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : meta.tint)} aria-hidden />
                    <span>{meta.label}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => applyDatePreset("custom")} className="gap-2">
                    <CalendarRange className="h-4 w-4 text-slate-500" aria-hidden />
                    <span className="flex-1">Özel aralık</span>
                    {datePreset === "custom" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Gelecek</div>
                  <DropdownMenuItem onClick={() => applyDatePreset("today")} className="gap-2">
                    <CalendarClock className="h-4 w-4 text-blue-600" aria-hidden />
                    <span className="flex-1">Bugün</span>
                    {datePreset === "today" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("tomorrow")} className="gap-2">
                    <Sunrise className="h-4 w-4 text-amber-600" aria-hidden />
                    <span className="flex-1">Yarın</span>
                    {datePreset === "tomorrow" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("thisWeek")} className="gap-2">
                    <CalendarDays className="h-4 w-4 text-indigo-600" aria-hidden />
                    <span className="flex-1">Bu hafta (7 gün)</span>
                    {datePreset === "thisWeek" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("nextWeek")} className="gap-2">
                    <CalendarDays className="h-4 w-4 text-indigo-600" aria-hidden />
                    <span className="flex-1">Gelecek hafta</span>
                    {datePreset === "nextWeek" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("thisMonth")} className="gap-2">
                    <Calendar className="h-4 w-4 text-violet-600" aria-hidden />
                    <span className="flex-1">Bu ay</span>
                    {datePreset === "thisMonth" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("nextMonth")} className="gap-2">
                    <Calendar className="h-4 w-4 text-violet-600" aria-hidden />
                    <span className="flex-1">Gelecek ay</span>
                    {datePreset === "nextMonth" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Geçmiş</div>
                  <DropdownMenuItem onClick={() => applyDatePreset("last7days")} className="gap-2">
                    <History className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
                    <span className="flex-1">Son 7 gün</span>
                    {datePreset === "last7days" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("last30days")} className="gap-2">
                    <History className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
                    <span className="flex-1">Son 30 gün</span>
                    {datePreset === "last30days" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  {isActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                          setDatePreset("custom");
                        }}
                        className="gap-2 text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                      >
                        <X className="h-4 w-4" aria-hidden />
                        <span className="flex-1">Temizle</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );

            // Özel aralık — modern takvim seçici
            const customRangeCapsule = datePreset === "custom" ? (
              <ModernDateRangePicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                active={isActive}
                onDateFromChange={(value) => {
                  setDateFrom(value);
                  setDatePreset("custom");
                }}
                onDateToChange={(value) => {
                  setDateTo(value);
                  setDatePreset("custom");
                }}
                onClear={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              />
            ) : null;

            // Preset seçildi + aktif aralık — özet rozeti
            const activePresetBadge = datePreset !== "custom" && isActive ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span>{formatDisplayDate(dateFrom)}</span>
                <ArrowRight className="h-2.5 w-2.5 opacity-60" aria-hidden />
                <span>{formatDisplayDate(dateTo)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setDatePreset("custom");
                  }}
                  className="ml-1 -mr-1 rounded p-0.5 text-indigo-600/70 transition-colors hover:bg-indigo-100 hover:text-indigo-800 dark:text-indigo-300/70 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-100"
                  title="Tarih aralığını temizle"
                  aria-label="Temizle"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ) : null;

            return (
              <>
                {presetButton}
                {customRangeCapsule}
                {activePresetBadge}
              </>
            );
          })()}
          {/* /Hızlı filtre dropdownları */}

          {/* Görünüm kontrolleri — sol toolbar ile aynı h-8 standardı */}
          <div
            className="ml-auto flex shrink-0 items-center gap-1.5"
            onDoubleClick={(e) => {
              const tag = (e.target as HTMLElement).tagName;
              if (["BUTTON", "INPUT", "SELECT", "TEXTAREA", "LABEL"].includes(tag)) return;
              if ((e.target as HTMLElement).closest("button, input, select, textarea, [role=button]")) return;
              setIsFullWidth((p) => !p);
            }}
            title="Çift tık ile tabloyu genişlet/daralt · Shift+F kısayolu"
          >
            <span className="hidden h-8 items-center text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline-flex">
              Görünüm
            </span>
            {canAutoSizeColumns && (
              <button
                type="button"
                onClick={handleAutoSizeColumns}
                aria-pressed={fitToContent}
                className={cn(
                  LIVE_TABLE_TOOLBAR_ICON_BTN_CLASS,
                  fitToContent &&
                    "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200"
                )}
                aria-label={fitToContent ? "Varsayılan sütun genişliğine dön" : "Sütunları içeriğe göre genişlet"}
                title={
                  fitToContent
                    ? "Aktif: tüm sütunlar içerik genişliğinde · tıkla, varsayılana dön"
                    : "Sütunları metin uzunluğuna açar (yatay scroll çıkabilir)"
                }
              >
                {fitToContent ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
              </button>
            )}
            <label htmlFor="live-table-density" className="sr-only">
              Görünüm yoğunluğu
            </label>
            <select
              id="live-table-density"
              value={tableDensity}
              onChange={(e) => updateSetting("liveTableDensity", e.target.value as LiveTableDensity)}
              title="Satır aralığı ve yazı boyutu"
              className={LIVE_TABLE_TOOLBAR_SELECT_CLASS}
            >
              <option value="compact">Yoğun</option>
              <option value="normal">Normal</option>
              <option value="comfortable">Büyük</option>
            </select>
            <label htmlFor="live-table-template" className="sr-only">
              Canlı Tablo şablonu
            </label>
            <select
              id="live-table-template"
              value={tableTemplate}
              onChange={(e) => updateSetting("liveTableTemplate", e.target.value as LiveTableTemplate)}
              title="Tablo şablonu"
              className={LIVE_TABLE_TOOLBAR_SELECT_CLASS}
            >
              <option value="classic">Klasik</option>
              <option value="modern">Modern</option>
            </select>
            <button
              type="button"
              onClick={() => setIsFullWidth((p) => !p)}
              className={cn(
                LIVE_TABLE_TOOLBAR_ICON_BTN_CLASS,
                isFullWidth &&
                  "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200"
              )}
              aria-label={isFullWidth ? "Daralt (Esc)" : "Tabloyu genişlet (Shift+F)"}
              title={isFullWidth ? "Daralt — Esc" : "Tabloyu genişlet — Shift+F · çift tık"}
              aria-pressed={isFullWidth}
            >
              {isFullWidth ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              isModernTemplate
                ? "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {table.getFilteredRowModel().rows.length} / {tasks.length} kayıt
          </span>
        </div>
        </div>
        {/* Aktif filtre özeti — sadece varsa gösterilir, minimum yer kaplar */}
        {activeFilterCount > 0 && (
          <div className={cn("flex flex-wrap items-center gap-1.5 px-0.5", isModernTemplate && "live-table-modern-active-filters")}>
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Aktif filtreler:
            </span>
            
            {/* Arama Filtresi */}
            {globalSearch.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                <Search className="h-3 w-3" />
                &quot;{globalSearch.length > 15 ? globalSearch.slice(0, 15) + "..." : globalSearch}&quot;
                <button
                  type="button"
                  onClick={() => setGlobalSearch("")}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-800"
                  title="Aramayı temizle"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Durum Filtreleri - Çoklu */}
            {(Array.isArray(statusFilter) ? statusFilter : []).map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              >
                {status === "Yapılacak" && <Circle className="h-3 w-3" />}
                {status === "Devam ediyor" && <Loader2 className="h-3 w-3" />}
                {status === "Tamamlandı" && <CheckCircle2 className="h-3 w-3" />}
                {status}
                <button
                  type="button"
                  onClick={() => setStatusFilter((Array.isArray(statusFilter) ? statusFilter : []).filter((s) => s !== status))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800"
                  title={`"${status}" filtresini kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Atanan Filtreleri - Çoklu */}
            {(Array.isArray(assigneeFilter) ? assigneeFilter : []).map((assignee) => (
              <span
                key={assignee}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                {assignee === "__unassigned__" ? <UserX className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {assignee === "__unassigned__" ? "Atanmamış" : (assignee.length > 15 ? assignee.slice(0, 15) + "..." : assignee)}
                <button
                  type="button"
                  onClick={() => setAssigneeFilter((Array.isArray(assigneeFilter) ? assigneeFilter : []).filter((a) => a !== assignee))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800"
                  title={`"${assignee === "__unassigned__" ? "Atanmamış" : assignee}" filtresini kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Proje Filtreleri - Çoklu */}
            {(Array.isArray(projectFilter) ? projectFilter : []).map((pid) => {
              const p = projectById.get(pid);
              const name = (p?.name ?? "").trim() || "(adsız proje)";
              return (
                <span
                  key={pid}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                >
                  <FolderKanban className="h-3 w-3" />
                  {name.length > 18 ? name.slice(0, 18) + "..." : name}
                  <button
                    type="button"
                    onClick={() => setProjectFilter((Array.isArray(projectFilter) ? projectFilter : []).filter((id) => id !== pid))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-sky-200 dark:hover:bg-sky-800"
                    title={`"${name}" projesini filtre dışı bırak`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

            {/* Tarih Filtresi */}
            {(dateFrom || dateTo || datePreset !== "custom") && (
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                <Calendar className="h-3 w-3" />
                {datePreset === "today" && "Bugün"}
                {datePreset === "tomorrow" && "Yarın"}
                {datePreset === "thisWeek" && "Bu hafta"}
                {datePreset === "nextWeek" && "Gelecek hafta"}
                {datePreset === "thisMonth" && "Bu ay"}
                {datePreset === "nextMonth" && "Gelecek ay"}
                {datePreset === "last7days" && "Son 7 gün"}
                {datePreset === "last30days" && "Son 30 gün"}
                {datePreset === "custom" && dateFrom && dateTo && `${formatDisplayDate(dateFrom)} → ${formatDisplayDate(dateTo)}`}
                {datePreset === "custom" && dateFrom && !dateTo && `${formatDisplayDate(dateFrom)}'den itibaren`}
                {datePreset === "custom" && !dateFrom && dateTo && `${formatDisplayDate(dateTo)}'e kadar`}
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setDatePreset("custom");
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800"
                  title="Tarih filtresini kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Gelişmiş filtre özeti */}
            {activeAdvancedFilterRuleCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-200">
                <ListFilter className="h-3 w-3 shrink-0" aria-hidden />
                Gelişmiş ({activeAdvancedFilterRuleCount} kural)
                <button
                  type="button"
                  onClick={() => setAdvancedFilterRules([])}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                  title="Gelişmiş kuralları kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Sütun Filtreleri - Excel tarzı */}
            {Object.entries(columnFilters).filter(([, values]) => values.length > 0).map(([colId, values]) => {
              const colLabel = colId.startsWith("extra:") 
                ? colId.replace("extra:", "") 
                : colId === "content" ? "Görev" 
                : colId === "status" ? "Durum" 
                : colId === "assignee" ? "Atanan" 
                : colId === "priority" ? "Öncelik"
                : colId === "due_date" ? "Bitiş"
                : colId;
              const displayValues = values.map(v => 
                v === "__empty__" ? "(Boş)" : v === "__filled__" ? "(Dolu)" : v
              ).join(", ");
              return (
                <span
                  key={colId}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800 dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span className="font-semibold">{colLabel}:</span>
                  <span className="max-w-[150px] truncate" title={displayValues}>
                    {displayValues.length > 25 ? displayValues.slice(0, 25) + "..." : displayValues}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter(colId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-cyan-200 dark:hover:bg-cyan-800"
                    title={`"${colLabel}" filtresini kaldır`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

            {/* Ayırıcı ve Tümünü Temizle */}
            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              title="Tüm filtreleri temizle"
            >
              <X className="h-3.5 w-3.5" />
              Tümünü temizle
            </button>
          </div>
        )}
      </div>
  );
}
