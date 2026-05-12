"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useCallback } from "react";
import { User, Settings, LogOut, LogIn, Shield, Copy, Check } from "lucide-react";
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
import { ROLES } from "@/types/permissions";
import { cn } from "@/lib/utils";
import { userInitialsFromDisplay } from "@/lib/userDisplayName";

function getPageTitle(pathname: string): string {
  if (pathname === "/giris") return "Giriş";
  if (pathname === "/ayarlar") return "Ayarlar";
  if (pathname === "/yonetim/kullanici-yetkileri") return "Kullanıcı yetkileri";
  if (pathname === "/yonetim/gorev-istatistikleri") return "Görev istatistikleri";
  if (pathname.startsWith("/yonetim")) return "Yönetim";
  if (pathname === "/projeler") return "Projeler";
  if (pathname.startsWith("/projeler/")) return "Proje detay";
  if (pathname === "/canli-tablo") return "Canlı Tablo";
  return "Dashboard";
}

const AVATAR_ACCENT = [
  "bg-violet-100 text-violet-800 dark:bg-violet-900/45 dark:text-violet-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-sky-100 text-sky-900 dark:bg-sky-900/45 dark:text-sky-200",
  "bg-rose-100 text-rose-900 dark:bg-rose-900/45 dark:text-rose-200",
  "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/45 dark:text-indigo-200",
] as const;

function avatarAccentClass(email: string): string {
  let n = 0;
  for (let i = 0; i < email.length; i++) n += email.charCodeAt(i);
  return AVATAR_ACCENT[n % AVATAR_ACCENT.length] ?? AVATAR_ACCENT[0];
}

export function Header() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const { user, isAuthEnabled, signOut, hasPermission } = useAuth();
  const showUserManagementNav = hasPermission("area.userManagement");
  const notificationSummary = useNotificationSummary();
  const [emailCopied, setEmailCopied] = useState(false);

  const displayName = user?.displayName || user?.email || "Kullanıcı";
  const userEmail = user?.email || "";
  const userInitials = userInitialsFromDisplay(displayName, userEmail);
  const roleLabel = user ? ROLES[user.roleId]?.name ?? user.roleId : "";
  const accentClass = userEmail ? avatarAccentClass(userEmail) : AVATAR_ACCENT[0];

  const copyEmail = useCallback(async () => {
    if (!userEmail || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(userEmail);
      setEmailCopied(true);
      window.setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      /* yok say */
    }
  }, [userEmail]);

  const isDemoUser = user?.id === "demo";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-lg font-semibold text-slate-800 dark:text-slate-100">{pageTitle}</h1>
        {isDemoUser && (
          <Badge variant="secondary" className="shrink-0 text-xs font-normal">
            Demo mod
          </Badge>
        )}
      </div>

      <div className="ml-4 flex flex-1 items-center justify-end gap-2">
        {user && <NotificationBell summary={notificationSummary} />}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 max-w-full gap-2 rounded-full px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="Hesap menüsü"
                aria-haspopup="menu"
              >
                <Avatar className="h-8 w-8 shrink-0 border border-slate-200 dark:border-slate-600">
                  <AvatarImage src="" alt="" />
                  <AvatarFallback className={cn("text-xs font-semibold", accentClass)}>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 flex-col items-start text-left sm:flex">
                  <span className="max-w-[10rem] truncate text-sm font-medium lg:max-w-[14rem]">{displayName}</span>
                  {userEmail && displayName.trim().toLowerCase() !== userEmail.toLowerCase() && (
                    <span className="max-w-[10rem] truncate text-xs text-slate-500 dark:text-slate-400 lg:max-w-[14rem]">
                      {userEmail}
                    </span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex gap-3 border-b border-slate-100 p-3 dark:border-slate-700">
                  <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-slate-600">
                    <AvatarImage src="" alt="" />
                    <AvatarFallback className={cn("text-sm font-semibold", accentClass)}>{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName}</p>
                    <p className="mt-0.5 break-all text-xs leading-snug text-slate-500 dark:text-slate-400">{userEmail}</p>
                    <Badge variant="secondary" className="mt-2 text-[10px] font-medium">
                      {roleLabel}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => void copyEmail()} disabled={!userEmail}>
                {emailCopied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-emerald-600" />
                    E-posta kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    E-postayı kopyala
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link href="/yonetim/kullanici-yetkileri">
                  {showUserManagementNav ? (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Kullanıcı yetkileri
                    </>
                  ) : (
                    <>
                      <User className="mr-2 h-4 w-4" />
                      Rolüm ve yetkiler
                    </>
                  )}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" asChild>
                <Link href="/ayarlar">
                  <Settings className="mr-2 h-4 w-4" />
                  Ayarlar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-slate-600 focus:text-red-600 dark:text-slate-400"
                onClick={signOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : isAuthEnabled ? (
          <Button asChild size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
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
