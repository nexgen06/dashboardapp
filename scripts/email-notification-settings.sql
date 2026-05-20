-- =============================================================================
-- E-posta bildirim ayarları — her olay tipi için aç/kapa kontrolü.
-- =============================================================================
-- Phase 1: SADECE ayar altyapısı. Henüz e-posta gönderimi yok.
-- Tüm olaylar varsayılan KAPALI. Süper admin tek tek açar, test eder.
-- Çalıştır: Supabase Studio > SQL Editor > yapıştır > Run. Idempotent.

CREATE TABLE IF NOT EXISTS public.email_notification_settings (
  event_key    text        PRIMARY KEY,
  enabled      boolean     NOT NULL DEFAULT false,
  display_name text        NOT NULL,
  description  text,
  recipient    text        NOT NULL,  -- kime gidiyor (insan-okunabilir not)
  updated_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.email_notif_settings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_notif_settings_touch_trg ON public.email_notification_settings;
CREATE TRIGGER email_notif_settings_touch_trg
  BEFORE UPDATE ON public.email_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.email_notif_settings_touch_updated_at();

-- RLS
ALTER TABLE public.email_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_notif_settings_select_authenticated ON public.email_notification_settings;
DROP POLICY IF EXISTS email_notif_settings_update_admin         ON public.email_notification_settings;

-- Select: tüm authenticated (özellikle send-edge-function ileride okuyacak)
CREATE POLICY email_notif_settings_select_authenticated
  ON public.email_notification_settings
  FOR SELECT TO authenticated
  USING (true);

-- Update: sadece admin
CREATE POLICY email_notif_settings_update_admin
  ON public.email_notification_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
  );

-- Ön yükleme: tüm olay tipleri, hepsi KAPALI
INSERT INTO public.email_notification_settings (event_key, enabled, display_name, description, recipient) VALUES
  ('announcement_new',    false, 'Yeni duyuru yayımlandı', 'Admin yeni bir duyuru oluşturduğunda', 'Tüm aktif kullanıcılar'),
  ('task_assigned',       false, 'Yeni görev atandı',      'Bir görev belirli bir kullanıcıya atandığında', 'Görevin atananı'),
  ('project_assigned',    false, 'Yeni proje atandı',      'Bir kullanıcı projeye atandığında', 'Projeye eklenen kişi'),
  ('task_overdue',        false, 'Görev süresi geçti',     'Atanmış görevin due_date günü gelip henüz tamamlanmamışsa', 'Görevin atananı'),
  ('comment_new',         false, 'Yeni yorum eklendi',     'Bir göreve yeni yorum eklendiğinde', 'Görevin atananı + diğer yorumcular'),
  ('feedback_reply',      false, 'Geri bildirime cevap',   'Yönetici bir feedback''e yanıt yazdığında', 'Feedback''i gönderen'),
  ('daily_digest',        false, 'Günlük özet',            'Her sabah 09:00 — okunmamış bildirimlerin özeti', 'Tüm aktif kullanıcılar')
ON CONFLICT (event_key) DO NOTHING;

COMMENT ON TABLE public.email_notification_settings IS
  'Her e-posta olayı için aç/kapa kontrolü. Sadece admin günceller. Phase 1: sadece ayarlar; gönderme henüz yok.';
