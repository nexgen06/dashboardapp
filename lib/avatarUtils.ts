/**
 * Avatar yardımcıları — kullanıcının yüklediği resmi yoksa baş harf + deterministik renk.
 */

const PALETTE = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-purple-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-red-500", text: "text-white" },
  { bg: "bg-cyan-500", text: "text-white" },
  { bg: "bg-pink-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-teal-500", text: "text-white" },
];

/** Basit deterministik hash → palet index. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Bir kişiye ait baş harfler (1-2 karakter).
 * Önce nickname > full_name > email kullanılır.
 */
export function getInitials(input: {
  nickname?: string | null;
  fullName?: string | null;
  email?: string | null;
}): string {
  const nick = (input.nickname ?? "").trim();
  if (nick) {
    const parts = nick.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const full = (input.fullName ?? "").trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  const email = (input.email ?? "").trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

/**
 * Deterministik renk paleti — aynı email/id her zaman aynı rengi alır.
 */
export function getAvatarColor(seed: string): { bg: string; text: string } {
  if (!seed) return PALETTE[0];
  return PALETTE[hashString(seed) % PALETTE.length];
}
