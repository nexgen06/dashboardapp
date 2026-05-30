import type { Permission } from "@/types/permissions";

/** Canlı Tablo export kapsamı — kullanıcıya gösterilecek kısa metin. */
export function describeExportScope(
  canExport: boolean,
  canExportAllRows: boolean
): string {
  if (!canExport) return "Kapalı";
  if (canExportAllRows) return "Tüm erişilebilir satırlar";
  return "Sadece düzenlenebilir satırlar";
}

/** Oturum kapsamı özeti — profil/yetkiler ve admin paneli ortak. */
export type SessionPermissionSnapshot = {
  canExport: boolean;
  canExportAllRows: boolean;
  canExportUnmasked: boolean;
  canComment: boolean;
  canCopy: boolean;
  canBulkUpdate: boolean;
};

export function buildSessionSnapshot(
  hasPermission: (p: Permission) => boolean
): SessionPermissionSnapshot {
  return {
    canExport: hasPermission("liveTable.exportCsv"),
    canExportAllRows: hasPermission("liveTable.exportAllRows"),
    canExportUnmasked: hasPermission("liveTable.exportSensitiveUnmasked"),
    canComment: hasPermission("liveTable.commentTask"),
    canCopy: hasPermission("liveTable.copyCell"),
    canBulkUpdate: hasPermission("liveTable.bulkUpdate"),
  };
}
