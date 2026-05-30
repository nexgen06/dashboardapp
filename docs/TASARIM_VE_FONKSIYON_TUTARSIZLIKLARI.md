# Tasarım ve Fonksiyon Tutarsızlıkları

Uygulamanın kullanım amacı (kurumsal görev/proje yönetim paneli, Supabase Auth ile giriş, rol bazlı yetkiler) düşünüldüğünde tespit edilen tasarım ve mantık tutarsızlıkları.

---

## 1. Kimlik doğrulama ve erişim

### 1.1 Giriş zorunlu değil ✅ (Uygulandı)
- **Durum:** Supabase yapılandırılmışken bile giriş yapmamış kullanıcı `/`, `/projeler`, `/canli-tablo`, `/ayarlar` sayfalarına doğrudan gidebiliyordu.
- **Sonuç:** "Giriş yapın" mesajı var ama uygulama girişi zorunlu kılmıyordu; panel girişsiz kullanılabiliyordu.
- **Yapılan:** `components/AuthGuard.tsx` eklendi; layout’ta `AuthGuard` ile panel sarmalandı. Supabase oturumu yokken (`user === null`)  tüm rotalar (giriş sayfası hariç) `/giris`e yönlendiriliyor.

### 1.2 Profil / Yetki erişimi ✅ (Uygulandı)
- **Durum:** Header’da tüm kullanıcılar `/yonetim/kullanici-yetkileri` linkine gidiyordu; admin sayfası veya erişim hatası görünüyordu.
- **Yapılan:**
  - **`/profil`** — avatar, görünen ad, rol etiketi (Türkçe rol adı)
  - **`/profil/yetkiler`** — oturum açan kullanıcının rolü ve etkin izin özeti (salt okunur)
  - Header: **Profilim** + **Rolüm ve yetkilerim** (herkese); **Kullanıcı yönetimi** yalnızca admin (`area.userManagement`)
  - Sidebar Kişisel modülde Profilim ve Rolüm ve yetkilerim linkleri
  - `userManagement.view` yalnızca admin rolünde; non-admin `/yonetim/kullanici-yetkileri` URL’sine giderse `/profil/yetkiler`’e yönlendirilir
  - Kurumsal admin ve diğer yönetim sayfaları sıkılaştırıldı

### 1.3 Giriş sayfasında layout ✅ (Uygulandı)
- **Durum:** `/giris` sayfası da Sidebar + Header ile aynı layout’ta görünüyordu; giriş formu yanında "Panel" menüsü ve header’da "Giriş yap" butonu vardı.
- **Yapılan:** `components/AppLayout.tsx` eklendi; `pathname === "/giris"` iken sadece sayfa içeriği render ediliyor (sidebar/header yok). Diğer sayfalarda tam panel layout kullanılıyor. Giriş sayfası artık tam ekran, odak formda.

---

## 2. Navigasyon ve bilgi mimarisi

### 2.1 Header arama kutusu işlevsiz ✅ (Uygulandı)
- **Durum:** Header’da "Ara..." placeholder’lı bir arama kutusu vardı; arama yapılmıyordu.
- **Yapılan:** İşlevsiz arama kutusu Header’dan kaldırıldı. Global arama ileride eklenebilir.

### 2.2 Sabit/sahte bildirimler ✅ (Uygulandı)
- **Durum:** Header’daki bildirimler sabit liste idi; gerçek veriye bağlı değildi.
- **Yapılan:** Bildirim (zil + dropdown) bölümü Header’dan kaldırıldı. Gerçek bildirim sistemi ileride eklenebilir.

### 2.3 Admin giriş sonrası her seferinde yetki sayfasına düşme ✅ (Uygulandı)
- **Durum:** Admin giriş yaptığında doğrudan kullanıcı yetkileri sayfasına gidiyordu.
- **Yapılan:** Giriş sonrası yönlendirme tüm rollerde `/` (Dashboard) olacak şekilde güncellendi. Kullanıcı yetkileri sidebar ve header menüsünden erişilebilir.

---

## 3. İçerik ve terminoloji

### 3.1 Canlı Tablo sayfasında iki tablo ✅ (Uygulandı)
- **Durum:** İki tablonun amacı net değildi.
- **Yapılan:** Üst blok başlığı "Görev özeti", açıklama "En son güncellenen görevlerin kısa listesi." Alt blok "Canlı Tablo (Supabase)" başlığı korundu, açıklama "Tüm görevler – canlı senkronizasyonla birlikte düzenleme. Başka biri aynı satırı düzenliyorsa sarı ile işaretlenir." olacak şekilde güncellendi.

### 3.2 Ana sayfa (Dashboard) ve sekmeler ✅ (Uygulandı)
- **Durum:** Dashboard ile Projeler/Canlı Tablo ayrımının net olması isteniyordu.
- **Yapılan:** DashboardSection hoş geldin metninde "Özet ve hızlı erişim" vurgulandı; açıklama "KPI özetinize, son projelere ve görevlere" olacak şekilde güncellendi. Sidebar'da Dashboard menü öğesine dar modda tooltip "Dashboard – Özet ve hızlı erişim" eklendi.


---

## 4. Yetki ve roller

### 4.1 "Kullanıcı yetkileri" ve profil/yetkiler ayrımı ✅ (Uygulandı)
- **Yapılan:** Admin `/yonetim/kullanici-yetkileri` (tüm kullanıcılar, davet, rol düzenleme). Diğer roller `/profil/yetkiler` (kendi rolü + izin özeti).

### 4.2 Sidebar ile header tutarlılığı ✅ (Uygulandı)
- **Yapılan:** Sidebar Kişisel modülde profil linkleri herkese; Yönetim modülünde kullanıcı yönetimi yalnızca admin’e. Header aynı mantıkla hizalandı.

---

## 5. Veri ve teknik tutarlılık

### 5.1 Kimlik ve veri — Supabase ✅
- **Durum:** Kimlik (Supabase Auth + `profiles`) ve görev/proje verisi aynı Supabase projesinde.
- **Sonuç:** Tek backend; RLS ile rol bazlı erişim.

### 5.2 Demo mod (Supabase yapılandırılmamışken) ✅ (Uygulandı)
- **Durum:** Supabase env eksikken user null idi; Header'da avatar/giriş yoktu.
- **Yapılan:** `NEXT_PUBLIC_ALLOW_DEMO_MODE=true` ile sabit "Demo kullanıcı" (roleId: member) auth context'te set ediliyor. Header'da "Demo mod" rozeti gösteriliyor.


---

## 6. Özet öncelik listesi

| Öncelik | Konu | Önerilen aksiyon |
|--------|------|-------------------|
| Yüksek | Giriş zorunluluğu | Supabase oturumu yokken korumalı sayfalarda `/giris`e yönlendir |
| Yüksek | Profil / Yetki erişimi | ✅ `/profil` + `/profil/yetkiler`; admin ayrı yönetim sayfası |
| Orta | Header menü tutarlılığı | ✅ Profilim / Rolüm ve yetkilerim / Kullanıcı yönetimi (admin) |
| Orta | Arama kutusu | Ya işlevsel global arama ya da kaldır / "Yakında" notu |
| Orta | Bildirimler | Gerçek veriye bağla veya "Örnek" olarak işaretle / kaldır |
| Düşük | Admin giriş yönlendirmesi | Varsayılan hedefi `/` yap; yetki sayfası menüden erişilsin |
| Düşük | Giriş sayfası layout | İsteğe bağlı: girişte sidebar/header kaldır veya sadeleştir |
| Düşük | Canlı Tablo iki tablo | Amaçları kısa metinle netleştir |

Bu liste, uygulamanın "giriş + rol + proje/görev yönetimi" amacına göre özellikle kimlik, erişim ve kullanıcı bilgisi (profil/rol) tarafındaki tutarsızlıkları gidermek için kullanılabilir.
