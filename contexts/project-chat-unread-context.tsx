"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/lib/supabaseClient";
import { fetchUnreadCounts } from "@/lib/projectChatApi";

type ProjectChatUnreadContextValue = {
  unreadByProjectId: Record<string, number>;
  totalUnread: number;
  /** Okundu veya yeni mesaj sonrası */
  refresh: () => void;
};

const ProjectChatUnreadContext = createContext<ProjectChatUnreadContextValue | null>(null);

export function ProjectChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { projects } = useProjects();
  const email = (user?.email ?? "").trim().toLowerCase();

  // `projects` Supabase RLS tarafından sunucuda filtrelenmiş geliyor;
  // kullanıcının erişebildiği projeler bunlarla aynıdır.
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  const [unreadByProjectId, setUnreadByProjectId] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!email || projectIds.length === 0) {
      setUnreadByProjectId({});
      return;
    }
    try {
      const counts = await fetchUnreadCounts(email, projectIds);
      setUnreadByProjectId(counts);
    } catch (e) {
      console.warn("[project chat unread]", e);
      setUnreadByProjectId({});
    }
  }, [email, projectIds]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel("pcm-unread-inserts", { config: { private: true } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_chat_messages" },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel("pcr-unread-reads", { config: { private: true } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_chat_reads" },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [refresh]);

  const totalUnread = useMemo(
    () => Object.values(unreadByProjectId).reduce((a, b) => a + b, 0),
    [unreadByProjectId]
  );

  const value = useMemo(
    () => ({ unreadByProjectId, totalUnread, refresh }),
    [unreadByProjectId, totalUnread, refresh]
  );

  return <ProjectChatUnreadContext.Provider value={value}>{children}</ProjectChatUnreadContext.Provider>;
}

export function useProjectChatUnread(): ProjectChatUnreadContextValue {
  const ctx = useContext(ProjectChatUnreadContext);
  if (!ctx) {
    throw new Error("useProjectChatUnread yalnızca ProjectChatUnreadProvider içinde kullanılmalıdır.");
  }
  return ctx;
}
