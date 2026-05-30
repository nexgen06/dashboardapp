import { SMART_CHIP_COLUMN_PRESETS } from "@/lib/projectFormHelpers";

export type ExtraColumnFormatKind = "phone" | "tckn" | "email" | "date";

export type ExtraColumnFormatError = {
  key: string;
  value: string;
  message: string;
};

export type ExtraDataFormatResult = {
  data: Record<string, string> | null;
  errors: ExtraColumnFormatError[];
};

function normalizeKey(key: string): string {
  return key
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function compactKey(key: string): string {
  return normalizeKey(key).replace(/\s+/g, "");
}

function isSmartChipColumnKey(key: string): boolean {
  const n = normalizeKey(key);
  return SMART_CHIP_COLUMN_PRESETS.some((preset) => normalizeKey(preset.label) === n);
}

function isStatusColumnKey(key: string): boolean {
  const n = normalizeKey(key);
  return /\bdurumu\b/.test(n) || /\bstatus\b/.test(n) || /\bdurum\b/.test(n);
}

function isEmailAddressColumnKey(key: string): boolean {
  const n = normalizeKey(key);
  const compact = compactKey(key);

  if (n.includes("e-posta") || n.includes("eposta") || compact.includes("email")) return true;
  if (n.includes("mail adres") || n.includes("email address")) return true;
  if (compact === "mail" || compact === "email" || compact === "eposta") return true;

  // "mail" tek başına durum/çip sütunlarında geçebilir (Mail Durumu vb.) — yalnızca adres bağlamında
  if (/\bmail\b/.test(n) && (n.includes("adres") || n.includes("address"))) return true;

  return false;
}

export function getExtraColumnFormatKind(key: string): ExtraColumnFormatKind | null {
  const n = normalizeKey(key);
  const compact = compactKey(key);

  if (isSmartChipColumnKey(key) || isStatusColumnKey(key)) return null;

  if (compact.includes("tckn") || compact === "tc" || compact.startsWith("tckimlik")) return "tckn";
  if (n.includes("tc kimlik") || n.includes("kimlik no")) return "tckn";
  if (isEmailAddressColumnKey(key)) return "email";
  if (n.includes("telefon") || n.includes("phone") || n.includes("gsm") || n.includes("cep")) return "phone";
  if (n.includes("tarih") || n.includes("date")) return "date";

  return null;
}

function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^\d{10}$/.test(digits)) return null;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}

function normalizeTckn(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  return digits;
}

function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  let day: number;
  let month: number;
  let year: number;

  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const ymd = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);

  if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else if (ymd) {
    year = Number(ymd[1]);
    month = Number(ymd[2]);
    day = Number(ymd[3]);
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${String(year).padStart(4, "0")}`;
}

function normalizeValue(kind: ExtraColumnFormatKind, value: string): string | null {
  if (kind === "phone") return normalizePhone(value);
  if (kind === "tckn") return normalizeTckn(value);
  if (kind === "email") return normalizeEmail(value);
  return normalizeDate(value);
}

function formatHint(kind: ExtraColumnFormatKind): string {
  if (kind === "phone") return "Telefon 10 haneli olmalı. Örnek: 544 123 45 67";
  if (kind === "tckn") return "TCKN/TC 11 haneli rakam olmalı.";
  if (kind === "email") return "E-posta example@abc.com biçiminde olmalı.";
  return "Tarih gün.ay.yıl biçiminde olmalı. Örnek: 01.01.1999";
}

export function normalizeExtraDataBySmartRules(
  extraData: Record<string, string> | null | undefined
): ExtraDataFormatResult {
  if (!extraData || Object.keys(extraData).length === 0) return { data: null, errors: [] };

  const normalized: Record<string, string> = {};
  const errors: ExtraColumnFormatError[] = [];

  for (const [key, rawValue] of Object.entries(extraData)) {
    const value = String(rawValue ?? "").trim();
    const kind = getExtraColumnFormatKind(key);
    if (!kind || value === "") {
      normalized[key] = value;
      continue;
    }

    const nextValue = normalizeValue(kind, value);
    if (nextValue == null) {
      errors.push({ key, value, message: `${key}: ${formatHint(kind)}` });
      normalized[key] = value;
      continue;
    }
    normalized[key] = nextValue;
  }

  return {
    data: Object.keys(normalized).length > 0 ? normalized : null,
    errors,
  };
}

