"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Sparkles, X, Rocket, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useOnboardingChecklist, type OnboardingStep, type OnboardingStepId } from "@/hooks/useOnboardingChecklist";
import { cn } from "@/lib/utils";

/**
 * A6 Onboarding Checklist — Header'da görünen progress chip + açılır panel.
 *
 * Tasarım pattern: Linear / Vercel / Notion onboarding checklist.
 *   - Sağ üstte chip: "🚀 3/7" (progress göstergesi)
 *   - Tıklayınca açılır panel: tüm adımlar + CTA + tamamlanma işareti
 *   - Tamamlanma anında "🎉 Hazırsın!" kutlama state'i (auto-dismiss 7sn)
 *   - "Daha sonra hatırlat" → dismissed state
 *   - "Sıfırla" → tüm progress reset
 *
 * Auto-detect: ⌘K paleti açıldı → step:command-palette ✓ otomatik
 */
export function OnboardingChecklist() {
  const { user } = useAuth();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ch = useOnboardingChecklist({
    userId: user?.id ?? null,
    roleId: user?.roleId ?? null,
  });

  if (!user || !ch.hydrated) return null;
  if (ch.dismissed && !ch.isComplete) return null; // Kullanıcı kapattı + tamamlanmamış → gizle

  // Tüm adımlar tamam ve dismissed değil → kutlama chip; sonra otomatik gizlenir
  // (kullanıcı tekrar görmek isterse sidebar'dan veya rehberden tetikler)

  const triggerAction = (id: OnboardingStepId, action: OnboardingStep["action"]) => {
    ch.markComplete(id);
    setOpen(false);
    if (action.kind === "navigate") {
      router.push(action.href);
    } else {
      window.dispatchEvent(new Event(action.eventName));
    }
  };

  return (
    <div className="relative inline-flex">
      {/* Header chip */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors",
          ch.isComplete
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
        )}
        title={ch.isComplete ? "Tüm adımlar tamam! 🎉" : "Başlangıç adımları"}
        aria-expanded={open}
      >
        {ch.isComplete ? <Sparkles className="h-3.5 w-3.5" /> : <Rocket className="h-3.5 w-3.5" />}
        <span className="tabular-nums">
          {ch.completedCount}/{ch.totalCount}
        </span>
        {!ch.isComplete && (
          <span className="hidden sm:inline">başlangıç</span>
        )}
      </button>

      {/* Açılır panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop (click-outside) */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={reduced ? false : { opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute right-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
              role="dialog"
              aria-label="Başlangıç adımları"
            >
              {/* Header */}
              <div className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 px-4 py-3 dark:border-slate-700 dark:from-indigo-950/40 dark:to-violet-950/40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {ch.isComplete ? (
                        <>
                          <Sparkles className="h-4 w-4 text-emerald-500" />
                          Hazırsın! 🎉
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4 text-indigo-500" />
                          Hızlı başlangıç
                        </>
                      )}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {ch.isComplete
                        ? "Tüm adımları tamamladın. İyi çalışmalar!"
                        : `${ch.completedCount}/${ch.totalCount} adım tamamlandı`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded p-1 text-slate-400 hover:bg-white/40 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    aria-label="Kapat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60 dark:bg-slate-900/40">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      ch.isComplete ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
                    )}
                    initial={false}
                    animate={{ width: `${Math.round(ch.progress * 100)}%` }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                </div>
              </div>

              {/* Adımlar */}
              <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                {ch.steps.map((step) => {
                  const isDone = ch.isCompleted(step.id);
                  const Icon = step.icon;
                  return (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => triggerAction(step.id, step.action)}
                        className={cn(
                          "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          isDone
                            ? "opacity-60 hover:opacity-80"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                        )}
                      >
                        {/* Check / icon */}
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                            isDone
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:bg-slate-700 dark:text-slate-400 dark:group-hover:bg-indigo-900/40 dark:group-hover:text-indigo-300"
                          )}
                        >
                          {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Icon className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-sm font-semibold",
                              isDone
                                ? "text-slate-500 line-through dark:text-slate-500"
                                : "text-slate-800 dark:text-slate-100"
                            )}
                          >
                            {step.title}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {step.description}
                          </span>
                        </span>
                        {!isDone && (
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500"
                            aria-hidden
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/30">
                <button
                  type="button"
                  onClick={ch.reset}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  title="Tüm adımları sıfırla"
                >
                  <RotateCcw className="h-3 w-3" />
                  Sıfırla
                </button>
                {!ch.isComplete && (
                  <button
                    type="button"
                    onClick={() => {
                      ch.dismiss();
                      setOpen(false);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Daha sonra hatırlat
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

