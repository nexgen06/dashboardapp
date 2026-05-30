"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { BrandSplash } from "@/components/BrandSplash";

/**
 * Gerçek giriş açıksa (/giris) oturumu olmayanı yönlendirir.
 *
 * Aynı zamanda branded splash'i orchestrate eder:
 *   - Auth resolve olana kadar (isLoaded=false) splash görünür
 *   - Yönlendirme sırasında splash görünür
 *   - Authenticated kullanıcı için min. süre kadar tut (brand moment hissedilsin)
 *   - First-login'de welcome chip
 */
const SPLASH_MIN_VISIBLE_MS = 900; // brand moment'in net hissedilmesi için alt sınır
const FIRST_LOGIN_KEY = "panel.firstLoginShown.v1";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded, isAuthEnabled } = useAuth();

  // Şifre sıfırlama sayfası recovery token ile gelir; AuthGuard buraya karışmamalı.
  const isPublicAuthPath = pathname === "/giris" || pathname === "/sifre-sifirla";

  const [splashGate, setSplashGate] = useState(true);
  const splashStartRef = useRef<number>(Date.now());
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAuthEnabled) return;
    if (user) return;
    if (isPublicAuthPath) return;
    router.replace("/giris");
  }, [isLoaded, isAuthEnabled, user, isPublicAuthPath, router]);

  // First-login welcome detection — kullanıcı bazlı tek seferlik
  useEffect(() => {
    if (!isLoaded || !user || isPublicAuthPath) return;
    try {
      const sessionKey = `${FIRST_LOGIN_KEY}:${user.id}`;
      const sessionSeen = window.localStorage.getItem(sessionKey);
      if (!sessionSeen) {
        const raw = (user.displayName || user.email || "").split(/[\s@]/)[0];
        if (raw) {
          setWelcomeName(raw.charAt(0).toLocaleUpperCase("tr") + raw.slice(1));
        }
        window.localStorage.setItem(sessionKey, "1");
      }
    } catch {
      /* localStorage erişilemiyor — sessizce geç */
    }
  }, [isLoaded, user, isPublicAuthPath]);

  // Splash'i en az SPLASH_MIN_VISIBLE_MS göster — sonra yumuşakça kapat
  useEffect(() => {
    if (!isLoaded) return;
    // Yönlendirme bekleniyorsa splash kalsın
    const stillNeeded = isAuthEnabled && !user && !isPublicAuthPath;
    if (stillNeeded) {
      setSplashGate(true);
      return;
    }
    const elapsed = Date.now() - splashStartRef.current;
    const remaining = Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed);
    const t = setTimeout(() => setSplashGate(false), remaining);
    return () => clearTimeout(t);
  }, [isLoaded, isAuthEnabled, user, isPublicAuthPath]);

  // Giriş ve şifre sıfırlama sayfalarında splash hiç gösterme
  const showSplash = !isPublicAuthPath && splashGate;

  return (
    <>
      <BrandSplash show={showSplash} welcomeName={welcomeName} />
      {children}
    </>
  );
}
