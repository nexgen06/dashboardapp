import { cn } from "@/lib/utils";

/**
 * Yükleme sırasında gösterilen shimmer placeholder.
 * Tailwind `animate-pulse` ile yumuşak nefes alma; renk slate-200 / dark slate-700.
 *
 * Kullanım:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton variant="circle" className="h-10 w-10" />
 *
 * Erişilebilirlik: parent container'a `aria-busy="true"` ekleyin.
 */
type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "rect" | "circle" | "text";
};

export function Skeleton({ className, variant = "rect", ...rest }: SkeletonProps) {
  const shape =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
        ? "rounded h-4"
        : "rounded-md";
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-200/80 dark:bg-slate-700/70",
        shape,
        className
      )}
      {...rest}
    />
  );
}

/** Tek satırlık metin yer tutucu, opsiyonel genişlik (varsayılan 100%). */
export function SkeletonText({
  width = "100%",
  className,
}: {
  width?: string;
  className?: string;
}) {
  return <Skeleton variant="text" className={className} style={{ width }} />;
}
