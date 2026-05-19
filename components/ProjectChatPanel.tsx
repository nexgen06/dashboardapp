"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send } from "lucide-react";
import type { ProjectChatMessage } from "@/types/projectChat";
import { cn } from "@/lib/utils";
import { userInitialsFromDisplay } from "@/lib/userDisplayName";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useProfileLookup } from "@/contexts/profile-lookup-context";

type ProjectChatPanelProps = {
  messages: ProjectChatMessage[];
  onSend: (text: string) => boolean | Promise<boolean>;
  currentUserEmail: string;
  /** Sohbet yüklendi ve gönderim mümkün */
  chatReady: boolean;
  /** Varsayılan: «Proje sohbeti» */
  heading?: string;
  hint?: string;
  /** Mesaj listesi sarmalayıcı (yükseklik vb.), örn. max-h-[min(60vh,28rem)] */
  messagesContainerClassName?: string;
  className?: string;
};

const AVATAR_ACCENT = [
  "bg-violet-200 text-violet-900 dark:bg-violet-800/60 dark:text-violet-100",
  "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/60 dark:text-emerald-100",
  "bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100",
  "bg-sky-200 text-sky-900 dark:bg-sky-800/60 dark:text-sky-100",
  "bg-rose-200 text-rose-900 dark:bg-rose-800/60 dark:text-rose-100",
  "bg-indigo-200 text-indigo-900 dark:bg-indigo-800/60 dark:text-indigo-100",
  "bg-teal-200 text-teal-900 dark:bg-teal-800/60 dark:text-teal-100",
  "bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-800/60 dark:text-fuchsia-100",
] as const;

function avatarAccentClass(email: string): string {
  if (!email) return AVATAR_ACCENT[0];
  let n = 0;
  for (let i = 0; i < email.length; i++) n += email.charCodeAt(i);
  return AVATAR_ACCENT[n % AVATAR_ACCENT.length] ?? AVATAR_ACCENT[0];
}

const norm = (e: string) => e.trim().toLowerCase();
/** Aynı yazardan ardışık mesajların aynı grupta sayılacağı maks. aralık (ms) */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function formatChatTime(at: number): string {
  try {
    return new Date(at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDayLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - startOfDay.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Bugün";
  if (diffDays === 1) return "Dün";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Aynı yazar + 5 dk içinde → "groupHeadIdx" aynı kalır; aksi halde yeni grup başlar. */
type EnrichedMessage = ProjectChatMessage & {
  /** Bu mesaj grubun ilki mi? Header (avatar + isim + saat) sadece head'de gösterilir. */
  isGroupHead: boolean;
  /** Bu mesajdan önce gün ayırıcısı gösterilsin mi? */
  newDay: boolean;
};

function enrichMessages(messages: ProjectChatMessage[]): EnrichedMessage[] {
  const out: EnrichedMessage[] = [];
  let prevAuthor: string | null = null;
  let prevAt = 0;
  let prevDay = "";
  for (const m of messages) {
    const author = norm(m.email ?? "");
    const sameAuthor = prevAuthor === author;
    const withinWindow = m.at - prevAt <= GROUP_WINDOW_MS;
    const dayLabel = formatDayLabel(m.at);
    const newDay = dayLabel !== prevDay;
    const isGroupHead = newDay || !sameAuthor || !withinWindow;
    out.push({ ...m, isGroupHead, newDay });
    prevAuthor = author;
    prevAt = m.at;
    prevDay = dayLabel;
  }
  return out;
}

export function ProjectChatPanel({
  messages,
  onSend,
  currentUserEmail,
  chatReady,
  heading = "Proje sohbeti",
  hint = "Supabase'de saklanır; tüm ekip üyeleri okuyabilir.",
  messagesContainerClassName = "max-h-52 min-h-[4.5rem]",
  className,
}: ProjectChatPanelProps) {
  const [draft, setDraft] = useState("");
  const profileLookup = useProfileLookup();
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enriched = useMemo(() => enrichMessages(messages), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /** Textarea içerikle büyüsün (auto-resize). */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 160; // px
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [draft]);

  const submit = async () => {
    const t = draft.trim();
    if (!t || !chatReady || sending) return;
    setSending(true);
    try {
      const result = onSend(t);
      const ok = result instanceof Promise ? await result : result;
      if (ok) setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "mt-4 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50/90 dark:border-slate-600 dark:bg-slate-900/50",
        className
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 px-3 py-2 dark:border-slate-600">
        <MessageCircle className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{heading}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </div>

      <div className={cn("min-w-0 flex-1 overflow-y-auto px-3 py-3", messagesContainerClassName)}>
        {enriched.length === 0 ? (
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center">
            <MessageCircle className="h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              İlk mesajı sen yaz — projedeki ekip görür.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Mesajlar kaydedilir; Enter ile gönder, Shift+Enter satır.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {enriched.map((m, i) => {
              const mine = norm(m.email ?? "") === norm(currentUserEmail);
              const label = (m.name && m.name.trim()) || m.email || "Kullanıcı";
              const initials = userInitialsFromDisplay(label, m.email ?? "");
              const accent = avatarAccentClass(m.email ?? "");
              return (
                <li key={m.id}>
                  {m.newDay && (
                    <div className="my-3 flex items-center gap-2" aria-hidden>
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {formatDayLabel(m.at)}
                      </span>
                      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex items-end gap-2",
                      mine ? "flex-row-reverse" : "flex-row",
                      m.isGroupHead ? "mt-2" : "mt-0.5"
                    )}
                  >
                    {/* Avatar — sadece grup başlığında göster, ardışıklarda boşluk bırak */}
                    <div className="w-7 shrink-0">
                      {m.isGroupHead ? (
                        <UserAvatar
                          avatarUrl={profileLookup.byEmail(m.email).avatarUrl}
                          nickname={profileLookup.byEmail(m.email).nickname}
                          fullName={profileLookup.byEmail(m.email).fullName}
                          email={m.email}
                          className={cn("h-7 w-7 text-[10px]", !profileLookup.byEmail(m.email).avatarUrl && accent)}
                        />
                      ) : null}
                    </div>
                    <div className={cn("min-w-0 max-w-[80%]", mine ? "items-end" : "items-start")}>
                      {m.isGroupHead && (
                        <div
                          className={cn(
                            "mb-0.5 flex items-baseline gap-2 px-1 text-[11px] text-slate-500 dark:text-slate-400",
                            mine && "justify-end"
                          )}
                        >
                          <span
                            className={cn(
                              "font-medium",
                              mine ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"
                            )}
                          >
                            {mine ? "Sen" : label}
                          </span>
                          <span title={new Date(m.at).toLocaleString("tr-TR")}>
                            {formatChatTime(m.at)}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-1.5 text-sm shadow-sm",
                          mine
                            ? "bg-blue-600 text-white dark:bg-blue-600/90"
                            : "bg-white text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700",
                          // Grup içindeki köşe daraltma: art arda gelenlerin yan köşeleri keskin
                          mine
                            ? m.isGroupHead
                              ? "rounded-br-md"
                              : "rounded-tr-md rounded-br-md"
                            : m.isGroupHead
                              ? "rounded-bl-md"
                              : "rounded-tl-md rounded-bl-md"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-800/40">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={chatReady ? "Mesaj yazın… (Enter gönderir, Shift+Enter satır)" : "Yükleniyor…"}
            disabled={!chatReady}
            rows={1}
            className="flex-1 min-h-[2.5rem] max-h-[10rem] resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 disabled:opacity-60"
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => void submit()}
            disabled={!draft.trim() || !chatReady || sending}
            aria-label="Gönder"
            title="Gönder (Enter)"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {draft.length > 1800 && (
          <p className="mt-1 px-1 text-[10px] text-slate-500 dark:text-slate-400">
            {2000 - draft.length} karakter kaldı (maks. 2000)
          </p>
        )}
      </div>
    </div>
  );
}
