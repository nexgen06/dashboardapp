# Yetki Sistemi ve UI Gating

Uygulamada yetki kontrolü iki katmanlıdır:

1. **İstemci (UI gating):** Buton görünür ama disabled + tooltip.
   Kullanıcıya neden tıklayamadığı söylenir.
2. **Sunucu (RLS):** Supabase Postgres Row Level Security politikaları.
   Yetkisiz istek 403/4xx ile reddedilir.

İki katmanın amacı **derinlemesine savunma**: istemci hızlı geri bildirim
verir, sunucu son kararı her zaman uygular.

## Roller

| Rol | Adı | Açıklama |
|-----|-----|----------|
| `admin` | Yönetici | Tüm yetkiler |
| `project_manager` | Proje Yöneticisi | Proje + Canlı tablo tam; sadece silme kısıtlı |
| `member` | Üye | Görüntüleme + kendi görev ekleme |
| `viewer` | İzleyici | Sadece görüntüleme |

Tüm rol → yetki haritası: [types/permissions.ts](../../types/permissions.ts) → `ROLES`.

## UI Gating Standardı

### `<RestrictedButton>` kullan

Yeni butonlar için **doğrudan koşullu render YAPMA**:

```tsx
// ❌ Eski pattern — buton görünmez, kullanıcı şaşırır
{canCreateProject && (
  <Button onClick={openForm}>Yeni proje</Button>
)}

// ✅ Yeni pattern — disabled + tooltip
<RestrictedButton permission="projects.create" onClick={openForm}>
  Yeni proje
</RestrictedButton>
```

### Hook: `usePermissionGate`

Buton dışında özel UI için (ör. ikon-buton, MenuItem):

```tsx
const { allowed, gateProps, reason } = usePermissionGate("projects.delete");

<button {...gateProps} onClick={handleDelete}>
  <Trash2 />
</button>
```

`gateProps` içeriği:
- `disabled: true` (yoksa false / undefined)
- `aria-disabled: true`
- `title: "Bu işlem için yetkiniz yok (rolünüz: Üye). Yöneticinize başvurabilirsiniz."`

## Hangi Buton Ne İster?

| Aksiyon | Permission |
|---------|-----------|
| Yeni proje | `projects.create` |
| Proje düzenle | `projects.edit` |
| Proje sil | `projects.delete` |
| Projeye kullanıcı ata | `projects.assignUsers` |
| Yeni görev (Canlı Tablo) | `liveTable.createTask` |
| Görev düzenle | `liveTable.editTask` |
| Görev sil | `liveTable.deleteTask` |
| Toplu silme | `liveTable.bulkDelete` |
| CSV içe aktar | `liveTable.importCsv` |
| CSV/Excel/PDF dışa aktar | `liveTable.exportCsv` |
| Proje detay: görev ekle | `projectDetail.addTask` |
| Proje detay: görev sil | `projectDetail.deleteTask` |
| Yönetim sayfaları | `area.userManagement` |
| Ayarlar yazma | `settings.edit` |

## "Gizle veya disable" Kararı

- **Tam erişim alanları (route)**: bölüm yetkisi yoksa **gizle** (sidebar item).
  Örn. `area.userManagement` yoksa "Yönetim" sidebar'da görünmez.
- **Sayfa içi aksiyonlar (button)**: yetkim yoksa **disable + tooltip**.
  Örn. listede "Sil" ikon-butonu admin değilse disabled görünür.
- **Tehlikeli aksiyonlar (delete)**: `RestrictedButton` ile disable ve
  ayrıca confirm modal'ı yetki yoksa açılmaz (defensive in onClick).

## Sunucu Tarafı (RLS)

UI gating sadece bir kolaylık; **gerçek güvenlik DB seviyesindedir**.
`scripts/supabase-rls-policies.sql` içinde her tablo için:
- `select_visible`: kim görebilir
- `insert_staff`: kim ekleyebilir
- `update_staff`: kim güncelleyebilir
- `delete_admin/staff`: kim silebilir

İstemci `RestrictedButton` ile yumuşak tutulsa bile yetkisiz bir kullanıcı
network çağrısını manuel atarsa, RLS reddeder. İki taraflı koruma.
