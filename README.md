# Dashboard

Next.js 14 (App Router), TypeScript, Tailwind CSS ve Shadcn/ui ile oluşturulmuş minimal ve kurumsal bir dashboard iskeleti.

## Özellikler

- **Daralabilir Sidebar**: Sol menü daraltılıp genişletilebilir; dar modda sadece ikonlar görünür.
- **Header**: Kullanıcı profili (avatar + dropdown) ve bildirimler (badge ile sayı).
- **Ana içerik**: "Projeler" ve "Canlı Tablo" sekmeleri; örnek liste ve tablo içeriği.
- **Tasarım**: Hafif gri ve mavi tonlarında minimalist, kurumsal görünüm.
- **Supabase Realtime**: `tasks` tablosu üzerinde canlı dinleme (INSERT, UPDATE, DELETE) — değişiklikler console'a loglanır.

## Kurulum

```bash
npm install
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Test ve canlı sunucuda çalıştırma

### Lokal production (gerçek zamanlı sunucu benzeri)

```bash
npm run build
npm run start
```

Uygulama `http://localhost:3000` adresinde production modda çalışır. Supabase Realtime, `.env.local` tanımlıysa aynı şekilde çalışır.

### Canlı sunucuda test (Vercel)

1. Projeyi [Vercel](https://vercel.com) ile bağlayın (GitHub/GitLab/Bitbucket veya `vercel` CLI).
2. Vercel proje ayarlarında **Environment Variables** ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase proje URL’iniz
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon (public) key
3. Deploy edin. Realtime, canlı URL üzerinden de çalışır (Supabase’e erişim olduğu sürece).

**Not:** Supabase Dashboard’da **Database > Replication** altında `tasks` tablosunun Realtime için açık olduğundan emin olun.

### Supabase (Realtime)

1. `.env.local.example` dosyasını `.env.local` olarak kopyalayın.
2. [Supabase Dashboard](https://supabase.com/dashboard) > Project Settings > API üzerinden `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` değerlerini alıp `.env.local` içine yazın.
3. Supabase'de `tasks` tablosunu oluşturun (sütunlar: `id`, `content`, `status`, `assignee`, `last_updated_by`).
4. Projeler sekmesi için `projects` tablosunu oluşturun: SQL Editor'da `scripts/create-projects-table.sql` dosyasındaki komutları çalıştırın (sütunlar: `id`, `name`, `description`, `status`, `created_at`, `updated_at`).
5. Görev–proje bağlantısı için `tasks` tablosuna `project_id` ekleyin: SQL Editor'da `scripts/add-project-id-to-tasks.sql` dosyasını çalıştırın.
6. Son tarih (due date) için: `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date date;` (proje detayda "Son tarih" ve "Gecikmiş" vurgusu için).
7. Proje atama (kullanıcıya proje atayınca o kullanıcının projeyi görmesi) için: SQL Editor'da `scripts/add-assigned-emails-to-projects.sql` dosyasını çalıştırın. Bu script `projects` tablosuna `assigned_emails` sütununu ekler; atanmamış projeleri sadece yönetici görür.
8. Realtime için: Database > Publications > `supabase_realtime` içinde `tasks` tablosunu etkinleştirin.

### Firebase (Auth – opsiyonel)

Firebase yapılandırılmazsa uygulama **mock kullanıcı** ile çalışır (giriş yapmış gibi). Firebase tanımlıysa **Firebase Authentication** kullanılır.

1. [Firebase Console](https://console.firebase.google.com) > Proje oluştur veya seç > Project Settings > General > "Your apps" > Web (</>) ekle.
2. Config değerlerini alıp `.env.local` içine ekleyin:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (örn. `proje-id.firebaseapp.com`)
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (opsiyonel)
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (opsiyonel)
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
3. Firebase Console > Authentication > Sign-in method: **Email/Password** (veya istediğiniz sağlayıcı) etkinleştirin.
4. Uygulama açıldığında: Firebase Auth oturumu varsa o kullanıcı kullanılır; yoksa `user === null` olur (giriş sayfası eklenebilir). Kullanıcı rolü şu an `localStorage` içinde saklanır; ileride Firestore `users/{uid}` ile yönetilebilir.

Detaylı adımlar için `docs/FIREBASE_SETUP.md` dosyasına bakın.

### CSV içe aktarma (Canlı Tablo)

- **Olduğu gibi saklama:** CSV’deki **tüm sütunlar** `extra_data` (JSONB) alanında saklanır; kolon başlıkları ve hücre verileri kaybolmaz. İçerik / Durum / Atanan / Öncelik hangi CSV sütununa karşılık gelecekse siz seçersiniz; diğer sütunlar satır detayında (“CSV sütunları”) listelenir.
- **Ayırıcı:** Uygulama hem virgül (`,`) hem noktalı virgül (`;`) ile ayrılmış CSV destekler (Türkiye/Excel genelde `;` kullanır).
- **Sütun eşleme:** İçerik (zorunlu), Durum, Atanan, Öncelik için hangi CSV sütununun kullanılacağını seçin; Durum ve Atama sonradan tabloda da düzenlenebilir.
- **Detay sütunu:** Tabloda “Detay” sütununda “CSV sütunları (N)” butonu ile o satırdaki tüm CSV sütunları (sütun adı → değer) görüntülenir. Arama kutusu `extra_data` içindeki değerlerde de arar.
- **Veritabanı:** `tasks` tablosunda `extra_data jsonb DEFAULT '{}'` sütunu olmalı (scripts/create-tasks.sql veya `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS extra_data jsonb DEFAULT '{}';`).

## Yapı

- `app/` – Sayfalar ve layout (App Router)
- `components/layout/` – Sidebar, Header
- `components/ui/` – Shadcn tarzı UI bileşenleri (Button, Avatar, Tabs, Dropdown, Badge, vb.)
- `contexts/` – Sidebar açık/kapalı state (SidebarProvider)
- `lib/` – `utils.ts`, `supabaseClient.ts` (Supabase istemcisi)
- `hooks/useTasksRealtime.ts` – `tasks` tablosu Realtime aboneliği (INSERT/UPDATE/DELETE → console log)
- `types/tasks.ts` – `Task` tipi

## Projeler sayfası geliştirme önerileri (Görev Atamaları)

Projeler sekmesi şu an örnek 3 kart gösteriyor. Fonksiyonellik artırmak için aşağıdaki öneriler uygulanabilir.

### 1. Proje CRUD ve liste

- **Proje modeli:** `id`, `name`, `description`, `status` (Aktif / Tamamlandı / Beklemede), `created_at`, `updated_at`.
- **Liste:** Kart veya tablo görünümü; arama kutusu ("Projede ara"); filtre: durum, tarih aralığı.
- **Yeni proje:** "Yeni proje" butonu → modal veya sayfa: ad, açıklama, durum.
- **Düzenle / Sil:** Her proje kartında menü (⋮) ile düzenle, arşivle, sil; silme için onay modal’ı.

### 2. Görev atamaları (proje ↔ görev)

- **Projeye görev bağlama:** `tasks` tablosuna `project_id` (opsiyonel) ekleyerek görevi projeye bağlayın. Canlı Tablo’da proje sütunu veya filtre; Projeler sayfasında proje seçilince o projeye ait görevler listelensin.
- **Proje detay sayfası:** `/projeler/[id]` — proje adı, açıklama, durum; altında bu projeye atanmış görevler (mini tablo veya liste). Görev ekle / çıkar / durum güncelle.
- **Hızlı atama:** Proje kartında "X görev" badge’i; tıklanınca proje detay veya görev atama modal’ı.

### 3. Atanan kişi ve tarih

- **Atanan kişi:** Zaten `tasks.assignee` var. Proje detayda görev listesinde atanan kişi sütunu; filtre "Atayana göre"; isteğe bağlı "Bana ata" butonu (mevcut kullanıcıya toplu atama).
- **Son tarih:** `tasks` tablosuna `due_date` eklenebilir; liste ve filtrede "Tarihine göre", "Gecikmiş" vurgusu.
- **Öncelik:** Zaten var; proje görünümünde de gösterilebilir.

### 4. UX / UI

- **Görünüm seçici:** Liste (kart) / Tablo geçişi; sıralama: ada göre, tarihe göre, görev sayısına göre.
- **Boş durum:** "Henüz proje yok" + "Yeni proje" butonu; proje seçilince "Bu projede henüz görev yok" + "Görev ekle".
- **Özet satırı:** Proje kartında kısa özet: "3 tamamlandı, 2 devam ediyor, 1 yapılacak" veya ilerleme çubuğu.

### 5. Veri ve entegrasyon

- **Supabase:** `projects` tablosu (id, name, description, status, created_at, updated_at); `tasks` tablosuna `project_id` (foreign key). Realtime’ı `projects` için de açarak proje listesini canlı güncelleyebilirsiniz.
- **Canlı Tablo ile bağ:** Filtre "Projeye göre" (dropdown proje listesi); görev oluştururken/düzenlerken proje seçimi.

### 6. İleri seviye (isteğe bağlı)

- **Proje şablonları:** Yeni proje oluştururken şablon seç (ör. "Yazılım sprint", "Toplantı takibi"); şablona göre varsayılan görevler eklenir.
- **Paylaşım / roller:** Proje bazında "sahip", "üye" (sadece kendi atandığı görevler); ileride RLS veya rol alanları ile genişletilebilir.
- **Dışa aktar:** Proje detayda "Bu projenin görevlerini CSV/Excel indir".

---

**Öncelik sırası önerisi:** (1) Proje CRUD + liste + arama/filtre → (2) `projects` tablosu + `tasks.project_id` + proje detay sayfası ve görev listesi → (3) Atanan kişi / tarih filtreleri ve özet UI → (4) Canlı Tablo’da proje filtresi ve görev formunda proje seçimi.

## Teknolojiler

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Radix UI (Shadcn bileşenleri)
- Lucide React (ikonlar)
- Supabase (@supabase/supabase-js, Realtime)
