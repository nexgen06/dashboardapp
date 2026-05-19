"use client";

import { useEffect, useState, useMemo } from "react";
import { Keyboard, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Shortcut = {
  keys: string[];
  description: string;
};

type Section = {
  title: string;
  shortcuts: Shortcut[];
};

/** Mac mı? UI'da ⌘ vs Ctrl göstermek için. */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/**
 * Klavye Kısayolları HUD'u.
 *
 * Tüm uygulamadan `?` (veya `Shift + /`) ile açılır. Esc / `?` ile kapanır.
 * Yazı yazılan alanlarda (input/textarea/contentEditable) kısayol yutulmaz.
 */
export function KeyboardShortcutsHUD() {
  const [open, setOpen] = useState(false);
  const mac = useMemo(() => isMac(), []);
  const modKey = mac ? "⌘" : "Ctrl";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      // Yazı yazılan alanda kısayolu yutma
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable === true;
      if (isTyping) return;
      // `?` ile aç (Shift + / / üzerinde)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sections: Section[] = [
    {
      title: "Genel",
      shortcuts: [
        { keys: ["?"], description: "Bu kısayol listesini aç/kapa" },
        { keys: [modKey, "K"], description: "Komut paleti (sayfa ve aksiyon arama)" },
        { keys: ["Esc"], description: "Açık modal/paneli kapat" },
      ],
    },
    {
      title: "Canlı Tablo",
      shortcuts: [
        { keys: ["F"], description: "Tabloyu tam ekran aç / daralt" },
        { keys: ["Esc"], description: "Tam ekrandan çık" },
      ],
    },
    {
      title: "Görev detay paneli",
      shortcuts: [
        { keys: ["↓"], description: "Sonraki görev" },
        { keys: ["J"], description: "Sonraki görev (vim tarzı)" },
        { keys: ["↑"], description: "Önceki görev" },
        { keys: ["K"], description: "Önceki görev (vim tarzı)" },
        { keys: ["Esc"], description: "Paneli kapat" },
      ],
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-slate-500" aria-hidden />
              Klavye Kısayolları
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {section.title}
                </h3>
                <ul className="space-y-1.5">
                  {section.shortcuts.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <span className="min-w-0 text-sm text-slate-700 dark:text-slate-200">
                        {s.description}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {s.keys.map((key, j) => (
                          <span key={j} className="flex items-center gap-1">
                            <kbd
                              className={cn(
                                "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-slate-300 bg-white px-1.5",
                                "text-[11px] font-semibold text-slate-700 shadow-sm",
                                "dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                              )}
                            >
                              {key}
                            </kbd>
                            {j < s.keys.length - 1 && (
                              <span className="text-[10px] text-slate-400">+</span>
                            )}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Bu liste her zaman <kbd className="rounded border border-slate-300 bg-white px-1 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">?</kbd> ile açılır.
            </p>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              <X className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
