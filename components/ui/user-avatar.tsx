"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, getAvatarColor } from "@/lib/avatarUtils";
import { cn } from "@/lib/utils";

type Props = {
  avatarUrl?: string | null;
  nickname?: string | null;
  fullName?: string | null;
  email?: string | null;
  /** Avatar boyutu — varsayılan: h-10 w-10 (40px). */
  className?: string;
  /** Renk seed override (default: email > nickname > fullName) */
  seed?: string;
};

/**
 * Birleşik kullanıcı avatar bileşeni:
 *   - avatar_url varsa fotoğrafı gösterir
 *   - yoksa baş harf + deterministik renk fallback
 * Görev kartları, yorumlar, online listeleri, header — hepsinde aynı görünüm.
 */
export function UserAvatar({
  avatarUrl,
  nickname,
  fullName,
  email,
  className,
  seed,
}: Props) {
  const initials = getInitials({ nickname, fullName, email });
  const effectiveSeed = seed ?? email ?? nickname ?? fullName ?? "?";
  const palette = getAvatarColor(effectiveSeed);

  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={initials} />}
      <AvatarFallback className={cn(palette.bg, palette.text, "font-semibold")}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
