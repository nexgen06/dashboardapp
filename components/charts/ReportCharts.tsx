"use client";

/**
 * Rapor grafikleri — Recharts ile bar/pie/line.
 * Lazy import için ayrı dosyada tutulur; sadece raporlar sayfasında yüklenir.
 *
 * Tasarım notları:
 *  - Renkler accent kullanmaz (Recharts SVG, CSS değişkenleri runtime'da
 *    okumak için ekstra effort gerekir) — sabit, dashboard ile uyumlu palet
 *  - Dark mode: ResponsiveContainer + tooltip stilleri her iki temada okunur
 *  - 3 grafik, container'da yan yana grid'lenir
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ProjectBarDatum = { name: string; toplam: number; tamamlanan: number; gecikmis: number };
type StatusPieDatum = { name: string; value: number };
type WeeklyLineDatum = { label: string; tamamlanan: number };

const COLORS = {
  total: "#3b82f6", // blue-500
  done: "#10b981", // emerald-500
  overdue: "#f59e0b", // amber-500
  todo: "#94a3b8", // slate-400
  inProgress: "#0ea5e9", // sky-500
  completed: "#10b981", // emerald-500
  pending: "#a78bfa", // violet-400
};

const STATUS_COLORS = [COLORS.todo, COLORS.inProgress, COLORS.completed, COLORS.pending];

/** Ortak tooltip kabuğu — dark mode uyumlu. */
type TooltipPayloadEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
};
type TooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
};
function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      {label !== undefined && (
        <div className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</div>
      )}
      {payload.map((entry, i: number) => (
        <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: entry.color ?? "#64748b" }}
            aria-hidden
          />
          <span className="font-medium">{entry.name}:</span>
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1) Proje bazlı dağılım — Stacked bar (toplam / tamamlanan / gecikmiş)      */
/* -------------------------------------------------------------------------- */

export function ProjectsBarChart({
  data,
}: {
  data: ProjectBarDatum[];
}) {
  // En fazla 10 proje göster, daha çok varsa kısa isim
  const trimmed = useMemo(
    () =>
      data.slice(0, 10).map((d) => ({
        ...d,
        name: d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name,
      })),
    [data]
  );

  if (trimmed.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-xs text-slate-400">
        Bu aralıkta proje verisi yok.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={trimmed} margin={{ top: 6, right: 10, left: -10, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-600 dark:text-slate-400"
          angle={-25}
          textAnchor="end"
          height={50}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-600 dark:text-slate-400"
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="toplam" name="Toplam" fill={COLORS.total} radius={[3, 3, 0, 0]} />
        <Bar dataKey="tamamlanan" name="Tamamlanan" fill={COLORS.done} radius={[3, 3, 0, 0]} />
        <Bar dataKey="gecikmis" name="Gecikmiş" fill={COLORS.overdue} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* 2) Durum dağılımı — Pie chart                                              */
/* -------------------------------------------------------------------------- */

export function StatusPieChart({ data }: { data: StatusPieDatum[] }) {
  const cleaned = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const total = cleaned.reduce((acc, d) => acc + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-xs text-slate-400">
        Bu aralıkta durum verisi yok.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="circle"
          formatter={(value: string, _entry, index: number) => {
            const datum = cleaned[index];
            const pct = datum ? Math.round((datum.value / total) * 100) : 0;
            return (
              <span className="text-slate-700 dark:text-slate-300">
                {value} · {pct}%
              </span>
            );
          }}
        />
        <Pie
          data={cleaned}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="45%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={2}
        >
          {cleaned.map((_entry, idx) => (
            <Cell key={`cell-${idx}`} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* 3) Haftalık trend — Line chart                                             */
/* -------------------------------------------------------------------------- */

export function WeeklyTrendLineChart({ data }: { data: WeeklyLineDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-xs text-slate-400">
        Trend verisi yok.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 6, right: 14, left: -10, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-600 dark:text-slate-400"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-600 dark:text-slate-400"
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(148, 163, 184, 0.3)" }} />
        <Line
          type="monotone"
          dataKey="tamamlanan"
          name="Tamamlanan"
          stroke={COLORS.done}
          strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.done, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: COLORS.done }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
