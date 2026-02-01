"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

/** Firebase açıkken giriş yapmamış kullanıcıyı /giris'e yönlendirir. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded, isFirebaseEnabled } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isFirebaseEnabled) return;
    if (user) return;
    if (pathname === "/giris") return;
    router.replace("/giris");
  }, [isLoaded, isFirebaseEnabled, user, pathname, router]);

  if (isLoaded && isFirebaseEnabled && !user && pathname !== "/giris") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Yönlendiriliyor…</p>
      </div>
    );
  }

  return <>{children}</>;
}
