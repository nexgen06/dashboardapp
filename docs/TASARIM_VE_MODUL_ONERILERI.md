# Tasarım Arayüz Taraması ve Ek Modül Önerileri

Bu belge, uygulamanın tüm tasarım/arayüz kodunun taramasına dayanarak **ek tasarım iyileştirmeleri** ve **eklenebilir modül önerilerini** özetler. Öneriler mevcut yapıya uyumlu, ek modül olarak eklenebilir niteliktedir.

---

## 1. Mevcut Tasarım Özeti

### 1.1 Teknoloji ve Stil
- **Framework:** Next.js (App Router), React, TypeScript
- **Stil:** Tailwind CSS, CSS değişkenleri (`:root` / `.dark`), `tailwindcss-animate`
- **Bileşen kütüphanesi:** Radix tabanlı UI (Button, Dialog, Dropdown, Tabs, Badge, Avatar, Separator, Tooltip, Table)
- **İkonlar:** Lucide React
- **Renk paleti:** Slate ağırlıklı; primary mavi (blue-600); durum renkleri: emerald (tamamlandı), amber (devam), red (yüksek öncelik / destructive)

### 1.2 Layout
- **AppLayout:** Giriş hariç tüm sayfalarda Sidebar + Header + main
- **Sidebar:** Daraltılabilir (72px / 250px), yetkiye göre menü (Dashboard, Projeler, Canlı Tablo, Ayarlar, Kullanıcı yetkileri)
- **Header:** Sayfa başlığı, bildirim zili, kullanıcı avatar + dropdown (Profil, Ayarlar, Çıkış)
- **Main:** `bg-white dark:bg-slate-900`, `p-6`, `max-w-*` container’lar sayfa bazında

### 1.3 Sayfa Yapıları
| Sayfa | İçerik |
|-------|--------|
| **/** | Hoş geldin, KPI kartları (proje/görev sayıları), görev durum çubuğu, hızlı aksiyonlar, son aktiviteler, son projeler |
| **/projeler** | Başlık, ProjectsSection (arama, filtre, proje kartları, yeni proje) |
| **/projeler/[id]** | Proje detay, görev listesi, CSV/JSON içe aktarma, görev ekleme/düzenleme |
| **/canli-tablo** | Görev özeti (GorevOzeti) + Canlı Tablo (TasksTable), filtreler, CSV/JSON/paste, inline düzenleme |
| **/ayarlar** | Sekmeli (Genel, Görünüm, Bildirimler, Görevler, Güvenlik, Entegrasyonlar, Gelişmiş), arama, sıfırlama (admin) |
| **/yonetim/kullanici-yetkileri** | Kullanıcı listesi, rol atama (admin) |
| **/giris** | Tam ekran form (sidebar/header yok), gradient arka plan |

### 1.4 Ortak UI Kalıpları
- Erişim yok: amber border + Shield ikonu + “Dashboard’a dön” butonu
- Yükleme: Loader2 spinner veya “Yükleniyor…”
- Kartlar: `rounded-xl` / `rounded-lg`, `border border-slate-200`, `shadow-sm`, hover’da `shadow-md`
- Formlar: `rounded-lg border`, focus’ta `ring-2 ring-blue-500/20`
- Badge: durum/öncelik için renkli (emerald, amber, red, blue, slate)

---

## 2. Tasarım İyileştirme Önerileri

### 2.1 Görsel / UX
| Öneri | Açıklama | Zorluk |
|-------|----------|--------|
| **Breadcrumb** | Proje detay ve alt sayfalarda “Dashboard > Projeler > [Proje adı]” breadcrumb; mobilde kısaltılmış | Düşük |
| **Skeleton yükleme** | Liste ve tablo yüklenirken gerçek içerik yerine skeleton (shimmer) kullanmak | Orta |
| **Boş durum illüstrasyonları** | “Görev yok”, “Proje yok”, “Bildirim yok” için basit SVG/illüstrasyon + CTA | Düşük |
| **Toast / Snackbar** | “Kaydedildi”, “Silindi” gibi işlem sonuçları için sayfa içi toast (şu an sadece ayarlarda sabit mesaj var) | Düşük |
| **Klavye kısayolları** | Canlı Tabloda “N” = yeni görev, “/” = arama focus; genel “Esc” = modal kapat | Orta |
| **Focus tuzakları (a11y)** | Dialog/modal açıkken focus modal içinde kalsın, kapatılınca önceki elemana dönsün | Düşük |
| **Koyu mod geçişi** | Tema değişiminde kısa fade veya `transition` (class toggle zaten var) | Düşük |

### 2.2 Bileşen / UI Kütüphanesi
| Öneri | Açıklama | Zorluk |
|-------|----------|--------|
| **Select / Combobox** | Şu an birçok yerde native `<select>`; Radix Select veya Combobox ile arama + klavye erişimi | Orta |
| **Tarih seçici (DatePicker)** | Tarih aralığı ve “son gün” için tek bileşen; tutarlı format ve erişilebilirlik | Orta |
| **Command palette** | Cmd/Ctrl+K ile sayfa ve aksiyon araması (Projelere git, Yeni görev, Ayarlar…) | Orta |
| **Progress / Linear** | Uzun işlemler (toplu içe aktarma, veritabanı sıfırlama) için ilerleme çubuğu | Düşük |
| **Sheet (yan panel)** | Mobilde filtre veya detay için sağdan açılan panel; Dialog alternatifi | Düşük |

### 2.3 Tablo ve Liste
| Öneri | Açıklama | Zorluk |
|-------|----------|--------|
| **Sütun sabitleme (pin)** | Canlı Tabloda sütun sırası zaten var; “Durum” veya “Seçim” sabit (sticky) olabilir | Orta |
| **Satır yoğunluğu** | Ayarlardan “kompakt / rahat” görünüm seçeneği (satır yüksekliği) | Düşük |
| **Liste / kart görünümü** | Projeler sayfasında grid (mevcut) + liste görünümü geçişi | Orta |
| **Sıralama göstergesi** | Tabloda sıralanan sütun başlığında ok + “A-Z / Z-A” etiketi | Düşük |

---

## 3. Eklenebilir Modül Önerileri

### 3.1 Modül: Global Arama
- **Amaç:** Header veya Command palette üzerinden proje, görev, sayfa araması.
- **İçerik:** Arama kutusu veya Cmd+K; sonuçlarda “Projeler”, “Görevler”, “Sayfalar” sekmeleri; tıklanınca ilgili sayfaya / satıra git.
- **Veri:** Mevcut `projects` ve `tasks` (Supabase); sayfa listesi statik.
- **Yer:** Header’a arama ikonu veya ayrı “Ara” sayfası; tercihen Command palette ile tek giriş.

### 3.2 Modül: Bildirim Merkezi (genişletilmiş)
- **Amaç:** Sadece özet değil, okundu/okunmadı ve tür bazlı filtre.
- **İçerik:** “Bildirimler” sayfası (`/bildirimler`); liste (proje atandı, görev atandı, gecikmiş, vb.); “Tümünü okundu işaretle”; ayarlarda tür bazlı aç/kapa (mevcut BILDIRIMLER_TASARIM.md ile uyumlu).
- **Veri:** Faz 1: mevcut `useNotificationSummary` türevleri. Faz 2: Supabase `notifications` tablosu + tetikleyiciler.
- **Yer:** Sidebar’a “Bildirimler”, Header’daki zil → dropdown + “Tümünü gör” linki.

### 3.3 Modül: Aktivite / Audit Log
- **Amaç:** “Kim, ne zaman, ne yaptı?” özeti (proje/görev oluşturma, güncelleme, silme).
- **İçerik:** Sayfa veya panel: son N olay listesi (kullanıcı, aksiyon, hedef, tarih); filtre: tarih, kullanıcı, aksiyon türü.
- **Veri:** Supabase’de `activity_log` tablosu (ör. `user_email`, `action`, `entity_type`, `entity_id`, `meta`, `created_at`); insert/update/delete tetikleyicileri veya uygulama tarafında loglama.
- **Yetki:** Sadece admin veya `activity.view` yetkisi.
- **Yer:** Sidebar “Aktivite” veya Gelişmiş ayarlar altında link.

### 3.4 Modül: Raporlar ve Basit Analitik
- **Amaç:** Görev/proje özet raporları ve basit grafikler.
- **İçerik:** “Raporlar” sayfası: görev durum dağılımı (pasta/çubuk), proje bazlı görev sayısı, tarih aralığına göre tamamlanan görevler, gecikme özeti; export (CSV/PDF).
- **Veri:** Mevcut `tasks` ve `projects`; tarih filtreleri.
- **Yer:** Sidebar “Raporlar”; yetki: `reports.view` (örn. admin + project_manager).

### 3.5 Modül: Takvim Görünümü
- **Amaç:** Görevleri tarih bazlı (son tarih veya oluşturma) takvimde göstermek.
- **İçerik:** Takvim (ay/hafta); görevler `due_date` veya `created_at`’e göre hücrelerde; tıklanınca detay veya hızlı düzenleme.
- **Veri:** Mevcut `tasks` (due_date, project_id, status).
- **Yer:** Canlı Tablo’da “Görünüm: Tablo / Takvim” veya ayrı “Takvim” sayfası/sekmesi.

### 3.6 Modül: Şablonlar
- **Amaç:** Sık kullanılan proje veya görev setlerini şablon olarak kaydedip yeni proje/açılışta uygulamak.
- **İçerik:** “Şablonlar” sayfası veya proje oluştururken “Şablondan oluştur”; şablon adı, proje alanları, varsayılan görev listesi (başlık + durum/öncelik).
- **Veri:** Supabase `templates` (ör. `name`, `project_defaults` JSON, `tasks` JSON); veya sadece localStorage/ayar.
- **Yer:** Projeler sayfasında “Yeni proje” yanında “Şablondan”, veya Ayarlar / Gelişmiş altında “Şablonlar”.

### 3.7 Modül: Yorumlar / Notlar (görev bazlı)
- **Amaç:** Görev veya proje için zaman damgalı yorumlar; ekip iletişimi.
- **İçerik:** Görev detay panelinde “Yorumlar” sekmesi; yorum ekleme (metin), liste (tarih + kullanıcı); isteğe “@mention” ve bildirim.
- **Veri:** Supabase `comments` (task_id veya project_id, user_email, body, created_at).
- **Yer:** Görev detay dialogunda sekme; Canlı Tablo satırında yorum sayısı badge’i.

### 3.8 Modül: Hedefler / OKR (basit)
- **Amaç:** Proje veya genel “hedef” tanımlama; ilerleme yüzdesi veya bağlı görevlerle takip.
- **İçerik:** “Hedefler” sayfası; hedef adı, bitiş tarihi, ilerleme (manuel veya “X/Y görev tamamlandı”); proje veya görevlere bağlama.
- **Veri:** `goals` tablosu; opsiyonel `goal_id` proje/görevde.
- **Yer:** Sidebar “Hedefler”; Dashboard’da “Aktif hedefler” kartı.

### 3.9 Modül: Mobil Alt Menü (PWA)
- **Amaç:** Mobilde alt kısımda sabit navigasyon (Dashboard, Projeler, Canlı Tablo, Bildirimler, Profil).
- **İçerik:** `max-sm` veya `md` altında bottom navigation; Sidebar yerine veya yanında.
- **Yer:** AppLayout’ta ek koşullu render; mevcut Sidebar ile birlikte veya mobilde sadece alt menü.

### 3.10 Modül: Tema / Renk Kişiselleştirme
- **Amaç:** Kullanıcının primary rengi veya hazır tema seçmesi (mavi, mor, yeşil).
- **İçerik:** Ayarlar > Görünüm’de “Accent rengi” veya “Tema seti”; CSS değişkenleri veya sınıf setleri.
- **Veri:** Settings context’e `accentColor` veya `themePreset`; localStorage.
- **Yer:** Mevcut Görünüm sekmesine birkaç seçenek eklenebilir.

---

## 4. Öncelik ve Bağımlılık Özeti

| Öncelik | Modül / Öneri | Bağımlılık |
|---------|----------------|------------|
| Yüksek | Toast / Snackbar, Boş durum illüstrasyonları | Yok |
| Yüksek | Global Arama (Command palette) | Yok (mevcut veri) |
| Orta | Bildirim Merkezi (sayfa + okundu) | İsteğe `notifications` tablosu |
| Orta | Aktivite / Audit Log | `activity_log` tablosu + tetikleyiciler |
| Orta | Raporlar | Yok (mevcut veri) |
| Orta | Takvim görünümü | Yok (tasks.due_date) |
| Orta | Skeleton yükleme, Breadcrumb | Yok |
| Düşük | Şablonlar, Yorumlar, Hedefler | Yeni tablolar |
| Düşük | Mobil alt menü, Tema kişiselleştirme | Yok |

---

## 5. Teknik Notlar

- **Yeni sayfalar:** `app/<modul>/page.tsx` + gerekirse `AuthGuard` ve yetki kontrolü.
- **Sidebar:** `components/layout/Sidebar.tsx` içindeki `menuItems` dizisine `permission` ile yeni link eklenir.
- **Yetkiler:** `types/permissions.ts` içine yeni `Permission` ve rol eşlemesi eklenir (örn. `reports.view`, `activity.view`).
- **Stil tutarlılığı:** Yeni bileşenlerde mevcut `Button`, `Badge`, `Dialog`, `DropdownMenu` ve Tailwind sınıfları (slate, blue, rounded-lg, shadow-sm) kullanılarak mevcut görünüm korunabilir.

Bu dokümandaki maddeler, mevcut tasarım ve kod yapısına uyumlu olacak şekilde aşamalı olarak ek modül veya iyileştirme olarak uygulanabilir.
