/**
 * Görev statüsünün "kind" sınıflandırması — istatistikler ve filtreler için
 * tek doğruluk kaynağı.
 *
 * Tasarım kararı: DB'deki `status` sütunu serbest metin kalır (çünkü
 * settings.customStatusList ile özelleştirilebilir). Ancak istatistik
 * hesaplamalarında, filtre eşleşmelerinde ve UI vurgularında bu sınıflandırma
 * kullanılır.
 *
 * Türkçe + İngilizce varyantları + yaygın eş anlamlılar tanınır:
 *   - "Tamamlandı", "tamamlandi", "yapıldı", "done", "completed" → "done"
 *   - "Devam", "Devam ediyor", "sürüyor", "in progress", "progress" → "in_progress"
 *   - "Yapılacak", "yapilacak", "todo", "" → "todo" (boş status varsayılan "todo")
 *   - Diğer her şey → "other" (örn. "Beklemede", "İptal")
 */

export type StatusKind = "todo" | "in_progress" | "done" | "other";

const DONE_TOKENS = ["tamamlandı", "tamamlandi", "yapıldı", "yapildi", "done", "completed"] as const;
const IN_PROGRESS_TOKENS = ["devam", "devam ediyor", "sürüyor", "suruyor", "in progress", "progress"] as const;
const TODO_TOKENS = ["yapılacak", "yapilacak", "todo", "to do", "to-do", "open"] as const;

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function getStatusKind(status: string | null | undefined): StatusKind {
  const s = normalize(status);
  if (!s) return "todo"; // boş statü varsayılan olarak "todo" sayılır
  if (DONE_TOKENS.includes(s as typeof DONE_TOKENS[number])) return "done";
  if (IN_PROGRESS_TOKENS.includes(s as typeof IN_PROGRESS_TOKENS[number])) return "in_progress";
  if (TODO_TOKENS.includes(s as typeof TODO_TOKENS[number])) return "todo";
  return "other";
}

export const isStatusDone = (status: string | null | undefined): boolean => getStatusKind(status) === "done";
export const isStatusInProgress = (status: string | null | undefined): boolean => getStatusKind(status) === "in_progress";
export const isStatusTodo = (status: string | null | undefined): boolean => getStatusKind(status) === "todo";
export const isStatusOther = (status: string | null | undefined): boolean => getStatusKind(status) === "other";
