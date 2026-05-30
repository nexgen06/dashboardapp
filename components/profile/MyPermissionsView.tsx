"use client";

import Link from "next/link";
import { Check, Shield, User, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLES, PERMISSION_GROUPS, PERMISSION_LABELS } from "@/types/permissions";
import { buildSessionSnapshot, describeExportScope } from "@/lib/sessionPermissionSummary";
import { cn } from "@/lib/utils";

type MyPermissionsViewProps = {
  className?: string;
  showAdminLink?: boolean;
};

/** Oturum açan kullanıcının global rolü ve etkin izin özeti (salt okunur). */
export function MyPermissionsView({ className, showAdminLink = true }: MyPermissionsViewProps) {
  const { user, hasPermission, isAdmin } = useAuth();
  const currentRole = user ? ROLES[user.roleId] : null;
  const snapshot = buildSessionSnapshot(hasPermission);

  if (!user) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Oturum açılmamış.{" "}
        <Link href="/giris" className="text-blue-600 underline dark:text-blue-400">
          Giriş yapın
        </Link>
      </p>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
            <User className="h-5 w-5 text-slate-500" />
            Hesabım
          </h2>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {user.displayName || user.email}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
            <Badge variant="outline" className="font-normal">
              {currentRole?.name ?? user.roleId}
            </Badge>
          </div>
          {currentRole?.description && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{currentRole.description}</p>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Proje bazlı ek kısıtlar veya genişletmeler varsa Canlı Tablo&apos;da proje üyeliğiniz de geçerlidir.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Bu oturumda yapabildiklerim
          </h2>
        </div>
        <div className="p-4">
          <dl className="space-y-2 text-sm">
            <Row label="Export kapsamı" value={describeExportScope(snapshot.canExport, snapshot.canExportAllRows)} />
            <Row
              label="Maskesiz hassas export"
              value={snapshot.canExportUnmasked ? "Açık" : "Kapalı"}
              warn={snapshot.canExportUnmasked}
            />
            <Row
              label="Yorum / kopyalama"
              value={`${snapshot.canComment ? "Yorum açık" : "Yorum kapalı"} · ${snapshot.canCopy ? "Kopyalama açık" : "Kopyalama kapalı"}`}
            />
            <Row label="Toplu durum güncelleme" value={snapshot.canBulkUpdate ? "Açık" : "Kapalı"} />
          </dl>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
            <Check className="h-5 w-5 text-slate-500" />
            Detaylı izin listesi
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Global rolünüze göre geçerli izinler. Yeşil tik = erişim var.
          </p>
        </div>
        <div className="space-y-6 p-4">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{group.label}</h3>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {group.permissions.map((p) => {
                  const allowed = hasPermission(p);
                  return (
                    <li
                      key={p}
                      className={cn(
                        "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                        allowed ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {allowed ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <X className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
                      )}
                      <span>{PERMISSION_LABELS[p]}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {showAdminLink && isAdmin && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-950/25">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Tüm kullanıcıları yönetmek ve rol atamak için yönetim panelini kullanın.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/yonetim/kullanici-yetkileri">Kullanıcı yönetimi</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd>
        {warn ? (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 font-normal text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {value}
          </Badge>
        ) : (
          <span className="font-medium text-slate-800 dark:text-slate-100">{value}</span>
        )}
      </dd>
    </div>
  );
}
