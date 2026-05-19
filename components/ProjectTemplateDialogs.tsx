"use client";

import { useEffect, useState, useCallback } from "react";
import { Bookmark, Trash2, FolderPlus, Users, Lock, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import {
  listProjectTemplates,
  saveProjectAsTemplate,
  deleteProjectTemplate,
  setProjectTemplateScope,
  type ProjectTemplate,
  type TemplateScope,
} from "@/lib/projectTemplates";
import type { Project } from "@/types/project";
import type { Task } from "@/types/tasks";
import { cn } from "@/lib/utils";

/** Şablon kaydet: bir projeyi (+ opsiyonel görev listesi) şablona dönüştürür. */
export function SaveTemplateDialog({
  open,
  onOpenChange,
  project,
  tasks,
  isAdmin,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  tasks: Task[];
  isAdmin: boolean;
  onSaved?: (templateId: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [includeTasks, setIncludeTasks] = useState(true);
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && project) {
      setName(`${project.name} — şablonu`);
      setIncludeTasks(tasks.length > 0);
      setShared(false);
    }
  }, [open, project, tasks.length]);

  const handleSave = async () => {
    if (!project || !name.trim()) return;
    setSaving(true);
    try {
      const id = await saveProjectAsTemplate({
        name: name.trim(),
        description: project.description,
        scope: shared ? "shared" : "private",
        project,
        tasks: includeTasks ? tasks : [],
      });
      toast.success("Şablon kaydedildi");
      onSaved?.(id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Şablon kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-slate-500" aria-hidden />
            Projeyi şablon olarak kaydet
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label htmlFor="tmpl-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Şablon adı
            </label>
            <input
              id="tmpl-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. Müşteri onboarding"
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={includeTasks}
              onChange={(e) => setIncludeTasks(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Bu projedeki <strong>{tasks.length}</strong> görevi de şablona dahil et
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Görev içerikleri + durum/öncelik/atanan + bitiş tarihi (bugünden offset olarak).
              </span>
            </span>
          </label>
          {isAdmin && (
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Ekip ile paylaş (tüm kullanıcılar bu şablonu kullanabilir)
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Vazgeç
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Şablonu kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Şablon listesi: kullan / paylaşımı değiştir / sil. */
export function TemplateListDialog({
  open,
  onOpenChange,
  isAdmin,
  currentUserId,
  onUseTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  currentUserId: string | null;
  onUseTemplate: (template: ProjectTemplate) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await listProjectTemplates());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Şablonlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleDelete = async (t: ProjectTemplate) => {
    const ok = await confirm({
      title: "Şablonu sil",
      message: `"${t.name}" şablonu kalıcı olarak silinsin mi?`,
      confirmLabel: "Sil",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(t.id);
    try {
      await deleteProjectTemplate(t.id);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleScope = async (t: ProjectTemplate) => {
    const next: TemplateScope = t.scope === "shared" ? "private" : "shared";
    setBusyId(t.id);
    try {
      await setProjectTemplateScope(t.id, next);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Değiştirilemedi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-slate-500" aria-hidden />
            Proje şablonları
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              <span className="text-sm">Yükleniyor…</span>
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={<Bookmark className="h-8 w-8" />}
              title="Henüz şablon yok"
              description='Bir proje kartının "⋮" menüsünden "Şablon olarak kaydet" diyerek başla.'
            />
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {templates.map((t) => {
                const isOwner = currentUserId && t.user_id === currentUserId;
                const canModify = isOwner || isAdmin;
                return (
                  <li key={t.id} className="py-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            {t.name}
                          </span>
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              t.scope === "shared"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            )}
                          >
                            {t.scope === "shared" ? (
                              <>
                                <Users className="h-2.5 w-2.5" aria-hidden /> paylaşılan
                              </>
                            ) : (
                              <>
                                <Lock className="h-2.5 w-2.5" aria-hidden /> özel
                              </>
                            )}
                          </span>
                        </div>
                        {t.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {t.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                          {t.tasks.length} görev şablonu · {new Date(t.updated_at).toLocaleDateString("tr-TR")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            onUseTemplate(t);
                            onOpenChange(false);
                          }}
                          className="h-7 gap-1 text-xs"
                        >
                          <FolderPlus className="h-3 w-3" aria-hidden />
                          Kullan
                        </Button>
                        {canModify && isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleToggleScope(t)}
                            disabled={busyId === t.id}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                            title={t.scope === "shared" ? "Özele döndür" : "Paylaşılan yap"}
                          >
                            {t.scope === "shared" ? (
                              <Lock className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <Users className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        )}
                        {canModify && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(t)}
                            disabled={busyId === t.id}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            title="Şablonu sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" aria-hidden /> Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
