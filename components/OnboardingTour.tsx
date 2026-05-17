"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dashboardapp.onboarding.completed.v1";

type Placement = "top" | "right" | "bottom" | "left";

type TourStep = {
  title: string;
  body: string;
  /** Hedef element CSS selector — `data-tour="X"` ile işaretle. Yoksa modal ekranda merkezde gösterilir. */
  targetSelector?: string;
  placement?: Placement;
};

const STEPS: TourStep[] = [
  {
    title: "Hoş geldin! 👋",
    body:
      "Bu kısa tur ile temel özellikleri 30 saniyede keşfet. İstediğin zaman atla butonuyla çıkabilir, ayarlardan tekrar başlatabilirsin.",
  },
  {
    title: "Sol menü ile gezin",
    body:
      "Dashboard, Projeler, Canlı Tablo, Mesajlar — tüm sayfalara buradan ulaşırsın. İkonların üzerine geldiğinde isimleri görünür.",
    targetSelector: '[data-tour="sidebar"]',
    placement: "right",
  },
  {
    title: "Komut paleti",
    body:
      "⌘K (Mac) veya Ctrl+K (Win) ile her yere hızlı atla, eylem çalıştır, tema değiştir. Power user'lar için en hızlı yol.",
    targetSelector: '[data-tour="command-palette"]',
    placement: "bottom",
  },
  {
    title: "Bildirim merkezi",
    body:
      "Sana atanan projeler, yeni görevler, gecikmiş işler ve proje sohbetlerinden yeni mesajlar burada toplanır. Hepsini tek tıkla okundu işaretle.",
    targetSelector: '[data-tour="notifications"]',
    placement: "bottom",
  },
  {
    title: "Hazırsın! ✨",
    body:
      "İyi çalışmalar. Detaylı yardım için herhangi bir sayfada ⌘K ile komut paletini açabilirsin.",
  },
];

function loadCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function saveCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Diğer bileşenler / Ayarlar sayfasından turu yeniden başlatmak için yardımcı.
 */
export function resetOnboardingTour() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("onboarding:restart"));
  }
}

export function OnboardingTour() {
  const { user, isLoaded } = useAuth();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  /** İlk girişte otomatik başlat (auth yüklü + kullanıcı var + flag yok) */
  useEffect(() => {
    if (!isLoaded || !user) return;
    if (loadCompleted()) return;
    const id = window.setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(id);
  }, [isLoaded, user]);

  /** Manuel yeniden başlat eventi */
  useEffect(() => {
    const handler = () => {
      setStepIdx(0);
      setOpen(true);
    };
    window.addEventListener("onboarding:restart", handler);
    return () => window.removeEventListener("onboarding:restart", handler);
  }, []);

  /** Viewport boyutu — SVG mask için */
  useEffect(() => {
    if (!open) return;
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  /** Hedef element pozisyonu — adım değişimi, resize, scroll'a duyarlı */
  useEffect(() => {
    if (!open) return;
    const step = STEPS[stepIdx];
    if (!step?.targetSelector) {
      setTargetRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(step.targetSelector!);
      if (el) setTargetRect(el.getBoundingClientRect());
      else setTargetRect(null);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, stepIdx]);

  /** Esc ile kapat */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIdx]);

  const dismiss = useCallback(() => {
    saveCompleted();
    setOpen(false);
  }, []);

  const next = useCallback(() => {
    setStepIdx((i) => {
      if (i >= STEPS.length - 1) {
        saveCompleted();
        setOpen(false);
        return i;
      }
      return i + 1;
    });
  }, []);

  const prev = useCallback(() => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  if (!open) return null;

  const step = STEPS[stepIdx];
  const isCentered = !step.targetSelector || !targetRect;
  const padding = 6;
  const spotlight =
    targetRect && !isCentered
      ? {
          x: targetRect.left - padding,
          y: targetRect.top - padding,
          w: targetRect.width + padding * 2,
          h: targetRect.height + padding * 2,
        }
      : null;

  // Popover konumu
  let popoverStyle: React.CSSProperties = {
    maxWidth: "calc(100vw - 32px)",
  };
  if (isCentered) {
    popoverStyle = {
      ...popoverStyle,
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  } else if (targetRect) {
    const placement: Placement = step.placement ?? "bottom";
    const gap = 12;
    switch (placement) {
      case "right":
        popoverStyle = {
          ...popoverStyle,
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + gap,
          transform: "translateY(-50%)",
        };
        break;
      case "left":
        popoverStyle = {
          ...popoverStyle,
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left - gap,
          transform: "translate(-100%, -50%)",
        };
        break;
      case "top":
        popoverStyle = {
          ...popoverStyle,
          top: targetRect.top - gap,
          left: targetRect.left + targetRect.width / 2,
          transform: "translate(-50%, -100%)",
        };
        break;
      default:
        popoverStyle = {
          ...popoverStyle,
          top: targetRect.bottom + gap,
          left: targetRect.left + targetRect.width / 2,
          transform: "translateX(-50%)",
        };
    }
  }

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Onboarding turu">
      {/* SVG spotlight backdrop — hedef element üzerine cutout */}
      <svg
        width={viewport.w}
        height={viewport.h}
        className="fixed inset-0 cursor-pointer"
        onClick={dismiss}
        aria-hidden
      >
        <defs>
          <mask id="onboarding-cutout">
            <rect x={0} y={0} width={viewport.w} height={viewport.h} fill="white" />
            {spotlight && (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.w}
                height={spotlight.h}
                rx={8}
                ry={8}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={viewport.w}
          height={viewport.h}
          fill="rgba(15, 23, 42, 0.7)"
          mask="url(#onboarding-cutout)"
        />
      </svg>

      {/* Spotlight border halkası */}
      {spotlight && (
        <div
          className="pointer-events-none fixed rounded-lg ring-2 ring-blue-400 shadow-[0_0_24px_rgba(59,130,246,0.5)] transition-all"
          style={{
            top: spotlight.y,
            left: spotlight.x,
            width: spotlight.w,
            height: spotlight.h,
          }}
          aria-hidden
        />
      )}

      {/* Popover */}
      <div
        className="fixed z-[210] w-[340px] max-w-[calc(100vw-32px)] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        style={popoverStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="-mr-1 -mt-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Turu kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`Adım ${stepIdx + 1} / ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === stepIdx
                    ? "w-5 bg-blue-600 dark:bg-blue-400"
                    : i < stepIdx
                      ? "w-1.5 bg-blue-300 dark:bg-blue-700"
                      : "w-1.5 bg-slate-300 dark:bg-slate-600"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={prev}
                className="h-8 px-2"
                aria-label="Önceki"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={next}
              className="h-8 gap-1 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {stepIdx === STEPS.length - 1 ? "Bitir" : "İleri"}
              {stepIdx < STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {stepIdx < STEPS.length - 1 && (
          <button
            type="button"
            onClick={dismiss}
            className="mt-2.5 block w-full text-center text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Turu atla
          </button>
        )}
      </div>
    </div>
  );
}
