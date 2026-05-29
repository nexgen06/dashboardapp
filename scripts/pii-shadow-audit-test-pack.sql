-- =============================================================================
-- PII Policy Shadow + Audit Indicator Test Pack
-- =============================================================================
-- Bu dosya 3 göstergenin de testini kolaylaştırır:
--   1) Aktif policy
--   2) Shadow farklı karar
--   3) Audit uyarı
--
-- Kullanım:
--   A) "SEED" bölümünü çalıştır
--   B) Yönetim > PII Erişim ekranında Yenile
--   C) "VERIFY" bölümünü çalıştır
--   D) Test bitince "CLEANUP" bölümünü çalıştır
--
-- Not: Bu script test içindir. Production'da sadece kontrollü test ortamında kullan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PRECHECK (opsiyonel)
-- -----------------------------------------------------------------------------
select
  to_regclass('public.sensitive_field_policies') as sensitive_field_policies_table,
  to_regclass('public.pii_policy_shadow_log') as pii_policy_shadow_log_table,
  to_regclass('public.pii_access_log') as pii_access_log_table,
  to_regclass('public.pii_access_log_validation_issues') as pii_access_log_validation_issues_view;

-- =============================================================================
-- SEED
-- =============================================================================

-- 1) Aktif policy kartını yükseltmek için test policy'leri ekle
insert into public.sensitive_field_policies
  (name, field_pattern, match_type, action, role_scope, decision, reason_required, priority, enabled)
select
  'TEST_ALLOW_COPY_SICIL',
  'sicil',
  'contains',
  'copy',
  array['member']::text[],
  'allow',
  false,
  50,
  true
where not exists (
  select 1
  from public.sensitive_field_policies
  where name = 'TEST_ALLOW_COPY_SICIL'
);

insert into public.sensitive_field_policies
  (name, field_pattern, match_type, action, role_scope, decision, reason_required, priority, enabled)
select
  'TEST_DENY_COPY_SICIL',
  'sicil',
  'contains',
  'copy',
  array['member']::text[],
  'deny',
  false,
  10,
  true
where not exists (
  select 1
  from public.sensitive_field_policies
  where name = 'TEST_DENY_COPY_SICIL'
);

-- 2) Shadow farklı karar kartı için doğrudan mismatch test kaydı ekle
--    legacy=allow, policy=deny olacak şekilde
insert into public.pii_policy_shadow_log
  (user_id, user_email, field_name, action, legacy_decision, policy_decision, policy_id, enforced, context)
select
  null,
  'shadow-test@example.com',
  'SICIL NO',
  'copy',
  'allow',
  'deny',
  (
    select id
    from public.sensitive_field_policies
    where name = 'TEST_DENY_COPY_SICIL'
    limit 1
  ),
  false,
  jsonb_build_object('test_tag', 'PII_SHADOW_AUDIT_TEST_PACK', 'source', 'manual-seed')
where not exists (
  select 1
  from public.pii_policy_shadow_log
  where user_email = 'shadow-test@example.com'
    and field_name = 'SICIL NO'
    and context ->> 'test_tag' = 'PII_SHADOW_AUDIT_TEST_PACK'
);

-- 3) Audit uyarı kartı için bilerek bozuk PII access log kaydı ekle
--    record_count=0 => invalid_record_count uyarısı üretir
insert into public.pii_access_log
  (user_id, user_email, action, field_name, record_id, record_count)
select
  null,
  'audit-test@example.com',
  'copy',
  '__audit_test__',
  null,
  0
where not exists (
  select 1
  from public.pii_access_log
  where user_email = 'audit-test@example.com'
    and field_name = '__audit_test__'
    and record_count = 0
);

-- =============================================================================
-- VERIFY
-- =============================================================================

-- Kartları besleyen sayıların hızlı kontrolü
select count(*) as active_policy_count
from public.sensitive_field_policies
where enabled = true;

select count(*) as shadow_mismatch_count
from public.pii_policy_shadow_log
where legacy_decision <> policy_decision;

select count(*) as audit_issue_count
from public.pii_access_log_validation_issues;

-- Seed edilen test kayıtlarının görünümü
select id, name, action, decision, priority, enabled
from public.sensitive_field_policies
where name in ('TEST_ALLOW_COPY_SICIL', 'TEST_DENY_COPY_SICIL')
order by priority asc;

select id, user_email, field_name, action, legacy_decision, policy_decision, at
from public.pii_policy_shadow_log
where context ->> 'test_tag' = 'PII_SHADOW_AUDIT_TEST_PACK'
order by at desc;

select id, user_email, action, field_name, record_count, at
from public.pii_access_log
where user_email = 'audit-test@example.com'
  and field_name = '__audit_test__'
order by at desc;

-- =============================================================================
-- CLEANUP
-- =============================================================================
-- Test bitince aşağıdaki bölümü çalıştır.
/*
delete from public.pii_policy_shadow_log
where context ->> 'test_tag' = 'PII_SHADOW_AUDIT_TEST_PACK'
   or user_email = 'shadow-test@example.com';

delete from public.pii_access_log
where user_email = 'audit-test@example.com'
  and field_name = '__audit_test__';

delete from public.sensitive_field_policies
where name in ('TEST_ALLOW_COPY_SICIL', 'TEST_DENY_COPY_SICIL');

-- Cleanup sonrası tekrar kontrol
select count(*) as remaining_test_policies
from public.sensitive_field_policies
where name in ('TEST_ALLOW_COPY_SICIL', 'TEST_DENY_COPY_SICIL');
*/

