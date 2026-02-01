# Bildirimler: Tasarım ve Fonksiyon Önerisi

Bu belge, Canlı Tablo / Projeler uygulamasındaki bildirim sistemi için yeni tasarım ve işlev fikirlerini özetler.

---

## 1. Bildirim Türleri (Önerilen)

| Tür | Açıklama | Tetikleyici | Öncelik |
|-----|----------|-------------|---------|
| **Proje atandı** | Kullanıcıya yeni bir proje atandı | `projects.assigned_emails` içine e‑posta eklendiğinde | Yüksek |
| **Görev atandı** | Bir görev kullanıcıya atandı | `tasks.assignee` kullanıcıya set edildiğinde | Yüksek |
| **Gecikmiş görev** | Atanan görevin son tarihi geçti | `tasks.due_date < bugün` ve `assignee = ben` | Yüksek |
| **Görev yaklaşıyor** | Son tarih yarın / bu hafta | `due_date` yakın ve atanan ben | Orta |
| **Görev güncellendi** | Başkası benim atandığım bir görevi düzenledi | `tasks.last_updated_by !== ben` ve `assignee = ben` | Orta |
| **Yorum / not** | (İleride) Görev veya projede yorum | Ayrı `comments` tablosu | Orta |
| **Rol / yetki değişti** | Yönetici kullanıcının rolünü değiştirdi | Firestore `users/{uid}.roleId` güncellendiğinde | Düşük |

İlk aşamada odak: **Proje atandı**, **Görev atandı**, **Gecikmiş görev**.

---

## 2. Nerede Gösterilecek?

- **Header’da çan ikonu + rozet**
  - Tüm sayfalarda görünür.
  - Rozet: okunmamış / dikkat gerektiren bildirim sayısı (örn. toplam veya sadece “önemli”).
  - Tıklanınca: açılır panel (dropdown) veya tam sayfa “Bildirimler”.

- **Açılır panel (önerilen ilk adım)**
  - Başlık: “Bildirimler”
  - Gruplar veya liste: “Proje atandı (2)”, “Size atanan görevler (5)”, “Gecikmiş (3)”
  - Her satır: kısa metin + “Projeye git” / “Göreve git” linki
  - Altta: “Tümünü gör” → Bildirimler sayfası (ileride)

- **Ayarlardaki bildirim tercihleri**
  - Zaten var: e‑posta, push, ses.
  - İleride: “Proje atandığında bildir”, “Görev atandığında bildir”, “Gecikmiş görev uyarısı” gibi tür bazlı aç/kapa.

---

## 3. Veri Modeli Seçenekleri

### Seçenek A: Sadece mevcut veriden türet (Faz 1)

- **Yeni tablo yok.**
- Oturum açan kullanıcı için:
  - `projects` içinde `assigned_emails` kendisini içeren projeler → “Size X proje atandı”
  - `tasks` içinde `assignee = ben` → “X görev size atandı”
  - `tasks` içinde `assignee = ben` ve `due_date < bugün` → “X gecikmiş görev”
- Rozet sayısı: Bu üç kategorinin toplamı veya sadece gecikmiş + “yeni atama” mantığı.
- **Artı:** Hızlı uygulanır, altyapı değişmez.  
- **Eksi:** “Okundu” / “Yeni” ayrımı yok; her girişte aynı sayı görünür.

### Seçenek B: Bildirim kaydı tablosu (Faz 2)

- Supabase’de `notifications` tablosu:
  - `id`, `user_id` (veya `user_email`), `type`, `title`, `body`, `link` (href), `read_at`, `created_at`, `meta` (JSON).
- Olaylar olduğunda kayıt eklenir:
  - Proje atandı → `type: 'project_assigned'`, `link: /projeler/{id}`
  - Görev atandı → `type: 'task_assigned'`, `link: /canli-tablo` veya proje detay
  - Gecikmiş → günlük job veya trigger ile `type: 'task_overdue'`
- Rozet: `read_at IS NULL` sayısı.
- **Artı:** Okundu/okunmadı, “yeni” hissi, geçmiş listesi.  
- **Eksi:** Backend’de tetikleyici (trigger / Edge Function / cron) gerekir.

### Seçenek C: Hibrit

- Faz 1: Mevcut veriden sayı + özet (A).
- Faz 2: `notifications` tablosu + gerçek “bildirim” kayıtları (B). Rozet önce `notifications` okunmamış sayısından; yoksa veya boşsa A’daki özet sayısı kullanılabilir.

---

## 4. Kullanıcı Akışı (UX)

1. Kullanıcı giriş yapar.
2. Header’da çan ikonunda rozet görür (örn. “3”).
3. Çana tıklar → Açılır panel açılır.
4. Panelde:
   - “Size 2 proje atandı” → tıklanınca `/projeler`
   - “Size 5 görev atandı” → tıklanınca `/canli-tablo` (veya “Bana atanan” filtresi)
   - “3 gecikmiş görev” → tıklanınca `/canli-tablo` (gecikmiş filtresi)
5. (Faz 2) Bir satıra tıklanınca ilgili sayfaya gidilir ve bildirim “okundu” işaretlenir; rozet güncellenir.
6. (İleride) “Tümünü okundu işaretle” ve “Bildirimler” sayfası.

---

## 5. Uygulama Fazları

| Faz | İçerik | Veri |
|-----|--------|------|
| **Faz 1** | Header’da çan + rozet; açılır panelde “proje atandı / görev atandı / gecikmiş” özeti ve linkler | Mevcut `projects` + `tasks` (A) |
| **Faz 2** | `notifications` tablosu; okundu/okunmadı; gerçek “yeni bildirim” hissi | Supabase + tetikleyiciler (B) |
| **Faz 3** | E‑posta / push / ses ile bildirim gönderme; ayarlarda tür bazlı aç/kapa | Ayarlar + (opsiyonel) Edge Function / cron |

---

## 6. Örnek Metinler (TR)

- Rozet: Sadece sayı (örn. `3`).
- Panel başlık: **Bildirimler**
- Boş: **“Yeni bildirim yok”**
- Proje: **“Size 2 proje atandı”** → “Projelere git”
- Görev: **“Size 5 görev atandı”** → “Canlı Tabloya git”
- Gecikmiş: **“3 gecikmiş görev”** → “Gecikmiş görevlere git”
- (Faz 2) Tekil: **“Proje X’e atandınız”**, **“Görev Y size atandı”**, **“Görev Z gecikti”**

---

## 7. Teknik Notlar

- **Header’da veri:** Header’da Faz 1 için `useProjects` + `useTasksWithRealtime` (veya sadece sayım için hafif bir `useNotificationSummary`) kullanılabilir. Sayfa bazlı veri kullanılıyorsa aynı hook’lar tekrar çağrılabilir; Supabase cache ile tekrarlar azaltılabilir.
- **Performans:** Faz 1’de sadece `projects` ve `tasks` listesi çekilip istemcide filtrelenir. Faz 2’de `notifications` için `user_email = ? AND read_at IS NULL` ile sınırlı sorgu yeterli.
- **Erişim:** Bildirimler sadece giriş yapmış kullanıcıya; `currentUserEmail` / `user.uid` ile filtrelenir.

Bu belge, önce Faz 1 (çan + rozet + açılır özet) ile başlamak ve ardından `notifications` tablosu ile Faz 2’ye geçmek için temel alınabilir.
