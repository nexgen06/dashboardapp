# GitHub'a Push Etme Rehberi

Projeyi ilk kez GitHub'a göndermek için aşağıdaki adımları uygulayın.

---

## Adım 1: GitHub'da repo oluşturun

1. **https://github.com** adresine gidin ve giriş yapın (hesabınız yoksa "Sign up" ile oluşturun).
2. Sağ üstte **"+"** → **"New repository"** tıklayın.
3. **Repository name:** `dashboardapp` (veya istediğiniz isim).
4. **Public** seçin.
5. **"Add a README file"** işaretlemeyin (projede zaten README var).
6. **"Create repository"** tıklayın.
7. Açılan sayfada **repo URL'sini** kopyalayın; şöyle görünür:
   - `https://github.com/KULLANICI_ADINIZ/dashboardapp.git`
   - veya `git@github.com:KULLANICI_ADINIZ/dashboardapp.git`

Bu URL'yi aşağıdaki adımda kullanacaksınız.

---

## Adım 2: Projede Git'i başlatıp push edin

Terminal’i açın (VS Code içindeki Terminal veya Mac’te Terminal uygulaması). Proje klasörüne gidip aşağıdaki komutları **sırayla** çalıştırın.

```bash
# 1. Proje klasörüne gir
cd /Users/ugurgurses/Desktop/dashboardapp

# 2. Git deposunu başlat
git init

# 3. Tüm dosyaları ekle (.gitignore'dakiler hariç; .env.local GİTMEZ)
git add .

# 4. İlk commit
git commit -m "İlk commit: dashboard uygulaması"

# 5. Ana dal adını main yap
git branch -M main

# 6. GitHub repo'yu bağla (URL'yi kendi repo adresinizle değiştirin!)
git remote add origin https://github.com/KULLANICI_ADINIZ/dashboardapp.git

# 7. GitHub'a gönder
git push -u origin main
```

**Önemli:** `KULLANICI_ADINIZ` ve `dashboardapp` kısımlarını GitHub’da oluşturduğunuz repo adresiyle değiştirin.

Örnek: GitHub kullanıcı adınız `ugurgurses` ve repo adı `dashboardapp` ise:
```bash
git remote add origin https://github.com/ugurgurses/dashboardapp.git
```

---

## İlk push sırasında giriş

- **HTTPS** kullanıyorsanız (`https://github.com/...`):
  - Kullanıcı adı: GitHub kullanıcı adınız
  - Şifre: GitHub **Personal Access Token** (artık şifre kabul edilmiyor).
  - Token oluşturmak: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**. "repo" yetkisini işaretleyin, token'ı kopyalayıp şifre yerine yapıştırın.

- **SSH** kullanıyorsanız (`git@github.com:...`):
  - Daha önce SSH key eklediyseniz ek giriş gerekmez. Hiç eklemediyseniz GitHub’ın "SSH key" dokümanına bakın.

---

## Sonraki güncellemeler (zaten push ettiyseniz)

Kod değiştikten sonra tekrar göndermek için:

```bash
cd /Users/ugurgurses/Desktop/dashboardapp
git add .
git commit -m "Yapılan değişikliğin kısa açıklaması"
git push
```

---

## .env.local GitHub'a gider mi?

**Hayır.** `.gitignore` dosyasında `.env*.local` tanımlı; bu yüzden `git add .` ile bile `.env.local` repoya eklenmez. Supabase/Firebase anahtarlarınız güvende kalır.
