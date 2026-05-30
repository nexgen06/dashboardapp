"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Sayıyı yumuşakça hedef değere kadar animate eder.
 *
 * Kullanım:
 *   <CountUp value={kpis.total} />
 *   <CountUp value={97} suffix="%" duration={0.9} />
 *
 * Davranış:
 *   - İlk görünür olduğunda 0 → value animate olur
 *   - value değişirse mevcut değerden yeni hedefe doğru tween yapar
 *   - prefers-reduced-motion'da statik render
 *   - tabular-nums otomatik (layout shift olmasın diye monospace digit)
 */
type CountUpProps = {
  value: number;
  /** Saniye cinsinden — varsayılan 0.8sn */
  duration?: number;
  /** Ondalık basamak sayısı — varsayılan 0 */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Locale formatter (binlik ayraç vs.) — varsayılan tr-TR */
  locale?: string;
};

export function CountUp({
  value,
  duration = 0.8,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  locale = "tr-TR",
}: CountUpProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const mv = useMotionValue(reduced ? value : 0);
  // Format'lı string'e dönüştür
  const display = useTransform(mv, (latest) => {
    const fixed = Number(latest).toFixed(decimals);
    const num = Number(fixed);
    const formatted = num.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // smoothEase ile aynı
    });
    return () => controls.stop();
  }, [value, duration, inView, mv, reduced]);

  return (
    <motion.span ref={ref} className={cn("tabular-nums", className)}>
      {display}
    </motion.span>
  );
}
