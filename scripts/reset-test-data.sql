-- =============================================================================
-- TEST RESET — kullanım sırasında biriken oynak verileri sıfırlar.
-- =============================================================================
-- Amaç: özellikleri "sıfırdan" test etmek için bildirimler, yorumlar, çip
-- atamaları, otomasyon logları, workflow geçmişi, sohbet mesajları vs. silinir.
--
-- KORUNAN: kullanıcılar, projeler, görevler, çip ŞABLONLARI, referans
-- kaynakları, otomasyon kuralları, proje sütun tanımları (project_columns),
-- proje üye yetkileri, PII erişim kayıtları (pii_access_log,
-- pii_policy_shadow_log — KVKK denetim izi, immutable). Yani yapı korunur,
-- sadece oynak veri silinir.
--
-- KULLANIM:
--   * BLOK BLOK çalıştırın — istediğiniz reset seviyesini seçin.
--   * Hepsini birden çalıştırmak için tüm dosyayı tek seferde de yapabilirsiniz.
--   * GERİ ALINAMAZ — emin olun (test ortamı için tasarlandı).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 1 — BİLDİRİMLER (notifications + announcement read state)
-- ─────────────────────────────────────────────────────────────────────────────
-- Çan ve /bildirimler sayfasındaki tüm bildirimleri siler.
do $$
begin
  if to_regclass('public.notifications') is not null then
    delete from public.notifications;
    raise notice '✓ notifications tablosu temizlendi';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 2 — YORUMLAR (task comments + project chat)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.task_comments') is not null then
    delete from public.task_comments;
    raise notice '✓ task_comments tablosu temizlendi';
  end if;
  if to_regclass('public.project_chat_messages') is not null then
    delete from public.project_chat_messages;
    raise notice '✓ project_chat_messages tablosu temizlendi';
  end if;
  if to_regclass('public.project_chat_reads') is not null then
    delete from public.project_chat_reads;
    raise notice '✓ project_chat_reads tablosu temizlendi';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 3 — OTOMASYON LOGLARI (kurallar korunur, sadece çalıştırma geçmişi)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.automation_logs') is not null then
    delete from public.automation_logs;
    raise notice '✓ automation_logs tablosu temizlendi';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 4 — WORKFLOW (onay akışı) GEÇMİŞİ
-- ─────────────────────────────────────────────────────────────────────────────
-- task_workflow_events: kim ne zaman onay/ret/revize yaptı denetim izi
-- tasks.workflow_* alanları: aktif durum (draft'a sıfırlanır)
do $$
begin
  if to_regclass('public.task_workflow_events') is not null then
    delete from public.task_workflow_events;
    raise notice '✓ task_workflow_events tablosu temizlendi';
  end if;
end $$;

update public.tasks
set
  workflow_status = 'draft',
  workflow_submitted_at = null,
  workflow_reviewed_at = null,
  workflow_reviewed_by = null
where
  workflow_status is not null
  and workflow_status <> 'draft';


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 5 — ÇİP DEĞERLERİ (satırlara atanmış çipler — şablonlar korunur)
-- ─────────────────────────────────────────────────────────────────────────────
-- DİKKAT: Yüklenmiş referans verilerini ve çip seçeneklerini DEĞİL,
-- sadece satırlara atanmış değerleri siler.
do $$
begin
  if to_regclass('public.row_chip_values') is not null then
    delete from public.row_chip_values;
    raise notice '✓ row_chip_values tablosu temizlendi';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 6 — GENEL DENETİM LOGLARI (audit_log)
-- ─────────────────────────────────────────────────────────────────────────────
-- PII erişim kayıtları (pii_access_log, pii_policy_shadow_log) KASITLI OLARAK
-- silinmez — görev/proje reset olsa bile kim hangi hassas alana erişti izi kalır.
-- Tablolarda DELETE policy yoktur (scripts/pii-access-log.sql).
do $$
begin
  if to_regclass('public.audit_log') is not null then
    delete from public.audit_log;
    raise notice '✓ audit_log tablosu temizlendi';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 7 — TASK AUTOMATION STATE (satır renk / kilit metadata)
-- ─────────────────────────────────────────────────────────────────────────────
-- Otomasyonun satıra uyguladığı görsel state (renk, kilit). Görsel sıfırlama.
do $$
begin
  if to_regclass('public.task_automation_state') is not null then
    delete from public.task_automation_state;
    raise notice '✓ task_automation_state tablosu temizlendi';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 8 — PRESENCE (kim hangi sayfada görünüyor — gerçek zamanlı izleme)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.presence_heartbeats') is not null then
    delete from public.presence_heartbeats;
    raise notice '✓ presence_heartbeats tablosu temizlendi';
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOK 9 — ÖZET RAPORU
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  task_count integer;
  project_count integer;
begin
  select count(*) into task_count from public.tasks;
  select count(*) into project_count from public.projects;
  raise notice '═══════════════════════════════════════';
  raise notice '✅ TEST RESET TAMAMLANDI';
  raise notice '   Korunan: % proje, % görev', project_count, task_count;
  raise notice '   Silinen: bildirimler, yorumlar, otomasyon logları, ';
  raise notice '            workflow geçmişi, çip atamaları, audit_log';
  raise notice '   Korunan (denetim): pii_access_log, pii_policy_shadow_log';
  raise notice '═══════════════════════════════════════';
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- OPSİYONEL — TÜM GÖREVLERİ DE SİL (BLOK 10)
-- ─────────────────────────────────────────────────────────────────────────────
-- DİKKAT: bunu çalıştırırsanız tüm görev satırları silinir, projeler kalır.
-- Tamamen "sıfırdan başla" istiyorsanız BLOK 10'u açın.
--
-- delete from public.tasks;
--
-- ─────────────────────────────────────────────────────────────────────────────
-- OPSİYONEL — TÜM PROJELERİ DE SİL (BLOK 11)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sıfır kullanıcı tarafından başla — sadece kullanıcılar kalır.
--
-- delete from public.project_columns;
-- delete from public.project_member_permissions;
-- delete from public.tasks;
-- delete from public.projects;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPSİYONEL — PII DENETİM KAYITLARI (yalnızca dev/test, bilinçli temizlik)
-- ─────────────────────────────────────────────────────────────────────────────
-- Normal test reset PII kayıtlarına dokunmaz. Tamamen boş PII ekranı istiyorsanız
-- ve ortam test/staging ise postgres rolüyle (SQL Editor) aşağıyı açın:
--
-- truncate table public.pii_access_log;
-- truncate table public.pii_policy_shadow_log;
