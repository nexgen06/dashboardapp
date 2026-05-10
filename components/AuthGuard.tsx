"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

/** Gerçek giriş açıksa (/giris) oturumu olmayanı yönlendirir */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded, isAuthEnabled } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAuthEnabled) return;
    if (user) return;
    if (pathname === "/giris") return;
    router.replace("/giris");
  }, [isLoaded, isAuthEnabled, user, pathname, router]);

  if (isLoaded && isAuthEnabled && !user && pathname !== "/giris") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Yönlendiriliyor…</p>
      </div>
    );
  }

  return <>{children}</>;
}
