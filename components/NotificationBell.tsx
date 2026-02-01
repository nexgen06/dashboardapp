"use client";

import Link from "next/link";
import { Bell, FolderOpen, ListTodo, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { NotificationSummary } from "@/hooks/useNotificationSummary";

const ICON_MAP = {
  project_assigned: FolderOpen,
  task_assigned: ListTodo,
  overdue: AlertCircle,
} as const;

export function NotificationBell({ summary }: { summary: NotificationSummary }) {
  const { totalCount, items, isLoading } = summary;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Bildirimler"
        >
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white shadow-sm"
              aria-hidden
            >
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-lg border-slate-200 bg-white p-0 shadow-lg dark:border-slate-700 dark:bg-slate-800"
      >
        <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2.5 text-slate-700 dark:text-slate-200">
          <Bell className="h-4 w-4 text-slate-500" />
          Bildirimler
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        {isLoading ? (
          <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Yükleniyor…
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Yeni bildirim yok
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto py-1">
            {items.map((item) => {
              const Icon = ICON_MAP[item.type];
              return (
                <Link
                  key={item.type}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 font-medium text-slate-800 dark:text-slate-100">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        {items.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div className="p-2">
              <Link
                href="/canli-tablo"
                className="block rounded-md px-2 py-1.5 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                Canlı Tabloya git
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
