import { cn } from "@/lib/utils";

/**
 * Boş durum görsel placeholder'ı: ikon + başlık + açıklama + (opsiyonel) aksiyon.
 *
 * Kullanım:
 *   <EmptyState
 *     icon={<FolderKanban className="h-10 w-10" />}
 *     title="Henüz proje yok"
 *     description="İlk projenizi oluşturarak başlayın."
 *     action={<Button>Yeni proje</Button>}
 *   />
 *
 * Variant:
 *   - "default": tam kart (sınırlı, kart içinde kullanılır)
 *   - "inline": şeffaf, içerik akışı içinde yer alır (mevcut bir kartın içinde)
 *   - "compact": daha küçük, kısa açıklama
 */
type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** İkincil aksiyon (örn. "Filtreyi temizle"). */
  secondaryAction?: React.ReactNode;
  variant?: "default" | "inline" | "compact";
  className?: string;
};

const VARIANT_CLASS = {
  default:
    "rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 dark:border-slate-600 dark:bg-slate-800/40",
  inline: "px-4 py-10",
  compact: "px-4 py-6",
} as const;

const ICON_SIZE = {
  default: "h-12 w-12",
  inline: "h-10 w-10",
  compact: "h-8 w-8",
} as const;

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center text-center", VARIANT_CLASS[variant], className)}
    >
      {icon && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
            variant === "compact" ? "mb-2 h-12 w-12" : "mb-4 h-16 w-16",
            "[&_svg]:" + ICON_SIZE[variant]
          )}
          aria-hidden
        >
          <span className={ICON_SIZE[variant]}>{icon}</span>
        </div>
      )}
      <h3
        className={cn(
          "font-semibold text-slate-800 dark:text-slate-100",
          variant === "compact" ? "text-ui-h3" : "text-ui-h2"
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "mt-1 max-w-md text-ui-body text-slate-600 dark:text-slate-300",
            variant === "compact" && "text-ui-caption"
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
