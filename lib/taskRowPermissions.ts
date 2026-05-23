import type { Project } from "@/types/project";
import type { RoleId } from "@/types/permissions";
import type { Task } from "@/types/tasks";
import { isTaskAssignedToMe, isTaskUnassigned } from "@/lib/taskAssignment";

type CanEditTaskRowInput = {
  hasBaseEditPermission: boolean;
  task: Pick<Task, "assignee" | "project_id">;
  project?: Pick<Project, "team_edit_all_tasks"> | null;
  viewerEmail?: string | null;
  viewerRoleId?: RoleId | null;
};

export function canEditTaskRow({
  hasBaseEditPermission,
  task,
  project,
  viewerEmail,
  viewerRoleId,
}: CanEditTaskRowInput): boolean {
  if (!hasBaseEditPermission) return false;
  if (viewerRoleId === "admin" || viewerRoleId === "project_manager") return true;
  if (project?.team_edit_all_tasks) return true;
  if (isTaskAssignedToMe(task.assignee, viewerEmail)) return true;
  return isTaskUnassigned(task.assignee);
}
