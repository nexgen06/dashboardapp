# Dashboard ve Projeler Bölümleri – Tasarım Önerileri

## Mevcut Durum
- **Dashboard** (/) ve **Projeler** (/?tab=projeler) aynı sayfada, aynı içerikle (proje listesi) açılıyor.
- Kullanıcı her iki menüye tıkladığında aynı ekranı görüyor; görsel ve içerik farkı yok.

---

## 1. Dashboard (/)

**Amaç:** Ana sayfa / kontrol paneli – Genel bakış, özet sayılar ve hızlı erişim.

### İçerik Önerileri

| Bölüm | Açıklama |
|-------|----------|
| **Hoş geldin alanı** | Kullanıcı adı (auth'dan) + kısa mesaj: "Bugün neler yapmak istersiniz?" |
| **Özet kartları (KPI)** | 4–6 küçük kart: Toplam proje, Toplam görev, Tamamlanan görev, Devam eden, Yapılacak, (isteğe) Bu hafta biten |
| **Son aktiviteler** | Son güncellenen 5–10 görev (proje adı, görev kısa metni, durum, tarih); "Tümünü gör" → Canlı Tablo |
| **Proje özeti** | Son 3–5 proje kartı (küçük); "Tüm projeler" → Projeler sayfası |
| **Hızlı aksiyonlar** | Butonlar: "Yeni proje", "Canlı Tabloya git", "Projeleri listele" |
| **Görsel / grafik (opsiyonel)** | Görev durum dağılımı (Yapılacak / Devam / Tamamlandı) – pasta veya çubuk grafik |

### Görsel / Tasarım Önerileri

- **Layout:** Üstte tek satır başlık + hoş geldin; altında 2–3 sütun grid.
- **Kartlar:** Yuvarlatılmış köşe, hafif gölge, ikon + sayı + etiket (örn. mavi proje, yeşil tamamlanan, amber devam eden).
- **Ton:** Daha "karşılama" hissi; gradient veya soft renk arka plan (header alanı), beyaz/açık gri kartlar.
- **Boşluk:** Kartlar arası ve bölümler arası bol padding; okunabilir, sade tipografi.
- **Dark mode:** Kartlar koyu slate, sayılar vurgulu renk (blue/emerald/amber).

---

## 2. Projeler (/?tab=projeler veya /projeler)

**Amaç:** Proje odaklı çalışma alanı – Sadece proje listesi, arama, filtre ve CRUD.

### İçerik Önerileri

| Bölüm | Açıklama |
|-------|----------|
| **Sayfa başlığı** | "Projeler" + alt metin: "Projelerinizi yönetin, görevlere hızlıca erişin." |
| **Araç çubuğu** | Arama, durum filtresi, tarih aralığı, "Yeni proje" (mevcut yapı korunabilir) |
| **Proje kartları / liste** | Mevcut ProjectsSection – tam liste, kart görünümü (liste görünümü seçeneği eklenebilir) |
| **İstatistik çubuğu (opsiyonel)** | "X proje, Y aktif görev" gibi tek satır özet |
| **Boş durum** | Proje yoksa: illüstrasyon + "İlk projenizi oluşturun" + büyük "Yeni proje" butonu |

### Görsel / Tasarım Önerileri

- **Layout:** Daha "iş listesi" hissi; başlık + filtreler üstte, altında tam genişlik proje grid.
- **Kartlar:** Mevcut proje kartları korunup güçlendirilebilir: daha belirgin gölge, hover’da hafif scale veya border rengi değişimi, durum etiketleri (Aktif/Tamamlandı/Beklemede) daha vurgulu.
- **Ton:** Dashboard’a göre daha nötr; vurgu proje adı ve "X görev" linkinde; tek bir accent renk (mavi) butonlarda.
- **Farklılaşma:** Dashboard’da "özet + hızlı erişim"; Projeler’de "tam liste + arama/filtre + işlemler" – hiç özet kart veya hoş geldin bloğu yok, doğrudan proje odaklı.

---

## 3. Navigasyon ve URL Yapısı

| Menü | Önerilen davranış |
|------|-------------------|
| **Dashboard** | `/` → Sadece Dashboard içeriği (özet kartlar, son aktiviteler, hızlı aksiyonlar). Proje/Canlı Tablo sekmeleri burada **yok**; sadece butonlarla yönlendirme. |
| **Projeler** | `/projeler` veya `/?tab=projeler` → Sadece Projeler sayfası (ProjectsSection). Sekme yok, doğrudan proje listesi. |
| **Canlı Tablo** | `/canli-tablo` veya `/?tab=canli-tablo` → Mevcut Canlı Tablo. |

Böylece:
- **Dashboard** = genel bakış sayfası (tek sayfa, sekmeler yok).
- **Projeler** = proje listesi sayfası (tek odak).
- **Canlı Tablo** = tablo sayfası (mevcut gibi).

---

## 4. Özet Karşılaştırma

| | Dashboard | Projeler |
|---|-----------|----------|
| **Odak** | Özet, sayılar, son aktivite, hızlı aksiyon | Proje listesi, arama, filtre, CRUD |
| **İçerik** | KPI kartları, son görevler, son projeler, butonlar | Sadece proje kartları + araç çubuğu |
| **Görsel** | Daha "karşılama", renkli kartlar, hoş geldin | Daha "iş ekranı", nötr, liste/kart ağırlıklı |
| **Sekmeler** | Yok (tek sayfa) | Yok (tek sayfa) |
| **CTA** | "Projelere git", "Canlı Tablo", "Yeni proje" | "Yeni proje", proje detay linkleri |

---

## 5. Uygulama Sırası Önerisi

1. **Dashboard’ı ayrı içerikle düzenle**  
   - `/` sadece Dashboard bileşeni: hoş geldin, KPI kartları, son aktiviteler, hızlı aksiyonlar.  
   - Projeler ve Canlı Tablo bu sayfada sekme olarak kalmasın; link/buton ile `/projeler` ve `/canli-tablo`’ya gitsin.

2. **Projeleri tek sayfa yap**  
   - `/projeler` (veya mevcut `/?tab=projeler`) sadece ProjectsSection + başlık + filtreler.  
   - Sidebar’da "Projeler" tıklanınca doğrudan bu sayfa açılsın.

3. **Görsel farkları uygula**  
   - Dashboard: kart stilleri, ikonlar, hoş geldin alanı.  
   - Projeler: sade başlık, proje kartları ve araç çubuğu.

4. **İsteğe bağlı:** Grafik (görev durum dağılımı), "Son aktiviteler" için gerçek veri bağlantısı, Projeler’de liste/kart görünüm seçici.

Bu önerilerle Dashboard "genel bakış", Projeler "proje yönetim alanı" olarak net biçimde farklılaşmış olur. İstersen bir sonraki adımda bu önerilere göre somut bileşen ve route değişikliklerini adım adım yazabilirim.
