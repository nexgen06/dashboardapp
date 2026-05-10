# Görev Ekleme: Daha Özgür ve Esnek Fikirler

Mevcut akış: form ile **İçerik, Durum, Atanan, Son tarih, Öncelik** alanları; proje detayda ve Canlı Tablo’da “Görev ekle” butonu. Aşağıdaki fikirler hem hız hem esneklik hem de kişiselleştirme ihtiyaçlarını karşılamak için önerilmiştir.

---

## 1. Hızlı ekleme (Quick add)

**İhtiyaç:** “Bir şey aklıma geldi, hemen yazıp ekleyeyim” — form açmadan, tek alanda.

**Öneri:**
- **Tek satırlık “Görev ekle” alanı:** Sayfa üstünde veya tablonun hemen üstünde bir input. Kullanıcı sadece metni yazar, Enter’a basar → görev varsayılan durum/öncelik/atanan ile oluşur.
- **Varsayılanlar:** Ayarlar veya proje bazında “Yeni görev varsayılan durumu / önceliği” seçilebilir.
- **Opsiyonel:** Hızlı alanda `@kişi` veya `#öncelik` gibi kısa etiketler parse edilip atanan/öncelik otomatik set edilebilir.

**Esneklik:** İsteyen form açar, isteyen tek satırdan ekler.

---

## 2. Metin yapıştır ile toplu ekleme

**İhtiyaç:** Not defteri / e-posta / toplantı notundan satır satır listeyi kopyalayıp tek seferde görev yapmak.

**Öneri:**
- “Metin yapıştır” butonu veya sekmesi: Kullanıcı her satırı bir görev olacak şekilde metin yapıştırır.
- Boş satırlar yok sayılır; trim + boş olmayan satırlar = N adet yeni görev.
- Varsayılan durum/öncelik/atanan (ve proje varsa proje) hepsine uygulanır.
- Önizleme: “X görev eklenecek” + liste; onaylayınca toplu ekleme.

**Esneklik:** CSV/JSON bilmeyen kullanıcı da toplu ekleyebilir.

---

## 3. Görev şablonları

**İhtiyaç:** Sık kullanılan görev tipleri (toplantı notu, teklif hazırlığı, müşteri takibi vb.) tek tıkla açılsın.

**Öneri:**
- **Sabit şablonlar:** “Toplantı notu”, “Takip et”, “Teklif hazırla”, “Araştır” gibi önceden tanımlı şablonlar. Tıklanınca form açılır, başlık/placeholder ve varsayılan durum-öncelik dolu gelir.
- **Kullanıcı şablonları (ileride):** Kullanıcı “Şablon olarak kaydet” ile kendi şablonunu oluşturur (içerik taslağı, varsayılan atanan, etiket/extra_data). Yeni görev eklerken “Şablonlardan seç” ile doldurulur.

**Esneklik:** Hem hızlı hem tutarlı görev açılışı.

---

## 4. Özel alanlar (extra_data’yı forma taşımak)

**İhtiyaç:** Takım/kişi kendi alanlarını kullanmak istiyor: referans no, bütçe kodu, müşteri adı, etiket vb.

**Mevcut:** Veritabanında `extra_data` (JSON) zaten var; CSV/JSON import’ta kullanılıyor.

**Öneri:**
- **“Özel alan ekle”:** Görev ekleme/düzenleme formunda isteğe bağlı alanlar. Kullanıcı “Alan adı” + “Değer” ekler; bunlar `extra_data`’ya yazılır.
- **Proje bazlı özel alan tanımı (ileride):** Projede “Bu projede her görevde şu alanlar olsun” (örn. Referans No, Müşteri) tanımlanır; form açıldığında bu alanlar otomatik çıkar.

**Esneklik:** Sabit sütunlara takılmadan her takım kendi alanlarını kullanır.

---

## 5. Kısayollar ve “Bana ata”

**İhtiyaç:** Klavye ile hız, tek tıkla “bana ata”.

**Öneri:**
- **Ctrl/Cmd + N** veya **Ctrl/Cmd + Enter:** Yeni görev formunu aç (veya quick add alanına odaklan).
- Formda “Bana ata” zaten proje detayda var; Canlı Tablo’daki `TaskFormDialog` içine de aynı buton eklenebilir.
- Son kullanılan “Atanan” değeri (localStorage veya state) bir sonraki formda varsayılan olarak önerilebilir.

**Esneklik:** Az tıklama, aynı form.

---

## 6. Bağlamdan otomatik doldurma

**İhtiyaç:** “Bu projeden ekliyorum” veya “Bu sayfadan ekliyorum” bilgisi kaybolmasın.

**Mevcut:** Proje detayda görev eklerken `project_id` zaten set ediliyor.

**Öneri:**
- Proje detayda: Varsayılan öncelik her zaman proje önceliğinden gelsin (zaten var).
- Canlı Tablo’da: Eğer tek bir proje filtelenmişse, “Görev ekle” ile açılan formda proje otomatik seçili olsun (veya “Mevcut projeye ekle” checkbox’ı).
- “Bu sayfadan ekle” ile referrer veya proje adı `extra_data`’da saklanabilir (opsiyonel).

**Esneklik:** Kullanıcı hangi bağlamda olduğunu tekrar seçmek zorunda kalmaz.

---

## 7. İçerik alanını zenginleştirme (opsiyonel)

**İhtiyaç:** Uzun açıklama, madde listesi, link.

**Öneri:**
- **Çok satır (textarea):** Görev ekleme formunda “İçerik” için tek satır yerine textarea; uzun açıklama ve satır satır not yazılabilir.
- **Markdown (ileride):** İçerik alanında basit markdown (başlık, liste, link) desteklenir; listelemede kısaltılmış, detayda tam render.
- **Link:** “Link ekle” ile bir URL `extra_data`’da (örn. `link`) saklanır; görev satırında tıklanabilir link gösterilir.

**Esneklik:** Görev hem kısa başlık hem not/link taşıyabilir.

---

## 8. Drag & drop ve dosyadan görev

**İhtiyaç:** Dosyayı sürükleyip bırakınca görevler çıksın.

**Mevcut:** CSV/JSON dosya seçimi var.

**Öneri:**
- Aynı import alanına (veya “Toplu ekle” bölgesine) **dosya sürükle-bırak** eklenir; bırakılan dosya CSV/JSON ise mevcut import akışı tetiklenir.
- “Metin yapıştır” ile birlikte kullanıcıya iki seçenek sunulur: “Dosya seç / sürükle” veya “Metin yapıştır”.

**Esneklik:** Kullanıcı alışkanlığına göre dosya veya metin.

---

## 9. Durum / öncelik seçeneklerini özelleştirme (ileride)

**İhtiyaç:** Takım “Yapılacak / Yapılıyor / Bitti” yerine kendi durumlarını kullansın.

**Öneri:**
- Ayarlar veya proje ayarlarında “Durum listesi” ve “Öncelik listesi” tanımlanabilir (örn. JSON veya virgülle ayrılmış).
- Görev formundaki dropdown’lar bu listelerden doldurulur; varsayılan değer yine seçilebilir.

**Esneklik:** Yazılım sabit değerlerle sınırlı kalmaz, takım kendi terminolojisini kullanır.

---

## Öncelik özeti

| Öncelik | Fikir | Çaba | Etki |
|--------|--------|------|------|
| Yüksek | Quick add (tek satır + Enter) | Orta | Hız, günlük kullanım |
| Yüksek | Metin yapıştır ile toplu ekleme | Orta | Esneklik, toplu giriş |
| Orta | “Bana ata” + son atanan önerisi (Canlı Tablo formunda) | Düşük | Hız |
| Orta | Görev şablonları (sabit 3–5 şablon) | Orta | Tutarlılık, hız |
| Orta | Formda çok satır (textarea) + opsiyonel link alanı | Düşük | Esneklik |
| Orta | Drag & drop dosya (mevcut import’a) | Düşük | Kullanım kolaylığı |
| İleride | Özel alanlar UI (extra_data) | Yüksek | Büyük esneklik |
| İleride | Kullanıcı şablonları, özelleştirilebilir durum/öncelik | Yüksek | Tam kişiselleştirme |

Bu dokümandaki fikirler mevcut veritabanı (`tasks.extra_data`, `content`, `status`, `assignee`, `due_date`, `priority`, `project_id`) ve mevcut `createTask` / `createTasksBulk` API’leri ile uyumludur; hangi maddeden başlamak istediğinize göre adım adım uygulanabilir.
