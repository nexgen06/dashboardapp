"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  PROJECTS_FALLBACK_POLL_MS,
  REALTIME_SUBSCRIBE_TIMEOUT_MS,
  isRealtimeDisabledForClient,
  shouldPollInBrowser,
} from "@/lib/realtimeFallback";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Project, ProjectStatus, ProjectPriority } from "@/types/project";

let projectsRealtimeChannelSeq = 0;

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
  const strict_assignee_visibility =
    row.strict_assignee_visibility === true || String(row.strict_assignee_visibility).toLowerCase() === "true";
  const team_edit_all_tasks =
    row.team_edit_all_tasks === true || String(row.team_edit_all_tasks).toLowerCase() === "true";
  const workflow_enabled =
    row.workflow_enabled === true || String(row.workflow_enabled).toLowerCase() === "true";
  const lock_on_approval =
    row.lock_on_approval === true || String(row.lock_on_approval).toLowerCase() === "true";

  let extra_column_keys: string[] | null = null;
  const rawKeys = row.extra_column_keys;
  if (Array.isArray(rawKeys)) {
    const list = rawKeys
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    extra_column_keys = list.length > 0 ? list : null;
  }
  const titleColumn =
    row.title_column != null && String(row.title_column).trim() !== ""
      ? String(row.title_column).trim()
      : null;
  let subtitle_columns: string[] | null = null;
  const rawSubs = row.subtitle_columns;
  if (Array.isArray(rawSubs)) {
    const list = rawSubs
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    subtitle_columns = list.length > 0 ? list : null;
  }
  const wipLimit = (() => {
    const v = row.wip_in_progress_limit;
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  })();
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
    strict_assignee_visibility: strict_assignee_visibility,
    team_edit_all_tasks,
    extra_column_keys,
    title_column: titleColumn,
    subtitle_columns,
    wip_in_progress_limit: wipLimit,
    workflow_enabled,
    lock_on_approval,
    archived_at: row.archived_at != null ? String(row.archived_at) : null,
  };
}

export type UseProjectsOptions = {
  /** true → arşivli projeler dahil; false (varsayılan) → yalnızca aktifler. */
  includeArchived?: boolean;
};

export function useProjectsInternal(options?: UseProjectsOptions) {
  const includeArchived = options?.includeArchived === true;
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      let query = supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (!includeArchived) {
        query = query.is("archived_at", null);
      }
      const { data, error: fetchError } = await query;

      if (fetchError) {
        // archived_at kolonu henüz uygulanmamış olabilir (SQL script çalıştırılmadıysa)
        // — 42703 (column does not exist) için fallback'e dön
        if (String(fetchError.code) === "42703" && !includeArchived) {
          const fallback = await supabase
            .from("projects")
            .select("*")
            .order("updated_at", { ascending: false });
          if (fallback.error) throw fallback.error;
          setProjects((fallback.data ?? []).map(mapRowToProject));
          setError(null);
          return;
        }
        throw fetchError;
      }
      setProjects((data ?? []).map(mapRowToProject));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Projeler yüklenemedi");
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Realtime: başka kullanıcıların proje ekleme/güncelleme/silme değişiklikleri anında yansır.
  useEffect(() => {
    if (isRealtimeDisabledForClient()) {
      setRealtimeConnected(false);
      return;
    }
    let channel: RealtimeChannel;
    let subscribeTimeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const channelTopic = `projects-realtime-sync-${++projectsRealtimeChannelSeq}`;
    setRealtimeConnected(false);
    subscribeTimeout = setTimeout(() => {
      if (!cancelled) setRealtimeConnected(false);
    }, REALTIME_SUBSCRIBE_TIMEOUT_MS);
    // `private: true` → Realtime payloadlarına `projects` tablosu RLS uygulanır.
    channel = supabase
      .channel(channelTopic, { config: { private: true } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (payload: PostgresChangePayload) => {
          try {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            const newId = newRecord?.id != null ? String(newRecord.id) : null;
            const oldId = oldRecord?.id != null ? String(oldRecord.id) : null;

            setProjects((prev) => {
              const isArchivedRecord = (rec: Record<string, unknown>) =>
                rec?.archived_at != null && String(rec.archived_at).trim() !== "";
              switch (eventType) {
                case "INSERT":
                  if (newRecord && typeof newRecord === "object" && newId && !prev.some((p) => String(p.id) === newId)) {
                    // Arşivli kayıt geldi ama biz arşivlileri istemiyoruz → atla
                    if (!includeArchived && isArchivedRecord(newRecord)) return prev;
                    return [mapRowToProject(newRecord), ...prev];
                  }
                  return prev;
                case "UPDATE":
                  if (newRecord && typeof newRecord === "object" && newId) {
                    const becameArchived = !includeArchived && isArchivedRecord(newRecord);
                    if (becameArchived) {
                      // Başka kullanıcı arşivledi → listeden çıkar
                      return prev.filter((p) => String(p.id) !== newId);
                    }
                    // Daha önce listede yoktu (arşivdeydi) ama şimdi aktif → ekle
                    const existed = prev.some((p) => String(p.id) === newId);
                    if (!existed && !isArchivedRecord(newRecord)) {
                      return [mapRowToProject(newRecord), ...prev];
                    }
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
        if (cancelled) return;
        const statusStr = String(status ?? "").toUpperCase();
        if (statusStr === "SUBSCRIBED") {
          if (subscribeTimeout) {
            clearTimeout(subscribeTimeout);
            subscribeTimeout = null;
          }
          setRealtimeConnected(true);
        }
        if (err) {
          if (subscribeTimeout) {
            clearTimeout(subscribeTimeout);
            subscribeTimeout = null;
          }
          setRealtimeConnected(false);
          console.warn("[Projects] Realtime:", err);
          fetchProjects();
        }
      });
    return () => {
      cancelled = true;
      if (subscribeTimeout) clearTimeout(subscribeTimeout);
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [fetchProjects]);

  // Kurumsal ağlarda WebSocket engellenirse proje listesi HTTPS ile tazelenir.
  useEffect(() => {
    if (realtimeConnected) return;
    const interval = window.setInterval(() => {
      if (shouldPollInBrowser()) void fetchProjects();
    }, PROJECTS_FALLBACK_POLL_MS);
    return () => window.clearInterval(interval);
  }, [realtimeConnected, fetchProjects]);

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
      strict_assignee_visibility?: boolean;
      team_edit_all_tasks?: boolean;
      extra_column_keys?: string[] | null;
      title_column?: string | null;
      subtitle_columns?: string[] | null;
      wip_in_progress_limit?: number | null;
      workflow_enabled?: boolean;
      lock_on_approval?: boolean;
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
      if (payload.strict_assignee_visibility !== undefined) {
        baseRow.strict_assignee_visibility = payload.strict_assignee_visibility;
      }
      if (payload.team_edit_all_tasks === true) {
        baseRow.team_edit_all_tasks = true;
      }
      if (payload.extra_column_keys != null && payload.extra_column_keys.length > 0) {
        baseRow.extra_column_keys = payload.extra_column_keys;
      }
      if (payload.title_column != null && String(payload.title_column).trim() !== "") {
        baseRow.title_column = String(payload.title_column).trim();
      }
      if (payload.subtitle_columns != null && payload.subtitle_columns.length > 0) {
        baseRow.subtitle_columns = payload.subtitle_columns
          .map((k) => String(k).trim())
          .filter(Boolean)
          .slice(0, 3);
      }
      if (payload.wip_in_progress_limit != null && payload.wip_in_progress_limit > 0) {
        baseRow.wip_in_progress_limit = Math.floor(payload.wip_in_progress_limit);
      }
      if (payload.workflow_enabled === true) {
        baseRow.workflow_enabled = true;
      }
      if (payload.lock_on_approval === true) {
        baseRow.lock_on_approval = true;
      }
      let { data, error: insertError } = await supabase
        .from("projects")
        .insert(baseRow)
        .select("id")
        .single();
      if (
        insertError &&
        (
          (hasAssigned && (insertError.message?.includes("assigned_emails") || insertError.code === "42703")) ||
          (payload.team_edit_all_tasks === true && (insertError.message?.includes("team_edit_all_tasks") || insertError.code === "42703")) ||
          (payload.workflow_enabled === true && (insertError.message?.includes("workflow_enabled") || insertError.code === "42703")) ||
          (payload.lock_on_approval === true && (insertError.message?.includes("lock_on_approval") || insertError.code === "42703"))
        )
      ) {
        const retryPayload: Record<string, unknown> = {
          name: baseRow.name,
          description: baseRow.description,
          status: baseRow.status,
          updated_at: baseRow.updated_at,
        };
        if (baseRow.due_date != null) retryPayload.due_date = baseRow.due_date;
        if (baseRow.priority != null) retryPayload.priority = baseRow.priority;
        if (baseRow.extra_column_keys != null) retryPayload.extra_column_keys = baseRow.extra_column_keys;
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
    async (id: string, payload: Partial<Pick<Project, "name" | "description" | "status" | "assigned_emails" | "due_date" | "priority" | "strict_assignee_visibility" | "team_edit_all_tasks" | "extra_column_keys" | "title_column" | "subtitle_columns" | "wip_in_progress_limit" | "workflow_enabled" | "lock_on_approval">>) => {
      const updateRow: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
      if (payload.assigned_emails !== undefined) {
        updateRow.assigned_emails =
          payload.assigned_emails == null || payload.assigned_emails.length === 0
            ? []
            : payload.assigned_emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
      }
      if (payload.due_date !== undefined) updateRow.due_date = payload.due_date ?? null;
      if (payload.priority !== undefined) updateRow.priority = payload.priority ?? null;
      if (payload.strict_assignee_visibility !== undefined) {
        updateRow.strict_assignee_visibility = payload.strict_assignee_visibility;
      }
      if (payload.team_edit_all_tasks !== undefined) {
        updateRow.team_edit_all_tasks = payload.team_edit_all_tasks;
      }
      if (payload.extra_column_keys !== undefined) {
        updateRow.extra_column_keys =
          payload.extra_column_keys == null || payload.extra_column_keys.length === 0
            ? []
            : payload.extra_column_keys.map((k) => String(k).trim()).filter(Boolean);
      }
      if (payload.title_column !== undefined) {
        updateRow.title_column =
          payload.title_column == null || String(payload.title_column).trim() === ""
            ? null
            : String(payload.title_column).trim();
      }
      if (payload.subtitle_columns !== undefined) {
        updateRow.subtitle_columns =
          payload.subtitle_columns == null || payload.subtitle_columns.length === 0
            ? []
            : payload.subtitle_columns
                .map((k) => String(k).trim())
                .filter(Boolean)
                .slice(0, 3);
      }
      if (payload.wip_in_progress_limit !== undefined) {
        const n = payload.wip_in_progress_limit;
        updateRow.wip_in_progress_limit =
          n == null || !Number.isFinite(n) || n <= 0 ? null : Math.floor(n);
      }
      if (payload.workflow_enabled !== undefined) {
        updateRow.workflow_enabled = payload.workflow_enabled;
      }
      if (payload.lock_on_approval !== undefined) {
        updateRow.lock_on_approval = payload.lock_on_approval;
      }
      const { error: updateError } = await supabase.from("projects").update(updateRow).eq("id", id);
      if (updateError) {
        const missingTeamEditColumn =
          payload.team_edit_all_tasks !== undefined &&
          (updateError.code === "42703" || String(updateError.message ?? "").includes("team_edit_all_tasks"));
        const missingWorkflowColumn =
          payload.workflow_enabled !== undefined &&
          (updateError.code === "42703" || String(updateError.message ?? "").includes("workflow_enabled"));
        const missingLockColumn =
          payload.lock_on_approval !== undefined &&
          (updateError.code === "42703" || String(updateError.message ?? "").includes("lock_on_approval"));
        if (!missingTeamEditColumn && !missingWorkflowColumn && !missingLockColumn) throw updateError;
        const retryRow = { ...updateRow };
        if (missingTeamEditColumn) delete retryRow.team_edit_all_tasks;
        if (missingWorkflowColumn) delete retryRow.workflow_enabled;
        if (missingLockColumn) delete retryRow.lock_on_approval;
        const { error: retryError } = await supabase.from("projects").update(retryRow).eq("id", id);
        if (retryError) throw retryError;
      }
      // Normalize assigned_emails in local state (DB'ye yazdığımız hali)
      const normalizedPayload = { ...payload };
      if (payload.assigned_emails !== undefined) {
        normalizedPayload.assigned_emails =
          payload.assigned_emails == null || payload.assigned_emails.length === 0
            ? null
            : payload.assigned_emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
      }
      if (payload.extra_column_keys !== undefined) {
        normalizedPayload.extra_column_keys =
          payload.extra_column_keys == null || payload.extra_column_keys.length === 0
            ? null
            : [...payload.extra_column_keys];
      }
      if (payload.subtitle_columns !== undefined) {
        normalizedPayload.subtitle_columns =
          payload.subtitle_columns == null || payload.subtitle_columns.length === 0
            ? null
            : payload.subtitle_columns
                .map((k) => String(k).trim())
                .filter(Boolean)
                .slice(0, 3);
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

  /**
   * Projeyi gerçek anlamda arşivler — `archived_at = now()`. Status değişmez;
   * arşivli proje aktif listelerden çıkar ancak silinmez, geri getirilebilir.
   */
  const archiveProject = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const { error: archiveError } = await supabase
        .from("projects")
        .update({ archived_at: now, updated_at: now })
        .eq("id", id);
      if (archiveError) {
        // archived_at kolonu yoksa eski davranışa düş (status: Beklemede)
        if (String(archiveError.code) === "42703") {
          await updateProject(id, { status: "Beklemede" });
          await fetchProjects();
          return;
        }
        throw archiveError;
      }
      // Local state'i güncelle — includeArchived false ise listeden çıkar, değilse alanı güncelle
      setProjects((prev) =>
        includeArchived
          ? prev.map((p) => (p.id === id ? { ...p, archived_at: now, updated_at: now } : p))
          : prev.filter((p) => p.id !== id)
      );
    },
    [includeArchived, updateProject, fetchProjects]
  );

  /** Arşivden çıkar — `archived_at = NULL`. */
  const unarchiveProject = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const { error: unarchiveError } = await supabase
        .from("projects")
        .update({ archived_at: null, updated_at: now })
        .eq("id", id);
      if (unarchiveError) throw unarchiveError;
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, archived_at: null, updated_at: now } : p))
      );
    },
    []
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
    unarchiveProject,
  };
}
