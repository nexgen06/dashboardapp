"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Megaphone,
  Loader2,
  PlusCircle,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  X,
  Save,
  Shield,
  Eye,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getReadCount,
  type Announcement,
} from "@/lib/announcements";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

export default function DuyurularAdminPage() {
  const { hasPermission, isLoaded } = useAuth();
  const canManage =
    hasPermission("area.announcementsAdmin") && hasPermission("notifications.send");
  const toast = useToast();
  const confirm = useConfirm();

  const [list, setList] = useState<Announcement[]>([]);
  const [readCounts, setReadCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftPinned, setDraftPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listAnnouncements();
      setList(rows);
      // Her duyuru için okuma sayacını paralel çek
      const counts = await Promise.all(
        rows.map(async (a) => [a.id, await getReadCount(a.id).catch(() => 0)] as const)
      );
      setReadCounts(new Map(counts));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const openNew = () => {
    setEditing(null);
    setDraftTitle("");
    setDraftBody("");
    setDraftPinned(false);
    setDialogOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setDraftTitle(a.title);
    setDraftBody(a.body);
    setDraftPinned(a.pinned);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim() || !draftBody.trim()) {
      toast.error("Başlık ve metin zorunlu");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, {
          title: draftTitle,
          body: draftBody,
          pinned: draftPinned,
        });
        toast.success("Duyuru güncellendi");
      } else {
        await createAnnouncement({
          title: draftTitle,
          body: draftBody,
          pinned: draftPinned,
        });
        toast.success("Duyuru yayımlandı");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePin = async (a: Announcement) => {
    setBusyId(a.id);
    try {
      await updateAnnouncement(a.id, { pinned: !a.pinned });
      setList((prev) => prev.map((x) => (x.id === a.id ? { ...x, pinned: !a.pinned } : x)));
      toast.success(!a.pinned ? "Üstte sabitlendi" : "Sabitleme kaldırıldı");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Değiştirilemedi");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (a: Announcement) => {
    const ok = await confirm({
      title: "Duyuruyu sil",
      message: `"${a.title}" kalıcı olarak silinsin mi? Okuyan kullanıcılar için de kaybolur.`,
      confirmLabel: "Sil",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(a.id);
    try {
      await deleteAnnouncement(a.id);
      setList((prev) => prev.filter((x) => x.id !== a.id));
      toast.success("Duyuru silindi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex max-w-2xl items-center justify-center gap-2 px-6 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-12 w-12 text-amber-600 dark:text-amber-400" />
          <p className="font-medium text-slate-800 dark:text-slate-200">
            Duyuru yönetimine erişim yetkiniz yok.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">{`Dashboard'a dön`}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Yönetim" }, { label: "Duyurular" }]} />

      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-slate-500" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Duyurular
          </h1>
          <span className="text-xs text-slate-500">· {list.length} aktif</span>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <PlusCircle className="h-4 w-4" /> Yeni duyuru
        </Button>
      </header>

      {loading && list.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="Henüz duyuru yok"
          description='Üstteki "Yeni duyuru" ile ilk duyurunu yayımla.'
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((a) => {
            const readCount = readCounts.get(a.id) ?? 0;
            const expired = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
            return (
              <li
                key={a.id}
                className={cn(
                  "rounded-lg border p-3",
                  a.pinned
                    ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40",
                  expired && "opacity-60"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {a.pinned && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Pin className="h-2.5 w-2.5" /> Sabitlendi
                        </span>
                      )}
                      {expired && (
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          Süresi geçti
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">
                        {getRelativeTime(new Date(a.created_at), new Date())}
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {a.title}
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
                      {a.body}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {readCount} kişi okudu
                      </span>
                      <span>· {a.author_email}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => void togglePin(a)}
                      disabled={busyId === a.id}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title={a.pinned ? "Sabitlemeyi kaldır" : "Üstte sabitle"}
                    >
                      {a.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      disabled={busyId === a.id}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                      title="Düzenle"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(a)}
                      disabled={busyId === a.id}
                      className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      title="Sil"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-slate-500" />
              {editing ? "Duyuruyu düzenle" : "Yeni duyuru"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-2">
            <div>
              <label htmlFor="ann-title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Başlık
              </label>
              <input
                id="ann-title"
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Kısa başlık"
                maxLength={120}
                autoFocus
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">{draftTitle.length} / 120</p>
            </div>
            <div>
              <label htmlFor="ann-body" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Mesaj
              </label>
              <textarea
                id="ann-body"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={6}
                maxLength={5000}
                placeholder="Tüm kullanıcılara gönderilecek mesaj…"
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <p className="mt-0.5 text-[10px] text-slate-400">{draftBody.length} / 5000</p>
            </div>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={draftPinned}
                onChange={(e) => setDraftPinned(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Üstte sabitle
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Bildirimler sayfasında ve listede en üstte görünür.
                </span>
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                <X className="mr-1.5 h-4 w-4" /> Vazgeç
              </Button>
              <Button type="submit" disabled={submitting || !draftTitle.trim() || !draftBody.trim()}>
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {editing ? "Güncelle" : "Yayımla"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
