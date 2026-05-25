"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, ShieldCheck, Save, AlertTriangle, X, Crown, UserCheck, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { useAuth } from "@/contexts/auth-context";
import {
  listProjectMemberPermissions,
  upsertProjectMemberPermissions,
  defaultProjectMemberPermission,
  type ProjectMemberPermission,
  type ProjectMemberPermissionInput,
  type ProjectMemberRole,
} from "@/lib/projectMemberPermissions";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<ProjectMemberRole, string> = {
  project_owner: "Proje sahibi",
  project_manager: "Proje yöneticisi",
  member: "Üye",
  viewer: "İzleyici",
};

const ROLE_DESCRIPTIONS: Record<ProjectMemberRole, string> = {
  project_owner: "Tüm yetkiler — proje sahibi",
  project_manager: "Yönetim + düzenleme + export",
  member: "Düzenleme + yorum + kopya",
  viewer: "Sadece okuma",
};

/** Her toggle için label + tooltip + opsiyonel "sadece admin" işareti */
const PERMISSION_FIELDS: Array<{
  key: keyof Pick<ProjectMemberPermission, "can_view" | "can_edit" | "can_comment" | "can_copy" | "can_export" | "can_export_unmasked" | "can_bulk_update" | "can_bulk_delete">;
  label: string;
  desc: string;
  adminOnly?: boolean;
}> = [
  { key: "can_view", label: "Görme", desc: "Proje verilerini görüntüleyebilir" },
  { key: "can_edit", label: "Düzenleme", desc: "Görev içeriklerini düzenleyebilir" },
  { key: "can_comment", label: "Yorum", desc: "Görevlere yorum ekleyebilir" },
  { key: "can_copy", label: "Kopya", desc: "Veriyi panoya kopyalayabilir" },
  { key: "can_export", label: "Export", desc: "CSV/Excel/PDF dışa aktarabilir" },
  { key: "can_export_unmasked", label: "Maskesiz export", desc: "Hassas veriyi maskesiz export edebilir (sadece admin atayabilir)", adminOnly: true },
  { key: "can_bulk_update", label: "Toplu güncelleme", desc: "Çoklu görevi tek seferde günceller" },
  { key: "can_bulk_delete", label: "Toplu silme", desc: "Çoklu görevi tek seferde siler (sadece admin atayabilir)", adminOnly: true },
];

type DraftRow = ProjectMemberPermissionInput & { _dirty?: boolean };

export function ProjectMemberPermissionsPanel({
  open,
  onOpenChange,
  projectId,
  projectName,
  assignedEmails,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectName: string;
  assignedEmails: string[];
}) {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const profileLookup = useProfileLookup();
  const allProfiles = profileLookup.listAll();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missingTable, setMissingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** user_id keyed draft rows — Map for in-place updates */
  const [drafts, setDrafts] = useState<Map<string, DraftRow>>(new Map());

  const isPM = user?.roleId === "project_manager";
  const canManage = isAdmin || isPM;

  /** Bir kullanıcı için: profil resolve + draft yoksa default oluştur. */
  const buildDraftsFromAssigned = useCallback(
    (existing: ProjectMemberPermission[]) => {
      const map = new Map<string, DraftRow>();
      const byUserId = new Map(existing.map((r) => [r.user_id, r]));
      const lowerAssigned = assignedEmails.map((e) => e.trim().toLowerCase());
      for (const email of lowerAssigned) {
        const profile = allProfiles.find((p) => (p.email ?? "").toLowerCase() === email);
        if (!profile) continue; // profil yoksa atla (üye sistemde değil)
        const existingRow = byUserId.get(profile.id);
        if (existingRow) {
          map.set(profile.id, { ...existingRow });
        } else {
          map.set(
            profile.id,
            defaultProjectMemberPermission({
              projectId,
              userId: profile.id,
              userEmail: email,
              role: "member",
            })
          );
        }
      }
      return map;
    },
    [assignedEmails, allProfiles, projectId]
  );

  // Dialog açıldığında izinleri yükle
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMissingTable(false);
    void listProjectMemberPermissions(projectId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDrafts(buildDraftsFromAssigned(result.data));
      } else if (result.missingTable) {
        setMissingTable(true);
        setDrafts(buildDraftsFromAssigned([]));
      } else {
        setError("İzinler yüklenemedi (yetki veya bağlantı sorunu).");
        setDrafts(buildDraftsFromAssigned([]));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, buildDraftsFromAssigned]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    drafts.forEach((d) => {
      if (d._dirty) n++;
    });
    return n;
  }, [drafts]);

  const updateDraft = useCallback(
    (userId: string, patch: Partial<DraftRow>) => {
      setDrafts((prev) => {
        const next = new Map(prev);
        const current = next.get(userId);
        if (!current) return prev;
        next.set(userId, { ...current, ...patch, _dirty: true });
        return next;
      });
    },
    []
  );

  const handleRoleChange = (userId: string, role: ProjectMemberRole) => {
    const elevated = role === "project_owner" || role === "project_manager";
    updateDraft(userId, {
      project_role: role,
      // Rol değişince mantıklı default'lar (kullanıcı tek tek üzerine yazabilir)
      can_edit: elevated,
      can_export: elevated,
      can_bulk_update: elevated,
    });
  };

  const handleSave = async () => {
    const dirtyRows: ProjectMemberPermissionInput[] = [];
    drafts.forEach((d) => {
      if (d._dirty) {
        const { _dirty: _ignored, ...rest } = d;
        void _ignored;
        dirtyRows.push(rest);
      }
    });
    if (dirtyRows.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      const result = await upsertProjectMemberPermissions(dirtyRows);
      if (result.ok) {
        toast.success(`${dirtyRows.length} üye izni kaydedildi`);
        onOpenChange(false);
      } else {
        if (result.missingTable) {
          setMissingTable(true);
        }
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İzinler kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const draftList = Array.from(drafts.values());
  const unresolvedEmails = useMemo(() => {
    const resolvedEmails = new Set(draftList.map((d) => d.user_email));
    return assignedEmails.filter((e) => !resolvedEmails.has(e.trim().toLowerCase()));
  }, [assignedEmails, draftList]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0 dark:border-slate-700 dark:bg-slate-800" showClose>
        <div className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden />
              Üye İzinleri — {projectName}
            </DialogTitle>
            <DialogDescription>
              Her üyenin proje içindeki yetkilerini ayrıntılı yönetin. Maskesiz export ve toplu silme yetkilerini yalnızca yöneticiler atayabilir.
            </DialogDescription>
          </DialogHeader>

          {!canManage ? (
            <div className="px-5 py-12 text-center text-sm text-slate-600 dark:text-slate-300">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              Üye izinlerini yönetme yetkiniz yok. Yalnızca admin ve proje yöneticileri bu paneli kullanabilir.
            </div>
          ) : missingTable ? (
            <div className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/40">
              <p className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong>SQL şeması bulunamadı.</strong> Bu özelliği kullanmak için{" "}
                  <code className="rounded bg-white/70 px-1 text-xs dark:bg-slate-900/60">
                    scripts/project-member-permissions.sql
                  </code>{" "}
                  dosyasını Supabase SQL Editor&apos;da çalıştırın. Tablo oluşturulduktan sonra bu paneli yeniden açın.
                </span>
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              İzinler yükleniyor…
            </div>
          ) : (
            <>
              {error && (
                <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}
              {draftList.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Bu projeye henüz atanmış üye yok. Önce projeye kullanıcı atayın.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {unresolvedEmails.length > 0 && (
                    <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                      <strong>Uyarı:</strong> Atanan e-postaların {unresolvedEmails.length}{" "}
                      tanesi sistemde kayıtlı bir profile sahip değil — bu e-postalar listede görünmez.
                    </div>
                  )}
                  <ul className="space-y-2.5">
                    {draftList.map((row) => {
                      const profile = profileLookup.byUserId(row.user_id);
                      const displayName =
                        profile.nickname ||
                        profile.fullName?.split(/\s+/)[0] ||
                        row.user_email.split("@")[0] ||
                        row.user_email;
                      return (
                        <li
                          key={row.user_id}
                          className={cn(
                            "rounded-lg border bg-white p-3 shadow-sm transition-colors dark:bg-slate-800/60",
                            (row as DraftRow)._dirty
                              ? "border-blue-300 ring-1 ring-blue-200 dark:border-blue-600 dark:ring-blue-900/50"
                              : "border-slate-200 dark:border-slate-700"
                          )}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            {/* Kullanıcı bilgisi */}
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              <UserAvatar
                                avatarUrl={profile.avatarUrl}
                                email={row.user_email}
                                nickname={profile.nickname}
                                fullName={profile.fullName}
                                className="h-9 w-9 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {displayName}
                                  {(row as DraftRow)._dirty && (
                                    <span className="ml-1.5 text-[10px] font-normal text-blue-600 dark:text-blue-400">
                                      · değiştirildi
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                                  {row.user_email}
                                </div>
                              </div>
                            </div>
                            {/* Rol seçici */}
                            <div className="flex items-center gap-2">
                              <select
                                value={row.project_role}
                                onChange={(e) => handleRoleChange(row.user_id, e.target.value as ProjectMemberRole)}
                                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                title={ROLE_DESCRIPTIONS[row.project_role]}
                              >
                                {(Object.keys(ROLE_LABELS) as ProjectMemberRole[]).map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </option>
                                ))}
                              </select>
                              {row.project_role === "project_owner" && (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200">
                                  <Crown className="mr-0.5 h-2.5 w-2.5" />
                                  Sahip
                                </Badge>
                              )}
                            </div>
                          </div>
                          {/* 7+1 izin toggle grid */}
                          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                            {PERMISSION_FIELDS.map((field) => {
                              const checked = !!row[field.key];
                              const disabled = field.adminOnly && !isAdmin;
                              return (
                                <label
                                  key={field.key}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                                    disabled && "cursor-not-allowed opacity-60",
                                    checked
                                      ? field.adminOnly
                                        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200"
                                        : "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-950/30 dark:text-blue-200"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  )}
                                  title={field.desc + (field.adminOnly ? " — Yalnızca admin atayabilir." : "")}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={(e) => updateDraft(row.user_id, { [field.key]: e.target.checked } as Partial<DraftRow>)}
                                    className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="truncate font-medium">
                                    {field.label}
                                    {field.adminOnly && <span className="ml-0.5 text-amber-500" title="Yalnızca admin">*</span>}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="text-amber-500">*</span> Yalnızca admin atayabilir. Proje yöneticileri bu yetkileri vermek üzere admin&apos;e başvurabilir.
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/80">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Vazgeç
            </Button>
            {canManage && !missingTable && (
              <Button type="button" onClick={() => void handleSave()} disabled={saving || dirtyCount === 0}>
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                )}
                {dirtyCount > 0 ? `${dirtyCount} değişikliği kaydet` : "Kaydet"}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
