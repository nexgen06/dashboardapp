"use client";

import { User } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { cn } from "@/lib/utils";

type Props = {
  /** Görev assignee alanı — genelde email veya "Ben" */
  assignee: string | null | undefined;
  /** Sadece avatar göster (kart küçükse) */
  compact?: boolean;
  className?: string;
};

/**
 * Görev "atanan" göstergesi:
 *   - Avatar (URL varsa fotoğraf, yoksa baş harf + renk)
 *   - Yanında atanan adı (mevcut profilde nickname > full_name > email)
 *
 * Görev assignee alanı "Ben" gibi özel etiketler içerebilir → bu durumda
 * email lookup başarısız olur; fallback olarak ham assignee gösterilir.
 */
export function AssigneeBadge({ assignee, compact, className }: Props) {
  const lookup = useProfileLookup();
  const a = (assignee ?? "").trim();
  if (!a) return null;

  const profile = lookup.byEmail(a);
  const isEmail = a.includes("@");
  const label = profile.nickname || profile.fullName || (isEmail ? a : a);

  if (compact) {
    return (
      <UserAvatar
        avatarUrl={profile.avatarUrl}
        nickname={profile.nickname}
        fullName={profile.fullName}
        email={isEmail ? a : null}
        className={cn("h-5 w-5 text-[9px]", className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)} title={a}>
      {profile.avatarUrl || profile.profile ? (
        <UserAvatar
          avatarUrl={profile.avatarUrl}
          nickname={profile.nickname}
          fullName={profile.fullName}
          email={isEmail ? a : null}
          className="h-4 w-4 text-[8px]"
        />
      ) : (
        <User className="h-2.5 w-2.5 opacity-70" aria-hidden />
      )}
      <span className="max-w-[100px] truncate">{label}</span>
    </span>
  );
}
