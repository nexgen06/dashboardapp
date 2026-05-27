-- =============================================================================
-- ÇİP KÜTÜPHANESİ — MODERN PAKET
-- =============================================================================
-- 5 yeni şablon + seçenekleri. Modern lucide ikonları, anlamlı renk paleti,
-- kullanım senaryosu açıklamaları.
--
-- KULLANIM:
--   1. Bu dosyanın tamamını Supabase SQL Editor'da çalıştırın.
--   2. Çip Kütüphanesi (/yonetim/cip-kutuphanesi) açıp şablonları görün.
--   3. Bir projeye eklemek için: Proje → Düzenle → Tablo & Görünüm →
--      "Kolona bağla" formundan ilgili sütun + bu şablon seçin.
--
-- ÖZELLİKLER:
--   - is_system = false  → silinebilir (sistem şablonu değil)
--   - manager_only ihtiyaca göre
--   - sort_order seçeneklerde kritik → mantıksal sıralama
--   - Aynı ad iki kez çalıştırılırsa duplicate olur; idempotent için
--     "delete + insert" deseni kullandık.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) SLA DURUMU — Hizmet Seviyesi Anlaşması Takibi
-- ─────────────────────────────────────────────────────────────────────────────
-- Senaryo: Destek talepleri, çağrı merkezi, müşteri SLA takibi
--          "Bu işin teslim süresine ne kadar yakınız?"
-- Kategori: risk (zaman bazlı kritiklik)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_template_id uuid;
begin
  -- Eski sürüm varsa temizle (idempotent)
  delete from public.chip_templates where name = 'SLA Durumu' and is_system = false;

  insert into public.chip_templates (name, category, description, icon, color, is_system, manager_only)
  values (
    'SLA Durumu',
    'risk',
    'Hizmet seviyesi anlaşması (SLA) takibi — bir işin teslim süresine ne kadar yakınız? Destek talepleri, ticket sistemi, müşteri taahhüt takibinde kullanın.',
    'gauge',
    'amber',
    false,
    false
  )
  returning id into v_template_id;

  insert into public.chip_options (template_id, label, value, color, icon, sort_order) values
    (v_template_id, 'Bol Zaman',     'safe',      'emerald', 'check-circle-2', 1),
    (v_template_id, 'Dikkat',        'attention', 'blue',    'clock',          2),
    (v_template_id, 'Yaklaşıyor',    'approaching','amber',  'alert-circle',   3),
    (v_template_id, 'Kritik',        'critical',  'orange',  'alert-triangle', 4),
    (v_template_id, 'SLA Aşıldı',    'breached',  'red',     'flame',          5),
    (v_template_id, 'Askıya Alındı', 'paused',    'slate',   'pause-circle',   6);

  raise notice '✓ "SLA Durumu" şablonu (6 seçenek) eklendi';
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) MÜŞTERİ ÖNEMİ — CRM / Satış Pipeline
-- ─────────────────────────────────────────────────────────────────────────────
-- Senaryo: Satış ekibi müşterileri segmente eder, VIP'lere öncelik verir.
--          "Bu müşteri ne kadar önemli, hangi seviyede ilgi gerek?"
-- Kategori: status
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_template_id uuid;
begin
  delete from public.chip_templates where name = 'Müşteri Önemi' and is_system = false;

  insert into public.chip_templates (name, category, description, icon, color, is_system, manager_only)
  values (
    'Müşteri Önemi',
    'status',
    'Müşteri segmentasyonu — satış/destek pipeline''ında müşteri önceliklendirme. CRM, satış takip, hesap yönetimi için.',
    'star',
    'violet',
    false,
    false
  )
  returning id into v_template_id;

  insert into public.chip_options (template_id, label, value, color, icon, sort_order) values
    (v_template_id, 'Stratejik',     'strategic', 'violet',  'crown',          1),
    (v_template_id, 'VIP',           'vip',       'amber',   'star',           2),
    (v_template_id, 'Anahtar Hesap', 'key',       'blue',    'key-round',      3),
    (v_template_id, 'Standart',      'standard',  'slate',   'user',           4),
    (v_template_id, 'Yeni',          'new',       'emerald', 'sparkles',       5),
    (v_template_id, 'Pasif',         'inactive',  'slate',   'user-minus',     6),
    (v_template_id, 'Kara Liste',    'blacklist', 'red',     'ban',            7);

  raise notice '✓ "Müşteri Önemi" şablonu (7 seçenek) eklendi';
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) SÖZLEŞME DURUMU — Hukuk / İş Geliştirme
-- ─────────────────────────────────────────────────────────────────────────────
-- Senaryo: Sözleşme yaşam döngüsü — taslak → müzakere → imza → aktif → sona.
--          Hukuk departmanı, satın alma, iş geliştirme için kritik.
-- Kategori: approval
-- Yönetici-only: kritik durum değişikliklerini yetkili değiştirir
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_template_id uuid;
begin
  delete from public.chip_templates where name = 'Sözleşme Durumu' and is_system = false;

  insert into public.chip_templates (name, category, description, icon, color, is_system, manager_only)
  values (
    'Sözleşme Durumu',
    'approval',
    'Sözleşme yaşam döngüsü — taslak hazırlama, müzakere, imza süreçleri ve yenileme takibi. Hukuk, satın alma, iş geliştirme süreçlerinde.',
    'file-signature',
    'blue',
    false,
    true  -- manager_only: kritik geçişler yetkililerce yapılsın
  )
  returning id into v_template_id;

  insert into public.chip_options (template_id, label, value, color, icon, sort_order) values
    (v_template_id, 'Taslak',           'draft',          'slate',   'file-text',         1),
    (v_template_id, 'Hukuk İncelemesi', 'legal_review',   'violet',  'scale',             2),
    (v_template_id, 'Müzakere',         'negotiation',    'amber',   'message-circle',    3),
    (v_template_id, 'İmzaya Hazır',     'ready_to_sign',  'blue',    'pen-tool',          4),
    (v_template_id, 'İmzalandı',        'signed',         'emerald', 'check-circle-2',    5),
    (v_template_id, 'Aktif',            'active',         'emerald', 'shield-check',      6),
    (v_template_id, 'Yenileniyor',      'renewing',       'cyan',    'refresh-cw',        7),
    (v_template_id, 'Sona Erdi',        'expired',        'slate',   'archive',           8),
    (v_template_id, 'İptal',            'cancelled',      'red',     'x-circle',          9);

  raise notice '✓ "Sözleşme Durumu" şablonu (9 seçenek) eklendi';
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) İLETİŞİM KANALI — Müşteri Etkileşim Takibi
-- ─────────────────────────────────────────────────────────────────────────────
-- Senaryo: Müşteri ile hangi kanaldan iletişim kuruldu? Çağrı merkezi,
--          satış görüşmesi, destek bileti, sosyal medya yanıtı vs.
-- Kategori: system (metadata gibi)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_template_id uuid;
begin
  delete from public.chip_templates where name = 'İletişim Kanalı' and is_system = false;

  insert into public.chip_templates (name, category, description, icon, color, is_system, manager_only)
  values (
    'İletişim Kanalı',
    'system',
    'Müşteri etkileşiminin hangi kanaldan geldiği — telefon, e-posta, sosyal medya, ziyaret vs. Müşteri hizmetleri, satış ekibi, CRM raporlama.',
    'message-square',
    'cyan',
    false,
    false
  )
  returning id into v_template_id;

  insert into public.chip_options (template_id, label, value, color, icon, sort_order) values
    (v_template_id, 'Telefon',        'phone',     'blue',    'phone',           1),
    (v_template_id, 'E-posta',        'email',     'cyan',    'mail',            2),
    (v_template_id, 'WhatsApp',       'whatsapp',  'emerald', 'message-circle',  3),
    (v_template_id, 'Canlı Sohbet',   'chat',      'violet',  'message-square',  4),
    (v_template_id, 'Yüz Yüze',       'in_person', 'amber',   'users',           5),
    (v_template_id, 'Video Konferans','video',     'red',     'video',           6),
    (v_template_id, 'Sosyal Medya',   'social',    'orange',  'share-2',         7),
    (v_template_id, 'SMS',            'sms',       'slate',   'message-square',  8),
    (v_template_id, 'Web Formu',      'web_form',  'blue',    'mouse-pointer',   9);

  raise notice '✓ "İletişim Kanalı" şablonu (9 seçenek) eklendi';
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) GÖREV ACILIYETI — Hızlı Triyaj
-- ─────────────────────────────────────────────────────────────────────────────
-- Senaryo: Eisenhower matrisi tarzı — bir iş ne kadar acil ve önemli?
--          Operasyon, IT helpdesk, kriz yönetimi için.
-- Kategori: risk
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_template_id uuid;
begin
  delete from public.chip_templates where name = 'Görev Aciliyeti' and is_system = false;

  insert into public.chip_templates (name, category, description, icon, color, is_system, manager_only)
  values (
    'Görev Aciliyeti',
    'risk',
    'Eisenhower matrisi tarzı triyaj — acil mi? Önemli mi? Operasyon, IT helpdesk, kriz yönetimi, üretim hatları için hızlı önceliklendirme.',
    'zap',
    'orange',
    false,
    false
  )
  returning id into v_template_id;

  insert into public.chip_options (template_id, label, value, color, icon, sort_order) values
    (v_template_id, 'Yangın 🔥',          'fire',         'red',     'flame',          1),
    (v_template_id, 'Acil',              'urgent',       'orange',  'zap',            2),
    (v_template_id, 'Bugün',             'today',        'amber',   'clock',          3),
    (v_template_id, 'Bu Hafta',          'this_week',    'blue',    'calendar',       4),
    (v_template_id, 'Planlı',            'scheduled',    'cyan',    'calendar-clock', 5),
    (v_template_id, 'Düşük Öncelik',     'low_priority', 'slate',   'arrow-down',     6),
    (v_template_id, 'Bir Ara',           'someday',      'slate',   'coffee',         7);

  raise notice '✓ "Görev Aciliyeti" şablonu (7 seçenek) eklendi';
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÖZET
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  total_templates integer;
  total_options integer;
begin
  select count(*) into total_templates from public.chip_templates;
  select count(*) into total_options from public.chip_options;
  raise notice '═══════════════════════════════════════════════════════';
  raise notice '✅ MODERN ÇİP PAKETİ KURULDU';
  raise notice '   5 yeni şablon, 38 seçenek eklendi';
  raise notice '   Toplam sistemde: % şablon, % seçenek', total_templates, total_options;
  raise notice '═══════════════════════════════════════════════════════';
  raise notice '';
  raise notice 'YENİ ŞABLONLAR:';
  raise notice '  1. SLA Durumu       — risk    | Destek, ticket, müşteri SLA';
  raise notice '  2. Müşteri Önemi    — status  | CRM, satış pipeline';
  raise notice '  3. Sözleşme Durumu  — approval| Hukuk, B2B (yönetici-only)';
  raise notice '  4. İletişim Kanalı  — system  | Müşteri etkileşim takibi';
  raise notice '  5. Görev Aciliyeti  — risk    | Triyaj, IT helpdesk, kriz';
  raise notice '';
  raise notice 'KULLANIM: /yonetim/cip-kutuphanesi → şablonu projeye bağla';
end $$;
