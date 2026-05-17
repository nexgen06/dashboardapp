"use client";

import { cn } from "@/lib/utils";

export type StatusDonutSegment = {
  label: string;
  value: number;
  /** SVG stroke için CSS değişkeni veya hex; varsayılan Tailwind palette ile uyumlu */
  color: string;
  /** Açık/koyu mod aynı renge bağlanır; istersen tone-per-mode kontrolü için class */
  dotClass?: string;
};

type StatusDonutProps = {
  segments: StatusDonutSegment[];
  /** Merkez büyük rakam (varsayılan: toplam) */
  centerValue?: number | string;
  /** Merkez altındaki açıklama metni */
  centerLabel?: string;
  /** Donut dış çap (px) — varsayılan 140 */
  size?: number;
  /** Halkanın kalınlığı — varsayılan size * 0.15 */
  thickness?: number;
  /** Legend göster — varsayılan true */
  showLegend?: boolean;
  className?: string;
};

/**
 * Bağımsız SVG donut. Tek render'da çizilir, animasyon `stroke-dashoffset`
 * transition'ı ile sağlanır. Hiçbir 3. parti chart kütüphanesi kullanılmaz.
 */
export function StatusDonut({
  segments,
  centerValue,
  centerLabel,
  size = 140,
  thickness,
  showLegend = true,
  className,
}: StatusDonutProps) {
  const stroke = thickness ?? Math.max(12, Math.round(size * 0.15));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const center = size / 2;

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = total > 0 ? Math.max(0, seg.value) / total : 0;
    const length = fraction * circumference;
    const dashOffset = -offset;
    offset += length;
    return {
      key: `${i}-${seg.label}`,
      length,
      dashOffset,
      color: seg.color,
    };
  });

  const inferredCenter =
    centerValue ?? (total > 0 ? total : 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Görev durum dağılımı, toplam ${total}`}
          className="-rotate-90"
        >
          {/* Arka plan ringi */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-700"
            strokeWidth={stroke}
            fill="none"
          />
          {/* Segmentler — toplam 0 ise hiçbir segment çizme */}
          {total > 0 &&
            arcs.map((a) => (
              <circle
                key={a.key}
                cx={center}
                cy={center}
                r={radius}
                stroke={a.color}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="butt"
                strokeDasharray={`${a.length} ${circumference - a.length}`}
                strokeDashoffset={a.dashOffset}
                style={{ transition: "stroke-dasharray 400ms ease, stroke-dashoffset 400ms ease" }}
              />
            ))}
        </svg>
        {/* Merkez metin */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold leading-none text-slate-800 dark:text-slate-100">
            {inferredCenter}
          </span>
          {centerLabel && (
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      {showLegend && (
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {segments.map((seg) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            return (
              <li key={seg.label} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    seg.dotClass
                  )}
                  style={seg.dotClass ? undefined : { backgroundColor: seg.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                  {seg.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {seg.value}
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  %{pct}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
