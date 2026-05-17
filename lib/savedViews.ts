/**
 * Saved Views — adlandırılmış filtre/görünüm seti CRUD katmanı.
 *
 * scope:
 *   private → sadece sahibi görür
 *   shared  → tüm authenticated kullanıcılar görür (admin yönetebilir)
 *
 * config: tablo görünüm snapshot'ı; versionlu.
 */
import { supabase } from "@/lib/supabaseClient";

export type SavedViewScope = "private" | "shared";

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
};

export type SavedView = {
  id: string;
  userId: string;
  scope: SavedViewScope;
  name: string;
  description: string | null;
  target: string; // v1: "live_table"
  config: SavedViewConfig;
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
  created_at: string;
  updated_at: string;
};

function rowToView(r: RawRow): SavedView {
  return {
    id: r.id,
    userId: r.user_id,
    scope: (r.scope === "shared" ? "shared" : "private") as SavedViewScope,
    name: r.name,
    description: r.description,
    target: r.target,
    config: (r.config ?? { version: 1 }) as SavedViewConfig,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/** Bir hedef (örn. "live_table") için kullanıcının görebildiği tüm view'ları getir. */
export async function listSavedViews(target: string = "live_table"): Promise<SavedView[]> {
  const { data, error } = await supabase
    .from("saved_views")
    .select("id, user_id, scope, name, description, target, config, created_at, updated_at")
    .eq("target", target)
    .order("scope", { ascending: false }) // shared önce
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[savedViews] list failed:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToView(r as RawRow));
}

export type CreateSavedViewInput = {
  name: string;
  description?: string | null;
  scope: SavedViewScope;
  config: SavedViewConfig;
  target?: string;
};

export async function createSavedView(input: CreateSavedViewInput): Promise<SavedView> {
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) throw new Error("Oturum bulunamadı.");
  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      scope: input.scope,
      config: input.config,
      target: input.target ?? "live_table",
    })
    .select("id, user_id, scope, name, description, target, config, created_at, updated_at")
    .single();
  if (error) throw error;
  return rowToView(data as RawRow);
}

export type UpdateSavedViewInput = Partial<{
  name: string;
  description: string | null;
  scope: SavedViewScope;
  config: SavedViewConfig;
}>;

export async function updateSavedView(id: string, patch: UpdateSavedViewInput): Promise<SavedView> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.scope !== undefined) row.scope = patch.scope;
  if (patch.config !== undefined) row.config = patch.config;
  const { data, error } = await supabase
    .from("saved_views")
    .update(row)
    .eq("id", id)
    .select("id, user_id, scope, name, description, target, config, created_at, updated_at")
    .single();
  if (error) throw error;
  return rowToView(data as RawRow);
}

export async function deleteSavedView(id: string): Promise<void> {
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) throw error;
}

/** İki view config'i derin karşılaştır — "Değiştirildi" rozeti için */
export function isSameViewConfig(a: SavedViewConfig | undefined, b: SavedViewConfig | undefined): boolean {
  try {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
  } catch {
    return false;
  }
}
