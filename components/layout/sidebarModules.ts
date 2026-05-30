/**
 * VS Code activity bar pattern — sidebar modül taksonomisi.
 *
 * Mevcut menü ~20 item'a şişti. Tek liste yerine 4 modül grubuna ayrılır:
 *   - Çalışma:  günlük iş akışı (dashboard, görevler, mesajlar, bildirimler)
 *   - Veri:     veri yönetimi (projeler, canlı tablo, raporlar)
 *   - Yönetim:  admin/yetki/operasyon (/yonetim/*)
 *   - Kişisel:  ayarlar, profil
 *
 * Activity rail (56px) modülleri gösterir; seçili modülün item'ları
 * sağ kolonda (220px) listelenir. Route değişince aktif modül otomatik
 * seçilir.
 */

import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Database,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Mail,
  Megaphone,
  MessageSquarePlus,
  MessagesSquare,
  ServerCog,
  Settings,
  Shield,
  Sparkles,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/types/permissions";

export type ModuleId = "calisma" | "veri" | "yonetim" | "kisisel";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tooltip — collapsed durumda + hover'da metin altı */
  tooltip?: string;
  permission: Permission | null;
  alsoRequire: Permission | null;
};

export type SidebarModule = {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  /** Activity rail tooltip */
  description: string;
  items: NavItem[];
};

/**
 * Tüm modüller — sıralama activity rail'de yukarıdan aşağıya bu sırayla görünür.
 */
export const SIDEBAR_MODULES: SidebarModule[] = [
  {
    id: "calisma",
    label: "Çalışma",
    description: "Günlük iş akışı",
    icon: Activity,
    items: [
      { href: "/", label: "Dashboard", tooltip: "Özet ve hızlı erişim", icon: LayoutDashboard, permission: null, alsoRequire: null },
      { href: "/gorevlerim", label: "Görevlerim", tooltip: "Mobil odaklı kişisel görev akışı", icon: ListTodo, permission: "area.liveTable", alsoRequire: "liveTable.view" },
      { href: "/mesajlar", label: "Mesajlar", tooltip: "Proje sohbetleri ve okunmamışlar", icon: MessagesSquare, permission: "area.projects", alsoRequire: "projects.view" },
      { href: "/bildirimler", label: "Bildirimler", tooltip: "Atama, gecikme ve sohbet bildirimleri", icon: Bell, permission: null, alsoRequire: null },
      { href: "/geri-bildirim", label: "Geri Bildirim", tooltip: "Öneri, hata bildirimi veya sorularını ilet", icon: MessageSquarePlus, permission: null, alsoRequire: null },
    ],
  },
  {
    id: "veri",
    label: "Veri",
    description: "Projeler, tablo, raporlar",
    icon: Database,
    items: [
      { href: "/projeler", label: "Projeler", icon: FolderKanban, permission: "area.projects", alsoRequire: "projects.view" },
      { href: "/canli-tablo", label: "Canlı Tablo", icon: Table2, permission: "area.liveTable", alsoRequire: "liveTable.view" },
      { href: "/raporlar", label: "Raporlar", tooltip: "Proje ve ekip performans raporları", icon: BarChart3, permission: "area.reports", alsoRequire: "reports.view" },
    ],
  },
  {
    id: "yonetim",
    label: "Yönetim",
    description: "Admin, yetki, operasyon",
    icon: Shield,
    items: [
      { href: "/yonetim/kurumsal-admin", label: "Kurumsal admin", tooltip: "Sistem sağlığı, RLS, deploy ve veri bakımı", icon: ServerCog, permission: "area.userManagement", alsoRequire: null },
      { href: "/yonetim/kullanici-yetkileri", label: "Kullanıcı yetkileri", icon: Shield, permission: "area.userManagement", alsoRequire: null },
      { href: "/yonetim/gorev-istatistikleri", label: "Görev istatistikleri", icon: BarChart3, permission: "area.userManagement", alsoRequire: null },
      { href: "/yonetim/rapor-sablonlari", label: "Rapor şablonları", tooltip: "PDF/e-posta export şablonları", icon: FileText, permission: "area.userManagement", alsoRequire: null },
      { href: "/yonetim/referans-veriler", label: "Referans veriler", tooltip: "JSON kaynakları ve merkezi dropdown verileri", icon: Database, permission: "area.userManagement", alsoRequire: null },
      { href: "/yonetim/cip-kutuphanesi", label: "Çip Kütüphanesi", tooltip: "Merkezi çip şablonları", icon: Sparkles, permission: "chipTemplates.view", alsoRequire: null },
      { href: "/yonetim/otomasyon-merkezi", label: "Otomasyon Merkezi", tooltip: "Koşul ve aksiyon bazlı kurallar", icon: Bot, permission: "automation.view", alsoRequire: null },
      { href: "/yonetim/pii-access", label: "PII erişim kayıtları", tooltip: "TCKN/Sicil kopya/export izleme", icon: Shield, permission: "area.piiAccess", alsoRequire: "piiAccess.view" },
      { href: "/yonetim/geri-bildirimler", label: "Geri bildirim yönetimi", tooltip: "Kullanıcılardan gelen öneri/hata/soru", icon: MessageSquarePlus, permission: "area.feedbackAdmin", alsoRequire: "feedback.manage" },
      { href: "/yonetim/duyurular", label: "Duyurular", tooltip: "Tüm kullanıcılara mesaj gönder", icon: Megaphone, permission: "area.announcementsAdmin", alsoRequire: "notifications.send" },
      { href: "/yonetim/eposta-bildirimleri", label: "E-posta bildirim ayarları", tooltip: "Hangi olaylarda e-posta gönderilsin", icon: Mail, permission: "area.emailNotifAdmin", alsoRequire: null },
    ],
  },
  {
    id: "kisisel",
    label: "Kişisel",
    description: "Hesap ve tercihler",
    icon: Settings,
    items: [
      { href: "/ayarlar", label: "Ayarlar", icon: Settings, permission: "area.settings", alsoRequire: "settings.view" },
    ],
  },
];

/**
 * Verilen pathname'in hangi modüle ait olduğunu döndürür.
 * Bulunamazsa varsayılan modül (ilk modül) döner.
 */
export function moduleForPath(pathname: string): ModuleId {
  for (const m of SIDEBAR_MODULES) {
    for (const item of m.items) {
      if (item.href === "/") {
        if (pathname === "/") return m.id;
        continue;
      }
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return m.id;
      }
    }
  }
  return SIDEBAR_MODULES[0].id;
}

/** Bir item'ın aktif sayfa olup olmadığını route eşleştirmesiyle döndürür. */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.href === "/ayarlar") return pathname === "/ayarlar";
  if (item.href.startsWith("/yonetim")) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Tüm modüllerden href → NavItem haritası. Pin/lookup için. */
export function buildNavItemIndex(): Map<string, NavItem> {
  const map = new Map<string, NavItem>();
  for (const m of SIDEBAR_MODULES) {
    for (const item of m.items) {
      map.set(item.href, item);
    }
  }
  return map;
}
