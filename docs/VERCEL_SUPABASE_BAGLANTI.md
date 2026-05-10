# Vercel + Supabase Bağlantı Kontrol Listesi

Veritabanı bağlantısı kurulamıyorsa aşağıdakileri tek tek kontrol edin.

---

## 1. Ortam değişkenleri (Vercel)

Vercel → Projeniz → **Settings** → **Environment Variables**

| Key (tam olarak böyle yazın) | Value |
|-----------------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` (kendi proje URL’iniz) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` (anon public key) |

- **Yazım:** Tamamen büyük harf, alt çizgi `_`. Boşluk veya ek karakter olmasın.
- **Value:** Başında/sonunda boşluk olmasın. Supabase Dashboard → Project Settings → API’den kopyalayın.

---

## 2. Redeploy zorunlu

Next.js’te `NEXT_PUBLIC_*` değişkenleri **build sırasında** projeye gömülür. Yani:

1. Environment Variables’ı ekledikten **sonra**
2. **Deployments** → son deployment → **⋮** → **Redeploy** yapmalısınız.

Sadece kaydetmek yetmez; yeni bir build alınmalı.

---

## 3. Supabase tarafı

- **Dashboard:** https://supabase.com/dashboard → projenizi seçin.
- **Project Settings** → **API:**
  - **Project URL** → bunu `NEXT_PUBLIC_SUPABASE_URL` olarak kullanın.
  - **Project API keys** → **anon** / **public** key → bunu `NEXT_PUBLIC_SUPABASE_ANON_KEY` olarak kullanın.
- Proje **paused** (duraklatılmış) olmasın. Uzun süre kullanılmayan ücretsiz projeler pause olur; Dashboard’da **Restore project** ile açın.

---

## 4. Tarayıcıda kontrol

Redeploy bittikten sonra:

1. Vercel’deki siteyi açın (Visit / production URL).
2. **F12** → **Console** sekmesi.
3. `[Supabase] NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı` mesajı **görünüyorsa** env’ler hâlâ boş veya yanlış; Key isimlerini ve Redeploy’u tekrar kontrol edin.
4. Bu mesaj **yoksa** env’ler yüklenmiş demektir; bağlantı sorunu Supabase projesi, RLS veya tablolarla ilgili olabilir.

---

## 5. Sık hatalar

| Sorun | Çözüm |
|--------|--------|
| Key yanlış yazılmış | `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` tam böyle olmalı. |
| Redeploy yapılmadı | Deployments → Redeploy yapın. |
| Supabase proje pause | Dashboard’da Restore project. |
| URL’de https yok | Value `https://` ile başlamalı. |
| Anon key kısaltılmış | Tüm key’i kopyalayın (çok uzun bir metin). |

---

Bu adımları uyguladıktan sonra hâlâ bağlanamıyorsanız: Vercel’deki **Key** isimlerini (ekran görüntüsü veya kopyala-yapıştır) ve “Redeploy yaptım / yapmadım” bilgisini yazın; bir sonraki adımı buna göre netleştirebiliriz.
