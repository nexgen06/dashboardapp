/**
 * Şifre politikası — tek doğruluk kaynağı.
 *
 * UI ve form validasyonu bu modülü kullanır. Sunucu tarafı kuralı
 * Supabase Studio → Authentication → Policies'den ayarlanır
 * (burada aynı kurallarla eşleştirilmeli; aksi halde kullanıcı
 * UI'de "yeşil" gördüğü şifrede sunucu hatası alabilir).
 *
 * Politika: 8+ karakter, 1+ büyük harf, 1+ küçük harf, 1+ rakam.
 * Özel karakter şart değil ama bonus skor verir. Yaygın şifre engeli.
 */

/** Top-50 sık kullanılan / sızdırılmış şifre — block list. */
const COMMON_PASSWORDS = new Set<string>([
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "asdfghjkl",
  "abc123",
  "abcd1234",
  "abcdef",
  "iloveyou",
  "admin",
  "admin123",
  "root",
  "letmein",
  "welcome",
  "welcome1",
  "monkey",
  "dragon",
  "master",
  "trustno1",
  "sunshine",
  "princess",
  "shadow",
  "qazwsx",
  "1q2w3e4r",
  "1qaz2wsx",
  "zaq12wsx",
  "michael",
  "football",
  "baseball",
  "superman",
  "batman",
  "michelle",
  "jordan",
  "ashley",
  "michael1",
  "jennifer",
  "thomas",
  "joshua",
  "robert",
  "matthew",
  "daniel",
  "andrew",
  "anthony",
  // TR yaygınlar
  "sifre",
  "sifre123",
  "parola",
  "parola123",
  "deneme123",
  "ankara06",
  "istanbul34",
  "galatasaray",
  "fenerbahce",
  "besiktas",
  "trabzonspor",
]);

export type PasswordChecks = {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  special: boolean;
  notCommon: boolean;
};

export type PasswordEvaluation = {
  /** Tüm zorunlu kurallar geçti mi (length + lower + upper + digit + notCommon) */
  valid: boolean;
  /** 0..4 — strength meter için. 0=çok zayıf, 4=çok güçlü */
  score: 0 | 1 | 2 | 3 | 4;
  /** Bireysel kontrol sonuçları (✓/✗ liste için) */
  checks: PasswordChecks;
  /** İlk başarısız kuralın insan-okunabilir özeti (submit hata mesajı için) */
  firstFailureMessage: string | null;
};

export const PASSWORD_POLICY = {
  minLength: 8,
  /** Zorunlu kurallar (özel karakter HARİÇ) — submit için */
  requireLower: true,
  requireUpper: true,
  requireDigit: true,
  requireNotCommon: true,
  /** Önerilen ama zorunlu değil */
  recommendSpecial: true,
} as const;

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

export function evaluatePassword(password: string): PasswordEvaluation {
  const pwd = password ?? "";
  const lc = pwd.toLowerCase();

  const checks: PasswordChecks = {
    length: pwd.length >= PASSWORD_POLICY.minLength,
    lower: /[a-zçğıöşü]/.test(pwd),
    upper: /[A-ZÇĞİÖŞÜ]/.test(pwd),
    digit: /\d/.test(pwd),
    special: SPECIAL_RE.test(pwd),
    notCommon: !COMMON_PASSWORDS.has(lc),
  };

  const requiredOk =
    checks.length &&
    checks.lower &&
    checks.upper &&
    checks.digit &&
    checks.notCommon;

  // Skor (0..4)
  // - length 0 puan eşik altı, 8+ → +1, 12+ → +1, 16+ → +1
  // - karakter çeşitliliği: lower, upper, digit, special'in toplamından +1 (en fazla)
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  const varietyCount =
    (checks.lower ? 1 : 0) +
    (checks.upper ? 1 : 0) +
    (checks.digit ? 1 : 0) +
    (checks.special ? 1 : 0);
  if (varietyCount >= 3) score++;
  // Common password ise skor 1'i geçemez
  if (!checks.notCommon) score = Math.min(score, 1);
  // Eğer length < 8 ise hiçbir koşulda 1'i geçemez
  if (!checks.length) score = Math.min(score, 1);
  const finalScore = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;

  let firstFailureMessage: string | null = null;
  if (!checks.length)
    firstFailureMessage = `Şifre en az ${PASSWORD_POLICY.minLength} karakter olmalı.`;
  else if (!checks.upper) firstFailureMessage = "En az bir büyük harf gerekli.";
  else if (!checks.lower) firstFailureMessage = "En az bir küçük harf gerekli.";
  else if (!checks.digit) firstFailureMessage = "En az bir rakam gerekli.";
  else if (!checks.notCommon)
    firstFailureMessage = "Bu şifre çok yaygın; daha özgün bir şey seç.";

  return {
    valid: requiredOk,
    score: finalScore,
    checks,
    firstFailureMessage,
  };
}

export function passwordStrengthLabel(score: 0 | 1 | 2 | 3 | 4): string {
  switch (score) {
    case 0:
      return "Çok zayıf";
    case 1:
      return "Zayıf";
    case 2:
      return "Orta";
    case 3:
      return "Güçlü";
    case 4:
      return "Çok güçlü";
  }
}

export function passwordStrengthColor(score: 0 | 1 | 2 | 3 | 4): string {
  switch (score) {
    case 0:
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-amber-500";
    case 3:
      return "bg-emerald-500";
    case 4:
      return "bg-emerald-600";
  }
}
