"use client";

import { createContext, useContext } from "react";
import { useProjectsInternal } from "@/hooks/useProjectsInternal";
import type { Project } from "@/types/project";

export type ProjectsContextValue = ReturnType<typeof useProjectsInternal>;

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

/** Tüm oturumlu sayfalarda tek proje listesi + Realtime aboneliği. */
export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const value = useProjectsInternal({ includeArchived: true });
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjectsContextOptional(): ProjectsContextValue | null {
  return useContext(ProjectsContext);
}

export function isProjectArchived(project: Project): boolean {
  return project.archived_at != null && String(project.archived_at).trim() !== "";
}

export function filterProjectsByArchived(projects: Project[], includeArchived: boolean): Project[] {
  if (includeArchived) return projects;
  return projects.filter((p) => !isProjectArchived(p));
}
