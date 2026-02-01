/**
 * Yetki kontrol yardımcıları.
 * Kullanıcının rolü ve varsayılan/override yetkilerine göre izin verir.
 */

import type { User, Permission, RoleId } from "@/types/permissions";
import { ROLES } from "@/types/permissions";

export function getEffectivePermissions(user: User | null): Permission[] {
  if (!user) return [];
  const role = ROLES[user.roleId];
  const base = role?.permissions ?? [];
  const add = user.permissionOverrides?.add ?? [];
  const remove = user.permissionOverrides?.remove ?? [];
  const set = new Set<Permission>([...base, ...add]);
  remove.forEach((p) => set.delete(p));
  return Array.from(set);
}

export function hasPermission(user: User | null, permission: Permission): boolean {
  const permissions = getEffectivePermissions(user);
  return permissions.includes(permission);
}

export function hasAnyPermission(user: User | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function hasAllPermissions(user: User | null, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(user, p));
}

export function isAdmin(user: User | null): boolean {
  return user?.roleId === "admin";
}
