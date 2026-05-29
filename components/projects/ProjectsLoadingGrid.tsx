"use client";

import { Skeleton } from "@/components/ui/skeleton";

export type ProjectsLoadingGridProps = {
  /** Number of skeleton cards to render. Defaults to 6. */
  count?: number;
};

export function ProjectsLoadingGrid({ count = 6 }: ProjectsLoadingGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Projeler yükleniyor">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton variant="circle" className="h-6 w-6" />
          </div>
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
