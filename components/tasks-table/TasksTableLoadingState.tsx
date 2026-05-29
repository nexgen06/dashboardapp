"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * TasksTable yükleniyor durumu — gerçek tablo şekline benzeyen skeleton.
 *
 * Tasarım: spinner yerine "row-shape" skeleton; algılanan hızı artırır
 * (kullanıcı yüklemenin hangi yapıda olacağını önceden görür).
 *
 * Yapı:
 *  - Üstte toolbar skeleton (filtre+arama+aksiyon butonları)
 *  - 8 satır skeleton (checkbox + status pill + içerik + assignee + tarih)
 *  - Sticky pagination skeleton altta
 */
export function TasksTableLoadingState() {
  const skeletonRows = 8;
  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      aria-busy="true"
      aria-label="Görev tablosu yükleniyor"
    >
      {/* Toolbar skeleton */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-28" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Header row skeleton */}
      <div className="border-b border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/30">
        <div className="grid grid-cols-[24px_minmax(120px,2fr)_minmax(80px,1fr)_minmax(100px,1fr)_minmax(80px,1fr)] gap-3">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      {/* Row skeletons — stagger için animation-delay */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[24px_minmax(120px,2fr)_minmax(80px,1fr)_minmax(100px,1fr)_minmax(80px,1fr)] gap-3 px-3 py-3"
            style={{ opacity: 1 - i * 0.06 }}
          >
            {/* checkbox */}
            <Skeleton className="h-4 w-4 rounded" />
            {/* content */}
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4" style={{ width: `${60 + (i * 7) % 30}%` }} />
              {i % 3 === 0 && <Skeleton className="h-3 w-1/3" />}
            </div>
            {/* status pill */}
            <Skeleton className="h-5 w-20 rounded-full" />
            {/* assignee — avatar + name */}
            <div className="flex items-center gap-2">
              <Skeleton variant="circle" className="h-6 w-6" />
              <Skeleton className="h-3 w-16" />
            </div>
            {/* date */}
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 dark:border-slate-700">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
      </div>
    </div>
  );
}
