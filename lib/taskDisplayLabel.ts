const DEFAULT_EXTRA_KEY_ORDER = [
  "Başlık",
  "Görev",
  "Ad",
  "İsim",
  "Title",
  "Name",
  "Açıklama",
  "Description",
];

/**
 * Görev başlığını çözer — Kanban kartı, Görev Özeti, mobil kart, bildirim metni vb.
 *
 * Çözüm sırası:
 *   1. task.content (varsa)
 *   2. project.title_column (varsa) — projeye özel ayar
 *   3. preferredExtraKeys (kullanıcı global ayarı)
 *   4. DEFAULT_EXTRA_KEY_ORDER heuristic
 *   5. extra_data içindeki ilk dolu değer
 *   6. "—"
 */
export function getTaskDisplayLabel(
  task: {
    content?: string | null;
    extra_data?: Record<string, string> | null;
  },
  options?: {
    /** Görevin projesi için seçilmiş başlık sütunu adı (projects.title_column) */
    projectTitleColumn?: string | null;
    /** Kullanıcının global ayarındaki tercih edilen ek sütun adları */
    preferredExtraKeys?: string[];
  } | string[] /* backward-compat: doğrudan preferredExtraKeys */
): string {
  const c = (task.content ?? "").trim();
  if (c) return c;
  const ed = task.extra_data;
  if (!ed || typeof ed !== "object") return "—";

  // Backward compat: eski imza `preferredExtraKeys: string[]`
  const projectTitleColumn = Array.isArray(options) ? null : options?.projectTitleColumn ?? null;
  const preferredExtraKeys = Array.isArray(options)
    ? options
    : options?.preferredExtraKeys ?? [];

  /** Bir anahtar varyantlarını dene; bulduğun ilk dolu değeri döndür */
  const tryKey = (key: string): string | null => {
    const k = key.trim();
    if (!k) return null;
    const variants = [
      k,
      k.charAt(0).toUpperCase() + k.slice(1),
      k.toLowerCase(),
      k.toUpperCase(),
    ];
    for (const v of variants) {
      const value = ed[v];
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
    return null;
  };

  // 2. Proje-bazlı başlık sütunu (en yüksek öncelik)
  if (projectTitleColumn) {
    const r = tryKey(projectTitleColumn);
    if (r) return r;
  }

  // 3 + 4. Kullanıcı tercihi + default heuristic (her ikisi denenir, duplikatlar atlanır)
  const orderedKeys = [
    ...preferredExtraKeys.map((k) => k.trim()).filter(Boolean),
    ...DEFAULT_EXTRA_KEY_ORDER,
  ];
  const tried = new Set<string>();
  for (const k of orderedKeys) {
    const norm = k.toLowerCase();
    if (tried.has(norm)) continue;
    tried.add(norm);
    const r = tryKey(k);
    if (r) return r;
  }

  // 5. Son çare: ilk dolu değer
  const first = Object.values(ed).find((v) => v != null && String(v).trim() !== "");
  return first != null ? String(first).trim() : "—";
}

/**
 * Görev kartında başlık + alt satır (anahtar/değer çiftleri) döner.
 *
 * Alt satır kaynağı:
 *   - project.subtitle_columns dolu ise oradaki anahtarlar (sırayla, atlamadan)
 *   - boş ise null (kart sadece başlık gösterir)
 *
 * Eğer alt başlık anahtarı extra_data'da yoksa veya değer boşsa, o eleman atlanır
 * (kart sessizce kısalır — boş "—" göstermez).
 */
export function getTaskDisplayCard(
  task: {
    content?: string | null;
    extra_data?: Record<string, string> | null;
  },
  options?: {
    projectTitleColumn?: string | null;
    subtitleColumns?: string[] | null;
    preferredExtraKeys?: string[];
  }
): { label: string; subtitle: Array<{ key: string; value: string }> } {
  const label = getTaskDisplayLabel(task, {
    projectTitleColumn: options?.projectTitleColumn ?? null,
    preferredExtraKeys: options?.preferredExtraKeys ?? [],
  });
  const subtitleKeys = (options?.subtitleColumns ?? []).filter(Boolean);
  if (subtitleKeys.length === 0) return { label, subtitle: [] };
  const ed = task.extra_data;
  if (!ed || typeof ed !== "object") return { label, subtitle: [] };
  const subtitle: Array<{ key: string; value: string }> = [];
  for (const key of subtitleKeys) {
    const k = String(key).trim();
    if (!k) continue;
    // Aynı sütun başlık olarak da kullanılıyorsa alt satırda tekrarlama.
    if (
      options?.projectTitleColumn &&
      k.toLowerCase() === options.projectTitleColumn.toLowerCase()
    ) {
      continue;
    }
    // Anahtar varyantlarını dene (case fark etmesin)
    const variants = [k, k.charAt(0).toUpperCase() + k.slice(1), k.toLowerCase(), k.toUpperCase()];
    let value: string | null = null;
    for (const v of variants) {
      const val = ed[v];
      if (val != null && String(val).trim() !== "") {
        value = String(val).trim();
        break;
      }
    }
    if (value) subtitle.push({ key: k, value });
  }
  return { label, subtitle };
}
