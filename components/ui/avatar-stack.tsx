"use client";

import { cn } from "@/lib/utils";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { getInitials, getAvatarColor } from "@/lib/avatarUtils";

/**
 * Atanan kullanıcılar için yığılmış avatar dizisi.
 *
 * Profil lookup ile:
 *  - Kullanıcının avatar_url'i varsa fotoğraf gösterilir.
 *  - Yoksa nickname/full_name/email'den baş harf + deterministik renk.
 * Maksimum N avatar, fazlasını "+M" rozetinde topla.
 */

type AvatarStackProps = {
  emails: string[];
  /** Maksimum kaç avatar gösterilsin, kalanları +N rozeti olarak topla. Varsayılan 3. */
  max?: number;
  /** Avatar boyutu (px). Varsayılan 24. */
  size?: number;
  /** Ek class (kapsayıcı div'e). */
  className?: string;
  /** Vurgu hedefi e-postası (varsa farklı border ile gösterilir). */
  highlightEmail?: string;
};

export function AvatarStack({
  emails,
  max = 3,
  size = 24,
  className,
  highlightEmail,
}: AvatarStackProps) {
  const lookup = useProfileLookup();
  if (!emails || emails.length === 0) return null;
  const visible = emails.slice(0, max);
  const overflow = emails.length - visible.length;
  const px = size;
  const overlap = Math.round(size * 0.3);
  const me = (highlightEmail ?? "").trim().toLowerCase();

  return (
    <div
      className={cn("inline-flex items-center", className)}
      style={{ paddingLeft: overflow > 0 || visible.length > 1 ? overlap : 0 }}
      title={emails.join(", ")}
    >
      {visible.map((email, idx) => {
        const isMe = !!me && email.trim().toLowerCase() === me;
        const profile = lookup.byEmail(email);
        const initials = getInitials({
          nickname: profile.nickname,
          fullName: profile.fullName,
          email,
        });
        const color = getAvatarColor(email);
        return (
          <span
            key={email}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-white dark:ring-slate-800",
              isMe && "ring-emerald-400 dark:ring-emerald-500"
            )}
            style={{
              width: px,
              height: px,
              marginLeft: idx === 0 ? -overlap : -overlap,
              fontSize: Math.round(px * 0.42),
              zIndex: visible.length - idx,
            }}
            aria-label={profile.nickname || profile.fullName || email}
            title={profile.nickname || profile.fullName || email}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={initials}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className={cn("flex h-full w-full items-center justify-center", color.bg, color.text)}>
                {initials}
              </span>
            )}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-600 dark:text-slate-200 dark:ring-slate-800"
          style={{
            width: px,
            height: px,
            marginLeft: -overlap,
            fontSize: Math.round(px * 0.42),
            zIndex: 0,
          }}
          aria-label={`+${overflow} daha`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
