# ugurgurses.com.tr Sunucuya Taşıma Rehberi

Bu rehber, dashboard uygulamasını **ugurgurses.com.tr** domain’inize bağlı kendi sunucunuza taşımanız için adım adım yol haritasıdır.

---

## 0. hosting.com.tr Kullanıyorsanız

**hosting.com.tr** üzerinden hizmet alıyorsanız önce paket türünüzü netleştirin:

| hosting.com.tr’de ne var? | Next.js için ne yapmalı? |
|---------------------------|---------------------------|
| **Sadece paylaşımlı hosting** (cPanel, Plesk, PHP, statik site) | Bu tür paketlerde **Node.js çalışmaz**. İki yolunuz var: **(A)** Destek ekibine “Node.js veya VPS paketiniz var mı?” diye sorun; **(B)** Uygulamayı başka yerde çalıştırıp domain’i oraya yönlendirin (aşağıda). |
| **VPS paketi** | Sunucu tam sizin; **Bölüm 2–7** adımlarını uygulayın (Node, Nginx, PM2, SSL). |
| **Node.js destekli paket** (panelde “Node.js uygulaması” seçeneği varsa) | Hosting dokümanında “Node uygulaması ekleme” adımlarını takip edin; build komutu: `npm run build`, start: `npm start` veya `node server.js` (standalone kullanıyorsanız). |

**Paylaşımlı hosting’deyseniz ve Node.js yoksa:**

1. **hosting.com.tr destek** (ticket/telefon): “Next.js veya Node.js uygulaması yayınlayabilir miyim? VPS paketiniz var mı?” diye sorun.
2. **Domain’i başka yerde kullanmak:** Uygulamayı **Vercel** veya **Railway** gibi bir yerde ücretsiz/ucuz yayınlayıp ugurgurses.com.tr’yi oraya yönlendirebilirsiniz (DNS’te A/CNAME). Veritabanı zaten Supabase’te olduğu için sadece uygulama sunucusu başka yerde çalışır.
3. **Ek bir VPS almak:** hosting.com.tr’de VPS yoksa DigitalOcean, Hetzner, Contabo, Natro VPS vb. küçük bir VPS alıp ugurgurses.com.tr’nin DNS’ini bu VPS’in IP’sine yönlendirirsiniz; kurulum **Bölüm 2–7** ile aynıdır.

**Özet:** hosting.com.tr = paylaşımlı ise Node.js için ya onlardan VPS/Node desteği isteyin ya da uygulamayı Vercel/VPS’e taşıyıp domain’i oraya verin.

---

## 1. Hosting Türünüzü Belirleyin

Next.js uygulaması **Node.js** ortamında çalışır. Bu yüzden:

| Hosting türü | Uygun mu? | Ne yapmalı? |
|--------------|-----------|-------------|
| **Paylaşımlı hosting** (cPanel, Plesk, sadece PHP) | ❌ Genelde hayır | Node.js destekli bir pakete geçin veya VPS kullanın. |
| **Node.js destekli hosting** | ✅ Evet | Hosting panelinden Node uygulaması ekleyip build/start komutlarını kullanın. |
| **VPS / Cloud sunucu** (hosting.com.tr VPS, DigitalOcean, Hetzner, vb.) | ✅ Evet (önerilen) | Aşağıdaki “VPS üzerinde kurulum” adımlarını uygulayın. |

- **VPS’iniz varsa** (hosting.com.tr veya başka firma) → **Bölüm 2–7** sizin için.  
- **Sadece paylaşımlı hosting varsa** → Yukarıdaki **Bölüm 0** seçeneklerinden birini uygulayın.

---

## 2. VPS Üzerinde Kurulum (Özet)

Detaylı komutlar için projedeki **[DEPLOYMENT.md](./DEPLOYMENT.md)** dosyasına bakın. Burada ugurgurses.com.tr için özelleştirilmiş özet var.

### 2.1 Sunucu Gereksinimleri
- **OS:** Ubuntu 22.04 LTS (veya 20.04+)
- **RAM:** En az 1 GB (2 GB önerilir)
- **Node.js:** 18.x veya 20.x

### 2.2 Sunucuya Bağlanın
```bash
ssh kullanici@SUNUCU_IP
# Örnek: ssh root@95.70.xxx.xxx
```

### 2.3 Temel Yazılımları Kurun
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```

---

## 3. Domain (ugurgurses.com.tr) DNS Ayarları

Hosting/Domain panelinizde (Natro, Turhost, Cloudflare vb.) şu kayıtları ekleyin veya güncelleyin:

| Tür  | Ad / Host | Değer        | TTL (isteğe bağlı) |
|------|-----------|-------------|--------------------|
| **A**   | `@`       | `SUNUCU_IP` | 300 veya 3600      |
| **A**   | `www`     | `SUNUCU_IP` | 300 veya 3600      |

- **SUNUCU_IP:** VPS’inizin public IP adresi.  
- Değişikliğin yayılması 5–30 dakika sürebilir. Kontrol: `ping ugurgurses.com.tr`

---

## 4. Projeyi Sunucuya Almak

### Seçenek A: Git ile (önerilen)
Sunucuda:
```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/KULLANICI_ADINIZ/dashboardapp.git
sudo chown -R $USER:$USER /var/www/dashboardapp
cd /var/www/dashboardapp
```

### Seçenek B: Bilgisayarınızdan SCP ile
Kendi bilgisayarınızda (Terminal):
```bash
cd /Users/ugurgurses/Desktop
scp -r dashboardapp kullanici@SUNUCU_IP:/var/www/
```

Sunucuda:
```bash
cd /var/www/dashboardapp
```

---

## 5. Ortam Değişkenleri (.env.local)

Sunucuda proje dizininde:
```bash
cd /var/www/dashboardapp
cp .env.local.example .env.local
nano .env.local
```

**Mutlaka doldurulacak (Supabase):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

Firebase kullanıyorsanız ilgili `NEXT_PUBLIC_FIREBASE_*` satırlarını da ekleyin.  
Kaydet: `Ctrl+O`, Enter, `Ctrl+X`.

---

## 6. Derleme ve Çalıştırma

```bash
cd /var/www/dashboardapp
npm install
npm run build
```

Build başarılı olduktan sonra PM2 ile başlatın:

```bash
# ecosystem.config.js oluştur
nano ecosystem.config.js
```

İçeriği:
```javascript
module.exports = {
  apps: [{
    name: 'dashboardapp',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/var/www/dashboardapp',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # Açılışta otomatik başlasın (komutu çıktıda verilen şekilde çalıştırın)
```

Kontrol:
```bash
curl http://localhost:3000
```
Sayfa içeriği geliyorsa Next.js çalışıyor demektir.

---

## 7. Nginx + ugurgurses.com.tr + HTTPS

### 7.1 Nginx site config
```bash
sudo nano /etc/nginx/sites-available/dashboardapp
```

İçerik (**ugurgurses.com.tr** ile):
```nginx
server {
    listen 80;
    server_name ugurgurses.com.tr www.ugurgurses.com.tr;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Etkinleştirip test edin:
```bash
sudo ln -sf /etc/nginx/sites-available/dashboardapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Tarayıcıda `http://ugurgurses.com.tr` açılmalı.

### 7.2 HTTPS (Let’s Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ugurgurses.com.tr -d www.ugurgurses.com.tr
```

E-posta girin, şartları kabul edin. Certbot Nginx’i otomatik günceller.  
Son kontrol:
```bash
sudo certbot renew --dry-run
```

Artık **https://ugurgurses.com.tr** kullanılabilir olmalı.

---

## 8. Supabase Tarafında Domain (Opsiyonel)

Supabase ile giriş (Auth) kullanıyorsanız, Supabase Dashboard’da:

1. **Authentication → URL Configuration**
2. **Site URL:** `https://ugurgurses.com.tr`
3. **Redirect URLs** listesine ekleyin: `https://ugurgurses.com.tr/**`, `https://www.ugurgurses.com.tr/**`

Böylece giriş sonrası yönlendirme doğru domain’e gider.

---

## 9. Hızlı Kontrol Listesi

- [ ] VPS / Node destekli hosting hazır
- [ ] DNS: `ugurgurses.com.tr` ve `www` → sunucu IP’ye yönlendirildi
- [ ] Proje sunucuda `/var/www/dashboardapp` (veya seçtiğiniz dizin)
- [ ] `.env.local` içinde Supabase (ve gerekirse Firebase) değişkenleri tanımlı
- [ ] `npm run build` hatasız bitti
- [ ] PM2 ile `dashboardapp` çalışıyor (`pm2 status`)
- [ ] Nginx config’te `server_name ugurgurses.com.tr www.ugurgurses.com.tr`
- [ ] HTTPS sertifikası alındı (`certbot --nginx`)
- [ ] Supabase redirect URL’lerine production domain eklendi (Auth kullanıyorsanız)

---

## 10. Güncelleme (Kod Değişikliği Sonrası)

```bash
cd /var/www/dashboardapp
git pull origin main   # veya kullandığınız branch
npm install
npm run build
pm2 restart dashboardapp
```

---

## 11. Sorun Giderme

| Sorun | Kontrol |
|-------|--------|
| Site açılmıyor | `pm2 status`, `curl http://localhost:3000`, DNS’in yayıldığını `ping ugurgurses.com.tr` ile kontrol edin. |
| 502 Bad Gateway | Nginx’in `proxy_pass http://localhost:3000` yaptığından ve PM2’nin çalıştığından emin olun. |
| Giriş yönlendirmesi bozuk | Supabase Redirect URLs’e `https://ugurgurses.com.tr/**` ekleyin. |
| Build hatası | `rm -rf node_modules .next && npm install && npm run build` deneyin. |

Daha fazla detay için **[DEPLOYMENT.md](./DEPLOYMENT.md)** dosyasındaki “Sorun Giderme” bölümüne bakın.

---

**Özet:** Domain’inizi sunucu IP’ye yönlendirdikten sonra projeyi sunucuya alıp, `.env.local` ile derleyip PM2 ile çalıştırıyor, Nginx + Certbot ile ugurgurses.com.tr üzerinden HTTPS veriyorsunuz. Takıldığınız adımı (DNS, Nginx, PM2, Supabase vb.) yazarsanız o adımı birlikte netleştirebiliriz.
