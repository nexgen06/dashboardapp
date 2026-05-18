-- project_columns: dinamik sütun tipleri sistemi
-- Her projenin ek (extra_data) sütunlarına tip ve konfig ataması.
-- Mevcut extra_data JSON aynen kalır; bu tablo "schema metadata" katmanıdır.

CREATE TABLE IF NOT EXISTS public.project_columns (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key         text        NOT NULL CHECK (length(trim(key)) > 0),
  /* tip — sabit liste, gelecekte yeni tip eklenirse CHECK genişler */
  type        text        NOT NULL DEFAULT 'text'
              CHECK (type IN (
                'text','number','date','select','multi_select',
                'checkbox','url','email','person','progress','formula'
              )),
  /* config: tipe göre — select için { options: [...] }, number için { format, decimals }, vb. */
  config      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  position    integer     NOT NULL DEFAULT 0,
  required    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

COMMENT ON TABLE  public.project_columns IS 'Dinamik sütun tipleri — extra_data JSON üstüne schema metadata';
COMMENT ON COLUMN public.project_columns.key IS 'extra_data JSON anahtarı (aynı string)';
COMMENT ON COLUMN public.project_columns.config IS 'tipe göre konfig: select={options}, number={format,decimals}, formula={expression}';

CREATE INDEX IF NOT EXISTS project_columns_project_idx
  ON public.project_columns (project_id, position);

-- updated_at otomatik
CREATE OR REPLACE FUNCTION public.project_columns_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_columns_touch_trg ON public.project_columns;
CREATE TRIGGER project_columns_touch_trg
  BEFORE UPDATE ON public.project_columns
  FOR EACH ROW EXECUTE FUNCTION public.project_columns_touch();

-- RLS
ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_columns_select ON public.project_columns;
DROP POLICY IF EXISTS project_columns_write  ON public.project_columns;

-- SELECT: projeye erişebilen herkes okur
CREATE POLICY project_columns_select
  ON public.project_columns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_columns.project_id)
  );

-- INSERT/UPDATE/DELETE: admin veya project_manager
CREATE POLICY project_columns_write
  ON public.project_columns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role_id IN ('admin','project_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role_id IN ('admin','project_manager')
    )
  );
