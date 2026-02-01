"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ApplySettings } from "@/components/ApplySettings";

/** Giriş sayfasında sidebar/header göstermez; diğer sayfalarda tam panel layout. */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/giris";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <SettingsProvider>
        <ApplySettings />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <Header />
            <main className="flex flex-1 flex-col min-h-0 bg-white p-6 dark:bg-slate-900">
              <Suspense fallback={<div className="text-slate-500 p-4">Yükleniyor...</div>}>
                {children}
              </Suspense>
            </main>
          </div>
        </div>
      </SettingsProvider>
    </SidebarProvider>
  );
}
