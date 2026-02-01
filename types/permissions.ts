/**
 * Kullanıcı yetki ve rol tanımları.
 * İleride Firebase Auth ile kullanıcı eşleştirilecek.
 */

/** Tüm yetki anahtarları — uygulama genelinde yönetilebilir alanlar */
export type Permission =
  // Bölüm erişimi (sidebar / sekmeler)
  | "area.projects"
  | "area.liveTable"
  | "area.settings"
  | "area.userManagement"
  // Projeler
  | "projects.view"
  | "projects.create"
  | "projects.edit"
  | "projects.delete"
  | "projects.archive"
  | "projects.assignUsers"
  // Proje detay
  | "projectDetail.view"
  | "projectDetail.addTask"
  | "projectDetail.editTask"
  | "projectDetail.removeTask"
  | "projectDetail.deleteTask"
  | "projectDetail.importCsv"
  // Canlı Tablo
  | "liveTable.view"
  | "liveTable.createTask"
  | "liveTable.editTask"
  | "liveTable.deleteTask"
  | "liveTable.bulkDelete"
  | "liveTable.importCsv"
  | "liveTable.exportCsv"
  | "liveTable.manageColumns"
  | "liveTable.autoSizeColumns"
  // Ayarlar
  | "settings.view"
  | "settings.edit"
  // Kullanıcı yetki yönetimi
  | "userManagement.view"
  | "userManagement.edit"
  // Bildirimler
  | "notifications.send";

/** Rol kimliği */
export type RoleId = "admin" | "project_manager" | "member" | "viewer";

export type Role = {
  id: RoleId;
  name: string;
  description: string;
  permissions: Permission[];
};

/** Rol tanımları ve varsayılan yetkiler */
export const ROLES: Record<RoleId, Role> = {
  admin: {
    id: "admin",
    name: "Yönetici",
    description: "Tüm yetkiler. Kullanıcı ve rol yönetimi.",
    permissions: [
      "area.projects",
      "area.liveTable",
      "area.settings",
      "area.userManagement",
      "projects.view",
      "projects.create",
      "projects.edit",
      "projects.delete",
      "projects.archive",
      "projects.assignUsers",
      "projectDetail.view",
      "projectDetail.addTask",
      "projectDetail.editTask",
      "projectDetail.removeTask",
      "projectDetail.deleteTask",
      "projectDetail.importCsv",
      "liveTable.view",
      "liveTable.createTask",
      "liveTable.editTask",
      "liveTable.deleteTask",
      "liveTable.bulkDelete",
      "liveTable.importCsv",
      "liveTable.exportCsv",
      "liveTable.manageColumns",
      "liveTable.autoSizeColumns",
      "settings.view",
      "settings.edit",
      "userManagement.view",
      "userManagement.edit",
      "notifications.send",
    ],
  },
  project_manager: {
    id: "project_manager",
    name: "Proje Yöneticisi",
    description: "Proje oluşturma, düzenleme, atama. Canlı tablo tam erişim.",
    permissions: [
      "area.projects",
      "area.liveTable",
      "area.settings",
      "projects.view",
      "projects.create",
      "projects.edit",
      "projects.archive",
      "projects.assignUsers",
      "projectDetail.view",
      "projectDetail.addTask",
      "projectDetail.editTask",
      "projectDetail.removeTask",
      "projectDetail.deleteTask",
      "projectDetail.importCsv",
      "liveTable.view",
      "liveTable.createTask",
      "liveTable.editTask",
      "liveTable.deleteTask",
      "liveTable.bulkDelete",
      "liveTable.importCsv",
      "liveTable.exportCsv",
      "liveTable.manageColumns",
      "liveTable.autoSizeColumns",
      "settings.view",
      "settings.edit",
      "userManagement.view",
      "notifications.send",
    ],
  },
  member: {
    id: "member",
    name: "Üye",
    description: "Proje ve tablo görüntüleme, düzenleme. Silme, import ve dışa aktarma kısıtlı.",
    permissions: [
      "area.projects",
      "area.liveTable",
      "area.settings",
      "projects.view",
      "projectDetail.view",
      "projectDetail.addTask",
      "projectDetail.removeTask",
      "liveTable.view",
      "liveTable.createTask",
      "liveTable.editTask",
      "liveTable.manageColumns",
      "liveTable.autoSizeColumns",
      "settings.view",
      "settings.edit",
      "userManagement.view",
    ],
  },
  viewer: {
    id: "viewer",
    name: "İzleyici",
    description: "Sadece görüntüleme. Proje ve tablo verilerini okuyabilir; dışa aktarma yok.",
    permissions: [
      "area.projects",
      "area.liveTable",
      "area.settings",
      "projects.view",
      "projectDetail.view",
      "liveTable.view",
      "settings.view",
      "userManagement.view",
    ],
  },
};

/** Yetki grupları (UI'da gruplu göstermek için) */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: "Bölüm erişimi",
    permissions: ["area.projects", "area.liveTable", "area.settings", "area.userManagement"],
  },
  {
    label: "Projeler",
    permissions: [
      "projects.view",
      "projects.create",
      "projects.edit",
      "projects.delete",
      "projects.archive",
      "projects.assignUsers",
    ],
  },
  {
    label: "Proje detay",
    permissions: [
      "projectDetail.view",
      "projectDetail.addTask",
      "projectDetail.editTask",
      "projectDetail.removeTask",
      "projectDetail.deleteTask",
      "projectDetail.importCsv",
    ],
  },
  {
    label: "Canlı Tablo",
    permissions: [
      "liveTable.view",
      "liveTable.createTask",
      "liveTable.editTask",
      "liveTable.deleteTask",
      "liveTable.bulkDelete",
      "liveTable.importCsv",
      "liveTable.exportCsv",
      "liveTable.manageColumns",
      "liveTable.autoSizeColumns",
    ],
  },
  {
    label: "Ayarlar",
    permissions: ["settings.view", "settings.edit"],
  },
  {
    label: "Kullanıcı yetki yönetimi",
    permissions: ["userManagement.view", "userManagement.edit"],
  },
  {
    label: "Bildirimler",
    permissions: ["notifications.send"],
  },
];

/** Yetki kısa etiketleri (UI) */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "area.projects": "Projeler sekmesi",
  "area.liveTable": "Canlı Tablo sekmesi",
  "area.settings": "Ayarlar sayfası",
  "area.userManagement": "Kullanıcı yetkileri sayfası",
  "projects.view": "Projeleri görüntüleme",
  "projects.create": "Proje oluşturma",
  "projects.edit": "Proje düzenleme",
  "projects.delete": "Proje silme",
  "projects.archive": "Proje arşivleme",
  "projects.assignUsers": "Projeye kullanıcı atama",
  "projectDetail.view": "Proje detayı görüntüleme",
  "projectDetail.addTask": "Projeye görev ekleme",
  "projectDetail.editTask": "Proje görevinde durum/atanan düzenleme",
  "projectDetail.removeTask": "Görevi projeden çıkarma",
  "projectDetail.deleteTask": "Görev silme",
  "projectDetail.importCsv": "Projeye CSV/JSON import",
  "liveTable.view": "Canlı tabloyu görüntüleme",
  "liveTable.createTask": "Görev oluşturma",
  "liveTable.editTask": "Görev düzenleme",
  "liveTable.deleteTask": "Görev silme",
  "liveTable.bulkDelete": "Toplu silme",
  "liveTable.importCsv": "CSV içe aktarma",
  "liveTable.exportCsv": "CSV/Excel dışa aktarma",
  "liveTable.manageColumns": "Sütun sıralama / görünürlük",
  "liveTable.autoSizeColumns": "İçeriğe göre ölçeklendir",
  "settings.view": "Ayarları görüntüleme",
  "settings.edit": "Ayarları düzenleme",
  "userManagement.view": "Yetki listesini görüntüleme",
  "userManagement.edit": "Kullanıcı rol / yetki düzenleme",
  "notifications.send": "Mesaj / bildirim gönderme",
};

export type User = {
  id: string;
  email: string;
  displayName: string | null;
  roleId: RoleId;
  /** Rol dışında ek/çıkarılan yetkiler (ileride kullanıcı bazlı özelleştirme) */
  permissionOverrides?: { add?: Permission[]; remove?: Permission[] };
};
