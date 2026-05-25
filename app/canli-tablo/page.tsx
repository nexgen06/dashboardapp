"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { TasksTable } from "@/components/TasksTable";
import { TasksKanban } from "@/components/TasksKanban";
import { TasksGantt } from "@/components/TasksGantt";
import { TasksCalendar } from "@/components/TasksCalendar";
import { GorevOzeti } from "@/components/GorevOzeti";
import { Shield, Loader2, Table2, Columns3, GanttChart, CalendarDays, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SectionHeader } from "@/components/ui/section-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

/** Proje filtresinin tutulduğu localStorage anahtarı (kullanıcı id bazlı). */
const projectFilterStorageKey = (userId: string) =>
  `dashboardapp.canli-tablo.projectFilter.v1:${userId}`;

function readProjectFilter(userId: string | null): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(projectFilterStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeProjectFilter(userId: string | null, value: string[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(projectFilterStorageKey(userId), JSON.stringify(value));
  } catch {
    /* localStorage devre dışı veya dolu */
  }
}

export default function CanliTabloPage() {
  const { hasPermission, isLoaded, user } = useAuth();
  const canLiveTable = hasPermission("area.liveTable") && hasPermission("liveTable.view");
  const userId = user?.id ?? null;
  /**
   * Canlı Tablo ve Görev Özeti arasında paylaşılan proje filtresi.
   * - SSR uyumu için initial state boş; mount sonrası localStorage'tan hydrate olur.
   * - setProjectFilter çağrıldığında ANINDA (debounce yok) localStorage'a yazılır.
   *   Böylece kullanıcı seçim yapıp hemen sayfa değiştirir/yenilerse kayıt korunur.
   */
  const [projectFilter, setProjectFilterState] = useState<string[]>([]);
  /**
   * Görev Özeti sidebar — varsayılan AÇIK. Kullanıcı isterse gizleyebilir,
   * tercih localStorage'a kayıt. xl+ ekranda solda 280px panel olarak görünür.
   * Önce: default kapalıydı → kullanıcı her açılışta toggle'a basmak zorundaydı.
   */
  const [summaryCollapsed, setSummaryCollapsedState] = useState(false);
  const [activeView, setActiveView] = useState("table");

  // Hydrate summary tercihini localStorage'tan (per-user)
  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(`dashboardapp.canli-tablo.summaryCollapsed.v1:${userId}`);
      if (stored === "true") setSummaryCollapsedState(true);
    } catch {
      /* localStorage devre dışı — yok say */
    }
  }, [userId]);

  const setSummaryCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setSummaryCollapsedState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        try {
          if (userId) {
            localStorage.setItem(`dashboardapp.canli-tablo.summaryCollapsed.v1:${userId}`, String(next));
          }
        } catch {
          /* localStorage devre dışı */
        }
        return next;
      });
    },
    [userId]
  );

  // Hydrate from localStorage after mount (user.id known).
  useEffect(() => {
    if (!userId) return;
    setProjectFilterState(readProjectFilter(userId));
  }, [userId]);

  const setProjectFilter = useCallback(
    (next: string[]) => {
      setProjectFilterState(next);
      writeProjectFilter(userId, next);
    },
    [userId]
  );

  const renderViewTabs = () => (
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500 sm:inline">
        Görünüm
      </span>
      <TabsList className="h-8 shrink-0 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-900/80">
        <TabsTrigger value="table" className="h-7 gap-1.5 rounded-md px-2.5 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-100">
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          Tablo
        </TabsTrigger>
        <TabsTrigger value="kanban" className="h-7 gap-1.5 rounded-md px-2.5 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-100">
          <Columns3 className="h-3.5 w-3.5" aria-hidden />
          Kanban
        </TabsTrigger>
        <TabsTrigger value="gantt" className="h-7 gap-1.5 rounded-md px-2.5 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-100">
          <GanttChart className="h-3.5 w-3.5" aria-hidden />
          Gantt
        </TabsTrigger>
        <TabsTrigger value="calendar" className="h-7 gap-1.5 rounded-md px-2.5 text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 dark:data-[state=active]:bg-slate-950 dark:data-[state=active]:text-slate-100">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          Takvim
        </TabsTrigger>
      </TabsList>
    </div>
  );

  /**
   * Görev Özeti aç/kapa toggle — view bağımsız.
   * - Tablo view'da: TasksTable'ın viewTabs prop'una bu butonla birlikte gelir
   * - Kanban/Gantt/Takvim view'larında: view-specific header'da görünür
   * Kapalıyken: PanelLeftOpen ikonu + "Özeti göster" (xl+ ekranda label)
   * Açıkken: PanelLeftClose ikonu + "Özeti gizle"
   */
  const renderSummaryToggle = () => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setSummaryCollapsed((value) => !value)}
      className="h-8 shrink-0 gap-1.5 text-xs"
      aria-pressed={!summaryCollapsed}
      title={summaryCollapsed ? "Görev özetini göster" : "Görev özetini gizle"}
    >
      {summaryCollapsed ? (
        <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="hidden xl:inline">{summaryCollapsed ? "Özeti göster" : "Özeti gizle"}</span>
    </Button>
  );

  /**
   * URL query `?project=ID` ile gelen proje filtre tohumu — proje detayından
   * "Canlı Tabloda Aç" tıklanınca buraya düşüyoruz. Filtre uygulanır ve URL
   * temizlenir ki kullanıcı içinde sonra filtre değiştirirse param yapışmasın.
   */
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!userId) return;
    const projectParam = searchParams.get("project");
    if (!projectParam) return;
    setProjectFilter([projectParam]);
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, searchParams]);

  if (!isLoaded) {
    return (
      <div className="container flex max-w-2xl flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
      </div>
    );
  }

  if (!canLiveTable) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-12 w-12 text-amber-600 dark:text-amber-400" />
          <p className="font-medium text-slate-800 dark:text-slate-200">{`Canlı Tablo'ya erişim yetkiniz yok.`}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Bu alan için yetki gerekir.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">{`Dashboard'a dön`}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden px-0 pb-0">
      {/* Kompakt başlık şeridi — breadcrumb + h1 + Dashboard butonu tek satır */}
      <header className="sr-only">
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Canlı Tablo
          </h1>
          <Breadcrumb
            className="min-w-0"
            items={[{ label: "Canlı Tablo" }]}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">{`← Dashboard`}</Link>
          </Button>
        </div>
      </header>

      {/* Mobilde tablo önce (üstte), özet altta; xl'de sol özet + sağ tablo */}
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-3 [grid-template-rows:minmax(0,1fr)_auto] sm:[grid-template-rows:minmax(0,1fr)_auto] xl:[grid-template-rows:minmax(0,1fr)]",
          summaryCollapsed
            ? "xl:grid-cols-1"
            : "xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] xl:gap-3"
        )}
      >
        <Section
          variant="flush"
          className={cn(
            "flex h-full min-h-0 max-h-full flex-col overflow-hidden shadow-md xl:row-start-1",
            summaryCollapsed ? "xl:col-start-1" : "xl:col-start-2"
          )}
        >
          <Tabs value={activeView} onValueChange={setActiveView} className="flex min-h-0 flex-1 flex-col">
            {activeView !== "table" && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <div className="sr-only">
                <SectionHeader
                  level="section"
                  title="Tüm görevler"
                  subtitle="Gerçek zamanlı senkron · Satırda mor = başka kullanıcı odakta"
                  spacing="none"
                />
              </div>
              {renderViewTabs()}
              <div className="flex shrink-0 items-center gap-2">
                {renderSummaryToggle()}
                <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                  <Link href="/">{`Dashboard`}</Link>
                </Button>
              </div>
            </div>
            )}
            <TabsContent
              value="table"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <TasksTable
                projectFilter={projectFilter}
                onProjectFilterChange={setProjectFilter}
                viewTabs={
                  <div className="flex min-w-0 items-center gap-2">
                    {renderViewTabs()}
                    {renderSummaryToggle()}
                  </div>
                }
              />
            </TabsContent>
            <TabsContent
              value="kanban"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <TasksKanban projectFilter={projectFilter} />
            </TabsContent>
            <TabsContent
              value="gantt"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <TasksGantt projectFilter={projectFilter} />
            </TabsContent>
            <TabsContent
              value="calendar"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <TasksCalendar projectFilter={projectFilter} />
            </TabsContent>
          </Tabs>
        </Section>

        {!summaryCollapsed && (
          <Section
            as="aside"
            variant="flush"
            className="flex max-h-[min(42vh,320px)] min-h-0 flex-col overflow-hidden sm:max-h-[min(38vh,360px)] xl:sticky xl:top-14 xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100dvh-4.5rem)] xl:self-start"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <SectionHeader
                level="card"
                title="Görev özeti"
                subtitle="Son güncellenen görevler"
                spacing="none"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSummaryCollapsed(true)}
                className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                aria-label="Görev özetini gizle"
                title="Görev özetini gizle"
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="scrollbar-themed min-h-0 flex-1 overflow-auto px-4 py-3">
              <GorevOzeti projectFilter={projectFilter} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
