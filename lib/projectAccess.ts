import type { Project } from "@/types/project";

/**
 * Proje sohbeti / presence için UI gating: admin veya projeye atanmış üye.
 *
 * Not: Asıl veri erişim kontrolü Supabase RLS politikalarında yapılır
 * (scripts/supabase-rls-policies.sql > pcm_select, pcm_insert). Bu fonksiyon
 * yalnızca chat input alanını gösterip gizlemek gibi UI kararları için kullanılır.
 */
export function canAccessProjectChat(
  project: Project,
  userEmail: string | null | undefined,
  isAdmin: boolean
): boolean {
  const e = (userEmail ?? "").trim().toLowerCase();
  const assigned = project.assigned_emails ?? [];
  const isAssigned =
    !!e && assigned.some((a) => String(a).trim().toLowerCase() === e);
  return isAdmin || (assigned.length > 0 && isAssigned);
}
