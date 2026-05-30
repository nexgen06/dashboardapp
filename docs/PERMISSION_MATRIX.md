# Yetki matrisi (UI ↔ Supabase)

Bu tablo, [`types/permissions.ts`](../types/permissions.ts) içindeki `Permission` anahtarlarının uygulamada nerede kontrol edildiğini ve veri katmanıyla ilişkisini özetler. **Asıl erişim kontrolü** Supabase RLS ile [`scripts/supabase-rls-policies.sql`](../scripts/supabase-rls-policies.sql) üzerindedir; UI kontrolleri yalnızca kullanıcı deneyimi içindir.

| Permission | UI / sayfa | Not |
|------------|------------|-----|
| `area.projects` | Sidebar, `app/projeler/page.tsx` | Bölüm kapısı (birlikte `projects.view`) |
| `projects.view` | Sidebar, `projeler/page.tsx`, `DashboardSection` | Proje listesi / dashboard |
| `projects.create` | `ProjectsSection`, `DashboardSection` | Yeni proje |
| `projects.edit` / `delete` / `archive` | `ProjectsSection` | Proje CRUD |
| `projects.assignUsers` | Rol tanımında; form atama alanı geniş izinlerle | İleride ayrı `hasPermission` ile sıkılaştırılabilir |
| `area.liveTable` | Sidebar, `canli-tablo/page.tsx` | Birlikte `liveTable.view` |
| `liveTable.view` | Sidebar, `canli-tablo`, `app/page.tsx`, `DashboardSection` | Tablo görüntüleme |
| `liveTable.*` (diğer) | `TasksTable.tsx` | create/edit/delete/import/export/columns |
| `area.settings` | Sidebar | Birlikte `settings.view` |
| `settings.view` | Sidebar, `app/ayarlar/page.tsx` | Ayarlar sayfası |
| `settings.edit` | `contexts/settings-context.tsx` (`updateSetting`, `save`, `reset*`) | Kalıcı / yerel ayar yazımı |
| `projectDetail.view` | `app/projeler/[id]/page.tsx` | Proje detay kapısı |
| `projectDetail.*` | Aynı sayfa | Görev ekleme/düzenleme/silme/import |
| `area.userManagement` | Sidebar yönetim bölümü | Yalnızca admin |
| `userManagement.view` / `edit` | `app/yonetim/kullanici-yetkileri/page.tsx` | Yalnızca admin; diğer roller `/profil/yetkiler` |
| *(auth)* | `app/profil/page.tsx`, `app/profil/yetkiler/page.tsx` | Kendi profil / rol özeti — izin anahtarı gerekmez |
| `area.reports` + `reports.view` | `app/raporlar/page.tsx`, `app/yonetim/rapor-sablonlari/page.tsx` | PM rapor şablonlarına erişebilir |
| `projects.edit` | `app/yonetim/referans-veriler/page.tsx` | PM referans veri yönetimi (sidebar admin bölümünde gizli) |
| `chipTemplates.view` | `app/yonetim/cip-kutuphanesi/page.tsx` | Çip kütüphanesi |
| `automation.view` | `app/yonetim/otomasyon-merkezi/page.tsx` | Otomasyon merkezi |
| `notifications.send` | Rolde tanımlı; ayrıntılı gönderim UI'da opsiyonel | İleride bildirim tetiklerine bağlanabilir |

**Öneri:** Yeni endpoint veya tablo eklendiğinde bu dosyayı ve RLS script'ini birlikte güncelleyin.
