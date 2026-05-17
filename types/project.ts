/**
 * projects tablosu tipi (Supabase).
 * Sütunlar: id, name, description, status, created_at, updated_at, due_date?, priority?
 */
export type ProjectStatus = "Aktif" | "Tamamlandı" | "Beklemede";

export type ProjectPriority = "High" | "Medium" | "Low";

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  created_at: string | null;
  updated_at: string | null;
  /** Bu projede çalışabilecek kullanıcıların e-posta adresleri. Atanan kullanıcılar projeyi açıp canlı tablo verisiyle çalışabilir. */
  assigned_emails?: string[] | null;
  /** Proje hedef / bitiş tarihi (ISO date string). Yeni proje oluştururken veya düzenlerken tanımlanabilir. */
  due_date?: string | null;
  /** Varsayılan görev önceliği (proje önceliği). */
  priority?: ProjectPriority | null;
  /** Açıksa üye/izleyici yalnızca kendi atanan görevlerini ve atanmamış görevleri görür (RLS). Yönetici ve proje yöneticisi tümünü görür. */
  strict_assignee_visibility?: boolean;
  /** Canlı tabloda bu projeyle ilişkili görevler için `extra_data` sütunlarını önceden listelemek üzere başlık adları (import olmadan şema). */
  extra_column_keys?: string[] | null;
  /** Görev başlığı (Kanban kartı / Görev Özeti / mobil kart) için kullanılacak extra_data anahtarı. NULL → otomatik. */
  title_column?: string | null;
};
