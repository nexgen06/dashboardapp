"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Table2,
  MessageSquare,
  Settings,
  Shield,
  BarChart3,
  FileText,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Command as CmdIcon,
  Filter,
  PlusCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useProjects } from "@/hooks/useProjects";
import { resetOnboardingTour } from "@/components/OnboardingTour";
import type { Permission } from "@/types/permissions";
import { cn } from "@/lib/utils";

/**
 * Diakritikleri normalize edip Türkçe-uyumlu lower-case'e çevirir.
 * Aramada "Ayarlar" girdisi "ayarlar" sorgusuyla bulunabilsin diye.
 */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

type CommandItem = {
  id: string;
  label: string;
  /** Arama için ek anahtar kelimeler (görünmez) */
  keywords?: string[];
  icon: LucideIcon;
  /** Görsel grup başlığı */
  group: string;
  /** Sağda gösterilecek kısa açıklama veya kısayol */
  hint?: string;
  /** Eylem */
  perform: () => void | Promise<void>;
};

const PALETTE_OPEN_EVENT = "commandpalette:open";

/** Diğer bileşenlerden paleti açmak için yardımcı (header butonu vb.) */
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PALETTE_OPEN_EVENT));
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission, signOut } = useAuth();
  const { settings, updateSetting } = useSettings();
  const { projects } = useProjects();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** ⌘K / Ctrl+K toggle + custom event dinleme */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(PALETTE_OPEN_EVENT, openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(PALETTE_OPEN_EVENT, openHandler);
    };
  }, []);

  /** Açılınca sorguyu temizle, input'a odaklan */
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  /** Sayfa değişince paleti kapat */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const close = useCallback(() => setOpen(false), []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  const setTheme = useCallback(
    (theme: "light" | "dark" | "system") => {
      updateSetting("theme", theme);
      close();
    },
    [updateSetting, close]
  );

  /** Komut listesi — yetkilere göre filtrelenmiş */
  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    // — Navigasyon —
    list.push({
      id: "nav-dashboard",
      label: "Dashboard",
      keywords: ["anasayfa", "ozet", "home"],
      icon: LayoutDashboard,
      group: "Sayfaya git",
      perform: () => navigate("/"),
    });
    if (hasPermission("area.projects") && hasPermission("projects.view")) {
      list.push({
        id: "nav-projeler",
        label: "Projeler",
        keywords: ["project"],
        icon: FolderKanban,
        group: "Sayfaya git",
        perform: () => navigate("/projeler"),
      });
    }
    if (hasPermission("area.liveTable") && hasPermission("liveTable.view")) {
      list.push({
        id: "nav-canli-tablo",
        label: "Canlı Tablo",
        keywords: ["gorevler", "tasks", "table", "tablo"],
        icon: Table2,
        group: "Sayfaya git",
        perform: () => navigate("/canli-tablo"),
      });
    }
    list.push({
      id: "nav-mesajlar",
      label: "Mesajlar",
      keywords: ["sohbet", "chat", "messages"],
      icon: MessageSquare,
      group: "Sayfaya git",
      perform: () => navigate("/mesajlar"),
    });
    if (hasPermission("area.settings") && hasPermission("settings.view")) {
      list.push({
        id: "nav-ayarlar",
        label: "Ayarlar",
        keywords: ["settings", "preferences", "tercih"],
        icon: Settings,
        group: "Sayfaya git",
        perform: () => navigate("/ayarlar"),
      });
    }
    if (hasPermission("area.userManagement" as Permission)) {
      list.push({
        id: "nav-kullanici-yetkileri",
        label: "Kullanıcı yetkileri",
        keywords: ["yonetim", "admin", "permissions", "roles"],
        icon: Shield,
        group: "Yönetim",
        perform: () => navigate("/yonetim/kullanici-yetkileri"),
      });
      list.push({
        id: "nav-gorev-istatistikleri",
        label: "Görev istatistikleri",
        keywords: ["stats", "metrik", "analytics"],
        icon: BarChart3,
        group: "Yönetim",
        perform: () => navigate("/yonetim/gorev-istatistikleri"),
      });
      list.push({
        id: "nav-rapor-sablonlari",
        label: "Rapor şablonları",
        keywords: ["rapor", "export", "pdf", "email", "şablon"],
        icon: FileText,
        group: "Yönetim",
        perform: () => navigate("/yonetim/rapor-sablonlari"),
      });
    }

    // — Eylemler —
    if (pathname === "/canli-tablo" && hasPermission("liveTable.createTask")) {
      list.push({
        id: "action-new-task",
        label: "Yeni görev",
        keywords: ["create", "ekle", "add"],
        icon: PlusCircle,
        group: "Eylem",
        hint: "Canlı Tablo",
        perform: () => {
          window.dispatchEvent(new Event("commandpalette:newTask"));
          close();
        },
      });
      list.push({
        id: "action-clear-filters",
        label: "Filtreleri temizle",
        keywords: ["reset", "sifirla"],
        icon: Filter,
        group: "Eylem",
        hint: "Canlı Tablo",
        perform: () => {
          window.dispatchEvent(new Event("commandpalette:clearFilters"));
          close();
        },
      });
    }
    if (hasPermission("projects.create")) {
      list.push({
        id: "action-new-project",
        label: "Yeni proje",
        keywords: ["create", "ekle", "add"],
        icon: PlusCircle,
        group: "Eylem",
        perform: () => {
          // Projeler sayfasına git ve form açma sinyali bırak
          window.dispatchEvent(new Event("commandpalette:newProject"));
          if (pathname !== "/projeler") navigate("/projeler");
          else close();
        },
      });
    }

    // — Tema —
    list.push({
      id: "theme-light",
      label: "Açık tema",
      keywords: ["light", "beyaz", "tema"],
      icon: Sun,
      group: "Görünüm",
      hint: settings.theme === "light" ? "Aktif" : undefined,
      perform: () => setTheme("light"),
    });
    list.push({
      id: "theme-dark",
      label: "Koyu tema",
      keywords: ["dark", "siyah", "tema"],
      icon: Moon,
      group: "Görünüm",
      hint: settings.theme === "dark" ? "Aktif" : undefined,
      perform: () => setTheme("dark"),
    });
    list.push({
      id: "theme-system",
      label: "Sistem teması",
      keywords: ["auto", "otomatik", "tema"],
      icon: Monitor,
      group: "Görünüm",
      hint: settings.theme === "system" ? "Aktif" : undefined,
      perform: () => setTheme("system"),
    });

    // — Projelere hızlı erişim (filtre aktif değilse, ilk 8 proje) —
    const recentProjects = projects.slice(0, 8);
    for (const p of recentProjects) {
      list.push({
        id: `project-${p.id}`,
        label: p.name,
        keywords: ["proje", "project", "ac", "open"],
        icon: FolderKanban,
        group: "Projeyi aç",
        perform: () => navigate(`/projeler/${p.id}`),
      });
    }

    // — Yardım —
    list.push({
      id: "help-tour",
      label: "Tanıtım turunu başlat",
      keywords: ["onboarding", "tour", "yardim", "help", "rehber"],
      icon: Sparkles,
      group: "Yardım",
      perform: () => {
        close();
        resetOnboardingTour();
      },
    });

    // — Hesap —
    list.push({
      id: "account-signout",
      label: "Çıkış yap",
      keywords: ["logout", "sign out", "exit", "cikis"],
      icon: LogOut,
      group: "Hesap",
      perform: async () => {
        close();
        await signOut();
      },
    });

    return list;
  }, [pathname, hasPermission, settings.theme, projects, navigate, setTheme, close, signOut]);

  /** Sorguya göre filtreleme — basit fuzzy: tüm token'lar label+keywords içinde olmalı */
  const filtered = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return commands;
    const tokens = q.split(/\s+/).filter(Boolean);
    return commands.filter((c) => {
      const haystack = normalize([c.label, c.group, ...(c.keywords ?? [])].join(" "));
      return tokens.every((t) => haystack.includes(t));
    });
  }, [commands, query]);

  /** Grup başlıklarına göre düzenli liste — orijinal sırayı koru */
  const grouped = useMemo(() => {
    const groups: Array<{ name: string; items: CommandItem[] }> = [];
    const idx = new Map<string, number>();
    for (const item of filtered) {
      let i = idx.get(item.group);
      if (i === undefined) {
        i = groups.length;
        idx.set(item.group, i);
        groups.push({ name: item.group, items: [] });
      }
      groups[i].items.push(item);
    }
    return groups;
  }, [filtered]);

  /** Düz sıralı liste — klavye navigasyonu için */
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    if (selectedIndex >= flat.length) setSelectedIndex(Math.max(0, flat.length - 1));
  }, [flat.length, selectedIndex]);

  /** Seçili öğeyi görüş alanında tut */
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((p) => (flat.length === 0 ? 0 : (p + 1) % flat.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((p) => (flat.length === 0 ? 0 : (p - 1 + flat.length) % flat.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flat[selectedIndex];
        if (item) void item.perform();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [flat, selectedIndex, close]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Komut paleti"
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60" aria-hidden />
      {/* Card */}
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Komut veya sayfa ara…"
            aria-label="Komut ara"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline-flex dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Sonuç bulunamadı
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.name} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {group.name}
                </div>
                <div>
                  {group.items.map((item) => {
                    const flatIndex = flat.indexOf(item);
                    const isActive = flatIndex === selectedIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-cmd-index={flatIndex}
                        onClick={() => void item.perform()}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/40"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-300" : "text-slate-400")} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.hint && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            {item.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" aria-hidden />
              <ArrowDown className="h-3 w-3" aria-hidden />
              <span>gez</span>
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" aria-hidden />
              <span>seç</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <CmdIcon className="h-3 w-3" aria-hidden />
            <span>+K aç/kapa</span>
          </span>
        </div>
      </div>
    </div>
  );
}
