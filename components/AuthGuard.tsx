"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

/** Gerçek giriş açıksa (/giris) oturumu olmayanı yönlendirir */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded, isAuthEnabled } = useAuth();

  // Şifre sıfırlama sayfası recovery token ile gelir; AuthGuard buraya karışmamalı.
  const isPublicAuthPath = pathname === "/giris" || pathname === "/sifre-sifirla";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAuthEnabled) return;
    if (user) return;
    if (isPublicAuthPath) return;
    router.replace("/giris");
  }, [isLoaded, isAuthEnabled, user, isPublicAuthPath, router]);

  if (isLoaded && isAuthEnabled && !user && !isPublicAuthPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Yönlendiriliyor…</p>
      </div>
    );
  }

  return <>{children}</>;
}
