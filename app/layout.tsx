import type { Metadata } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthGuard } from "@/components/AuthGuard";
import { AppLayout } from "@/components/AppLayout";
import { ToastProvider } from "@/components/ui/toast";
import { ModalsProvider } from "@/components/ui/modals";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Modern kurumsal dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning className={GeistSans.variable}>
      <body className="min-h-screen bg-slate-50 font-sans antialiased dark:bg-slate-950 dark:text-slate-100">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('dashboard-settings');if(s){try{var p=JSON.parse(s);var t=p.theme||'system';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',dark);if(p.language) document.documentElement.lang=p.language;}catch(e){}}})();`,
          }}
        />
        <AuthProvider>
        <ToastProvider>
        <ModalsProvider>
        <AuthGuard>
        {/* AuthGuard zaten branded splash gösteriyor; bu Suspense'in fallback'i
            ekrana flash yapmasın diye sade tutuluyor (route geçişlerinde devreye girer). */}
        <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" aria-hidden />}>
          <AppLayout>{children}</AppLayout>
        </Suspense>
        </AuthGuard>
        </ModalsProvider>
        </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
