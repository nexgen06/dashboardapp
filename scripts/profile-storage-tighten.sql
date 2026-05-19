-- =============================================================================
-- Avatar Storage policy sıkılaştırması.
-- API route /api/avatar/upload service-role ile yüklediği için RLS bypass edilir.
-- Bu nedenle authenticated rolüne INSERT/UPDATE/DELETE policy GEREKMEZ.
-- Anonim veya authenticated kullanıcı doğrudan upload denemesi → engellenir.
-- Public read için bucket public=true zaten yeterli (storage.objects SELECT policy gereksiz).
-- =============================================================================
-- Çalıştır: Supabase Studio > SQL Editor > yapıştır > Run. Idempotent.

-- Mevcut tüm avatars policy'lerini sil (FOR ALL, insert/update/delete, herhangi adda)
DROP POLICY IF EXISTS avatars_authenticated_all ON storage.objects;
DROP POLICY IF EXISTS avatars_all_open          ON storage.objects;
DROP POLICY IF EXISTS avatars_insert_open       ON storage.objects;
DROP POLICY IF EXISTS avatars_insert_own        ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own        ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own        ON storage.objects;

-- Sonuç: storage.objects üzerinde "avatars" için hiçbir INSERT/UPDATE/DELETE
-- policy yok → kullanıcı tarafından doğrudan yapılan upload reddedilir.
-- Service-role bypass eder; sadece /api/avatar/upload route'u çalışır.
