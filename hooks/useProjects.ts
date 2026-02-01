"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Project, ProjectStatus, ProjectPriority } from "@/types/project";

type PostgresChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

function mapRowToProject(row: Record<string, unknown>): Project {
  let assigned_emails: string[] | null = null;
  const raw = row.assigned_emails;
  if (Array.isArray(raw)) {
    assigned_emails = raw
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        assigned_emails = parsed
          .filter((e): e is string => typeof e === "string")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
      }
    } catch {
      // ignore
    }
  }
  if (assigned_emails?.length === 0) assigned_emails = null;
  const dueDate = row.due_date != null ? String(row.due_date) : null;
  const priority = row.priority != null && /^high|medium|low$/i.test(String(row.priority))
    ? (String(row.priority).charAt(0).toUpperCase() + String(row.priority).slice(1).toLowerCase()) as ProjectPriority
    : null;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    status: (row.status as ProjectStatus) ?? "Aktif",
    created_at: row.created_at != null ? String(row.created_at) : null,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    assigned_emails: assigned_emails ?? null,
    due_date: dueDate ?? null,
    priority: priority ?? null,
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;
      setProjects((data ?? []).map(mapRowToProject));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Projeler yüklenemedi");
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Realtime: başka kullanıcıların proje ekleme/güncelleme/silme değişiklikleri anında yansır.
  useEffect(() => {
    let channel: RealtimeChannel;
    channel = supabase
      .channel("projects-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload: PostgresChangePayload) => {
          try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const newId = newRecord?.id != null ? String(newRecord.id) : null;
            const oldId = oldRecord?.id != null ? String(oldRecord.id) : null;

            setProjects((prev) => {
              switch (eventType) {
                case "INSERT":
                  if (newRecord && typeof newRecord === "object" && newId && !prev.some((p) => String(p.id) === newId)) {
                    return [mapRowToProject(newRecord), ...prev];
                  }
                  return prev;
                case "UPDATE":
                  if (newRecord && typeof newRecord === "object" && newId) {
                    return prev.map((p) => (String(p.id) === newId ? mapRowToProject(newRecord) : p));
                  }
                  return prev;
                case "DELETE":
                  if (oldId) return prev.filter((p) => String(p.id) !== oldId);
                  return prev;
                default:
                  return prev;
              }
            });
          } catch (e) {
            console.warn("[Projects] Realtime payload error:", e);
            fetchProjects();
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("[Projects] Realtime:", err);
          fetchProjects();
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProjects]);

  // Sekme tekrar odaklandığında proje listesini tazele
  useEffect(() => {
    const onFocus = () => fetchProjects();
    if (typeof window === "undefined") return;
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchProjects]);

  const createProject = useCallback(
    async (payload: {
      name: string;
      description: string;
      status: ProjectStatus;
      assigned_emails?: string[] | null;
      due_date?: string | null;
      priority?: ProjectPriority | null;
    }): Promise<string | null> => {
      const baseRow: Record<string, unknown> = {
        name: payload.name.trim() || "İsimsiz proje",
        description: payload.description.trim() ?? "",
        status: payload.status,
        updated_at: new Date().toISOString(),
      };
      const hasAssigned = payload.assigned_emails != null && payload.assigned_emails.length > 0;
      if (hasAssigned) {
        baseRow.assigned_emails = payload.assigned_emails!.map((e) => e.trim().toLowerCase()).filter(Boolean);
      }
      if (payload.due_date != null && String(payload.due_date).trim() !== "") {
        baseRow.due_date = payload.due_date.trim();
      }
      if (payload.priority != null && String(payload.priority).trim() !== "") {
        baseRow.priority = payload.priority;
      }
      let { data, error: insertError } = await supabase
        .from("projects")
        .insert(baseRow)
        .select("id")
        .single();
      if (insertError && hasAssigned && (insertError.message?.includes("assigned_emails") || insertError.code === "42703")) {
        const retryPayload: Record<string, unknown> = {
          name: baseRow.name,
          description: baseRow.description,
          status: baseRow.status,
          updated_at: baseRow.updated_at,
        };
        if (baseRow.due_date != null) retryPayload.due_date = baseRow.due_date;
        if (baseRow.priority != null) retryPayload.priority = baseRow.priority;
        const { data: retryData, error: retryError } = await supabase
          .from("projects")
          .insert(retryPayload)
          .select("id")
          .single();
        if (retryError) throw retryError;
        data = retryData;
        insertError = null;
      }
      if (insertError) throw insertError;
      await fetchProjects();
      return data?.id ? String(data.id) : null;
    },
    [fetchProjects]
  );

  const updateProject = useCallback(
    async (id: string, payload: Partial<Pick<Project, "name" | "description" | "status" | "assigned_emails" | "due_date" | "priority">>) => {
      const updateRow: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
      if (payload.assigned_emails !== undefined) {
        updateRow.assigned_emails =
          payload.assigned_emails == null || payload.assigned_emails.length === 0
            ? []
            : payload.assigned_emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
      }
      if (payload.due_date !== undefined) updateRow.due_date = payload.due_date ?? null;
      if (payload.priority !== undefined) updateRow.priority = payload.priority ?? null;
      const { error: updateError } = await supabase.from("projects").update(updateRow).eq("id", id);
      if (updateError) throw updateError;
      // Normalize assigned_emails in local state (DB'ye yazdığımız hali)
      const normalizedPayload = { ...payload };
      if (payload.assigned_emails !== undefined) {
        normalizedPayload.assigned_emails =
          payload.assigned_emails == null || payload.assigned_emails.length === 0
            ? null
            : payload.assigned_emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...normalizedPayload } : p))
      );
      await fetchProjects();
    },
    [fetchProjects]
  );

  const deleteProject = useCallback(async (id: string) => {
    // Önce bu projeye bağlı görevleri sil (canlı tabloda da kaybolsun)
    const { error: tasksError } = await supabase.from("tasks").delete().eq("project_id", id);
    if (tasksError) throw tasksError;
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", id);
    if (deleteError) throw deleteError;
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const archiveProject = useCallback(
    async (id: string) => {
      await updateProject(id, { status: "Beklemede" });
      await fetchProjects();
    },
    [updateProject, fetchProjects]
  );

  return {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
  };
}
