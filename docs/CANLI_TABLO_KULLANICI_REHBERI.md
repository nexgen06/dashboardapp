# Canlı Tablo – Kullanıcı Rehberi

Bu rehber, Canlı Tablo sayfasının nasıl çalıştığını ve tüm özelliklerin nasıl kullanılacağını adım adım anlatır.

---

## 1. Canlı Tablo nedir?

Canlı Tablo, görevleri (tasks) listeleyip düzenlemenizi sağlayan, **Supabase** ile gerçek zamanlı senkronize çalışan bir tablo ekranıdır. İki bölümden oluşur:

- **Görevler Tablosu:** Demo / örnek görevler (sabit veri).
- **Canlı Tablo (Supabase):** Gerçek veritabanındaki görevler; CSV içe aktarım, arama, filtre, sıralama ve **canlı güncelleme** destekler.

**Erişim:** Sol menüden **Canlı Tablo** veya Dashboard’daki **Canlı Tabloya git** butonu ile `/canli-tablo` sayfasına gidersiniz. Bu alanı görebilmeniz için **Canlı Tablo** yetkisine sahip olmanız gerekir.

---

## 2. Sayfa yapısı

- **Üst kısım:** Sayfa başlığı “Canlı Tablo” ve **Dashboard'a dön** butonu.
- **İlk kart – Görevler Tablosu:** Örnek görevler (durum, görev adı, atanan, öncelik, son güncelleme). Sütun sıralama, sabitleme ve “Tablo genişlet” ile tam ekran kullanılabilir.
- **İkinci kart – Canlı Tablo (Supabase):** Arama, filtreler, yeni görev, CSV içe aktar, dışa aktar ve asıl veri tablosu burada yer alır. Başka biri aynı satırı düzenliyorsa satır **sarı** ile işaretlenir (canlı senkronizasyon).

---

## 3. Arama ve filtreler (Canlı Tablo – Supabase)

Tablonun hemen üstünde:

- **Arama kutusu:** “Görev veya atanan kişide ara” – Görev metninde veya atanan kişi adında arama yapar. CSV ile gelen ek sütunlardaki metinler de aranır.
- **Sadece proje görevleri / Tüm görevler:** Varsayılan “Sadece proje görevleri”dir; yalnızca bir projeye atanmış görevler listelenir. “Tüm görevler” ile tüm kayıtlar gelir.
- **Durum:** Tümü, Yapılacak, Devam ediyor, Tamamlandı.
- **Atanan:** Listede bulunan atanan kişilerden biriyle filtreleme.
- **Başlangıç / Bitiş tarihi:** Son güncelleme tarihine göre aralık filtreleri.

Aktif filtre sayısı “X filtre aktif” olarak gösterilir. **Temizle** ile tüm filtreler sıfırlanır.

---

## 4. Tablo üzerinde çalışma

### 4.1 Sütunlar

- **Seçim:** Satır seçmek için checkbox. Başlıktaki checkbox ile sayfadaki tüm satırlar seçilir / bırakılır.
- **Dinamik sütunlar:** CSV içe aktarılan dosyadaki sütunlar otomatik eklenir (örn. A., D., Eksik Belge, İşe Giriş Tarihi). Bu sütunlar **satır içi düzenlenebilir**.
- **İşlemler:** Her satırda üç nokta menüsü – Düzenle, Kopyala, Sil (yetkinize göre).

Sütun genişlikleri **orantılı** dağıtılır; tablo her zaman konteynerin tam genişliğini doldurur.

### 4.2 Sütun başlıkları ile yapabilecekleriniz

- **Sürükleyip bırakma:** Başlıktan tutup sürükleyerek sütun sırasını değiştirebilirsiniz.
- **Genişlik:** Sütun sağ kenarındaki çizgiyi sürükleyerek genişliği ayarlayabilirsiniz.
- **Menü (⋮):** “Sol tarafa sabitle”, “Sağ tarafa sabitle”, “Sabitlemeyi kaldır” – sütunu sabit (sticky) yapar; kaydırırken görünür kalır.
- **Sıralama:** Sıralanabilir sütunlarda başlığa tıklayarak artan/azalan sıralama yapılır (ok ikonu ile gösterilir).

### 4.3 Hücre düzenleme

- Metin sütunlarına **tıklayın**; alan düzenlenebilir hale gelir. **Enter** ile kaydeder, **Esc** ile iptal edersiniz. Değişiklikler anında Supabase’e yazılır ve diğer kullanıcılara **canlı** yansır.
- Bazı sütun adları (yapıldı, done, durum, priority vb.) **checkbox** veya **açılır liste** olarak gösterilir; değiştirdiğinizde yine anında kaydedilir.

### 4.4 “Detay” / CSV sütunları

CSV’den gelen ek sütunlar “Detay” sütununda **“CSV sütunları (N)”** gibi bir butonla özetlenir. Bu butona tıklayınca ilgili satırın tüm orijinal CSV sütunları (sütun adı – değer) bir pencerede listelenir.

---

## 5. Araç çubuğu butonları (Canlı Tablo – Supabase)

Tablonun üstündeki özet satırında (toplam görev, tamamlanan, devam eden vb.) şu butonlar bulunur:

- **İçeriğe göre ölçeklendir:** Sütun genişliklerini başlık ve hücre içeriğine göre otomatik ayarlar.
- **Tablo genişlet:** Tabloyu tam ekran açar; tekrar tıklayınca daraltır.
- **Kolonları göster:** Hangi sütunların görüneceğini checkbox listesi ile seçersiniz (Seçim, İşlemler, CSV’den gelen her sütun).
- **CSV içe aktar:** CSV (veya uygun JSON) dosyası yükleyip sütun eşlemesi yaparak görevleri toplu ekler. İlk sütun görev metni (content), diğer sütunlar ek veri (extra_data) olarak saklanır.
- **Dışa aktar:**  
  - CSV indir (mevcut görünüm / tüm veri)  
  - Excel indir (mevcut görünüm / tüm veri)  
  Görünür sütunlar ve uygulanan filtreye göre veri dışa aktarılır.
- **Yeni görev:** Yeni bir görev eklemek için form açar (yetkiniz varsa).
- **Örnek kayıt ekle:** Veritabanına örnek görevler ekler.
- **Örnek kayıtları tekrar yükle:** Örnek veriyi yeniden yükler (mevcut örnek kayıtları silip tekrar ekler).

Yeşil **Canlı** rozeti, Supabase Realtime bağlantısının aktif olduğunu gösterir. Bağlantı koparsa “Yeniden bağlanıyor” uyarısı çıkar.

---

## 6. Toplu işlemler (seçili satırlar)

Bir veya daha fazla satırı **Seçim** sütunundaki checkbox ile işaretleyin. Seçim yaptığınızda üstte şu seçenekler belirir:

- **“X görev seçildi”** metni.
- **Durumu güncelle:** Açılır menüden Yapılacak / Devam / Tamamlandı seçerek seçili tüm görevlerin durumunu günceller.
- **Seçilenleri sil:** Seçili görevleri veritabanından siler (yetkiniz varsa).

---

## 7. Sayfalama (pagination)

Tablonun altında:

- **Satır:** Açılır listeden sayfa başına 10, 25 veya 50 satır seçebilirsiniz.
- **“X görev (sayfa Y/Z)”** ve sayfa numaraları ile önceki/sonraki sayfaya geçersiniz.

---

## 8. Satır menüsü (İşlemler sütunu)

Her satırdaki üç nokta (⋮) menüsünde (yetkinize göre):

- **Düzenle:** Görevi bir form ile düzenler.
- **Kopyala:** Aynı içerikle yeni bir görev oluşturur.
- **Sil:** Görevi siler (onay gerekebilir).

---

## 9. Canlı senkronizasyon ve “başka biri düzenliyor”

- Veriler **Supabase Realtime** ile anında güncellenir; başka bir kullanıcı veya sekme bir satırı düzenlerken o satır **sarı** arka plan ile vurgulanır.
- Bu sayede aynı satırı aynı anda düzenleme çakışmaları görsel olarak fark edilir.

---

## 10. Görevler Tablosu (üstteki demo tablo)

- Sadece **örnek veri** içerir; Supabase’e yazmaz.
- Sütun sıralama, kenardan genişletme ve başlık menüsü ile sabitleme bu tabloda da kullanılabilir.
- **Tablo genişlet** ile bu tabloyu tam ekran açabilirsiniz.

---

## 11. Yetkiler

Görebildiğiniz butonlar ve işlemler kullanıcı yetkilerinize bağlıdır:

- **Yeni görev**, **CSV içe aktar**, **Dışa aktar**, **Kolonları göster**, **İçeriğe göre ölçeklendir**, satır **Düzenle/Sil**, toplu **Seçilenleri sil** gibi işlemler yetki kontrolüne tabidir.
- Yetkiniz yoksa ilgili buton veya menü öğesi görünmez.

---

## 12. Özet akış

1. **Canlı Tablo** sayfasına girin (menü veya Dashboard butonu).
2. İsterseniz **CSV içe aktar** ile toplu görev ekleyin; sütunlar otomatik oluşur.
3. **Arama** ve **filtreler** ile listeyi daraltın.
4. Hücreye tıklayarak **satır içi düzenleme** yapın; değişiklikler canlı kaydedilir.
5. Sütun **sırasını**, **genişliğini** ve **görünürlüğünü** ihtiyacınıza göre ayarlayın.
6. **Dışa aktar** ile mevcut görünümü veya tüm veriyi CSV/Excel olarak indirin.
7. Başka biri aynı satırı düzenliyorsa sarı vurguyu görerek çakışmayı fark edin.

Bu rehber, Canlı Tablo’nun mevcut davranışını kullanıcı bakış açısıyla özetler. Teknik detaylar veya yönetici ayarları için proje dokümantasyonuna bakabilirsiniz.
