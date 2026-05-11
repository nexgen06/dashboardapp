# 🚀 Self-Hosted Deployment Rehberi

Bu rehber, Dashboard uygulamasını kendi sunucunuzda yayınlamanız için adım adım talimatlar içerir.

---

## 📋 Ön Gereksinimler

### Sunucu Gereksinimleri
- **İşletim Sistemi:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM:** Minimum 1GB (önerilen 2GB+)
- **Disk:** Minimum 10GB boş alan
- **CPU:** 1 vCPU (önerilen 2 vCPU)

### Yazılım Gereksinimleri
- Node.js 18.x veya 20.x
- npm veya yarn
- Git
- PM2 (process manager)
- Nginx (reverse proxy)

---

## 🔧 Adım 1: Sunucu Hazırlığı

### 1.1 Sistemi Güncelle
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Node.js Kur (v20.x)
```bash
# NodeSource repository ekle
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js kur
sudo apt install -y nodejs

# Versiyonu kontrol et
node -v  # v20.x.x
npm -v   # 10.x.x
```

### 1.3 PM2 Kur (Process Manager)
```bash
sudo npm install -g pm2
```

### 1.4 Nginx Kur
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 📦 Adım 2: Projeyi Sunucuya Aktar

### Seçenek A: Git ile Clone (Önerilen)
```bash
# Proje dizinine git
cd /var/www

# Repo'yu clone et
sudo git clone https://github.com/YOUR_USERNAME/dashboardapp.git
cd dashboardapp

# Sahipliği ayarla
sudo chown -R $USER:$USER /var/www/dashboardapp
```

### Seçenek B: SCP ile Kopyala
```bash
# Yerel makineden sunucuya kopyala
scp -r /Users/ugurgurses/Desktop/dashboardapp user@sunucu_ip:/var/www/
```

### Seçenek C: SFTP ile Yükle
FileZilla veya benzeri bir SFTP istemcisi kullanarak dosyaları `/var/www/dashboardapp` dizinine yükleyin.

---

## ⚙️ Adım 3: Ortam Değişkenlerini Ayarla

### 3.1 .env.local Dosyası Oluştur
```bash
cd /var/www/dashboardapp
cp .env.local.example .env.local
nano .env.local
```

### 3.2 Değişkenleri Doldur
```env
# Supabase (kılavuz için gerekli)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Opsiyonel: scripts/supabase-auth-profiles.sql ile profiles şeması
```

> **Not:** Supabase bilgilerinizi [Supabase Dashboard](https://supabase.com/dashboard) > Project Settings > API bölümünden alabilirsiniz.

---

## 🏗️ Adım 4: Uygulamayı Derle

### 4.1 Bağımlılıkları Yükle
```bash
cd /var/www/dashboardapp
npm install
```

### 4.2 Production Build Oluştur
```bash
npm run build
```

> **Not:** Build işlemi 2-5 dakika sürebilir. "Compiled successfully" mesajını görene kadar bekleyin.

---

## 🚀 Adım 5: PM2 ile Çalıştır

### 5.1 PM2 Ecosystem Dosyası Oluştur
```bash
nano ecosystem.config.js
```

İçeriği:
```javascript
module.exports = {
  apps: [{
    name: 'dashboardapp',
    script: 'npm',
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

### 5.2 Uygulamayı Başlat
```bash
pm2 start ecosystem.config.js
```

### 5.3 PM2 Durumunu Kontrol Et
```bash
pm2 status
pm2 logs dashboardapp
```

### 5.4 PM2'yi Sistem Başlangıcına Ekle
```bash
pm2 startup
pm2 save
```

---

## 🌐 Adım 6: Nginx Reverse Proxy Ayarla

### 6.1 Nginx Config Oluştur
```bash
sudo nano /etc/nginx/sites-available/dashboardapp
```

İçeriği:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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

### 6.2 Config'i Etkinleştir
```bash
sudo ln -s /etc/nginx/sites-available/dashboardapp /etc/nginx/sites-enabled/
sudo nginx -t  # Syntax kontrolü
sudo systemctl reload nginx
```

---

## 🔒 Adım 7: SSL Sertifikası (HTTPS)

### Let's Encrypt ile Ücretsiz SSL
```bash
# Certbot kur
sudo apt install -y certbot python3-certbot-nginx

# SSL sertifikası al
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Otomatik yenileme test et
sudo certbot renew --dry-run
```

---

## 🔥 Adım 8: Firewall Ayarları

```bash
# UFW kur ve etkinleştir
sudo apt install -y ufw

# Kuralları ekle
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Durumu kontrol et
sudo ufw status
```

---

## 📊 Faydalı Komutlar

### PM2 Komutları
```bash
pm2 status              # Durum görüntüle
pm2 logs dashboardapp   # Logları görüntüle
pm2 restart dashboardapp # Yeniden başlat
pm2 stop dashboardapp   # Durdur
pm2 delete dashboardapp # Sil
pm2 monit               # Canlı izleme
```

### Güncelleme Prosedürü
```bash
cd /var/www/dashboardapp
git pull origin main    # Güncellemeleri çek
npm install             # Yeni bağımlılıkları yükle
npm run build           # Yeniden derle
pm2 restart dashboardapp # Yeniden başlat
```

### Log Dosyaları
```bash
# PM2 logları
~/.pm2/logs/dashboardapp-out.log
~/.pm2/logs/dashboardapp-error.log

# Nginx logları
/var/log/nginx/access.log
/var/log/nginx/error.log
```

---

## 🐳 Alternatif: Docker ile Deployment

### Dockerfile
Proje kök dizinine `Dockerfile` oluşturun:

```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  dashboardapp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.local
    restart: unless-stopped
```

### Docker Komutları
```bash
# Build ve çalıştır
docker-compose up -d --build

# Logları görüntüle
docker-compose logs -f

# Durdur
docker-compose down
```

---

## ❓ Sorun Giderme

### Build Hatası
```bash
# Node modüllerini temizle ve yeniden yükle
rm -rf node_modules .next
npm install
npm run build
```

### Port Kullanımda Hatası
```bash
# 3000 portunu kullanan işlemi bul ve sonlandır
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Nginx 502 Bad Gateway
```bash
# PM2'nin çalıştığından emin ol
pm2 status

# Next.js'in doğru portta çalıştığını kontrol et
curl http://localhost:3000
```

### Yetki Hatası
```bash
# Dosya sahipliğini düzelt
sudo chown -R $USER:$USER /var/www/dashboardapp
chmod -R 755 /var/www/dashboardapp
```

---

## 📞 Destek

Sorun yaşarsanız:
1. PM2 loglarını kontrol edin: `pm2 logs`
2. Nginx loglarını kontrol edin: `sudo tail -f /var/log/nginx/error.log`
3. Build çıktısını inceleyin

---

**Son Güncelleme:** Ocak 2026
