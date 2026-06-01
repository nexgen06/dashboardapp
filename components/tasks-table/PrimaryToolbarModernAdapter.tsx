"use client";

/* =============================================================================
 * PrimaryToolbarModernAdapter — TasksTable'daki mevcut state/handler'ları
 * Modern toolbar API'sine bağlayan ince katman.
 *
 * Mevcut state (filtre, sort, group, CF, saved views, vb.) HİÇ değişmez —
 * sadece görsel sunum değişir. Bu sayede klasik <-> modern arası tek tık geçiş.
 * ========================================================================== */

import { useCallback, useMemo, type ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import type { SortingState } from "@tanstack/react-table";
import {
  PrimaryToolbarModern,
  ActiveFilterBar,
  AddFab,
  type FilterOption,
  type SortCol,
  type ActiveFilterChip as ActiveFilterChipType,
  type ViewType,
  type CfRulePreview,
} from "@/components/tasks-table/PrimaryToolbarModern";
import { useSettings, type Settings, type LiveTableDensity, type LiveTableTemplate } from "@/contexts/settings-context";
import type { CfRule } from "@/hooks/useConditionalFormatting";
import type { GroupingField } from "@/hooks/useTasksTableGrouping";
import { Filter, User, Folder, CalendarRange, CircleDot, Flag } from "lucide-react";

type Props = {
  // Tablo & filtre
  table: Table<Task>;
  globalSearch: string;
  setGlobalSearch: (v: string) => void;
  projectLinkedFilter: "proje" | "tümü";
  setProjectLinkedFilter: (v: "proje" | "tümü") => void;
  /** Gerçek shape `string[]` (multi-select) */
  statusFilter: string[];
  setStatusFilter: (v: string[]) => void;
  statusOptions: string[];
  assigneeFilter: string[];
  setAssigneeFilter: (v: string[]) => void;
  /** Gerçek shape `string[]` (e-posta listesi) */
  assigneeFilterOptions: string[];
  projectFilter: string[];
  setProjectFilter: (v: string[]) => void;
  projectFilterOptions: Array<{ id: string; name: string }>;
  /** Gerçek shape `string` ("" = boş) */
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  activeFilterCount: number;
  clearFilters: () => void;
  // Smart filter
  activeSmartFilter: string | null;
  applySmartFilter: (id: string | null) => void;
  smartFilterCounts: Record<string, number>;
  // Group
  groupingField: GroupingField;
  setGroupingField: (g: GroupingField) => void;
  // CF
  cfRules: CfRule[];
  cfEnabledCount: number;
  onEditCf: () => void;
  // Settings
  updateSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  // Saved Views
  savedViewsProps: {
    views: Array<{ id: string; name: string }>;
    activeViewId: string | null;
    isModified: boolean;
    onSelect: (id: string) => void;
    onSaveAs: () => void;
    onUpdate: (id: string) => void;
  };
  // Actions
  onAddRow: () => void;
  onImport: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onPrint: () => void;
  // Fullscreen
  fullscreen: boolean;
  onFullscreen: () => void;
  // Reset
  onReset: () => void;
  // Detail open (search match)
  onOpenTask: (id: string) => void;
  tasks: Task[];

  /** SavedViewsControl gibi mevcut component slot (Görünüm'den önce render) */
  savedViewsSlot?: ReactNode;
};

export function PrimaryToolbarModernAdapter(p: Props) {
  const { settings } = useSettings();

  // filters merged object (combobox drill kullanır)
  const filters = useMemo(() => ({
    // status multi-select shape — tek değer için ilki gösterilir, drill multi UI'da göster
    status: p.statusFilter.length > 0 ? p.statusFilter[0] : null,
    atanan: p.assigneeFilter,
    proje: p.projectFilter,
    oncelik: null,
    dateFrom: p.dateFrom || null,
    dateTo: p.dateTo || null,
  }), [p.statusFilter, p.assigneeFilter, p.projectFilter, p.dateFrom, p.dateTo]);

  const filterOptions: Record<string, FilterOption[]> = useMemo(() => ({
    status: p.statusOptions.map((s) => ({ value: s, label: s })),
    // string[] (e-posta) → {value,label}
    atanan: p.assigneeFilterOptions.map((e) => ({ value: e, label: e })),
    proje: p.projectFilterOptions.map((x) => ({ value: x.id, label: x.name })),
    oncelik: [
      { value: "High", label: "Yüksek" }, { value: "Medium", label: "Orta" }, { value: "Low", label: "Düşük" },
    ],
  }), [p.statusOptions, p.assigneeFilterOptions, p.projectFilterOptions]);

  const setFilter = useCallback((key: string, value: unknown) => {
    if (key === "__date__") {
      const v = value as { dateFrom: string | null; dateTo: string | null };
      p.setDateFrom(v.dateFrom ?? "");
      p.setDateTo(v.dateTo ?? "");
      return;
    }
    if (key === "status") {
      // single value seçildiğinde multi-array'e çevir
      const v = value as string | null;
      p.setStatusFilter(v ? [v] : []);
    }
    else if (key === "atanan") p.setAssigneeFilter((value as string[]) || []);
    else if (key === "proje") p.setProjectFilter((value as string[]) || []);
    // oncelik şu an klasikte yok; ileride priority filter eklenince burada bağlanır
  }, [p]);

  // Search matches — basit içerik+atanan eşleşmesi (max 6)
  const matches = useMemo(() => {
    const q = p.globalSearch.trim().toLocaleLowerCase("tr");
    if (!q) return [];
    return p.tasks
      .filter((t) => {
        const hay = `${t.content ?? ""} ${t.assignee ?? ""}`.toLocaleLowerCase("tr");
        return hay.includes(q);
      })
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.content || "(Boş başlık)",
        subtitle: [t.assignee, t.status].filter(Boolean).join(" · "),
        dot: t.status?.toLowerCase().includes("tamam") ? "bg-emerald-400"
           : t.status?.toLowerCase().includes("devam") ? "bg-amber-400"
           : "bg-slate-300",
      }));
  }, [p.tasks, p.globalSearch]);

  // Sort kolonları (TanStack sorting state → SortCol[])
  const sorting: SortingState = p.table.getState().sorting;
  const sortCols: SortCol[] = sorting.map((s) => ({ key: s.id, dir: s.desc ? "desc" : "asc" }));
  const sortableCols = p.table.getAllLeafColumns()
    .filter((c) => c.getCanSort?.())
    .map((c) => ({
      key: c.id,
      label: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id,
    }));

  const onSortToggleDir = useCallback((key: string) => {
    p.table.setSorting((prev) => prev.map((s) => s.id === key ? { ...s, desc: !s.desc } : s));
  }, [p.table]);
  const onSortRemove = useCallback((key: string) => {
    p.table.setSorting((prev) => prev.filter((s) => s.id !== key));
  }, [p.table]);
  const onSortAdd = useCallback((key: string) => {
    p.table.setSorting((prev) => [...prev, { id: key, desc: false }]);
  }, [p.table]);
  const onClearSort = useCallback(() => p.table.resetSorting(), [p.table]);

  // CF rules → preview (ilk 5 enabled, tone mapping)
  const cfRulesPreview: CfRulePreview[] = useMemo(() =>
    p.cfRules.filter((r) => r.enabled).slice(0, 5).map((r) => ({
      id: r.id,
      label: r.name,
      tone: (r.style === "red" ? "rose" : r.style === "blue" ? "indigo" : r.style) as CfRulePreview["tone"],
    })), [p.cfRules]);

  // Grouping field → modern string
  const grouping = (p.groupingField as string) || "none";
  const setGrouping = useCallback((g: string) => {
    p.setGroupingField(g === "none" ? null : (g as GroupingField));
  }, [p]);

  // Columns sayım
  const allCols = p.table.getAllLeafColumns();
  const visibleCount = allCols.filter((c) => c.getIsVisible()).length;

  // Aktif filter chip listesi (Layer 2)
  const chips: ActiveFilterChipType[] = useMemo(() => {
    const out: ActiveFilterChipType[] = [];
    if (p.statusFilter.length > 0) {
      out.push({
        key: "status",
        label: "Durum",
        value: p.statusFilter.length === 1 ? p.statusFilter[0] : `${p.statusFilter.length} durum`,
        tone: "amber",
        icon: CircleDot,
        onClear: () => p.setStatusFilter([]),
      });
    }
    if (p.assigneeFilter.length > 0) {
      out.push({ key: "atanan", label: "Atanan", value: p.assigneeFilter.length === 1 ? p.assigneeFilter[0] : `${p.assigneeFilter.length} kişi`, tone: "emerald", icon: User,
        onClear: () => p.setAssigneeFilter([]) });
    }
    if (p.projectFilter.length > 0) {
      const names = p.projectFilter
        .map((id) => p.projectFilterOptions.find((o) => o.id === id)?.name)
        .filter(Boolean) as string[];
      out.push({ key: "proje", label: "Proje", value: names.length === 1 ? names[0] : `${names.length} proje`, tone: "sky", icon: Folder,
        onClear: () => p.setProjectFilter([]) });
    }
    if (p.dateFrom || p.dateTo) {
      const fmt = (d: string | null) => d ? d.split("-").reverse().join(".") : "…";
      out.push({ key: "date", label: "Tarih", value: `${fmt(p.dateFrom || null)} → ${fmt(p.dateTo || null)}`, tone: "indigo", icon: CalendarRange,
        onClear: () => { p.setDateFrom(""); p.setDateTo(""); } });
    }
    if (p.activeSmartFilter) {
      const QF_LABEL: Record<string, string> = {
        overdue: "Geciken", thisWeek: "Bu hafta", priority: "Yüksek öncelik",
        mine: "Bana atanan", unassigned: "Atanmamış",
      };
      out.push({ key: "smart", label: "Hızlı", value: QF_LABEL[p.activeSmartFilter] || p.activeSmartFilter, tone: "violet", icon: Filter,
        onClear: () => p.applySmartFilter(null) });
    }
    return out;
  }, [p]);

  // Pagination
  const pageSize = p.table.getState().pagination.pageSize;
  const setPageSize = useCallback((n: number) => p.table.setPageSize(n), [p.table]);

  // Modern density/style → settings'e direkt
  const density = settings.liveTableDensity;
  const setDensity = useCallback((d: LiveTableDensity) => p.updateSetting("liveTableDensity", d), [p]);
  const stylePreset: "modern" | "classic" = settings.liveTableTemplate === "modern" ? "modern" : "classic";
  const setStylePreset = useCallback((s: "modern" | "classic") =>
    p.updateSetting("liveTableTemplate", s as LiveTableTemplate), [p]);

  // View type — şu an sadece "table" implementli, diğerleri rezerv
  const [view, setView] = [("table" as ViewType), (_v: ViewType) => { /* TODO: page navigation */ }];

  // Ozet (özet strip) — local state, settings'e bağlamadık
  const ozet = false;
  const onToggleOzet = useCallback(() => { /* future: settings.toolbarOzet toggle */ }, []);

  // Klasik dönüş
  const onSwitchToClassic = useCallback(() => {
    p.updateSetting("toolbarStyle", "classic");
  }, [p]);

  return (
    <>
      <PrimaryToolbarModern
        // Search
        search={p.globalSearch} setSearch={p.setGlobalSearch} appliedCount={p.activeFilterCount}
        matches={matches} onOpenTask={p.onOpenTask}
        // Scope
        scope={p.projectLinkedFilter} setScope={p.setProjectLinkedFilter}
        // Quick filter
        smartFilter={p.activeSmartFilter} setSmartFilter={p.applySmartFilter} smartCounts={p.smartFilterCounts}
        // Filters
        filters={filters} setFilter={setFilter} filterOptions={filterOptions}
        // View
        view={view} setView={setView}
        // Görünüm dropdown
        grouping={grouping} setGrouping={setGrouping}
        sortCols={sortCols} sortableCols={sortableCols}
        onSortToggleDir={onSortToggleDir} onSortRemove={onSortRemove}
        onSortAdd={onSortAdd} onClearSort={onClearSort}
        cfActive={p.cfEnabledCount} cfRules={cfRulesPreview} onEditCf={p.onEditCf}
        density={density} setDensity={setDensity}
        stylePreset={stylePreset} setStylePreset={setStylePreset}
        visibleCount={visibleCount} columnTotal={allCols.length}
        onManageColumns={() => { /* TODO: columns drawer */ }}
        savedViews={p.savedViewsProps.views}
        activeViewId={p.savedViewsProps.activeViewId}
        setActiveViewId={p.savedViewsProps.onSelect}
        viewIsModified={p.savedViewsProps.isModified}
        onSaveViewAs={p.savedViewsProps.onSaveAs}
        onUpdateView={p.savedViewsProps.onUpdate}
        // Ekle
        onAddRow={p.onAddRow} onImport={p.onImport}
        onExportCsv={p.onExportCsv} onExportXlsx={p.onExportXlsx}
        onPrint={p.onPrint} onTemplate={p.onAddRow}
        // Fullscreen
        fullscreen={p.fullscreen} onFullscreen={p.onFullscreen}
        // Daha fazla
        ozet={ozet} onToggleOzet={onToggleOzet}
        pageSize={pageSize} setPageSize={setPageSize}
        onExportSettings={p.onExportCsv}
        onReset={p.onReset}
        // Klasik dönüş
        onSwitchToClassic={onSwitchToClassic}
        // SavedViewsControl slot
        savedViewsSlot={p.savedViewsSlot}
      />
      <ActiveFilterBar chips={chips} onClearAll={p.clearFilters} />
      <AddFab
        onAddRow={p.onAddRow} onImport={p.onImport}
        onExportCsv={p.onExportCsv} onExportXlsx={p.onExportXlsx}
        onPrint={p.onPrint} onTemplate={p.onAddRow}
      />
    </>
  );
}
