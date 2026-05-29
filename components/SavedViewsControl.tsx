"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  Globe2,
  Loader2,
  Lock,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import {
  clearProjectDefaultSavedView,
  createSavedView,
  deleteSavedView,
  isSameViewConfig,
  isViewProjectDefaultFor,
  listSavedViews,
  setProjectDefaultSavedView,
  updateSavedView,
  type SavedView,
  type SavedViewConfig,
  type SavedViewScope,
} from "@/lib/savedViews";
import { cn } from "@/lib/utils";

type Props = {
  /** Mevcut filtre+sıralama+kolon görünürlüğünü snapshot olarak veren callback. */
  getCurrentConfig: () => SavedViewConfig;
  /** View seçildiğinde tablonun state'lerini güncellemek için. */
  onApplyConfig: (config: SavedViewConfig) => void;
  /** Kullanıcı admin mi — shared view yönetimi için. */
  isAdmin: boolean;
  /** Şu anki user id — view sahibi mi kontrolü için. */
  userId: string | null;
  /** v1: "live_table" */
  target?: string;
  /** Tek proje seçiliyken proje varsayılanı yönetimi gösterilir. */
  projectId?: string | null;
  /** Dışarıdan uygulanan görünüm (örn. proje varsayılanı otomatik yükleme). */
  syncActiveViewId?: string | null;
};

export function SavedViewsControl({
  getCurrentConfig,
  onApplyConfig,
  isAdmin,
  userId,
  target = "live_table",
  projectId = null,
  syncActiveViewId = null,
}: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [activeBaseConfig, setActiveBaseConfig] = useState<SavedViewConfig | null>(null);
  /** Yeni / düzenleme diyaloğu */
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "rename" | "overwrite">("create");
  const [editorTargetView, setEditorTargetView] = useState<SavedView | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<SavedViewScope>("private");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSavedViews(target);
      setViews(list);
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!syncActiveViewId) return;
    const v = views.find((x) => x.id === syncActiveViewId);
    if (v) {
      setActiveViewId(v.id);
      setActiveBaseConfig(v.config);
      setIsDirty(false);
    }
  }, [syncActiveViewId, views]);

  const activeView = useMemo(
    () => (activeViewId ? views.find((v) => v.id === activeViewId) ?? null : null),
    [activeViewId, views]
  );

  // Aktif view varsa, mevcut filtreler ondan farklı mı? "Değiştirildi" rozeti için
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    if (!activeView || !activeBaseConfig) {
      setIsDirty(false);
      return;
    }
    // Polling değil — her render'da hesapla (cheap stringify)
    const id = window.setInterval(() => {
      setIsDirty(!isSameViewConfig(getCurrentConfig(), activeBaseConfig));
    }, 700);
    return () => window.clearInterval(id);
  }, [activeView, activeBaseConfig, getCurrentConfig]);

  const handleApply = useCallback(
    (v: SavedView) => {
      onApplyConfig(v.config);
      setActiveViewId(v.id);
      setActiveBaseConfig(v.config);
      setIsDirty(false);
      toast.success(`"${v.name}" görünümü uygulandı`);
    },
    [onApplyConfig, toast]
  );

  const openCreate = () => {
    setEditorMode("create");
    setEditorTargetView(null);
    setName("");
    setScope("private");
    setError(null);
    setEditorOpen(true);
  };

  const openRename = (v: SavedView) => {
    setEditorMode("rename");
    setEditorTargetView(v);
    setName(v.name);
    setScope(v.scope);
    setError(null);
    setEditorOpen(true);
  };

  const openOverwrite = (v: SavedView) => {
    setEditorMode("overwrite");
    setEditorTargetView(v);
    setName(v.name);
    setScope(v.scope);
    setError(null);
    setEditorOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Görünüm adı boş olamaz.");
      return;
    }
    setSubmitting(true);
    try {
      if (editorMode === "create") {
        const config = getCurrentConfig();
        const v = await createSavedView({ name: trimmed, scope, config, target });
        await refresh();
        setActiveViewId(v.id);
        setActiveBaseConfig(config);
        toast.success(`"${v.name}" kaydedildi`);
      } else if (editorMode === "rename" && editorTargetView) {
        await updateSavedView(editorTargetView.id, { name: trimmed, scope });
        await refresh();
        toast.success("Görünüm güncellendi");
      } else if (editorMode === "overwrite" && editorTargetView) {
        const config = getCurrentConfig();
        await updateSavedView(editorTargetView.id, { name: trimmed, scope, config });
        await refresh();
        setActiveBaseConfig(config);
        setIsDirty(false);
        toast.success(`"${trimmed}" üzerine yazıldı`);
      }
      setEditorOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kayıt başarısız";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (v: SavedView) => {
    const ok = await confirm({
      title: "Görünümü sil",
      message: `"${v.name}" görünümü kalıcı olarak silinsin mi?`,
      confirmLabel: "Sil",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteSavedView(v.id);
      await refresh();
      if (activeViewId === v.id) {
        setActiveViewId(null);
        setActiveBaseConfig(null);
      }
      toast.success("Görünüm silindi");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Silme başarısız";
      toast.error(msg);
    }
  };

  const canManage = (v: SavedView) =>
    v.userId === userId || (v.scope === "shared" && isAdmin);

  const projectDefaultView = useMemo(
    () => (projectId ? views.find((v) => isViewProjectDefaultFor(v, projectId)) ?? null : null),
    [projectId, views]
  );

  const handleSetProjectDefault = async (v: SavedView) => {
    if (!projectId) return;
    if (v.scope !== "shared") {
      toast.error("Proje varsayılanı için görünüm paylaşılan olmalı.");
      return;
    }
    try {
      const updated = await setProjectDefaultSavedView(projectId, v.id);
      await refresh();
      setActiveViewId(updated.id);
      setActiveBaseConfig(updated.config);
      toast.success(`"${updated.name}" proje varsayılanı yapıldı`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Varsayılan atanamadı");
    }
  };

  const handleClearProjectDefault = async () => {
    if (!projectId) return;
    try {
      await clearProjectDefaultSavedView(projectId);
      await refresh();
      toast.success("Proje varsayılan görünüm kaldırıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Varsayılan kaldırılamadı");
    }
  };

  const sharedViews = views.filter((v) => v.scope === "shared");
  const privateViews = views.filter((v) => v.scope === "private");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-slate-700 dark:text-slate-300"
            aria-label="Görünümler"
          >
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
            <span className="max-w-[140px] truncate">
              {activeView ? activeView.name : "Görünümler"}
            </span>
            {isDirty && (
              <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 text-[9px] font-bold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                Değişti
              </span>
            )}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400">
            Kayıtlı görünümler
          </DropdownMenuLabel>
          {projectId && (
            <div className="px-2 pb-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {projectDefaultView ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500" aria-hidden />
                  Proje varsayılanı: <strong className="font-medium text-slate-700 dark:text-slate-200">{projectDefaultView.name}</strong>
                </span>
              ) : (
                "Bu proje için varsayılan görünüm atanmadı."
              )}
            </div>
          )}
          <DropdownMenuSeparator />
          {loading && views.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yükleniyor…
            </div>
          ) : views.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-slate-500">
              Henüz kayıtlı görünüm yok.
              <br />
              Mevcut filtreleri kaydederek başla.
            </div>
          ) : (
            <>
              {sharedViews.length > 0 && (
                <>
                  <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Paylaşılan
                  </div>
                  {sharedViews.map((v) => (
                    <ViewRow
                      key={v.id}
                      view={v}
                      active={activeViewId === v.id}
                      isProjectDefault={projectId ? isViewProjectDefaultFor(v, projectId) : false}
                      canManage={canManage(v)}
                      onApply={() => handleApply(v)}
                      onRename={() => openRename(v)}
                      onOverwrite={() => openOverwrite(v)}
                      onDelete={() => void handleDelete(v)}
                    />
                  ))}
                </>
              )}
              {privateViews.length > 0 && (
                <>
                  {sharedViews.length > 0 && <DropdownMenuSeparator />}
                  <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Özel
                  </div>
                  {privateViews.map((v) => (
                    <ViewRow
                      key={v.id}
                      view={v}
                      active={activeViewId === v.id}
                      isProjectDefault={false}
                      canManage={canManage(v)}
                      onApply={() => handleApply(v)}
                      onRename={() => openRename(v)}
                      onOverwrite={() => openOverwrite(v)}
                      onDelete={() => void handleDelete(v)}
                    />
                  ))}
                </>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openCreate}>
            <BookmarkPlus className="mr-2 h-4 w-4" aria-hidden />
            Mevcut filtreleri kaydet…
          </DropdownMenuItem>
          {activeView && isDirty && canManage(activeView) && (
            <DropdownMenuItem onClick={() => openOverwrite(activeView)}>
              <Check className="mr-2 h-4 w-4" aria-hidden />
              &quot;{activeView.name}&quot; üzerine yaz
            </DropdownMenuItem>
          )}
          {projectId && activeView && canManage(activeView) && activeView.scope === "shared" && (
            <DropdownMenuItem onClick={() => void handleSetProjectDefault(activeView)}>
              <Star className="mr-2 h-4 w-4" aria-hidden />
              Bu projeye varsayılan yap
            </DropdownMenuItem>
          )}
          {projectId && projectDefaultView && (canManage(projectDefaultView) || isAdmin) && (
            <DropdownMenuItem onClick={() => void handleClearProjectDefault()}>
              <Star className="mr-2 h-4 w-4 opacity-50" aria-hidden />
              Proje varsayılanını kaldır
            </DropdownMenuItem>
          )}
          {activeView && (
            <DropdownMenuItem
              onClick={() => {
                setActiveViewId(null);
                setActiveBaseConfig(null);
                setIsDirty(false);
              }}
            >
              <X className="mr-2 h-4 w-4" aria-hidden />
              Görünümü temizle
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Editor (create/rename/overwrite) */}
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open && !submitting) setEditorOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editorMode === "create"
                ? "Yeni görünüm"
                : editorMode === "rename"
                  ? "Görünümü yeniden adlandır"
                  : "Üzerine yaz"}
            </DialogTitle>
            <DialogDescription>
              {editorMode === "overwrite"
                ? "Mevcut filtreler, sıralama ve sütun görünürlüğü bu görünüme kaydedilecek."
                : "Adlandırılmış bir görünüm oluştur. Tek tıkla geri dönebilirsin."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Ad
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Bu haftaki kritik görevler"
                required
                autoFocus
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Görünürlük
              </label>
              <div className="grid grid-cols-2 gap-2">
                <ScopeOption
                  value="private"
                  current={scope}
                  onChange={setScope}
                  icon={<Lock className="h-3.5 w-3.5" />}
                  title="Özel"
                  desc="Sadece sen görürsün"
                />
                <ScopeOption
                  value="shared"
                  current={scope}
                  onChange={setScope}
                  icon={<Globe2 className="h-3.5 w-3.5" />}
                  title="Paylaşılan"
                  desc="Tüm ekip görür"
                />
              </div>
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                {error}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={submitting}
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={submitting || !name.trim()}
                className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kaydediliyor…
                  </>
                ) : editorMode === "overwrite" ? (
                  "Üzerine yaz"
                ) : (
                  "Kaydet"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewRow({
  view,
  active,
  isProjectDefault,
  canManage,
  onApply,
  onRename,
  onOverwrite,
  onDelete,
}: {
  view: SavedView;
  active: boolean;
  isProjectDefault: boolean;
  canManage: boolean;
  onApply: () => void;
  onRename: () => void;
  onOverwrite: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md px-1 py-0.5",
        active && "bg-blue-50 dark:bg-blue-950/30"
      )}
    >
      <button
        type="button"
        onClick={onApply}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-sm",
          "hover:bg-slate-50 dark:hover:bg-slate-700/60",
          active && "font-medium text-blue-800 dark:text-blue-200"
        )}
      >
        {view.scope === "shared" ? (
          <Globe2 className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{view.name}</span>
        {isProjectDefault && (
          <Star className="h-3 w-3 shrink-0 text-amber-500" aria-label="Proje varsayılanı" />
        )}
        {active && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden />}
      </button>
      {canManage && (
        <div className="hidden gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={onOverwrite}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
            title="Mevcut filtreleri üzerine yaz"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onRename}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
            title="Yeniden adlandır"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
            title="Sil"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function ScopeOption({
  value,
  current,
  onChange,
  icon,
  title,
  desc,
}: {
  value: SavedViewScope;
  current: SavedViewScope;
  onChange: (s: SavedViewScope) => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors",
        active
          ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30"
          : "border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700/40"
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
        {icon}
        {title}
      </div>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{desc}</p>
    </button>
  );
}
