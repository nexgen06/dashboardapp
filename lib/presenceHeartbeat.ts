import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { OnlineUser } from "@/lib/supabasePresenceHelpers";

export type PresenceScope = "app" | "tasks" | "project";

export type PresenceHeartbeatInput = {
  scope: PresenceScope;
  projectId?: string | null;
  rowId?: string | null;
  clientId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
};

type PresenceHeartbeatRow = {
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  row_id?: string | null;
  client_id?: string | null;
};

function isHeartbeatReady(input: PresenceHeartbeatInput): boolean {
  if (!isSupabaseConfigured()) return false;
  if (!(input.userId ?? "").trim()) return false;
  if (input.scope === "project" && !(input.projectId ?? "").trim()) return false;
  return true;
}

export async function upsertPresenceHeartbeat(input: PresenceHeartbeatInput): Promise<void> {
  if (!isHeartbeatReady(input)) return;
  const projectId = input.scope === "project" ? input.projectId!.trim() : null;
  const projectKey = input.scope === "project" ? projectId : "";
  const now = new Date().toISOString();
  const { error } = await supabase.from("presence_heartbeats").upsert(
    {
      user_id: input.userId,
      user_email: input.userEmail?.trim().toLowerCase() || null,
      user_name: input.userName?.trim() || null,
      scope: input.scope,
      project_id: projectId,
      project_key: projectKey,
      row_id: input.rowId?.trim() || null,
      client_id: input.clientId?.trim() || null,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,scope,project_key" }
  );
  if (error && error.code !== "42P01") {
    console.warn("[presence heartbeat] upsert:", error.message);
  }
}

export async function listPresenceHeartbeats(scope: PresenceScope, projectId?: string | null): Promise<OnlineUser[]> {
  if (!isSupabaseConfigured()) return [];
  let query = supabase
    .from("presence_heartbeats")
    .select("user_id,user_email,user_name,row_id,client_id")
    .eq("scope", scope)
    .gt("last_seen_at", new Date(Date.now() - 90_000).toISOString())
    .order("last_seen_at", { ascending: false })
    .limit(80);

  if (scope === "project") query = query.eq("project_key", (projectId ?? "").trim());
  else query = query.eq("project_key", "");

  const { data, error } = await query;
  if (error) {
    if (error.code !== "42P01") console.warn("[presence heartbeat] list:", error.message);
    return [];
  }

  const seen = new Set<string>();
  const users: OnlineUser[] = [];
  for (const row of (data ?? []) as PresenceHeartbeatRow[]) {
    const key = (row.user_email ?? row.user_id ?? row.client_id ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    users.push({
      key,
      email: row.user_email ?? undefined,
      name: row.user_name ?? undefined,
    });
  }
  return users;
}
