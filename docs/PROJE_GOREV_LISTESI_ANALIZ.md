# Proje Görev Listesi – Mevcut Mantık ve Özelleştirme Fikirleri

## Mevcut mantık

### CSV/JSON import
- **Tüm sütunlar** `extra_data` içine yazılıyor (sütun adı → değer).
- **content** her zaman boş (`""`) atanıyor.
- **status** sabit: `"Yapılacak"`.
- **assignee** ve **priority** atanmıyor (null).
- Sonuç: Her CSV satırı için tek bir “görev” kaydı oluşuyor; asıl veri `extra_data`’da, listede görünen “görev metni” ise boş.

### Listede gösterilenler
| Alan        | Kaynak        | CSV import sonrası görünen |
|------------|----------------|-----------------------------|
| Görev metni | `task.content` | "—" (boş)                   |
| Durum      | `task.status`  | "Yapılacak"                 |
| Atanan     | `task.assignee`| "—"                         |
| Bana ata   | Buton          | Her satırda                 |
| Tarih      | `task.due_date`| "—"                         |
| Öncelik    | `task.priority`| "Medium" (varsayılan/UI) veya — |

Bu yüzden:
- CSV’deki satırlar listede “—” olarak görünüyor.
- Durum / Bana ata / Medium gibi göstergeler her satırda aynı şekilde duruyor; veri CSV’den gelmediği için “özelleştirilmemiş” hissediliyor.

---

## Özelleştirme için fikirler

### 1. CSV sütun eşlemesi (import aşaması)
Import sırasında kullanıcı sütun eşlemesi yapabilsin:

- **Başlık / açıklama:** Hangi CSV sütunu `content` olacak? (varsayılan: ilk sütun)
- **Durum:** Hangi sütun `status`? (değerler: Yapılacak / Devam ediyor / Tamamlandı veya eşlenebilir)
- **Atanan:** Hangi sütun `assignee`?
- **Bitiş tarihi:** Hangi sütun `due_date`? (tarih formatı seçimi)
- **Öncelik:** Hangi sütun `priority`? (High / Medium / Low veya eşlenebilir)

Böylece CSV’deki anlamlı sütunlar doğrudan görev alanlarına yazılır; liste “Tamamlandı / Bana ata / Medium” göstergelerini gerçek veriyle doldurur.

### 2. Görev satırında “görünen metin” (content + extra_data)
- **content** doluysa: Mevcut gibi `task.content` gösterilir.
- **content** boş ama **extra_data** varsa:  
  Öncelik sırası: `Başlık` → `Görev` → `Ad` → `İsim` → ilk sütun değeri.  
  Böylece CSV’den import edilmiş satırlar da listede anlamlı bir metinle görünür (mevcut veriler için ek import gerekmez).

### 3. Proje şablonu / tipi
Proje oluştururken veya ayarlardan:

- **Şablon:** “Genel görev listesi”, “Kartvizit / Broşür satırları”, “Sadece liste (salt okunur)” vb.
- Buna göre:
  - Hangi alanların (durum, atanan, öncelik, tarih) gösterileceği,
  - Import’ta varsayılan sütun eşlemesi  
  belirlenir. Böylece “Bu projedeki görevler” ekranı proje tipine göre özelleşir.

### 4. Göstergeleri koşullu gösterme
- **Durum:** Sadece değer dolu/geçerliyse veya proje şablonu “durum kullan” diyorsa göster.
- **Bana ata:** Sadece kullanıcı bu projeye atanmışsa veya “atama kullanılan” projelerde göster.
- **Öncelik:** Sadece `task.priority` doluysa badge göster; yoksa “Medium” varsayılanını göstermemek.

Böylece CSV’den gelen “sadece liste” projelerde gereksiz sabit göstergeler azalır.

### 5. Satırı “kart” gibi gösterme (extra_data ağırlıklı)
CSV satırı = bir “kart”:

- Birinci satır: `content` veya extra_data’dan “başlık” (öneri: 2. maddede tanımlanan mantık).
- Altında: extra_data’nın diğer anahtarları küçük etiketler (badge) veya “Sütun: Değer” şeklinde.

Böylece “Bu projedeki görevler” listesi, CSV’deki tüm sütunları özetleyen özelleştirilmiş bir görünüme kavuşur.

### 6. Import önizleme
CSV yüklenince:

- İlk 5–10 satır önizleme tablosu (sütun adları + örnek değerler).
- “Başlık için hangi sütun?” vb. eşleme seçimi.
- “İçe aktar” ile gerçek import.

Hata ve yanlış eşleme azalır.

### 7. Sütun görünürlüğü (liste başlıkları)
Proje ayarı veya şablona göre:

- Hangi sütunların (extra_data anahtarları) listede görüneceği seçilebilir.
- Sıra: “Başlık, Durum, Atanan, Tarih, Öncelik, [Sütun A], [Sütun B]…” gibi.

Böylece “Bu projedeki görevler” tamamen projeye özel bir tablo gibi davranabilir.

---

## Özet öneri sırası

1. **Hemen:** Listede görünen metin – content boşsa extra_data’dan başlık/ilk sütun (yapıldı).
2. **Kısa vadede:** CSV import’ta ilk sütunu (veya “başlık” sütununu) `content` olarak yazmak.
3. **Orta vadede:** Import önizleme + sütun eşleme (content, status, assignee, due_date, priority).
4. **İsteğe bağlı:** Proje şablonu + göstergelerin koşullu gösterimi + extra_data kart görünümü.

Bu sırayla hem mevcut davranış netleşir hem de “Tamamlandı / Bana ata / Medium” göstergeleri projeye ve veriye göre anlamlı hale gelir.
