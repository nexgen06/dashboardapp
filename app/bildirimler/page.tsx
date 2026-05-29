"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  FolderOpen,
  ListTodo,
  AlertCircle,
  UserCheck,
  MessageSquare,
  CheckCheck,
  ArrowRight,
  Loader2,
  Megaphone,
  Bot,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { type NotificationSummaryItem } from "@/hooks/useNotificationSummary";
import { useNotifications } from "@/contexts/notification-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type NotifType = NotificationSummaryItem["type"];

const TYPE_META: Record<
  NotifType,
  { label: string; icon: typeof FolderOpen; chip: string; bg: string; text: string }
> = {
  project_assigned: {
    label: "Proje atamaları",
    icon: FolderOpen,
    chip: "Atama",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
  },
  task_assigned: {
    label: "Görev atamaları",
    icon: ListTodo,
    chip: "Görev",
    bg: "bg-indigo-100 dark:bg-indigo-900/40",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  overdue: {
    label: "Gecikmiş",
    icon: AlertCircle,
    chip: "Gecikmiş",
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
  },
  admin_team_done: {
    label: "Yönetici duyuruları",
    icon: UserCheck,
    chip: "Duyuru",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  chat_unread: {
    label: "Sohbet",
    icon: MessageSquare,
    chip: "Mesaj",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  announcement: {
    label: "Duyurular",
    icon: Megaphone,
    chip: "Duyuru",
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-700 dark:text-violet-300",
  },
  automation: {
    label: "Otomasyon",
    icon: Bot,
    chip: "Otomasyon",
    bg: "bg-cyan-100 dark:bg-cyan-900/40",
    text: "text-cyan-700 dark:text-cyan-300",
  },
  workflow: {
    label: "Onay akışı",
    icon: ClipboardCheck,
    chip: "Onay",
    bg: "bg-sky-100 dark:bg-sky-900/40",
    text: "text-sky-700 dark:text-sky-300",
  },
};

const ORDER: NotifType[] = [
  "announcement",
  "overdue",
  "task_assigned",
  "project_assigned",
  "chat_unread",
  "admin_team_done",
  "automation",
  "workflow",
];

type DateGroup = "today" | "week" | "older" | "unknown";
const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "Bugün",
  week: "Bu Hafta",
  older: "Daha Eski",
  unknown: "Diğer",
};

function getDateGroup(createdAt?: string): DateGroup {
  if (!createdAt) return "unknown";
  const now = new Date();
  const d = new Date(createdAt);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  if (d >= todayStart) return "today";
  if (d >= weekStart) return "week";
  return "older";
}

export default function BildirimlerPage() {
  const { isLoaded, user } = useAuth();
  const summary = useNotifications();
  const [activeType, setActiveType] = useState<NotifType | "all">("all");

  // Tür başına sayım
  const countsByType = useMemo(() => {
    const m: Record<NotifType, number> = {
      project_assigned: 0,
      task_assigned: 0,
      overdue: 0,
      admin_team_done: 0,
      chat_unread: 0,
      announcement: 0,
      automation: 0,
      workflow: 0,
    };
    for (const item of summary.items) {
      m[item.type] = (m[item.type] ?? 0) + item.count;
    }
    return m;
  }, [summary.items]);

  const filteredItems = useMemo(() => {
    if (activeType === "all") return summary.items;
    return summary.items.filter((i) => i.type === activeType);
  }, [summary.items, activeType]);

  // Tarih bazlı gruplama
  const groupedItems = useMemo(() => {
    const groups: Partial<Record<DateGroup, typeof filteredItems>> = {};
    for (const item of filteredItems) {
      const createdAt =
        item.createdAt ??
        (item.type === "announcement"
          ? summary.announcements?.find((a) => a.id === item.id)?.created_at
          : undefined);
      const g = getDateGroup(createdAt);
      if (!groups[g]) groups[g] = [];
      groups[g]!.push(item);
    }
    return groups;
  }, [filteredItems, summary.announcements]);

  const groupOrder: DateGroup[] = ["today", "week", "older", "unknown"];
  const activeGroups = groupOrder.filter((g) => (groupedItems[g]?.length ?? 0) > 0);
  const hasMultipleGroups = activeGroups.length > 1;

  // Görüntülenen tür için sıralı sekmeler (mevcut + 0 sayanlar dahil)
  const tabs: Array<{ value: NotifType | "all"; label: string; count: number }> = [
    { value: "all", label: "Tümü", count: summary.totalCount },
    ...ORDER.map((t) => ({
      value: t,
      label: TYPE_META[t].label,
      count: countsByType[t],
    })),
  ];

  if (!isLoaded) {
    return (
      <div className="container flex max-w-2xl flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
        <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-2xl py-16">
        <p className="text-slate-600 dark:text-slate-400">Giriş yapmanız gerekir.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Bildirimler" }]} />

      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Bildirimler
          </h1>
          {summary.totalCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {summary.totalCount}
            </span>
          )}
        </div>
        {summary.totalCount > 0 && summary.onMarkAllRead && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void summary.onMarkAllRead?.()}
            className="gap-1.5"
            title="Tüm bildirimleri okundu olarak işaretle"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Hepsini okundu işaretle
          </Button>
        )}
      </header>

      {/* Tür filtre sekmeleri */}
      <nav className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Bildirim türü">
        {tabs.map((tab) => {
          const selected = activeType === tab.value;
          const disabled = tab.value !== "all" && tab.count === 0;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => setActiveType(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selected
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : disabled
                  ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-bold",
                    selected
                      ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Liste */}
      {summary.isLoading ? (
        // Bildirim öğesi skeleton — gerçek liste şekline benzer
        <ul
          className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800"
          aria-busy="true"
          aria-label="Bildirimler yükleniyor"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex items-start gap-3 px-4 py-3"
              style={{ opacity: 1 - i * 0.1 }}
            >
              {/* Tip ikonu */}
              <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
              {/* İçerik */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="ml-auto h-3 w-20" />
                </div>
                <Skeleton className="h-4" style={{ width: `${55 + (i * 13) % 35}%` }} />
                {i % 2 === 0 && (
                  <>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title={activeType === "all" ? "Yeni bildirim yok" : "Bu kategoride bildirim yok"}
          description={
            activeType === "all"
              ? "Yeni atamalar, gecikmiş görevler veya sohbet mesajları burada görünür."
              : "Başka bir kategori seçmeyi deneyin."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groupOrder.map((group) => {
            const items = groupedItems[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group}>
                {hasMultipleGroups && (
                  <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {DATE_GROUP_LABELS[group]}
                  </p>
                )}
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/50">
                  {items.map((item) => {
                    const meta = TYPE_META[item.type];
                    const Icon = meta.icon;

                    // Duyurular için özel render: body göster + tıkla = okundu işaretle
                    if (item.type === "announcement" && item.id) {
                      const announcement = summary.announcements?.find((a) => a.id === item.id);
                      const isRead = item.count === 0 || (summary.readAnnouncementIds?.has(item.id) ?? false);
                      const title = announcement?.title ?? item.label;
                      const body = announcement?.body ?? item.body ?? "";
                      const createdAt = announcement?.created_at ?? item.createdAt;
                      const authorEmail = announcement?.author_email ?? null;
                      return (
                        <li key={item.notificationId ?? item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isRead) void summary.markAnnouncementRead?.(item.id!);
                            }}
                            className={cn(
                              "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                              isRead
                                ? "opacity-70 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                                : "bg-violet-50/40 hover:bg-violet-50 dark:bg-violet-900/10 dark:hover:bg-violet-900/20"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                                meta.bg,
                                meta.text
                              )}
                              aria-hidden
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.bg, meta.text)}>
                                  {meta.chip}
                                </span>
                                {announcement?.pinned && (
                                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                    📌 Sabit
                                  </span>
                                )}
                                {!isRead && (
                                  <span className="h-2 w-2 rounded-full bg-violet-500" aria-label="Okunmamış" />
                                )}
                                {createdAt && (
                                  <span className="ml-auto text-[10px] text-slate-400">
                                    {new Date(createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </span>
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {title}
                              </span>
                              <span className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
                                {body}
                              </span>
                              {authorEmail && <span className="text-[10px] text-slate-400">— {authorEmail}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li key={item.id ?? `${item.type}-${item.label}`}>
                        <Link
                          href={item.href}
                          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
                        >
                          <span
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                              meta.bg,
                              meta.text
                            )}
                            aria-hidden
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  meta.bg,
                                  meta.text
                                )}
                              >
                                {meta.chip}
                              </span>
                              {item.count > 1 && (
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                  {item.count}
                                </span>
                              )}
                              {item.createdAt && (
                                <span className="ml-auto text-[10px] text-slate-400">
                                  {new Date(item.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </span>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {(() => {
                                // Workflow bildirimlerinde title içindeki uzun e-postayı
                                // payload.actor_display_name ile değiştir.
                                const email = typeof item.payload?.actor_email === "string"
                                  ? item.payload.actor_email
                                  : null;
                                const display = typeof item.payload?.actor_display_name === "string"
                                  ? item.payload.actor_display_name
                                  : email ? email.split("@")[0] : null;
                                if (email && display && email !== display && item.label.includes(email)) {
                                  return item.label.replace(email, display);
                                }
                                return item.label;
                              })()}
                            </span>
                            {item.body && (
                              <span className="whitespace-pre-wrap text-xs leading-snug text-slate-600 dark:text-slate-300">
                                {item.body}
                              </span>
                            )}
                          </span>
                          <ArrowRight
                            className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Bildirimler merkezi kayıt kutusundan okunur; SQL henüz uygulanmamış ortamlarda eski türetilmiş bildirimler yedek olarak çalışır.
      </p>
    </div>
  );
}
