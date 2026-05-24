"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useCallback } from "react";
import { User, Settings, LogOut, LogIn, Shield, Copy, Check, Search, UserCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useNotifications } from "@/contexts/notification-context";
import { NotificationBell } from "@/components/NotificationBell";
import { openCommandPalette } from "@/components/CommandPalette";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfileLookup } from "@/contexts/profile-lookup-context";
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
  if (pathname === "/yonetim/kurumsal-admin") return "Kurumsal admin";
  if (pathname === "/yonetim/kullanici-yetkileri") return "Kullanıcı yetkileri";
  if (pathname === "/yonetim/gorev-istatistikleri") return "Görev istatistikleri";
  if (pathname.startsWith("/yonetim")) return "Yönetim";
  if (pathname === "/projeler") return "Projeler";
  if (pathname.startsWith("/projeler/")) return "Proje detay";
  if (pathname === "/gorevlerim") return "Görevlerim";
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
  const notificationSummary = useNotifications();
  const [emailCopied, setEmailCopied] = useState(false);

  const profileLookup = useProfileLookup();
  const myProfile = profileLookup.byEmail(user?.email);
  const myAvatarUrl = myProfile.avatarUrl;
  const displayName = myProfile.nickname || user?.displayName || user?.email || "Kullanıcı";
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
        {user && (
          <Button
            data-tour="command-palette"
            variant="ghost"
            size="sm"
            onClick={openCommandPalette}
            className="hidden h-9 gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 sm:inline-flex"
            aria-label="Komut paletini aç"
            title="Komut paleti (⌘K / Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="text-xs">Ara veya komut…</span>
            <kbd className="ml-2 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              ⌘K
            </kbd>
          </Button>
        )}
        {user && (
          <Button
            variant="ghost"
            size="icon"
            onClick={openCommandPalette}
            className="h-9 w-9 sm:hidden"
            aria-label="Komut paletini aç"
          >
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        )}
        {user && (
          <span data-tour="notifications" className="inline-flex">
            <NotificationBell summary={notificationSummary} />
          </span>
        )}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="group relative h-11 max-w-full gap-2 rounded-full border border-transparent px-2 pr-2.5 text-slate-600 transition-all hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:border-emerald-800/70 dark:hover:bg-emerald-950/30 dark:hover:text-slate-100"
                aria-label="Hesap menüsü"
                aria-haspopup="menu"
              >
                <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-full bg-emerald-400/25 blur-[2px] animate-[pulse_2.6s_ease-in-out_infinite] dark:bg-emerald-300/20"
                    aria-hidden
                  />
                  <span
                    className="absolute inset-0 rounded-full border border-emerald-300/70 shadow-[0_0_14px_rgba(16,185,129,0.32)] transition-all group-hover:scale-105 group-hover:border-cyan-300 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.38)] dark:border-emerald-500/60 dark:shadow-[0_0_16px_rgba(52,211,153,0.22)]"
                    aria-hidden
                  />
                  <Avatar className="relative h-9 w-9 shrink-0 border-2 border-white shadow-sm ring-1 ring-emerald-200 dark:border-slate-800 dark:ring-emerald-700/70">
                    {myAvatarUrl && <AvatarImage src={myAvatarUrl} alt={displayName} />}
                    <AvatarFallback className={cn("text-xs font-semibold", accentClass)}>{userInitials}</AvatarFallback>
                  </Avatar>
                  <span
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)] dark:border-slate-800"
                    aria-hidden
                  />
                </span>
                <div className="hidden min-w-0 flex-col items-start text-left sm:flex">
                  <span className="max-w-[10rem] truncate text-sm font-medium lg:max-w-[14rem]">{displayName}</span>
                  <span className="max-w-[10rem] truncate text-[11px] font-medium text-emerald-700 dark:text-emerald-300 lg:max-w-[14rem]">
                    {roleLabel}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex gap-3 border-b border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/45">
                  <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-slate-600">
                    {myAvatarUrl && <AvatarImage src={myAvatarUrl} alt={displayName} />}
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
                <Link href="/profil">
                  <UserCircle2 className="mr-2 h-4 w-4" />
                  Profilim
                </Link>
              </DropdownMenuItem>
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
