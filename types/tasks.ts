/**
 * tasks tablosu tipi (Supabase).
 * Sütunlar: id, content, status, assignee, last_updated_by, priority (opsiyonel), updated_at (opsiyonel), project_id (opsiyonel)
 */
export type Task = {
  id: string;
  content: string;
  status: string;
  assignee: string | null;
  last_updated_by: string | null;
  /** High | Medium | Low - Supabase'e priority sütunu eklenirse kullanılır */
  priority?: string | null;
  /** Son güncelleme zamanı (ISO string) - updated_at sütunu varsa */
  updated_at?: string | null;
  /** Projeye bağlı görev için projects.id (FK) */
  project_id?: string | null;
  /** Son tarih (ISO date string, opsiyonel) */
  due_date?: string | null;
  /** CSV'den veya dış kaynaktan gelen tüm sütunlar — olduğu gibi saklanır (JSON). */
  extra_data?: Record<string, string> | null;
  /** Onay akışı durumu. Projede workflow kapalıysa null kalabilir. */
  workflow_status?: "draft" | "submitted" | "revision_requested" | "approved" | "rejected" | null;
  workflow_submitted_at?: string | null;
  workflow_reviewed_at?: string | null;
  workflow_reviewed_by?: string | null;
  [key: string]: unknown;
};
