# Firestore Database Kurulum Rehberi

Bu rehber, Firebase Cloud Firestore veritabanını sıfırdan nasıl kuracağınızı adım adım anlatır. Projede **Görevler Tablosu** (Canlı Tablo sayfası) Firestore ile canlı veri kullanır.

---

## Ön koşul

- Zaten bir **Firebase projesi** olmalı (Authentication için kullandığınız proje aynı olabilir).
- `.env.local` içinde Firebase yapılandırması tanımlı olmalı (`NEXT_PUBLIC_FIREBASE_*` değişkenleri).

Firebase projesi yoksa önce [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) dosyasındaki **1–3** adımlarını tamamlayın.

---

## 1. Firestore Database’i oluşturma

1. **[Firebase Console](https://console.firebase.google.com)** adresine gidin.
2. Sol menüden **Build** > **Firestore Database** seçin (veya **Firestore Database** kartına tıklayın).
3. **Create database** butonuna tıklayın.

---

## 2. Güvenlik modunu seçme

Firestore açılırken size **güvenlik modu** sorulur:

### Seçenek A: Test modu (geliştirme için)

- **Start in test mode** seçin.
- Geçici olarak tüm okuma/yazma açık olur (`read, write: if request.time < ...`).
- **Önemli:** 30 gün sonra kurallar otomatik kısıtlanır; üretim öncesi mutlaka kendi kurallarınızı yazın.

**Ne zaman kullanılır:** Sadece kendi bilgisayarınızda veya güvenli bir ortamda geliştirme yapıyorsanız.

### Seçenek B: Üretim modu (önerilen)

- **Start in production mode** seçin.
- Başlangıçta hiç kimse veri okuyup yazamaz; kuralları siz ekleyeceksiniz.
- Sonraki adımda örnek kurallar vereceğiz.

**Ne zaman kullanılır:** Gerçek kullanıcılar veya canlı ortam için.

**Next** ile devam edin.

---

## 3. Veritabanı konumunu seçme

- **Location** (konum) açılır listesinden size en yakın bölgeyi seçin (ör. `europe-west1`).
- Konum bir kez seçildikten sonra **değiştirilemez**.
- **Enable** ile veritabanı oluşturulur; birkaç saniye sürebilir.

---

## 4. Firestore kurallarını ayarlama

Veritabanı açıldıktan sonra üst sekmeden **Rules** (Kurallar) sayfasına gidin.

### Geliştirme (test) için basit kural

Herkes okuyup yazabilsin (sadece güvenli ortamda):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Publish** ile kaydedin.

### Üretim için güvenli kural (önerilen)

Sadece **giriş yapmış kullanıcılar** `gorevler` ve `users` koleksiyonlarını kullanabilsin:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /gorevler/{docId} {
      allow read, write: if request.auth != null;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

- **users:** Giriş yapan kullanıcıların profili (email, displayName, roleId) burada tutulur. Yönetici panelinden roller bu koleksiyon üzerinden güncellenir.

- `request.auth != null` → Kullanıcı Firebase Auth ile giriş yapmış olmalı.
- Başka koleksiyon ekledikçe aynı yapıda `match /koleksiyon_adi/{docId} { ... }` ekleyebilirsiniz.

**Publish** ile kaydedin.

---

## 5. Uygulama tarafında kontrol

Projede Firestore zaten kullanılıyor:

- **`lib/firebase.ts`** – `getFirestoreDb()` ile Firestore instance alınır.
- **`hooks/useGorevlerFirestore.ts`** – `gorevler` koleksiyonuna canlı abonelik (onSnapshot) ve ekleme/güncelleme/silme yapılır.

Yapmanız gerekenler:

1. `.env.local` içinde Firebase değişkenlerinin doğru olduğundan emin olun.
2. Uygulamayı çalıştırın: `npm run dev`
3. **Canlı Tablo** sayfasına gidin; **Görevler Tablosu** bölümünde:
   - **Yeni görev** ile bir görev ekleyin → Firestore’da `gorevler` koleksiyonu ve ilk doküman oluşur.
   - Başka bir sekmede veya cihazda aynı sayfayı açın → Değişiklikler anında görünür (canlı senkron).

---

## 6. Firestore’da veriyi görme

1. Firebase Console’da **Firestore Database** > **Data** sekmesine gidin.
2. **gorevler** koleksiyonunu göreceksiniz (ilk görevi ekledikten sonra).
3. Dokümanlara tıklayarak alanları (taskName, status, assigneeName, priority, updatedAt, editedBy) inceleyebilirsiniz.

---

## 7. İndeks (gerekirse)

Bu projede `gorevler` koleksiyonu **updatedAt** alanına göre sıralanıyor. Firestore tek alan sıralaması için çoğu zaman otomatik indeks kullanır. Hata alırsanız Console’da çıkan **Create index** linkine tıklayıp indeksi oluşturun.

---

## Özet kontrol listesi

| Adım | Yapıldı mı? |
|------|-------------|
| Firebase projesi var | ☐ |
| Firestore Database oluşturuldu | ☐ |
| Konum seçildi | ☐ |
| Rules yazıldı ve Publish edildi | ☐ |
| .env.local’de Firebase değişkenleri tanımlı | ☐ |
| Canlı Tablo’da “Yeni görev” ile test edildi | ☐ |

Bu adımları tamamladıysanız Firestore kurulumunuz hazırdır; Görevler Tablosu canlı veri ile çalışır.
