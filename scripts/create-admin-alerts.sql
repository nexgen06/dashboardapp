-- Yönetici bildirimleri: bir üye tüm atanan görevlerini tamamlayınca kayıt (+ istemci RPC).
-- Önkoşul: scripts/supabase-rls-policies.sql (is_app_admin, auth_email_lower)

CREATE OR REPLACE FUNCTION public.task_row_status_is_completed (p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT LOWER(TRIM(COALESCE(p_status, ''))) IN (
    'tamamlandı',
    'tamamlandi',
    'yapıldı',
    'yapildi',
    'done',
    'completed'
  );
$$;

REVOKE ALL ON FUNCTION public.task_row_status_is_completed (text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.task_row_status_is_completed (text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'user_all_tasks_done',
  actor_email text NOT NULL,
  actor_display text,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_alert_reads (
  alert_id uuid NOT NULL REFERENCES public.admin_alerts (id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, reader_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON public.admin_alerts (created_at DESC);

COMMENT ON TABLE public.admin_alerts IS 'Yöneticilere gösterilecek özet olaylar (ör. üye tüm atanan görevlerini tamamladı).';
COMMENT ON TABLE public.admin_alert_reads IS 'Hangi yöneticinin hangi bildirimi okuduğu (zil rozeti için).';

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_alert_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_alerts_select_admin ON public.admin_alerts;
DROP POLICY IF EXISTS admin_alerts_insert_denied ON public.admin_alerts;
DROP POLICY IF EXISTS admin_alert_reads_select_own ON public.admin_alert_reads;
DROP POLICY IF EXISTS admin_alert_reads_insert_own ON public.admin_alert_reads;

CREATE POLICY admin_alerts_select_admin ON public.admin_alerts
  FOR SELECT TO authenticated USING (public.is_app_admin ());

CREATE POLICY admin_alerts_insert_denied ON public.admin_alerts
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY admin_alert_reads_select_own ON public.admin_alert_reads
  FOR SELECT TO authenticated USING (reader_id = auth.uid () AND public.is_app_admin ());

CREATE POLICY admin_alert_reads_insert_own ON public.admin_alert_reads
  FOR INSERT TO authenticated WITH CHECK (reader_id = auth.uid () AND public.is_app_admin ());

DROP POLICY IF EXISTS admin_alert_reads_update_own ON public.admin_alert_reads;
CREATE POLICY admin_alert_reads_update_own ON public.admin_alert_reads
  FOR UPDATE TO authenticated USING (reader_id = auth.uid () AND public.is_app_admin ())
  WITH CHECK (reader_id = auth.uid () AND public.is_app_admin ());

CREATE OR REPLACE FUNCTION public.notify_admins_user_completed_all_tasks ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_display text;
  open_cnt int;
  assigned_cnt int;
BEGIN
  v_email := public.auth_email_lower ();
  IF v_email IS NULL THEN
    RETURN;
  END IF;

  IF public.is_app_admin () THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO assigned_cnt
  FROM public.tasks t
  WHERE t.assignee IS NOT NULL
    AND LOWER(TRIM(t.assignee)) = v_email;

  IF assigned_cnt = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO open_cnt
  FROM public.tasks t
  WHERE t.assignee IS NOT NULL
    AND LOWER(TRIM(t.assignee)) = v_email
    AND NOT public.task_row_status_is_completed (t.status);

  IF open_cnt > 0 THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.admin_alerts a
    WHERE
      a.kind = 'user_all_tasks_done'
      AND LOWER(TRIM(a.actor_email)) = v_email
      AND a.created_at > now() - interval '24 hours'
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(p.email), ''), v_email)
  INTO v_display
  FROM public.profiles p
  WHERE p.id = auth.uid ()
  LIMIT 1;

  IF v_display IS NULL THEN
    v_display := v_email;
  END IF;

  INSERT INTO public.admin_alerts (kind, actor_email, actor_display, summary)
  VALUES (
    'user_all_tasks_done',
    v_email,
    v_display,
    v_display || ' tüm atanan görevlerini tamamladı.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_user_completed_all_tasks () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_user_completed_all_tasks () TO authenticated;

GRANT SELECT ON TABLE public.admin_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.admin_alert_reads TO authenticated;
