import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Standart bölüm / kart wrapper'ı.
 *
 * Spacing sistemi (8px grid):
 *   - variant="page"     → büyük içerik kartı, sayfa içi bölüm: p-4 md:p-6, border, shadow-sm
 *   - variant="toolbar"  → başlık çubuğu / araç çubuğu: px-4 py-3, border-b
 *   - variant="item"     → liste içi kart (proje kartı vb.): p-3 md:p-4, border, hover:shadow
 *   - variant="modal"    → diyalog gövdesi: p-6 md:p-8 (Dialog kendi başına padding yönetiyorsa kullanma)
 *   - variant="flush"    → padding yok; sadece arka plan + border (özel layoutlar için)
 *
 * `tone` parametresi yumuşak vurgu için: "neutral" | "muted" (slate-50 arka planlı).
 */
const VARIANT_CLASSES = {
  page: "p-4 md:p-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800",
  toolbar: "px-4 py-3 border-b border-slate-200 dark:border-slate-700",
  item: "p-3 md:p-4 rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800",
  modal: "p-6 md:p-8",
  flush: "rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
} as const;

const TONE_CLASSES = {
  neutral: "",
  muted: "bg-slate-50/70 dark:bg-slate-800/40",
} as const;

export type SectionVariant = keyof typeof VARIANT_CLASSES;
export type SectionTone = keyof typeof TONE_CLASSES;

type SectionProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: SectionVariant;
  tone?: SectionTone;
  as?: "section" | "div" | "article" | "aside";
};

export const Section = forwardRef<HTMLDivElement, SectionProps>(function Section(
  { variant = "page", tone = "neutral", as = "section", className, children, ...rest },
  ref
) {
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={cn(VARIANT_CLASSES[variant], TONE_CLASSES[tone], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
});

/** Section içinde ardışık bloklar arası standart boşluk. */
export function SectionStack({
  className,
  gap = "md",
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { gap?: "sm" | "md" | "lg" }) {
  const gapClass = gap === "sm" ? "space-y-2" : gap === "lg" ? "space-y-6" : "space-y-4";
  return <div className={cn(gapClass, className)} {...rest} />;
}
