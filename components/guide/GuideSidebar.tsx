"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUIDE_PAGES, GUIDE_CATEGORIES } from "@/lib/guide/content";
import type { GuideCategory } from "@/lib/guide/types";

/**
 * Rehber sol sidebar — kategori bazlı navigasyon + arama.
 *
 * Pattern: Notion/Linear/Vercel docs.
 * - Arama: title + description'da fuzzy match
 * - Kategori headerlar collapsible değil (Faz 2'de)
 * - YENİ rozeti: son 30 günde eklenen sayfalar
 * - Aktif sayfa indigo accent
 */
export function GuideSidebar({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredPages = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return GUIDE_PAGES;
    return GUIDE_PAGES.filter(
      (p) =>
        p.title.toLocaleLowerCase("tr").includes(q) ||
        p.description.toLocaleLowerCase("tr").includes(q)
    );
  }, [search]);

  // Kategori bazlı grupla
  const byCategory = useMemo(() => {
    const map = new Map<GuideCategory, typeof GUIDE_PAGES>();
    for (const p of filteredPages) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return map;
  }, [filteredPages]);

  const sortedCategories = useMemo(
    () =>
      Array.from(byCategory.keys()).sort(
        (a, b) => GUIDE_CATEGORIES[a].order - GUIDE_CATEGORIES[b].order
      ),
    [byCategory]
  );

  return (
    <aside className="flex w-full flex-col gap-3 lg:w-64 lg:shrink-0">
      {/* Arama */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="text"
          placeholder="Rehberlerde ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Aramayı temizle"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Kategoriler */}
      <nav className="space-y-4">
        {sortedCategories.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Eşleşen rehber yok.
          </p>
        ) : (
          sortedCategories.map((cat) => (
            <div key={cat}>
              <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {GUIDE_CATEGORIES[cat].label}
              </p>
              <ul className="space-y-0.5">
                {byCategory.get(cat)!.map((page) => {
                  const Icon = page.icon;
                  const isActive = activeId === page.id;
                  return (
                    <li key={page.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(page.id)}
                        className={cn(
                          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          isActive
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                        {page.isNew && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Yeni
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}
