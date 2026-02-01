# Tasarım ve Fonksiyon Tutarsızlıkları

Uygulamanın kullanım amacı (kurumsal görev/proje yönetim paneli, Firebase ile giriş, rol bazlı yetkiler) düşünüldüğünde tespit edilen tasarım ve mantık tutarsızlıkları.

---

## 1. Kimlik doğrulama ve erişim

### 1.1 Giriş zorunlu değil ✅ (Uygulandı)
- **Durum:** Firebase açıkken bile giriş yapmamış kullanıcı `/`, `/projeler`, `/canli-tablo`, `/ayarlar` sayfalarına doğrudan gidebiliyordu.
- **Sonuç:** "Giriş yapın" mesajı var ama uygulama girişi zorunlu kılmıyordu; panel girişsiz kullanılabiliyordu.
- **Yapılan:** `components/AuthGuard.tsx` eklendi; layout’ta `AuthGuard` ile panel sarmalandı. Firebase açıkken ve `user === null` iken tüm rotalar (giriş sayfası hariç) `/giris`e yönlendiriliyor.

### 1.2 "Profil / Yetki" linki yetkisiz kullanıcıya hata sayfası açıyor
- **Durum:** Header’daki kullanıcı menüsünde tüm giriş yapmış kullanıcılar için "Profil / Yetki" → `/yonetim/kullanici-yetkileri` linki var. Bu sayfaya sadece `userManagement.view` yetkisi olan (pratikte admin) erişebiliyor.
- **Sonuç:** Üye, proje yöneticisi veya izleyici bu linke tıklayınca "Bu sayfaya erişim yetkiniz yok" ekranına düşüyor. Kendi rolünü/profile bilgisini görecek bir yer yok.
- **Öneri:**  
  - Ya "Profil / Yetki" sadece admin’e gösterilsin, diğer roller için ayrı bir "Profil" sayfası (sadece kendi e-posta/rolü) açılsın.  
  - Ya da `userManagement.view` tüm rollerde açılsın; sayfa içinde "Oturum açan kullanıcı" herkese, "Tüm kullanıcılar" ve rol düzenleme sadece admin’e gösterilsin.

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

### 4.1 "Kullanıcı yetkileri" sayfasında sadece yönetici içerik var
- **Durum:** Sayfa tamamen `userManagement.view` ile korunuyor; bu yetki sadece admin’de var. Bu yüzden üye/proje yöneticisi/izleyici kendi rolünü ve yetkilerini göremiyor.
- **Sonuç:** Rol bazlı panelde kullanıcının "Benim rolüm ve yetkilerim neler?" sorusuna cevap verecek tek yer erişime kapalı.
- **Öneri:** "Kullanıcı yetkileri" sayfası iki modda olabilir: (1) Herkes kendi profilini ve rolünü görür; (2) Sadece admin "Tüm kullanıcılar" ve rol düzenleme görür. Bunun için `userManagement.view` tüm giriş yapmış kullanıcılara verilebilir, içerik rolüne göre kısılır.

### 4.2 Sidebar’da "Kullanıcı yetkileri" sadece admin’de
- **Durum:** Sidebar’da "Kullanıcı yetkileri" sadece `area.userManagement` yetkisi olanlara görünüyor (admin). Header’da ise "Profil / Yetki" herkese görünüyor ve aynı sayfaya gidiyor.
- **Sonuç:** Sidebar ile header davranışı çelişiyor: Sidebar’da link yok, header’da var; link tıklanınca yetkisiz kullanıcı hata görüyor.
- **Öneri:** Yukarıdaki "Profil / Yetki" ve sayfa erişim mantığı ile birlikte düzeltilmeli; sidebar’da "Profil" veya "Hesabım" herkese, "Kullanıcı yetkileri" (tüm kullanıcı listesi) sadece admin’e gösterilebilir.

---

## 5. Veri ve teknik tutarlılık

### 5.1 Firebase + Supabase birlikte kullanımı
- **Durum:** Kimlik Firebase Auth + Firestore (kullanıcı/rol); görev/proje verisi Supabase. İki farklı backend.
- **Sonuç:** Operasyonel ve kavramsal olarak kabul edilebilir; dokümantasyonda "Kimlik Firebase, veri Supabase" net yazılırsa geliştirici ve kullanıcı beklentisi netleşir.
- **Öneri:** README veya `docs/` içinde mimari özet (hangi sistemin ne için kullanıldığı) açıkça yazılsın.

### 5.2 Mock kullanıcı (Firebase kapalıyken) ✅ (Uygulandı)
- **Durum:** Firebase yokken user null idi; Header'da avatar/giriş yoktu.
- **Yapılan:** Firebase kapalıyken sabit "Demo kullanıcı" (roleId: member) auth context'te set ediliyor. Header'da "Demo mod" rozeti gösteriliyor; kullanıcı menüsü ve Dashboard "Hoş geldin, Demo kullanıcı" ile tutarlı çalışıyor.


---

## 6. Özet öncelik listesi

| Öncelik | Konu | Önerilen aksiyon |
|--------|------|-------------------|
| Yüksek | Giriş zorunluluğu | Firebase açıkken giriş yapmamış kullanıcıyı korumalı sayfalarda `/giris`e yönlendir |
| Yüksek | Profil / Yetki erişimi | Tüm giriş yapmış kullanıcılar kendi rolünü görebilsin; admin ek olarak tüm kullanıcıları yönetsin |
| Orta | Header "Profil / Yetki" | Yetkiye göre farklı sayfa/link (Profil vs Kullanıcı yetkileri) veya tek sayfada rol bazlı içerik |
| Orta | Arama kutusu | Ya işlevsel global arama ya da kaldır / "Yakında" notu |
| Orta | Bildirimler | Gerçek veriye bağla veya "Örnek" olarak işaretle / kaldır |
| Düşük | Admin giriş yönlendirmesi | Varsayılan hedefi `/` yap; yetki sayfası menüden erişilsin |
| Düşük | Giriş sayfası layout | İsteğe bağlı: girişte sidebar/header kaldır veya sadeleştir |
| Düşük | Canlı Tablo iki tablo | Amaçları kısa metinle netleştir |

Bu liste, uygulamanın "giriş + rol + proje/görev yönetimi" amacına göre özellikle kimlik, erişim ve kullanıcı bilgisi (profil/rol) tarafındaki tutarsızlıkları gidermek için kullanılabilir.
