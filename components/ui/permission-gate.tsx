"use client";

import { forwardRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { ROLES, type Permission } from "@/types/permissions";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Yetki kontrolü için tek doğruluk hook'u.
 *
 * Mevcut yetkisi olmayan kullanıcılarda gateProps'ı butona yayarak
 * disabled + tooltip + aria-disabled garanti edersin. Önceki sürümlerde
 * bu kontroller bazen sadece "if (canX)" ile gizleniyordu; bazen hiç
 * yapılmıyordu (RLS sessizce reddediyordu). Bu hook ile tek davranış:
 * yetkin yoksa **buton görünür ama tıklanamaz** ve neden tıklanamadığı
 * tooltip'te anlatılır.
 *
 * Kullanım:
 *   const { allowed, gateProps } = usePermissionGate("projects.delete");
 *   <Button {...gateProps} onClick={handleDelete}>Sil</Button>
 */
export function usePermissionGate(permission: Permission): {
  allowed: boolean;
  gateProps: { disabled?: boolean; title?: string; "aria-disabled"?: boolean };
  reason: string;
} {
  const { hasPermission, user } = useAuth();
  const allowed = hasPermission(permission);
  if (allowed) return { allowed: true, gateProps: {}, reason: "" };
  const roleName = user?.roleId ? ROLES[user.roleId]?.name ?? user.roleId : "ziyaretçi";
  const reason = `Bu işlem için yetkiniz yok (rolünüz: ${roleName}). Yöneticinize başvurabilirsiniz.`;
  return {
    allowed: false,
    reason,
    gateProps: {
      disabled: true,
      "aria-disabled": true,
      title: reason,
    },
  };
}

/**
 * Yetki kontrolü hazır gelen Button sarmal bileşeni.
 *
 * Yetki varsa: <Button> gibi davranır.
 * Yetki yoksa: disabled + tooltip + a11y aria-disabled.
 *
 *   <RestrictedButton permission="liveTable.deleteTask" variant="destructive" onClick={...}>
 *     Sil
 *   </RestrictedButton>
 */
type RestrictedButtonProps = ButtonProps & {
  permission: Permission;
};

export const RestrictedButton = forwardRef<HTMLButtonElement, RestrictedButtonProps>(
  function RestrictedButton({ permission, disabled, title, onClick, ...rest }, ref) {
    const { gateProps } = usePermissionGate(permission);
    const finalDisabled = disabled || gateProps.disabled;
    const finalTitle = gateProps.title ?? title;
    return (
      <Button
        ref={ref}
        disabled={finalDisabled}
        title={finalTitle}
        aria-disabled={gateProps["aria-disabled"] ?? undefined}
        onClick={(e) => {
          // Yetki yoksa onClick çağrılmaz; ayrıca defansif: event yutulur.
          if (gateProps.disabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onClick?.(e);
        }}
        {...rest}
      />
    );
  }
);
