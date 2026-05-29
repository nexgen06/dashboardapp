"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { SortingState } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import {
  COLUMN_VISIBILITY_LABELS,
  INTERNAL_EXTRA_DATA_KEYS,
} from "@/components/tasks-table/constants";
import {
  advancedFilterRuleIsActive,
  type AdvancedFilterRule,
} from "@/lib/liveTableAdvancedFilters";
import {
  countActiveLiveTableFilters,
  filterLiveTableTasks,
  getSmartFilterCounts,
} from "@/lib/liveTableFilters";
import type { LiveTablePersistedPrefs } from "@/lib/liveTableColumnPersistence";
import type { SavedViewConfig } from "@/lib/savedViews";
import { getChipOptionsForColumn, buildChipValueResolver, type ChipCatalog, type RowChipValue } from "@/lib/chipSystem";
import { isUrgentPriorityValue } from "@/lib/urgentTaskPriority";

export type UseTasksTableFiltersOptions = {
  tasks: Task[];
  projects: Project[];
  extProjectFilter?: string[];
  onProjectFilterChange?: (ids: string[]) => void;
  chipResolver: ReturnType<typeof buildChipValueResolver>;
  rowChipValues: RowChipValue[];
  chipCatalog: ChipCatalog;
  currentUserEmail: string;
  urgentPrioritySetForTable: Set<string>;
  setSorting: Dispatch<SetStateAction<SortingState>>;
};

export type TasksTableFiltersPersistedSlice = NonNullable<LiveTablePersistedPrefs["filters"]>;

export function useTasksTableFilters({
  tasks,
  projects,
  extProjectFilter,
  onProjectFilterChange,
  chipResolver,
  rowChipValues,
  chipCatalog,
  currentUserEmail,
  urgentPrioritySetForTable,
  setSorting,
}: UseTasksTableFiltersOptions) {

    const [quickFiltersOpen, setQuickFiltersOpen] = useState(true);
  /** Hangi hızlı filtre şu anda aktif (chip görsel state için).
   *  null = hiçbiri. clearFilters ve filtre değişiklikleri otomatik sıfırlar. */
  const [activeSmartFilter, setActiveSmartFilter] = useState<
    "overdue" | "thisWeek" | "priority" | "mine" | "unassigned" | null
  >(null);

  const [globalSearch, setGlobalSearch] = useState("");
  /** Varsayılan: sadece projeye bağlı görevler (standart tablo verisi gösterilmez) */
  const [projectLinkedFilter, setProjectLinkedFilter] = useState<"proje" | "tümü">("proje");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  /** Çoklu proje filtresi (görev hangi projeye bağlı): proje id listesi.
   *  Controlled: dışarıdan prop verilirse onu kullan, değilse internal state. */
  const [internalProjectFilter, setInternalProjectFilter] = useState<string[]>([]);
  const projectFilter = extProjectFilter ?? internalProjectFilter;
  const setProjectFilter = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      const value = typeof next === "function" ? next(projectFilter) : next;
      if (onProjectFilterChange) onProjectFilterChange(value);
      else setInternalProjectFilter(value);
    },
    [projectFilter, onProjectFilterChange]
  );

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Excel tarzı sütun filtreleri
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnFilterOpen, setColumnFilterOpen] = useState<string | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const [datePreset, setDatePreset] = useState<string>("custom");

  const [advancedFilterRules, setAdvancedFilterRules] = useState<AdvancedFilterRule[]>([]);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);

  /** Proje id -> proje (Proje sütununda isim göstermek ve filtre etiketleri için). */
  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  /** Proje filtresi seçenekleri: RLS'ten gelen tüm görünür projeler, ada göre sıralı. */
  const projectFilterOptions = useMemo(() => {
    return projects
      .map((p) => ({ id: p.id, name: (p.name ?? "").trim() || "(adsız proje)" }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [projects]);
  const hasProjectLinkedTasks = tasks.some(
    (task) => task.project_id != null && String(task.project_id).trim() !== ""
  );
  const requiresSingleProjectSelection =
    projectFilter.length !== 1 && (projectFilterOptions.length > 0 || hasProjectLinkedTasks);
  const projectSelectionTitle =
    projectFilter.length === 0 ? "Canlı tablo için proje seçin" : "Tek proje seçin";
  const projectSelectionDescription =
    projectFilter.length === 0
      ? "Farklı proje tablolarının kolonları birbirine karışmasın diye doğrudan açılışta tablo birleştirilmiyor. Bir proje seçtiğinizde sadece o projenin satırları ve kolonları gösterilir."
      : "Seçili projelerin kolon yapıları farklı olabilir. Veri karışmasını önlemek için Canlı Tablo özel kolonları tek proje seçildiğinde açılır.";

  /** Görünmez olan projelerin filtre seçimini temizle (proje silinirse vb.).
   *  ÖNEMLİ: projects henüz yüklenmediyse (projectFilterOptions boş) bu
   *  cleanup'ı ÇALIŞTIRMA — yoksa localStorage'tan hydrate edilen filtre,
   *  proje listesi gelmeden "geçersiz" sayılıp silinir ve kalıcılık bozulur. */
  useEffect(() => {
    if (projectFilter.length === 0) return;
    if (projectFilterOptions.length === 0) return; // projeler hâlâ yükleniyor olabilir
    const validIds = new Set(projectFilterOptions.map((p) => p.id));
    const valid = projectFilter.filter((id) => validIds.has(id));
    if (valid.length !== projectFilter.length) setProjectFilter(valid);
  }, [projectFilter, projectFilterOptions]);

  /** Atanan dropdown: tüm görünür projelerdeki atananlar. */
  const assigneeFilterOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      (p.assigned_emails ?? []).forEach((e) => {
        const v = String(e).trim();
        if (v) set.add(v);
      });
    });
    return Array.from(set).sort();
  }, [projects]);

  useEffect(() => {
    if (Array.isArray(assigneeFilter) && assigneeFilter.length > 0 && assigneeFilterOptions.length > 0) {
      const valid = assigneeFilter.filter((a) => assigneeFilterOptions.includes(a));
      if (valid.length !== assigneeFilter.length) {
        setAssigneeFilter(valid);
      }
    }
  }, [assigneeFilter, assigneeFilterOptions]);

  /**
   * Extra (dinamik) sütun kapsamı — Canlı Tablo karmaşası fix'i:
   *
   *  - Proje filtresi aktifse, sütun seti seçili projelerin görev verilerinden
   *    + seçili projelerin schema'larından (extra_column_keys) oluşur:
   *    kullanıcı bilinçli olarak o projeye odaklanmıştır, schema'sını proaktif
   *    görmek faydalıdır (Öneri 1 + #4).
   *  - Filtre yokken: yalnızca en az bir görevde değeri olan anahtarlar
   *    görünür (Öneri 2: schema-only kalabalık küresel tabloyu kirletmesin).
   *
   *  Sonuç: yeni bir projenin schema tanımı diğer projeleri kirletmez, ama
   *  o projeyi filtreleyince schema'sı görünür.
   */
  const scopedProjectIdSet = useMemo(
    () => (projectFilter.length === 1 ? new Set(projectFilter) : null),
    [projectFilter]
  );

  const scopedTasksForSchema = useMemo(() => {
    if (scopedProjectIdSet == null) return tasks;
    return tasks.filter(
      (t) => t.project_id != null && scopedProjectIdSet.has(String(t.project_id))
    );
  }, [tasks, scopedProjectIdSet]);

  /** Filtre aktifken seçili projelerin schema'sı (proje formundaki "Canlı tablo ek sütunları"). */
  const scopedProjectSchemaKeys = useMemo(() => {
    if (scopedProjectIdSet == null) return new Set<string>();
    const out = new Set<string>();
    projects.forEach((p) => {
      if (!scopedProjectIdSet.has(p.id)) return;
      for (const k of p.extra_column_keys ?? []) {
        const key = String(k ?? "").trim();
        if (key) out.add(key);
      }
    });
    return out;
  }, [projects, scopedProjectIdSet]);

  const extraDataKeys = useMemo(() => {
    if (requiresSingleProjectSelection) return [];
    const keys = new Set<string>(scopedProjectSchemaKeys);
    scopedTasksForSchema.forEach((t) => {
      if (t.extra_data && typeof t.extra_data === "object") {
        for (const [k, v] of Object.entries(t.extra_data)) {
          if (k == null || String(k).trim() === "") continue;
          if (INTERNAL_EXTRA_DATA_KEYS.has(k)) continue;
          // Filtre yoksa: sadece değer içeren anahtarlar (küresel tablo temizliği)
          // Filtre varsa: tüm anahtarlar dahil (kullanıcı projeye odaklı)
          if (scopedProjectIdSet != null || String(v ?? "").trim() !== "") {
            keys.add(k);
          }
        }
      }
    });
    return Array.from(keys).sort();
  }, [requiresSingleProjectSelection, scopedTasksForSchema, scopedProjectSchemaKeys, scopedProjectIdSet]);

  const advancedFilterFieldOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: "content", label: COLUMN_VISIBILITY_LABELS.content ?? "Açıklama" },
      { id: "status", label: COLUMN_VISIBILITY_LABELS.status ?? "Durum" },
      { id: "workflow", label: COLUMN_VISIBILITY_LABELS.workflow ?? "Onay" },
      { id: "assignee", label: "Atanan" },
      { id: "priority", label: "Öncelik" },
      { id: "due_date", label: "Son tarih" },
    ];
    for (const k of extraDataKeys) {
      opts.push({ id: `extra:${k}`, label: k });
    }
    return opts;
  }, [extraDataKeys]);

  const activeAdvancedFilterRuleCount = useMemo(
    () => advancedFilterRules.filter(advancedFilterRuleIsActive).length,
    [advancedFilterRules]
  );

  const autoSortedFieldRef = useRef<string | null>(null);
  useEffect(() => {
    const active = advancedFilterRules.filter(advancedFilterRuleIsActive);
    if (active.length === 1) {
      const field = active[0].field;
      if (field !== autoSortedFieldRef.current) {
        autoSortedFieldRef.current = field;
        setSorting([{ id: field, desc: false }]);
      }
    } else {
      autoSortedFieldRef.current = null;
    }
  }, [advancedFilterRules]);

  const filteredData = useMemo(
    () => {
      if (requiresSingleProjectSelection) return [];
      return filterLiveTableTasks({
        tasks,
        projectLinkedFilter,
        projectFilter,
        globalSearch,
        statusFilter,
        assigneeFilter,
        dateFrom,
        dateTo,
        columnFilters,
        advancedFilterRules,
        chipResolver,
        rowChipValues,
        chipCatalog,
      });
    },
    [
      tasks,
      projectLinkedFilter,
      projectFilter,
      requiresSingleProjectSelection,
      globalSearch,
      statusFilter,
      assigneeFilter,
      dateFrom,
      dateTo,
      chipResolver,
      rowChipValues,
      chipCatalog,
      columnFilters,
      advancedFilterRules,
    ]
  );

  const activeFilterCount = useMemo(
    () =>
      countActiveLiveTableFilters({
        globalSearch,
        statusFilter,
        assigneeFilter,
        projectFilter,
        dateFrom,
        dateTo,
        datePreset,
        columnFilters,
        activeAdvancedFilterRuleCount,
      }),
    [
      globalSearch,
      statusFilter,
      assigneeFilter,
      projectFilter,
      dateFrom,
      dateTo,
      datePreset,
      columnFilters,
      activeAdvancedFilterRuleCount,
    ]
  );

  const resolveProjectContextFromSavedFilters = useCallback(
    (savedProjectFilter: unknown): string[] => {
      if (!Array.isArray(savedProjectFilter)) return projectFilter;
      const validSavedProjects = savedProjectFilter.filter(
        (id): id is string => typeof id === "string" && id.trim() !== ""
      );
      if (validSavedProjects.length > 0) return validSavedProjects;
      return projectFilter;
    },
    [projectFilter]
  );

  const clearFilters = useCallback(() => {
    setProjectLinkedFilter("tümü");
    setGlobalSearch("");
    setStatusFilter([]);
    setAssigneeFilter([]);
    setDateFrom("");
    setDateTo("");
    setDatePreset("custom");
    setColumnFilters({});
    setAdvancedFilterRules([]);
    setActiveSmartFilter(null);
  }, []);

  const applyFilterConfigPatch = useCallback((filters?: SavedViewConfig["filters"]) => {
    if (!filters) return;
    const has = (key: keyof NonNullable<SavedViewConfig["filters"]>) =>
      Object.prototype.hasOwnProperty.call(filters, key);

    if (has("globalSearch")) setGlobalSearch(typeof filters.globalSearch === "string" ? filters.globalSearch : "");
    if (has("projectLinkedFilter")) setProjectLinkedFilter(filters.projectLinkedFilter === "proje" ? "proje" : "tümü");
    if (has("statusFilter")) setStatusFilter(Array.isArray(filters.statusFilter) ? filters.statusFilter : []);
    if (has("assigneeFilter")) setAssigneeFilter(Array.isArray(filters.assigneeFilter) ? filters.assigneeFilter : []);
    if (has("projectFilter")) setProjectFilter(resolveProjectContextFromSavedFilters(filters.projectFilter));
    if (has("dateFrom")) setDateFrom(typeof filters.dateFrom === "string" ? filters.dateFrom : "");
    if (has("dateTo")) setDateTo(typeof filters.dateTo === "string" ? filters.dateTo : "");
    if (has("datePreset")) setDatePreset(typeof filters.datePreset === "string" ? filters.datePreset : "custom");
    if (has("columnFilters")) {
      const patch = filters.columnFilters && typeof filters.columnFilters === "object" ? filters.columnFilters : {};
      setColumnFilters((prev) => ({ ...prev, ...patch }));
    }
    if (has("advancedFilterRules")) {
      setAdvancedFilterRules(Array.isArray(filters.advancedFilterRules) ? (filters.advancedFilterRules as AdvancedFilterRule[]) : []);
    }
  }, [resolveProjectContextFromSavedFilters, setProjectFilter]);

  // Sütun için benzersiz değerleri hesapla
  const getUniqueValuesForColumn = useCallback((columnId: string): string[] => {
    const values = new Set<string>();
    // 1) Görevlerden gerçek değerleri topla — chip-bound kolonlarda resolved label kullanılır
    tasks.forEach((t) => {
      let cellValue: string = "";
      if (columnId === "content") cellValue = t.content ?? "";
      else if (columnId === "status") cellValue = t.status ?? "";
      else if (columnId === "assignee") cellValue = t.assignee ?? "";
      else if (columnId === "priority") cellValue = t.priority ?? "";
      else if (columnId === "due_date") cellValue = t.due_date ?? "";
      else if (columnId.startsWith("extra:")) {
        const extraKey = columnId.replace("extra:", "");
        // Chip-bound override: resolved label varsa onu kullan
        const chipLabel = chipResolver(t, extraKey);
        if (chipLabel != null) {
          cellValue = chipLabel;
        } else if (t.extra_data) {
          cellValue = String(t.extra_data[extraKey] ?? "");
        }
      }
      if (cellValue && cellValue.trim()) {
        values.add(cellValue.trim());
      }
    });
    // 2) Chip-bound bir kolonsa, henüz hiç görevde kullanılmamış option'ları da ekle
    //    (kullanıcı "Kritik Risk" gibi var ama atanmamış olanları seçip filtre koyabilsin)
    if (columnId.startsWith("extra:")) {
      const extraKey = columnId.replace("extra:", "");
      // Görünen görevlerin proje ID'leri (her projede ayrı binding olabilir)
      const projectIds = new Set<string>();
      for (const t of tasks) {
        if (t.project_id) projectIds.add(String(t.project_id));
      }
      Array.from(projectIds).forEach((projectId) => {
        const options = getChipOptionsForColumn(projectId, extraKey, chipCatalog);
        options.forEach((opt) => values.add(opt.label));
      });
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "tr"));
  }, [tasks, chipResolver, chipCatalog]);

  // Sütun filtresi toggle
  const toggleColumnFilterValue = useCallback((columnId: string, value: string) => {
    setColumnFilters((prev) => {
      const current = prev[columnId] || [];
      if (current.includes(value)) {
        return { ...prev, [columnId]: current.filter((v) => v !== value) };
      } else {
        return { ...prev, [columnId]: [...current, value] };
      }
    });
  }, []);

  // Sütun filtresini temizle
  const clearColumnFilter = useCallback((columnId: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  }, []);

  // Gelişmiş Tarih Filtreleri
  const applyDatePreset = useCallback((preset: string) => {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    
    setDatePreset(preset);
    
    switch (preset) {
      case "today":
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "tomorrow":
        const yarin = new Date(bugun);
        yarin.setDate(yarin.getDate() + 1);
        setDateFrom(yarin.toISOString().split("T")[0]);
        setDateTo(yarin.toISOString().split("T")[0]);
        break;
      case "thisWeek":
        const haftaSonu = new Date(bugun);
        haftaSonu.setDate(bugun.getDate() + 7);
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(haftaSonu.toISOString().split("T")[0]);
        break;
      case "nextWeek":
        const gelecekHaftaBas = new Date(bugun);
        gelecekHaftaBas.setDate(bugun.getDate() + 7);
        const gelecekHaftaSon = new Date(bugun);
        gelecekHaftaSon.setDate(bugun.getDate() + 14);
        setDateFrom(gelecekHaftaBas.toISOString().split("T")[0]);
        setDateTo(gelecekHaftaSon.toISOString().split("T")[0]);
        break;
      case "thisMonth":
        const ayBas = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
        const aySon = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0);
        setDateFrom(ayBas.toISOString().split("T")[0]);
        setDateTo(aySon.toISOString().split("T")[0]);
        break;
      case "nextMonth":
        const gelecekAyBas = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 1);
        const gelecekAySon = new Date(bugun.getFullYear(), bugun.getMonth() + 2, 0);
        setDateFrom(gelecekAyBas.toISOString().split("T")[0]);
        setDateTo(gelecekAySon.toISOString().split("T")[0]);
        break;
      case "last7days":
        const yediGunOnce = new Date(bugun);
        yediGunOnce.setDate(bugun.getDate() - 7);
        setDateFrom(yediGunOnce.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "last30days":
        const otuzGunOnce = new Date(bugun);
        otuzGunOnce.setDate(bugun.getDate() - 30);
        setDateFrom(otuzGunOnce.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "custom":
        // Manuel tarih seçimi için boş bırak
        setDateFrom("");
        setDateTo("");
        break;
      default:
        setDateFrom("");
        setDateTo("");
    }
  }, []);

  // Akıllı Filtreler
  const applySmartFilter = useCallback((filterType: "overdue" | "thisWeek" | "priority" | "mine" | "unassigned") => {
    // Aynı filtreye tekrar tıklanırsa toggle (kapat)
    if (activeSmartFilter === filterType) {
      clearFilters();
      return;
    }
    clearFilters();
    setActiveSmartFilter(filterType);
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const haftaSonu = new Date(bugun);
    haftaSonu.setDate(bugun.getDate() + 7);

    switch (filterType) {
      case "overdue":
        // Gecikmiş: bitiş tarihi bugünden önce
        const dun = new Date(bugun);
        dun.setDate(dun.getDate() - 1);
        setDateTo(dun.toISOString().split("T")[0]);
        break;
      case "thisWeek":
        // Bu hafta bitenler
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(haftaSonu.toISOString().split("T")[0]);
        break;
      case "priority": {
        // Öncelikli = projenin önceliği acil set'inde olan projeleri filtrele
        // (Görev Özeti'ndeki "Acil öncelik" KPI'ı ile aynı kural).
        const urgentProjectIds = projects
          .filter((p) => isUrgentPriorityValue(p.priority, urgentPrioritySetForTable))
          .map((p) => p.id);
        if (urgentProjectIds.length > 0) {
          setProjectFilter(urgentProjectIds);
        }
        break;
      }
      case "mine":
        // Bana atanan
        if (currentUserEmail) {
          setAssigneeFilter([currentUserEmail]);
        }
        break;
      case "unassigned":
        // Atanmamış (boş assignee) - özel değer
        setAssigneeFilter(["__unassigned__"]);
        break;
    }
  }, [activeSmartFilter, clearFilters, currentUserEmail, projects, urgentPrioritySetForTable, setProjectFilter]);

  // Akıllı filtre sayıları
  // Kapsam: Görev Özeti ile aynı sabit kural — projesi olmayan ("orphan") görevler
  // HER ZAMAN hariç + aktif proje filtresi. Toolbar'daki `projectLinkedFilter` ("Tümü")
  // moduna bağlanmaz; aksi halde Görev Özeti ile sayılar tutmaz (kullanıcı toolbar'da
  // "Tümü"ye geçtiğinde orphan görevler özette görünmez ama hızlı filtrelerde sayılırdı).
  const smartFilterCounts = useMemo(
    () =>
      getSmartFilterCounts({
        tasks,
        projectFilter,
        projectById,
        urgentPrioritySet: urgentPrioritySetForTable,
        currentUserEmail,
      }),
    [tasks, currentUserEmail, projectById, urgentPrioritySetForTable, projectFilter]
  );


  const hydrateFiltersFromPrefs = useCallback((f: TasksTableFiltersPersistedSlice) => {
    setGlobalSearch(f.globalSearch);
    setProjectLinkedFilter(f.projectLinkedFilter);
    setStatusFilter(f.statusFilter);
    setAssigneeFilter(f.assigneeFilter);
    setDateFrom(f.dateFrom);
    setDateTo(f.dateTo);
    setDatePreset(f.datePreset);
    setColumnFilters(f.columnFilters);
    setAdvancedFilterRules(f.advancedFilterRules as AdvancedFilterRule[]);
  }, []);

  const filtersPersistedSlice = useMemo(
    (): TasksTableFiltersPersistedSlice => ({
      globalSearch,
      projectLinkedFilter,
      statusFilter,
      assigneeFilter,
      projectFilter: [],
      dateFrom,
      dateTo,
      datePreset,
      columnFilters,
      advancedFilterRules,
    }),
    [
      globalSearch,
      projectLinkedFilter,
      statusFilter,
      assigneeFilter,
      dateFrom,
      dateTo,
      datePreset,
      columnFilters,
      advancedFilterRules,
    ]
  );
  return {
    quickFiltersOpen,
    setQuickFiltersOpen,
    activeSmartFilter,
    setActiveSmartFilter,
    globalSearch,
    setGlobalSearch,
    projectLinkedFilter,
    setProjectLinkedFilter,
    statusFilter,
    setStatusFilter,
    assigneeFilter,
    setAssigneeFilter,
    projectFilter,
    setProjectFilter,
    statusDropdownOpen,
    setStatusDropdownOpen,
    assigneeDropdownOpen,
    setAssigneeDropdownOpen,
    projectDropdownOpen,
    setProjectDropdownOpen,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    columnFilters,
    setColumnFilters,
    columnFilterOpen,
    setColumnFilterOpen,
    columnFilterSearch,
    setColumnFilterSearch,
    datePreset,
    setDatePreset,
    advancedFilterRules,
    setAdvancedFilterRules,
    advancedFilterOpen,
    setAdvancedFilterOpen,
    projectById,
    projectFilterOptions,
    assigneeFilterOptions,
    requiresSingleProjectSelection,
    projectSelectionTitle,
    projectSelectionDescription,
    scopedProjectIdSet,
    extraDataKeys,
    advancedFilterFieldOptions,
    activeAdvancedFilterRuleCount,
    filteredData,
    activeFilterCount,
    smartFilterCounts,
    clearFilters,
    applySmartFilter,
    applyDatePreset,
    getUniqueValuesForColumn,
    toggleColumnFilterValue,
    clearColumnFilter,
    applyFilterConfigPatch,
    resolveProjectContextFromSavedFilters,
    hydrateFiltersFromPrefs,
    filtersPersistedSlice,
  };
}
