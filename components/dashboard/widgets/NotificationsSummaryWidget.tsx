"use client";

import Link from "next/link";
import { Bell, ArrowRight, Megaphone, ListTodo, MessageSquare, AlertCircle, FolderOpen, UserCheck, Bot, ClipboardCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/contexts/notification-context";

/**
 * Bildirim özeti widget'ı.
 * NotificationProvider context'inden veri okur — fazladan fetch yapmaz.
 *
 * Gösterim: tür başına özet sayı (max 6 grup) + en üstte toplam.
 */

const TYPE_ICONS = {
  project_assigned: FolderOpen,
  task_assigned: ListTodo,
  overdue: AlertCircle,
  admin_team_done: UserCheck,
  chat_unread: MessageSquare,
  announcement: Megaphone,
  automation: Bot,
  workflow: ClipboardCheck,
} as const;

const TYPE_LABELS = {
  project_assigned: "Proje atamaları",
  task_assigned: "Görev atamaları",
  overdue: "Gecikmiş",
  admin_team_done: "Yönetici",
  chat_unread: "Sohbet",
  announcement: "Duyurular",
  automation: "Otomasyon",
  workflow: "Onay akışı",
} as const;

const TYPE_TINT = {
  project_assigned: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40",
  task_assigned: "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40",
  overdue: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40",
  admin_team_done: "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40",
  chat_unread: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40",
  announcement: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40",
  automation: "text-cyan-600 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/40",
  workflow: "text-sky-600 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/40",
} as const;

export function NotificationsSummaryWidget() {
  const summary = useNotifications();

  // Tür başına toplam sayım
  const byType = new Map<keyof typeof TYPE_LABELS, number>();
  for (const item of summary.items) {
    const t = item.type as keyof typeof TYPE_LABELS;
    if (!(t in TYPE_LABELS)) continue;
    byType.set(t, (byType.get(t) ?? 0) + item.count);
  }
  const visibleGroups = Array.from(byType.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80 sm:p-5"
      aria-label="Bildirim özeti"
    >
      <SectionHeader
        level="section"
        title="Bildirim Özeti"
        icon={<Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        actions={
          summary.totalCount > 0 ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200">
              {summary.totalCount} okunmamış
            </Badge>
          ) : undefined
        }
      />
      {summary.isLoading ? (
        <div className="mt-3 text-xs text-slate-400">Yükleniyor…</div>
      ) : visibleGroups.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/40 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <Bell className="h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Şu anda yeni bildirim yok.
          </p>
        </div>
      ) : (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {visibleGroups.slice(0, 6).map(([type, count]) => {
            const Icon = TYPE_ICONS[type];
            const tint = TYPE_TINT[type];
            return (
              <li key={type}>
                <Link
                  href={`/bildirimler?type=${type}`}
                  className="group flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 transition-colors hover:border-amber-300 hover:bg-amber-50/40 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-amber-700 dark:hover:bg-amber-950/15"
                >
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tint}`}
                    aria-hidden
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                    {TYPE_LABELS[type]}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" asChild className="text-xs">
          <Link href="/bildirimler">
            Tüm bildirimleri aç
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
