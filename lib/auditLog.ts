/**
 * Audit log okuma katmanı.
 *
 * Yazma DB trigger ile otomatik; istemci sadece okur.
 * Hassas alanların (TCKN/sicil) before/after değerleri okuma sırasında
 * maskelenir — istemci kodu hiçbir zaman ham değer görmez bile.
 */
import { supabase } from "@/lib/supabaseClient";
import { isSensitiveExtraColumnKey, maskSensitiveExtraValue } from "@/lib/extraColumnSensitiveDisplay";
import { normalizeWorkflowStatus, WORKFLOW_STATUS_LABELS } from "@/lib/taskWorkflow";

export type AuditAction = "insert" | "update" | "delete";

export type AuditFieldDiff = {
  before: unknown;
  after: unknown;
};

export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  tableName: string;
  recordId: string;
  action: AuditAction;
  /**
   * UPDATE → { fieldName: { before, after } }
   * INSERT/DELETE → { _full: snapshot }
   * extra_data içindeki hassas key'ler maskelenmiş gelir.
   */
  changedFields: Record<string, AuditFieldDiff | unknown>;
  at: Date;
};

type RawRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  table_name: string;
  record_id: string;
  action: string;
  changed_fields: Record<string, unknown> | null;
  at: string;
};

/** Hassas key'leri tek satırda maskele — extra_data diff'leri için */
function maskExtraDataInJsonb(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isSensitiveExtraColumnKey(k)) {
      const raw = v == null ? "" : String(v);
      out[k] = raw ? maskSensitiveExtraValue(raw) : raw;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Snapshot/diff içinde extra_data alanlarını maskele */
function sanitizeChangedFields(raw: Record<string, unknown> | null): Record<string, AuditFieldDiff | unknown> {
  if (!raw) return {};
  const out: Record<string, AuditFieldDiff | unknown> = {};
  for (const [field, value] of Object.entries(raw)) {
    if (field === "_full") {
      // INSERT/DELETE snapshot
      const snap = value as Record<string, unknown> | null;
      if (snap && typeof snap === "object") {
        out._full = {
          ...snap,
          ...(snap.extra_data ? { extra_data: maskExtraDataInJsonb(snap.extra_data) } : {}),
        };
      } else {
        out._full = value;
      }
    } else if (field === "extra_data") {
      // UPDATE diff'i — extra_data tümüyle değiştiyse
      const diff = value as AuditFieldDiff;
      out.extra_data = {
        before: maskExtraDataInJsonb(diff?.before),
        after: maskExtraDataInJsonb(diff?.after),
      };
    } else {
      out[field] = value;
    }
  }
  return out;
}

function rowToEntry(r: RawRow): AuditLogEntry {
  return {
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_email,
    tableName: r.table_name,
    recordId: r.record_id,
    action: (r.action === "insert" || r.action === "update" || r.action === "delete"
      ? r.action
      : "update") as AuditAction,
    changedFields: sanitizeChangedFields(r.changed_fields),
    at: new Date(r.at),
  };
}

/**
 * Bir kaydın değişim geçmişini getir (yeniden eskiye).
 *
 * @param tableName "tasks" | "projects" vb.
 * @param recordId hedef kaydın UUID'si
 * @param limit varsayılan 50
 */
export async function fetchAuditLog(
  tableName: string,
  recordId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, actor_id, actor_email, table_name, record_id, action, changed_fields, at")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[auditLog] fetch failed:", error);
    return [];
  }
  return (data ?? []).map((r) => rowToEntry(r as RawRow));
}

/**
 * Belirli bir projedeki son aktiviteyi getirir.
 * - Projenin kendi audit log'u (projects tablosunda projectId kaydı)
 * - Bu projeye bağlı görevlerin audit log'u (tasks tablosunda taskIds)
 *
 * @param projectId proje UUID'si
 * @param taskIds projedeki görev UUID'leri (mevcut belleğe yüklenmiş olanlar)
 * @param limit varsayılan 30
 */
export async function fetchProjectActivity(
  projectId: string,
  taskIds: string[],
  limit: number = 30
): Promise<AuditLogEntry[]> {
  const select = "id, actor_id, actor_email, table_name, record_id, action, changed_fields, at";
  const order = { column: "at", ascending: false } as const;

  // Projenin kendi log'u
  const projectQuery = supabase
    .from("audit_log")
    .select(select)
    .eq("table_name", "projects")
    .eq("record_id", projectId)
    .order(order.column, { ascending: order.ascending })
    .limit(limit);

  // Bu projedeki görevlerin log'u — taskIds boşsa sorgu atlanır
  const taskQuery =
    taskIds.length > 0
      ? supabase
          .from("audit_log")
          .select(select)
          .eq("table_name", "tasks")
          .in("record_id", taskIds)
          .order(order.column, { ascending: order.ascending })
          .limit(limit)
      : Promise.resolve({ data: [] as RawRow[], error: null });

  const [pRes, tRes] = await Promise.all([projectQuery, taskQuery]);
  if (pRes.error) console.warn("[auditLog] project fetch failed:", pRes.error);
  if (tRes.error) console.warn("[auditLog] tasks fetch failed:", tRes.error);

  const all = [
    ...((pRes.data ?? []) as RawRow[]),
    ...((tRes.data ?? []) as RawRow[]),
  ];
  all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return all.slice(0, limit).map(rowToEntry);
}

/** Insan-okunabilir alan adı (UI sözlüğü) — fallback: olduğu gibi */
const FIELD_LABELS: Record<string, string> = {
  content: "İçerik",
  status: "Durum",
  assignee: "Atanan",
  priority: "Öncelik",
  due_date: "Son tarih",
  project_id: "Proje",
  extra_data: "Ek alanlar",
  last_updated_by: "Son güncelleyen",
  name: "Ad",
  description: "Açıklama",
  assigned_emails: "Atanan kişiler",
  strict_assignee_visibility: "Sıkı görünürlük",
  extra_column_keys: "Ek sütun şeması",
  workflow_status: "Onay durumu",
  workflow_submitted_at: "Kontrole gönderim",
  workflow_reviewed_at: "İnceleme zamanı",
  workflow_reviewed_by: "İnceleyen",
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/** before/after değerlerini insan dostu metne çevir */
export function formatAuditValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.trim() === "" ? "—" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.join(", ");
  if (typeof value === "object") {
    // extra_data gibi
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v != null && String(v).trim() !== ""
    );
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ");
  }
  return String(value);
}

function isIsoDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function formatDateTimeValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Alan bağlamını bilen daha okunur değer formatlayıcı. */
export function formatAuditFieldValue(field: string, value: unknown): string {
  if (field === "workflow_status") {
    if (value == null || String(value).trim() === "") return "—";
    return WORKFLOW_STATUS_LABELS[normalizeWorkflowStatus(String(value) as never)];
  }
  if (
    field === "workflow_submitted_at" ||
    field === "workflow_reviewed_at" ||
    field === "due_date"
  ) {
    if (value == null || String(value).trim() === "") return "—";
    return formatDateTimeValue(String(value));
  }
  if (typeof value === "string" && isIsoDateLike(value)) {
    return formatDateTimeValue(value);
  }
  return formatAuditValue(value);
}

const LOW_SIGNAL_TASK_AUDIT_FIELDS = new Set([
  "last_updated_by",
  "workflow_submitted_at",
  "workflow_reviewed_at",
  "workflow_reviewed_by",
]);

export function shouldShowAuditField(field: string, totalChangedFields: number): boolean {
  if (totalChangedFields <= 1) return true;
  return !LOW_SIGNAL_TASK_AUDIT_FIELDS.has(field);
}
