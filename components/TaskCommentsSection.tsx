"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
import { useProfileLookup } from "@/contexts/profile-lookup-context";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import {
  detectMentionContext,
  insertMention,
  extractMentionPrefixes,
  resolveMentionsToProfiles,
  searchProfilesForMention,
  type MentionContext,
} from "@/lib/mentions";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";
import { MentionRenderer } from "@/components/MentionRenderer";
import { supabase } from "@/lib/supabaseClient";
import type { UserProfile } from "@/lib/profile";

type Props = {
  taskId: string;
  /** Mention bildirimi gönderilen URL'i oluşturmak için (örn /projeler/x?openTask=y). Boşsa /canli-tablo. */
  projectId?: string | null;
  canComment?: boolean;
  className?: string;
  /**
   * Hücre-bazlı yorum: doldurulursa sadece bu field'a ait yorumlar listelenir
   * ve yeni yorum bu fieldKey ile kaydedilir. Undefined → görev seviyesi (eski).
   * Format: "status", "due_date", "extra:Sicil No" (tablo column.id ile birebir).
   */
  fieldKey?: string;
};

/** Mention edilen kullanıcılara bildirim gönder — API route üzerinden. */
async function sendMentionNotifications(input: {
  taskId: string;
  taskContent: string;
  projectId: string | null;
  mentionedEmails: string[];
  /** Hücre yorumu ise field label (örn. "Sicil No") — bildirim metnine eklenir */
  fieldLabel?: string | null;
}): Promise<void> {
  if (input.mentionedEmails.length === 0) return;
  try {
    const { data: session } = await supabase.auth.getSession();
    const accessToken = session?.session?.access_token;
    if (!accessToken) return;
    await fetch("/api/notify/mention", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(input),
    });
  } catch (err) {
    // Bildirim hatası yorum oluşturmayı engellemesin
    console.warn("[mention] notification send failed:", err);
  }
}

/** Görev detay panelinde "Yorumlar" bölümü — liste + ekleme + sahibi için düzenle/sil + @mention. */
export function TaskCommentsSection({ taskId, projectId = null, canComment = true, className, fieldKey }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const profileLookup = useProfileLookup();
  // fieldKey varsa cell scope, yoksa task scope (geriye dönük)
  const { comments, isLoading, error } = useTaskComments(
    taskId,
    fieldKey ? { fieldKey } : "task"
  );
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);

  /* ────────── @mention autocomplete state ────────── */
  const [mentionCtx, setMentionCtx] = useState<MentionContext | null>(null);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);

  const allProfiles = profileLookup.listAll();

  const mentionSuggestions = useMemo<UserProfile[]>(() => {
    if (!mentionCtx) return [];
    return searchProfilesForMention(mentionCtx.query, allProfiles, 8);
  }, [mentionCtx, allProfiles]);

  // Query değişince active index'i sıfırla
  useEffect(() => {
    setMentionActiveIdx(0);
  }, [mentionCtx?.query]);

  /** Textarea içeriğini güncellerken caret pozisyonundaki mention context'i tespit et. */
  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDraft(value);
    const caret = e.target.selectionStart ?? value.length;
    setMentionCtx(detectMentionContext(value, caret));
  }, []);

  /** Caret hareketinde de context'i yeniden tespit et (ok ile gezildiğinde). */
  const handleDraftSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setMentionCtx(detectMentionContext(el.value, el.selectionStart ?? el.value.length));
  }, []);

  /** Autocomplete'ten profil seçildiğinde draft'a mention token'ı yerleştir. */
  const handleMentionSelect = useCallback(
    (profile: UserProfile) => {
      if (!mentionCtx) return;
      const localPart = (profile.email ?? "").split("@")[0] ?? "";
      // Tercih: kısa olduğu için local part; ambiguity varsa kullanıcı tam email yazsın
      const token = localPart || profile.email || profile.id;
      const { newText, newCaret } = insertMention(draft, mentionCtx, token);
      setDraft(newText);
      setMentionCtx(null);
      // Caret'i yeni pozisyona taşı (next tick)
      requestAnimationFrame(() => {
        const el = draftTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(newCaret, newCaret);
        }
      });
    },
    [mentionCtx, draft]
  );

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
        // fieldKey doluysa hücre yorumu, yoksa görev seviyesi
        fieldKey: fieldKey ?? null,
      });
      // @mention bildirimi gönder — yorum sahibinin kendi mention'ı hariç
      const prefixes = extractMentionPrefixes(body);
      if (prefixes.length > 0) {
        const resolved = resolveMentionsToProfiles(prefixes, allProfiles);
        const emails = resolved
          .map((p) => (p.email ?? "").trim().toLowerCase())
          .filter((e) => e && e !== (user.email ?? "").trim().toLowerCase());
        if (emails.length > 0) {
          // Hücre yorumu ise field label türet — "extra:Sicil No" → "Sicil No"
          const fieldLabel = fieldKey
            ? (fieldKey.startsWith("extra:") ? fieldKey.slice("extra:".length) : fieldKey)
            : null;
          void sendMentionNotifications({
            taskId,
            taskContent: body,
            projectId: projectId ?? null,
            mentionedEmails: emails,
            fieldLabel,
          });
        }
      }
      setDraft("");
      setMentionCtx(null);
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
    <section className={className}>
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
            const isOwner = canComment && currentUserId === c.user_id;
            const isEditing = editingId === c.id;
            const isBusy = busyId === c.id;
            const name = c.user_display_name?.trim() || c.user_email;
            return (
              <li
                key={c.id}
                className="group flex gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <UserAvatar
                  avatarUrl={profileLookup.byEmail(c.user_email).avatarUrl}
                  email={c.user_email}
                  nickname={profileLookup.byEmail(c.user_email).nickname || c.user_display_name}
                  fullName={profileLookup.byEmail(c.user_email).fullName}
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
                    <div
                      className={cn(
                        "mt-0.5 text-sm text-slate-700 dark:text-slate-200",
                        isBusy && "opacity-50"
                      )}
                    >
                      <MentionRenderer text={c.body} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          <div ref={listEndRef} aria-hidden />
        </ul>
      )}

      {/* Yorum ekle */}
      {user?.email && canComment ? (
        <form onSubmit={handleSubmit} className="relative mt-3">
          <textarea
            ref={draftTextareaRef}
            value={draft}
            onChange={handleDraftChange}
            onSelect={handleDraftSelect}
            placeholder="Yorum yaz… (@ ile kullanıcı etiketle, Cmd+Enter ile gönder)"
            rows={2}
            disabled={submitting}
            onKeyDown={(e) => {
              // Mention popover açıkken klavye gezinmesi
              if (mentionCtx && mentionSuggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionActiveIdx((i) => Math.min(i + 1, mentionSuggestions.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionActiveIdx((i) => Math.max(0, i - 1));
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  handleMentionSelect(mentionSuggestions[mentionActiveIdx]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMentionCtx(null);
                  return;
                }
              }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            onBlur={() => {
              // Popover dışına tıklandığında kapat (item tıklamada onMouseDown preventDefault yapıyor)
              setTimeout(() => setMentionCtx(null), 150);
            }}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          {mentionCtx && mentionSuggestions.length > 0 && (
            <MentionAutocomplete
              profiles={mentionSuggestions}
              activeIndex={mentionActiveIdx}
              onSelect={handleMentionSelect}
              onActiveChange={setMentionActiveIdx}
              position={{ top: 60, left: 8 }}
            />
          )}
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
      ) : (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Bu satıra yorum ekleme yetkin yok.
        </p>
      )}
    </section>
  );
}
