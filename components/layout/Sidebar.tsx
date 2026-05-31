"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/contexts/sidebar-context";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SIDEBAR_MODULES,
  buildNavItemIndex,
  isItemActive,
  moduleForPath,
  type ModuleId,
  type NavItem,
} from "@/components/layout/sidebarModules";
import { useSidebarPins } from "@/hooks/useSidebarPins";
import { softSpring } from "@/components/motion/motionPresets";

/**
 * VS Code activity bar pattern — iki kolonlu sidebar:
 *   - Activity rail (56px solda): modül ikonları (Çalışma / Veri / Yönetim / Kişisel)
 *   - Module column (220px sağda): seçili modülün item'ları + pinned bölümü
 *
 * Davranışlar:
 *   - Route değişince aktif modül otomatik seçilir
 *   - Kullanıcı manuel modül seçince override (route değişene kadar tutulur)
 *   - "Daralt": modül kolonu kaybolur, sadece rail kalır (her item rail'de
 *     küçük ikon olarak, tooltip ile)
 *   - Pin/Unpin: hover'da ikon — pinli item'lar üstte ayrı bölümde
 */
const RAIL_WIDTH = 56;
const COLUMN_WIDTH = 220;

export function Sidebar() {
  const { isCollapsed, toggleSidebar, expandSidebar, collapseSidebar } = useSidebar();
  const { hasPermission } = useAuth();
  const { settings } = useSettings();
  const { totalUnread } = useProjectChatUnread();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { pins, isPinned, togglePin, hydrated } = useSidebarPins();

  // Modülleri yetki süzgecinden geçir — hiç item kalmayan modül gizlenir
  const visibleModules = useMemo(() => {
    return SIDEBAR_MODULES.map((m) => ({
      ...m,
      items: m.items.filter((it) => {
        if (it.permission && !hasPermission(it.permission)) return false;
        if (it.alsoRequire && !hasPermission(it.alsoRequire)) return false;
        return true;
      }),
    })).filter((m) => m.items.length > 0);
  }, [hasPermission]);

  // Route'tan otomatik seçilen modül
  const routeModule = useMemo(() => moduleForPath(pathname), [pathname]);
  // Kullanıcı manuel seçtiyse route değişene kadar onu tut
  const [manualModule, setManualModule] = useState<ModuleId | null>(null);
  const activeModule = useMemo<ModuleId>(() => {
    // Route değiştiğinde manual override sıfırlanır
    return manualModule ?? routeModule;
  }, [manualModule, routeModule]);

  // Pinli item'ların gerçek NavItem objelerini bul
  const navIndex = useMemo(() => buildNavItemIndex(), []);
  const pinnedItems = useMemo(() => {
    if (!hydrated) return [] as NavItem[];
    return pins
      .map((href) => navIndex.get(href))
      .filter((it): it is NavItem => {
        if (!it) return false;
        if (it.permission && !hasPermission(it.permission)) return false;
        if (it.alsoRequire && !hasPermission(it.alsoRequire)) return false;
        return true;
      });
  }, [pins, navIndex, hasPermission, hydrated]);

  const currentModule = visibleModules.find((m) => m.id === activeModule) ?? visibleModules[0];

  // Esc tuşu sidebar genişken kapatır — power user için
  // Input/modal içinde yazılırken tetiklemesin diye target tag kontrolü yapılır
  useEffect(() => {
    if (isCollapsed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
      // Açık modal/popover'larda Esc onlara öncelikli (Radix dialog vs.) — bizim
      // listener daha sonra çalışırsa modal kapanır + sidebar kapanır olur.
      // Bu yüzden sadece body'de focus iken kapat:
      if (document.activeElement && document.activeElement !== document.body) return;
      collapseSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCollapsed, collapseSidebar]);

  return (
    <TooltipProvider delayDuration={120}>
      <aside
        data-tour="sidebar"
        className="flex border-r border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
        style={{ minHeight: "100vh" }}
      >
        {/* === Activity rail === */}
        <div
          className="flex flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60"
          style={{ width: RAIL_WIDTH }}
        >
          {/* Logo — tıkla sidebar aç/kapa toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-14 w-full items-center justify-center border-b border-slate-200 transition-colors hover:bg-slate-100/80 dark:border-slate-800 dark:hover:bg-slate-800/50"
                aria-label={isCollapsed ? "Sidebar'ı genişlet" : "Sidebar'ı daralt"}
              >
                {settings.brandLogoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.brandLogoDataUrl}
                    alt="Logo"
                    className="max-h-8 max-w-[44px] object-contain"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105">
                    P
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Sidebar'ı genişlet" : "Sidebar'ı daralt"}
            </TooltipContent>
          </Tooltip>

          {/* Modül butonları */}
          <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Modüller">
            {visibleModules.map((m) => {
              const Icon = m.icon;
              const isActive = m.id === activeModule;
              const moduleHasBadge = m.id === "calisma" && totalUnread > 0; // örnek: bildirimler/mesajlar Çalışma'da
              return (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        // Akıllı davranış:
                        //   - Collapsed iken: aç + bu modülü göster
                        //   - Expanded + aktif modüle tıkla: kapat (toggle)
                        //   - Expanded + farklı modüle tıkla: modülü değiştir
                        if (isCollapsed) {
                          expandSidebar();
                          setManualModule(m.id);
                        } else if (m.id === activeModule) {
                          collapseSidebar();
                        } else {
                          setManualModule(m.id);
                        }
                      }}
                      className={cn(
                        "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                        isActive
                          ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300"
                          : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      )}
                      aria-label={m.label}
                      aria-pressed={isActive}
                    >
                      {/* Aktif sol kenar accent — VS Code pattern */}
                      {isActive && (
                        <span
                          aria-hidden
                          className="absolute -left-2 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500"
                        />
                      )}
                      <Icon className="h-5 w-5" />
                      {moduleHasBadge && (
                        <span className="absolute right-1 top-1 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-col">
                      <span className="font-semibold">{m.label}</span>
                      <span className="text-[11px] opacity-80">{m.description}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Collapse toggle */}
          <div className="border-t border-slate-200 p-2 dark:border-slate-800">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="h-10 w-10 p-0 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label={isCollapsed ? "Sidebar'ı genişlet" : "Sidebar'ı daralt"}
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{isCollapsed ? "Genişlet" : "Daralt"}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* === Module column === */}
        <AnimatePresence initial={false}>
          {!isCollapsed && currentModule && (
            <motion.div
              key="module-column"
              initial={reduced ? false : { width: 0, opacity: 0 }}
              animate={{ width: COLUMN_WIDTH, opacity: 1 }}
              exit={reduced ? undefined : { width: 0, opacity: 0 }}
              transition={reduced ? { duration: 0 } : softSpring}
              className="overflow-hidden"
              style={{ width: COLUMN_WIDTH }}
            >
              <div className="flex h-full flex-col">
                {/* Modül başlığı */}
                <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-800">
                  <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {currentModule.label}
                  </span>
                </div>

                <nav className="flex-1 space-y-3 overflow-y-auto p-3" aria-label={`${currentModule.label} navigasyonu`}>
                  {/* Pinned section — sadece pinli item varsa */}
                  {pinnedItems.length > 0 && (
                    <div>
                      <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Sabitlenenler
                      </p>
                      <div className="space-y-1">
                        {pinnedItems.map((item) => (
                          <SidebarNavLink
                            key={`pin-${item.href}`}
                            item={item}
                            pathname={pathname}
                            totalUnread={totalUnread}
                            isPinned
                            onTogglePin={() => togglePin(item.href)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modül item'ları */}
                  <div>
                    {pinnedItems.length > 0 && (
                      <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {currentModule.label}
                      </p>
                    )}
                    <div className="space-y-1">
                      {currentModule.items.map((item) => (
                        <SidebarNavLink
                          key={item.href}
                          item={item}
                          pathname={pathname}
                          totalUnread={totalUnread}
                          isPinned={isPinned(item.href)}
                          onTogglePin={() => togglePin(item.href)}
                        />
                      ))}
                    </div>
                  </div>
                </nav>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </TooltipProvider>
  );
}

/** Tek nav link kartı + pin toggle (hover'da). */
function SidebarNavLink({
  item,
  pathname,
  totalUnread,
  isPinned,
  onTogglePin,
}: {
  item: NavItem;
  pathname: string;
  totalUnread: number;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const Icon = item.icon;
  const active = isItemActive(item, pathname);
  const showChatBadge = (item.href === "/projeler" || item.href === "/mesajlar") && totalUnread > 0;

  return (
    <div className="group/nav relative">
      <Link
        href={item.href}
        title={item.tooltip}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300"
            : "text-slate-600 hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {showChatBadge && (
          <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold leading-none text-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </Link>
      {/* Pin toggle — hover veya zaten pinli ise görünür */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePin();
        }}
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-opacity hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100",
          isPinned ? "opacity-70" : "opacity-0 group-hover/nav:opacity-100 focus-visible:opacity-100"
        )}
        aria-label={isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
        title={isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
      >
        {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
      </button>
    </div>
  );
}
