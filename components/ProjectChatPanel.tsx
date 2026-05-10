"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send } from "lucide-react";
import type { ProjectChatMessage } from "@/types/projectChat";
import { cn } from "@/lib/utils";

type ProjectChatPanelProps = {
  messages: ProjectChatMessage[];
  onSend: (text: string) => boolean | Promise<boolean>;
  currentUserEmail: string;
  /** Sohbet yüklendi ve gönderim mümkün */
  chatReady: boolean;
};

function formatChatTime(at: number): string {
  try {
    return new Date(at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ProjectChatPanel({
  messages,
  onSend,
  currentUserEmail,
  chatReady,
}: ProjectChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const norm = (e: string) => e.trim().toLowerCase();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = async () => {
    const t = draft.trim();
    if (!t || !chatReady) return;
    const result = onSend(t);
    const ok = result instanceof Promise ? await result : result;
    if (ok) setDraft("");
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/90 dark:border-slate-600 dark:bg-slate-900/50 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 px-3 py-2 dark:border-slate-600">
        <MessageCircle className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Proje sohbeti</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Supabase&apos;de saklanır; tüm ekip üyeleri okuyabilir.
        </span>
      </div>
      <div className="max-h-52 overflow-y-auto px-3 py-2 space-y-2 min-h-[4.5rem]">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
            Aynı projedeki ekip ile mesajlaşın. Proje listesinde okunmamış sayısı görünür.
          </p>
        ) : (
          messages.map((m) => {
            const mine = norm(m.email ?? "") === norm(currentUserEmail);
            const label = (m.name && m.name.trim()) || m.email || "Kullanıcı";
            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm",
                  mine
                    ? "ml-6 bg-blue-100 text-slate-900 dark:bg-blue-950/60 dark:text-slate-100"
                    : "mr-6 bg-white text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className={cn("font-medium", mine && "text-blue-800 dark:text-blue-200")}>
                    {mine ? "Sen" : label}
                  </span>
                  <span>{formatChatTime(m.at)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">{m.text}</p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 border-t border-slate-200 p-2 dark:border-slate-600">
        <textarea
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
          rows={2}
          className="flex-1 min-h-[2.75rem] resize-y rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 disabled:opacity-60"
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0 self-end h-9 bg-blue-600 hover:bg-blue-700"
          onClick={() => void submit()}
          disabled={!draft.trim() || !chatReady}
          aria-label="Gönder"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
