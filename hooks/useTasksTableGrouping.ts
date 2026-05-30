"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Row } from "@tanstack/react-table";
import type { Task } from "@/types/tasks";
import { isTaskCompleted } from "@/components/tasks-table/statusHelpers";

/**
 * Canlı Tablo özel grouping mantığı.
 *
 * TanStack'in built-in grouping'i kullanmıyoruz çünkü:
 *   - Bizim kolon id'lerimiz (extra:*) doğrudan task field'larına eşlenmiyor
 *   - Pagination ile karışıyor
 *   - Virtualization'la entegrasyon karmaşık
 *
 * Bu hook saf task field'larından grupla, sonucu VirtualizedTbody'nin
 * tüketebileceği flat liste olarak döner (header + row item'ları sırayla).
 */

export type GroupingField =
  | "status"
  | "assignee"
  | "priority"
  | "project"
  | "dueBucket"
  | null;

export const GROUPING_OPTIONS: Array<{ id: NonNullable<GroupingField>; label: string }> = [
  { id: "status", label: "Durum" },
  { id: "assignee", label: "Atanan" },
  { id: "priority", label: "Öncelik" },
  { id: "project", label: "Proje" },
  { id: "dueBucket", label: "Son tarih (bucket)" },
];

export type GroupRowItem =
  | {
      type: "header";
      key: string;
      label: string;
      count: number;
      completedCount: number;
      collapsed: boolean;
    }
  | { type: "row"; key: string; row: Row<Task> };

const STORAGE_KEY = "panel.tasksTable.grouping.v1";

type Persisted = {
  field: GroupingField;
  collapsed: string[];
};

function loadState(): Persisted {
  if (typeof window === "undefined") return { field: null, collapsed: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { field: null, collapsed: [] };
    const parsed = JSON.parse(raw);
    return {
      field: parsed?.field ?? null,
      collapsed: Array.isArray(parsed?.collapsed) ? parsed.collapsed : [],
    };
  } catch {
    return { field: null, collapsed: [] };
  }
}

function saveState(state: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — sessiz */
  }
}

/** Due date'i 4 bucket'a böl: overdue / today / week / later / none */
function dueBucketOf(due?: string | null, now: Date = new Date()): string {
  if (!due) return "z-none|Tarih yok";
  let d: Date;
  try {
    d = new Date(due);
  } catch {
    return "z-none|Tarih yok";
  }
  if (Number.isNaN(d.getTime())) return "z-none|Tarih yok";
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dueDay < todayStart) return "a-overdue|⚠️ Geciken";
  if (dueDay.getTime() === todayStart.getTime()) return "b-today|📅 Bugün";
  if (dueDay <= weekEnd) return "c-week|🗓 Bu hafta";
  return "d-later|⏳ İleride";
}

function extractGroupKey(task: Task, field: NonNullable<GroupingField>, projectNameById?: Map<string, string>): { key: string; label: string } {
  switch (field) {
    case "status": {
      const v = (task.status ?? "").trim();
      const label = v || "—";
      // Sıralama için: belirli status'leri öne al
      const order =
        /tamamlandı|done/i.test(v) ? "c" :
        /devam|progress/i.test(v) ? "b" :
        /beklemede|waiting/i.test(v) ? "d" :
        /iptal|cancelled/i.test(v) ? "e" :
        /yapılacak|todo/i.test(v) ? "a" : "f";
      return { key: `${order}|${v.toLocaleLowerCase("tr") || "_empty"}`, label };
    }
    case "assignee": {
      const v = (task.assignee ?? "").trim();
      if (!v) return { key: "z-unassigned|", label: "Atanmamış" };
      return { key: `${v.toLocaleLowerCase("tr")}|${v}`, label: v };
    }
    case "priority": {
      const v = (task.priority ?? "").trim();
      if (!v) return { key: "z-empty|", label: "Önceliksiz" };
      const order =
        /high|yüksek|kritik|p1|acil|urgent/i.test(v) ? "a" :
        /medium|orta|p2/i.test(v) ? "b" :
        /low|düşük|p3/i.test(v) ? "c" : "d";
      return { key: `${order}|${v.toLocaleLowerCase("tr")}`, label: v };
    }
    case "project": {
      const pid = task.project_id ? String(task.project_id) : "";
      if (!pid) return { key: "z-no-project|", label: "Proje yok" };
      const name = projectNameById?.get(pid) ?? `#${pid}`;
      return { key: `${name.toLocaleLowerCase("tr")}|${pid}`, label: name };
    }
    case "dueBucket": {
      return dueBucketOf(task.due_date).split("|").reduce(
        (acc, part, i) => (i === 0 ? { ...acc, key: part } : { ...acc, label: part }),
        { key: "", label: "" }
      ) as { key: string; label: string };
    }
  }
}

export function useTasksTableGrouping({
  rows,
  projectNameById,
}: {
  rows: Row<Task>[];
  projectNameById?: Map<string, string>;
}) {
  const [state, setState] = useState<Persisted>({ field: null, collapsed: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  const setGroupingField = useCallback((field: GroupingField) => {
    setState((prev) => {
      const next = { ...prev, field };
      saveState(next);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setState((prev) => {
      const has = prev.collapsed.includes(key);
      const collapsed = has ? prev.collapsed.filter((k) => k !== key) : [...prev.collapsed, key];
      const next = { ...prev, collapsed };
      saveState(next);
      return next;
    });
  }, []);

  const setAllExpanded = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, collapsed: [] };
      saveState(next);
      return next;
    });
  }, []);

  const setAllCollapsed = useCallback((allKeys: string[]) => {
    setState((prev) => {
      const next = { ...prev, collapsed: allKeys };
      saveState(next);
      return next;
    });
  }, []);

  const groupedItems = useMemo<GroupRowItem[]>(() => {
    if (!state.field) {
      // Grouping kapalı: doğrudan satırları map et
      return rows.map((r) => ({ type: "row" as const, key: r.id, row: r }));
    }
    // Grupla: key → rows
    type Bucket = { key: string; label: string; rows: Row<Task>[] };
    const buckets = new Map<string, Bucket>();
    for (const r of rows) {
      const { key, label } = extractGroupKey(r.original, state.field!, projectNameById);
      if (!buckets.has(key)) buckets.set(key, { key, label, rows: [] });
      buckets.get(key)!.rows.push(r);
    }
    // Sıralı liste: key alfabetik (extractGroupKey'in prefix'i sıralama kontrol eder)
    const sorted = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key, "tr"));

    const collapsedSet = new Set(state.collapsed);
    const out: GroupRowItem[] = [];
    for (const b of sorted) {
      const completed = b.rows.filter((r) => isTaskCompleted(r.original)).length;
      const isCollapsed = collapsedSet.has(b.key);
      out.push({
        type: "header",
        key: b.key,
        label: b.label,
        count: b.rows.length,
        completedCount: completed,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) {
        for (const r of b.rows) {
          out.push({ type: "row", key: r.id, row: r });
        }
      }
    }
    return out;
  }, [rows, state, projectNameById]);

  const allGroupKeys = useMemo(() => {
    if (!state.field) return [];
    const keys = new Set<string>();
    for (const it of groupedItems) {
      if (it.type === "header") keys.add(it.key);
    }
    return Array.from(keys);
  }, [groupedItems, state.field]);

  return {
    groupingField: state.field,
    setGroupingField,
    groupedItems,
    toggleGroup,
    setAllExpanded,
    setAllCollapsed: () => setAllCollapsed(allGroupKeys),
    hydrated,
    allGroupKeys,
  };
}
