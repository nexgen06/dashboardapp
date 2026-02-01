import type { DateFormat } from "@/contexts/settings-context";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Tarihi seçilen formata göre biçimlendirir (Ayarlar > Genel > Tarih formatı).
 */
export function formatDate(date: Date, format: DateFormat): string {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();

  switch (format) {
    case "DD.MM.YYYY":
      return `${pad(d)}.${pad(m)}.${y}`;
    case "YYYY-MM-DD":
      return `${y}-${pad(m)}-${pad(d)}`;
    case "MM/DD/YYYY":
      return `${pad(m)}/${pad(d)}/${y}`;
    default:
      return `${pad(d)}.${pad(m)}.${y}`;
  }
}
