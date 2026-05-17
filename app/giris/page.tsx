"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Mode = "signin" | "forgot" | "forgot-sent";

export default function GirisPage() {
  const { user, isLoaded, isAuthEnabled } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
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

  if (!isAuthEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-full max-w-md rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-amber-600 dark:text-amber-400 mb-3" />
          <p className="text-slate-800 dark:text-slate-200 font-medium">Supabase yapılandırılmamış</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Gerçek giriş için{" "}
            <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> ve{" "}
            <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            değerlerini <code className="text-xs bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env.local</code>
            içine ekleyin. Profil rolleri için <code className="text-xs">scripts/supabase-auth-profiles.sql</code> şemasını
            çalıştırın.
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
      const mail = email.trim();
      const pass = password;
      const { error: sbErr } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
      if (sbErr) throw sbErr;
    } catch (err: unknown) {
      console.error("[Giriş] Hata:", err);
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === "object" &&
              err !== null &&
              "message" in err &&
              typeof (err as { message: unknown }).message === "string"
            ? String((err as { message: string }).message)
            : "";
      const lc = raw.toLowerCase();
      if (
        /invalid\s+login\s+credentials/i.test(raw) ||
        lc.includes("invalid_credentials") ||
        lc.includes("invalid login") ||
        raw.includes("invalid-credential") ||
        raw.includes("wrong-password") ||
        raw.includes("Invalid login credentials")
      ) {
        setError(
          "Bu e-posta veya şifre kabul edilmedi. Hesabınızın Supabase → Authentication → Users içinde oluşturulmuş olması ve Email sağlayıcısının açık olması gerekir."
        );
      } else if (raw.includes("too-many-requests") || raw.includes("Too many requests")) {
        setError("Çok fazla deneme. Lütfen daha sonra tekrar deneyin.");
      } else {
        setError(raw || "Giriş başarısız");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const mail = email.trim();
      if (!mail) {
        setError("E-posta adresini girin.");
        return;
      }
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/sifre-sifirla`
          : undefined;
      const { error: sbErr } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo,
      });
      if (sbErr) throw sbErr;
      setMode("forgot-sent");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.toLowerCase().includes("too many")) {
        setError("Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.");
      } else {
        // Güvenlik için: yanlış e-posta girilse bile başarılı gibi davran (enumeration koruması)
        setMode("forgot-sent");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 p-8">
          {mode === "signin" && (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Giriş yap</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{`Dashboard'a erişmek için giriş yapın`}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Şifre
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setPassword("");
                        setMode("forgot");
                      }}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Şifremi unuttum
                    </button>
                  </div>
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
                <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Giriş yapılıyor...
                    </>
                  ) : (
                    "Giriş yap"
                  )}
                </Button>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Hesabınız yok mu? Yöneticinizle iletişime geçin — bu sistem davet bazlıdır.
                </p>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setMode("signin");
                }}
                className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-3 w-3" />
                Girişe dön
              </button>
              <div className="mb-6 text-center">
                <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                  <KeyRound className="h-6 w-6" />
                </span>
                <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Şifremi unuttum</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  E-postanı gir; şifreni sıfırlayacağın bir bağlantı göndereceğiz.
                </p>
              </div>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    E-posta
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@email.com"
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gönderiliyor…
                    </>
                  ) : (
                    "Sıfırlama bağlantısı gönder"
                  )}
                </Button>
              </form>
            </>
          )}

          {mode === "forgot-sent" && (
            <div className="text-center">
              <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Bağlantı gönderildi</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Eğer <strong className="break-all">{email}</strong> sistemde kayıtlıysa, az önce şifre sıfırlama bağlantısı içeren
                bir e-posta gönderdik. Gelen kutunu ve spam klasörünü kontrol et.
              </p>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Bağlantı 1 saat geçerli. Gelmezse birkaç dakika bekleyip tekrar dene.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setMode("signin");
                }}
                className="mt-5 w-full"
              >
                Girişe dön
              </Button>
            </div>
          )}
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
