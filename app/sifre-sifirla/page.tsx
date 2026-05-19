"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, CheckCircle2, AlertCircle, Check, X } from "lucide-react";
import {
  evaluatePassword,
  PASSWORD_POLICY,
  passwordStrengthColor,
  passwordStrengthLabel,
} from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

/**
 * Şifre sıfırlama callback sayfası.
 *
 * Akış: Kullanıcı /giris → "Şifremi unuttum" → e-posta gönder →
 * gelen kutudaki bağlantı → bu sayfa → Supabase recovery session'ı
 * URL fragment'ından otomatik kurar (detectSessionInUrl=true) →
 * kullanıcı yeni şifre belirler → updateUser({ password }).
 */
export default function SifreSifirlaPage() {
  const router = useRouter();
  const [stage, setStage] = useState<"checking" | "form" | "success" | "error">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Supabase yapılandırılmamış — bu sayfa çalışamaz.");
      setStage("error");
      return;
    }
    // Supabase client `detectSessionInUrl` ile recovery token'ı otomatik işler.
    // Yine de session var mı kontrol et — yoksa kullanıcı doğrudan link açmış.
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setStage("form");
      } else {
        // Bazen Supabase fragment'ı işleme alana kadar 1-2 sn sürer; dinleyici ekle.
        const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
            setStage("form");
          }
        });
        // Fallback: 4 sn'de session gelmediyse hata göster
        const timer = window.setTimeout(() => {
          if (!active) return;
          // Tekrar kontrol et
          void supabase.auth.getSession().then(({ data: d2 }) => {
            if (!active) return;
            if (d2.session) setStage("form");
            else {
              setError(
                "Sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen tekrar şifremi unuttum akışını başlatın."
              );
              setStage("error");
            }
          });
        }, 4000);
        return () => {
          subscription.subscription.unsubscribe();
          window.clearTimeout(timer);
        };
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const evaluation = useMemo(() => evaluatePassword(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!evaluation.valid) {
      setError(evaluation.firstFailureMessage ?? "Şifre politikayı karşılamıyor.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: sbErr } = await supabase.auth.updateUser({ password });
      if (sbErr) throw sbErr;
      setStage("success");
      // 3 sn sonra otomatik dashboard'a yönlendir
      window.setTimeout(() => router.push("/"), 3000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(raw || "Şifre güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {stage === "checking" && (
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Sıfırlama bağlantısı doğrulanıyor…
              </p>
            </div>
          )}

          {stage === "form" && (
            <>
              <div className="mb-6 text-center">
                <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                  <KeyRound className="h-6 w-6" />
                </span>
                <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Yeni şifre belirle</h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Güvenli bir şifre seç — büyük/küçük harf, rakam içermeli.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Yeni şifre
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={PASSWORD_POLICY.minLength}
                    autoComplete="new-password"
                    autoFocus
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  {/* Strength meter + checks — sadece kullanıcı yazmaya başladıysa */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {/* 4 bar — score 0..4 */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-1 gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1.5 flex-1 rounded-full transition-colors",
                                i <= evaluation.score
                                  ? passwordStrengthColor(evaluation.score)
                                  : "bg-slate-200 dark:bg-slate-700"
                              )}
                            />
                          ))}
                        </div>
                        <span
                          className={cn(
                            "min-w-[64px] shrink-0 text-right text-[11px] font-semibold",
                            evaluation.score >= 3
                              ? "text-emerald-600 dark:text-emerald-400"
                              : evaluation.score === 2
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {passwordStrengthLabel(evaluation.score)}
                        </span>
                      </div>
                      {/* Checks listesi */}
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                        <RuleItem ok={evaluation.checks.length} label={`En az ${PASSWORD_POLICY.minLength} karakter`} />
                        <RuleItem ok={evaluation.checks.upper} label="Büyük harf (A-Z)" />
                        <RuleItem ok={evaluation.checks.lower} label="Küçük harf (a-z)" />
                        <RuleItem ok={evaluation.checks.digit} label="Rakam (0-9)" />
                        <RuleItem ok={evaluation.checks.notCommon} label="Yaygın şifre değil" />
                        <RuleItem
                          ok={evaluation.checks.special}
                          label="Özel karakter (öneri)"
                          optional
                        />
                      </ul>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Yeni şifre (tekrar)
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={PASSWORD_POLICY.minLength}
                    autoComplete="new-password"
                    className={cn(
                      "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-700 dark:text-slate-100",
                      confirm.length > 0 && confirm !== password
                        ? "border-red-300 dark:border-red-700"
                        : "border-slate-300 dark:border-slate-600"
                    )}
                  />
                  {confirm.length > 0 && confirm !== password && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                      Şifreler eşleşmiyor
                    </p>
                  )}
                </div>
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting || !evaluation.valid || password !== confirm}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Kaydediliyor…
                    </>
                  ) : (
                    "Şifreyi güncelle"
                  )}
                </Button>
              </form>
            </>
          )}

          {stage === "success" && (
            <div className="text-center">
              <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Şifre güncellendi</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Artık yeni şifrenle giriş yapabilirsin. Birkaç saniye içinde dashboard&apos;a yönlendirileceksin.
              </p>
              <Button type="button" asChild className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white">
                <Link href="/">Şimdi git</Link>
              </Button>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center">
              <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                <AlertCircle className="h-7 w-7" />
              </span>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Bağlantı geçersiz</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {error ?? "Sıfırlama bağlantısı doğrulanamadı."}
              </p>
              <Button type="button" asChild variant="outline" className="mt-5 w-full">
                <Link href="/giris">Girişe dön</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tek satır kural göstergesi — ✓ veya ✗ icon + etiket. */
function RuleItem({ ok, label, optional = false }: { ok: boolean; label: string; optional?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5",
        ok
          ? "text-emerald-600 dark:text-emerald-400"
          : optional
            ? "text-slate-400 dark:text-slate-500"
            : "text-slate-500 dark:text-slate-400"
      )}
    >
      {ok ? (
        <Check className="h-3 w-3 shrink-0" aria-hidden />
      ) : (
        <X className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
      )}
      <span>{label}</span>
    </li>
  );
}
