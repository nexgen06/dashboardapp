"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Keyboard, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openCommandPalette } from "@/components/CommandPalette";
import { useRouter } from "next/navigation";

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

/** HUD'u tetiklemek için global event — komut paleti gibi başka yerlerden açılır. */
const SHORTCUTS_OPEN_EVENT = "keyboardshortcuts:open";

/** Diğer bileşenlerden HUD'u açmak için yardımcı (komut paleti vb.) */
export function openKeyboardShortcuts() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SHORTCUTS_OPEN_EVENT));
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
  const router = useRouter();
  /** G tuşu bekliyor mu (g → p, g → t gibi kombolar için) */
  const awaitingG = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      // Yazı yazılan alanda kısayolu yutma
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable === true;
      if (isTyping) return;
      // Modal açıksa sadece Esc ile kapat
      if (open) {
        if (e.key === "Escape") setOpen(false);
        return;
      }

      // G + harf → hızlı sayfa geçişi
      if (awaitingG.current) {
        awaitingG.current = false;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        if (e.key === "p" || e.key === "P") { e.preventDefault(); router.push("/projeler"); return; }
        if (e.key === "t" || e.key === "T") { e.preventDefault(); router.push("/canli-tablo"); return; }
        if (e.key === "r" || e.key === "R") { e.preventDefault(); router.push("/raporlar"); return; }
        if (e.key === "m" || e.key === "M") { e.preventDefault(); router.push("/mesajlar"); return; }
        if (e.key === "b" || e.key === "B") { e.preventDefault(); router.push("/bildirimler"); return; }
        if (e.key === "h" || e.key === "H") { e.preventDefault(); router.push("/"); return; }
        return;
      }

      // Cmd+Shift+E → Bildirim merkezi (focus mode)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        router.push("/bildirimler");
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // `?` ile HUD aç
      if (e.key === "?") { e.preventDefault(); setOpen(true); return; }

      // `N` → komut paleti (yeni görev / hızlı arama)
      if (e.key === "n" || e.key === "N") { e.preventDefault(); openCommandPalette(); return; }

      // `G` → sayfa geçiş modu başlat
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        awaitingG.current = true;
        gTimerRef.current = setTimeout(() => { awaitingG.current = false; }, 1500);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    const openHandler = () => setOpen(true);
    window.addEventListener(SHORTCUTS_OPEN_EVENT, openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(SHORTCUTS_OPEN_EVENT, openHandler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [open, router]);

  const sections: Section[] = [
    {
      title: "Genel",
      shortcuts: [
        { keys: ["?"], description: "Bu kısayol listesini aç/kapa" },
        { keys: [modKey, "K"], description: "Komut paleti — proje, görev ve komut ara" },
        { keys: ["N"], description: "Komut paletini aç (hızlı oluşturma)" },
        { keys: [modKey, "Shift", "E"], description: "Bildirim merkezi (Inbox Zero — focus mode)" },
        { keys: ["Esc"], description: "Açık modal/paneli kapat" },
      ],
    },
    {
      title: "Bildirim Merkezi (Inbox Zero)",
      shortcuts: [
        { keys: ["J", "↓"], description: "Sonraki bildirim" },
        { keys: ["K", "↑"], description: "Önceki bildirim" },
        { keys: ["E"], description: "Arşivle (okundu işaretle, sıradakine geç)" },
        { keys: ["R"], description: "Aç — bildirimin hedef sayfasına git" },
        { keys: ["D"], description: "Ertele — 1 saat / Bu akşam / Yarın / Pazartesi" },
        { keys: ["Enter"], description: "Bildirimi aç (R ile aynı)" },
        { keys: ["Esc"], description: "Sayfadan geri dön" },
      ],
    },
    {
      title: "Sayfa geçişleri (G + harf)",
      shortcuts: [
        { keys: ["G", "H"], description: "Ana sayfa (Dashboard)" },
        { keys: ["G", "P"], description: "Projeler" },
        { keys: ["G", "T"], description: "Canlı Tablo" },
        { keys: ["G", "R"], description: "Raporlar" },
        { keys: ["G", "M"], description: "Mesajlar" },
        { keys: ["G", "B"], description: "Bildirimler" },
      ],
    },
    {
      title: "Canlı Tablo",
      shortcuts: [
        { keys: ["E"], description: "Dışa aktar diyalogunu aç" },
        { keys: ["F"], description: "Hızlı filtre panelini aç / kapat" },
        { keys: ["Shift", "F"], description: "Tabloyu tam ekran aç / daralt" },
        { keys: ["J"], description: "Sonraki görev (detay panelini açar)" },
        { keys: ["K"], description: "Önceki görev (detay panelini açar)" },
        { keys: ["Esc"], description: "Tam ekrandan çık" },
        { keys: ["]"], description: "Sonraki sayfa" },
        { keys: ["["], description: "Önceki sayfa" },
        { keys: ["End"], description: "Son sayfaya atla" },
        { keys: ["Home"], description: "İlk sayfaya atla" },
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
          <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-2">
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
