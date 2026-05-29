"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { ProjectsProvider } from "@/contexts/projects-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MobileFAB } from "@/components/layout/MobileFAB";
import { Header } from "@/components/layout/Header";
import { ApplySettings } from "@/components/ApplySettings";
import { CommandPalette } from "@/components/CommandPalette";
import { OnboardingTour } from "@/components/OnboardingTour";
import { KeyboardShortcutsHUD } from "@/components/KeyboardShortcutsHUD";
import { ProjectChatUnreadProvider } from "@/contexts/project-chat-unread-context";
import { ProfileLookupProvider } from "@/contexts/profile-lookup-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { SessionHeartbeat } from "@/components/SessionHeartbeat";

/** Giriş sayfasında sidebar/header göstermez; diğer sayfalarda tam panel layout. */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicAuthPage = pathname === "/giris" || pathname === "/sifre-sifirla";

  if (isPublicAuthPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <SettingsProvider>
        <ProjectsProvider>
        <ProfileLookupProvider>
        <ProjectChatUnreadProvider>
        <NotificationProvider>
          <ApplySettings />
          <SessionHeartbeat />
          <CommandPalette />
          <KeyboardShortcutsHUD />
          <OnboardingTour />
          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Sidebar masaüstünde (md+); mobilde MobileBottomNav görünür */}
            <div className="hidden md:flex">
              <Sidebar />
            </div>
            <div className="flex flex-1 flex-col min-w-0">
              <Header />
              <main className="flex flex-1 flex-col min-h-0 bg-slate-50 p-4 sm:p-6 dark:bg-slate-950 pb-20 md:pb-6">
                <Suspense fallback={<div className="text-slate-500 p-4">Yükleniyor...</div>}>
                  {children}
                </Suspense>
              </main>
            </div>
          </div>
          <MobileBottomNav />
          <MobileFAB />
        </NotificationProvider>
        </ProjectChatUnreadProvider>
        </ProfileLookupProvider>
        </ProjectsProvider>
      </SettingsProvider>
    </SidebarProvider>
  );
}
