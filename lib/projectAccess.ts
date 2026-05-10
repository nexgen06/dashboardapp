import type { Project } from "@/types/project";

/** Proje listesinden kullanıcının erişebileceği proje id'leri (proje detay / sohbet ile aynı mantık). */
export function getAccessibleProjectIds(
  projects: Project[],
  userEmail: string | null | undefined,
  isAdmin: boolean
): string[] {
  const e = (userEmail ?? "").trim().toLowerCase();
  if (!e) return [];
  return projects
    .filter((p) => {
      if (isAdmin) return true;
      const assigned = p.assigned_emails ?? [];
      if (assigned.length === 0) return false;
      return assigned.some((a) => String(a).trim().toLowerCase() === e);
    })
    .map((p) => p.id);
}
