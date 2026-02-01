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
  /** Proje önceliği. Görev listesinde varsayılan öncelik veya filtreleme için kullanılabilir. */
  priority?: ProjectPriority | null;
};
