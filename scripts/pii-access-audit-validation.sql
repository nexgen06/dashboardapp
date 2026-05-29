-- =============================================================================
-- PII access log dogrulama gorunumu
-- =============================================================================
-- Amaç: pii_access_log kayitlarinda eksik/bozuk satirlari admin panelinden
-- hizla gorebilmek.

create or replace view public.pii_access_log_validation_issues as
select
  l.id,
  l.user_id,
  l.user_email,
  l.action,
  l.field_name,
  l.record_id,
  l.record_count,
  l.at,
  array_remove(array[
    case when coalesce(trim(l.user_email), '') = '' then 'missing_user_email' end,
    case when l.action not in ('copy', 'unmask', 'export') then 'invalid_action' end,
    case when coalesce(trim(l.field_name), '') = '' then 'missing_field_name' end,
    case when coalesce(l.record_count, 0) < 1 then 'invalid_record_count' end
  ], null) as issues
from public.pii_access_log l
where
  coalesce(trim(l.user_email), '') = ''
  or l.action not in ('copy', 'unmask', 'export')
  or coalesce(trim(l.field_name), '') = ''
  or coalesce(l.record_count, 0) < 1;

grant select on public.pii_access_log_validation_issues to authenticated;

comment on view public.pii_access_log_validation_issues is
  'PII access log satirlarindaki veri butunlugu sorunlarini listeler.';
