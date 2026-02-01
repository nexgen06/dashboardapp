# Canlı Test İçin Ücretsiz Platformlar

Arkadaşlarınızla uygulamayı canlı test etmek için aşağıdaki ücretsiz seçenekleri kullanabilirsiniz.

---

## 1. Vercel (Önerilen)

Next.js’i yapan firma; kurulum en kolay ve ücretsiz tier cömert.

| Özellik | Ücretsiz planda |
|--------|------------------|
| Bandwidth | 100 GB/ay |
| Build | Sınırsız (kişisel projeler) |
| Domain | `*.vercel.app` (örn. dashboardapp-xxx.vercel.app) |
| Özel domain | Evet (ugurgurses.com.tr bağlanabilir) |
| Süre sınırı | Yok |

### Hızlı adımlar

1. **https://vercel.com** → “Sign Up” (GitHub ile giriş en pratik).
2. “Add New…” → **Project** → “Import Git Repository” (proje GitHub’da olmalı)  
   **veya** “Import” → bilgisayarınızdan **Vercel CLI** ile yükleyin (aşağıda).
3. **Environment Variables** ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase proje URL’iniz  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key  
   (Firebase kullanıyorsanız ilgili `NEXT_PUBLIC_FIREBASE_*` değişkenlerini de ekleyin.)
4. **Deploy** → Birkaç dakika sonra `https://dashboardapp-xxx.vercel.app` gibi bir link alırsınız. Bu linki arkadaşlarınıza gönderin.

### GitHub’da repo yoksa: Vercel CLI ile deploy

```bash
# Proje klasöründe
npm i -g vercel
vercel login
vercel
```

Sorularda Enter’a basıp varsayılanları kabul edin. Deploy bitince **Environment Variables**’ı Vercel panelinden ekleyin (Project → Settings → Environment Variables), sonra bir kez daha “Redeploy” yapın.

---

## 2. Netlify

Next.js destekler; ücretsiz tier var.

- **Site:** https://www.netlify.com  
- “Add new site” → “Import an existing project” → GitHub repo bağlayın.  
- Build command: `npm run build`  
- Publish directory: `.next` değil; Netlify Next.js’i otomatik tanır (Netlify’ın Next.js runtime’ı kullanılır).  
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ve gerekirse Firebase) ekleyin.  
- Ücretsiz planda `*.netlify.app` adresi verilir; linki arkadaşlarınızla paylaşırsınız.

---

## 3. Railway

Node/Next.js çalıştırır; ücretsiz kredi verir (aylık limit vardır).

- **Site:** https://railway.app  
- “Start a New Project” → “Deploy from GitHub repo” (repo seçin).  
- “Variables” sekmesinde `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ekleyin.  
- Deploy sonrası “Generate Domain” ile `*.railway.app` linki alırsınız.  
- Ücretsiz kredi biterse uygulama durur; canlı test için kısa süreli kullanımda uygundur.

---

## 4. Render

Ücretsiz “Web Service” ile Next.js deploy edebilirsiniz.

- **Site:** https://render.com  
- “New +” → “Web Service” → GitHub repo bağlayın.  
- Build: `npm install && npm run build`  
- Start: `npm start` (veya `npx next start`).  
- Env değişkenlerini ekleyin.  
- Ücretsiz planda `*.onrender.com` URL verilir; kullanılmayınca uykuya geçer (ilk açılış 1–2 dk sürebilir).

---

## Karşılaştırma (canlı test için)

| Platform | Kurulum | Ücretsiz link | Not |
|----------|---------|----------------|-----|
| **Vercel** | En kolay, Next.js’e özel | `*.vercel.app` | İlk tercih |
| **Netlify** | Kolay | `*.netlify.app` | İyi alternatif |
| **Railway** | Kolay | `*.railway.app` | Aylık kredi limiti |
| **Render** | Orta | `*.onrender.com` | Uyku modu |

---

## Supabase tarafı (canlı test için)

Deploy ettiğiniz adres (örn. `https://dashboardapp-xxx.vercel.app`) dışarıdan erişilebilir olacak. Supabase’te:

1. **Authentication → URL Configuration**  
2. **Redirect URLs** listesine ekleyin:  
   `https://dashboardapp-xxx.vercel.app/**`  
   (Vercel/Netlify/Railway/Render’dan aldığınız gerçek URL’i yazın.)

Böylece giriş/çıkış ve yönlendirmeler canlı ortamda düzgün çalışır.

---

## Özet

- **Hızlı ve ücretsiz canlı test:** **Vercel** ile deploy edin, çıkan `*.vercel.app` linkini arkadaşlarınızla paylaşın.  
- Supabase env değişkenlerini mutlaka ekleyin; Supabase Redirect URL’e deploy linkinizi ekleyin.  
- İsterseniz daha sonra ugurgurses.com.tr’yi Vercel’e bağlayıp aynı projeyi kendi domain’inizde de kullanabilirsiniz.
