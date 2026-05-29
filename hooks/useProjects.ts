"use client";

import {
  filterProjectsByArchived,
  useProjectsContextOptional,
} from "@/contexts/projects-context";
import { useProjectsInternal, type UseProjectsOptions } from "@/hooks/useProjectsInternal";

export type { UseProjectsOptions } from "@/hooks/useProjectsInternal";

/**
 * Proje listesi — `ProjectsProvider` içindeyse paylaşımlı instance;
 * dışında (test / izole render) doğrudan fetch.
 */
export function useProjects(options?: UseProjectsOptions) {
  const shared = useProjectsContextOptional();
  if (shared) {
    const includeArchived = options?.includeArchived === true;
    return {
      ...shared,
      projects: filterProjectsByArchived(shared.projects, includeArchived),
    };
  }
  return useProjectsInternal(options);
}

export { useProjectsInternal } from "@/hooks/useProjectsInternal";
