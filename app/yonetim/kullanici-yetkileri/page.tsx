"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import type { RoleId, Permission } from "@/types/permissions";
import { ROLES, PERMISSION_GROUPS, PERMISSION_LABELS } from "@/types/permissions";
import { listDirectoryUsers, type DirectoryUserProfile } from "@/lib/listDirectoryUsers";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Database,
  FileCheck2,
  LockKeyhole,
  Shield,
  User,
  Users,
  Check,
  X,
  Info,
  Loader2,
  RotateCw,
  UserPlus,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ROLE_OPTIONS: RoleId[] = ["admin", "project_manager", "member", "viewer"];

type SecurityCheckTone = "ok" | "warn" | "info";

const SECURITY_CHECK_TONE: Record<SecurityCheckTone, {
  icon: ReactNode;
  className: string;
  badge: string;
}> = {
  ok: {
    icon: <Check className="h-4 w-4" aria-hidden />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100",
    badge: "Tamam",
  },
  warn: {
    icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
    className: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
    badge: "Kontrol",
  },
  info: {
    icon: <Info className="h-4 w-4" aria-hidden />,
    className: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100",
    badge: "Bilgi",
  },
};

function roleHas(roleId: RoleId, permission: Permission) {
  return ROLES[roleId].permissions.includes(permission);
}

export default function KullaniciYetkileriPage() {
  const { user, isLoaded, hasPermission, updateUserRole, isAdmin } = useAuth();
  const toast = useToast();
  const canEdit = hasPermission("userManagement.edit");
  const [users, setUsers] = useState<DirectoryUserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  /** Davet diyaloğu state */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const list = await listDirectoryUsers();
      setUsers(list);
    } catch (e) {
      console.warn("[KullaniciYetkileri] listDirectoryUsers failed:", e);
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (targetUid: string, roleId: RoleId) => {
    setUpdatingUid(targetUid);
    try {
      await updateUserRole(roleId, targetUid);
      setUsers((prev) => prev.map((u) => (u.uid === targetUid ? { ...u, roleId } : u)));
    } finally {
      setUpdatingUid(null);
    }
  };

  /**
   * Davet gönder: /api/admin/invite server route'una POST.
   * Auth: current user'ın access_token'ı Bearer header'ında gönderilir;
   * server tarafı token'ı doğrulayıp admin yetkisi kontrol eder.
   */
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Geçerli bir e-posta adresi girin.");
      return;
    }
    setInviteSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setInviteError("Oturum bilgisi alınamadı. Sayfayı yenileyip tekrar deneyin.");
        return;
      }
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/sifre-sifirla`
          : undefined;
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, redirectTo }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        if (res.status === 409) {
          setInviteError(`${email} zaten kayıtlı bir kullanıcı.`);
        } else {
          setInviteError(data.error || "Davet gönderilemedi.");
        }
        return;
      }
      toast.success(`${email} adresine davet bağlantısı gönderildi`);
      setInviteOpen(false);
      setInviteEmail("");
      // Profil listesi yenile — yeni kullanıcı henüz profil oluşturmamış olabilir
      // ama trigger anında çalışıyorsa görünür
      void fetchUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bağlantı hatası";
      setInviteError(msg);
    } finally {
      setInviteSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="container max-w-4xl py-12 flex items-center justify-center text-slate-500 dark:text-slate-400">
        Yükleniyor…
      </div>
    );
  }

  if (!hasPermission("userManagement.view")) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-6 text-center">
          <Shield className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-3" />
          <p className="text-slate-800 dark:text-slate-200 font-medium">Bu sayfaya erişim yetkiniz yok.</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Kullanıcı yetkilerini yalnızca yöneticiler görüntüleyebilir.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentRole = user ? ROLES[user.roleId] : null;
  const currentCanExport = hasPermission("liveTable.exportCsv");
  const currentCanExportAllRows = hasPermission("liveTable.exportAllRows");
  const currentCanExportUnmasked = hasPermission("liveTable.exportSensitiveUnmasked");
  const currentCanComment = hasPermission("liveTable.commentTask");
  const currentCanCopy = hasPermission("liveTable.copyCell");
  const currentCanBulkUpdate = hasPermission("liveTable.bulkUpdate");
  const roleSecurityChecks: Array<{
    title: string;
    description: string;
    tone: SecurityCheckTone;
  }> = [
    {
      title: "Üye export kapsamı",
      description: roleHas("member", "liveTable.exportCsv") && !roleHas("member", "liveTable.exportAllRows")
        ? "Üye rolü export yapabilir; kapsam uygulamada sadece düzenleyebildiği satırlarla sınırlandırılır."
        : "Üye rolünün export kapsamı beklenen sınırlı modelden farklı görünüyor.",
      tone: roleHas("member", "liveTable.exportCsv") && !roleHas("member", "liveTable.exportAllRows") ? "ok" : "warn",
    },
    {
      title: "Proje yöneticisi export kapsamı",
      description: roleHas("project_manager", "liveTable.exportAllRows")
        ? "Proje yöneticisi erişebildiği tüm satırları maskeli olarak dışa aktarabilir."
        : "Proje yöneticisi tüm erişilebilir satır export yetkisine sahip değil.",
      tone: roleHas("project_manager", "liveTable.exportAllRows") ? "ok" : "warn",
    },
    {
      title: "Maskesiz hassas veri",
      description: roleHas("project_manager", "liveTable.exportSensitiveUnmasked")
        ? "Proje yöneticisinde maskesiz hassas export açık. Bu rol dağılımı bilinçli verildiyse PII loglarını yakından izleyin."
        : "Maskesiz hassas export varsayılan olarak yalnızca admin/özel izin verilen kullanıcılar içindir.",
      tone: roleHas("project_manager", "liveTable.exportSensitiveUnmasked") ? "warn" : "ok",
    },
    {
      title: "İzleyici export",
      description: !roleHas("viewer", "liveTable.exportCsv")
        ? "İzleyici rolünde dışa aktarma kapalı."
        : "İzleyici rolünde dışa aktarma açık görünüyor; veri sızıntısı riski doğurabilir.",
      tone: !roleHas("viewer", "liveTable.exportCsv") ? "ok" : "warn",
    },
    {
      title: "Yorum ve kopyalama ayrımı",
      description: roleHas("member", "liveTable.commentTask") && roleHas("member", "liveTable.copyCell")
        ? "Yorum ve kopyalama artık satır düzenleme yetkisinden ayrı izin anahtarlarıyla izlenir."
        : "Üye rolünde yorum/kopyalama izinleri beklenen operatif seviyede değil.",
      tone: roleHas("member", "liveTable.commentTask") && roleHas("member", "liveTable.copyCell") ? "ok" : "warn",
    },
    {
      title: "Toplu güncelleme sınırı",
      description: !roleHas("member", "liveTable.bulkUpdate") && roleHas("project_manager", "liveTable.bulkUpdate")
        ? "Toplu durum güncelleme üye rolünde kapalı, proje yöneticisi/admin rolünde açık."
        : "Toplu güncelleme rol dağılımı beklenen PM/admin modelinden farklı.",
      tone: !roleHas("member", "liveTable.bulkUpdate") && roleHas("project_manager", "liveTable.bulkUpdate") ? "ok" : "warn",
    },
  ];
  const rlsChecks: Array<{
    title: string;
    description: string;
    script: string;
  }> = [
    {
      title: "Görev satırı düzenleme RLS",
      description: "tasks update policy, task_is_editable_for_current_user(project_id, assignee) fonksiyonuna bağlı olmalı.",
      script: "scripts/supabase-rls-policies.sql",
    },
    {
      title: "Yorum RLS",
      description: "task_comments insert/update/delete politikaları, sadece düzenlenebilir satırlara yorum izni vermeli.",
      script: "scripts/task-comments.sql",
    },
    {
      title: "PII export logları",
      description: "Maskesiz hassas export ve hassas alan kopyalama kayıtları pii_access_log tablosuna yazılmalı.",
      script: "scripts/pii-access-log.sql",
    },
    {
      title: "Proje bazlı yetki altyapısı",
      description: "project_member_permissions tablosu, proje özelinde yorum/kopya/export/toplu işlem izinleri için hazır olmalı.",
      script: "scripts/project-member-permissions.sql",
    },
    {
      title: "Merkezi bildirim kutusu",
      description: "notifications tablosu, bildirim teslimi ve okundu bilgisini denetlenebilir şekilde tutmalı.",
      script: "scripts/notifications.sql",
    },
  ];

  return (
    <div className="container max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Shield className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          Kullanıcı yetki yönetimi
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Hangi kullanıcının hangi bölümlere erişebileceği, proje oluşturma, atama ve Canlı Tablo işlemleri buradan yönetilir.
          Oturumu açmış kullanıcılar Supabase{' '}
          <code className="text-xs rounded bg-slate-100 px-1 dark:bg-slate-700">profiles</code> tablosunda listelenir.
        </p>
      </div>

      {/* Yönetici: Tüm kullanıcılar */}
      {isAdmin && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden mb-8">
          <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-500" />
                Tüm kullanıcılar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Listedeki kayıtlar ilk giriş sonrasında oluşturulan profillerdir; kullanıcı yoksa önce /giris ile oturum açılmalıdır.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setInviteEmail("");
                  setInviteError(null);
                  setInviteOpen(true);
                }}
                className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Kullanıcı davet et</span>
                <span className="ml-1 sm:hidden">Davet</span>
              </Button>
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={usersLoading}>
                {usersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">{usersLoading ? "Yükleniyor…" : "Yenile"}</span>
              </Button>
            </div>
          </div>
          <div className="p-4">
            {usersLoading && users.length === 0 ? (
              <div className="py-8 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Kullanıcılar yükleniyor…
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                Henüz profil kaydı yok. Kullanıcılar ilk giriş sonrasında burada listelenir (<code className="text-xs">scripts/supabase-auth-profiles.sql</code> ile Supabase tablosunun oluşturulduğundan emin olun).
              </p>
            ) : (
              <ul className="space-y-2">
                {users.map((u) => (
                  <li
                    key={u.uid}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
                      u.uid === user?.id
                        ? "border-blue-200 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
                        : "border-slate-200 dark:border-slate-700"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{u.displayName || u.email || u.uid}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{u.email || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.uid === user?.id && (
                        <Badge variant="outline" className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                          Siz
                        </Badge>
                      )}
                      {canEdit ? (
                        <select
                          value={u.roleId}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value as RoleId)}
                          disabled={updatingUid === u.uid}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        >
                          {ROLE_OPTIONS.map((id) => (
                            <option key={id} value={id}>{ROLES[id].name}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="outline" className="font-normal">{ROLES[u.roleId]?.name ?? u.roleId}</Badge>
                      )}
                      {updatingUid === u.uid && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Mevcut kullanıcı */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden mb-8">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <User className="h-5 w-5 text-slate-500" />
            Oturum açan kullanıcı
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Oturumu açılan hesap ve rolü (Supabase Auth ve <code className="text-xs">profiles</code>).
          </p>
        </div>
        <div className="p-4">
          {user ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{user.displayName || user.email}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">Rol:</span>
                {canEdit ? (
                  <select
                    value={user.roleId}
                    onChange={(e) => updateUserRole(e.target.value as RoleId)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {ROLE_OPTIONS.map((id) => (
                      <option key={id} value={id}>{ROLES[id].name}</option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="outline" className="font-normal">
                    {currentRole?.name ?? user.roleId}
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">
              Oturum açılmamış veya yükleme sürüyor. Önce ana sayfadaki Giriş&apos;e gidin.
            </p>
          )}
        </div>
      </div>

      {/* Güvenlik kontrolü */}
      <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="flex items-center gap-2 text-lg font-medium text-slate-800 dark:text-slate-100">
            <LockKeyhole className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Güvenlik kontrolü
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Rol tanımı ile uygulamadaki kritik veri davranışlarını birlikte kontrol eder.
          </p>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/35">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mevcut oturum kapsamı</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Rol</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">{currentRole?.name ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Export kapsamı</dt>
                <dd className="text-right font-medium text-slate-800 dark:text-slate-100">
                  {!currentCanExport
                    ? "Kapalı"
                    : currentCanExportAllRows
                      ? "Tüm erişilebilir satırlar"
                      : "Sadece düzenlenebilir satırlar"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Maskesiz hassas export</dt>
                <dd>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      currentCanExportUnmasked
                        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                        : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                    )}
                  >
                    {currentCanExportUnmasked ? "Açık" : "Kapalı"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Satır düzenleme kuralı</dt>
                <dd className="max-w-[13rem] text-right text-xs leading-snug text-slate-700 dark:text-slate-300">
                  Admin/PM tüm satırlar; üye kendi ve atanmamış satırlar. Projede ekip düzenleme açıksa kapsam genişler.
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Yorum / kopya</dt>
                <dd className="max-w-[13rem] text-right text-xs leading-snug text-slate-700 dark:text-slate-300">
                  {currentCanComment ? "Yorum açık" : "Yorum kapalı"} · {currentCanCopy ? "Kopyalama açık" : "Kopyalama kapalı"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-slate-400">Toplu durum güncelleme</dt>
                <dd>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      currentCanBulkUpdate
                        ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                    )}
                  >
                    {currentCanBulkUpdate ? "Açık" : "Kapalı"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-2">
            {roleSecurityChecks.map((item) => {
              const tone = SECURITY_CHECK_TONE[item.tone];
              return (
                <div key={item.title} className={cn("rounded-lg border px-3 py-2.5", tone.className)}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex shrink-0">{tone.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <Badge variant="outline" className="border-current/30 bg-white/40 text-[10px] font-medium dark:bg-slate-900/20">
                          {tone.badge}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs leading-snug opacity-90">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">RLS / SQL uygulanma kontrolü</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {rlsChecks.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/35">
                <div className="flex items-start gap-2">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">{item.description}</p>
                    <code className="mt-2 block truncate rounded bg-white px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {item.script}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Bu panel uygulama tarafındaki beklenen güvenlik modelini gösterir. SQL dosyalarının Supabase SQL Editor&apos;da uygulanması manuel doğrulanmalıdır.
          </p>
        </div>
      </div>

      {/* Rol tanımları */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden mb-8">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            Rol tanımları
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Her rolün hangi yetkileri içerdiği aşağıda özetlenir.
          </p>
        </div>
        <div className="p-4 space-y-4">
          {ROLE_OPTIONS.map((roleId) => {
            const role = ROLES[roleId];
            const isCurrent = user?.roleId === roleId;
            return (
              <div
                key={roleId}
                className={cn(
                  "rounded-lg border p-4",
                  isCurrent
                    ? "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{role.name}</span>
                  {isCurrent && (
                    <Badge variant="outline" className="text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                      Mevcut rol
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{role.description}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {role.permissions.length} yetki
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Yetki matrisi (gruplu) */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Check className="h-5 w-5 text-slate-500" />
            Mevcut kullanıcının yetkileri
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Rolünüze göre aşağıdaki yetkiler geçerlidir. Yeşil tik = erişim var.
          </p>
        </div>
        <div className="p-4 space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{group.label}</h3>
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
                        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <X className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
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

      {/* Davet et diyaloğu */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (!open && !inviteSubmitting) setInviteOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Kullanıcı davet et
            </DialogTitle>
            <DialogDescription>
              Davet linki verdiğin e-postaya gönderilir. Kullanıcı link üzerinden şifre belirler,
              otomatik olarak <strong>Üye</strong> rolüyle başlar. Rolünü buradan değiştirebilirsin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                E-posta adresi
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="ornek@email.com"
                  required
                  autoFocus
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>
            {inviteError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                {inviteError}
              </div>
            )}
            <DialogFooter className="pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviteSubmitting}
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={inviteSubmitting || !inviteEmail.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {inviteSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gönderiliyor…
                  </>
                ) : (
                  "Daveti gönder"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bilgi kutusu */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 flex gap-3">
        <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="text-sm text-blue-900 dark:text-blue-100">
          <p className="font-medium">Kimlik doğrulama ve roller</p>
          <p className="mt-1 text-blue-800 dark:text-blue-200">
            Oturum <strong>Supabase Auth</strong> ile açılır; roller ve kullanıcı listesi <strong>profiles</strong> üzerinden yönetilir. Başka kullanıcıya rol atanırken <code className="text-xs">admin_set_role</code> RPC
            kullanılır. Yönetici dışında kimse <strong>userManagement.edit</strong> gerektiren değişiklikleri yapmamalıdır.
          </p>
        </div>
      </div>
    </div>
  );
}
