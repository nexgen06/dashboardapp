"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bouncySpring,
  softSpring,
  smoothEase,
} from "@/components/motion/motionPresets";

/**
 * Branded splash — ilk login ve auth resolve sırasında gri ekran yerine.
 *
 * Üç katman:
 *   1. Animasyonlu monogram (logo placeholder — "P" harfli rozet)
 *   2. Marka adı + alt başlık
 *   3. Sıralı progress adımları (3 madde, otomatik tamamlanma)
 *   4. Opsiyonel hoşgeldiniz mesajı (first-login)
 *
 * Tasarım:
 *   - Glassmorphic backdrop + radial vignette
 *   - Reduced-motion: tüm animasyonlar bypass, statik render
 *   - Dark mode tam destek
 */

const STEPS = [
  { id: "connect", label: "Bağlanıyor", durationMs: 350 },
  { id: "realtime", label: "Realtime aktif", durationMs: 300 },
  { id: "data", label: "Veriler yükleniyor", durationMs: 400 },
] as const;

type SplashStepState = "pending" | "active" | "done";

type BrandSplashProps = {
  /** Görünür mü? false → AnimatePresence ile yumuşak çıkış */
  show: boolean;
  /** Üst sağ — first-login için "Hoşgeldin, Ahmet" */
  welcomeName?: string | null;
  /** Marka adı (varsayılan "Panel") */
  brandName?: string;
  /** Monogram harfi (varsayılan "P") */
  monogram?: string;
  /** Alt-başlık (varsayılan "Kurumsal Görev Paneli") */
  tagline?: string;
};

export function BrandSplash({
  show,
  welcomeName,
  brandName = "Panel",
  monogram,
  tagline = "Kurumsal Görev Paneli",
}: BrandSplashProps) {
  const reduced = useReducedMotion();
  const initial = useMemo(() => monogram ?? brandName.charAt(0).toLocaleUpperCase("tr"), [monogram, brandName]);
  // Adımların durumu — sıralı ilerler
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!show) return;
    if (stepIdx >= STEPS.length) return;
    const t = setTimeout(() => setStepIdx((i) => i + 1), STEPS[stepIdx].durationMs);
    return () => clearTimeout(t);
  }, [show, stepIdx]);

  // show=true her yeniden mount olduğunda baştan başla
  useEffect(() => {
    if (show) setStepIdx(0);
  }, [show]);

  const getStepState = (i: number): SplashStepState => {
    if (i < stepIdx) return "done";
    if (i === stepIdx) return "active";
    return "pending";
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
          className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
          aria-live="polite"
          aria-label="Uygulama yükleniyor"
        >
          {/* Radial vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.08),_transparent_60%)] dark:bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.15),_transparent_60%)]"
          />

          {/* İçerik */}
          <div className="relative flex flex-col items-center gap-6 px-6">
            {/* Monogram rozet — spring bounce + halo pulse */}
            <motion.div
              initial={reduced ? false : { scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={bouncySpring}
              className="relative"
            >
              {/* Halo pulse */}
              {!reduced && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl bg-indigo-400/40 dark:bg-indigo-500/40"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.45, 0, 0.45] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <div
                className={cn(
                  "relative flex h-20 w-20 items-center justify-center rounded-2xl",
                  "bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500",
                  "shadow-xl shadow-indigo-500/25"
                )}
              >
                <span className="text-3xl font-bold tracking-tight text-white">{initial}</span>
              </div>
            </motion.div>

            {/* Brand name + tagline */}
            <motion.div
              initial={reduced ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...softSpring, delay: reduced ? 0 : 0.1 }}
              className="text-center"
            >
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {brandName}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tagline}</p>
            </motion.div>

            {/* Welcome */}
            {welcomeName && (
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...smoothEase, delay: reduced ? 0 : 0.3 }}
                className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 backdrop-blur dark:bg-slate-800/80 dark:text-indigo-300 dark:ring-indigo-800"
              >
                Hoş geldin, {welcomeName}
              </motion.p>
            )}

            {/* Progress steps */}
            <motion.ul
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduced ? 0 : 0.2, duration: 0.3 }}
              className="mt-2 flex flex-col gap-2 text-sm"
              role="status"
            >
              {STEPS.map((s, i) => {
                const state = getStepState(i);
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2.5 transition-colors duration-300",
                      state === "pending" && "text-slate-400 dark:text-slate-600",
                      state === "active" && "text-slate-700 dark:text-slate-200",
                      state === "done" && "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {state === "done" ? (
                        <motion.span
                          initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={bouncySpring}
                          className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        </motion.span>
                      ) : state === "active" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" aria-hidden />
                      ) : (
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700"
                        />
                      )}
                    </span>
                    <span className="font-medium">
                      {s.label}
                      {state === "active" && <span className="ml-0.5 opacity-70">…</span>}
                    </span>
                  </li>
                );
              })}
            </motion.ul>
          </div>

          {/* Footer hint */}
          <motion.p
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: reduced ? 0 : 0.5, duration: 0.4 }}
            className="absolute bottom-6 text-xs text-slate-400 dark:text-slate-600"
          >
            © {new Date().getFullYear()} {brandName}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
