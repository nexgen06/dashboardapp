"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { User, Settings, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useNotificationSummary } from "@/hooks/useNotificationSummary";
import { NotificationBell } from "@/components/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getPageTitle(pathname: string, tab: string | null): string {
  if (pathname === "/giris") return "Giriş";
  if (pathname === "/ayarlar") return "Ayarlar";
  if (pathname === "/yonetim/kullanici-yetkileri") return "Kullanıcı yetkileri";
  if (pathname.startsWith("/yonetim")) return "Yönetim";
  if (pathname === "/projeler") return "Projeler";
  if (pathname.startsWith("/projeler/")) return "Proje detay";
  if (pathname === "/canli-tablo") return "Canlı Tablo";
  return "Dashboard";
}

export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? null;
  const pageTitle = getPageTitle(pathname, tab);
  const { user, isFirebaseEnabled, signOut } = useAuth();
  const notificationSummary = useNotificationSummary(user?.email ?? null);

  const displayName = user?.displayName || user?.email || "Kullanıcı";
  const userEmail = user?.email || "";
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "KU";

  const isDemoUser = user?.id === "demo";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-lg font-semibold text-slate-800 truncate dark:text-slate-100">
          {pageTitle}
        </h1>
        {isDemoUser && (
          <Badge variant="secondary" className="shrink-0 text-xs font-normal">
            Demo mod
          </Badge>
        )}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 ml-4">
        {/* Bildirimler (giriş yapmış kullanıcı) */}
        {user && <NotificationBell summary={notificationSummary} />}
        {/* Kullanıcı profili veya Giriş yap */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 gap-2 rounded-full px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Hesap menüsü"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt={displayName} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm dark:bg-blue-900/40 dark:text-blue-300">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline-block">
                  {displayName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{displayName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link href="/yonetim/kullanici-yetkileri">
                  <User className="mr-2 h-4 w-4" />
                  Profil / Yetki
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link href="/ayarlar">
                  <Settings className="mr-2 h-4 w-4" />
                  Ayarlar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-slate-600 focus:text-red-600 dark:text-slate-400" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : isFirebaseEnabled ? (
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            <Link href="/giris">
              <LogIn className="mr-2 h-4 w-4" />
              Giriş yap
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
