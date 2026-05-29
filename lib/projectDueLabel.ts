import type { Project } from "@/types/project";

/** Proje hedef tarihine göre "Gecikmiş" veya "Yaklaşan" etiketi (proje tamamlanmamışken). */
export function getProjectDueLabel(
  project: Pick<Project, "due_date" | "status">
): "Gecikmiş" | "Yaklaşan" | null {
  if (project.status === "Tamamlandı") return null;
  const d = project.due_date?.trim();
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() < today.getTime()) return "Gecikmiş";
  const inDays = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (inDays <= 30) return "Yaklaşan";
  return null;
}
