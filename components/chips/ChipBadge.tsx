"use client";

import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Clock,
  CreditCard,
  FileText,
  FileX,
  Lock,
  LockKeyhole,
  Loader2,
  Mail,
  MailCheck,
  MailX,
  PauseCircle,
  Radar,
  Shield,
  ShieldAlert,
  Sparkles,
  TimerOff,
  Unlock,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { inferChipOptionIconSlug } from "@/lib/chipOptionIcons";
import type { ChipOption, ChipTemplate, RowChipValue } from "@/lib/chipSystem";

const colorClass: Record<string, string> = {
  slate: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
  violet: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
};

const selectColorClass: Record<string, string> = {
  slate: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
  blue: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-100",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100",
  amber: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100",
  red: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-100",
  violet: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100",
  cyan: "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-100",
};

const iconMap = {
  "alert-circle": AlertCircle,
  "alert-triangle": AlertTriangle,
  archive: Archive,
  calendar: Calendar,
  check: Check,
  "check-circle": CheckCircle2,
  circle: Circle,
  "circle-dot": CircleDot,
  clock: Clock,
  "credit-card": CreditCard,
  "file-text": FileText,
  "file-x": FileX,
  lock: Lock,
  "lock-keyhole": LockKeyhole,
  loader: Loader2,
  mail: Mail,
  "mail-check": MailCheck,
  "mail-x": MailX,
  "pause-circle": PauseCircle,
  shield: Shield,
  "shield-alert": ShieldAlert,
  sparkles: Sparkles,
  "timer-off": TimerOff,
  unlock: Unlock,
  "x-circle": XCircle,
};

function normalizeIconSlug(icon?: string | null): string | null {
  const raw = icon?.trim();
  if (!raw) return null;
  return raw.toLowerCase().replace(/_/g, "-");
}

/** @deprecated import from @/lib/chipOptionIcons */
export { inferChipOptionIconSlug } from "@/lib/chipOptionIcons";

/** E-posta şablonu ve eski mail-* slug'ları için durum ikonuna çevir. */
const LEGACY_ICON_ALIASES: Partial<Record<keyof typeof iconMap, keyof typeof iconMap>> = {
  "mail-check": "check",
  "mail-x": "x-circle",
  mail: "circle",
};

function resolveChipOptionIconComponent(option: ChipOption, template?: ChipTemplate | null) {
  const inferred = inferChipOptionIconSlug(option);

  // E-posta şablonu: DB'deki eski zarf ikonlarını yok say, durum ikonları kullan.
  if (template?.category === "email" && inferred) {
    return { Icon: iconMap[inferred as keyof typeof iconMap], slug: inferred };
  }

  // Manuel eklenmiş mail durumu value'ları (sent dışında mail_gönderildi vb.)
  if (inferred && /^(not_sent|pending|sent|failed|mail[_-]?(gonderildi|gönderildi|sent))$/i.test(option.value.trim())) {
    return { Icon: iconMap[inferred as keyof typeof iconMap], slug: inferred };
  }

  const explicit = normalizeIconSlug(option.icon);
  if (explicit) {
    const canonical = (LEGACY_ICON_ALIASES[explicit as keyof typeof iconMap] ?? explicit) as keyof typeof iconMap;
    if (iconMap[canonical]) {
      return { Icon: iconMap[canonical], slug: canonical };
    }
  }

  if (inferred && iconMap[inferred as keyof typeof iconMap]) {
    return { Icon: iconMap[inferred as keyof typeof iconMap], slug: inferred };
  }

  const templateSlug = normalizeIconSlug(template?.icon);
  if (templateSlug && iconMap[templateSlug as keyof typeof iconMap]) {
    return { Icon: iconMap[templateSlug as keyof typeof iconMap], slug: templateSlug };
  }
  return { Icon: Circle, slug: "circle" };
}

function ChipOptionIcon({
  option,
  template,
  className,
}: {
  option: ChipOption;
  template?: ChipTemplate | null;
  className?: string;
}) {
  const { Icon, slug } = resolveChipOptionIconComponent(option, template);
  return (
    <Icon
      className={cn("shrink-0", className)}
      strokeWidth={slug === "check" ? 3 : undefined}
      aria-hidden
    />
  );
}

function isReflectorChip(option: ChipOption): boolean {
  const value = `${option.value} ${option.label}`.toLocaleLowerCase("tr");
  return [
    "critical",
    "kritik",
    "overdue",
    "gecikti",
    "gecikmiş",
    "breached",
    "sla aşıldı",
    "missing",
    "eksik",
    "rejected",
    "reddedildi",
    "revision",
    "revize",
    "blocked",
    "engellendi",
  ].some((token) => value.includes(token));
}

export function ChipBadge({
  template,
  option,
  rowValue,
  spotlight,
  className,
}: {
  template?: ChipTemplate | null;
  option: ChipOption;
  rowValue?: RowChipValue | null;
  spotlight?: boolean;
  className?: string;
}) {
  const reflector = isReflectorChip(option);
  const title = [
    template?.name,
    reflector ? "dikkat efekti" : null,
    rowValue?.source === "automation" ? "otomasyon" : rowValue?.source === "system" ? "sistem" : null,
  ].filter(Boolean).join(" · ");
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm",
        colorClass[option.color] ?? colorClass[template?.color ?? "slate"] ?? colorClass.slate,
        reflector && "chip-reflector",
        reflector && (option.color === "red" || /critical|kritik|rejected|reddedildi|blocked|engellendi/i.test(`${option.value} ${option.label}`)) && "chip-reflector-red",
        reflector && (option.color === "amber" || /overdue|gecikti|gecikmiş|missing|eksik|revision|revize/i.test(`${option.value} ${option.label}`)) && "chip-reflector-amber",
        reflector && option.color === "violet" && "chip-reflector-violet",
        spotlight && "chip-spotlight chip-reflector",
        className
      )}
      title={title || undefined}
    >
      {spotlight && <Radar className="h-3 w-3 shrink-0 text-violet-600 dark:text-violet-300 animate-pulse" aria-label="Spotlight" />}
      <ChipOptionIcon option={option} template={template} className="h-3 w-3" />
      <span className="truncate">{option.label}</span>
      {rowValue?.source === "automation" && <Sparkles className="h-3 w-3 shrink-0 opacity-75" aria-label="Otomasyon" />}
      {template?.managerOnly && <Lock className="h-3 w-3 shrink-0 opacity-75" aria-label="Yönetici çipi" />}
    </span>
  );
}

export function ChipSelectCell({
  template,
  options,
  value,
  disabled,
  spotlight,
  onChange,
}: {
  template: ChipTemplate;
  options: ChipOption[];
  value?: string | null;
  disabled?: boolean;
  spotlight?: boolean;
  onChange: (optionId: string) => void;
}) {
  const current = options.find((option) => option.id === value) ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const listboxId = useId();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const node = event.target as Node;
      if (anchorRef.current?.contains(node)) return;
      if (menuRef.current?.contains(node)) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  const triggerClass = cn(
    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2 text-xs font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-60",
    current
      ? selectColorClass[current.color] ?? selectColorClass[template.color] ?? selectColorClass.slate
      : "border-slate-200 bg-white text-slate-500 focus:border-blue-500 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    current?.color === "red" && "focus:border-red-500 focus:ring-red-500/25",
    current?.color === "amber" && "focus:border-amber-500 focus:ring-amber-500/25",
    current?.color === "emerald" && "focus:border-emerald-500 focus:ring-emerald-500/25",
    current?.color === "blue" && "focus:border-blue-500 focus:ring-blue-500/25",
    current?.color === "violet" && "focus:border-violet-500 focus:ring-violet-500/25",
    current?.color === "cyan" && "focus:border-cyan-500 focus:ring-cyan-500/25",
    current && isReflectorChip(current) && "chip-reflector",
    current &&
      isReflectorChip(current) &&
      (current.color === "red" ||
        /critical|kritik|rejected|reddedildi|blocked|engellendi/i.test(`${current.value} ${current.label}`)) &&
      "chip-reflector-red",
    current &&
      isReflectorChip(current) &&
      (current.color === "amber" ||
        /overdue|gecikti|gecikmiş|missing|eksik|revision|revize/i.test(`${current.value} ${current.label}`)) &&
      "chip-reflector-amber",
    current && isReflectorChip(current) && current.color === "violet" && "chip-reflector-violet",
    spotlight && "chip-spotlight chip-reflector"
  );

  const pickOption = useCallback(
    (optionId: string) => {
      onChange(optionId);
      setMenuOpen(false);
    },
    [onChange]
  );

  if (disabled) {
    return current ? (
      <ChipBadge template={template} option={current} spotlight={spotlight} />
    ) : (
      <span className="text-xs text-slate-400">—</span>
    );
  }

  const menu =
    menuOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={`${template.name} seçin`}
            className="fixed z-[300] min-w-[11rem] max-w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {options.map((option) => {
              const selected = option.id === value;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700",
                    selected && "bg-slate-50 dark:bg-slate-700/60"
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    pickOption(option.id);
                  }}
                >
                  <ChipOptionIcon option={option} template={template} className="h-3.5 w-3.5" />
                  <span className="min-w-0 truncate">{option.label}</span>
                  {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        title={template.name}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? listboxId : undefined}
        className={cn(triggerClass, "cursor-pointer hover:opacity-90")}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
      >
        {current ? (
          <>
            <ChipOptionIcon option={current} template={template} className="h-3 w-3" />
            <span className="truncate">{current.label}</span>
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      </button>
      {menu}
    </>
  );
}
