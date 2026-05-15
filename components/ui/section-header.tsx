import { cn } from "@/lib/utils";

/**
 * Standart bölüm/kart başlığı.
 *
 * Hiyerarşi:
 *   - level="page"    → ui-h1 (24/32 600): sayfa başlığı (sayfa başında, en üstte bir tane)
 *   - level="section" → ui-h2 (18/28 600): bölüm başlığı (en yaygın)
 *   - level="card"    → ui-h3 (16/24 600): kart içi alt başlık
 *
 * Spacing: başlık + alt metin + içerik aşağıya doğru: mb-4 (içeriğe geçiş için).
 * actions sağa yerleşir (buton, link grubu vb.).
 */
type SectionHeaderProps = {
  level?: "page" | "section" | "card";
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Başlığın altındaki boşluk; içerikle arası. Varsayılan `mb-4`. */
  spacing?: "none" | "sm" | "md" | "lg";
  /** İkon (ör. Lucide), başlığın solunda. */
  icon?: React.ReactNode;
};

const TITLE_CLASS = {
  page: "text-ui-h1 text-slate-900 dark:text-slate-50",
  section: "text-ui-h2 text-slate-800 dark:text-slate-100",
  card: "text-ui-h3 text-slate-800 dark:text-slate-100",
} as const;

const SPACING_CLASS = {
  none: "",
  sm: "mb-2",
  md: "mb-4",
  lg: "mb-6",
} as const;

export function SectionHeader({
  level = "section",
  title,
  subtitle,
  actions,
  className,
  spacing = "md",
  icon,
}: SectionHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-3", SPACING_CLASS[spacing], className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">{icon}</span>}
        <div className="min-w-0">
          <h2 className={cn("font-semibold tracking-tight", TITLE_CLASS[level])}>{title}</h2>
          {subtitle && (
            <p className="mt-1 text-ui-body text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
