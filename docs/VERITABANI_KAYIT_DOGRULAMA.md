# Veritabanı Bağlantıları ve Kayıt İşleme Doğrulaması

Uygulama ile Supabase tabloları arasındaki okuma/yazma eşlemesi kontrol edilmiştir.

---

## Yapılan düzeltme

| Dosya | Sorun | Düzeltme |
|-------|--------|----------|
| `hooks/useTasksWithRealtime.ts` → `saveTask` | Görev güncellemede **priority** alanı veritabanına gönderilmiyordu (patch'ten çıkarılıyordu). | Payload'a `priority` eklendi; görev önceliği (High/Medium/Low) güncellemede artık DB'ye yazılıyor. |

---

## tasks tablosu

| Sütun (SQL) | Okuma (mapRowToTask) | Yazma (createTask / createTasksBulk / saveTask) |
|-------------|----------------------|--------------------------------------------------|
| id | ✓ | Otomatik (uuid) |
| content | ✓ | ✓ |
| status | ✓ | ✓ |
| assignee | ✓ | ✓ |
| last_updated_by | ✓ | ✓ |
| updated_at | ✓ | Varsayılan (DB) / güncellemede gönderilmiyor |
| priority | ✓ | ✓ (create + bulk + **saveTask** düzeltildi) |
| project_id | ✓ | ✓ |
| due_date | ✓ | ✓ |
| extra_data | ✓ (jsonb → object) | ✓ |

**Sonuç:** Kayıtlar doğru işleniyor; öncelik güncellemesi hatası giderildi.

---

## projects tablosu

| Sütun (SQL) | Okuma (mapRowToProject) | Yazma (createProject / updateProject) |
|-------------|--------------------------|----------------------------------------|
| id | ✓ | Otomatik (uuid) |
| name | ✓ | ✓ |
| description | ✓ | ✓ |
| status | ✓ | ✓ |
| created_at | ✓ | Varsayılan (DB) |
| updated_at | ✓ | ✓ |
| assigned_emails | ✓ (array veya JSON string) | ✓ |
| due_date | ✓ | ✓ |
| priority | ✓ (High/Medium/Low normalizasyonu) | ✓ |

**Sonuç:** Proje kayıtları doğru işleniyor.

---

## Silme ve Realtime

- **deleteTask / deleteTasks:** `tasks` tablosunda `id` ile silme doğru.
- **deleteProject:** Önce ilgili `tasks` siliniyor, sonra proje; `project_id` FK uyumlu.
- **Realtime:** INSERT/UPDATE/DELETE payload'ları `mapRowToTask` / `mapRowToProject` ile eşleniyor; sütun adları uyumlu.

---

**Özet:** Veritabanı bağlantıları ve kayıt işleme mantığı şema ile uyumlu. Tek tespit edilen hata (görev güncellemede priority'nin gönderilmemesi) düzeltildi.
