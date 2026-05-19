-- Proje şablonları: bir projenin şemasını (ad hariç) + opsiyonel görev seti olarak
-- kaydedip "Yeni proje" sırasında çoğaltmak için.
-- Çalışır: Supabase Studio > SQL Editor > yapıştır > Run
-- Idempotent: tekrar çalıştırılabilir.

-- 1) Tablo
CREATE TABLE IF NOT EXISTS public.project_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope         text        NOT NULL DEFAULT 'private' CHECK (scope IN ('private','shared')),
  name          text        NOT NULL CHECK (length(trim(name)) > 0),
  description   text,
  -- Şablon proje şeması: status, priority, due_date offset, assigned_emails, extra_column_keys,
  -- title_column, subtitle_columns, wip_in_progress_limit, strict_assignee_visibility.
  template_data jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Görev tanımları dizisi: her biri { content, status, priority, assignee, extra_data,
  -- due_offset_days } (görev oluştuğunda due_date = bugün + due_offset_days)
  tasks         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2) İndeksler
CREATE INDEX IF NOT EXISTS project_templates_user_idx  ON public.project_templates (user_id);
CREATE INDEX IF NOT EXISTS project_templates_scope_idx ON public.project_templates (scope);

-- 3) updated_at otomatik
CREATE OR REPLACE FUNCTION public.project_templates_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_templates_touch_trg ON public.project_templates;
CREATE TRIGGER project_templates_touch_trg
  BEFORE UPDATE ON public.project_templates
  FOR EACH ROW EXECUTE FUNCTION public.project_templates_touch_updated_at();

-- 4) RLS — saved_views ile aynı pattern (private = sadece sahip; shared = tüm authenticated)
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_templates_select ON public.project_templates;
DROP POLICY IF EXISTS project_templates_insert ON public.project_templates;
DROP POLICY IF EXISTS project_templates_update ON public.project_templates;
DROP POLICY IF EXISTS project_templates_delete ON public.project_templates;

CREATE POLICY project_templates_select
  ON public.project_templates
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR scope = 'shared');

CREATE POLICY project_templates_insert
  ON public.project_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY project_templates_update
  ON public.project_templates
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    ))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    ))
  );

CREATE POLICY project_templates_delete
  ON public.project_templates
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (scope = 'shared' AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role_id = 'admin'
    ))
  );

COMMENT ON TABLE public.project_templates IS
  'Proje şablonları: bir projeyi (şema + görev listesi) yeniden kullanmak için.';
