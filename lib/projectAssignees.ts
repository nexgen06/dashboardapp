import type { Project } from "@/types/project";

/**
 * Proje kartındaki `assigned_emails` listesinden atanabilir üye e-postalarını toplar.
 * Canlı Tablo toplu atama / filtre dropdown'ları bu kaynağı kullanmalı —
 * mevcut görev atamalarından türetmek, hiç görev almamış ekip üyelerini gizler.
 */
export function collectProjectAssigneeEmails(
  projects: Project[],
  projectIds?: string[] | null
): string[] {
  const scope =
    projectIds && projectIds.length > 0
      ? new Set(projectIds.map((id) => String(id)))
      : null;

  const emails = new Set<string>();
  for (const project of projects) {
    if (scope && !scope.has(String(project.id))) continue;
    for (const raw of project.assigned_emails ?? []) {
      const email = String(raw).trim();
      if (email) emails.add(email);
    }
  }

  return Array.from(emails).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
}

/** Seçili görevlerin projeleri → yoksa aktif proje filtresi → yoksa tüm projeler. */
export function resolveBulkAssigneeProjectIds(input: {
  selectedProjectIds: string[];
  projectFilter: string[];
}): string[] | undefined {
  if (input.selectedProjectIds.length > 0) {
    return Array.from(new Set(input.selectedProjectIds.map(String)));
  }
  if (input.projectFilter.length > 0) {
    return Array.from(new Set(input.projectFilter.map(String)));
  }
  return undefined;
}
