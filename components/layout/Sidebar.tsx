"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Table2,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/contexts/sidebar-context";
import { useAuth } from "@/contexts/auth-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

export function Sidebar() {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { hasPermission } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? "";

  const menuItems = [
    { href: "/", label: "Dashboard", tooltip: "Özet ve hızlı erişim", icon: LayoutDashboard, permission: null as string | null },
    { href: "/projeler", label: "Projeler", icon: FolderKanban, permission: "area.projects" },
    { href: "/canli-tablo", label: "Canlı Tablo", icon: Table2, permission: "area.liveTable" },
    { href: "/ayarlar", label: "Ayarlar", icon: Settings, permission: "area.settings" },
    { href: "/yonetim/kullanici-yetkileri", label: "Kullanıcı yetkileri", icon: Shield, permission: "area.userManagement" },
  ].filter((item) => !item.permission || hasPermission(item.permission as Parameters<typeof hasPermission>[0]));

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col border-r border-slate-200 bg-slate-100 transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-800",
          isCollapsed ? "w-[72px]" : "w-[250px]"
        )}
      >
        <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-700">
          {!isCollapsed && (
            <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Panel
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/ayarlar"
                  ? pathname === "/ayarlar"
                  : item.href.startsWith("/yonetim")
                    ? pathname === item.href
                    : item.href === "/projeler"
                      ? pathname.startsWith("/projeler")
                      : item.href === "/canli-tablo"
                        ? pathname === "/canli-tablo"
                        : false;

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                    : "text-slate-600 hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );

            if (isCollapsed) {
              const tooltipText = "tooltip" in item && item.tooltip ? `${item.label} – ${item.tooltip}` : item.label;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{tooltipText}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        <Separator className="bg-slate-200 dark:bg-slate-700" />
        <div className="p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={toggleSidebar}
                className={cn(
                  "w-full justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100",
                  isCollapsed ? "px-0" : "px-3"
                )}
                aria-label={isCollapsed ? "Sidebar'ı genişlet" : "Sidebar'ı daralt"}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <>
                    <ChevronLeft className="h-5 w-5 shrink-0" />
                    <span className="ml-2 text-sm">Daralt</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "Genişlet" : "Daralt"}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
