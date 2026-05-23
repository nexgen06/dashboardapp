"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  MessagesSquare,
  Bell,
  ListTodo,
  Table2,
  MessageSquarePlus,
  Megaphone,
  Mail,
  Settings,
  Shield,
  BarChart3,
  Database,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/contexts/sidebar-context";
import { useAuth } from "@/contexts/auth-context";
import type { Permission } from "@/types/permissions";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
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
  const { totalUnread } = useProjectChatUnread();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? "";

  const menuItems = [
    { href: "/", label: "Dashboard", tooltip: "Özet ve hızlı erişim", icon: LayoutDashboard, permission: null as Permission | null, alsoRequire: null as Permission | null },
    { href: "/projeler", label: "Projeler", icon: FolderKanban, permission: "area.projects" as const, alsoRequire: "projects.view" as const },
    {
      href: "/mesajlar",
      label: "Mesajlar",
      tooltip: "Proje sohbetleri ve okunmamışlar",
      icon: MessagesSquare,
      permission: "area.projects" as const,
      alsoRequire: "projects.view" as const,
    },
    { href: "/gorevlerim", label: "Görevlerim", tooltip: "Mobil odaklı kişisel görev akışı", icon: ListTodo, permission: "area.liveTable" as const, alsoRequire: "liveTable.view" as const },
    { href: "/canli-tablo", label: "Canlı Tablo", icon: Table2, permission: "area.liveTable" as const, alsoRequire: "liveTable.view" as const },
    { href: "/bildirimler", label: "Bildirimler", tooltip: "Atama, gecikme ve sohbet bildirimleri", icon: Bell, permission: null as Permission | null, alsoRequire: null as Permission | null },
    { href: "/raporlar", label: "Raporlar", tooltip: "Proje ve ekip performans raporları", icon: BarChart3, permission: "area.reports" as const, alsoRequire: "reports.view" as const },
    { href: "/geri-bildirim", label: "Geri Bildirim", tooltip: "Öneri, hata bildirimi veya sorularını ilet", icon: MessageSquarePlus, permission: null as Permission | null, alsoRequire: null as Permission | null },
    { href: "/ayarlar", label: "Ayarlar", icon: Settings, permission: "area.settings" as const, alsoRequire: "settings.view" as const },
    { href: "/yonetim/kullanici-yetkileri", label: "Kullanıcı yetkileri", icon: Shield, permission: "area.userManagement" as const, alsoRequire: null },
    { href: "/yonetim/gorev-istatistikleri", label: "Görev istatistikleri", icon: BarChart3, permission: "area.userManagement" as const, alsoRequire: null },
    { href: "/yonetim/referans-veriler", label: "Referans veriler", tooltip: "JSON kaynakları ve merkezi dropdown verileri", icon: Database, permission: "area.userManagement" as const, alsoRequire: null },
    { href: "/yonetim/pii-access", label: "PII erişim kayıtları", tooltip: "TCKN/Sicil kopya/export izleme", icon: Shield, permission: "area.piiAccess" as const, alsoRequire: "piiAccess.view" as const },
    { href: "/yonetim/geri-bildirimler", label: "Geri bildirim yönetimi", tooltip: "Kullanıcılardan gelen öneri/hata/soru", icon: MessageSquarePlus, permission: "area.feedbackAdmin" as const, alsoRequire: "feedback.manage" as const },
    { href: "/yonetim/duyurular", label: "Duyurular", tooltip: "Tüm kullanıcılara mesaj gönder", icon: Megaphone, permission: "area.announcementsAdmin" as const, alsoRequire: "notifications.send" as const },
    { href: "/yonetim/eposta-bildirimleri", label: "E-posta bildirim ayarları", tooltip: "Hangi olaylarda e-posta gönderilsin (varsayılan kapalı)", icon: Mail, permission: "area.emailNotifAdmin" as const, alsoRequire: null },
  ].filter((item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.alsoRequire && !hasPermission(item.alsoRequire)) return false;
    return true;
  });

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-tour="sidebar"
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
                      : item.href === "/mesajlar"
                      ? pathname.startsWith("/mesajlar")
                      : item.href === "/gorevlerim"
                        ? pathname === "/gorevlerim"
                      : item.href === "/canli-tablo"
                          ? pathname === "/canli-tablo"
                          : false;

            const chatUnread = (item.href === "/projeler" || item.href === "/mesajlar") && totalUnread > 0;
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
                <span className="relative inline-flex shrink-0">
                  <Icon className="h-5 w-5" />
                  {chatUnread && isCollapsed && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-0.5 text-[10px] font-bold leading-none text-white">
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </span>
                {!isCollapsed && (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span>{item.label}</span>
                    {chatUnread && (
                      <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold leading-none text-white">
                        {totalUnread > 99 ? "99+" : totalUnread}
                      </span>
                    )}
                  </span>
                )}
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
