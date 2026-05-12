import type { User as SupabaseUser } from "@supabase/supabase-js";

const META_KEYS = ["full_name", "name", "preferred_username", "user_name"] as const;

/** Supabase Auth user_metadata içinden ilk anlamlı görünen ad. */
export function pickMetadataDisplayName(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  for (const key of META_KEYS) {
    const v = metadata[key as string];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

/** E-postanın @ solu; tooltip / kısa etiket için. */
export function emailLocalPart(email: string): string | null {
  const e = email.trim();
  const i = e.indexOf("@");
  if (i <= 0) return null;
  const local = e.slice(0, i).trim();
  return local.length > 0 ? local : null;
}

/** Oturum kullanıcısı için UI’da gösterilecek ad — uzun e-posta yerine tercih sıralı kısa ad. */
export function resolveAuthDisplayName(
  sbUser: SupabaseUser,
  profileDisplayNameFromDb: string | null | undefined
): string | null {
  const email = (sbUser.email ?? "").trim();
  const metaName = pickMetadataDisplayName(sbUser.user_metadata as Record<string, unknown>);
  if (metaName) return metaName;

  const stored = (profileDisplayNameFromDb ?? "").trim();
  if (stored.length > 0 && email && stored.toLowerCase() !== email.toLowerCase()) return stored;

  const local = emailLocalPart(email);
  if (local) return local;

  return email.length > 0 ? email : null;
}

/** Presence’ten gelen düzenleyen için: birincil satır (kısa), isteğe bağlı tam e-posta satırı. */
export function presenceEditorLines(editor: { name?: string; email?: string }): {
  primary: string;
  emailLine: string | null;
} {
  const email = (editor.email ?? "").trim();
  const name = (editor.name ?? "").trim();
  const emailLower = email.toLowerCase();

  if (name.length > 0 && (!email || name.toLowerCase() !== emailLower)) {
    return { primary: name, emailLine: email || null };
  }

  if (email) {
    const local = emailLocalPart(email) ?? email;
    const primary = local.length > 28 ? `${local.slice(0, 26)}…` : local;
    return { primary, emailLine: email };
  }

  return { primary: "Bir kullanıcı", emailLine: null };
}

/** Avatar / üst bar için kısaltma: boşluklu isim → baş harfler; yoksa @ öncesi veya ilk iki harf. */
export function userInitialsFromDisplay(displayName: string, email: string): string {
  const d = displayName.trim();
  const words = d.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = words[0][0] ?? "";
    const b = words[words.length - 1][0] ?? "";
    const pair = (a + b).toUpperCase();
    if (pair.length >= 2) return pair;
  }
  if (d.length >= 2 && !d.includes("@")) {
    return d.slice(0, 2).toUpperCase();
  }
  const local = emailLocalPart(email) ?? email.trim();
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local.length === 1) return (local + "?").toUpperCase();
  return "KU";
}
