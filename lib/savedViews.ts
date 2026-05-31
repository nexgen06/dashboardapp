/**
 * Saved Views — adlandırılmış filtre/görünüm seti CRUD katmanı.
 *
 * scope:
 *   private → sadece sahibi görür
 *   shared  → tüm authenticated kullanıcılar görür (admin yönetebilir)
 *
 * project_id + is_project_default:
 *   Proje açılışında Canlı Tablo otomatik uygular (yalnızca scope=shared).
 *
 * config: tablo görünüm snapshot'ı; versionlu.
 */
import { supabase } from "@/lib/supabaseClient";

export type SavedViewScope = "private" | "shared";

/** Kayıtlı görünümde desteklenen gruplama alanları (Canlı Tablo Grupla dropdown). */
export const SAVED_VIEW_GROUPING_FIELDS = [
  "status",
  "assignee",
  "priority",
  "project",
  "dueBucket",
] as const;

export type SavedViewGroupingField = (typeof SAVED_VIEW_GROUPING_FIELDS)[number];

export function normalizeSavedViewGroupingField(value: unknown): SavedViewGroupingField | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && (SAVED_VIEW_GROUPING_FIELDS as readonly string[]).includes(value)) {
    return value as SavedViewGroupingField;
  }
  return null;
}

/** Görünüm yapılandırması — versionlu, ileride genişletilebilir. */
export type SavedViewConfig = {
  version: 1;
  filters?: {
    globalSearch?: string;
    projectLinkedFilter?: "proje" | "tümü";
    statusFilter?: string[];
    assigneeFilter?: string[];
    projectFilter?: string[];
    dateFrom?: string;
    dateTo?: string;
    datePreset?: string;
    columnFilters?: Record<string, string[]>;
    advancedFilterRules?: unknown[];
  };
  sort?: Array<{ id: string; desc: boolean }>;
  columns?: {
    visibility?: Record<string, boolean>;
    order?: string[];
    pinning?: { left?: string[]; right?: string[] };
  };
  /** Tablo gruplama (Grupla dropdown). null = gruplama kapalı. */
  grouping?: {
    field: SavedViewGroupingField | null;
  };
};

export type SavedView = {
  id: string;
  userId: string;
  scope: SavedViewScope;
  name: string;
  description: string | null;
  target: string; // v1: "live_table"
  config: SavedViewConfig;
  projectId: string | null;
  isProjectDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RawRow = {
  id: string;
  user_id: string;
  scope: string;
  name: string;
  description: string | null;
  target: string;
  config: SavedViewConfig | null;
  project_id?: string | null;
  is_project_default?: boolean | null;
  created_at: string;
  updated_at: string;
};

const SAVED_VIEW_COLUMNS =
  "id, user_id, scope, name, description, target, config, project_id, is_project_default, created_at, updated_at";

function rowToView(r: RawRow): SavedView {
  return {
    id: r.id,
    userId: r.user_id,
    scope: (r.scope === "shared" ? "shared" : "private") as SavedViewScope,
    name: r.name,
    description: r.description,
    target: r.target,
    config: (r.config ?? { version: 1 }) as SavedViewConfig,
    projectId: r.project_id ?? null,
    isProjectDefault: r.is_project_default === true,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/** Görünüm bu projenin varsayılanı mı? */
export function isViewProjectDefaultFor(view: SavedView, projectId: string): boolean {
  return view.isProjectDefault && view.projectId === projectId;
}

/** Bir hedef (örn. "live_table") için kullanıcının görebildiği tüm view'ları getir. */
export async function listSavedViews(target: string = "live_table"): Promise<SavedView[]> {
  const { data, error } = await supabase
    .from("saved_views")
    .select(SAVED_VIEW_COLUMNS)
    .eq("target", target)
    .order("scope", { ascending: false }) // shared önce
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingProjectDefaultColumnsError(error)) {
      const { data: legacy, error: legacyError } = await supabase
        .from("saved_views")
        .select("id, user_id, scope, name, description, target, config, created_at, updated_at")
        .eq("target", target)
        .order("scope", { ascending: false })
        .order("updated_at", { ascending: false });
      if (legacyError) {
        console.warn("[savedViews] list failed:", legacyError);
        return [];
      }
      return (legacy ?? []).map((r) => rowToView(r as RawRow));
    }
    console.warn("[savedViews] list failed:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToView(r as RawRow));
}

/** Projenin varsayılan Canlı Tablo görünümünü getir (yoksa null). */
export async function getProjectDefaultSavedView(
  projectId: string,
  target: string = "live_table"
): Promise<SavedView | null> {
  const pid = projectId.trim();
  if (!pid) return null;
  const { data, error } = await supabase
    .from("saved_views")
    .select(SAVED_VIEW_COLUMNS)
    .eq("target", target)
    .eq("project_id", pid)
    .eq("is_project_default", true)
    .maybeSingle();
  if (error) {
    if (isMissingProjectDefaultColumnsError(error)) {
      console.warn("[savedViews] project default columns missing — run scripts/saved-views-project-default.sql");
      return null;
    }
    console.warn("[savedViews] getProjectDefault failed:", error);
    return null;
  }
  return data ? rowToView(data as RawRow) : null;
}

export type CreateSavedViewInput = {
  name: string;
  description?: string | null;
  scope: SavedViewScope;
  config: SavedViewConfig;
  target?: string;
  projectId?: string | null;
};

/**
 * Supabase PostgrestError'u kullanıcı dostu hata mesajına çevirir.
 * "saved_views does not exist" → SQL henüz çalıştırılmamış uyarısı.
 */
function toFriendlyError(err: unknown): Error {
  if (!err || typeof err !== "object") return new Error("Bilinmeyen hata");
  const e = err as { message?: string; code?: string; details?: string; hint?: string };
  const raw = e.message ?? "";

  if (isMissingProjectDefaultColumnsError(e)) {
    return new Error(
      "saved_views tablosunda project_id / is_project_default sütunları yok. scripts/saved-views-project-default.sql dosyasını Supabase SQL Editor'da çalıştır."
    );
  }

  // Tablo yok
  if (e.code === "42P01" || /relation\s+"?(public\.)?saved_views"?\s+does not exist/i.test(raw)) {
    return new Error(
      "saved_views tablosu Supabase'de yok. scripts/saved-views.sql dosyasını Supabase Studio → SQL Editor'da çalıştırman gerek."
    );
  }
  // RLS engel
  if (e.code === "42501" || /row-level security|permission denied/i.test(raw)) {
    return new Error("Bu işlem için yetki yok (RLS reddetti). saved-views.sql'in çalıştığını ve oturumun açık olduğunu kontrol et.");
  }
  // Unique / check constraint
  if (raw) return new Error(raw);
  return new Error("Bilinmeyen hata");
}

function isMissingProjectDefaultColumnsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; code?: string };
  const raw = e.message ?? "";
  return (
    e.code === "42703" ||
    /column\s+"?(project_id|is_project_default)"?\s+does not exist/i.test(raw) ||
    /Could not find the 'project_id' column/i.test(raw)
  );
}

export async function createSavedView(input: CreateSavedViewInput): Promise<SavedView> {
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) throw new Error("Oturum bulunamadı.");
  const row: Record<string, unknown> = {
    user_id: userId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    scope: input.scope,
    config: input.config,
    target: input.target ?? "live_table",
  };
  if (input.projectId) row.project_id = input.projectId;
  const { data, error } = await supabase
    .from("saved_views")
    .insert(row)
    .select(SAVED_VIEW_COLUMNS)
    .single();
  if (error) {
    console.error("[savedViews] create failed:", error);
    throw toFriendlyError(error);
  }
  return rowToView(data as RawRow);
}

export type UpdateSavedViewInput = Partial<{
  name: string;
  description: string | null;
  scope: SavedViewScope;
  config: SavedViewConfig;
  projectId: string | null;
  isProjectDefault: boolean;
}>;

export async function updateSavedView(id: string, patch: UpdateSavedViewInput): Promise<SavedView> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.scope !== undefined) row.scope = patch.scope;
  if (patch.config !== undefined) row.config = patch.config;
  if (patch.projectId !== undefined) row.project_id = patch.projectId;
  if (patch.isProjectDefault !== undefined) row.is_project_default = patch.isProjectDefault;
  const { data, error } = await supabase
    .from("saved_views")
    .update(row)
    .eq("id", id)
    .select(SAVED_VIEW_COLUMNS)
    .single();
  if (error) {
    console.error("[savedViews] update failed:", error);
    throw toFriendlyError(error);
  }
  return rowToView(data as RawRow);
}

export async function deleteSavedView(id: string): Promise<void> {
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) {
    console.error("[savedViews] delete failed:", error);
    throw toFriendlyError(error);
  }
}

/**
 * Görünümü projenin varsayılan Canlı Tablo görünümü yapar.
 * Yalnızca paylaşılan (shared) görünümler kullanılabilir.
 */
export async function setProjectDefaultSavedView(projectId: string, viewId: string): Promise<SavedView> {
  const pid = projectId.trim();
  if (!pid) throw new Error("Proje seçilmedi.");
  const { data: existing, error: fetchError } = await supabase
    .from("saved_views")
    .select(SAVED_VIEW_COLUMNS)
    .eq("id", viewId)
    .maybeSingle();
  if (fetchError) throw toFriendlyError(fetchError);
  if (!existing) throw new Error("Görünüm bulunamadı.");
  const view = rowToView(existing as RawRow);
  if (view.scope !== "shared") {
    throw new Error("Proje varsayılanı yalnızca paylaşılan görünümlerden seçilebilir.");
  }

  const { error: clearError } = await supabase
    .from("saved_views")
    .update({ is_project_default: false })
    .eq("project_id", pid)
    .eq("is_project_default", true);
  if (clearError) throw toFriendlyError(clearError);

  const { data, error } = await supabase
    .from("saved_views")
    .update({
      project_id: pid,
      is_project_default: true,
      scope: "shared",
    })
    .eq("id", viewId)
    .select(SAVED_VIEW_COLUMNS)
    .single();
  if (error) throw toFriendlyError(error);
  return rowToView(data as RawRow);
}

/** Projenin varsayılan görünüm bayrağını kaldırır (görünüm silinmez). */
export async function clearProjectDefaultSavedView(projectId: string): Promise<void> {
  const pid = projectId.trim();
  if (!pid) return;
  const { error } = await supabase
    .from("saved_views")
    .update({ is_project_default: false })
    .eq("project_id", pid)
    .eq("is_project_default", true);
  if (error) throw toFriendlyError(error);
}

/** İki view config'i derin karşılaştır — "Değiştirildi" rozeti için */
export function isSameViewConfig(a: SavedViewConfig | undefined, b: SavedViewConfig | undefined): boolean {
  try {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  } catch {
    return false;
  }
}
