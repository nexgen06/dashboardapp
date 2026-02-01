import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthGuard } from "@/components/AuthGuard";
import { AppLayout } from "@/components/AppLayout";
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
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 font-sans antialiased dark:bg-slate-900 dark:text-slate-100">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('dashboard-settings');if(s){try{var p=JSON.parse(s);var t=p.theme||'system';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',dark);if(p.language) document.documentElement.lang=p.language;}catch(e){}}})();`,
          }}
        />
        <AuthProvider>
        <AuthGuard>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Yükleniyor…</div>}>
          <AppLayout>{children}</AppLayout>
        </Suspense>
        </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
