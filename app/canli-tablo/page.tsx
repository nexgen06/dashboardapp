"use client";

import { useAuth } from "@/contexts/auth-context";
import { TasksTable } from "@/components/TasksTable";
import { GorevOzeti } from "@/components/GorevOzeti";
import { Shield } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CanliTabloPage() {
  const { hasPermission } = useAuth();
  const canLiveTable = hasPermission("area.liveTable");

  if (!canLiveTable) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-3" />
          <p className="text-slate-800 dark:text-slate-200 font-medium">Canlı Tablo&apos;ya erişim yetkiniz yok.</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Bu alan için yetki gerekir.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">Dashboard&apos;a dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-[1920px] mx-auto min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between shrink-0 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Canlı Tablo</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Google Tablolar benzeri: CSV içe aktarın, birlikte düzenleyin.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Dashboard&apos;a dön</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-4 min-h-0 flex-1">
        {/* Görevler Tablosu — içeriğe göre yükseklik, en fazla ekranın ~%40'ı; Canlı Tablo yukarıda kalsın diye */}
        <div className="flex flex-col shrink-0 max-h-[45vh] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Görev özeti</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              En son güncellenen görevlerin kısa listesi.
            </p>
          </div>
          <div className="overflow-auto px-4 pb-4 min-h-0">
            <GorevOzeti />
          </div>
        </div>
        {/* Canlı Tablo (Supabase) — kalan alanı kaplar */}
        <div className="flex flex-col flex-1 min-h-[280px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md overflow-hidden transition-shadow hover:shadow-lg">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Canlı Tablo (Supabase)</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Tüm görevler – canlı senkronizasyonla birlikte düzenleme. Başka biri aynı satırı düzenliyorsa sarı ile işaretlenir.
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <TasksTable />
          </div>
        </div>
      </div>
    </div>
  );
}
