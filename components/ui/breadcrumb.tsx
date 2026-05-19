"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  homeHref?: string;
  homeLabel?: string;
}

/**
 * Gezinti izi. İlk öğe ev ikonuyla gösterilir; son öğe link değildir (mevcut sayfa).
 * Mobilde uzun adlar truncate edilir.
 */
export function Breadcrumb({
  items,
  className,
  homeHref = "/",
  homeLabel = "Dashboard",
}: BreadcrumbProps) {
  if (items.length === 0) return null;
  const all: BreadcrumbItem[] = [{ label: homeLabel, href: homeHref }, ...items];
  return (
    <nav
      aria-label="Gezinti izi"
      className={cn("min-w-0 text-sm text-slate-500 dark:text-slate-400", className)}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {all.map((item, index) => {
          const isLast = index === all.length - 1;
          const isFirst = index === 0;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {!isFirst && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
              )}
              {isLast || !item.href ? (
                <span
                  className="truncate font-medium text-slate-700 dark:text-slate-200"
                  aria-current={isLast ? "page" : undefined}
                  title={item.label}
                >
                  {isFirst ? (
                    <span className="inline-flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden sm:inline">{item.label}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 truncate rounded px-1 py-0.5 hover:text-slate-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:text-slate-100"
                  title={item.label}
                >
                  {isFirst ? (
                    <>
                      <Home className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden sm:inline">{item.label}</span>
                    </>
                  ) : (
                    item.label
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
