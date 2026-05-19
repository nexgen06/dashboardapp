"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shield, Loader2, Copy as CopyIcon, EyeOff, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listPiiAccessLog,
  type PiiAccessLogEntry,
  type PiiAccessAction,
} from "@/lib/piiAccessLog";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

const ACTION_META: Record<
  PiiAccessAction,
  { label: string; icon: typeof CopyIcon; bg: string; text: string }
> = {
  copy: { label: "Kopya", icon: CopyIcon, bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  unmask: { label: "Göster", icon: EyeOff, bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  export: { label: "İndirme", icon: Download, bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300" },
};

type DateRange = "24h" | "7d" | "30d" | "all";
const RANGE_LABELS: Record<DateRange, string> = {
  "24h": "Son 24 saat",
  "7d": "Son 7 gün",
  "30d": "Son 30 gün",
  all: "Tümü",
};

function rangeStartIso(range: DateRange): string | null {
  if (range === "all") return null;
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export default function PiiAccessPage() {
  const { hasPermission, isLoaded } = useAuth();
  const canView = hasPermission("area.piiAccess") && hasPermission("piiAccess.view");
  const [entries, setEntries] = useState<PiiAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>("7d");
  const [actionFilter, setActionFilter] = useState<PiiAccessAction | "all">("all");
  const [userFilter, setUserFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listPiiAccessLog({
        action: actionFilter === "all" ? null : actionFilter,
        since: rangeStartIso(range),
        limit: 500,
      });
      setEntries(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, range, actionFilter]);

  const filtered = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.user_email.toLowerCase().includes(q));
  }, [entries, userFilter]);

  // Kullanıcı bazında özet — anomali tespiti için
  const summary = useMemo(() => {
    const byUser = new Map<string, { total: number; copy: number; unmask: number; export: number }>();
    for (const e of entries) {
      const u = byUser.get(e.user_email) ?? { total: 0, copy: 0, unmask: 0, export: 0 };
      u.total += e.record_count;
      u[e.action] += e.record_count;
      byUser.set(e.user_email, u);
    }
    return Array.from(byUser.entries())
      .map(([email, s]) => ({ email, ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [entries]);

  if (!isLoaded) {
    return (
      <div className="container flex max-w-2xl flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-12 w-12 text-amber-600 dark:text-amber-400" />
          <p className="font-medium text-slate-800 dark:text-slate-200">PII erişim kayıtlarına yetkiniz yok.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">{`Dashboard'a dön`}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Yönetim" }, { label: "PII erişim" }]} />

      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            PII erişim kayıtları
          </h1>
          <span className="text-xs text-slate-500 dark:text-slate-400">· {entries.length} kayıt</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Yenile
        </Button>
      </header>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        TCKN / Sicil gibi hassas alanlara <strong>kopyala / unmask / export</strong> ile erişim her olduğunda burada görünür.
        Kayıtlar değiştirilemez (immutable). KVKK denetim talebinde delil olarak kullanılır.
      </p>

      {/* En aktif 5 kullanıcı — anomali için */}
      {summary.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Bu aralıkta en aktif 5 kullanıcı
          </h2>
          <ul className="space-y-1.5">
            {summary.map((u) => (
              <li key={u.email} className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setUserFilter(u.email)}
                  className="truncate text-left text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                >
                  {u.email}
                </button>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {u.total} · <span className="text-blue-600 dark:text-blue-400">{u.copy} kopya</span>
                  {u.export > 0 && <span className="text-purple-600 dark:text-purple-400"> · {u.export} export</span>}
                  {u.unmask > 0 && <span className="text-amber-600 dark:text-amber-400"> · {u.unmask} göster</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50">
          {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as PiiAccessAction | "all")}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">Tüm eylemler</option>
          <option value="copy">Kopya</option>
          <option value="unmask">Göster</option>
          <option value="export">İndirme</option>
        </select>
        <input
          type="text"
          placeholder="Kullanıcı e-posta filtresi…"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Liste */}
      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="text-sm">Yükleniyor…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-10 w-10" />}
          title="Bu aralıkta erişim kaydı yok"
          description="Filtreleri değiştirmeyi deneyin."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Zaman</th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Eylem</th>
                <th className="px-3 py-2">Alan</th>
                <th className="px-3 py-2 text-right">Sayı</th>
                <th className="px-3 py-2">Kayıt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filtered.map((e) => {
                const meta = ACTION_META[e.action];
                const Icon = meta.icon;
                return (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400" title={new Date(e.at).toLocaleString("tr-TR")}>
                      {getRelativeTime(new Date(e.at), new Date())}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{e.user_email}</td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", meta.bg, meta.text)}>
                        <Icon className="h-2.5 w-2.5" aria-hidden />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{e.field_name}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-200">
                      {e.record_count}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {e.record_id ? (
                        <code className="text-[10px]">{e.record_id.slice(0, 8)}…</code>
                      ) : (
                        <span className="italic">toplu</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
