/**
 * Görev atama (assignee) ile ilgili paylaşılan kurallar.
 *
 * "Bana atanan" mantığı 3 farklı yerde (Canlı Tablo, Proje Detay, Görev Özeti)
 * birbirinden farklı şekilde uygulanıyordu. Tek bir kaynak olarak bu modül kullanılır.
 *
 * Eşleşme kuralları:
 *  - viewer email "" ise hiçbir görev "bana ait" sayılmaz.
 *  - Görev assignee'si trim+lowercase olarak viewer email'e EŞİT ise → atanmış.
 *  - Geriye dönük uyumluluk: bazı eski görevler "Ben" gibi sembolik bir değer
 *    içerebilir; bu durumda strictAssigneeVisibility kapalıysa da "kendi" kabul edilir.
 *  - Substring eşleşmesi YAPILMAZ (eski GorevOzeti davranışı düzeltildi);
 *    "user@a.com" ve "user@anlamlı.com" iki ayrı kişidir.
 */

const ME_LABEL_LOWER = "ben";

export function normalizeViewerEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function normalizeAssignee(assignee: string | null | undefined): string {
  return (assignee ?? "").trim().toLowerCase();
}

/** Görev, viewer'a atanmış mı? */
export function isTaskAssignedToMe(
  assignee: string | null | undefined,
  viewerEmail: string | null | undefined
): boolean {
  const me = normalizeViewerEmail(viewerEmail);
  if (!me) return false;
  const a = normalizeAssignee(assignee);
  if (!a) return false;
  if (a === me) return true;
  // Eski/strict olmayan modlardan kalan sembolik "Ben" değeri
  if (a === ME_LABEL_LOWER) return true;
  return false;
}

/** Atanmamış (boş) görev mi? */
export function isTaskUnassigned(assignee: string | null | undefined): boolean {
  return normalizeAssignee(assignee) === "";
}
