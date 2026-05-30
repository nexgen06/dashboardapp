-- E-posta / mail durumu sistem çip şablonu + 4 hazır seçenek.
-- Idempotent: chip-system.sql ile aynı upsert mantığı.
--
-- KULLANIM: Supabase SQL Editor'da çalıştırın.
-- Sonra Çip Kütüphanesi'nde "E-posta" şablonunu ve seçenekleri görün.

insert into public.chip_templates (name, category, description, icon, color, is_system, manager_only)
values
  ('E-posta', 'email', 'Giden e-posta / bildirim durumu takibi', 'check-circle', 'cyan', true, false)
on conflict (category, name) do update set
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  is_system = excluded.is_system,
  manager_only = excluded.manager_only;

insert into public.chip_options (template_id, label, value, color, icon, sort_order, is_terminal)
select t.id, v.label, v.value, v.color, v.icon, v.sort_order, v.is_terminal
from public.chip_templates t
join (
  values
    ('email','E-posta','Gönderilmedi','not_sent','slate','circle',10,false),
    ('email','E-posta','Gönderim bekliyor','pending','amber','clock',20,false),
    ('email','E-posta','Mail gönderildi','sent','emerald','check',30,true),
    ('email','E-posta','Gönderilemedi','failed','red','x-circle',40,true)
) as v(category, template_name, label, value, color, icon, sort_order, is_terminal)
  on t.category = v.category and t.name = v.template_name
on conflict (template_id, value) do update set
  label = excluded.label,
  color = excluded.color,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_terminal = excluded.is_terminal;
