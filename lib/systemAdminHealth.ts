import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type SystemCheckStatus = "ok" | "warn" | "missing" | "unknown";

export type SystemScriptCheck = {
  id: string;
  title: string;
  script: string;
  table: string;
  description: string;
  status: SystemCheckStatus;
  message: string;
};

const REQUIRED_SCRIPT_CHECKS: Array<Omit<SystemScriptCheck, "status" | "message">> = [
  {
    id: "core-rls",
    title: "Ana RLS politikaları",
    script: "scripts/supabase-rls-policies.sql",
    table: "projects",
    description: "Proje ve görev erişim kurallarının temelini oluşturur.",
  },
  {
    id: "comments",
    title: "Görev yorumları",
    script: "scripts/task-comments.sql",
    table: "task_comments",
    description: "Satır detayındaki yorum yetkileri ve realtime yorum akışı.",
  },
  {
    id: "notifications",
    title: "Merkezi bildirimler",
    script: "scripts/notifications.sql",
    table: "notifications",
    description: "Atama, gecikme, sohbet ve admin olaylarını tek kutuda toplar.",
  },
  {
    id: "notifications-triggers",
    title: "Bildirim tetikleyicileri (Faz 2)",
    script: "scripts/notifications-assignment-triggers.sql",
    table: "notifications",
    description: "Proje/görev ataması ve gecikmiş görev bildirimlerini DB trigger ile üretir.",
  },
  {
    id: "project-member-permissions",
    title: "Proje bazlı yetkiler",
    script: "scripts/project-member-permissions.sql",
    table: "project_member_permissions",
    description: "Proje özelinde görme, düzenleme, yorum, kopya ve export yetkileri.",
  },
  {
    id: "task-workflow",
    title: "Görev onay workflow",
    script: "scripts/task-workflow.sql",
    table: "task_workflow_events",
    description: "Kontrole gönderme, onay, revize ve ret kararlarını kayıt altına alır.",
  },
  {
    id: "presence-heartbeats",
    title: "Presence fallback",
    script: "scripts/presence-heartbeats.sql",
    table: "presence_heartbeats",
    description: "WebSocket engellendiğinde çevrimiçi kullanıcı bilgisini HTTPS ile taşır.",
  },
  {
    id: "pii-access-log",
    title: "Hassas veri erişim logları",
    script: "scripts/pii-access-log.sql",
    table: "pii_access_log",
    description: "TCKN/sicil kopyalama ve maskesiz export denetim kayıtları.",
  },
  {
    id: "reference-sources",
    title: "Referans veri kaynakları",
    script: "scripts/reference-sources.sql",
    table: "reference_sources",
    description: "JSON kaynaklarıyla arama, dropdown ve satır zenginleştirme.",
  },
  {
    id: "report-templates",
    title: "Rapor şablonları",
    script: "scripts/report-templates.sql",
    table: "report_templates",
    description: "PDF/e-posta export şablonlarını kurumsal olarak saklar.",
  },
  {
    id: "admin-alerts",
    title: "Admin uyarıları",
    script: "scripts/create-admin-alerts.sql",
    table: "admin_alerts",
    description: "Riskli hassas veri ve sistem olaylarını admin gündemine düşürür.",
  },
  {
    id: "chip-system",
    title: "Merkezi çip sistemi",
    script: "scripts/chip-system.sql",
    table: "chip_templates",
    description: "Çip şablonları, tablo/kolon bağları ve satır çip değerleri.",
  },
  {
    id: "automation-rules",
    title: "Otomasyon kuralları",
    script: "scripts/automation-rules.sql",
    table: "automation_rules",
    description: "Kural motoru, otomasyon aksiyonları ve otomasyon logları.",
  },
  {
    id: "task-automation-state",
    title: "Otomasyon satır durumu",
    script: "scripts/task-automation-state.sql",
    table: "task_automation_state",
    description: "Otomasyonların satır rengi ve kilit durumunu canlı tabloya yansıtması.",
  },
  {
    id: "task-files",
    title: "Satır dosyaları",
    script: "scripts/task-files.sql",
    table: "task_files",
    description: "Satır detay panelindeki dosya ekleri ve depolama erişim kuralları.",
  },
];

function messageFromError(error: { code?: string; message?: string } | null | undefined): string {
  const code = String(error?.code ?? "");
  if (code === "42P01") return "Tablo bulunamadı; SQL script uygulanmamış olabilir.";
  if (code === "42501") return "Tablo var ancak mevcut oturum bu kontrolü okuyamıyor.";
  return error?.message || "Durum okunamadı.";
}

async function checkTable(table: string): Promise<{ status: SystemCheckStatus; message: string }> {
  if (!isSupabaseConfigured()) {
    return { status: "unknown", message: "Supabase ortam değişkenleri yapılandırılmamış." };
  }
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(1);
  if (!error) return { status: "ok", message: "Erişilebilir." };
  if (error.code === "42P01") return { status: "missing", message: messageFromError(error) };
  if (error.code === "42501") return { status: "warn", message: messageFromError(error) };
  return { status: "unknown", message: messageFromError(error) };
}

async function checkNotificationTriggers(): Promise<{ status: SystemCheckStatus; message: string }> {
  if (!isSupabaseConfigured()) {
    return { status: "unknown", message: "Supabase ortam değişkenleri yapılandırılmamış." };
  }
  const { data, error } = await supabase.rpc("notification_phase2_status");
  if (error) {
    const code = String(error.code ?? "");
    const msg = String(error.message ?? "").toLowerCase();
    if (code === "42883" || msg.includes("notification_phase2_status")) {
      return {
        status: "missing",
        message: "Faz 2 tetikleyici SQL'i uygulanmamış (notifications-assignment-triggers.sql).",
      };
    }
    return { status: "unknown", message: messageFromError(error) };
  }
  const row = data as {
    enqueue_notification?: boolean;
    project_trigger?: boolean;
    task_trigger?: boolean;
    refresh_overdue_fn?: boolean;
  } | null;
  const parts = [
    row?.project_trigger ? "proje" : null,
    row?.task_trigger ? "görev" : null,
    row?.refresh_overdue_fn ? "gecikme" : null,
  ].filter(Boolean);
  if (parts.length === 3 && row?.enqueue_notification) {
    return { status: "ok", message: "Proje/görev atama ve gecikme tetikleyicileri aktif." };
  }
  if (parts.length === 0) {
    return { status: "missing", message: "Tetikleyici bulunamadı; assignment-triggers SQL çalıştırın." };
  }
  return {
    status: "warn",
    message: `Kısmi kurulum (${parts.join(", ")}); notifications-assignment-triggers.sql tekrar çalıştırın.`,
  };
}

export async function loadSystemScriptChecks(): Promise<SystemScriptCheck[]> {
  const entries = await Promise.all(
    REQUIRED_SCRIPT_CHECKS.map(async (item) => {
      if (item.id === "notifications-triggers") {
        const result = await checkNotificationTriggers();
        return { ...item, ...result };
      }
      const result = await checkTable(item.table);
      return { ...item, ...result };
    })
  );
  return entries;
}

export type RecentPresenceRow = {
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  scope: string | null;
  project_id: string | null;
  row_id: string | null;
  last_seen_at: string | null;
};

export type SessionPresenceStatus = "active" | "recent" | "stale";

export type SystemBuildInfo = {
  version: string;
  commit: string;
  deployment: string;
  environment: string;
  realtimeDisabled: boolean;
};

export async function listRecentPresenceRows(): Promise<RecentPresenceRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from("presence_heartbeats")
    .select("user_id,user_email,user_name,scope,project_id,row_id,last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(40);
  if (error) {
    if (error.code !== "42P01") console.warn("[system admin] presence rows:", error.message);
    return [];
  }
  return (data ?? []) as RecentPresenceRow[];
}

export function getPresenceStatus(lastSeenAt?: string | null): SessionPresenceStatus {
  if (!lastSeenAt) return "stale";
  const time = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(time)) return "stale";
  const age = Date.now() - time;
  if (age <= 120_000) return "active";
  if (age <= 30 * 60_000) return "recent";
  return "stale";
}

export function getClientBuildInfo(): SystemBuildInfo {
  return {
    version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
    commit:
      process.env.NEXT_PUBLIC_GIT_SHA ||
      process.env.NEXT_PUBLIC_RAILWAY_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      "",
    deployment:
      process.env.NEXT_PUBLIC_RAILWAY_DEPLOYMENT_ID ||
      process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID ||
      "",
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "unknown",
    realtimeDisabled: String(process.env.NEXT_PUBLIC_DISABLE_REALTIME ?? "").trim().toLowerCase() === "true",
  };
}
