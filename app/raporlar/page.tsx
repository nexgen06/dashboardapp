"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  Users,
  Download,
  Shield,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { isTaskCompleted } from "@/lib/taskStats";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";

type DateRange = "7d" | "30d" | "90d" | "all";

const RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Son 7 gün",
  "30d": "Son 30 gün",
  "90d": "Son 90 gün",
  all: "Tüm zaman",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function rangeStartMs(range: DateRange): number | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - days * DAY_MS;
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RaporlarPage() {
  const { hasPermission, isLoaded } = useAuth();
  const canView = hasPermission("area.reports") && hasPermission("reports.view");
  const { projects } = useProjects();
  const { tasks } = useTasksWithRealtime();

  const [range, setRange] = useState<DateRange>("30d");

  // Tarih aralığına göre filtrelenmiş görevler. Kapsam: updated_at veya created_at
  // pencere içinde olanlar. "Tüm zaman" → tüm görevler.
  const startMs = useMemo(() => rangeStartMs(range), [range]);
  const scopedTasks = useMemo(() => {
    if (startMs == null) return tasks;
    return tasks.filter((t) => {
      const u = t.updated_at ? new Date(t.updated_at).getTime() : 0;
      const cAny = (t as unknown as Record<string, unknown>).created_at;
      const c = typeof cAny === "string" ? new Date(cAny).getTime() : 0;
      const maxTs = Math.max(u, c);
      return maxTs >= startMs;
    });
  }, [tasks, startMs]);

  // KPI hesapları
  const stats = useMemo(() => {
    const total = scopedTasks.length;
    const completed = scopedTasks.filter((t) => isTaskCompleted(t)).length;
    const overdue = scopedTasks.filter((t) => {
      if (isTaskCompleted(t)) return false;
      if (!t.due_date) return false;
      const d = new Date(t.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d.getTime() < today.getTime();
    }).length;
    // Ortalama tamamlanma süresi (gün) — created_at → updated_at, sadece tamamlanmışlar
    let durSum = 0;
    let durN = 0;
    for (const t of scopedTasks) {
      if (!isTaskCompleted(t)) continue;
      const cAny = (t as unknown as Record<string, unknown>).created_at;
      const c = typeof cAny === "string" ? new Date(cAny).getTime() : 0;
      const u = t.updated_at ? new Date(t.updated_at).getTime() : 0;
      if (c > 0 && u > c) {
        durSum += (u - c) / DAY_MS;
        durN++;
      }
    }
    const avgDays = durN > 0 ? durSum / durN : null;
    return {
      total,
      completed,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgDays,
    };
  }, [scopedTasks]);

  // Proje bazında performans
  const projectStats = useMemo(() => {
    const byId = new Map<string, { project: Project; total: number; done: number; overdue: number }>();
    for (const p of projects) {
      byId.set(p.id, { project: p, total: 0, done: 0, overdue: 0 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const t of scopedTasks) {
      if (!t.project_id) continue;
      const entry = byId.get(String(t.project_id));
      if (!entry) continue;
      entry.total++;
      if (isTaskCompleted(t)) entry.done++;
      if (!isTaskCompleted(t) && t.due_date && new Date(t.due_date).getTime() < today.getTime()) {
        entry.overdue++;
      }
    }
    return Array.from(byId.values())
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [projects, scopedTasks]);

  // Atanan bazında dağılım
  const assigneeStats = useMemo(() => {
    const m = new Map<string, { total: number; done: number; overdue: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const t of scopedTasks) {
      const a = t.assignee?.trim() || "(atanmamış)";
      const e = m.get(a) ?? { total: 0, done: 0, overdue: 0 };
      e.total++;
      if (isTaskCompleted(t)) e.done++;
      if (!isTaskCompleted(t) && t.due_date && new Date(t.due_date).getTime() < today.getTime()) {
        e.overdue++;
      }
      m.set(a, e);
    }
    return Array.from(m.entries())
      .map(([assignee, s]) => ({ assignee, ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [scopedTasks]);

  // Haftalık tamamlanma trendi (son 8 hafta) — tüm görevlerden (range'den bağımsız)
  const weeklyTrend = useMemo(() => {
    const weeks: Array<{ label: string; count: number }> = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let w = 7; w >= 0; w--) {
      const end = new Date(now.getTime() - w * 7 * DAY_MS);
      const start = new Date(end.getTime() - 7 * DAY_MS);
      const count = tasks.filter((t) => {
        if (!isTaskCompleted(t) || !t.updated_at) return false;
        const u = new Date(t.updated_at).getTime();
        return u >= start.getTime() && u < end.getTime();
      }).length;
      weeks.push({
        label: end.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
        count,
      });
    }
    return weeks;
  }, [tasks]);
  const maxWeekly = Math.max(1, ...weeklyTrend.map((w) => w.count));

  const handleExport = () => {
    const header = ["Bölüm", "Ad", "Toplam", "Tamamlanan", "Gecikmiş", "Tamamlanma %"];
    const rows: string[][] = [header];
    rows.push(["KPI", "Genel", String(stats.total), String(stats.completed), String(stats.overdue), `${stats.completionRate}%`]);
    rows.push([]);
    rows.push(["Proje", "Ad", "Toplam", "Tamamlanan", "Gecikmiş", "Tamamlanma %"]);
    for (const p of projectStats) {
      const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
      rows.push(["Proje", p.project.name, String(p.total), String(p.done), String(p.overdue), `${pct}%`]);
    }
    rows.push([]);
    rows.push(["Atanan", "Kişi", "Toplam", "Tamamlanan", "Gecikmiş", "Tamamlanma %"]);
    for (const a of assigneeStats) {
      const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
      rows.push(["Atanan", a.assignee, String(a.total), String(a.done), String(a.overdue), `${pct}%`]);
    }
    downloadCsv(`raporlar-${range}-${Date.now()}.csv`, rows);
  };

  if (!isLoaded) {
    return (
      <div className="container flex max-w-2xl flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-12 w-12 text-amber-600 dark:text-amber-400" />
          <p className="font-medium text-slate-800 dark:text-slate-200">Raporlara erişim yetkiniz yok.</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Bu alan için yetki gerekir.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">{`Dashboard'a dön`}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Raporlar" }]} />

      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Raporlar
          </h1>
          <span className="text-xs text-slate-500 dark:text-slate-400">· {RANGE_LABELS[range]}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50">
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  range === r
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV indir
          </Button>
        </div>
      </header>

      {stats.total === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-10 w-10" />}
          title="Bu aralıkta rapor verisi yok"
          description="Seçili tarih aralığında tamamlanmış görev bulunmuyor. Aralığı genişletebilir veya görevlerinizin durumunu güncelleyebilirsiniz."
          action={
            <Button asChild>
              <Link href="/canli-tablo">Canlı tabloya git</Link>
            </Button>
          }
          secondaryAction={
            <Button variant="outline" asChild>
              <Link href="/projeler">Projelere git</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* KPI satırı */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<FolderKanban className="h-4 w-4" />}
              label="Toplam görev"
              value={String(stats.total)}
              tone="slate"
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Tamamlanan"
              value={`${stats.completed} · %${stats.completionRate}`}
              tone="emerald"
            />
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Gecikmiş"
              value={String(stats.overdue)}
              tone={stats.overdue > 0 ? "red" : "slate"}
            />
            <KpiCard
              icon={<Clock className="h-4 w-4" />}
              label="Ort. tamamlanma"
              value={stats.avgDays != null ? `${stats.avgDays.toFixed(1)} gün` : "—"}
              tone="blue"
            />
          </div>

          {/* Proje karşılaştırma */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <FolderKanban className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
              Proje karşılaştırma
            </h2>
            {projectStats.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Bu aralıkta projeye bağlı görev yok.</p>
            ) : (
              <ul className="space-y-2.5">
                {projectStats.map((p) => {
                  const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                  return (
                    <li key={p.project.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <Link
                          href={`/projeler/${p.project.id}`}
                          className="truncate text-sm font-medium text-slate-800 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {p.project.name || "İsimsiz proje"}
                        </Link>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {p.done}/{p.total} · %{pct}
                          {p.overdue > 0 && (
                            <span className="ml-1.5 text-red-600 dark:text-red-400">
                              · {p.overdue} gecikmiş
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct >= 80
                              ? "bg-emerald-500"
                              : pct >= 40
                              ? "bg-blue-500"
                              : "bg-amber-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Atanan dağılımı + haftalık trend */}
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
                Atanan iş yükü (top 10)
              </h2>
              {assigneeStats.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Veri yok.</p>
              ) : (
                <ul className="space-y-2">
                  {assigneeStats.map((a) => {
                    const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
                    return (
                      <li key={a.assignee}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                            {a.assignee}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                            {a.done}/{a.total} · %{pct}
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <TrendingUp className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
                Haftalık tamamlanma trendi (son 8 hafta)
              </h2>
              <div className="flex h-32 items-end gap-1">
                {weeklyTrend.map((w, i) => {
                  const heightPct = (w.count / maxWeekly) * 100;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="relative flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t bg-emerald-500/80 transition-all hover:bg-emerald-500"
                          style={{ height: `${Math.max(2, heightPct)}%` }}
                          title={`${w.label}: ${w.count} görev`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {w.count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex gap-1 text-[9px] text-slate-400 dark:text-slate-500">
                {weeklyTrend.map((w, i) => (
                  <span key={i} className="flex-1 text-center">
                    {w.label}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Raporlar mevcut görev verisinden hesaplanır; ayrı bir raporlama tablosu yoktur.
            &quot;Ortalama tamamlanma&quot; oluşturulma → son güncelleme aralığını esas alır.
          </p>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "slate" | "emerald" | "red" | "blue";
}) {
  const toneCls = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", toneCls)} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}
