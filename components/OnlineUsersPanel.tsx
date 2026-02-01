"use client";

import * as React from "react";
import { User, Pencil, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { OnlineUser, EditingUser } from "@/hooks/usePresence";
import type { Task } from "@/types/tasks";

export type OnlineUsersPanelProps = {
  /** Şu an bu kanalda olan kullanıcılar (presence) */
  onlineUsers: OnlineUser[];
  /** rowId -> kim düzenliyor */
  editingByUser: Map<string, EditingUser>;
  /** Giriş yapan kullanıcının email'i (Sen etiketi için) */
  currentUserEmail?: string | null;
  /** Satır id → görev (düzenlenen satırın kısa metni için) */
  tasks?: Task[];
  /** Sadece sayıyı göster, liste açılmasın */
  compact?: boolean;
  className?: string;
};

function getInitials(name?: string, email?: string, key?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  if (key) return key.slice(-2).toUpperCase();
  return "?";
}

function getDisplayLabel(user: OnlineUser): string {
  if (user.name && user.name.trim()) return user.name.trim();
  if (user.email) return user.email;
  return user.key.slice(0, 12) + "…";
}

/** Bu kullanıcının düzenlediği rowId (varsa). editingByUser: rowId -> EditingUser. */
function getEditingRowIdForUser(
  user: OnlineUser,
  editingByUser: Map<string, EditingUser>
): string | null {
  const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();
  const uEmail = norm(user.email);
  const uName = norm(user.name);
  for (const [rowId, edit] of editingByUser.entries()) {
    if (uEmail && norm(edit.email) === uEmail) return rowId;
    if (uName && norm(edit.name) === uName) return rowId;
  }
  return null;
}

/**
 * Canlı Tablo için çevrimiçi kullanıcıları gösterir: tıklanabilir rozet + açılır listede
 * avatar, isim ve "şu an hangi satırı düzenliyor" bilgisi.
 */
export function OnlineUsersPanel({
  onlineUsers,
  editingByUser,
  currentUserEmail = null,
  tasks = [],
  compact = false,
  className,
}: OnlineUsersPanelProps) {
  const taskById = React.useMemo(() => {
    const m = new Map<string, Task>();
    tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks]);

  const currentEmailNorm = (currentUserEmail ?? "").trim().toLowerCase();

  if (onlineUsers.length === 0) return null;

  const trigger = (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:border-slate-500",
        className
      )}
      title="Çevrimiçi kullanıcıları göster"
      aria-label={`${onlineUsers.length} çevrimiçi kullanıcı`}
    >
      <Users className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
      <span>{onlineUsers.length} çevrimiçi</span>
    </button>
  );

  if (compact) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[240px] max-w-[320px] rounded-lg border-slate-200 bg-white p-0 shadow-lg dark:border-slate-700 dark:bg-slate-800"
      >
        <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2.5 text-slate-700 dark:text-slate-200">
          <User className="h-4 w-4 text-slate-500" />
          Çevrimiçi kullanıcılar
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[280px] overflow-y-auto py-1">
          {onlineUsers.map((u) => {
            const isMe = (u.email ?? "").trim().toLowerCase() === currentEmailNorm;
            const editingRowId = getEditingRowIdForUser(u, editingByUser);
            const task = editingRowId ? taskById.get(editingRowId) : undefined;
            const editingSnippet = task?.content
              ? (task.content.slice(0, 36) + (task.content.length > 36 ? "…" : ""))
              : editingRowId
                ? "Bir satır"
                : null;

            return (
              <div
                key={u.key}
                className="flex items-center gap-3 px-3 py-2 text-left outline-none hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <Avatar className="h-8 w-8 shrink-0 border border-slate-200 dark:border-slate-600">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-medium",
                      isMe
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200"
                    )}
                  >
                    {getInitials(u.name, u.email, u.key)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {getDisplayLabel(u)}
                    </span>
                    {isMe && (
                      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                        Sen
                      </span>
                    )}
                  </div>
                  {editingSnippet && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Pencil className="h-3 w-3 shrink-0" />
                      <span className="truncate">&quot;{editingSnippet}&quot; düzenliyor</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
