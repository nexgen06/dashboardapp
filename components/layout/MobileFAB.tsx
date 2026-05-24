"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, ListTodo } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { cn } from "@/lib/utils";

/**
 * Mobil Floating Action Button — sağ-alt sabit, MobileBottomNav'ın üstünde.
 *
 * Hızlı görev oluşturma akışı:
 *  1. FAB'a tıkla → modal açılır
 *  2. Proje seçici (kullanıcının erişimi olan projeler — admin tümü, üye atanmışlar)
 *  3. Görev içeriği (multi-line textarea)
 *  4. Kaydet → tasks tablosuna insert, başarıyla toast + modal kapanır
 *
 * Görünürlük: yalnızca md altı (mobil/tablet). Desktop'ta görünmez.
 * Yetki: area.liveTable + liveTable.view veya area.projects + projects.view
 * — yoksa FAB hiç render edilmez.
 *
 * UX detayları:
 *  - safe-area-inset-bottom + 5rem (MobileBottomNav 4rem + 1rem) yukarıda
 *  - Public auth sayfasında render edilmez (AppLayout ile aynı kontrol)
 *  - Modal kapatılınca form temizlenir
 *  - Cmd+Enter / Ctrl+Enter ile gönder
 */
export function MobileFAB() {
  const { user, hasPermission, isAdmin } = useAuth();
  const toast = useToast();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { createTasksBulk } = useTasksWithRealtime();

  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canProjects = hasPermission("area.projects") && hasPermission("projects.view");
  const canLiveTable = hasPermission("area.liveTable") && hasPermission("liveTable.view");
  const canCreate = canProjects || canLiveTable;

  // Kullanıcının yazabileceği projeler — admin tümü, diğer roller assigned_emails'de olanlar
  const currentEmail = (user?.email ?? "").trim().toLowerCase();
  const writableProjects = useMemo(() => {
    if (isAdmin) return projects;
    if (!currentEmail) return [];
    return projects.filter((p) =>
      (p.assigned_emails ?? []).some((e) => e.trim().toLowerCase() === currentEmail)
    );
  }, [projects, isAdmin, currentEmail]);

  // Modal ilk açılışta varsayılan projeyi otomatik seç (ilk writable proje)
  useEffect(() => {
    if (open && !projectId && writableProjects.length > 0) {
      setProjectId(writableProjects[0].id);
    }
  }, [open, projectId, writableProjects]);

  // Modal kapanınca formu temizle
  useEffect(() => {
    if (!open) {
      setContent("");
      setProjectId("");
    }
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || !projectId) {
      toast.error("Görev içeriği ve proje gerekli.");
      return;
    }
    setSubmitting(true);
    try {
      await createTasksBulk([
        {
          content: trimmed,
          status: "Yapılacak",
          assignee: user?.email ?? null,
          project_id: projectId,
        },
      ]);
      toast.success("Görev oluşturuldu");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  // Yetki yoksa veya kullanıcı giriş yapmamışsa hiç render etme
  if (!user || !canCreate) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hızlı görev ekle"
        title="Hızlı görev ekle"
        className={cn(
          "fixed z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition-all active:scale-95",
          "hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40",
          // Sağ-alt, MobileBottomNav (≈4rem yüksek) üzerinde, safe-area dahil
          "right-4",
          "md:hidden"
        )}
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
        }}
      >
        <Plus className="h-6 w-6" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" showClose>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden />
              Hızlı görev ekle
            </DialogTitle>
            <DialogDescription>
              Görev varsayılan olarak &quot;Yapılacak&quot; statüsünde, size atanmış olarak oluşturulur.
            </DialogDescription>
          </DialogHeader>

          {writableProjects.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-4 text-center text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {projectsLoading ? (
                <>
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                  Projeler yükleniyor…
                </>
              ) : (
                <>Henüz yazabileceğiniz bir proje yok. Önce bir projeye atanın.</>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Proje
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                >
                  {writableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "(adsız)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                Görev içeriği
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="Ne yapılacak? (örn: Onayı bekleyen faturayı kontrol et)"
                  rows={4}
                  autoFocus
                  className="resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                />
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                  Cmd/Ctrl + Enter ile hızlı gönder
                </span>
              </label>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={submitting || !content.trim() || !projectId}>
                  {submitting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  )}
                  Görevi oluştur
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
