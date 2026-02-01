# Proje Bazında Zaman ve Öncelik — Değerlendirme

## Görüş

**Proje bazında zaman (due_date) ve öncelik (priority) tanımlamak mantıklı ve faydalı.**

### Neden iyi bir fikir?

1. **Proje hedef tarihi**  
   Projeye bir “bitiş hedefi” koymak, roadmap ve raporlama için netlik sağlar. “Bu ay hangi projeler bitmeli?” sorusuna proje listesinde filtre/sıralama ile cevap verilebilir.

2. **Proje önceliği**  
   High / Medium / Low gibi proje önceliği, hangi projelere önce odaklanılacağını göstermeye yarar. Proje kartlarında veya listesinde renk/badge ile vurgulanabilir.

3. **Görevlerle ilişki**  
   - Yeni görev eklerken projenin önceliği varsayılan görev önceliği olarak kullanılabilir.  
   - Proje due_date’e göre “yaklaşan / gecikmiş proje” uyarıları verilebilir; bildirimlerle (Faz 2) entegre edilebilir.

4. **Mevcut yapıyla uyum**  
   Zaten görevlerde `due_date` ve `priority` var; projede de aynı kavramlar olunca hem kullanıcı hem geliştirme tarafı tutarlı olur.

### Dikkat edilmesi gerekenler

- **Zorunlu olmamalı:** Proje oluştururken zaman/öncelik boş bırakılabilmeli (opsiyonel alan).  
- **Sadece bilgi amaçlı:** Proje due_date projenin “hedefi”; görev due_date’ler toplu değişmez, tek tek yönetilmeye devam eder. İleride “proje tarihine göre görev uyarısı” gibi kurallar eklenebilir.

---

## Uygulama Özeti

### 1. Veri modeli (yapıldı)

- **`types/project.ts`**  
  - `due_date?: string | null` (ISO date)  
  - `priority?: ProjectPriority | null` ("High" | "Medium" | "Low")  
  - `ProjectPriority` tipi eklendi.

### 2. Veritabanı (Supabase)

`projects` tablosuna sütun eklenmeli. Hazır script: **`scripts/add-project-due-date-priority.sql`** — Supabase SQL Editor'da çalıştırın.

### 3. Hook / API

- **`hooks/useProjects.ts`**  
  - `mapRowToProject` içinde `due_date`, `priority` okunmalı.  
  - `createProject` / `updateProject` ile bu alanlar yazılmalı.

### 4. UI

- **Proje oluşturma / düzenleme formu**  
  - Opsiyonel: “Hedef tarih” (date input), “Öncelik” (High / Medium / Low dropdown).  
- **Proje listesi (kart veya tablo)**  
  - Öncelik badge’i, due_date’e göre “Yaklaşan” / “Gecikmiş” etiketi.  
- **Proje detay**  
  - Üstte proje due_date ve priority gösterimi.

### 5. Bildirimler (ileride)

- Proje due_date yaklaşırken veya geçince atanan kullanıcılara bildirim (Faz 2 bildirim altyapısı ile).

---

## Mesaj bildirimi yetkisi (yapıldı)

- **Yetki:** `notifications.send` — “Mesaj / bildirim gönderme”.  
- **Roller:** Sadece **Yönetici** ve **Proje Yöneticisi** bu yetkiye sahip.  
- **Kullanım:** Bildirim gönderme veya toplu mesaj ekranlarında `hasPermission("notifications.send")` ile buton/aksiyon gösterilir; Üye ve İzleyici bu aksiyonu görmez.

Bu doküman, proje zaman/öncelik fikrinin gerekçesini ve adım adım uygulama planını özetler.
