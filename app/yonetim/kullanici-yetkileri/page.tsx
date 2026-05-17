"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Shield, User, Users, Check, X, Info, Loader2, RotateCw, UserPlus, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ROLE_OPTIONS: RoleId[] = ["admin", "project_manager", "member", "viewer"];

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
