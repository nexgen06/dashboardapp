"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "@/types/tasks";

/**
 * Canlı Tablo koşullu biçimlendirme (Excel/Sheets pattern).
 *
 * Kullanıcı kurallar tanımlar (alan + operatör + değer). Eşleşen
 * satırlar otomatik renkli vurgu alır (bg + sol kenar accent).
 *
 * Tasarım kararları:
 *   - Saf client-side (localStorage) — kullanıcı bazlı tercih, multi-user
 *     paylaşımı gerekirse Saved Views'a entegre edilecek (sonraki tur)
 *   - Built-in preset'ler önceden tanımlı (geciken/yüksek öncelik/atanmamış)
 *   - Birden fazla kural eşleşirse: ilk match kazanır (kullanıcı sıralayabilir)
 *   - Bg renkleri zaten var olan presence/automation/spotlight border'larıyla
 *     çakışmasın diye yumuşak (slate-tinted) tutuldu
 */

export type CfField = "status" | "assignee" | "priority" | "due_date" | "content";

export type CfOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "isEmpty"
  | "isNotEmpty"
  | "overdue"      // due_date geçmiş + tamamlanmamış
  | "dueToday"     // due_date == bugün
  | "dueThisWeek"; // due_date 7 gün içinde

export type CfStyleId = "red" | "amber" | "emerald" | "blue" | "violet" | "slate";

export type CfRule = {
  id: string;
  name: string;
  enabled: boolean;
  field: CfField;
  operator: CfOperator;
  /** Karşılaştırılacak değer (operatör isEmpty/overdue/dueToday/dueThisWeek için kullanılmaz) */
  value?: string;
  style: CfStyleId;
  /** Yazıyı bold yap */
  bold?: boolean;
};

export const CF_FIELDS: Array<{ id: CfField; label: string }> = [
  { id: "status", label: "Durum" },
  { id: "assignee", label: "Atanan" },
  { id: "priority", label: "Öncelik" },
  { id: "due_date", label: "Son tarih" },
  { id: "content", label: "İçerik" },
];

export const CF_OPERATORS: Array<{ id: CfOperator; label: string; valueNeeded: boolean; fields?: CfField[] }> = [
  { id: "equals", label: "eşittir", valueNeeded: true },
  { id: "notEquals", label: "eşit değildir", valueNeeded: true },
  { id: "contains", label: "içerir", valueNeeded: true },
  { id: "isEmpty", label: "boş", valueNeeded: false },
  { id: "isNotEmpty", label: "doludur", valueNeeded: false },
  { id: "overdue", label: "gecikti (otomatik)", valueNeeded: false, fields: ["due_date"] },
  { id: "dueToday", label: "bugün", valueNeeded: false, fields: ["due_date"] },
  { id: "dueThisWeek", label: "bu hafta", valueNeeded: false, fields: ["due_date"] },
];

export const CF_STYLES: Record<
  CfStyleId,
  { label: string; rowClass: string; accentClass: string; dotClass: string; chipClass: string }
> = {
  red: {
    label: "Kırmızı",
    rowClass: "bg-red-50/70 dark:bg-red-950/25 hover:bg-red-50 dark:hover:bg-red-950/40",
    accentClass: "border-l-red-500 dark:border-l-red-400",
    dotClass: "bg-red-500",
    chipClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  amber: {
    label: "Sarı",
    rowClass: "bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-50 dark:hover:bg-amber-950/40",
    accentClass: "border-l-amber-500 dark:border-l-amber-400",
    dotClass: "bg-amber-500",
    chipClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  emerald: {
    label: "Yeşil",
    rowClass: "bg-emerald-50/60 dark:bg-emerald-950/25 hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
    accentClass: "border-l-emerald-500 dark:border-l-emerald-400",
    dotClass: "bg-emerald-500",
    chipClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  blue: {
    label: "Mavi",
    rowClass: "bg-blue-50/60 dark:bg-blue-950/25 hover:bg-blue-50 dark:hover:bg-blue-950/40",
    accentClass: "border-l-blue-500 dark:border-l-blue-400",
    dotClass: "bg-blue-500",
    chipClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  violet: {
    label: "Mor",
    rowClass: "bg-violet-50/60 dark:bg-violet-950/25 hover:bg-violet-50 dark:hover:bg-violet-950/40",
    accentClass: "border-l-violet-500 dark:border-l-violet-400",
    dotClass: "bg-violet-500",
    chipClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  slate: {
    label: "Gri",
    rowClass: "bg-slate-100/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60",
    accentClass: "border-l-slate-400 dark:border-l-slate-500",
    dotClass: "bg-slate-400",
    chipClass: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  },
};

/** Built-in preset'ler — kullanıcı hızlıca aç/kapa yapabilir */
export const CF_PRESETS: CfRule[] = [
  {
    id: "preset-overdue",
    name: "Geciken görevler",
    enabled: false,
    field: "due_date",
    operator: "overdue",
    style: "red",
    bold: true,
  },
  {
    id: "preset-due-today",
    name: "Bugün biten",
    enabled: false,
    field: "due_date",
    operator: "dueToday",
    style: "amber",
  },
  {
    id: "preset-high-priority",
    name: "Yüksek öncelik",
    enabled: false,
    field: "priority",
    operator: "contains",
    value: "high",
    style: "red",
  },
  {
    id: "preset-unassigned",
    name: "Atanmamış",
    enabled: false,
    field: "assignee",
    operator: "isEmpty",
    style: "amber",
  },
  {
    id: "preset-completed",
    name: "Tamamlanmış (soluk)",
    enabled: false,
    field: "status",
    operator: "contains",
    value: "tamam",
    style: "slate",
  },
];

const STORAGE_KEY = "panel.tasksTable.conditionalFormatting.v1";

type Persisted = {
  rules: CfRule[];
};

function load(): Persisted {
  if (typeof window === "undefined") return { rules: CF_PRESETS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rules: CF_PRESETS };
    const parsed = JSON.parse(raw);
    if (!parsed?.rules || !Array.isArray(parsed.rules)) return { rules: CF_PRESETS };
    // Preset'lerle merge: kullanıcı sildiyse silsin ama yeni preset eklemesi olursa görünür
    const seen = new Set(parsed.rules.map((r: CfRule) => r.id));
    const merged = [
      ...parsed.rules,
      ...CF_PRESETS.filter((p) => !seen.has(p.id)),
    ];
    return { rules: merged };
  } catch {
    return { rules: CF_PRESETS };
  }
}

function save(state: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — sessiz */
  }
}

/** Tek bir kuralı task'a karşı test et */
function evalRule(rule: CfRule, task: Task, now: Date = new Date()): boolean {
  const raw = task[rule.field as keyof Task];
  const str = raw == null ? "" : String(raw).trim();

  switch (rule.operator) {
    case "isEmpty":
      return str === "";
    case "isNotEmpty":
      return str !== "";
    case "equals":
      return str.toLocaleLowerCase("tr") === (rule.value ?? "").trim().toLocaleLowerCase("tr");
    case "notEquals":
      return str.toLocaleLowerCase("tr") !== (rule.value ?? "").trim().toLocaleLowerCase("tr");
    case "contains":
      return str.toLocaleLowerCase("tr").includes((rule.value ?? "").trim().toLocaleLowerCase("tr"));
    case "overdue": {
      if (!task.due_date) return false;
      if (/tamamlandı|tamamlandi|done|completed|iptal|cancelled/i.test(task.status ?? "")) return false;
      try {
        const due = new Date(task.due_date);
        due.setHours(23, 59, 59, 999);
        return due.getTime() < now.getTime();
      } catch { return false; }
    }
    case "dueToday": {
      if (!task.due_date) return false;
      try {
        const d = new Date(task.due_date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      } catch { return false; }
    }
    case "dueThisWeek": {
      if (!task.due_date) return false;
      try {
        const d = new Date(task.due_date);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
      } catch { return false; }
    }
    default:
      return false;
  }
}

export function useConditionalFormatting() {
  const [rules, setRules] = useState<CfRule[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = load();
    setRules(loaded.rules);
    setHydrated(true);
  }, []);

  const updateRules = useCallback((updater: (prev: CfRule[]) => CfRule[]) => {
    setRules((prev) => {
      const next = updater(prev);
      save({ rules: next });
      return next;
    });
  }, []);

  const toggleRule = useCallback((id: string) => {
    updateRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, [updateRules]);

  const addRule = useCallback((rule: Omit<CfRule, "id">) => {
    updateRules((prev) => [...prev, { ...rule, id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]);
  }, [updateRules]);

  const deleteRule = useCallback((id: string) => {
    updateRules((prev) => prev.filter((r) => r.id !== id));
  }, [updateRules]);

  const updateRule = useCallback((id: string, patch: Partial<CfRule>) => {
    updateRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, [updateRules]);

  const resetToPresets = useCallback(() => {
    updateRules(() => CF_PRESETS);
  }, [updateRules]);

  const enabledRules = useMemo(() => rules.filter((r) => r.enabled), [rules]);

  /**
   * Bir task'a eşleşen ilk kuralı döner (null = eşleşme yok).
   * Sıralı: kullanıcı listede üstte olan kural önceliklidir.
   */
  const getRuleForTask = useCallback(
    (task: Task, now: Date = new Date()): CfRule | null => {
      for (const r of enabledRules) {
        if (evalRule(r, task, now)) return r;
      }
      return null;
    },
    [enabledRules]
  );

  return {
    rules,
    enabledRules,
    enabledCount: enabledRules.length,
    hydrated,
    toggleRule,
    addRule,
    deleteRule,
    updateRule,
    resetToPresets,
    getRuleForTask,
  };
}
