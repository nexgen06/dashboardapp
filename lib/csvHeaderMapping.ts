/**
 * CSV / JSON import sırasında başlık adlarını sistem alanlarıyla eşleştirir.
 * Amaç: aynı bilgi hem `tasks.<field>` hem `extra_data[header]` olarak
 * kaydedilmesin (mükerrer). Standart alan tespit edilirse direkt o alana
 * yazılır; extra_data'ya eklenmez.
 *
 * Türkçe normalize edilir (i/İ duyarsız, alt çizgi/boşluk fark etmez).
 */

export type StandardTaskField = "content" | "status" | "priority" | "due_date" | "assignee";

/** Bir header için (varsa) eşleşen standart alanı döner. */
export function detectStandardField(header: string): StandardTaskField | null {
  const norm = header
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[._\-+]+/g, " ")
    .replace(/\s+/g, " ");

  if (!norm) return null;

  // İÇERİK / AÇIKLAMA / GÖREV ADI
  if (/(içerik|icerik|açıklama|aciklama|görev|gorev adı|gorev adi|task|description|content|konu|özet|ozet)/i.test(norm)) {
    return "content";
  }
  // DURUM / STATUS
  if (/^(durum|durumu|status|state|aşama|asama)$/i.test(norm)) {
    return "status";
  }
  // ÖNCELİK / PRIORITY
  if (/^(öncelik|oncelik|priority|önem|onem|seviye)$/i.test(norm)) {
    return "priority";
  }
  // TARİH / DUE DATE / SON TARİH
  if (/(son tarih|son.tarih|bitiş|bitis|teslim|due date|due.date|due_date|tarih|deadline|hedef tarih)/i.test(norm)) {
    return "due_date";
  }
  // ATANAN / SORUMLU / ASSIGNEE (zaten findAssigneeColumnIndex de var,
  // burada genişletilmiş varyantlar — tek bir yerden gelsin diye)
  if (/(atanan|sorumlu|assignee|owner|asignee|assigned to|kullanıcı|kullanici)/i.test(norm)) {
    return "assignee";
  }

  return null;
}

/**
 * Header listesinden standart alanlara map çıkarır.
 * Sonuç: { [field]: { index, header } }
 * Aynı field için birden fazla eşleşme varsa İLK eşleşen kullanılır.
 */
export function buildStandardFieldMap(headers: string[]): Partial<Record<StandardTaskField, { index: number; header: string }>> {
  const map: Partial<Record<StandardTaskField, { index: number; header: string }>> = {};
  headers.forEach((h, i) => {
    const field = detectStandardField(h ?? "");
    if (field && !map[field]) {
      map[field] = { index: i, header: h };
    }
  });
  return map;
}

/**
 * Bir status değerini normalize eder (CSV'den gelen serbest metin → sistem değeri).
 */
export function normalizeImportedStatus(raw: string): string {
  const s = (raw ?? "").trim().toLocaleLowerCase("tr");
  if (!s) return "Yapılacak";
  if (/tamamlandı|tamamlandi|done|completed|yapıldı|yapildi|bitti/i.test(s)) return "Tamamlandı";
  if (/devam|sürüyor|suruyor|progress|in.progress|işliyor|isliyor/i.test(s)) return "Devam";
  if (/yapılacak|yapilacak|todo|to.do|açık|acik|open|new|yeni/i.test(s)) return "Yapılacak";
  // Bilinmeyen değerse olduğu gibi bırak (kullanıcı özel statü kullanıyor olabilir)
  return raw.trim() || "Yapılacak";
}

/**
 * Bir priority değerini normalize eder.
 */
export function normalizeImportedPriority(raw: string): string | null {
  const s = (raw ?? "").trim().toLocaleLowerCase("tr");
  if (!s) return null;
  if (/yüksek|yuksek|high|acil|kritik|önemli|onemli|1|h/i.test(s)) return "High";
  if (/orta|medium|normal|2|m/i.test(s)) return "Medium";
  if (/düşük|dusuk|low|az|3|l/i.test(s)) return "Low";
  return null;
}
