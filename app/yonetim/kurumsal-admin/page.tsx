"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  ExternalLink,
  HardDriveDownload,
  Info,
  Loader2,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useProjects } from "@/hooks/useProjects";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { listDirectoryUsers, type DirectoryUserProfile } from "@/lib/listDirectoryUsers";
import {
  getClientBuildInfo,
  getPresenceStatus,
  listRecentPresenceRows,
  loadSystemScriptChecks,
  type RecentPresenceRow,
  type SystemCheckStatus,
  type SystemScriptCheck,
  type SystemBuildInfo,
} from "@/lib/systemAdminHealth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { isRealtimeDisabledForClient } from "@/lib/realtimeFallback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "info";

const statusTone: Record<SystemCheckStatus, Tone> = {
  ok: "ok",
  warn: "warn",
  missing: "bad",
  unknown: "info",
};

const toneClass: Record<Tone, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100",
  warn: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100",
  bad: "border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100",
  info: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100",
};

const toneBadge: Record<Tone, string> = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200",
  bad: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
};

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function relativeTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value).getTime();
  if (!Number.isFinite(d)) return "-";
  const diff = Date.now() - d;
  const min = Math.max(0, Math.round(diff / 60000));
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour} saat önce`;
  return `${Math.round(hour / 24)} gün önce`;
}

function downloadTextFile(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const esc = (v: unknown) => {
    const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [keys.join(","), ...rows.map((row) => keys.map((key) => esc(row[key])).join(","))].join("\n");
}

function StatusIcon({ tone }: { tone: Tone }) {
  if (tone === "ok") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (tone === "bad") return <XCircle className="h-4 w-4" aria-hidden />;
  if (tone === "warn") return <AlertTriangle className="h-4 w-4" aria-hidden />;
  return <Info className="h-4 w-4" aria-hidden />;
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "info",
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
        <div className={cn("rounded-lg border p-2", toneClass[tone])}>{icon}</div>
      </div>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-700 dark:text-slate-200">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function KurumsalAdminPage() {
  const { isLoaded, hasPermission, isAdmin, user } = useAuth();
  const { settings } = useSettings();
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects();
  const { tasks, isLoading: tasksLoading, error: tasksError, realtimeConnection } = useTasksWithRealtime();
  const toast = useToast();
  const [users, setUsers] = useState<DirectoryUserProfile[]>([]);
  const [checks, setChecks] = useState<SystemScriptCheck[]>([]);
  const [presenceRows, setPresenceRows] = useState<RecentPresenceRow[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [build, setBuild] = useState<SystemBuildInfo>(() => getClientBuildInfo());

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const [nextChecks, nextUsers, nextPresence, nextBuild] = await Promise.all([
        loadSystemScriptChecks(),
        isAdmin ? listDirectoryUsers() : Promise.resolve([]),
        listRecentPresenceRows(),
        fetch("/api/system/build-info", { cache: "no-store" })
          .then((res) => (res.ok ? res.json() as Promise<SystemBuildInfo> : getClientBuildInfo()))
          .catch(() => getClientBuildInfo()),
      ]);
      setChecks(nextChecks);
      setUsers(nextUsers);
      setPresenceRows(nextPresence);
      setBuild(nextBuild);
    } catch (e) {
      toast.error("Sistem sağlık bilgileri okunamadı", {
        description: e instanceof Error ? e.message : "Beklenmeyen hata",
      });
    } finally {
      setLoadingHealth(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    if (!isLoaded || !hasPermission("userManagement.view")) return;
    void loadHealth();
  }, [isLoaded, hasPermission, loadHealth]);

  const scriptSummary = useMemo(() => {
    const missing = checks.filter((item) => item.status === "missing").length;
    const warn = checks.filter((item) => item.status === "warn" || item.status === "unknown").length;
    return { missing, warn, ok: checks.length - missing - warn };
  }, [checks]);

  const onlinePresence = useMemo(
    () => presenceRows.filter((row) => getPresenceStatus(row.last_seen_at) === "active"),
    [presenceRows]
  );

  const riskItems = useMemo(() => {
    const items: Array<{ title: string; description: string; tone: Tone }> = [];
    if (!isSupabaseConfigured()) {
      items.push({
        title: "Supabase bağlantısı yapılandırılmamış",
        description: "Auth, RLS ve veri yönetimi canlı ortamda çalışmaz.",
        tone: "bad",
      });
    }
    if (isRealtimeDisabledForClient()) {
      items.push({
        title: "Realtime kapalı, fallback aktif",
        description: "Kurumsal ağlarda güvenli tercih olabilir; güncellemeler polling ile gecikmeli gelir.",
        tone: "warn",
      });
    }
    if (settings.debugMode || settings.logLevel === "debug") {
      items.push({
        title: "Debug seviyesi açık",
        description: "Canlı ortamda gereksiz log ve hassas operasyon izi üretebilir.",
        tone: "warn",
      });
    }
    if (settings.experimentalFeatures) {
      items.push({
        title: "Deneysel özellikler açık",
        description: "Kurumsal kullanımda kontrollü test grubu dışında kapalı tutulmalı.",
        tone: "warn",
      });
    }
    if (settings.piiCopyHourlyLimit <= 0) {
      items.push({
        title: "PII kopyalama limiti kapalı",
        description: "TCKN/sicil gibi alanlarda saatlik limit önerilir.",
        tone: "bad",
      });
    }
    if (scriptSummary.missing > 0) {
      items.push({
        title: "Eksik SQL/RLS script var",
        description: `${scriptSummary.missing} kritik altyapı kontrolü eksik görünüyor.`,
        tone: "bad",
      });
    }
    return items.length > 0
      ? items
      : [{ title: "Kritik uyarı yok", description: "Mevcut kontrollerde yüksek riskli durum görünmüyor.", tone: "ok" as Tone }];
  }, [scriptSummary.missing, settings.debugMode, settings.experimentalFeatures, settings.logLevel, settings.piiCopyHourlyLimit]);

  const exportFullBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: user?.email ?? null,
      build,
      projects,
      tasks,
      users: users.map((u) => ({ uid: u.uid, email: u.email, displayName: u.displayName, roleId: u.roleId, updatedAt: u.updatedAt })),
      scriptChecks: checks,
    };
    downloadTextFile(`dashboard-yedek-${Date.now()}.json`, JSON.stringify(payload, null, 2));
    toast.success("Yedek JSON indirildi");
  };

  const exportTasksCsv = () => {
    downloadTextFile(`gorev-yedek-${Date.now()}.csv`, toCsv(tasks as unknown as Array<Record<string, unknown>>), "text/csv;charset=utf-8");
    toast.success("Görev CSV yedeği indirildi");
  };

  if (!isLoaded) {
    return <div className="container py-12 text-center text-slate-500 dark:text-slate-400">Yükleniyor...</div>;
  }

  if (!hasPermission("userManagement.view")) {
    return (
      <div className="container max-w-4xl py-8">
        <EmptyState
          icon={<ShieldCheck />}
          title="Bu sayfaya erişim yetkiniz yok"
          description="Kurumsal admin paneli yalnızca yönetim yetkisine sahip kullanıcılar içindir."
          action={
            <Button asChild variant="outline">
              <Link href="/">Ana sayfaya dön</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl space-y-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Faz 9</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Kurumsal Admin Paneli</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Sistem sağlığı, RLS script durumu, bağlantı modeli, kullanıcı aktivitesi ve veri bakım aksiyonları tek ekranda.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadHealth()} disabled={loadingHealth}>
          {loadingHealth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Yenile
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sistem sağlığı"
          value={scriptSummary.missing > 0 ? "Riskli" : scriptSummary.warn > 0 ? "Kontrol" : "Sağlıklı"}
          detail={`${scriptSummary.ok} tamam, ${scriptSummary.warn} uyarı, ${scriptSummary.missing} eksik`}
          icon={<Activity className="h-5 w-5" />}
          tone={scriptSummary.missing > 0 ? "bad" : scriptSummary.warn > 0 ? "warn" : "ok"}
        />
        <MetricCard
          label="Realtime"
          value={build.realtimeDisabled ? "Fallback" : realtimeConnection === "live" ? "Canlı" : "Bekliyor"}
          detail={build.realtimeDisabled ? "WebSocket kapalı, HTTPS polling aktif." : `Tasks: ${realtimeConnection}, Projects: hook içi senkron`}
          icon={<RadioTower className="h-5 w-5" />}
          tone={build.realtimeDisabled ? "warn" : realtimeConnection === "live" ? "ok" : "info"}
        />
        <MetricCard
          label="Kullanıcı"
          value={users.length > 0 ? String(users.length) : isAdmin ? "0" : "-"}
          detail={`${onlinePresence.length} kullanıcı son 2 dakikada aktif görünüyor.`}
          icon={<UserRoundCheck className="h-5 w-5" />}
          tone={onlinePresence.length > 0 ? "ok" : "info"}
        />
        <MetricCard
          label="Veri kapsamı"
          value={`${projects.length}/${tasks.length}`}
          detail={projectsError || tasksError || `${projects.length} proje, ${tasks.length} görev okunuyor.`}
          icon={<Database className="h-5 w-5" />}
          tone={projectsError || tasksError ? "bad" : projectsLoading || tasksLoading ? "info" : "ok"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Supabase RLS Script Kontrol Listesi"
          description="Tablo erişimi üzerinden script uygulanma durumunu kontrol eder."
          icon={<ShieldCheck className="h-5 w-5" />}
        >
          <div className="space-y-2">
            {checks.map((item) => {
              const tone = statusTone[item.status];
              return (
                <div key={item.id} className={cn("rounded-lg border p-3", toneClass[tone])}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusIcon tone={tone} />
                        <h3 className="text-sm font-semibold">{item.title}</h3>
                      </div>
                      <p className="mt-1 text-xs opacity-85">{item.description}</p>
                      <p className="mt-2 font-mono text-[11px] opacity-80">{item.script}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", toneBadge[tone])}>
                      {item.status === "ok" ? "Tamam" : item.status === "missing" ? "Eksik" : item.status === "warn" ? "Yetki kontrolü" : "Bilinmiyor"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs opacity-85">{item.message}</p>
                </div>
              );
            })}
            {checks.length === 0 && (
              <div className="rounded-lg border border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Kontroller yüklenmedi.
              </div>
            )}
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Riskli Ayarlar" description="Adminin hızlı karar vermesi gereken uyarılar." icon={<AlertTriangle className="h-5 w-5" />}>
            <div className="space-y-2">
              {riskItems.map((item) => (
                <div key={item.title} className={cn("rounded-lg border p-3", toneClass[item.tone])}>
                  <div className="flex items-center gap-2">
                    <StatusIcon tone={item.tone} />
                    <p className="text-sm font-semibold">{item.title}</p>
                  </div>
                  <p className="mt-1 text-xs opacity-85">{item.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Deploy / Versiyon" description="Canlı ortam izlenebilirliği." icon={<Clock3 className="h-5 w-5" />}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Versiyon</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{build.version}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Ortam</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{build.environment}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Commit</dt><dd className="max-w-[12rem] truncate font-mono text-xs text-slate-900 dark:text-slate-100">{build.commit || "NEXT_PUBLIC_GIT_SHA yok"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Deployment</dt><dd className="max-w-[12rem] truncate font-mono text-xs text-slate-900 dark:text-slate-100">{build.deployment || "Tanımsız"}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Railway üzerinde commit/deploy bilgisini görmek için `NEXT_PUBLIC_GIT_SHA` veya `NEXT_PUBLIC_RAILWAY_GIT_COMMIT_SHA` eklenebilir.
            </p>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Kullanıcı Oturumları ve Son Görülme" description="Presence heartbeat varsa aktif oturumları gösterir." icon={<UserRoundCheck className="h-5 w-5" />}>
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Kullanıcı</th>
                  <th className="px-3 py-2 text-left">Kapsam</th>
                  <th className="px-3 py-2 text-left">Son görülme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {presenceRows.slice(0, 8).map((row, idx) => (
                  <tr key={`${row.user_id ?? row.user_email ?? idx}-${row.scope}-${idx}`} className="bg-white dark:bg-slate-800">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.user_name || row.user_email || "Bilinmeyen kullanıcı"}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{row.user_email || row.user_id || "-"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">
                        {row.scope === "app" ? "Genel oturum" : row.scope === "project" ? "Proje" : "Canlı tablo"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300" title={formatDateTime(row.last_seen_at)}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            getPresenceStatus(row.last_seen_at) === "active"
                              ? "bg-emerald-500"
                              : getPresenceStatus(row.last_seen_at) === "recent"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                          )}
                          aria-hidden
                        />
                        {relativeTime(row.last_seen_at)}
                      </span>
                    </td>
                  </tr>
                ))}
                {presenceRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                      Presence heartbeat kaydı görünmüyor. Script eksik olabilir veya kullanıcılar henüz aktif değildir.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Yedekleme ve Veri Bakımı" description="Teknik bilmeyen admin için kontrollü operasyon araçları." icon={<HardDriveDownload className="h-5 w-5" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={exportFullBackup}
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
            >
              <Archive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Tam JSON yedek</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Projeler, görevler, kullanıcı listesi ve sağlık çıktısı.</p>
            </button>
            <button
              type="button"
              onClick={exportTasksCsv}
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
            >
              <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Görev CSV yedeği</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Canlı tablodaki erişilebilir görevleri CSV olarak indirir.</p>
            </button>
            <Link
              href="/canli-tablo"
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
            >
              <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Veri temizleme</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Boş satır temizliği canlı tablo üzerinden geri alınabilir yapılır.</p>
            </Link>
            <Link
              href="/yonetim/kullanici-yetkileri"
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
            >
              <ExternalLink className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Yetki denetimi</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rol matrisi ve güvenlik kontrol listesini açar.</p>
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
