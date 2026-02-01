"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import Link from "next/link";

export default function GirisPage() {
  const { user, isLoaded, isFirebaseEnabled } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      router.replace("/");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isFirebaseEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-3" />
          <p className="text-slate-800 dark:text-slate-200 font-medium">Firebase yapılandırılmamış</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Giriş sayfası Firebase Auth gerektirir. <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env.local</code> içinde Firebase değişkenlerini tanımlayın.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase Auth başlatılamadı");
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Yönlendirme useEffect ile yapılır (user set olduktan sonra Dashboard’a)
    } catch (err: unknown) {
      console.error("[Giriş] Hata:", err);
      const msg = err instanceof Error ? err.message : "Giriş başarısız";
      if (msg.includes("invalid-credential") || msg.includes("user-not-found") || msg.includes("wrong-password")) {
        setError("E-posta veya şifre hatalı.");
      } else if (msg.includes("too-many-requests")) {
        setError("Çok fazla deneme. Lütfen daha sonra tekrar deneyin.");
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Giriş yap</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Dashboard'a erişmek için giriş yapın
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                E-posta
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                "Giriş yap"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Firebase Authentication kullanılıyor
            </p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
              Ana sayfaya dön
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
