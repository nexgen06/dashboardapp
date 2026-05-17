-- =============================================================================
-- Audit Log — Kim, neyi, ne zaman değiştirdi?
-- =============================================================================
-- Görev (tasks) ve projeler (projects) için otomatik değişim kaydı.
-- DB seviyesinde trigger ile çalışır → server kod değişikliğine gerek yok.
--
-- Kullanım:
--   psql / Supabase Studio → bu dosyayı çalıştır (idempotent).
--
-- Geri alma:
--   DROP TRIGGER tasks_audit_trg ON public.tasks;
--   DROP TRIGGER projects_audit_trg ON public.projects;
--   DROP FUNCTION public.log_record_change();
--   DROP TABLE public.audit_log;
-- =============================================================================

-- 1) Tablo --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     text,                -- snapshot — actor silinirse de korunur
  table_name      text        NOT NULL,
  record_id       uuid        NOT NULL,
  action          text        NOT NULL CHECK (action IN ('insert','update','delete')),
  /**
   * changed_fields:
   *  - INSERT: { "_full": <NEW satırın özet snapshot'ı> }
   *  - UPDATE: { "alan_adı": { "before": ..., "after": ... }, ... }
   *  - DELETE: { "_full": <OLD satırın özet snapshot'ı> }
   * extra_data alanı içinde hassas key'ler (TCKN/sicil) maskelenmiş gelmez —
   * bu maskeleme istemci tarafında okuma sırasında uygulanır (lib/auditLog).
   */
  changed_fields  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.audit_log IS 'Kim/ne/ne zaman değiştirdi — tasks + projects için otomatik kayıt';
COMMENT ON COLUMN public.audit_log.changed_fields IS 'UPDATE için { alan: { before, after } }; INSERT/DELETE için { _full: snapshot }';

-- 2) İndeksler ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON public.audit_log (table_name, record_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx  ON public.audit_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_at_idx     ON public.audit_log (at DESC);

-- 3) Tetikleyici fonksiyon ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_record_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- trigger her zaman çalışsın (RLS okunan policy DEFINER ile çalışır)
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid;
  v_actor_email text;
  v_changed     jsonb := '{}'::jsonb;
  v_field       text;
  v_new_value   jsonb;
  v_old_value   jsonb;
  v_skip_fields text[] := ARRAY['id','created_at','updated_at'];
BEGIN
  -- Actor: auth.uid() varsa kullan; yoksa NULL kalır (örn. service_role veya migration)
  BEGIN
    v_actor_id := auth.uid();
    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
    v_actor_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (actor_id, actor_email, table_name, record_id, action, changed_fields)
    VALUES (
      v_actor_id, v_actor_email, TG_TABLE_NAME, NEW.id, 'insert',
      jsonb_build_object('_full', to_jsonb(NEW) - 'id' - 'created_at' - 'updated_at')
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (actor_id, actor_email, table_name, record_id, action, changed_fields)
    VALUES (
      v_actor_id, v_actor_email, TG_TABLE_NAME, OLD.id, 'delete',
      jsonb_build_object('_full', to_jsonb(OLD) - 'id' - 'created_at' - 'updated_at')
    );
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Sadece gerçekten değişen alanları diff'le
    FOR v_field IN
      SELECT key FROM jsonb_each(to_jsonb(NEW))
    LOOP
      IF v_field = ANY(v_skip_fields) THEN CONTINUE; END IF;
      v_new_value := to_jsonb(NEW) -> v_field;
      v_old_value := to_jsonb(OLD) -> v_field;
      IF v_new_value IS DISTINCT FROM v_old_value THEN
        v_changed := v_changed || jsonb_build_object(
          v_field,
          jsonb_build_object('before', v_old_value, 'after', v_new_value)
        );
      END IF;
    END LOOP;

    -- Hiçbir alan değişmediyse log yazma
    IF v_changed = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.audit_log (actor_id, actor_email, table_name, record_id, action, changed_fields)
    VALUES (v_actor_id, v_actor_email, TG_TABLE_NAME, NEW.id, 'update', v_changed);

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.log_record_change() IS 'Otomatik audit_log kayıt — INSERT/UPDATE/DELETE için her tabloya bağlanır';

-- 4) Tetikleyiciler ----------------------------------------------------------
DROP TRIGGER IF EXISTS tasks_audit_trg    ON public.tasks;
CREATE TRIGGER tasks_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_record_change();

DROP TRIGGER IF EXISTS projects_audit_trg ON public.projects;
CREATE TRIGGER projects_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_record_change();

-- 5) RLS — kullanıcı SADECE erişebildiği record'ların log'unu görür ----------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Eski politikalar varsa düşür (idempotent re-run için)
DROP POLICY IF EXISTS audit_log_select_visible ON public.audit_log;

-- SELECT: actor kendisiyse ya da hedef kayda erişimi varsa görür
CREATE POLICY audit_log_select_visible
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    -- 1) Kendi yaptığı işlemler her zaman görünür
    actor_id = auth.uid()
    -- 2) Admin'ler her şeyi görür
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    )
    -- 3) Görev log'u: o göreve erişimi varsa
    OR (
      table_name = 'tasks' AND EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = audit_log.record_id
      )
    )
    -- 4) Proje log'u: o projeye erişimi varsa
    OR (
      table_name = 'projects' AND EXISTS (
        SELECT 1 FROM public.projects p WHERE p.id = audit_log.record_id
      )
    )
  );

-- INSERT/UPDATE/DELETE: kimse log'a doğrudan yazamaz/değişemez (sadece trigger)
DROP POLICY IF EXISTS audit_log_no_direct_write ON public.audit_log;
CREATE POLICY audit_log_no_direct_write
  ON public.audit_log
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 6) Realtime publication'a ekle (anlık timeline güncellemesi için) ----------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Zaten ekliyse sessiz geç
  NULL;
END $$;

-- =============================================================================
-- Bitti. Test:
--   UPDATE tasks SET status = 'Tamamlandı' WHERE id = '...';
--   SELECT * FROM audit_log WHERE table_name = 'tasks' AND record_id = '...' ORDER BY at DESC LIMIT 5;
-- =============================================================================
