import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type ProjectMemberRole = "project_owner" | "project_manager" | "member" | "viewer";

export type ProjectMemberPermission = {
  project_id: string;
  user_id: string;
  user_email: string;
  project_role: ProjectMemberRole;
  can_view: boolean;
  can_edit: boolean;
  can_comment: boolean;
  can_copy: boolean;
  can_export: boolean;
  can_export_unmasked: boolean;
  can_bulk_update: boolean;
  can_bulk_delete: boolean;
  updated_at?: string | null;
};

export type ProjectMemberPermissionInput = Omit<ProjectMemberPermission, "updated_at">;

function isMissingProjectMemberPermissions(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return code === "42P01" || message.includes("project_member_permissions");
}

export function defaultProjectMemberPermission(input: {
  projectId: string;
  userId: string;
  userEmail: string;
  role?: ProjectMemberRole;
}): ProjectMemberPermission {
  const role = input.role ?? "member";
  const elevated = role === "project_owner" || role === "project_manager";
  return {
    project_id: input.projectId,
    user_id: input.userId,
    user_email: input.userEmail.trim().toLowerCase(),
    project_role: role,
    can_view: true,
    can_edit: elevated,
    can_comment: true,
    can_copy: true,
    can_export: elevated,
    can_export_unmasked: false,
    can_bulk_update: elevated,
    can_bulk_delete: false,
    updated_at: null,
  };
}

export async function listProjectMemberPermissions(
  projectId: string
): Promise<{ ok: true; data: ProjectMemberPermission[] } | { ok: false; missingTable: boolean }> {
  if (!isSupabaseConfigured() || !projectId.trim()) return { ok: false, missingTable: false };
  const { data, error } = await supabase
    .from("project_member_permissions")
    .select("*")
    .eq("project_id", projectId)
    .order("user_email", { ascending: true });

  if (error) {
    const missingTable = isMissingProjectMemberPermissions(error);
    if (!missingTable) console.warn("[project member permissions] list:", error.message);
    return { ok: false, missingTable };
  }

  return { ok: true, data: (data ?? []) as ProjectMemberPermission[] };
}

export async function listMyProjectMemberPermissions(): Promise<
  { ok: true; data: ProjectMemberPermission[] } | { ok: false; missingTable: boolean }
> {
  if (!isSupabaseConfigured()) return { ok: false, missingTable: false };
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (authError || !userId) return { ok: false, missingTable: false };

  const { data, error } = await supabase
    .from("project_member_permissions")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    const missingTable = isMissingProjectMemberPermissions(error);
    if (!missingTable) console.warn("[project member permissions] my permissions:", error.message);
    return { ok: false, missingTable };
  }

  return { ok: true, data: (data ?? []) as ProjectMemberPermission[] };
}

export async function upsertProjectMemberPermissions(rows: ProjectMemberPermissionInput[]): Promise<boolean> {
  if (!isSupabaseConfigured() || rows.length === 0) return false;
  const payload = rows.map((row) => ({
    ...row,
    user_email: row.user_email.trim().toLowerCase(),
  }));
  const { error } = await supabase.from("project_member_permissions").upsert(payload, {
    onConflict: "project_id,user_id",
  });
  if (error) {
    if (!isMissingProjectMemberPermissions(error)) console.warn("[project member permissions] upsert:", error.message);
    return false;
  }
  return true;
}
