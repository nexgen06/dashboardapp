-- Tek seferlik temizlik: workflow bildirimlerinde title içindeki uzun e-postayı
-- kullanıcının görünür adıyla değiştirir ve payload.actor_display_name'i doldurur.
--
-- Bu script yalnızca create_workflow_notification RPC'sinin eski (display_name'siz)
-- sürümüyle yazılmış bildirimler için gerekli. Yeni gelen bildirimler RPC tarafından
-- zaten doğru üretilir.
--
-- Idempotent: actor_display_name zaten doluysa veya title içinde e-posta geçmiyorsa
-- satır atlanır. Tekrar tekrar çalıştırılabilir.
--
-- Çalıştırma: Supabase SQL Editor > yapıştır > Run.
-- Önizleme için önce SELECT bloğunu, sonra UPDATE bloğunu çalıştırın.

-- =============================================================================
-- 1) ÖNİZLEME (opsiyonel) — kaç satır etkilenecek ve nasıl?
-- =============================================================================
-- Aşağıdaki SELECT'i çalıştırıp etkilenecek satırları görebilirsiniz:
/*
select
  n.id,
  n.title                                   as old_title,
  n.payload->>'actor_email'                 as actor_email,
  coalesce(
    nullif(trim(p.nickname), ''),
    nullif(trim(p.full_name), ''),
    split_part(n.payload->>'actor_email', '@', 1),
    'Bir kullanıcı'
  )                                          as display_name,
  replace(
    n.title,
    n.payload->>'actor_email',
    coalesce(
      nullif(trim(p.nickname), ''),
      nullif(trim(p.full_name), ''),
      split_part(n.payload->>'actor_email', '@', 1),
      'Bir kullanıcı'
    )
  )                                          as new_title
from public.notifications n
left join public.profiles p
  on lower(trim(p.email)) = lower(trim(n.payload->>'actor_email'))
where n.type = 'workflow'
  and n.payload ? 'actor_email'
  and n.payload->>'actor_email' is not null
  and n.payload->>'actor_email' <> ''
  and (
    n.payload->>'actor_display_name' is null
    or trim(n.payload->>'actor_display_name') = ''
  )
  and n.title like '%' || (n.payload->>'actor_email') || '%'
order by n.created_at desc
limit 200;
*/

-- =============================================================================
-- 2) UPDATE — title'ı kısaltır, payload'a actor_display_name yazar
-- =============================================================================
with candidates as (
  select
    n.id,
    n.title,
    n.payload,
    n.payload->>'actor_email' as actor_email,
    coalesce(
      nullif(trim(p.nickname), ''),
      nullif(trim(p.full_name), ''),
      split_part(n.payload->>'actor_email', '@', 1),
      'Bir kullanıcı'
    ) as display_name
  from public.notifications n
  left join public.profiles p
    on lower(trim(p.email)) = lower(trim(n.payload->>'actor_email'))
  where n.type = 'workflow'
    and n.payload ? 'actor_email'
    and n.payload->>'actor_email' is not null
    and n.payload->>'actor_email' <> ''
    and (
      n.payload->>'actor_display_name' is null
      or trim(n.payload->>'actor_display_name') = ''
    )
)
update public.notifications n
set
  title = case
    when n.title like '%' || c.actor_email || '%' and c.display_name <> c.actor_email
      then replace(n.title, c.actor_email, c.display_name)
    else n.title
  end,
  payload = n.payload || jsonb_build_object('actor_display_name', c.display_name)
from candidates c
where n.id = c.id;

-- =============================================================================
-- 3) Bilgi: kaç satır güncellendi?
-- =============================================================================
do $$
declare
  total_workflow integer;
  enriched integer;
begin
  select count(*) into total_workflow
  from public.notifications
  where type = 'workflow';

  select count(*) into enriched
  from public.notifications
  where type = 'workflow'
    and payload->>'actor_display_name' is not null
    and trim(payload->>'actor_display_name') <> '';

  raise notice 'Toplam workflow bildirimi: %, actor_display_name dolu olan: %', total_workflow, enriched;
end $$;
