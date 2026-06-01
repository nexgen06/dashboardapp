import type { ReactNode } from "react";

/** Modern toolbar ViewTypeTabs'ında seçilebilen görünüm tipi. */
export type LiveTableViewMode = "table" | "kanban" | "gantt" | "calendar" | "risk";

export type TasksTableProps = {
  /** Üst seviyeden kontrol edilen proje filtresi. Verilmezse internal state kullanılır. */
  projectFilter?: string[];
  onProjectFilterChange?: (next: string[]) => void;
  viewTabs?: ReactNode;
  /** URL veya dış bağlantıdan gelen görev — yüklendiğinde detay paneli açılır. */
  initialOpenTaskId?: string | null;
  /**
   * Modern toolbar'da aktif görünüm (Tablo/Kanban/Gantt/Takvim/Risk).
   * Verilmezse "table" sabit kalır, segmented control no-op olur.
   */
  viewMode?: LiveTableViewMode;
  onViewModeChange?: (mode: LiveTableViewMode) => void;
};

export type ActiveEditableCell = {
  taskId: string;
  columnId: string;
};
