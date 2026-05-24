"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Table2,
  Bell,
  MoreHorizontal,
  MessagesSquare,
  BarChart3,
  Settings,
  Shield,
  ServerCog,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/contexts/notification-context";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import type { Permission } from "@/types/permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission | null;
  alsoRequire: Permission | null;
  /** İkonun yanında küçük rozet (örn. okunmamış bildirim sayısı). */
  badge?: number;
};

/**
 * Mobil cihazlarda alt navigasyon. md ve üstü ekranlarda gizli (Sidebar görünür).
 * 4 sabit ikon + "Daha fazla" → diğer menü öğelerini içeren modal.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const notif = useNotifications();
  const { totalUnread } = useProjectChatUnread();
  const [moreOpen, setMoreOpen] = useState(false);

  /** Aktif kontrolü — proje detay/canli-tablo gibi alt path'leri de işaretler */
  const isActive = (href: string): boolean => {
    if (href === "/") return pathname === "/";
    if (href === "/projeler") return pathname.startsWith("/projeler");
    return pathname.startsWith(href);
  };

  const primary: NavItem[] = (
    [
      { href: "/", label: "Ana", icon: LayoutDashboard, permission: null, alsoRequire: null },
      { href: "/projeler", label: "Projeler", icon: FolderKanban, permission: "area.projects" as const, alsoRequire: "projects.view" as const, badge: totalUnread > 0 ? totalUnread : undefined },
      { href: "/gorevlerim", label: "Görevlerim", icon: ListTodo, permission: "area.liveTable" as const, alsoRequire: "liveTable.view" as const },
      { href: "/bildirimler", label: "Bildirim", icon: Bell, permission: null, alsoRequire: null, badge: notif.totalCount > 0 ? notif.totalCount : undefined },
    ] satisfies NavItem[]
  ).filter((i) => {
    if (i.permission && !hasPermission(i.permission)) return false;
    if (i.alsoRequire && !hasPermission(i.alsoRequire)) return false;
    return true;
  });

  const overflow: NavItem[] = (
    [
      { href: "/mesajlar", label: "Mesajlar", icon: MessagesSquare, permission: "area.projects" as const, alsoRequire: "projects.view" as const },
      { href: "/canli-tablo", label: "Canlı Tablo", icon: Table2, permission: "area.liveTable" as const, alsoRequire: "liveTable.view" as const },
      { href: "/raporlar", label: "Raporlar", icon: BarChart3, permission: "area.reports" as const, alsoRequire: "reports.view" as const },
      { href: "/ayarlar", label: "Ayarlar", icon: Settings, permission: "area.settings" as const, alsoRequire: "settings.view" as const },
      { href: "/yonetim/kurumsal-admin", label: "Kurumsal admin", icon: ServerCog, permission: "area.userManagement" as const, alsoRequire: null },
      { href: "/yonetim/kullanici-yetkileri", label: "Kullanıcı yetkileri", icon: Shield, permission: "area.userManagement" as const, alsoRequire: null },
      { href: "/yonetim/gorev-istatistikleri", label: "Görev istatistikleri", icon: BarChart3, permission: "area.userManagement" as const, alsoRequire: null },
      { href: "/yonetim/rapor-sablonlari", label: "Rapor şablonları", icon: FileText, permission: "area.userManagement" as const, alsoRequire: null },
    ] satisfies NavItem[]
  ).filter((i) => {
    if (i.permission && !hasPermission(i.permission)) return false;
    if (i.alsoRequire && !hasPermission(i.alsoRequire)) return false;
    return true;
  });

  return (
    <>
      <nav
        aria-label="Mobil alt navigasyon"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur",
          "shadow-[0_-2px_8px_rgba(0,0,0,0.04)]",
          "dark:border-slate-700 dark:bg-slate-900/95",
          "md:hidden"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                    active
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  )}
                >
                  {active && (
                    <span
                      className="absolute inset-x-3 top-0 h-0.5 rounded-b bg-blue-600 dark:bg-blue-400"
                      aria-hidden
                    />
                  )}
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden />
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -right-1.5 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-white">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {overflow.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                  "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                )}
                aria-label="Daha fazla menü"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                <span>Daha</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Diğer sayfalar</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-1 py-2">
            {overflow.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
