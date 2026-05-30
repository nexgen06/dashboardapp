"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  Sparkles,
  Clock,
  Archive,
  ExternalLink,
  Keyboard,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { type NotificationSummaryItem } from "@/hooks/useNotificationSummary";
import { useNotifications } from "@/contexts/notification-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerList, StaggerItem } from "@/components/motion/StaggerList";
import {
  useNotificationSnooze,
  SNOOZE_PRESETS,
  type SnoozePreset,
} from "@/hooks/useNotificationSnooze";
import { cn } from "@/lib/utils";

type NotifType = NotificationSummaryItem["type"];

const TYPE_META: Record<
  NotifType,
  { label: string; icon: typeof FolderOpen; chip: string; bg: string; text: string }
> = {
  project_assigned: { label: "Proje atamaları", icon: FolderOpen, chip: "Atama", bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  task_assigned: { label: "Görev atamaları", icon: ListTodo, chip: "Görev", bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300" },
  overdue: { label: "Gecikmiş", icon: AlertCircle, chip: "Gecikmiş", bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  admin_team_done: { label: "Yönetici duyuruları", icon: UserCheck, chip: "Duyuru", bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  chat_unread: { label: "Sohbet", icon: MessageSquare, chip: "Mesaj", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  announcement: { label: "Duyurular", icon: Megaphone, chip: "Duyuru", bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
  automation: { label: "Otomasyon", icon: Bot, chip: "Otomasyon", bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300" },
  workflow: { label: "Onay akışı", icon: ClipboardCheck, chip: "Onay", bg: "bg-sky-100 dark:bg-sky-900/40", text: "text-sky-700 dark:text-sky-300" },
};

const ORDER: NotifType[] = [
  "announcement", "overdue", "task_assigned", "project_assigned",
  "chat_unread", "admin_team_done", "automation", "workflow",
];

type DateGroup = "today" | "week" | "older" | "unknown";
const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "Bugün", week: "Bu Hafta", older: "Daha Eski", unknown: "Diğer",
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

/** Bildirimden snooze key türet — sourceKey, notificationId veya tip+id */
function getItemKey(item: NotificationSummaryItem): string {
  return item.sourceKey ?? item.notificationId ?? item.id ?? `${item.type}-${item.label}`;
}

export default function BildirimlerPage() {
  const { isLoaded, user } = useAuth();
  const summary = useNotifications();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [activeType, setActiveType] = useState<NotifType | "all" | "snoozed">("all");
  // Focus mode — seçili bildirim index (klavye navigasyonu için)
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const prevCountRef = useRef<number>(-1);
  const snooze = useNotificationSnooze();

  // Snooze edilmiş item'ları ayır + ana listeden gizle
  const { activeItems, snoozedItems } = useMemo(() => {
    const active: NotificationSummaryItem[] = [];
    const snoozed: NotificationSummaryItem[] = [];
    for (const it of summary.items) {
      const key = getItemKey(it);
      if (snooze.isSnoozed(key)) snoozed.push(it);
      else active.push(it);
    }
    return { activeItems: active, snoozedItems: snoozed };
  }, [summary.items, snooze]);

  // Tür sayım — snooze hariç
  const countsByType = useMemo(() => {
    const m: Record<NotifType, number> = {
      project_assigned: 0, task_assigned: 0, overdue: 0, admin_team_done: 0,
      chat_unread: 0, announcement: 0, automation: 0, workflow: 0,
    };
    for (const item of activeItems) {
      m[item.type] = (m[item.type] ?? 0) + item.count;
    }
    return m;
  }, [activeItems]);

  const activeTotal = useMemo(
    () => activeItems.reduce((s, i) => s + i.count, 0),
    [activeItems]
  );

  const filteredItems = useMemo(() => {
    if (activeType === "all") return activeItems;
    if (activeType === "snoozed") return snoozedItems;
    return activeItems.filter((i) => i.type === activeType);
  }, [activeItems, snoozedItems, activeType]);

  // Tarih bazlı gruplama (gösterim için)
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

  // Düz liste (klavye navigasyonu için — grup sırasını koruyarak)
  const flatItems = useMemo(() => {
    const order: DateGroup[] = ["today", "week", "older", "unknown"];
    const flat: NotificationSummaryItem[] = [];
    for (const g of order) {
      for (const it of groupedItems[g] ?? []) flat.push(it);
    }
    return flat;
  }, [groupedItems]);

  // Index sınırla
  useEffect(() => {
    if (selectedIdx >= flatItems.length) setSelectedIdx(Math.max(0, flatItems.length - 1));
  }, [flatItems.length, selectedIdx]);

  const selectedItem = flatItems[selectedIdx] ?? null;
  const selectedKey = selectedItem ? getItemKey(selectedItem) : null;

  // Inbox zero kutlaması — total 1+ iken 0'a düşünce tetikle
  useEffect(() => {
    const prev = prevCountRef.current;
    if (prev > 0 && activeTotal === 0) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2400);
      return () => clearTimeout(t);
    }
    prevCountRef.current = activeTotal;
  }, [activeTotal]);

  /** Bildirimi arşivle (okundu işaretle) — auto-advance */
  const archiveItem = useCallback(
    async (item: NotificationSummaryItem) => {
      if (item.type === "announcement" && item.id) {
        await summary.markAnnouncementRead?.(item.id);
      } else if (item.sourceKey && summary.markSingleRead) {
        await summary.markSingleRead(item.sourceKey);
      }
      // Auto-advance: aynı index'te kal (bir sonraki item buraya kayar)
    },
    [summary]
  );

  /** Snooze — preset ile */
  const doSnooze = useCallback(
    (item: NotificationSummaryItem, preset: SnoozePreset) => {
      const key = getItemKey(item);
      snooze.snooze(key, preset);
      setSnoozeMenuOpen(false);
    },
    [snooze]
  );

  /** Bildirimin linkine git */
  const openItem = useCallback(
    (item: NotificationSummaryItem) => {
      // Önce okundu işaretle (Superhuman pattern), sonra git
      if (item.type === "announcement" && item.id) {
        void summary.markAnnouncementRead?.(item.id);
      } else if (item.sourceKey) {
        void summary.markSingleRead?.(item.sourceKey);
      }
      router.push(item.href);
    },
    [router, summary]
  );

  // Klavye kısayolları — input/textarea içinde değilse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as HTMLElement).isContentEditable)) return;
      if (snoozeMenuOpen && e.key === "Escape") {
        setSnoozeMenuOpen(false);
        return;
      }
      if (snoozeMenuOpen) return; // menü açıkken diğer kısayollar pasif

      if (flatItems.length === 0) return;
      const current = flatItems[selectedIdx] ?? flatItems[0];

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(flatItems.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        void archiveItem(current);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        openItem(current);
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        setSnoozeMenuOpen(true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        openItem(current);
      } else if (e.key === "Escape") {
        // Sayfada Esc → ana sayfaya dön
        router.back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatItems, selectedIdx, snoozeMenuOpen, archiveItem, openItem, router]);

  const groupOrder: DateGroup[] = ["today", "week", "older", "unknown"];
  const activeGroups = groupOrder.filter((g) => (groupedItems[g]?.length ?? 0) > 0);
  const hasMultipleGroups = activeGroups.length > 1;

  const tabs: Array<{ value: NotifType | "all" | "snoozed"; label: string; count: number }> = [
    { value: "all", label: "Tümü", count: activeTotal },
    ...ORDER.map((t) => ({ value: t, label: TYPE_META[t].label, count: countsByType[t] })),
    { value: "snoozed", label: "Ertelenmiş", count: snoozedItems.length },
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
    return <div className="container max-w-2xl py-16"><p className="text-slate-600 dark:text-slate-400">Giriş yapmanız gerekir.</p></div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Bildirimler" }]} />

      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Bildirimler
          </h1>
          {/* Inbox Zero göstergesi — D ile snooze yapılınca veya E ile arşivlenince azalır */}
          <InboxCounter total={activeTotal} celebrate={celebrate} reduced={!!reduced} />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <Keyboard className="h-3 w-3" aria-hidden />
            J/K · E arşivle · R aç · D ertele
          </span>
          {activeTotal > 0 && summary.onMarkAllRead && (
            <Button variant="outline" size="sm" onClick={() => void summary.onMarkAllRead?.()} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Hepsini okundu işaretle
            </Button>
          )}
        </div>
      </header>

      {/* Tür filtre sekmeleri */}
      <nav className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Bildirim türü">
        {tabs.map((tab) => {
          const selected = activeType === tab.value;
          const disabled = tab.value !== "all" && tab.value !== "snoozed" && tab.count === 0;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => { setActiveType(tab.value); setSelectedIdx(0); }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selected
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : disabled
                  ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60"
              )}
            >
              {tab.value === "snoozed" && <Clock className="h-3 w-3" aria-hidden />}
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  selected ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* İçerik — split (lg+): liste solda, detay sağda */}
      {summary.isLoading ? (
        <SkeletonList />
      ) : filteredItems.length === 0 ? (
        activeTotal === 0 && activeType === "all" ? (
          <InboxZeroState reduced={!!reduced} />
        ) : (
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title={activeType === "snoozed" ? "Ertelenmiş bildirim yok" : "Bu kategoride bildirim yok"}
            description={activeType === "snoozed" ? "D tuşu ile bildirim erteleyebilirsin." : "Başka bir kategori seçmeyi deneyin."}
          />
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Sol: liste */}
          <StaggerList className="flex flex-col gap-4">
            {groupOrder.map((group) => {
              const items = groupedItems[group];
              if (!items || items.length === 0) return null;
              return (
                <StaggerItem key={group}>
                  {hasMultipleGroups && (
                    <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {DATE_GROUP_LABELS[group]}
                    </p>
                  )}
                  <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/50">
                    {items.map((item) => {
                      const key = getItemKey(item);
                      const isSelected = selectedKey === key;
                      const meta = TYPE_META[item.type];
                      const Icon = meta.icon;
                      const isSnoozedView = activeType === "snoozed";
                      const snoozedUntil = snooze.snoozedUntil(key);
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => {
                              const idx = flatItems.findIndex((it) => getItemKey(it) === key);
                              if (idx >= 0) setSelectedIdx(idx);
                            }}
                            onDoubleClick={() => openItem(item)}
                            className={cn(
                              "group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
                              isSelected
                                ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400 dark:bg-indigo-900/20 dark:ring-indigo-500"
                                : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                            )}
                          >
                            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.bg, meta.text)} aria-hidden>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.bg, meta.text)}>
                                  {meta.chip}
                                </span>
                                {item.count > 1 && (
                                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{item.count}</span>
                                )}
                                {isSnoozedView && snoozedUntil && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    <Clock className="h-2.5 w-2.5" /> {snoozedUntil.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                                {item.createdAt && (
                                  <span className="ml-auto text-[10px] text-slate-400">
                                    {new Date(item.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </span>
                              <span className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {item.label}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </StaggerItem>
              );
            })}
          </StaggerList>

          {/* Sağ: detay (desktop only) */}
          <aside className="hidden lg:block">
            <DetailPanel
              item={selectedItem}
              onArchive={selectedItem ? () => void archiveItem(selectedItem) : undefined}
              onOpen={selectedItem ? () => openItem(selectedItem) : undefined}
              onSnoozeToggle={() => setSnoozeMenuOpen((v) => !v)}
              snoozeOpen={snoozeMenuOpen}
              onSnoozePick={(p) => selectedItem && doSnooze(selectedItem, p)}
              onUnsnooze={selectedItem ? () => snooze.unsnooze(getItemKey(selectedItem)) : undefined}
              isSnoozedItem={selectedItem ? snooze.isSnoozed(getItemKey(selectedItem)) : false}
              snoozedUntil={selectedItem ? snooze.snoozedUntil(getItemKey(selectedItem)) : null}
            />
          </aside>
        </div>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Bildirim merkezi inbox-zero felsefesiyle çalışır. Snooze ayarları bu tarayıcıda saklanır.
      </p>
    </div>
  );
}

/* ─── Yan bileşenler ───────────────────────────────────────────────────── */

function InboxCounter({ total, celebrate, reduced }: { total: number; celebrate: boolean; reduced: boolean }) {
  if (total === 0) {
    return (
      <motion.span
        key="zero"
        initial={reduced ? false : { scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
          celebrate && !reduced && "animate-pulse"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Inbox: 0 ✨
      </motion.span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
      Inbox: {total}
    </span>
  );
}

function InboxZeroState({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border-2 border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-10 text-center dark:border-emerald-800 dark:from-emerald-950/30 dark:to-slate-900/50"
    >
      <motion.div
        initial={reduced ? false : { scale: 0.6, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 480, damping: 18, delay: 0.1 }}
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30"
      >
        <Sparkles className="h-8 w-8 text-white" />
      </motion.div>
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Inbox sıfır! 🎉
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        Bugünün tüm bildirimlerini işledin. İyi iş — odağına geri dönebilirsin.
      </p>
    </motion.div>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3" style={{ opacity: 1 - i * 0.1 }}>
          <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
            <Skeleton className="h-4" style={{ width: `${55 + (i * 13) % 35}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Detay panel — desktop split-pane */
function DetailPanel({
  item, onArchive, onOpen, onSnoozeToggle, snoozeOpen, onSnoozePick, onUnsnooze, isSnoozedItem, snoozedUntil,
}: {
  item: NotificationSummaryItem | null;
  onArchive?: () => void;
  onOpen?: () => void;
  onSnoozeToggle: () => void;
  snoozeOpen: boolean;
  onSnoozePick: (p: SnoozePreset) => void;
  onUnsnooze?: () => void;
  isSnoozedItem: boolean;
  snoozedUntil: Date | null;
}) {
  if (!item) {
    return (
      <div className="sticky top-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
        Bir bildirim seç (klavye: J/K)
      </div>
    );
  }
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  return (
    <div className="sticky top-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", meta.bg, meta.text)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.bg, meta.text)}>
            {meta.chip}
          </span>
          <h3 className="mt-1.5 text-base font-semibold text-slate-900 dark:text-slate-100">{item.label}</h3>
          {item.body && (
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{item.body}</p>
          )}
          {item.createdAt && (
            <p className="mt-2 text-xs text-slate-400">
              {new Date(item.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          {isSnoozedItem && snoozedUntil && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Clock className="h-3 w-3" /> Ertelendi: {snoozedUntil.toLocaleString("tr-TR")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <Button size="sm" onClick={onOpen} className="gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" /> Aç <KbdHint>R</KbdHint>
        </Button>
        <Button size="sm" variant="outline" onClick={onArchive} className="gap-1.5">
          <Archive className="h-3.5 w-3.5" /> Arşivle <KbdHint>E</KbdHint>
        </Button>
        {isSnoozedItem ? (
          <Button size="sm" variant="outline" onClick={onUnsnooze} className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Ertelemeyi kaldır
          </Button>
        ) : (
          <div className="relative">
            <Button size="sm" variant="outline" onClick={onSnoozeToggle} className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Ertele <KbdHint>D</KbdHint>
            </Button>
            <AnimatePresence>
              {snoozeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.14 }}
                  className="absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
                  role="menu"
                >
                  {SNOOZE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      onClick={() => onSnoozePick(p.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <span>{p.label}</span>
                      <span className="text-[10px] text-slate-400">{p.short}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <Link
          href={item.href}
          className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Detaya git <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/40 bg-white/20 px-1 text-[9px] font-semibold uppercase">
      {children}
    </kbd>
  );
}
