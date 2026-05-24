"use client";

import { useEffect, useRef } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/profile";

/**
 * @mention autocomplete popover — textarea üstüne float'lar.
 *
 * Props:
 *  - profiles: filtrelenmiş profil listesi (en uygun ilk)
 *  - activeIndex: vurgulu öğenin indeksi (yukarı/aşağı ok ile gezilir)
 *  - onSelect: seçim yapıldığında çağrılır (email döner)
 *  - onActiveChange: mouse hover ile active değişir
 *  - position: textarea altındaki konum {top, left} (px)
 */
export function MentionAutocomplete({
  profiles,
  activeIndex,
  onSelect,
  onActiveChange,
  position,
}: {
  profiles: UserProfile[];
  activeIndex: number;
  onSelect: (profile: UserProfile) => void;
  onActiveChange: (index: number) => void;
  position: { top: number; left: number };
}) {
  const listRef = useRef<HTMLUListElement>(null);

  // Active item'ı görünür alana scroll et (klavye ile gezerken)
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLElement>(`[data-mention-index="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (profiles.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Kullanıcı önerileri"
      className="absolute z-50 max-h-64 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
      style={{ top: position.top, left: position.left }}
    >
      <div className="border-b border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Kişi etiketle · ↑↓ gez · Enter seç · Esc kapat
      </div>
      <ul ref={listRef} className="max-h-52 overflow-y-auto py-1">
        {profiles.map((profile, idx) => {
          const isActive = idx === activeIndex;
          const localPart = (profile.email ?? "").split("@")[0] ?? "";
          const displayName = profile.nickname || profile.full_name || localPart || profile.email;
          return (
            <li key={profile.id} data-mention-index={idx}>
              <button
                type="button"
                onMouseEnter={() => onActiveChange(idx)}
                onClick={(e) => {
                  e.preventDefault();
                  onSelect(profile);
                }}
                onMouseDown={(e) => {
                  // Textarea'nın blur olmasını engelle — seçimden sonra caret kayar
                  e.preventDefault();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/30"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                )}
              >
                <UserAvatar
                  avatarUrl={profile.avatar_url ?? null}
                  email={profile.email ?? ""}
                  nickname={profile.nickname}
                  fullName={profile.full_name}
                  className="h-7 w-7 shrink-0 text-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {displayName}
                  </div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    @{localPart || profile.email}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
