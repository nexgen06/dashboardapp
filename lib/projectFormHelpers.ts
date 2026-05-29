import type { ProjectPriority } from "@/types/project";

/** Form/API'den gelen önceliği "High" | "Medium" | "Low" olarak normalleştirir. */
export function normalizeProjectPriority(
  v: string | ProjectPriority | null | undefined
): ProjectPriority | null {
  const s = (v != null ? String(v).trim() : "").toLowerCase();
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return null;
}

/** Form metninden ek sütun anahtarları: satır veya virgül ile ayrılmış. */
export function parseExtraColumnKeysFromForm(text: string): string[] {
  const set = new Set<string>();
  for (const part of text.split(/[\n,]+/)) {
    const t = part.trim();
    if (t !== "") set.add(t);
  }
  return Array.from(set);
}

export const SMART_EXTRA_COLUMN_CHIPS = [
  { label: "Sicil", group: "Kimlik" },
  { label: "TCKN", group: "Kimlik" },
  { label: "Personel No", group: "Kimlik" },
  { label: "Ad Soyad", group: "Kimlik" },
  { label: "Telefon", group: "İletişim" },
  { label: "E-posta", group: "İletişim" },
  { label: "Departman", group: "Organizasyon" },
  { label: "Bölge", group: "Organizasyon" },
  { label: "Şube", group: "Organizasyon" },
  { label: "İl", group: "Organizasyon" },
  { label: "Ekip", group: "Operasyon" },
  { label: "Uzmanlık", group: "Operasyon" },
  { label: "Durum Notu", group: "Operasyon" },
  { label: "Son İşlem Tarihi", group: "Tarih" },
] as const;

export const SMART_CHIP_COLUMN_PRESETS = [
  {
    label: "Risk",
    templateName: "Risk",
    description: "Düşük, orta ve kritik operasyon riski.",
    tone: "red",
  },
  {
    label: "Ödeme Durumu",
    templateName: "Ödeme Durumu",
    description: "Ödendi, ödenmedi, gecikti ve kısmi ödeme.",
    tone: "amber",
  },
  {
    label: "Evrak",
    templateName: "Evrak",
    description: "Eksik evrak, işlemde ve arşivlendi takibi.",
    tone: "blue",
  },
  {
    label: "Gizlilik",
    templateName: "Gizlilik",
    description: "Genel, hizmete özel ve gizli veri sınıfı.",
    tone: "violet",
  },
] as const;

export type SmartChipColumnPreset = (typeof SMART_CHIP_COLUMN_PRESETS)[number];

export function smartChipToneClass(tone: SmartChipColumnPreset["tone"], selected: boolean): string {
  const base = {
    red: selected
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/35 dark:text-red-200"
      : "border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-800 dark:hover:bg-red-950/30",
    amber: selected
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-200"
      : "border-slate-300 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-amber-800 dark:hover:bg-amber-950/30",
    blue: selected
      ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-200"
      : "border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/30",
    violet: selected
      ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-200"
      : "border-slate-300 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-violet-800 dark:hover:bg-violet-950/30",
  }[tone];
  return base;
}
