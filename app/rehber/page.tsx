"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { GuideRenderer } from "@/components/guide/GuideRenderer";
import { GuideSidebar } from "@/components/guide/GuideSidebar";
import { GUIDE_PAGES, findGuidePage, GUIDE_CATEGORIES } from "@/lib/guide/content";

/**
 * Kullanıcı Rehberi (`/rehber`)
 *
 * Tasarım: Notion/Linear/Vercel docs benzeri iki kolonlu split.
 *   - Sol sidebar: kategori bazlı TOC + arama + YENİ rozeti
 *   - Sağ panel: seçili sayfanın içeriği (markdown-as-React)
 *   - URL: ?p=slug ile aktif sayfa (paylaşılabilir)
 *
 * Sonraki iterasyonlar:
 *   - MDX'e geçiş (içerik kararlı olunca)
 *   - GIF/video embed
 *   - "Bu özelliği denediler" tag
 *   - Aranabilir API (Algolia / Lunr)
 */
function RehberContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeId = searchParams?.get("p") ?? "hosgeldin";
  const active = findGuidePage(activeId) ?? GUIDE_PAGES[0];

  const handleSelect = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("p", id);
    router.replace(`/rehber?${params.toString()}`, { scroll: false });
    // Scroll content area to top
    if (typeof window !== "undefined") {
      const main = document.getElementById("guide-content-area");
      main?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const related = useMemo(
    () =>
      (active.related ?? [])
        .map((id) => GUIDE_PAGES.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [active]
  );

  const Icon = active.icon;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Rehber" }, { label: active.title }]} />

      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Kullanıcı Rehberi
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <Sparkles className="h-3 w-3" />
            Beta
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {GUIDE_PAGES.length} sayfa · {Object.keys(GUIDE_CATEGORIES).length} kategori
        </p>
      </header>

      {/* Split layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <GuideSidebar activeId={activeId} onSelect={handleSelect} />

        {/* Content area */}
        <main
          id="guide-content-area"
          className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-700 dark:bg-slate-800/40 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto"
        >
          {/* Sayfa başlığı */}
          <div className="mb-6 flex items-start gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md">
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {active.title}
                {active.isNew && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Yeni
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{active.description}</p>
              {active.primaryHref && active.primaryHref.href !== "#" && (
                <Button asChild size="sm" className="mt-3">
                  <Link href={active.primaryHref.href}>
                    {active.primaryHref.label}
                    <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* İçerik */}
          <GuideRenderer sections={active.sections} />

          {/* İlgili sayfalar */}
          {related.length > 0 && (
            <div className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-700">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                İlgili
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {related.map((p) => {
                  const RelatedIcon = p.icon;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(p.id)}
                        className="group flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-all hover:border-indigo-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-indigo-700"
                      >
                        <RelatedIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-500" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.title}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{p.description}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Faydalı oldu mu */}
          <div className="mt-8 flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-4 py-3 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/30 dark:text-slate-400">
            <span>Bu rehber faydalı oldu mu?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/geri-bildirim?context=guide&page=" + active.id)}
                className="rounded border border-slate-300 px-2 py-0.5 hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800"
              >
                Geri bildirim gönder
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function RehberPage() {
  return (
    <Suspense fallback={null}>
      <RehberContent />
    </Suspense>
  );
}
