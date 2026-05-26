"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bell,
  FolderOpen,
  ListTodo,
  AlertCircle,
  UserCheck,
  MessageSquare,
  CheckCheck,
  Megaphone,
  Bot,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Check,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationSummary, NotificationSummaryItem } from "@/hooks/useNotificationSummary";
import type { NotificationType } from "@/lib/notifications";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<NotificationType, typeof Bell> = {
  project_assigned: FolderOpen,
  task_assigned: ListTodo,
  overdue: AlertCircle,
  admin_team_done: UserCheck,
  chat_unread: MessageSquare,
  announcement: Megaphone,
  automation: Bot,
  workflow: ClipboardCheck,
};

const TYPE_TINT: Record<NotificationType, { bg: string; text: string; rail: string }> = {
  project_assigned: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", rail: "bg-blue-500" },
  task_assigned: { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300", rail: "bg-indigo-500" },
  overdue: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", rail: "bg-red-500" },
  admin_team_done: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", rail: "bg-amber-500" },
  chat_unread: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300", rail: "bg-emerald-500" },
  announcement: { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300", rail: "bg-violet-500" },
  automation: { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300", rail: "bg-cyan-500" },
  workflow: { bg: "bg-sky-100 dark:bg-sky-900/40", text: "text-sky-700 dark:text-sky-300", rail: "bg-sky-500" },
};

/**
 * Workflow aksiyonuna göre satır kenarındaki rail rengi ve rozet tonu.
 * Onay akışı bildirimi tipinde, payload.action değerine bakılır.
 */
const WORKFLOW_ACTION_TINT: Record<
  string,
  { rail: string; chip: string; chipText: string; label: string }
> = {
  submit: {
    rail: "bg-sky-500",
    chip: "bg-sky-100 dark:bg-sky-900/40",
    chipText: "text-sky-700 dark:text-sky-300",
    label: "Kontrol",
  },
  approve: {
    rail: "bg-emerald-500",
    chip: "bg-emerald-100 dark:bg-emerald-900/40",
    chipText: "text-emerald-700 dark:text-emerald-300",
    label: "Onay",
  },
  request_revision: {
    rail: "bg-amber-500",
    chip: "bg-amber-100 dark:bg-amber-900/40",
    chipText: "text-amber-800 dark:text-amber-200",
    label: "Revize",
  },
  reject: {
    rail: "bg-red-500",
    chip: "bg-red-100 dark:bg-red-900/40",
    chipText: "text-red-700 dark:text-red-300",
    label: "Ret",
  },
  unlock: {
    rail: "bg-amber-500",
    chip: "bg-amber-100 dark:bg-amber-900/40",
    chipText: "text-amber-800 dark:text-amber-200",
    label: "Kilit açıldı",
  },
  unlock_request: {
    rail: "bg-orange-500",
    chip: "bg-orange-100 dark:bg-orange-900/40",
    chipText: "text-orange-800 dark:text-orange-200",
    label: "Talep",
  },
};

const MAX_VISIBLE = 30;
const SEARCH_THRESHOLD = 8; // bu kadar veya daha fazla item varsa search göster

type TabKey = "all" | "unread" | "workflow";

/** Bir item için workflow aksiyonunu payload'dan çıkar. */
function getWorkflowAction(item: NotificationSummaryItem): string | null {
  if (item.type !== "workflow") return null;
  const action = item.payload?.action;
  return typeof action === "string" ? action : null;
}

/** Bildirim türü/aksiyonuna göre satır görsel tonu. */
function getRowTint(item: NotificationSummaryItem) {
  const wfAction = getWorkflowAction(item);
  if (wfAction && WORKFLOW_ACTION_TINT[wfAction]) {
    const t = WORKFLOW_ACTION_TINT[wfAction];
    return {
      bg: TYPE_TINT.workflow.bg,
      text: TYPE_TINT.workflow.text,
      rail: t.rail,
      chip: t.chip,
      chipText: t.chipText,
      label: t.label,
    };
  }
  const base = TYPE_TINT[item.type] ?? TYPE_TINT.task_assigned;
  return {
    bg: base.bg,
    text: base.text,
    rail: base.rail,
    chip: base.bg,
    chipText: base.text,
    label: null as string | null,
  };
}

/** Aynı task üzerindeki workflow bildirimlerini son 24 saat penceresinde grupla. */
type Group = {
  key: string;
  primary: NotificationSummaryItem;
  related: NotificationSummaryItem[]; // primary dahil, kronolojik desc
  unreadCount: number;
};

function buildGroups(items: NotificationSummaryItem[]): Group[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  // Önce zaman desc sırala (kararlı gruplama için)
  const sorted = [...items].sort((a, b) => {
    const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bT - aT;
  });

  const groupMap = new Map<string, Group>();
  const out: Group[] = [];

  for (const item of sorted) {
    const tWithin24h =
      item.createdAt && now - new Date(item.createdAt).getTime() <= dayMs;
    const groupable = item.type === "workflow" && item.sourceId && tWithin24h;
    const gKey = groupable ? `workflow:${item.sourceId}` : null;

    if (gKey && groupMap.has(gKey)) {
      const g = groupMap.get(gKey)!;
      g.related.push(item);
      if (item.count > 0) g.unreadCount += 1;
      continue;
    }

    const rowKey = item.notificationId ?? item.sourceKey ?? item.id ?? `${item.type}-${item.label}-${item.createdAt ?? ""}`;
    const group: Group = {
      key: gKey ?? rowKey,
      primary: item,
      related: [item],
      unreadCount: item.count > 0 ? 1 : 0,
    };
    if (gKey) groupMap.set(gKey, group);
    out.push(group);
  }

  return out;
}

function NotificationRow({
  group,
  isOpen,
  onToggle,
  onMarkRead,
}: {
  group: Group;
  isOpen: boolean;
  onToggle: () => void;
  onMarkRead?: (sourceKey: string) => void;
}) {
  const item = group.primary;
  const Icon = ICON_MAP[item.type] ?? Bell;
  const tint = getRowTint(item);
  const unread = group.unreadCount > 0;
  const relative = item.createdAt ? getRelativeTime(new Date(item.createdAt)) : null;
  const hasBody = Boolean(item.body && item.body.trim());
  const isGrouped = group.related.length > 1;
  const expandable = hasBody || isGrouped;

  const handleRowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (expandable) onToggle();
  };

  const handleMarkSingle = (e: React.MouseEvent, key?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (key && onMarkRead) onMarkRead(key);
  };

  const handleMarkGroup = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onMarkRead) return;
    for (const r of group.related) {
      if (r.count > 0 && r.sourceKey) onMarkRead(r.sourceKey);
    }
  };

  return (
    <li
      className={cn(
        "relative border-b border-slate-100 last:border-b-0 dark:border-slate-700/60",
        unread ? "bg-white dark:bg-slate-800" : "bg-slate-50/40 dark:bg-slate-900/30"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0 h-full w-0.5",
          unread ? tint.rail : "bg-slate-200 dark:bg-slate-700"
        )}
        aria-hidden
      />

      <button
        type="button"
        onClick={handleRowClick}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 pl-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40"
      >
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            tint.bg,
            tint.text,
            !unread && "opacity-60"
          )}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            {/* Workflow için ek renkli rozet */}
            {tint.label && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                  tint.chip,
                  tint.chipText
                )}
              >
                {tint.label}
              </span>
            )}
            <span
              className={cn(
                "truncate text-sm leading-snug",
                unread
                  ? "font-semibold text-slate-900 dark:text-slate-50"
                  : "font-normal text-slate-600 dark:text-slate-400"
              )}
            >
              {item.label}
            </span>
            {isGrouped && (
              <span className="ml-1 shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                +{group.related.length - 1}
              </span>
            )}
            {unread && (
              <span
                className="ml-auto inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500"
                aria-label="Okunmamış"
              />
            )}
          </span>
          {relative && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {relative}
              {isGrouped && ` · ${group.related.length} hareket`}
            </span>
          )}
        </span>

        {expandable ? (
          isOpen ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )
        ) : null}
      </button>

      {/* Çekmece */}
      {isOpen && expandable && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 pl-12 dark:border-slate-700/50 dark:bg-slate-900/40">
          {/* Primary body */}
          {hasBody && (
            <p className="whitespace-pre-wrap text-xs leading-snug text-slate-700 dark:text-slate-300">
              {item.body}
            </p>
          )}

          {/* Grup üyeleri (primary hariç) */}
          {isGrouped && (
            <ul className="mt-2 space-y-1.5 border-t border-slate-200 pt-2 dark:border-slate-700/60">
              {group.related.slice(1).map((r) => {
                const rT = getRowTint(r);
                const rRelative = r.createdAt ? getRelativeTime(new Date(r.createdAt)) : null;
                return (
                  <li key={r.notificationId ?? r.sourceKey ?? r.label} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        r.count > 0 ? rT.rail : "bg-slate-300 dark:bg-slate-600"
                      )}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5">
                        {rT.label && (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1 py-0.5 text-[9px] font-bold uppercase",
                              rT.chip,
                              rT.chipText
                            )}
                          >
                            {rT.label}
                          </span>
                        )}
                        <span
                          className={cn(
                            "truncate text-[11px]",
                            r.count > 0 ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {r.label}
                        </span>
                      </span>
                      {rRelative && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{rRelative}</span>
                      )}
                    </span>
                    {r.count > 0 && r.sourceKey && onMarkRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkSingle(e, r.sourceKey)}
                        className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
                        title="Bu hareketi okundu işaretle"
                      >
                        <Check className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Link
              href={item.href}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-900/30"
              onClick={() => {
                if (!onMarkRead) return;
                for (const r of group.related) {
                  if (r.count > 0 && r.sourceKey) onMarkRead(r.sourceKey);
                }
              }}
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              Görevi aç
            </Link>
            {unread && onMarkRead && (
              <button
                type="button"
                onClick={handleMarkGroup}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/30"
                title={isGrouped ? "Bu görevin tüm hareketlerini okundu işaretle" : "Sadece bu bildirimi okundu işaretle"}
              >
                <Check className="h-3 w-3" aria-hidden />
                Okundu
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function NotificationBell({ summary }: { summary: NotificationSummary }) {
  const { totalCount, items, isLoading, onMarkAllRead, markSingleRead } = summary;
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");

  // Tab başına sayım
  const tabCounts = useMemo(() => {
    let unread = 0;
    let workflow = 0;
    let workflowUnread = 0;
    for (const i of items) {
      if (i.count > 0) unread += 1;
      if (i.type === "workflow") {
        workflow += 1;
        if (i.count > 0) workflowUnread += 1;
      }
    }
    return { all: items.length, unread, workflow, workflowUnread };
  }, [items]);

  // Filtre uygula
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (!i.label || !i.label.trim()) return false;
      if (activeTab === "unread" && i.count === 0) return false;
      if (activeTab === "workflow" && i.type !== "workflow") return false;
      if (q) {
        const hay = `${i.label} ${i.body ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, activeTab, search]);

  // Grupla + sırala (okunmamış önce, sonra createdAt desc)
  const groups = useMemo(() => {
    const built = buildGroups(filteredItems);
    return built
      .sort((a, b) => {
        const aU = a.unreadCount > 0 ? 1 : 0;
        const bU = b.unreadCount > 0 ? 1 : 0;
        if (aU !== bU) return bU - aU;
        const aT = a.primary.createdAt ? new Date(a.primary.createdAt).getTime() : 0;
        const bT = b.primary.createdAt ? new Date(b.primary.createdAt).getTime() : 0;
        return bT - aT;
      })
      .slice(0, MAX_VISIBLE);
  }, [filteredItems]);

  const badgeLabel = totalCount > 9 ? "9+" : String(totalCount);
  const showSearch = items.length >= SEARCH_THRESHOLD;

  const tabs: Array<{ key: TabKey; label: string; count: number; highlight?: boolean }> = [
    { key: "all", label: "Tümü", count: tabCounts.all },
    { key: "unread", label: "Okunmamış", count: tabCounts.unread, highlight: tabCounts.unread > 0 },
    { key: "workflow", label: "Onay", count: tabCounts.workflowUnread || tabCounts.workflow, highlight: tabCounts.workflowUnread > 0 },
  ];

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && summary.onPanelOpened) summary.onPanelOpened();
        if (!open) {
          setOpenId(null);
          setSearch("");
          setActiveTab("all");
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Bildirimler"
        >
          <Bell className={totalCount > 0 ? "h-5 w-5 animate-[wiggle_1s_ease-in-out_2]" : "h-5 w-5"} />
          {totalCount > 0 && (
            <>
              <span
                className="absolute -right-0.5 -top-0.5 h-5 w-5 animate-ping rounded-full bg-amber-400 opacity-60"
                aria-hidden
              />
              <span
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800"
                aria-hidden
              >
                {badgeLabel}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[440px] max-w-[calc(100vw-1rem)] rounded-xl border-slate-200 bg-white p-0 shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Bell className="h-4 w-4 text-slate-500" aria-hidden />
            Bildirimler
            {totalCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {totalCount}
              </span>
            )}
          </span>
          {totalCount > 0 && onMarkAllRead && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onMarkAllRead();
              }}
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
              title="Tüm bildirimleri okundu olarak işaretle"
            >
              <CheckCheck className="h-3 w-3" aria-hidden />
              Hepsini okundu
            </button>
          )}
        </div>

        {/* Sekmeler */}
        <div className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveTab(t.key);
                  setOpenId(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60"
                )}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1 text-[9px] font-bold",
                      active
                        ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                        : t.highlight
                          ? "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        {showSearch && (
          <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Bildirimlerde ara..."
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  // Boşluk dropdown'u kapatmasın
                  e.stopPropagation();
                }}
                className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-7 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSearch("");
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600"
                  title="Aramayı temizle"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Liste */}
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Yükleniyor…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell className="h-7 w-7 text-slate-300 dark:text-slate-600" aria-hidden />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {search
                ? `"${search}" için sonuç yok`
                : activeTab === "unread"
                  ? "Okunmamış bildirim yok"
                  : activeTab === "workflow"
                    ? "Onay akışı bildirimi yok"
                    : "Yeni bildirim yok"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {search ? "Farklı bir arama deneyin." : "Yeni hareket olduğunda burada görünür."}
            </p>
          </div>
        ) : (
          <ul className="max-h-[480px] overflow-y-auto">
            {groups.map((g) => (
              <NotificationRow
                key={g.key}
                group={g}
                isOpen={openId === g.key}
                onToggle={() => setOpenId(openId === g.key ? null : g.key)}
                onMarkRead={markSingleRead}
              />
            ))}
          </ul>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 px-2 py-2 dark:border-slate-700">
          <Link
            href="/bildirimler"
            className="block rounded-md px-2 py-1.5 text-center text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            Tüm bildirimleri gör →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
