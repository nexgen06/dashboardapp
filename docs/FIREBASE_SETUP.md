# Firebase Kurulum Rehberi

Bu rehber, projede Firebase Authentication entegrasyonunun nasıl yapılandırılacağını adım adım anlatır.

## 1. Firebase projesi oluşturma

1. [Firebase Console](https://console.firebase.google.com) adresine gidin.
2. **Proje ekle** ile yeni bir proje oluşturun veya mevcut projeyi seçin.
3. İsteğe bağlı: Google Analytics ekleyebilirsiniz.

## 2. Web uygulaması kaydetme

1. Firebase Console’da **Project Settings** (dişli ikonu) > **General** sekmesi.
2. **Your apps** bölümünde **</>** (Web) ikonuna tıklayın.
3. Uygulama takma adı girin (örn. "Dashboard") ve **Register app**.
4. Gösterilen **firebaseConfig** değerlerini kopyalayın; bunları `.env.local` içinde kullanacaksınız.

## 3. Ortam değişkenleri (.env.local)

Proje kökünde `.env.local` dosyası oluşturun (veya `.env.local.example`’ı kopyalayıp düzenleyin) ve aşağıdaki değişkenleri ekleyin:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

- **Zorunlu:** `API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID` — bunlar tanımlı değilse Firebase kullanılmaz, mock kullanıcı devreye girer.
- **Opsiyonel:** `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID` — ileride Storage veya FCM kullanırsanız gerekir.

## 4. Authentication etkinleştirme

1. Firebase Console’da **Authentication** > **Sign-in method** sekmesine gidin.
2. **Email/Password** (veya Google, GitHub vb.) etkinleştirin.
3. İlk test kullanıcısı için **Users** sekmesinden **Add user** ile e-posta ve şifre ekleyebilirsiniz.

## 5. Uygulama davranışı

- **Firebase yapılandırılmamış:** Kullanıcı yoktur (`user === null`). Gerçek zamanlı test ve geliştirme için Firebase yapılandırın.
- **Firebase yapılandırılmış:** `onAuthStateChanged` ile oturum dinlenir. Giriş yapılmışsa kullanıcı bilgisi (uid, email, displayName) ve rol kullanılır; giriş yoksa `user === null` olur. Giriş sayfası (örn. `/giris`) ile oturum açılır.
- **Rol:** Kullanıcı rolü (admin, member, vb.) şu an `localStorage` içinde `dashboard-auth-role-{uid}` anahtarı ile saklanır. Yönetim sayfasından rol değiştirilebilir. İleride Firestore’da `users/{uid}` dokümanına taşınabilir.

## 6. Giriş sayfası (opsiyonel)

Firebase kullanıldığında oturum yoksa bir giriş sayfası göstermek için:

1. `app/giris/page.tsx` oluşturun.
2. `signInWithEmailAndPassword(getFirebaseAuth()!, email, password)` ile giriş yapın.
3. Layout veya middleware’de `useAuth().user === null && isFirebaseEnabled` ise `/giris`’e yönlendirin.

Giriş sayfası eklenmediyse, oturumu olmayan kullanıcılar `user === null` ile ana sayfada kalır; yetki gerektiren alanlar erişim engeli gösterebilir.

## 7. Firestore (Görevler Tablosu – canlı veri)

Canlı Tablo sayfasındaki **Görevler Tablosu** Firebase yapılandırıldığında Firestore ile canlı hale gelir.

1. Firebase Console’da **Firestore Database** > **Create database** ile veritabanını oluşturun (test veya üretim modu).
2. Uygulama `gorevler` koleksiyonunu kullanır. İlk görev eklendiğinde koleksiyon otomatik oluşur.
3. **Kurallar:** Geliştirme için test modunda `read, write: if true` kullanabilirsiniz. Üretimde sadece giriş yapmış kullanıcılara izin vermek için örnek:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /gorevler/{docId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

Firebase yapılandırılmamışsa Görevler Tablosu boş görünür; canlı veri için Firestore kurulumu gerekir.

## 8. Paket

Firebase SDK projede yüklüdür:

```bash
npm install
```

`firebase` paketi `package.json` içinde tanımlıdır; `lib/firebase.ts`, `contexts/auth-context.tsx` ve `hooks/useGorevlerFirestore.ts` Firebase’i kullanır.
