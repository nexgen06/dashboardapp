import type { LucideIcon } from "lucide-react";

/**
 * Rehber sayfa modeli — markdown yerine yapılandırılmış section'lar.
 *
 * Avantaj: doğrudan React render, IDE autocomplete, tip güvenliği.
 * MDX'e geçiş ileride yapılır (içerik kararlı hale gelince).
 */
export type GuideSection =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "tip"; text: string }
  | { type: "warning"; text: string }
  | { type: "kbd"; keys: string[]; description: string }
  | { type: "code"; lang?: string; code: string }
  | { type: "action"; label: string; href: string; description?: string }
  | { type: "divider" }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
    };

export type GuideCategory = "baslangic" | "tablo" | "bildirim" | "kisisel" | "klavye" | "yonetim";

export const GUIDE_CATEGORIES: Record<GuideCategory, { label: string; icon?: string; order: number }> = {
  baslangic: { label: "Başlangıç", order: 1 },
  tablo: { label: "Canlı Tablo", order: 2 },
  bildirim: { label: "Bildirimler", order: 3 },
  klavye: { label: "Klavye Kısayolları", order: 4 },
  kisisel: { label: "Kişiselleştirme", order: 5 },
  yonetim: { label: "Yönetim", order: 6 },
};

export type GuidePage = {
  id: string;
  category: GuideCategory;
  title: string;
  /** Kısa açıklama — TOC ve arama için */
  description: string;
  icon: LucideIcon;
  /** Son 30 günde eklenen özellikler için */
  isNew?: boolean;
  /** İlgili sayfaya direkt git butonu */
  primaryHref?: { label: string; href: string };
  sections: GuideSection[];
  /** İlgili diğer rehber id'leri */
  related?: string[];
};
