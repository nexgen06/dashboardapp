/**
 * @mention parser ve helpers — yorum metnindeki `@email-prefix` formatını
 * tanır ve render/notify amaçlı kullanılır.
 *
 * Saklama formatı (DB): plain text — `Selam @ugur, bu görevi…`
 * Render: regex ile parse, profil eşleştirmesinden gerçek isim/avatar göster
 *
 * Tasarım kararları:
 *  - `@` sonrası harf/rakam/nokta/tire/alt-tire kabul edilir
 *  - Minimum 2 karakter (tek `@a` mention sayılmaz)
 *  - Aynı metinde birden fazla mention desteklenir
 *  - Eşleştirme: önce tam email match, sonra email-prefix match (case-insensitive)
 */

import type { UserProfile } from "@/lib/profile";

/**
 * `@xyz` formatına uyan mention pattern'i.
 * Türkçe karakterler (çğıöşü) ve ASCII harf/rakam + . _ - desteklenir.
 * Unicode property escape (`\p{L}`) ES2018 gerektirdiği için ASCII + Türkçe
 * karakterler açıkça listelenir (proje TypeScript target uyumluluğu için).
 */
export const MENTION_REGEX = /@([a-zA-Z0-9çğıöşüÇĞİÖŞÜ._-]{2,64})/g;

/** Metinden tüm mention prefix'lerini çıkar (örn ["ugur", "ekip"]). */
export function extractMentionPrefixes(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) out.add(match[1].toLowerCase());
  }
  return Array.from(out);
}

/**
 * Mention prefix'lerini profil listesinde ara — tam email match, sonra email
 * yerel adı (@'dan önceki kısım) ile prefix match.
 */
export function resolveMentionsToProfiles(
  prefixes: string[],
  profiles: UserProfile[]
): UserProfile[] {
  if (prefixes.length === 0 || profiles.length === 0) return [];
  const lowerPrefixes = prefixes.map((p) => p.toLowerCase());
  const resolved: UserProfile[] = [];
  const seen = new Set<string>();

  for (const prefix of lowerPrefixes) {
    // 1) Tam email eşleşmesi
    const exact = profiles.find((p) => p.email?.toLowerCase() === prefix);
    if (exact) {
      if (!seen.has(exact.id)) {
        resolved.push(exact);
        seen.add(exact.id);
      }
      continue;
    }
    // 2) Email yerel adı (ad@firma → "ad") prefix eşleşmesi
    const localMatches = profiles.filter((p) => {
      const local = (p.email ?? "").split("@")[0]?.toLowerCase() ?? "";
      return local === prefix;
    });
    if (localMatches.length === 1) {
      const p = localMatches[0];
      if (!seen.has(p.id)) {
        resolved.push(p);
        seen.add(p.id);
      }
      continue;
    }
    // 3) Nickname/full_name prefix eşleşmesi (case-insensitive, ilk kelime)
    const nameMatches = profiles.filter((p) => {
      const nick = (p.nickname ?? "").toLowerCase();
      const fname = (p.full_name ?? "").toLowerCase().split(/\s+/)[0] ?? "";
      return nick === prefix || fname === prefix;
    });
    if (nameMatches.length === 1) {
      const p = nameMatches[0];
      if (!seen.has(p.id)) {
        resolved.push(p);
        seen.add(p.id);
      }
    }
    // Çoklu eşleşmede ambiguity → atla (kullanıcı tam email yazsın)
  }

  return resolved;
}

/** Autocomplete için profil arama — display name/email/nickname'de prefix match. */
export function searchProfilesForMention(
  query: string,
  profiles: UserProfile[],
  limit: number = 8
): UserProfile[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return profiles.slice(0, limit);

  // Skor: tam email > email-prefix > nickname-prefix > fullname-prefix > içerir
  const scored: Array<{ profile: UserProfile; score: number }> = [];
  for (const p of profiles) {
    const email = (p.email ?? "").toLowerCase();
    const local = email.split("@")[0] ?? "";
    const nick = (p.nickname ?? "").toLowerCase();
    const fname = (p.full_name ?? "").toLowerCase();

    let score = 0;
    if (email === q) score = 100;
    else if (local.startsWith(q)) score = 80;
    else if (nick.startsWith(q)) score = 70;
    else if (fname.startsWith(q)) score = 60;
    else if (email.includes(q)) score = 40;
    else if (nick.includes(q) || fname.includes(q)) score = 30;

    if (score > 0) scored.push({ profile: p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.profile);
}

/** Textarea içinde caret pozisyonunda yazılan mention query'sini al. */
export type MentionContext = {
  /** `@` karakterinin metin içindeki indeksi */
  atIndex: number;
  /** `@` sonrası şu ana kadar yazılan prefix (henüz seçim yapılmamış) */
  query: string;
};

/**
 * Caret pozisyonuna göre aktif `@mention` yazımını tespit eder.
 * Aktif değilse null döner (caret @'tan uzak veya boşluk araya girmiş).
 */
export function detectMentionContext(text: string, caret: number): MentionContext | null {
  if (caret <= 0) return null;
  // Caret'tan geriye doğru `@` ara — ama whitespace veya yeni satır karşılaşırsak iptal
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      // `@` karakterinin solunda boşluk/satır başı olmalı (mention başlangıcı)
      if (i === 0 || /\s/.test(text[i - 1] ?? "")) {
        const query = text.slice(i + 1, caret);
        // Query yalnızca izinli karakterlerden oluşuyor mu?
        if (/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ._-]*$/.test(query)) {
          return { atIndex: i, query };
        }
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

/** Textarea içine seçilen mention'ı ekle, yeni caret pozisyonunu döner. */
export function insertMention(
  text: string,
  ctx: MentionContext,
  mentionToken: string
): { newText: string; newCaret: number } {
  const before = text.slice(0, ctx.atIndex);
  const afterCaret = ctx.atIndex + 1 + ctx.query.length;
  const after = text.slice(afterCaret);
  // Trailing space ekle — kullanıcı devamına yazmaya hazır
  const insertion = `@${mentionToken} `;
  const newText = before + insertion + after;
  const newCaret = before.length + insertion.length;
  return { newText, newCaret };
}
