"use client";

import { useEffect, useState } from "react";
import {
  MessageSquarePlus,
  Lightbulb,
  Bug,
  HelpCircle,
  MessageSquare,
  Send,
  Loader2,
  Clock,
  Eye,
  Calendar,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  submitFeedback,
  listMyFeedback,
  type Feedback,
  type FeedbackType,
  type FeedbackStatus,
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

export default function GeriBildirimPage() {
  const { user, isLoaded } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"new" | "mine">("new");

  const [type, setType] = useState<FeedbackType>("suggestion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [mineList, setMineList] = useState<Feedback[]>([]);
  const [mineLoading, setMineLoading] = useState(false);

  const loadMine = async () => {
    setMineLoading(true);
    try {
      const list = await listMyFeedback();
      setMineList(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Liste yüklenemedi");
    } finally {
      setMineLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "mine" && user) void loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Başlık ve açıklama zorunlu.");
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        type,
        title,
        body,
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      toast.success("Geri bildiriminiz iletildi · Teşekkürler");
      setTitle("");
      setBody("");
      setType("suggestion");
      setTab("mine");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex max-w-2xl items-center justify-center gap-2 px-6 py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Yükleniyor…
      </div>
    );
  }

  if (!user) {
    return <div className="px-6 py-16 text-slate-600">Giriş yapmanız gerekir.</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Geri Bildirim" }]} />

      <header className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <MessageSquarePlus className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Geri Bildirim
        </h1>
      </header>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Öneri, hata bildirimi veya sorularınız için bize yazın. Yöneticiler görecek;
        yanıt durumunu &quot;Gönderdiklerim&quot; sekmesinden takip edebilirsiniz.
      </p>

      <div className="inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50">
        <button
          type="button"
          onClick={() => setTab("new")}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            tab === "new"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-600 hover:text-slate-800 dark:text-slate-400"
          )}
        >
          Yeni Gönder
        </button>
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            tab === "mine"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
              : "text-slate-600 hover:text-slate-800 dark:text-slate-400"
          )}
        >
          Gönderdiklerim
        </button>
      </div>

      {tab === "new" ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Tür</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_META) as FeedbackType[]).map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                const selected = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="fb-title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Başlık
            </label>
            <input
              id="fb-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kısaca sorununuz / öneriniz"
              maxLength={100}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-0.5 text-[10px] text-slate-400">{title.length} / 100</p>
          </div>

          <div>
            <label htmlFor="fb-body" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Açıklama
            </label>
            <textarea
              id="fb-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder={
                type === "bug"
                  ? "Hata ne zaman oluşuyor? Hangi adımlardan sonra? Beklediğin sonuç neydi?"
                  : type === "suggestion"
                  ? "Önerin nedir? Hangi sorunu çözer, kimleri etkiler?"
                  : type === "question"
                  ? "Sorunu açıkla, mevcut durumun ne olduğunu yaz."
                  : "Detayları paylaş…"
              }
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-0.5 text-[10px] text-slate-400">{body.length} / 2000</p>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            <p>
              Gönderdiğinde şu bilgi de eklenir:
              <br />
              <code className="text-[10px]">Sayfa: {typeof window !== "undefined" ? window.location.pathname : ""}</code> ·{" "}
              <code className="text-[10px]">Tarayıcı: kısa metin</code>
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !title.trim() || !body.trim()} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gönder
            </Button>
          </div>
        </form>
      ) : mineLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      ) : mineList.length === 0 ? (
        <EmptyState
          icon={<MessageSquarePlus className="h-10 w-10" />}
          title="Henüz gönderiniz yok"
          description='"Yeni Gönder" sekmesinden ilk geri bildiriminizi iletin.'
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {mineList.map((f) => {
            const typeMeta = TYPE_META[f.type];
            const statusMeta = STATUS_META[f.status];
            const TIcon = typeMeta.icon;
            const SIcon = statusMeta.icon;
            return (
              <li key={f.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-start gap-2">
                  <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", typeMeta.bg, typeMeta.text)}>
                    <TIcon className="h-3 w-3" />
                    {typeMeta.label}
                  </span>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", statusMeta.bg, statusMeta.text)}>
                    <SIcon className="h-3 w-3" />
                    {statusMeta.label}
                  </span>
                  <span className="ml-auto text-[10px] text-slate-400">
                    {getRelativeTime(new Date(f.created_at), new Date())}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{f.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{f.body}</p>
                {f.admin_notes && (
                  <div className="mt-2 rounded-md border-l-2 border-blue-400 bg-blue-50 px-2 py-1.5 text-xs text-slate-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-slate-200">
                    <strong className="block text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Yöneticiden cevap
                    </strong>
                    {f.admin_notes}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
