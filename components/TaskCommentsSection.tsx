"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Loader2, Send, Pencil, Trash2, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTaskComments } from "@/hooks/useTaskComments";
import {
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  type TaskComment,
} from "@/lib/taskComments";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

type Props = {
  taskId: string;
};

/** Görev detay panelinde "Yorumlar" bölümü — liste + ekleme + sahibi için düzenle/sil. */
export function TaskCommentsSection({ taskId }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { comments, isLoading, error } = useTaskComments(taskId);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Yeni yorum eklendiğinde otomatik kaydır
  useEffect(() => {
    if (comments.length > 0) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [comments.length]);

  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const currentUserId = user?.id ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !user?.email) return;
    setSubmitting(true);
    try {
      await createTaskComment({
        taskId,
        body,
        userEmail: user.email,
        userDisplayName: user.displayName ?? null,
      });
      setDraft("");
      toast.success("Yorum eklendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yorum eklenemedi");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c: TaskComment) => {
    setEditingId(c.id);
    setEditingBody(c.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingBody("");
  };

  const saveEdit = async (c: TaskComment) => {
    const body = editingBody.trim();
    if (!body || body === c.body) {
      cancelEdit();
      return;
    }
    setBusyId(c.id);
    try {
      await updateTaskComment(c.id, body);
      cancelEdit();
      toast.success("Yorum güncellendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (c: TaskComment) => {
    const ok = await confirm({
      title: "Yorumu sil",
      message: "Bu yorum kalıcı olarak silinsin mi?",
      confirmLabel: "Sil",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await deleteTaskComment(c.id);
      toast.success("Yorum silindi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <MessageSquare className="h-3 w-3" aria-hidden />
        Yorumlar
        {comments.length > 0 && (
          <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {comments.length}
          </span>
        )}
      </h3>

      {error && (
        <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {isLoading && comments.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Yükleniyor…
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
          Henüz yorum yok. İlk yorumu sen yaz.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {comments.map((c) => {
            const isOwner = currentUserId === c.user_id;
            const isEditing = editingId === c.id;
            const isBusy = busyId === c.id;
            const name = c.user_display_name?.trim() || c.user_email;
            return (
              <li
                key={c.id}
                className="group flex gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <UserAvatar
                  email={c.user_email}
                  nickname={c.user_display_name}
                  className="h-7 w-7 text-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {name}
                    </span>
                    <span
                      className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500"
                      title={new Date(c.created_at).toLocaleString("tr-TR")}
                    >
                      {getRelativeTime(new Date(c.created_at), new Date())}
                      {c.updated_at !== c.created_at && (
                        <span className="ml-1 italic">(düzenlendi)</span>
                      )}
                    </span>
                    {isOwner && !isEditing && (
                      <span className="ml-auto hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          title="Düzenle"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(c)}
                          disabled={isBusy}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Sil"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1">
                      <textarea
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        rows={2}
                        className="w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                      />
                      <div className="mt-1 flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={cancelEdit}
                          className="h-7"
                          disabled={isBusy}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveEdit(c)}
                          className="h-7"
                          disabled={isBusy || !editingBody.trim()}
                        >
                          {isBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        "mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200",
                        isBusy && "opacity-50"
                      )}
                    >
                      {c.body}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          <div ref={listEndRef} aria-hidden />
        </ul>
      )}

      {/* Yorum ekle */}
      {user?.email && (
        <form onSubmit={handleSubmit} className="mt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Yorum yaz… (Cmd+Enter ile gönder)"
            rows={2}
            disabled={submitting}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {draft.length > 0 && `${draft.length} / 5000`}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !draft.trim()}
              className="h-7 gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Gönder
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
