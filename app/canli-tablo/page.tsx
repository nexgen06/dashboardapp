"use client";

import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { TasksTable } from "@/components/TasksTable";
import { GorevOzeti } from "@/components/GorevOzeti";
import { Shield, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import ankaraHeader from "@/images/ankara.png";

export default function CanliTabloPage() {
  const { hasPermission, isLoaded } = useAuth();
  const canLiveTable = hasPermission("area.liveTable");

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
            <h1 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-2xl">
              Canlı Tablo
            </h1>
            <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400 sm:text-sm">
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
        <section className="flex h-full min-h-0 max-h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-800 xl:col-start-2 xl:row-start-1">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2 dark:border-slate-700 sm:px-4 sm:py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 sm:text-lg">
                Tüm görevler
              </h2>
              <p
                className="max-w-xl text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs"
                title="Canlı senkronizasyon; başka biri satırı düzenliyorsa mor vurgu görebilirsiniz."
              >
                Gerçek zamanlı senkron · Satırda mor = başka kullanıcı odakta
              </p>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TasksTable />
          </div>
        </section>

        <aside className="flex max-h-[min(42vh,320px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:max-h-[min(38vh,360px)] xl:sticky xl:top-14 xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100dvh-4.5rem)] xl:self-start">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2 dark:border-slate-700 sm:px-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Görev özeti</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
              Son güncellenen görevler
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-3 pt-2 sm:px-4">
            <GorevOzeti />
          </div>
        </aside>
      </div>
    </div>
  );
}
