import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isUrgentPriorityValue } from "@/lib/urgentTaskPriority";

/**
 * Görev / proje önceliği rozeti. Önceliğin değerini gösterir;
 * eğer ayarlardaki "urgent" eşleşme setine giriyorsa Flame ikonu + kırmızı vurgu ekler.
 *
 * Bu sayede kullanıcı "High" yazdığında neden acil görüldüğünü anlar
 * (ya da kendi token'larını ayarlardan değiştirebileceğini öğrenmeye yönlendirilir).
 */
const STANDARD_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

const URGENT_STYLE =
  "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700";

type PriorityBadgeProps = {
  priority: string | null | undefined;
  /** Ayarlardan gelen acil eşleşme seti (urgentPrioritySetFromCsv) */
  urgentSet?: Set<string>;
  className?: string;
};

export function PriorityBadge({ priority, urgentSet, className }: PriorityBadgeProps) {
  if (!priority || !priority.trim()) return null;
  const value = priority.trim();
  const urgent = urgentSet ? isUrgentPriorityValue(value, urgentSet) : false;
  const baseStyle = urgent ? URGENT_STYLE : STANDARD_STYLES[value] ?? "";
  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1 text-xs font-normal", baseStyle, className)}
      title={urgent ? `${value} (acil sayılır — Ayarlar > Acil öncelik etiketleri)` : value}
    >
      {urgent && <Flame className="h-3 w-3 shrink-0" aria-hidden />}
      {value}
    </Badge>
  );
}
