"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { TasksTable } from "@/components/TasksTable";
import { TasksKanban } from "@/components/TasksKanban";
import { TasksGantt } from "@/components/TasksGantt";
import { GorevOzeti } from "@/components/GorevOzeti";
import { Shield, Loader2, Table2, Columns3, GanttChart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { SectionHeader } from "@/components/ui/section-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ankaraHeader from "@/images/ankara.png";

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
    <div className="mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col overflow-hidden px-3 pb-4 sm:px-4 lg:px-6 lg:pb-6">
      {/* Başlık bandı: görsel ortada header yüksekliğine kadar büyür, alt çizgi (border-b) içinde kalır */}
      <header className="mb-3 shrink-0 border-b border-slate-200/80 pb-3 dark:border-slate-700/80">
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-stretch md:gap-3 lg:gap-5">
          <div className="flex min-w-0 shrink-0 flex-col justify-center md:max-w-[min(100%,22rem)] lg:max-w-[24rem]">
            <h1 className="text-ui-h1 tracking-tight text-slate-900 dark:text-slate-50">
              Canlı Tablo
            </h1>
            <p className="mt-1 text-ui-body text-slate-500 dark:text-slate-400">
              Google Tablolar benzeri: CSV içe aktarın, birlikte düzenleyin.
            </p>
          </div>
          <div className="relative min-h-[6rem] w-full flex-1 min-w-0 sm:min-h-[7rem] md:min-h-[7.5rem] lg:min-h-[8.5rem]">
            <Image
              src={ankaraHeader}
              alt=""
              fill
              priority
              className="object-contain object-center"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 55vw, 900px"
            />
          </div>
          <div className="flex shrink-0 items-center justify-end md:justify-end md:py-1">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">{`Dashboard'a dön`}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobilde tablo önce (üstte), özet altta; xl'de sol özet + sağ tablo */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 [grid-template-rows:minmax(0,1fr)_auto] sm:[grid-template-rows:minmax(0,1fr)_auto] xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] xl:[grid-template-rows:minmax(0,1fr)] xl:gap-4">
        <Section
          variant="flush"
          className="flex h-full min-h-0 max-h-full flex-col overflow-hidden shadow-md xl:col-start-2 xl:row-start-1"
        >
          <Tabs defaultValue="table" className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <SectionHeader
                level="section"
                title="Tüm görevler"
                subtitle="Gerçek zamanlı senkron · Satırda mor = başka kullanıcı odakta"
                spacing="none"
              />
              <TabsList className="shrink-0">
                <TabsTrigger value="table" className="gap-1.5">
                  <Table2 className="h-3.5 w-3.5" aria-hidden />
                  Tablo
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-1.5">
                  <Columns3 className="h-3.5 w-3.5" aria-hidden />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="gantt" className="gap-1.5">
                  <GanttChart className="h-3.5 w-3.5" aria-hidden />
                  Gantt
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="table"
              className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <TasksTable projectFilter={projectFilter} onProjectFilterChange={setProjectFilter} />
            </TabsContent>
            <TabsContent
              value="kanban"
              className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <TasksKanban projectFilter={projectFilter} />
            </TabsContent>
            <TabsContent
              value="gantt"
              className="flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <TasksGantt projectFilter={projectFilter} />
            </TabsContent>
          </Tabs>
        </Section>

        <Section
          as="aside"
          variant="flush"
          className="flex max-h-[min(42vh,320px)] min-h-0 flex-col overflow-hidden sm:max-h-[min(38vh,360px)] xl:sticky xl:top-14 xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100dvh-4.5rem)] xl:self-start"
        >
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <SectionHeader
              level="card"
              title="Görev özeti"
              subtitle="Son güncellenen görevler"
              spacing="none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            <GorevOzeti projectFilter={projectFilter} />
          </div>
        </Section>
      </div>
    </div>
  );
}
