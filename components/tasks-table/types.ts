import type { ReactNode } from "react";

export type TasksTableProps = {
  /** Üst seviyeden kontrol edilen proje filtresi. Verilmezse internal state kullanılır. */
  projectFilter?: string[];
  onProjectFilterChange?: (next: string[]) => void;
  viewTabs?: ReactNode;
  /** URL veya dış bağlantıdan gelen görev — yüklendiğinde detay paneli açılır. */
  initialOpenTaskId?: string | null;
};

export type ActiveEditableCell = {
  taskId: string;
  columnId: string;
};
