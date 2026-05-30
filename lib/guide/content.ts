import {
  Sparkles,
  Table2,
  Bell,
  Keyboard,
  Palette,
  Layers,
  Filter,
  Group,
  ArrowUpDown,
  MousePointer2,
  Type,
} from "lucide-react";
import type { GuidePage } from "@/lib/guide/types";
import { GUIDE_CATEGORIES } from "@/lib/guide/types";

export { GUIDE_CATEGORIES };

/**
 * Rehber içerik bankası — Faz 1: temel + öne çıkan özellikler.
 *
 * İçerik kararlı hale gelince MDX'e taşınabilir. Şimdilik yapılandırılmış
 * section'lar React'te doğrudan render edilir.
 */
export const GUIDE_PAGES: GuidePage[] = [
  /* ─────────── Başlangıç ─────────── */
  {
    id: "hosgeldin",
    category: "baslangic",
    title: "Hoş geldin",
    description: "Panel'i ilk 5 dakikada tanı — temel kavramlar ve nereden başlanır.",
    icon: Sparkles,
    primaryHref: { label: "Dashboard'a git", href: "/" },
    sections: [
      { type: "p", text: "Panel — kurumsal görev ve süreç yönetimi için tasarlanmış canlı veri ortamı. Excel'in kolaylığını, Notion'un esnekliğini ve Linear'ın hızını bir araya getirir." },
      { type: "h2", text: "Üç ana kavram" },
      {
        type: "list",
        items: [
          "🗂  **Projeler** — görev gruplarını organize ettiğin alanlar (örn. müşteri, departman, sprint).",
          "📊 **Canlı Tablo** — tüm görevleri tek bir akıllı tabloda görür, sıralarsın.",
          "🔔 **Bildirimler** — sana atanan, geciken veya seninle ilgili her şey burada.",
        ],
      },
      { type: "h2", text: "İlk 5 dakika için 3 öneri" },
      {
        type: "list",
        ordered: true,
        items: [
          "**Sidebar'da modüller** (Çalışma / Veri / Yönetim / Kişisel) — sol kenardan modül seç, kategorilenmiş sayfalar gelir.",
          "**⌘K Komut paleti** — her şey için tek giriş noktası. Görev ara, yeni oluştur, ayar bul.",
          "**?  Bu sayfa için yardım** — sağ üstte yardım butonu, hangi sayfadaysan oranın rehberi.",
        ],
      },
      { type: "tip", text: "Klavye sevenler için: `?` tuşuna basınca tüm klavye kısayolları açılır. Sık kullandığın 3-4 tanesini öğrenmek bile günde 10 dakika kazandırır." },
      { type: "h2", text: "Roller — kim ne yapabilir" },
      {
        type: "table",
        headers: ["Rol", "Yapabilir"],
        rows: [
          ["Admin", "Her şey — kullanıcı yetkileri, marka rengi, kurumsal admin"],
          ["Project Manager", "Kendi projelerini yönetir, görev ekler, atar"],
          ["Member", "Atandığı görevleri görür, düzenler, yorum yapar"],
          ["Viewer", "Sadece okur — değiştirmez"],
        ],
      },
    ],
    related: ["canli-tablo-baslangic", "klavye-kisayollari", "kisisellestirme"],
  },

  /* ─────────── Canlı Tablo ─────────── */
  {
    id: "canli-tablo-baslangic",
    category: "tablo",
    title: "Canlı Tablo'ya başlangıç",
    description: "Yeni görev ekle, hücreyi düzenle, hızlıca filtrele — Excel kullanıyorsan evindesin.",
    icon: Table2,
    primaryHref: { label: "Canlı Tablo'ya git", href: "/canli-tablo" },
    sections: [
      { type: "p", text: "Canlı Tablo, sistemdeki tüm görevleri tek bir akıllı tabloda gösterir. Filtre, sıralama, grup, koşullu biçim — hepsi tek noktada." },
      { type: "h2", text: "İlk hareketler" },
      {
        type: "list",
        ordered: true,
        items: [
          "**Yeni görev**: sağ üstteki `+` veya en alttaki \"Yeni satır\" butonu. Enter ile zincirleme satır ekle.",
          "**Hücreyi düzenle**: tek tık → tüm metin seçili gelir (Excel pattern). Yaz, Enter ile kaydet veya Tab ile sonraki hücreye geç.",
          "**Hata olunca**: kayıt sırasında ağ sorunu çıkarsa kırmızı uyarı + \"Tekrar dene\" butonu — veri kaybı yok.",
        ],
      },
      { type: "kbd", keys: ["Tek tık"], description: "Hücre düzenleme, metin otomatik seçili" },
      { type: "kbd", keys: ["Enter"], description: "Kaydet + sonraki satıra geç" },
      { type: "kbd", keys: ["Tab"], description: "Kaydet + sonraki hücreye geç" },
      { type: "kbd", keys: ["Esc"], description: "İptal — değişikliği vazgeç" },
      { type: "h2", text: "Toplu işlem (3+ satır seçince)" },
      { type: "p", text: "Birden fazla satırın checkbox'ını işaretleyince üstte mavi bir aksiyon çubuğu belirir:" },
      {
        type: "list",
        items: [
          "**Durum** — toplu durum değiştir",
          "**Ata** — kullanıcıya toplu atama",
          "**Öncelik** — toplu öncelik güncelle",
          "**Sil** — toplu sil (6 saniyelik geri alma süresi)",
        ],
      },
      { type: "tip", text: "Sildikten sonra 6 saniye içinde \"Geri al\" butonuna basabilirsin. Sessiz kayıp yok." },
      { type: "h2", text: "Filtre" },
      { type: "p", text: "Tablonun üstündeki arama kutusuna yaz → anında filtrelenir. Her kolonun başlığında küçük filtre ikonu → değer seçerek dar et." },
      { type: "h2", text: "Boş satır görünce ne yapacaksın?" },
      {
        type: "list",
        items: [
          "**Tablo gerçekten boşsa** → 3 büyük kart görürsün (CSV / Komut Paleti / Manuel)",
          "**Filtre eşleşmiyorsa** → aktif filtreler chip olarak görünür, tek tıkla temizle",
        ],
      },
    ],
    related: ["tablo-gelismis", "klavye-kisayollari"],
  },

  {
    id: "tablo-gelismis",
    category: "tablo",
    title: "Gelişmiş Tablo: Group, Sort, Conditional Format",
    description: "Notion/Airtable seviyesinde özellikler — gruplama, çoklu sıralama, kurala göre renklendirme.",
    icon: Layers,
    isNew: true,
    primaryHref: { label: "Canlı Tablo'ya git", href: "/canli-tablo" },
    sections: [
      { type: "h2", text: "Group By — Görevleri kategoriye göre düzenle" },
      { type: "p", text: "Tablonun üstündeki \"Grupla:\" dropdown'ından kategori seç. Tüm görevler o kategoriye göre gruplara ayrılır. Her grup başlığında count badge + tamamlanma durumu." },
      {
        type: "table",
        headers: ["Gruplama", "Ne işe yarar"],
        rows: [
          ["Durum", "Yapılacak / Devam / Tamamlandı blokları net görünür"],
          ["Atanan", "Her kişinin yükünü tek bakışta gör"],
          ["Öncelik", "High → Medium → Low blokları"],
          ["Proje", "Hangi projede ne var"],
          ["Son tarih", "⚠️ Geciken / 📅 Bugün / 🗓 Bu hafta / ⏳ İleride"],
        ],
      },
      { type: "tip", text: "Grup başlığına tık → daralt/aç. Refresh sonrası seçimin korunur." },
      { type: "h2", text: "Multi-sort (Excel pattern)" },
      { type: "p", text: "Header'a normal tıkla → sırala. **Shift + tıkla** → ikinci sıralamaya ekler. Her sıralı header'da küçük rakam görünür (1, 2, 3)." },
      { type: "kbd", keys: ["Tık"], description: "Tek kolon sırala" },
      { type: "kbd", keys: ["Shift", "Tık"], description: "Çoklu sıralamaya ekle" },
      { type: "h2", text: "Koşullu Biçim — Kurala göre renkli satır" },
      { type: "p", text: "Tablonun üstünde mor \"Koşullu Biçim\" butonuna tıkla. 5 hazır preset var — toggle ile aktif et. Kendi kuralını da ekleyebilirsin." },
      {
        type: "list",
        items: [
          "🔴 **Geciken görevler** — due_date geçmiş + tamamlanmamış",
          "🟡 **Bugün biten** — bugün son tarihli görevler",
          "🔴 **Yüksek öncelik** — priority \"high\" içeren",
          "🟡 **Atanmamış** — assignee boş",
          "⚪ **Tamamlanmış (soluk)** — odak aktif işlerde",
        ],
      },
      { type: "warning", text: "Selection, Presence ve Automation lock CF'ten önceliklidir — görsel çakışmaz." },
      { type: "h2", text: "Kolon Yönetimi" },
      {
        type: "list",
        items: [
          "**Sırala**: kolon başlığına gel, sol kenardaki grip ikonunu (⋮⋮) sürükle",
          "**Mobil/tablet**: dokunarak sürükle",
          "**Klavye**: Tab + Space + ←/→ ile taşı",
          "**Sabitle (pin)**: kolon menüsünden \"Sola sabitle\" / \"Sağa sabitle\"",
        ],
      },
    ],
    related: ["canli-tablo-baslangic", "tablo-saved-views"],
  },

  /* ─────────── Bildirim ─────────── */
  {
    id: "inbox-zero",
    category: "bildirim",
    title: "Bildirim Inbox Zero — Superhuman pattern",
    description: "30 saniyede 30 bildirimi temizle. Klavye akışı + snooze + sıfıra inme kutlaması.",
    icon: Bell,
    isNew: true,
    primaryHref: { label: "Bildirimleri aç", href: "/bildirimler" },
    sections: [
      { type: "p", text: "Bildirim merkezi popover'ı hızlı bakış için. Ama gerçek temizlik için tam ekran focus mode kullan." },
      { type: "kbd", keys: ["⌘", "Shift", "E"], description: "Bildirim merkezi (focus mode)" },
      { type: "h2", text: "Klavye akışı" },
      { type: "kbd", keys: ["J"], description: "Sonraki bildirim (↓ ile aynı)" },
      { type: "kbd", keys: ["K"], description: "Önceki bildirim (↑ ile aynı)" },
      { type: "kbd", keys: ["E"], description: "Arşivle (okundu işaretle, sıradakine geç)" },
      { type: "kbd", keys: ["R"], description: "Aç — bildirimin hedef sayfasına git" },
      { type: "kbd", keys: ["D"], description: "Snooze menüsü aç" },
      { type: "kbd", keys: ["Enter"], description: "Bildirimi aç (R ile aynı)" },
      { type: "kbd", keys: ["Esc"], description: "Sayfadan geri dön" },
      { type: "h2", text: "Snooze (D tuşu)" },
      { type: "p", text: "Şu an cevaplayamadığın bir bildirimi sonraya bırak. Süresi gelince inbox'a otomatik geri döner." },
      {
        type: "list",
        items: [
          "**1 saat sonra** — kısa bir mola için",
          "**Bu akşam 18:00** — gün sonu hatırlatması",
          "**Yarın 09:00** — yeni güne sakla",
          "**Pazartesi 09:00** — hafta sonu temizliği",
        ],
      },
      { type: "h2", text: "Inbox Zero" },
      { type: "p", text: "Sağ üstte sayaç: \"Inbox: 12\". Tüm bildirimleri işleyince \"Inbox: 0 ✨\" + kutlama animasyonu. Auto-advance ile her arşivde sıradakine otomatik geçer." },
      { type: "tip", text: "Bir kez denersen alışırsın. 30 bildirimi 30 saniyede temizlemek — Superhuman/Linear standardı." },
    ],
    related: ["klavye-kisayollari"],
  },

  /* ─────────── Klavye ─────────── */
  {
    id: "klavye-kisayollari",
    category: "klavye",
    title: "Klavye Kısayolları",
    description: "En sık kullanılan kısayollar — günde 10 dakika kazandırır.",
    icon: Keyboard,
    primaryHref: { label: "HUD'u aç (? tuşu)", href: "#" },
    sections: [
      { type: "tip", text: "Herhangi bir sayfada `?` tuşuna bas → tüm kısayollar HUD'u açılır." },
      { type: "h2", text: "Global" },
      { type: "kbd", keys: ["?"], description: "Kısayol listesini aç/kapa" },
      { type: "kbd", keys: ["⌘", "K"], description: "Komut paleti — proje, görev, komut ara" },
      { type: "kbd", keys: ["N"], description: "Komut paleti (hızlı oluşturma)" },
      { type: "kbd", keys: ["⌘", "Shift", "E"], description: "Bildirim merkezi (Inbox Zero)" },
      { type: "kbd", keys: ["Esc"], description: "Açık modal/paneli kapat" },
      { type: "h2", text: "Sayfa geçişleri (G + harf)" },
      { type: "kbd", keys: ["G", "H"], description: "Dashboard" },
      { type: "kbd", keys: ["G", "P"], description: "Projeler" },
      { type: "kbd", keys: ["G", "T"], description: "Canlı Tablo" },
      { type: "kbd", keys: ["G", "R"], description: "Raporlar" },
      { type: "kbd", keys: ["G", "M"], description: "Mesajlar" },
      { type: "kbd", keys: ["G", "B"], description: "Bildirimler" },
      { type: "h2", text: "Canlı Tablo" },
      { type: "kbd", keys: ["J"], description: "Sonraki görev (detay panelini açar)" },
      { type: "kbd", keys: ["K"], description: "Önceki görev" },
      { type: "kbd", keys: ["F"], description: "Hızlı filtre paneli" },
      { type: "kbd", keys: ["Shift", "F"], description: "Tabloyu tam ekran" },
      { type: "kbd", keys: ["["], description: "Önceki sayfa" },
      { type: "kbd", keys: ["]"], description: "Sonraki sayfa" },
      { type: "h2", text: "Hücre düzenleme" },
      { type: "kbd", keys: ["Tek tık"], description: "Hücre düzenle, metin seçili" },
      { type: "kbd", keys: ["Enter"], description: "Kaydet + sonraki satır" },
      { type: "kbd", keys: ["Tab"], description: "Kaydet + sonraki hücre" },
      { type: "kbd", keys: ["Esc"], description: "İptal" },
      { type: "h2", text: "Bildirim merkezi" },
      { type: "kbd", keys: ["J", "↓"], description: "Sonraki" },
      { type: "kbd", keys: ["K", "↑"], description: "Önceki" },
      { type: "kbd", keys: ["E"], description: "Arşivle + auto-advance" },
      { type: "kbd", keys: ["R"], description: "Aç (hedef sayfa)" },
      { type: "kbd", keys: ["D"], description: "Snooze menüsü" },
    ],
  },

  /* ─────────── Kişiselleştirme ─────────── */
  {
    id: "kisisellestirme",
    category: "kisisel",
    title: "Kişiselleştirme — Marka, Logo, Tema",
    description: "Kurumsal renginizi tanıtın, logonuzu yükleyin, koyu/açık mod, sidebar yerleşimi.",
    icon: Palette,
    isNew: true,
    primaryHref: { label: "Ayarlar → Görünüm", href: "/ayarlar?tab=gorunum" },
    sections: [
      { type: "h2", text: "Marka rengi — kurumsal HEX" },
      { type: "p", text: "Ayarlar → Görünüm → Marka rengi'nde color picker veya HEX text input'a kurumsal renginizi girin. Tüm vurgular, butonlar, focus halkası bu renge dönüşür." },
      { type: "tip", text: "Renk her cihazda saklanır (localStorage). Geçersiz HEX'te otomatik fallback." },
      { type: "h2", text: "Kurumsal logo" },
      { type: "p", text: "PNG, SVG, JPG veya WebP — max 200KB. Yüklenince sidebar başlığında \"Panel\" yazısı yerine logonuz görünür. Splash ekranda da kullanılır." },
      { type: "warning", text: "Yatay oranlı küçük logo en iyi sonucu verir (örn. 200x40)." },
      { type: "h2", text: "Tema" },
      {
        type: "list",
        items: [
          "**Açık** — gün ışığında çalışıyorsan",
          "**Koyu** — gece için göz dostu",
          "**Sisteme uy** — OS ayarını takip et",
        ],
      },
      { type: "h2", text: "Sidebar tercihleri" },
      {
        type: "list",
        items: [
          "**Varsayılan daraltılmış** — ekran alanı kazanmak için rail-only başlat",
          "**Modül seçici** (sol rail): Çalışma / Veri / Yönetim / Kişisel",
          "**Pin** — hover'da pin ikonu → \"Sabitlenenler\" üst bölümüne ekle",
        ],
      },
      { type: "h2", text: "Canlı Tablo görünüm tercihleri" },
      { type: "kbd", keys: ["Yoğun"], description: "Compact — daha fazla satır görünür" },
      { type: "kbd", keys: ["Normal"], description: "Varsayılan" },
      { type: "kbd", keys: ["Büyük"], description: "Comfortable — okunaklı, geniş" },
      { type: "p", text: "Şablon: **Klasik** (Excel benzeri) veya **Modern** (Untitled-UI tarzı)." },
    ],
    related: ["hosgeldin"],
  },
];

/** Slug → page lookup */
export function findGuidePage(id: string): GuidePage | undefined {
  return GUIDE_PAGES.find((p) => p.id === id);
}

/** Sayfa-bazlı yardım eşlemesi — `?` butonu hangi rehbere yönlendirsin */
export const PAGE_TO_GUIDE: Record<string, string> = {
  "/": "hosgeldin",
  "/canli-tablo": "canli-tablo-baslangic",
  "/bildirimler": "inbox-zero",
  "/ayarlar": "kisisellestirme",
  "/projeler": "hosgeldin",
};

export function guideForPath(pathname: string): string {
  // Exact match
  if (PAGE_TO_GUIDE[pathname]) return PAGE_TO_GUIDE[pathname];
  // Prefix match
  for (const [path, guide] of Object.entries(PAGE_TO_GUIDE)) {
    if (path !== "/" && pathname.startsWith(path)) return guide;
  }
  return "hosgeldin";
}
