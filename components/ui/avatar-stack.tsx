import { cn } from "@/lib/utils";

/**
 * Atanan kullanıcılar için yığılmış avatar dizisi.
 *
 * Avatar yok, sadece e-posta var: e-postanın baş harfinden initial üretir,
 * deterministik bir renk seçer (aynı e-posta hep aynı renk). Maksimum N
 * avatar göster, fazlasını "+M" rozetinde topla.
 */
const TONE_CLASSES = [
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
  "bg-violet-500 text-white",
  "bg-rose-500 text-white",
  "bg-cyan-500 text-white",
  "bg-indigo-500 text-white",
  "bg-fuchsia-500 text-white",
];

function pickTone(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return TONE_CLASSES[h % TONE_CLASSES.length];
}

function initialsOf(email: string): string {
  const e = (email ?? "").trim();
  if (!e) return "?";
  const local = e.split("@")[0] ?? e;
  // Tire/nokta/alt çizgili e-postalarda iki harf: "ali.veli@x" → "AV"
  const parts = local.split(/[._\-+]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (local.slice(0, 2) || local).toUpperCase();
}

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
        return (
          <span
            key={email}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-white dark:ring-slate-800",
              isMe && "ring-emerald-400 dark:ring-emerald-500",
              pickTone(email)
            )}
            style={{
              width: px,
              height: px,
              marginLeft: idx === 0 ? -overlap : -overlap,
              fontSize: Math.round(px * 0.42),
              zIndex: visible.length - idx,
            }}
            aria-label={email}
          >
            {initialsOf(email)}
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
