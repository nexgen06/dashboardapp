import { supabase } from "@/lib/supabaseClient";
import type { ProjectChatMessage } from "@/types/projectChat";

export function mapMessageRow(row: Record<string, unknown>): ProjectChatMessage {
  const raw = row.created_at != null ? new Date(String(row.created_at)).getTime() : Date.now();
  return {
    id: String(row.id),
    projectId: String(row.project_id ?? ""),
    email: row.sender_email != null ? String(row.sender_email) : undefined,
    name: row.sender_name != null ? String(row.sender_name) : undefined,
    text: String(row.body ?? ""),
    at: Number.isNaN(raw) ? Date.now() : raw,
  };
}

export async function fetchUnreadCounts(
  readerEmail: string,
  projectIds: string[]
): Promise<Record<string, number>> {
  const e = readerEmail.trim().toLowerCase();
  if (!projectIds.length) return {};

  const { data: reads, error: rErr } = await supabase
    .from("project_chat_reads")
    .select("project_id, last_read_at")
    .eq("reader_email", e)
    .in("project_id", projectIds);

  if (rErr) throw rErr;

  const lastRead = new Map<string, number>();
  for (const row of reads ?? []) {
    const t = new Date(String((row as { last_read_at?: string }).last_read_at)).getTime();
    lastRead.set(String((row as { project_id?: string }).project_id), Number.isNaN(t) ? 0 : t);
  }

  const { data: msgs, error: mErr } = await supabase
    .from("project_chat_messages")
    .select("project_id, created_at, sender_email")
    .in("project_id", projectIds);

  if (mErr) throw mErr;

  const counts: Record<string, number> = {};
  for (const pid of projectIds) counts[pid] = 0;

  for (const raw of msgs ?? []) {
    const m = raw as { project_id: string; created_at: string; sender_email: string };
    const pid = String(m.project_id);
    const sender = String(m.sender_email ?? "")
      .trim()
      .toLowerCase();
    if (sender === e) continue;
    const created = new Date(m.created_at).getTime();
    const lr = lastRead.get(pid) ?? 0;
    if (created > lr) counts[pid] = (counts[pid] ?? 0) + 1;
  }
  return counts;
}

export async function markProjectChatRead(projectId: string, readerEmail: string): Promise<void> {
  const e = readerEmail.trim().toLowerCase();
  const { error } = await supabase.from("project_chat_reads").upsert(
    {
      project_id: projectId,
      reader_email: e,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "project_id,reader_email" }
  );
  if (error) throw error;
}
