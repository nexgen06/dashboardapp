"use client";

import { useMemo } from "react";
import type { EditingUser } from "@/hooks/usePresence";
import { cn } from "@/lib/utils";

/**
 * Figma-tarzı satır editör göstergesi.
 *
 * Mevcut altyapı:
 *   - editorsByRowId Map'inden EditingUser[] gelir (presence broadcast)
 *   - Satıra mor border zaten var (TasksTableDataPanel)
 *
 * Bu component:
 *   - Avatar stack (max 3 görünür, fazlası "+N")
 *   - Kullanıcı bazlı deterministik renk (email hash → palette)
 *   - "X yazıyor..." badge (animate-pulse dot)
 *   - Hover'da tam liste tooltip (parent'tan)
 *
 * Pozisyon: parent'ta absolute (satırın sağ üst köşesi).
 */

type RowPresenceIndicatorProps = {
  editors: EditingUser[];
  /** Mevcut kullanıcı kendisini görmek istemez (kendi yazımını) */
  currentUserEmail?: string | null;
  className?: string;
};

const AVATAR_PALETTE = [
  { bg: "bg-violet-500", ring: "ring-violet-300", text: "text-violet-50" },
  { bg: "bg-pink-500", ring: "ring-pink-300", text: "text-pink-50" },
  { bg: "bg-blue-500", ring: "ring-blue-300", text: "text-blue-50" },
  { bg: "bg-emerald-500", ring: "ring-emerald-300", text: "text-emerald-50" },
  { bg: "bg-amber-500", ring: "ring-amber-300", text: "text-amber-50" },
  { bg: "bg-cyan-500", ring: "ring-cyan-300", text: "text-cyan-50" },
  { bg: "bg-rose-500", ring: "ring-rose-300", text: "text-rose-50" },
  { bg: "bg-indigo-500", ring: "ring-indigo-300", text: "text-indigo-50" },
];

/** Deterministik renk seçimi — aynı kullanıcı her zaman aynı renk. */
function userColor(seed: string): (typeof AVATAR_PALETTE)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/** "Ahmet Yılmaz" / "ahmet" / "ahmet@..." → "AY" / "AH" */
function getInitials(name?: string, email?: string): string {
  const src = (name ?? email ?? "").trim();
  if (!src) return "?";
  // Email ise localpart
  const cleaned = src.includes("@") ? src.split("@")[0] : src;
  const parts = cleaned.split(/[\s._\-+]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? cleaned).slice(0, 2).toUpperCase() || "?";
}

function firstName(user: EditingUser): string {
  const raw = user.name || user.email || "";
  if (!raw) return "Birisi";
  const cleaned = raw.includes("@") ? raw.split("@")[0] : raw;
  const first = cleaned.split(/[\s._\-+]+/)[0];
  if (!first) return "Birisi";
  return first.charAt(0).toLocaleUpperCase("tr") + first.slice(1);
}

export function RowPresenceIndicator({
  editors,
  currentUserEmail,
  className,
}: RowPresenceIndicatorProps) {
  // Kendimizi çıkar (sadece başkalarının presence'ı görünür)
  const others = useMemo(() => {
    const meEmail = (currentUserEmail ?? "").trim().toLocaleLowerCase("tr");
    return editors.filter((e) => {
      if (!meEmail) return true;
      return (e.email ?? "").trim().toLocaleLowerCase("tr") !== meEmail;
    });
  }, [editors, currentUserEmail]);

  if (others.length === 0) return null;

  const visible = others.slice(0, 3);
  const hidden = others.length - visible.length;
  // Tek kullanıcıda "Ahmet yazıyor..." gösterimi; çoklu durumda "3 kişi yazıyor..."
  const writingText =
    others.length === 1
      ? `${firstName(others[0])} yazıyor`
      : `${others.length} kişi yazıyor`;

  return (
    <div
      className={cn(
        "pointer-events-none flex items-center gap-1.5",
        // Sticky overlay — TR'nin sağ üst köşesinde durur
        "absolute right-2 top-1/2 -translate-y-1/2 z-[2]",
        "rounded-full bg-white/95 px-1.5 py-0.5 shadow-md backdrop-blur",
        "dark:bg-slate-900/95",
        "animate-in fade-in zoom-in-95 duration-200",
        className
      )}
      aria-label={writingText}
    >
      {/* Avatar stack (overlapping) */}
      <div className="flex -space-x-1.5">
        {visible.map((user, i) => {
          const seed = (user.email || user.name || `u${i}`).toLocaleLowerCase("tr");
          const c = userColor(seed);
          const initials = getInitials(user.name, user.email);
          return (
            <span
              key={`${seed}-${i}`}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-sm ring-2 ring-white",
                "dark:ring-slate-900",
                c.bg,
                c.text
              )}
              title={user.name || user.email || "Kullanıcı"}
            >
              {initials}
            </span>
          );
        })}
        {hidden > 0 && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700 shadow-sm ring-2 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-900"
            title={`+${hidden} kişi daha düzenliyor`}
          >
            +{hidden}
          </span>
        )}
      </div>

      {/* "X yazıyor..." badge — yanıp sönen mor nokta */}
      <div className="flex items-center gap-1 pr-1">
        <span className="relative flex h-1.5 w-1.5 items-center justify-center" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
        </span>
        <span className="whitespace-nowrap text-[10px] font-medium text-violet-700 dark:text-violet-300">
          {writingText}
        </span>
      </div>
    </div>
  );
}
