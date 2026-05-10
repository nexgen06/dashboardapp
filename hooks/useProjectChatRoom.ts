"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ProjectChatMessage } from "@/types/projectChat";
import { mapMessageRow, markProjectChatRead } from "@/lib/projectChatApi";

type UseProjectChatRoomOptions = {
  projectId: string;
  enabled: boolean;
  userEmail?: string | null;
  userName?: string | null;
  onAfterMarkRead?: () => void;
};

const MAX_MESSAGES = 100;

/**
 * Proje sohbeti: Supabase tablosu + Realtime INSERT. Sayfa açılınca okundu işaretlenir.
 */
export function useProjectChatRoom({
  projectId,
  enabled,
  userEmail,
  userName,
  onAfterMarkRead,
}: UseProjectChatRoomOptions) {
  const [chatMessages, setChatMessages] = useState<ProjectChatMessage[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const onAfterMarkReadRef = useRef(onAfterMarkRead);
  onAfterMarkReadRef.current = onAfterMarkRead;

  const appendMessage = useCallback((msg: ProjectChatMessage) => {
    setChatMessages((prev) => {
      if (seenIdsRef.current.has(msg.id)) return prev;
      seenIdsRef.current.add(msg.id);
      return [...prev, msg].slice(-MAX_MESSAGES);
    });
  }, []);

  useEffect(() => {
    if (!enabled || !projectId.trim() || !(userEmail ?? "").trim()) {
      setChatReady(false);
      setChatMessages([]);
      seenIdsRef.current.clear();
      return;
    }

    seenIdsRef.current.clear();
    setChatReady(false);
    setChatMessages([]);

    let cancelled = false;
    const email = (userEmail ?? "").trim().toLowerCase();

    // Not: supabase_realtime'ta `filter: project_id=eq...` bazı projelerde güvenilir değil;
    // filtresiz INSERT + istemci tarafında project_id eşlemesi, Dashboard'daki rozet ile aynı olayı kullanır.
    const channel = supabase
      .channel(`pcm-room-${projectId.replace(/[^a-zA-Z0-9_-]/g, "_")}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_chat_messages",
        },
        (payload: { new?: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row) return;
          const pid = String(row.project_id ?? "");
          if (pid !== projectId) return;
          appendMessage(mapMessageRow(row));
          void markProjectChatRead(projectId, email)
            .then(() => onAfterMarkReadRef.current?.())
            .catch(() => {});
        }
      )
      .subscribe();

    (async () => {
      const { data, error } = await supabase
        .from("project_chat_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
        .limit(MAX_MESSAGES);

      if (cancelled) return;
      if (error) {
        console.warn(
          "[project chat] Mesajlar yüklenemedi. Supabase'de `scripts/create-project-chat-tables.sql` çalıştırın.",
          error.message
        );
        setChatMessages([]);
        setChatReady(true);
        return;
      }

      const list = (data ?? []).map((row) => mapMessageRow(row as Record<string, unknown>));
      list.forEach((m) => seenIdsRef.current.add(m.id));
      setChatMessages(list);
      setChatReady(true);

      try {
        await markProjectChatRead(projectId, email);
        onAfterMarkReadRef.current?.();
      } catch (e) {
        console.warn("[project chat] Okundu işaretlenemedi", e);
      }
    })();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [projectId, enabled, userEmail, appendMessage]);

  const sendChatMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const t = text.trim();
      const senderEmail = (userEmail ?? "").trim().toLowerCase();
      if (!t || t.length > 2000 || !chatReady || !senderEmail) return false;
      const { data, error } = await supabase
        .from("project_chat_messages")
        .insert({
          project_id: projectId,
          sender_email: senderEmail,
          sender_name: (userName ?? "").trim() || null,
          body: t,
        })
        .select()
        .single();

      if (error) {
        console.warn("[project chat] Gönderilemedi", error.message);
        return false;
      }
      if (data) appendMessage(mapMessageRow(data as Record<string, unknown>));
      return true;
    },
    [projectId, userEmail, userName, chatReady, appendMessage]
  );

  return { chatMessages, sendChatMessage, chatReady };
}
