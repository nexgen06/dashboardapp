"use client";

import { useMemo } from "react";
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
  const includeArchived = options?.includeArchived === true;
  const standalone = useProjectsInternal(
    shared ? { includeArchived: true, _skip: true } : options
  );

  const filteredProjects = useMemo(() => {
    if (!shared) return null;
    return filterProjectsByArchived(shared.projects, includeArchived);
  }, [shared?.projects, includeArchived]);

  return useMemo(() => {
    if (shared && filteredProjects) {
      return { ...shared, projects: filteredProjects };
    }
    return standalone;
  }, [shared, filteredProjects, standalone]);
}

export { useProjectsInternal } from "@/hooks/useProjectsInternal";
