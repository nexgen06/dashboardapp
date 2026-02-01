-- projects tablosu (Supabase SQL Editor'da çalıştırın)

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Aktif',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Realtime (isteğe bağlı): Database > Replication > supabase_realtime içinde projects'ı etkinleştirin.
