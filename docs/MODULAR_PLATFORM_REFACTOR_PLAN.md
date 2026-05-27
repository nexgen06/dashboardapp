# Modüler Kurumsal Platform — Refactor Planı

> **Statü**: Aşama 1 (Analiz) tamamlandı, Aşama 2+ planı hazır.
> **Kural**: Hiçbir kod değişikliği yapılmadan plan onaylanmadan başlanmaz.
> **Hedef**: Mevcut "canlı tablo" uygulamasını **Finans / Hukuk / Personel / Ulaştırma / Satın Alma / Evrak / Arşiv** modüllerini destekleyen kurumsal platform haline getirmek.

---

## BÖLÜM 1 — Mevcut Sistem Analiz Raporu

### Veritabanı (33 tablo)

**Çekirdek**:
- `auth.users` + `profiles` (role_id, display_name, avatar_url)
- `projects` (18 kolon, workflow_enabled, lock_on_approval, archived_at, vs.)
- `tasks` (extra_data JSON ile dinamik kolonlar, workflow_status, vs.)
- `project_member_permissions` (per-project role granular)
- `project_columns` (zaten dinamik sütun metadata — type/config)

**İletişim & Bildirim**:
- `notifications` (merkezi, source_key unique, 8 tip)
- `announcements` + `announcement_reads`
- `admin_alerts` + `admin_alert_reads`
- `task_comments`
- `project_chat_messages` + `project_chat_reads`
- `email_notification_settings`

**İş Süreci**:
- `task_workflow_events` (audit izi)
- `task_automation_state` (renk/kilit)
- `automation_rules` + `automation_actions` + `automation_logs`
- `chip_templates` + `chip_options` + `table_chip_bindings` + `row_chip_values`
- `reference_sources` (CSV/JSON kataloğu)

**Güvenlik & Audit**:
- `audit_log`
- `pii_access_log` (TCKN/sicil görüntüleme)
- `presence_heartbeats`

**Diğer**:
- `task_files`, `project_templates`, `saved_views`, `report_templates`, `feedback`, `app_settings`

### RLS Politikaları (~114 adet)
Tüm tablolarda RLS aktif. Çekirdek desen:
- `*_select_visible` — proje üyesi veya admin
- `*_insert/update_staff` — admin/PM yetkisiyle
- `*_delete_admin` — sadece admin
- Özel: `tasks_no_update_when_locked` (RESTRICTIVE), `tasks_update_workflow_reviewer`

### RPC Fonksiyonları (16 public)
- `upsert_my_notifications`, `create_workflow_notification`, `create_automation_notification`
- `project_lock_on_approval`, `task_is_locked_for_current_user`, `user_is_project_workflow_reviewer`
- 6 adet `touch_*_updated_at` trigger fonksiyonu
- 2 adet `notifications_after_*_insert` (announcement, admin_alert)

### API Routes (6 adet)
- `/api/admin/invite` (kullanıcı davet)
- `/api/avatar/upload`
- `/api/image-proxy`
- `/api/notify/mention`
- `/api/send-email/announcement-new`
- `/api/system/build-info`

(Server Actions yok — tüm yazma işlemleri RPC/REST üzerinden.)

### Frontend Sayfaları (24 page.tsx)
Kullanıcı: `/`, `/giris`, `/profil`, `/projeler`, `/projeler/[id]`, `/gorevlerim`, `/canli-tablo`, `/mesajlar`, `/bildirimler`, `/raporlar`, `/ayarlar`, `/geri-bildirim`, `/sifre-sifirla`

Yönetim: 11 alt sayfa (`/yonetim/*`) — kurumsal admin, kullanıcı yetkileri, otomasyon, çip, referans, rapor şablonları, duyurular, e-posta, istatistik, geri bildirimler, PII access

### Büyük Bileşenler
| Bileşen | Satır | Amaç |
|---|---|---|
| **TasksTable.tsx** | 8648 | Tablo + tüm görünüm yönetimi (kritik monolit) |
| **ProjectsSection.tsx** | 3446 | Proje CRUD + üye + import |
| **DashboardSection.tsx** | 992 | Ana sayfa widget orkestrasyon |
| **TaskDetailSheet.tsx** | 775 | Detay panel (yorum, dosya, workflow) |
| **GorevOzeti.tsx** | 666 | Görev özet widget |
| **TasksKanban / Gantt / Calendar / Risk** | 393–634 | Alternatif görünümler |

### Context'ler
- `auth-context` (hasPermission)
- `notification-context`
- `settings-context`
- `sidebar-context`
- `profile-lookup-context`
- `project-chat-unread-context`

### Realtime
- `tasks`, `projects`, `admin_alerts` publication'da
- `useTasksWithRealtime` — anlık satır sync
- `useProjectChatRoom`, `usePresence`

### Permissions
- `lib/permissions.ts` — area.*/projects.*/liveTable.*/chipTemplates.*/automation.*/reports.*/piiAccess.* enum'u
- UI: `usePermissionGate`, `PermissionGate`, `RestrictedButton`
- DB: RLS

### Sensitive Data
- `lib/extraColumnSensitiveDisplay` — TCKN/sicil/personel no regex match, "•••" maskeleme
- `lib/piiAccessLog` — kopya/unmask/export izlenir
- `liveTable.exportSensitiveUnmasked` permission gate'i

---

## BÖLÜM 2 — Eksik / Riskli Alanlar

| Alan | Durum | Risk |
|---|---|---|
| **Modüler izolasyon** | YOK — tek "Canlı Tablo" tüm görevleri gösterir | Modüller arası karışıklık |
| **Çip / Otomasyon / Workflow merkezi** | "Module-like" ama merkezi plugin sistemi yok | Yeni modül eklemek zor |
| **Alan tipleri** | extra_data string-only (text/select chip-bound) | currency/relation/formula/encrypted yok |
| **Şifreli alan** | YOK — sadece UI maskeleme | DB'de TCKN açık tutuluyor (RLS koruması var ama Supabase admin görebilir) |
| **Hash-based search** | YOK | Maskeli alanda arama imkânsız |
| **Kolon bazlı yetki** | YOK — sadece satır seviyesi | Hassas kolon herkese görünür |
| **Field-level audit** | YOK — sadece tablo seviyesi | Hangi alan değişti bilinmez |
| **TasksTable monolit** | 8648 satır tek dosya | Modülerleştirmek zor |
| **Module Builder UI** | YOK | Admin yeni modül oluşturamaz |
| **Scheduled trigger** | UI'da var ama altyapı yok | pg_cron veya Edge Function gerek |
| **API rate limit** | YOK | DoS riski |
| **Audit log şişme** | Periyodik temizlik yok | Tablo büyür, performans düşer |
| **Realtime ölçek** | ~3 tablo subscribe; binlerce satırda test yok | Yük testi gerek |
| **Dosya yetki** | task_files tablosu var ama detaylı RLS yok | Cross-project erişim mümkün olabilir |
| **Hassas veri export** | Yetki var ama mask kuralları config'de değil | Sabit kodlu |

---

## BÖLÜM 3 — Modüler Mimari Önerisi

### Üç Katmanlı Yapı

```
┌─────────────────────────────────────────────────────────────┐
│  MODULE LAYER (Plugin-style)                                │
│  HR · Legal · Finance · Transport · Procurement · Archive   │
│  Document Tracking · [Custom modules...]                    │
└─────────────────────────────────────────────────────────────┘
                          ▼ kullanır
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM SERVICES (Genişletilebilir)                       │
│  Field Types · View Types · Workflow Engine · Automation    │
│  Permission Engine · Sensitive Data · Module Builder        │
│  Template Registry · Dashboard Engine                       │
└─────────────────────────────────────────────────────────────┘
                          ▼ üzerinde durur
┌─────────────────────────────────────────────────────────────┐
│  CORE (Değişmez çekirdek)                                   │
│  Auth · Users · Roles · Records · Comments · Files          │
│  Notifications · Audit Log · Realtime · Search              │
└─────────────────────────────────────────────────────────────┘
```

### Yeni Üst Kavramlar

| Kavram | Mevcut Karşılığı | Yeni Yapı |
|---|---|---|
| **Module** | (yok) | `modules` tablosu — Hukuk, Finans vb. her biri ayrı |
| **Module Instance** | `projects` | `projects.module_id` ile modüle bağlı |
| **Record** | `tasks` | Genel "kayıt" — Hukuk için Dosya, Finans için Talep |
| **Field** | `project_columns` | Genişletilmiş — `module_field_templates` |
| **Field Value** | `tasks.extra_data` | Tipli ayrı tablo opsiyonu (büyük modüller için) |
| **Workflow** | `tasks.workflow_status` (5 sabit değer) | `module_workflows` — n adımlı, modüle özel |
| **Dashboard Card** | (hardcoded widgets) | `module_dashboards` — modüle özel KPI |
| **Sensitive Field** | regex-based detect | `field_security_rules` — config-driven |
| **View** | `saved_views` | Genişletilmiş — module-aware preset'ler |

---

## BÖLÜM 4 — Supabase Tablo Tasarımı (Yeni)

### Yeni Tablolar

```sql
-- 1) Modül tanımları
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- 'hr', 'legal', 'finance', 'transport'
  name text not null,                  -- 'Personel Takip'
  description text,
  icon text,                           -- lucide icon name
  color text,                          -- tailwind tone
  enabled boolean not null default true,
  is_system boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 2) Modüle proje bağı (mevcut projects.module_id ile)
alter table public.projects add column if not exists module_id uuid references public.modules(id);

-- 3) Modül alan şablonları (Module Builder çıktısı)
create table public.module_field_templates (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  key text not null,                  -- 'mahkeme', 'durusma_tarihi'
  label text not null,
  field_type text not null,           -- 'text', 'currency', 'encrypted_text', 'relation', ...
  config jsonb not null default '{}', -- {options, format, references...}
  required boolean default false,
  is_sensitive boolean default false,
  encryption_strategy text,           -- null | 'aes' | 'hash_for_search'
  sort_order int default 0,
  unique (module_id, key)
);

-- 4) Modül workflow tanımları
create table public.module_workflows (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  name text not null,
  is_default boolean default false
);

create table public.module_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.module_workflows(id) on delete cascade,
  code text not null,                 -- 'draft', 'in_review', 'approved'
  label text not null,
  sort_order int not null,
  is_terminal boolean default false,
  required_role text,                 -- bu adıma kim geçirebilir
  allowed_transitions text[],         -- [step_code,...]
  unique (workflow_id, code)
);

-- 5) Görev/kayıt workflow durumu (mevcut workflow_status'tan genişletilmiş)
alter table public.tasks add column if not exists workflow_id uuid references public.module_workflows(id);
alter table public.tasks add column if not exists workflow_step_code text;

-- 6) Modül dashboard kartları
create table public.module_dashboard_cards (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  code text not null,                 -- 'open_cases', 'overdue_payments'
  title text not null,
  query_kind text not null,           -- 'count' | 'sum' | 'avg' | 'list'
  query_config jsonb not null,        -- {field, filter, where...}
  icon text,
  color text,
  sort_order int default 0
);

-- 7) Hassas veri kuralları (config-driven)
create table public.field_security_rules (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade,
  field_key text not null,            -- 'tckn', 'sicil_no', 'iban'
  mask_pattern text not null,         -- '••• ••• ••01'
  unmask_required_permission text,    -- 'piiAccess.unmask.hr'
  copy_required_permission text,
  export_strategy text default 'mask', -- 'mask' | 'omit' | 'unmask_with_permission'
  audit_required boolean default true
);

-- 8) Kolon bazlı yetki (yeni)
create table public.field_access_rules (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id),
  field_key text not null,
  role_id text not null,
  can_view boolean default true,
  can_edit boolean default false
);

-- 9) Şifreli alan değerleri (TCKN vs. için ayrı tablo)
create table public.encrypted_field_values (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  field_key text not null,
  ciphertext text not null,           -- pgcrypto ile şifreli
  search_hash text,                   -- sha256(value) for exact-match search
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (task_id, field_key)
);

-- 10) Modül şablonları (Hukuk Dosya Takip vs.)
create table public.module_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  preview_image text,
  bundle jsonb not null,              -- {fields, workflow, dashboards, automations, permissions}
  is_official boolean default false
);
```

### Mevcut Tablolarda Değişiklik (Backward Compatible)
- `projects.module_id` — yeni kolon, NULL = "Eski projeler" (varsayılan general module ile ilişkilendirilir)
- `tasks.workflow_id` + `tasks.workflow_step_code` — eski `workflow_status` kolonu korunur, sync edilir

---

## BÖLÜM 5 — RLS Politikası Önerileri

### Yeni Politikalar

```sql
-- Modül erişimi: tüm authenticated, module enable kontrolü trigger ile
create policy modules_select_authenticated on public.modules
  for select to authenticated using (enabled = true or is_app_admin());

-- Module field templates: select herkese, write sadece module admin
create policy module_field_templates_select on public.module_field_templates
  for select to authenticated using (true);

create policy module_field_templates_write_admin on public.module_field_templates
  for all to authenticated
  using (is_app_admin() or user_is_module_admin(module_id))
  with check (is_app_admin() or user_is_module_admin(module_id));

-- Encrypted field values: explicit decrypt RPC üzerinden
-- DOĞRUDAN SELECT YASAK — sadece pgcrypto fonksiyonuyla
revoke select on public.encrypted_field_values from authenticated;

create policy encrypted_insert on public.encrypted_field_values
  for insert to authenticated with check (
    task_is_editable_for_current_user(/* via task_id lookup */)
  );

-- Kolon bazlı yetki: tasks SELECT'i her zaman olsun, ama field-level masking
-- application layer'da uygulanır (RPC: get_task_with_field_masking)
```

### Yeni Yardımcı Fonksiyonlar

```sql
-- Şifreli alan yazma (sadece yetkili)
create function public.set_encrypted_field(
  p_task_id uuid,
  p_field_key text,
  p_plaintext text
) returns void security definer ...

-- Şifreli alan okuma (yetkili + audit log)
create function public.get_encrypted_field(
  p_task_id uuid,
  p_field_key text
) returns text security definer ...
-- içerisinde pii_access_log insert

-- Hash ile arama
create function public.search_encrypted_field(
  p_field_key text,
  p_query text
) returns table(task_id uuid) ...
-- sha256(query) ile search_hash kolonunu eşleştir

-- Module admin check
create function public.user_is_module_admin(p_module_id uuid)
returns boolean security definer ...
```

---

## BÖLÜM 6 — Frontend Component Mimarisi

### Yeni Klasör Yapısı

```
app/
  modules/[moduleCode]/
    page.tsx                    # Dynamic module landing (records list)
    settings/page.tsx           # Module settings (fields, workflow, dashboards)
    records/[recordId]/page.tsx # Record detail
  module-builder/
    page.tsx                    # Yeni modül oluştur wizard

components/
  modules/
    ModuleRouter.tsx            # Module code → render
    ModuleHeader.tsx            # Module-specific top bar
    ModuleDashboard.tsx         # Dashboard kartları
    ModuleRecordTable.tsx       # Refactored from TasksTable (module-aware)
    ModuleSettings.tsx          # Field/workflow yönetimi
  fields/
    FieldRenderer.tsx           # Field type → component dispatcher
    types/
      TextField.tsx
      CurrencyField.tsx
      EncryptedField.tsx        # Masked + unmask button
      RelationField.tsx
      FormulaField.tsx
      ...
  workflow/
    WorkflowDesigner.tsx        # Visual step builder
    WorkflowProgress.tsx        # Mevcut + step-aware

lib/
  modules/
    moduleRegistry.ts           # Module metadata cache
    moduleTemplates.ts          # Built-in templates
    moduleBuilder.ts            # Template → DB seed
  fields/
    fieldTypes.ts               # Type definitions
    fieldEncryption.ts          # AES helpers (server-side only)
  workflow/
    workflowEngine.ts           # Step transitions
```

### TasksTable.tsx Refactor (8648 → 3 parça)
- `RecordTable.tsx` — generic kayıt tablosu (~2000)
- `RecordTableToolbar.tsx` — filtre/arama/export (~1500)
- `RecordCellRenderer.tsx` — hücre tipine göre render (~1000)
- Modül-spesifik mantık `modules/*/` altına

### Yeni Context'ler
- `module-context.tsx` — aktif modül (code, fields, workflow, permissions)
- `field-renderer-context.tsx` — özel alan tipi kayıtları (third-party plugin için)

---

## BÖLÜM 7 — Backend/API Mimarisi

### Yeni RPC'ler
- `module_get_record(p_module_code, p_record_id)` — yetki + maskeleme uygulanmış
- `module_search_records(p_module_code, p_query, p_filters)` — full-text + encrypted hash
- `module_apply_template(p_template_code, p_module_id)` — şablon yükle
- `workflow_transition(p_task_id, p_target_step, p_note)` — adım geçişi
- `audit_log_compact(p_older_than_days)` — periyodik temizlik

### Yeni API Routes
- `POST /api/modules/[code]/import` — modül-spesifik CSV/Excel import
- `GET /api/modules/[code]/export` — masking kurallarıyla export
- `POST /api/admin/seed-template` — yeni modül şablonu yükle

---

## BÖLÜM 8 — Migration Planı

### Faz Faz Geçiş (3 ay tahmini, 12 sprint)

| Sprint | İçerik | Risk |
|---|---|---|
| **S1** | `modules` tablosu, "general" default modül, `projects.module_id` (NULL=general) | Düşük — eski projeler etkilenmez |
| **S2** | `module_field_templates` + UI okuma; mevcut `project_columns` adapter | Düşük |
| **S3** | `module_workflows` + adapter (`tasks.workflow_status` → `workflow_step_code` sync) | Orta — workflow var mevcut |
| **S4** | `field_security_rules` + mevcut maskelemeyi config'e taşı | Düşük |
| **S5** | `encrypted_field_values` + pgcrypto kurulumu + RPC | Orta — yeni güvenlik katmanı |
| **S6** | Hash-based search + UI | Düşük |
| **S7** | TasksTable refactor (3 parçaya böl, generic record tablosu) | YÜKSEK — büyük refactor, tüm view'ları etkiler |
| **S8** | Module Builder UI | Orta |
| **S9** | Template Registry + 7 hazır şablon (HR, Legal, Finance, Transport, Procurement, Archive, Document) | Orta |
| **S10** | Module-aware dashboard + view types | Orta |
| **S11** | Column-level permissions | Düşük |
| **S12** | Audit compaction, performance test, rate limit | Düşük |

### Geriye Uyum Stratejisi
- **Eski URL'ler korunur**: `/canli-tablo`, `/projeler` çalışmaya devam — internal olarak "general module" yönlendirmesi
- **Eski tablolar dropvedilmez**: `tasks`, `projects` aynı, sadece yeni kolonlar
- **Adapter katman**: `project_columns` → `module_field_templates` view ile aynı görünür
- **Feature flag**: `app_settings.feature_modules = true` ile yeni UI açılır/kapanır

---

## BÖLÜM 9 — Modül Şablonları (7 hazır)

### 1. HR / Personel
- **Alanlar**: Sicil No (encrypted), TCKN (encrypted), Ad Soyad, Birim, İşlem Türü (select), Talep Tarihi (date), Süreç Durumu (workflow), Termin (date), Belgeler (file[])
- **Workflow**: Talep Geldi → İncelemede → Eksik Evrak → Onayda → Tamamlandı / Reddedildi
- **Dashboard**: Açık işlem, Geciken süreç, Birim bazlı iş yükü, Aylık trend
- **Roller**: HR Admin, Birim Sorumlusu, Personel

### 2. Legal / Hukuk
- **Alanlar**: Dosya No, Mahkeme (select), Duruşma Tarihi (date), Taraf (text), Avukat (person), Son İşlem (long_text), Kritik Süre (date), Dosya Belgeleri (file[])
- **Workflow**: Dosya Açıldı → İncelemede → Savunma Hazırlanıyor → Duruşma Bekleniyor → Sonuçlandı → Arşiv
- **Dashboard**: Açık dava, Yaklaşan duruşmalar, Kritik süreler (7 gün), Aylık kapanan
- **Roller**: Hukuk Müdürü, Avukat, Stajyer

### 3. Finance / Finans
- **Alanlar**: Talep No, Tutar (currency, encrypted), Bütçe Kodu, Ödeme Durumu (workflow), Onay Aşaması, Harcama Birimi, Fatura (file), Ödeme Tarihi
- **Workflow**: Talep Oluşturuldu → Birim Onayı → Mali Kontrol → Ödeme Bekliyor → Ödendi → Kapandı
- **Dashboard**: Bekleyen ödeme (count + sum), Toplam tutar, Geciken onay, Ödeme tamamlanma oranı
- **Roller**: CFO, Mali Kontrolör, Birim Sorumlusu

### 4. Transport / Ulaştırma
- **Alanlar**: Araç Plakası, Şoför (person), Görev Yeri, Bakım Tarihi (date), Yakıt Durumu (number), Görev Notları
- **Workflow**: Görev Atandı → Yola Çıktı → Görevde → Tamamlandı
- **Dashboard**: Aktif görev, Bakım yaklaşanlar, Görevdeki araç sayısı, Aylık km/yakıt
- **Roller**: Filo Müdürü, Şoför

### 5. Procurement / Satın Alma
- **Alanlar**: Talep No, Ürün/Hizmet, Adet, Tahmini Tutar, Tedarikçi, Teklif Tarihi, Onay Aşaması (workflow)
- **Workflow**: Talep → Teklif Alımı → Karşılaştırma → Onayda → Sipariş Verildi → Teslim Alındı → Faturalandı
- **Dashboard**: Aktif satın alma, Aylık harcama, Tedarikçi performansı
- **Roller**: Satın Alma Müdürü, Talep Sahibi

### 6. Archive / Arşiv
- **Alanlar**: Belge No, Konu, Tarih, Klasör (relation), Saklama Süresi, İmha Tarihi, Erişim Yetkisi
- **Workflow**: Arşive Alındı → Aktif → İmha Beklemede → İmha Edildi
- **Dashboard**: Toplam belge, İmha bekleyen, Erişim sayısı, Saklama doluluk
- **Roller**: Arşiv Sorumlusu, Okuyucu

### 7. Document Tracking / Evrak Takip
- **Alanlar**: Evrak No, Konu, Gönderen, Alıcı, Tarih, Süreç Durumu, Cevap Verildi mi (bool), Yanıt Tarihi
- **Workflow**: Geldi → İşleme Alındı → Yanıtlandı → Kapandı
- **Dashboard**: Bekleyen evrak, Geciken yanıt, Birim bazlı yük
- **Roller**: Yazı İşleri, Birim Sorumlusu

---

## BÖLÜM 10 — Önceliklendirilmiş Geliştirme Sırası

### Faz A — Temel (Sprint 1-4, ~1 ay)
**ROI**: yüksek, risk: düşük
1. `modules` tablosu + "general" default + `projects.module_id`
2. `module_field_templates` + UI okuma (yeni proje oluştururken modül seç)
3. Module-context.tsx + sidebar'da modül seçici
4. Mevcut sayfalar geriye uyumlu, "general" module gibi davranır

### Faz B — Güvenlik (Sprint 5-6)
**ROI**: yüksek (kurumsal alıcı için kritik), risk: orta
5. `field_security_rules` config'e taşı + UI
6. `encrypted_field_values` + pgcrypto + RPC (TCKN/finansal için kritik)
7. Hash-based search

### Faz C — Refactor (Sprint 7)
**ROI**: orta (geliştirici hızı), risk: YÜKSEK
8. TasksTable monolitini parçala — generic `RecordTable`

### Faz D — Modüler İnşa (Sprint 8-10)
9. Module Builder UI (yönetici yeni modül oluştur)
10. Template Registry + 7 hazır şablonu seed
11. Module-aware dashboard + view types

### Faz E — Detay (Sprint 11-12)
12. Column-level permissions
13. Audit compaction (90 gün önce arşivle)
14. API rate limit (Vercel/Next middleware)
15. Yük testi (10K+ kayıt)

---

## BÖLÜM 11 — Kod Değişiklik Planı

### Dokunulmayacak (Geriye Uyum Garanti)
- `tasks` tablosu — kolonlar eklenir, hiçbiri silinmez
- `projects` tablosu — aynı
- Mevcut RLS politikaları — yeni RESTRICTIVE eklenir, mevcut PERMISSIVE değişmez
- API route'lar — sadece eklenir, mevcut bozulmaz
- `/canli-tablo`, `/projeler` URL'leri — çalışmaya devam (general module wrapper)
- Mevcut RPC'ler — silinmez, geri uyumlu

### Refactor Edilecek
- `TasksTable.tsx` (8648 satır) → 3 dosyaya bölünür (S7)
- `ProjectsSection.tsx` (3446 satır) → `ProjectListSection` + `ProjectFormDialog` + `MemberPanel`
- `lib/permissions.ts` → modüle göre dinamik genişletilir

### Yeni Eklenecek
- 10 yeni tablo (Bölüm 4)
- 5 yeni RPC (Bölüm 7)
- `components/modules/*`, `components/fields/*`, `components/workflow/*`
- `app/modules/[moduleCode]/*`, `app/module-builder/*`
- 7 modül şablonu (`scripts/seed-module-template-*.sql`)

---

## BÖLÜM 12 — Test Senaryoları

### Birim
- Field type render: her field tipi (20+ tip) snapshot
- Encryption round-trip: encrypt → decrypt → eşit
- Workflow transition: yetkisiz kullanıcı engellenir
- Sensitive masking: regex + config eşleşmesi

### Entegrasyon
- Mevcut "general" proje yeni mimaride aynı çalışır (regression)
- Yeni Hukuk projesi oluştur → workflow adımı geçişi → dashboard güncellenir
- Şifreli alan ara → hash ile eşleşen kayıt bulunur
- Export → maskeli alanlar `•••` ile çıkar (admin: tam)

### E2E
- Onboarding: yeni kullanıcı → modül seç → proje oluştur → görev ekle
- Approval: üye submit → PM approve → Workflow ilerler → dashboard sayar
- PII access: TCKN unmask → audit log oluşur → admin görebilir

### Yük
- 10K kayıt + 50 sütun + realtime: tablo açılış <3sn
- 100 eşzamanlı kullanıcı: RLS performans
- Audit log 1M satır: query <500ms (indeks yeterli mi?)

### Güvenlik
- Yetkisiz user PostgREST üzerinden encrypted_field_values'a erişebilir mi? (HAYIR)
- API rate limit: 100 req/dk üstü 429
- Cross-module veri sızıntısı: HR kullanıcısı Legal kaydı göremez

---

## BÖLÜM 13 — Rollback Planı

### Her Sprint Sonu
- Migration dosyası **idempotent** (var olan yapıyı tekrar oluşturmaz)
- Her tablo eklemesi için **drop migration** (`scripts/rollback/*.sql`)
- Feature flag (`app_settings.feature_modules`) ile UI gizlenebilir

### Veri Kaybı Senaryoları
- `encrypted_field_values` boşalırsa: kaynak kayıt `tasks.extra_data`'da hâlâ var (S5'ten önce)
- `module_id NULL` yapılırsa: tüm projeler "general" altına düşer (default)
- `workflow_step_code` temizlenirse: eski `workflow_status` kullanılır (sync)

### Geri Dönüş Komutları (Örnek)
```sql
-- S1 rollback
alter table public.projects drop column if exists module_id;
drop table if exists public.modules cascade;

-- S5 rollback
drop function if exists public.set_encrypted_field;
drop function if exists public.get_encrypted_field;
drop table if exists public.encrypted_field_values cascade;
-- Veriler kaybolur; sadece S5 sonrası yazılmış şifreli alanlar için
```

### Branch Stratejisi
- Her sprint ayrı feature branch
- Production-ready olunca PR + squash merge
- Hata olursa: `git revert <merge_commit>` + DB rollback script

---

## BÖLÜM 14 — Güvenlik & Performans Kontrol Listesi

| Kontrol | Mevcut | Hedef |
|---|---|---|
| RLS her tabloda açık | ✅ | ✅ devam |
| Yetkisiz UPDATE (RLS bypass) | `saveTask` sentinel ile yakalanıyor | ✅ tüm modüllere yay |
| Realtime perf | 3 tablo, küçük veriyle test | 10+ tabloya genişle, yük testi |
| Audit log büyüme | Sınırsız | 90 gün sonra `archived_at`, 1 yıl sonra silme |
| Dosya erişim | task_files RLS detayı yok | per-task signed URL + audit |
| Export maskeleme | Sabit kod | `field_security_rules.export_strategy` |
| API rate limit | Yok | Next middleware: 100 req/dk/IP |
| Encrypted alan | Yok | pgcrypto AES-256 + key rotation |
| Hash search | Yok | sha256 + indexed lookup |
| Column-level perm | Yok | `field_access_rules` |
| Frontend permission != backend | Karma | DB RLS = single source of truth |

---

## BÖLÜM 16 — Analytics / Raporlama Motoru

> **Amaç**: Kullanıcı sadece veri girmesin; sistem girilen veriden otomatik KPI, analiz ve grafik üretsin. Her modül kendi analiz şablonunu tanımlayabilsin. **Ulaştırma modülü** referans implementasyon.

### 16.1 Mimari Yaklaşım — "Analytics-as-Module"

Analytics, ayrı bir modül değil **platform servisi**. Her modül kendi tanımını yapar:

```
PLATFORM SERVICES eklenir:
  ├── Analytics Engine
  │     ├── Computed Fields (hesaplanan alanlar)
  │     ├── Metric Definitions (KPI tanımları)
  │     ├── Chart Templates (grafik şablonları)
  │     ├── Report Templates (rapor şablonları)
  │     └── Cross-Record Matching (otomatik eşleştirme)
```

### 16.2 Yeni Tablolar

```sql
-- 1) Modül başına hesaplanan alanlar
create table public.module_computed_fields (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  key text not null,                  -- 'total_km', 'usage_hours', 'fuel_cost_per_km'
  label text not null,
  formula_kind text not null,         -- 'arithmetic' | 'aggregate' | 'cross_record_match' | 'sql_view'
  formula_config jsonb not null,      -- {expression, dependencies, scope, ...}
  result_type text not null,          -- 'number', 'currency', 'duration', 'percent'
  unit text,                          -- 'km', 'TL', 'saat', 'L'
  cache_ttl_seconds int default 60,   -- materialized cache süresi
  sort_order int default 0,
  unique (module_id, key)
);

-- 2) Modül KPI tanımları (Dashboard kartları için detay)
create table public.module_metrics (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  code text not null,                 -- 'monthly_fuel_cost', 'active_vehicles'
  title text not null,
  description text,
  query_kind text not null,           -- 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct_count' | 'custom_sql'
  source_table text,                  -- 'fuel_logs', 'vehicle_trips'
  source_field text,                  -- 'amount', 'total_km'
  filter_config jsonb,                -- {date_range, status_in, vehicle_in, ...}
  group_by text[],                    -- ['vehicle_id', 'month']
  icon text,
  color text,
  format_template text,               -- '{value} TL', '{value} km'
  trend_compare_period text,          -- 'prev_month', 'prev_year'
  alert_threshold jsonb,              -- {operator, value, severity}
  sort_order int default 0,
  unique (module_id, code)
);

-- 3) Modül grafik şablonları
create table public.module_charts (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  code text not null,                 -- 'monthly_km_by_vehicle'
  title text not null,
  chart_type text not null,           -- 'line' | 'bar' | 'pie' | 'area' | 'donut' | 'scatter' | 'heatmap'
  query_config jsonb not null,        -- {source, x_axis, y_axis, group_by, aggregate}
  display_config jsonb,               -- {colors, legend_position, tooltip_format}
  default_filters jsonb,              -- preset filtreler
  sort_order int default 0,
  unique (module_id, code)
);

-- 4) Rapor şablonları (modül + sistem genel)
create table public.module_reports (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade,
  code text not null,                 -- 'monthly_vehicle_usage'
  title text not null,
  description text,
  report_type text not null,          -- 'pdf' | 'excel' | 'csv'
  sections jsonb not null,            -- [{type: 'header'}, {type: 'kpi_grid'}, {type: 'chart'}, {type: 'table'}]
  default_filters jsonb,
  required_permission text,
  is_official boolean default false,
  unique (module_id, code)
);

-- 5) Cross-record matching kuralları (ceza ↔ trip gibi)
create table public.module_match_rules (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  code text not null,                 -- 'fine_to_trip'
  source_table text not null,         -- 'traffic_fines'
  target_table text not null,         -- 'vehicle_trips'
  match_config jsonb not null,        -- {join_field: 'vehicle_id', time_overlap: {source: 'fine_datetime', target: ['start_datetime','end_datetime']}}
  auto_actions jsonb,                 -- [{type: 'set_field', field: 'matched_driver_id'}, {type: 'notify', recipient: 'driver'}, {type: 'audit'}]
  enabled boolean default true,
  unique (module_id, code)
);

-- 6) Materialized metric cache (performans)
create table public.metric_cache (
  metric_id uuid not null references public.module_metrics(id) on delete cascade,
  scope_hash text not null,           -- hash of (user_id, project_id, filters)
  result jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (metric_id, scope_hash)
);
```

### 16.3 Ulaştırma Modülü Şeması (Referans Implementasyon)

```sql
-- Araçlar
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text unique not null,
  brand text, model text, year int,
  fuel_type text,                     -- 'benzin', 'dizel', 'lpg', 'elektrik'
  department text,
  status text default 'active',       -- 'active' | 'maintenance' | 'retired'
  current_km int default 0,
  next_service_km int,
  next_service_date date,
  module_id uuid references public.modules(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Şoförler (auth.users'a opsiyonel bağlı)
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  license_type text,                  -- 'B', 'C', 'D', 'E'
  license_no_encrypted text,          -- field_security_rules ile maskeli
  department text,
  phone text,
  active boolean default true,
  created_at timestamptz not null default now()
);

-- Araç görev (trip) kayıtları
create table public.vehicle_trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  start_datetime timestamptz not null,
  end_datetime timestamptz,
  start_km int not null,
  end_km int,
  total_km int generated always as (coalesce(end_km - start_km, 0)) stored,
  duration_minutes int generated always as (
    case when end_datetime is not null
      then extract(epoch from (end_datetime - start_datetime))::int / 60
      else null end
  ) stored,
  destination text,
  task_type text,                     -- 'sehir_ici', 'sehir_disi', 'bakim', 'aciliyet'
  status text default 'active',       -- 'planned' | 'active' | 'completed' | 'cancelled'
  handover_received_by text,          -- teslim alan
  handover_returned_to text,          -- teslim eden
  notes text,
  project_id uuid references public.projects(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Yakıt kayıtları
create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  fuel_date date not null,
  liter numeric(10,2) not null,
  amount numeric(12,2) not null,      -- toplam tutar
  unit_price numeric(10,4) generated always as (
    case when liter > 0 then amount / liter else 0 end
  ) stored,
  station text,
  km_at_fueling int,
  invoice_file_id uuid,               -- task_files referansı
  trip_id uuid references public.vehicle_trips(id),  -- opsiyonel
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Trafik cezaları
create table public.traffic_fines (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  fine_datetime timestamptz not null,
  fine_type text not null,            -- 'hiz', 'park', 'kirmizi_isik', 'emniyet_kemer'
  amount numeric(12,2) not null,
  location text,
  document_file_id uuid,
  -- Otomatik eşleştirme alanları
  matched_trip_id uuid references public.vehicle_trips(id),
  matched_driver_id uuid references public.drivers(id),
  match_confidence text,              -- 'auto_high' | 'auto_medium' | 'manual' | 'unmatched'
  responsibility_status text,         -- 'driver' | 'company' | 'disputed' | 'pending'
  payment_status text default 'pending', -- 'pending' | 'paid' | 'objected' | 'cancelled'
  payment_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Bakım/servis kayıtları
create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  service_date date not null,
  km_at_service int not null,
  cost numeric(12,2),
  description text,
  service_provider text,
  next_service_date date,
  next_service_km int,
  invoice_file_id uuid,
  created_at timestamptz not null default now()
);

-- İndeksler (performans)
create index vehicle_trips_vehicle_dates_idx on public.vehicle_trips(vehicle_id, start_datetime, end_datetime);
create index vehicle_trips_driver_idx on public.vehicle_trips(driver_id, start_datetime desc);
create index fuel_logs_vehicle_date_idx on public.fuel_logs(vehicle_id, fuel_date desc);
create index traffic_fines_vehicle_date_idx on public.traffic_fines(vehicle_id, fine_datetime);
create index traffic_fines_unmatched_idx on public.traffic_fines(vehicle_id, fine_datetime) where matched_trip_id is null;
create index maintenance_next_due_idx on public.maintenance_logs(vehicle_id, next_service_date);
```

### 16.4 Ulaştırma Hesaplanan Alanlar (Auto-Computed)

Veritabanı tarafı (PostgreSQL `generated always as`):
- `vehicle_trips.total_km` = `end_km - start_km`
- `vehicle_trips.duration_minutes` = `end_datetime - start_datetime`
- `fuel_logs.unit_price` = `amount / liter`

Uygulama / view tarafı (modülün `module_computed_fields` kayıtları):
- `vehicle_monthly_km` = `SUM(total_km)` per vehicle per month
- `vehicle_unique_drivers_count` = `COUNT(DISTINCT driver_id)` per vehicle per period
- `vehicle_monthly_trips` = `COUNT(*)` per vehicle per month
- `vehicle_monthly_fuel_cost` = `SUM(amount)` per vehicle per month
- `vehicle_cost_per_km` = `monthly_fuel_cost / monthly_km`
- `driver_total_trips` = `COUNT(*)` per driver per period
- `driver_total_fines` = `SUM(amount)` per driver per period

### 16.5 Cross-Record Matching — Ceza ↔ Trip Eşleştirme

**Kural** (`module_match_rules` kaydı):
```json
{
  "code": "fine_to_trip",
  "source_table": "traffic_fines",
  "target_table": "vehicle_trips",
  "match_config": {
    "join_field": "vehicle_id",
    "time_overlap": {
      "source_field": "fine_datetime",
      "target_range_fields": ["start_datetime", "end_datetime"]
    }
  },
  "auto_actions": [
    { "type": "set_field", "target": "matched_trip_id", "source": "trip.id" },
    { "type": "set_field", "target": "matched_driver_id", "source": "trip.driver_id" },
    { "type": "set_field", "target": "match_confidence", "value": "auto_high" },
    { "type": "audit_event", "code": "fine.auto_matched" },
    { "type": "notify", "recipient_lookup": "trip.driver.user_id",
      "title": "Size atanan trafik cezası", "severity": "warning" }
  ]
}
```

**Çalışma şekli** (PostgreSQL trigger + RPC):
```sql
create or replace function public.match_fine_to_trip()
returns trigger language plpgsql security definer as $$
declare
  v_trip record;
begin
  select * into v_trip
  from public.vehicle_trips
  where vehicle_id = new.vehicle_id
    and new.fine_datetime between start_datetime and coalesce(end_datetime, now())
  order by start_datetime desc
  limit 1;

  if v_trip.id is not null then
    new.matched_trip_id := v_trip.id;
    new.matched_driver_id := v_trip.driver_id;
    new.match_confidence := 'auto_high';
    -- Bildirim ve audit RPC çağrıları
    perform public.create_fine_match_notification(new.id, v_trip.driver_id);
  else
    new.match_confidence := 'unmatched';
  end if;
  return new;
end $$;

create trigger trg_match_fine_to_trip
  before insert on public.traffic_fines
  for each row execute function public.match_fine_to_trip();
```

### 16.6 Ulaştırma KPI Kartları (8 adet)

| Kod | Başlık | Sorgu | Format |
|---|---|---|---|
| `active_vehicles_today` | Bugün görevdeki araç | COUNT(DISTINCT vehicle_id) WHERE status='active' AND today BETWEEN start AND end | `{value} araç` |
| `today_trip_count` | Bugünkü sefer | COUNT(*) WHERE start_date = today | `{value} sefer` |
| `monthly_trip_total` | Aylık sefer | COUNT(*) WHERE month = current | `{value} sefer` (trend: prev_month) |
| `monthly_km_total` | Aylık toplam km | SUM(total_km) | `{value} km` |
| `monthly_fuel_cost` | Aylık yakıt gideri | SUM(amount) from fuel_logs | `{value} TL` (trend) |
| `monthly_fine_total` | Aylık ceza | SUM(amount) from traffic_fines | `{value} TL` (alert: >threshold kırmızı) |
| `maintenance_due_soon` | Bakımı yaklaşan | COUNT(*) WHERE next_service_date < today+14 OR next_service_km - current_km < 1000 | `{value} araç` |
| `most_active_vehicle` | En yoğun araç | top 1 by monthly_trip_count | `{plate} ({value} sefer)` |

### 16.7 Ulaştırma Grafikleri (8 adet)

| Kod | Tür | X / Y / Group |
|---|---|---|
| `monthly_km_by_vehicle` | bar (stacked) | x: month, y: total_km, group: vehicle_id |
| `driver_trip_count` | bar (horizontal) | x: trip_count, y: driver |
| `monthly_fuel_cost_trend` | line | x: month, y: fuel_amount |
| `vehicle_fuel_consumption` | bar | x: plate, y: L/100km (computed) |
| `fines_monthly_distribution` | bar | x: month, y: count + amount overlay |
| `task_type_usage_pie` | pie | groups: task_type, value: count |
| `vehicle_usage_hours` | bar | x: plate, y: SUM(duration_minutes)/60 |
| `cost_per_km_trend` | line | x: month, y: fuel_cost/km |

### 16.8 Ulaştırma Raporları (5 adet, PDF/Excel)

1. **Aylık Araç Kullanım Raporu** — vehicle bazlı: km, sefer, saat, yakıt, maliyet
2. **Yakıt Gider Raporu** — fuel_logs tablosu + KPI özet + trend grafiği
3. **Trafik Cezası Raporu** — ceza listesi + eşleşmiş şoför + sorumluluk durumu
4. **Şoför Performans Raporu** — driver bazlı: sefer sayısı, toplam km, ceza, ortalama hız
5. **Bakım Takip Raporu** — vehicle bazlı: son bakım, sonraki bakım, gecikme

Her raporun `sections` JSON yapısı:
```json
{
  "sections": [
    { "type": "header", "config": { "logo": true, "title": "{period} Araç Kullanım Raporu", "filters_summary": true } },
    { "type": "kpi_grid", "metric_codes": ["monthly_trip_total", "monthly_km_total", "monthly_fuel_cost"] },
    { "type": "chart", "chart_code": "monthly_km_by_vehicle" },
    { "type": "table", "source": "vehicle_trips", "columns": [...], "group_by": "vehicle" },
    { "type": "footer", "config": { "page_number": true, "generated_at": true } }
  ]
}
```

### 16.9 Filtre Sistemi — `analytics_filters` (Generic)

```sql
create table public.module_filter_definitions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  key text not null,                  -- 'date_range', 'vehicle_id', 'driver_id'
  label text not null,
  filter_type text not null,          -- 'date_range' | 'multi_select' | 'single_select' | 'number_range' | 'text'
  source_config jsonb,                -- {table: 'vehicles', label_field: 'plate', value_field: 'id'}
  default_value jsonb,
  required boolean default false,
  sort_order int default 0
);
```

Ulaştırma filtreleri: `date_range`, `vehicle_id` (multi_select from vehicles), `driver_id`, `department`, `task_type`, `fuel_type`, `fine_type`, `payment_status`, `maintenance_status`.

### 16.10 Diğer Modüller İçin Genel Yapı (Genelleştirme)

Aynı `module_metrics` / `module_charts` / `module_reports` yapısı **tüm modüller** için:

**Finans örneği**:
- Metrics: `pending_payments_count`, `monthly_paid_total`, `overdue_approvals`
- Charts: `monthly_cashflow`, `budget_vs_actual`, `department_spending_pie`
- Reports: "Aylık Ödeme Raporu", "Bütçe Sapma Raporu"

**Hukuk örneği**:
- Metrics: `open_cases`, `upcoming_hearings_7day`, `critical_deadlines`
- Charts: `cases_by_court`, `monthly_case_outcomes`, `lawyer_caseload`
- Reports: "Dava Durum Raporu", "Duruşma Takvimi", "Avukat Performans"

**Personel örneği**:
- Metrics: `open_requests`, `overdue_processes`, `dept_workload`
- Charts: `monthly_request_types`, `dept_processing_time`, `request_status_funnel`

### 16.11 Güvenlik — Analytics RLS

**Kritik kural**: Dashboard query'leri **kullanıcının erişebileceği kayıtlarla** sınırlı.

```sql
-- Örnek: vehicle_trips RLS
create policy vehicle_trips_select on public.vehicle_trips
  for select to authenticated
  using (
    -- Admin tümünü görür
    is_app_admin()
    -- Filo Müdürü tüm araçları görür
    or current_profile_role_id() in ('admin', 'project_manager')
    -- Şoför sadece kendi tripi
    or driver_id = (select id from public.drivers where user_id = auth.uid())
    -- Birim sorumlusu kendi birim araçları
    or vehicle_id in (
      select v.id from public.vehicles v
      where v.department = current_user_department()
    )
  );
```

**KPI fonksiyonları RLS-aware** çalışır:
```sql
create function public.compute_metric(
  p_metric_code text,
  p_filters jsonb
) returns jsonb security invoker  -- ÖNEMLİ: invoker, definer DEĞİL
language plpgsql as $$
-- RLS otomatik uygulanır; kullanıcı sadece kendi görebildiği veriden sayım alır
$$;
```

**Cache key'i kullanıcı bazlı**: `scope_hash = hash(user_id, project_filters, date_range)` — farklı kullanıcılar aynı KPI'ı farklı görür.

### 16.12 Performans Stratejisi

- **Generated columns** (PostgreSQL native): `total_km`, `duration_minutes`, `unit_price` — yazma zamanı hesap
- **Materialized views**: Aylık KPI'lar için `mat_view_monthly_vehicle_metrics`, gece refresh
- **Metric cache**: `metric_cache` tablosu, 60 saniye TTL, scope-hash key
- **Index strategy**:
  - `(vehicle_id, start_datetime DESC)` — son tripler için
  - `(vehicle_id, fuel_date DESC)` — son yakıt için
  - Partial index: `where matched_trip_id is null` — eşleşmemiş cezalar
- **Chart query timeout**: 5sn, üstüne çıkarsa "veri çok büyük, filtreleyin" uyarısı

### 16.13 Frontend — Chart Library

**Karar**: `recharts` (zaten ekosisteme yakın, ~90KB, React-friendly).

Yeni klasör:
```
components/analytics/
  ChartRenderer.tsx       # chart_type → bileşen dispatcher
  MetricCard.tsx          # KPI kartı (number + trend + alert)
  ReportBuilder.tsx       # rapor önizleme + PDF/Excel export
  FilterBar.tsx           # module_filter_definitions render
  charts/
    LineChart.tsx
    BarChart.tsx
    PieChart.tsx
    DonutChart.tsx
    AreaChart.tsx
    HeatmapChart.tsx
lib/analytics/
  metricEngine.ts         # compute_metric RPC wrapper + cache
  chartQueryBuilder.ts    # query_config → SQL/RPC
  reportRenderer.ts       # sections JSON → PDF/Excel
```

### 16.14 Sprint Eklemeleri (Mevcut 12 Sprint + 4 yeni)

| Yeni Sprint | İçerik | Bağımlılık |
|---|---|---|
| **S13** | `module_computed_fields`, `module_metrics`, `module_charts`, `metric_cache` tabloları | S2 (modüler altyapı) |
| **S14** | Analytics Engine lib + KPI renderer + chart library entegrasyonu | S13 |
| **S15** | Ulaştırma şeması (vehicles, drivers, trips, fuel, fines, maintenance) + 8 KPI + 8 chart + 5 rapor | S13, S14 |
| **S16** | Cross-record matching engine (`module_match_rules`) + ceza-trip otomatik eşleştirme + bildirim | S15 |

Toplam sprint sayısı **12 → 16** (3 ay → ~4 ay).

### 16.15 Migration Stratejisi (Ulaştırma)

Eski projeler için: Ulaştırma şeması **opsiyonel**. Sadece "Ulaştırma" modülü etkin projeler kullanır. Mevcut tasks tablosu olduğu gibi kalır.

**Geriye uyum**:
- Vehicles/drivers/trips ayrı tablolar — `tasks` ile karışmaz
- Ulaştırma kayıtları aynı zamanda `tasks` tablosuna projection yapılabilir (opsiyonel view): kullanıcı isterse "Canlı Tablo"da da görür
- Mevcut görev modeli bozulmaz

### 16.16 Test Senaryoları (Analytics Özel)

- Generated column çalışır: trip kaydet → total_km otomatik
- Ceza eşleştirme: trip aralığında ceza ekle → matched_driver otomatik dolu + bildirim
- RLS: şoför kendi tripi dışındaki cezayı görmez
- Cache: aynı filtre 2. kez 60sn içinde → cache hit
- Rapor: 5K kayıt PDF üretimi <10sn
- Chart: 1 yıllık veri 12 ay group → <500ms

### 16.17 Rollback (Analytics)

- `module_computed_fields` boşalırsa: KPI gösterilmez ama veri kaybı yok (alt tablolar dolu)
- `metric_cache` her zaman silinebilir (yeniden hesaplanır)
- `traffic_fines.matched_trip_id` NULL'a düşerse trigger tekrar çalıştırılabilir (`UPDATE traffic_fines SET ... WHERE matched_trip_id IS NULL` re-trigger)
- Ulaştırma tabloları drop edilebilir — diğer modüller etkilenmez

---

## BÖLÜM 17 — Onay & Sonraki Adım

Bu plan **bir yol haritası** — uygulama başlamak için aşağıdaki kararlar gerek:

### Sizden Beklenen Kararlar

1. **Hangi fazdan başlayalım?**
   - A) Faz A (Temel — modüler altyapı) — en güvenli başlangıç
   - B) Faz B (Güvenlik — şifreleme öncelik) — kurumsal alıcı varsa
   - C) Faz D (Modüler şablonlar — kullanıcıya değer) — pazara hızlı
   - **D) Faz F (Analytics — Ulaştırma pilot)** — somut iş değeri, görsel sonuç

2. **İlk modül hangisi olsun?**
   - Hukuk, Finans, Personel veya **Ulaştırma** (analytics pilot olarak)

3. **Feature flag ile mi açalım?**
   - Önerim: evet (`app_settings.feature_modules = true` ile UI'da modül seçici görünür; false iken eski deneyim aynen kalır)

4. **Şifreleme tarafı**:
   - pgcrypto symmetric key Supabase'de nerede saklanacak? (Vault, env var, KMS?)
   - Master key rotation stratejisi?

5. **Zaman çizelgesi**:
   - 4 ay (16 sprint) gerçekçi mi yoksa fazlar arasında daha esnek mi gidelim?

6. **Chart library tercihi**:
   - Önerim: `recharts` (~90KB, React-friendly, MIT)
   - Alternatif: `visx` (Airbnb, daha düşük seviye), `nivo` (zengin ama büyük)

### Bu Planın Çıktısı

Onay verirseniz **Sprint 1** ile başlarız:
- `modules` tablosu + RLS
- "general" default modül seed
- `projects.module_id` kolonu (NULL=general)
- Mevcut UI etkilenmez (geriye uyumlu)

İlk sprint **küçük, riski sıfır**: mevcut hiçbir özellik bozulmadan yeni mimarinin tohumu atılır. Memnun olunursa S2'ye geçeriz.

---

**Plan onay bekliyor. Karar verdiğinizde başlarım.**
