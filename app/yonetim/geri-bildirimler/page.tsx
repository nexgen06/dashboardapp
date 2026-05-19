"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquarePlus,
  Lightbulb,
  Bug,
  HelpCircle,
  MessageSquare,
  Loader2,
  RefreshCw,
  Shield,
  Clock,
  Eye,
  Calendar,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  listAllFeedback,
  updateFeedback,
  deleteFeedback,
  type Feedback,
  type FeedbackType,
  type FeedbackStatus,
  type FeedbackPriority,
} from "@/lib/feedback";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

const TYPE_META: Record<FeedbackType, { label: string; icon: typeof Lightbulb; bg: string; text: string }> = {
  suggestion: { label: "Öneri", icon: Lightbulb, bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  bug: { label: "Hata", icon: Bug, bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  question: { label: "Soru", icon: HelpCircle, bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  other: { label: "Diğer", icon: MessageSquare, bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
};

const STATUS_META: Record<FeedbackStatus, { label: string; icon: typeof Clock; bg: string; text: string }> = {
  new: { label: "Yeni", icon: Clock, bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  reviewing: { label: "İnceleniyor", icon: Eye, bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  planned: { label: "Planlandı", icon: Calendar, bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300" },
  done: { label: "Tamamlandı", icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  wontfix: { label: "Yapılmayacak", icon: XCircle, bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
};

export default function FeedbackAdminPage() {
  const { hasPermission, isLoaded } = useAuth();
  const canManage =
    hasPermission("area.feedbackAdmin") && hasPermission("feedback.manage");
  const toast = useToast();
  const confirm = useConfirm();
  const profileLookup = useProfileLookup();

  const [list, setList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listAllFeedback({
        status: statusFilter === "all" ? null : statusFilter,
        type: typeFilter === "all" ? null : typeFilter,
        limit: 500,
      });
      setList(rows);
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
  }, [canManage, statusFilter, typeFilter]);

  const onStatusChange = async (f: Feedback, status: FeedbackStatus) => {
    setBusyId(f.id);
    try {
      await updateFeedback(f.id, { status });
      setList((prev) => prev.map((x) => (x.id === f.id ? { ...x, status } : x)));
      toast.success(`Durum: ${STATUS_META[status].label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const onPriorityChange = async (f: Feedback, priority: FeedbackPriority | null) => {
    setBusyId(f.id);
    try {
      await updateFeedback(f.id, { priority });
      setList((prev) => prev.map((x) => (x.id === f.id ? { ...x, priority } : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const onAdminNotesSave = async (f: Feedback, notes: string) => {
    setBusyId(f.id);
    try {
      await updateFeedback(f.id, { admin_notes: notes });
      setList((prev) =>
        prev.map((x) => (x.id === f.id ? { ...x, admin_notes: notes } : x))
      );
      toast.success("Yönetici notu kaydedildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (f: Feedback) => {
    const ok = await confirm({
      title: "Geri bildirimi sil",
      message: `"${f.title}" kalıcı olarak silinsin mi?`,
      confirmLabel: "Sil",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(f.id);
    try {
      await deleteFeedback(f.id);
      setList((prev) => prev.filter((x) => x.id !== f.id));
      toast.success("Silindi");
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
            Geri bildirim yönetimine erişim yetkiniz yok.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">{`Dashboard'a dön`}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Yönetim" }, { label: "Geri bildirimler" }]} />

      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-slate-500" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Geri bildirim yönetimi
          </h1>
          <span className="text-xs text-slate-500">· {list.length}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Yenile
        </Button>
      </header>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Durum:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">Tümü</option>
          {(Object.keys(STATUS_META) as FeedbackStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <span className="text-xs font-medium text-slate-500">Tür:</span>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as FeedbackType | "all")}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">Tümü</option>
          {(Object.keys(TYPE_META) as FeedbackType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>
      </div>

      {loading && list.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<MessageSquarePlus className="h-10 w-10" />}
          title="Bu filtreyle geri bildirim yok"
          description="Filtreleri değiştirmeyi deneyin."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((f) => {
            const typeMeta = TYPE_META[f.type];
            const statusMeta = STATUS_META[f.status];
            const TIcon = typeMeta.icon;
            const SIcon = statusMeta.icon;
            const profile = profileLookup.byEmail(f.user_email);
            const expanded = expandedId === f.id;
            return (
              <li
                key={f.id}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <div className="flex items-start gap-2">
                  <UserAvatar
                    avatarUrl={profile.avatarUrl}
                    nickname={profile.nickname}
                    fullName={profile.fullName}
                    email={f.user_email}
                    className="h-8 w-8 shrink-0 text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", typeMeta.bg, typeMeta.text)}>
                        <TIcon className="h-3 w-3" /> {typeMeta.label}
                      </span>
                      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", statusMeta.bg, statusMeta.text)}>
                        <SIcon className="h-3 w-3" /> {statusMeta.label}
                      </span>
                      {f.priority && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            f.priority === "high"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : f.priority === "medium"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          )}
                        >
                          {f.priority}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-slate-400">
                        {getRelativeTime(new Date(f.created_at), new Date())}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {profile.nickname || profile.fullName || f.user_email}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {f.title}
                    </h3>
                    <p className={cn("mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400", !expanded && "line-clamp-2")}>
                      {f.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : f.id)}
                      className="mt-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {expanded ? "Daralt" : "Detayı göster"}
                    </button>

                    {expanded && (
                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                        {f.page_url && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            <strong>Sayfa:</strong>{" "}
                            <a href={f.page_url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
                              {f.page_url}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </p>
                        )}
                        {f.user_agent && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            <strong>Tarayıcı:</strong> <code className="text-[10px]">{f.user_agent}</code>
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Durum:
                          </label>
                          <select
                            value={f.status}
                            onChange={(e) => void onStatusChange(f, e.target.value as FeedbackStatus)}
                            disabled={busyId === f.id}
                            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {(Object.keys(STATUS_META) as FeedbackStatus[]).map((s) => (
                              <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                          </select>
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Öncelik:
                          </label>
                          <select
                            value={f.priority ?? ""}
                            onChange={(e) => void onPriorityChange(f, (e.target.value || null) as FeedbackPriority | null)}
                            disabled={busyId === f.id}
                            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <option value="">—</option>
                            <option value="low">Düşük</option>
                            <option value="medium">Orta</option>
                            <option value="high">Yüksek</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void onDelete(f)}
                            disabled={busyId === f.id}
                            className="ml-auto inline-flex items-center gap-1 rounded p-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" /> Sil
                          </button>
                        </div>

                        <AdminNotesEditor
                          initial={f.admin_notes ?? ""}
                          onSave={(notes) => onAdminNotesSave(f, notes)}
                          busy={busyId === f.id}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AdminNotesEditor({
  initial,
  onSave,
  busy,
}: {
  initial: string;
  onSave: (notes: string) => Promise<void> | void;
  busy?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(initial);
    setDirty(false);
  }, [initial]);

  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Yöneticiden cevap (kullanıcı görür)
      </label>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        rows={2}
        placeholder="Cevap / not yaz…"
        className="w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
      />
      {dirty && (
        <div className="mt-1 flex justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue(initial);
              setDirty(false);
            }}
            className="h-6 text-xs"
            disabled={busy}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              await onSave(value);
              setDirty(false);
            }}
            disabled={busy}
            className="h-6 text-xs"
          >
            Kaydet
          </Button>
        </div>
      )}
    </div>
  );
}
