import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export const COMMAND_PALETTE_MIN_SEARCH_LENGTH = 2;
export const COMMAND_PALETTE_SEARCH_LIMIT = {
  projects: 8,
  tasks: 12,
} as const;

export type CommandPaletteProjectHit = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
};

export type CommandPaletteTaskHit = {
  id: string;
  content: string | null;
  status: string | null;
  assignee: string | null;
  project_id: string | null;
};

export type CommandPaletteSearchResults = {
  projects: CommandPaletteProjectHit[];
  tasks: CommandPaletteTaskHit[];
};

/** PostgREST `ilike` deseninde % ve _ kaçışı. */
export function escapePostgrestIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** `%sorgu%` biçiminde güvenli ilike deseni. */
export function buildIlikePattern(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "%";
  return `%${escapePostgrestIlike(trimmed)}%`;
}

export function shouldRunCommandPaletteSearch(query: string): boolean {
  return query.trim().length >= COMMAND_PALETTE_MIN_SEARCH_LENGTH;
}

/** `.or()` filtresi için çift tırnaklı ilike deseni. */
export function buildPostgrestOrIlikeFilter(fields: readonly string[], pattern: string): string {
  const quoted = `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return fields.map((field) => `${field}.ilike.${quoted}`).join(",");
}

export function buildCommandPaletteTaskHref(task: {
  id: string;
  project_id?: string | null;
}): string {
  const taskId = encodeURIComponent(task.id);
  const projectId = task.project_id != null ? String(task.project_id).trim() : "";
  if (projectId) {
    return `/canli-tablo?project=${encodeURIComponent(projectId)}&task=${taskId}`;
  }
  return `/canli-tablo?task=${taskId}`;
}

export function truncatePaletteLabel(text: string, max = 72): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function mapProjectRow(row: Record<string, unknown>): CommandPaletteProjectHit {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: row.description != null ? String(row.description) : null,
    status: row.status != null ? String(row.status) : null,
  };
}

function mapTaskRow(row: Record<string, unknown>): CommandPaletteTaskHit {
  return {
    id: String(row.id),
    content: row.content != null ? String(row.content) : null,
    status: row.status != null ? String(row.status) : null,
    assignee: row.assignee != null ? String(row.assignee) : null,
    project_id: row.project_id != null ? String(row.project_id) : null,
  };
}

/**
 * Komut paleti için Supabase araması.
 * RLS kullanıcı kapsamını sunucuda uygular; yalnızca erişilebilir kayıtlar döner.
 */
export async function searchCommandPaletteHits(
  query: string,
  options?: {
    includeProjects?: boolean;
    includeTasks?: boolean;
  }
): Promise<CommandPaletteSearchResults> {
  const trimmed = query.trim();
  if (!shouldRunCommandPaletteSearch(trimmed)) {
    return { projects: [], tasks: [] };
  }
  if (!isSupabaseConfigured()) {
    return { projects: [], tasks: [] };
  }

  const includeProjects = options?.includeProjects !== false;
  const includeTasks = options?.includeTasks !== false;
  const pattern = buildIlikePattern(trimmed);
  const projectOr = buildPostgrestOrIlikeFilter(["name", "description"], pattern);

  const [projectsRes, tasksRes] = await Promise.all([
    includeProjects
      ? supabase
          .from("projects")
          .select("id, name, description, status")
          .is("archived_at", null)
          .or(projectOr)
          .order("name", { ascending: true })
          .limit(COMMAND_PALETTE_SEARCH_LIMIT.projects)
      : Promise.resolve({ data: [], error: null }),
    includeTasks
      ? supabase
          .from("tasks")
          .select("id, content, status, assignee, project_id")
          .ilike("content", pattern)
          .order("id", { ascending: false })
          .limit(COMMAND_PALETTE_SEARCH_LIMIT.tasks)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (projectsRes.error) {
    throw new Error(projectsRes.error.message || "Proje araması başarısız");
  }
  if (tasksRes.error) {
    throw new Error(tasksRes.error.message || "Görev araması başarısız");
  }

  return {
    projects: (projectsRes.data ?? []).map((row) => mapProjectRow(row as Record<string, unknown>)),
    tasks: (tasksRes.data ?? []).map((row) => mapTaskRow(row as Record<string, unknown>)),
  };
}
