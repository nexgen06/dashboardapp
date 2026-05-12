CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  display_name text,
  role_id text NOT NULL DEFAULT 'member',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.admin_set_role (target_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF new_role NOT IN ('admin', 'project_manager', 'member', 'viewer') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_id = 'admin'
  ) THEN
    RAISE EXCEPTION 'only admins can change roles';
  END IF;
  UPDATE public.profiles SET role_id = new_role, updated_at = now() WHERE id = target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_role (uuid, text) TO authenticated;
