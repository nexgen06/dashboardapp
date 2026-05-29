-- Bildirimler Faz 2 — kurulum doğrulama paketi
-- Önkoşul: scripts/notifications.sql + scripts/notifications-assignment-triggers.sql
-- Supabase SQL Editor'da çalıştırın.

-- 1) Faz 2 durum özeti
select public.notification_phase2_status() as phase2_status;

-- 2) Tetikleyici varlığı
select tgname, tgrelid::regclass as table_name, tgenabled
from pg_trigger
where tgname in (
  'notifications_project_assignments_trg',
  'notifications_task_assignee_trg'
)
order by tgname;

-- 3) Son 24 saatte üretilen atama bildirimleri (örnek)
select type, count(*) as cnt, max(created_at) as last_at
from public.notifications
where type in ('project_assigned', 'task_assigned', 'overdue')
  and created_at >= now() - interval '24 hours'
group by type
order by type;

-- 4) Manuel gecikme taraması (cron yedeği)
-- select public.refresh_overdue_task_notifications();
