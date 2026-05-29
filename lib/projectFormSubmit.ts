import type { NewProjectSubmitData } from "@/components/projects/ProjectFormModal";
import { buildProjectImportTasks, type TaskInsert } from "@/lib/buildProjectImportTasks";
import {
  assigneeForRowRange,
  parseRowRangeAssignments,
} from "@/lib/importAssignment";
import { SMART_CHIP_COLUMN_PRESETS } from "@/lib/projectFormHelpers";
import {
  normalizeTaskAssigneeEmail,
  pickRoundRobinAssignee,
} from "@/lib/projectImportAssignee";
import { listChipCatalog, upsertTableChipBinding } from "@/lib/chipSystem";
import type { Project, ProjectPriority, ProjectStatus } from "@/types/project";
import type { Task } from "@/types/tasks";

export type { TaskInsert };

type SaveTaskResult = { ok: boolean; message?: string };

export type ProjectFormSubmitContext = {
  data: NewProjectSubmitData;
  editingProject: Project | null;
  isAdmin: boolean;
  canManageTeamTaskEditing: boolean;
  currentUserEmail: string;
  userEmail: string | undefined;
  tasks: Task[];
  updateProject: (
    id: string,
    payload: Partial<
      Pick<
        Project,
        | "name"
        | "description"
        | "status"
        | "assigned_emails"
        | "due_date"
        | "priority"
        | "strict_assignee_visibility"
        | "team_edit_all_tasks"
        | "extra_column_keys"
        | "title_column"
        | "subtitle_columns"
        | "wip_in_progress_limit"
        | "workflow_enabled"
        | "lock_on_approval"
      >
    >
  ) => Promise<void>;
  createProject: (payload: {
    name: string;
    description: string;
    status: ProjectStatus;
    assigned_emails?: string[] | null;
    due_date?: string | null;
    priority?: ProjectPriority | null;
    strict_assignee_visibility?: boolean;
    team_edit_all_tasks?: boolean;
    extra_column_keys?: string[] | null;
    title_column?: string | null;
    subtitle_columns?: string[] | null;
    wip_in_progress_limit?: number | null;
    workflow_enabled?: boolean;
    lock_on_approval?: boolean;
  }) => Promise<string | null>;
  createTasksBulk: (tasks: TaskInsert[]) => Promise<void>;
  updateTaskOptimistic: (
    taskId: string,
    patch: Partial<Pick<Task, "assignee" | "last_updated_by">>
  ) => void;
  saveTask: (
    taskId: string,
    patch: Partial<Pick<Task, "assignee" | "last_updated_by">>
  ) => Promise<SaveTaskResult>;
};

export async function ensureSmartChipBindings(
  projectId: string,
  columnLabels: string[] | undefined
): Promise<void> {
  const requested = (columnLabels ?? [])
    .map((label) => label.trim())
    .filter(Boolean);
  if (requested.length === 0) return;
  const catalog = await listChipCatalog([projectId]);
  for (const columnKey of requested) {
    const preset = SMART_CHIP_COLUMN_PRESETS.find(
      (item) => item.label.toLocaleLowerCase("tr") === columnKey.toLocaleLowerCase("tr")
    );
    if (!preset) continue;
    const template = catalog.templates.find(
      (item) => item.name.toLocaleLowerCase("tr") === preset.templateName.toLocaleLowerCase("tr")
    );
    if (!template) {
      console.warn(`[Projects] Çip şablonu bulunamadı: ${preset.templateName}`);
      continue;
    }
    await upsertTableChipBinding({
      projectId,
      columnKey,
      templateId: template.id,
    });
  }
}

export async function reassignExistingProjectTasks(params: {
  data: NewProjectSubmitData;
  projectTasks: Task[];
  effectiveAssignedEmails: string[];
  userEmail: string | undefined;
  updateTaskOptimistic: ProjectFormSubmitContext["updateTaskOptimistic"];
  saveTask: ProjectFormSubmitContext["saveTask"];
}): Promise<void> {
  const {
    data,
    projectTasks,
    effectiveAssignedEmails,
    userEmail,
    updateTaskOptimistic,
    saveTask,
  } = params;

  const targetTasks =
    data.reassignExistingTaskScope === "all"
      ? projectTasks
      : projectTasks.filter((t) => !t.assignee || t.assignee.trim() === "");
  const recipients = effectiveAssignedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const mode = data.reassignExistingTaskMode ?? "unassigned";
  const singleRaw = data.reassignExistingTaskAssignee?.trim() ?? "";
  const singleAssignee = normalizeTaskAssigneeEmail(singleRaw) ?? (singleRaw || null);
  const rangeAssignments =
    mode === "rowRanges" ? parseRowRangeAssignments(data.reassignExistingRowRangesText ?? "") : [];
  if (mode === "roundRobin" && recipients.length < 2) {
    throw new Error("Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.");
  }
  if (mode === "single" && !singleAssignee) {
    throw new Error("Tek kişiye atama için e-posta girilmeli.");
  }
  if (mode === "groupByColumn" && !(data.reassignExistingGroupByColumn ?? "").trim()) {
    throw new Error("Sütuna göre dağıtım için bir sütun seçilmeli.");
  }
  if (mode === "rowRanges" && rangeAssignments.length === 0) {
    throw new Error("Satır aralığına göre dağıtım için en az bir aralık girilmeli.");
  }
  for (let i = 0; i < targetTasks.length; i += 1) {
    const task = targetTasks[i];
    const groupValue =
      mode === "groupByColumn"
        ? String(task.extra_data?.[data.reassignExistingGroupByColumn ?? ""] ?? "").trim()
        : "";
    const groupAssignee =
      mode === "groupByColumn"
        ? normalizeTaskAssigneeEmail(data.reassignExistingGroupAssignments?.[groupValue])
        : null;
    const rangeAssignee =
      mode === "rowRanges" ? assigneeForRowRange(i + 1, rangeAssignments) : null;
    const nextAssignee =
      mode === "roundRobin"
        ? pickRoundRobinAssignee(recipients, i)
        : mode === "single"
          ? singleAssignee
          : mode === "groupByColumn"
            ? groupAssignee
            : mode === "rowRanges"
              ? rangeAssignee
              : null;
    updateTaskOptimistic(task.id, {
      assignee: nextAssignee,
      last_updated_by: userEmail ?? "anon",
    });
    const result = await saveTask(task.id, {
      assignee: nextAssignee,
      last_updated_by: userEmail ?? "anon",
    });
    if (!result.ok) throw new Error(result.message);
  }
}

function computeEffectiveAssignedEmails(
  data: NewProjectSubmitData,
  isAdmin: boolean,
  currentUserEmail: string
): string[] {
  const list = (data.assignedEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!isAdmin && currentUserEmail && !list.includes(currentUserEmail)) {
    list.push(currentUserEmail);
  }
  return Array.from(new Set(list));
}

export async function submitProjectForm(ctx: ProjectFormSubmitContext): Promise<void> {
  const {
    data,
    editingProject,
    isAdmin,
    canManageTeamTaskEditing,
    currentUserEmail,
    userEmail,
    tasks,
    updateProject,
    createProject,
    createTasksBulk,
    updateTaskOptimistic,
    saveTask,
  } = ctx;

  const effectiveAssignedEmails = computeEffectiveAssignedEmails(data, isAdmin, currentUserEmail);

  if (editingProject) {
    await updateProject(editingProject.id, {
      name: data.name,
      description: data.description,
      status: data.status,
      assigned_emails: effectiveAssignedEmails,
      due_date: data.due_date ?? null,
      priority: data.priority ?? null,
      extra_column_keys:
        data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : [],
      title_column: data.titleColumn ?? null,
      subtitle_columns: data.subtitleColumns ?? null,
      wip_in_progress_limit: data.wipInProgressLimit ?? null,
      workflow_enabled: data.workflowEnabled ?? false,
      lock_on_approval: (data.workflowEnabled ?? false) ? (data.lockOnApproval ?? false) : false,
      ...(isAdmin
        ? { strict_assignee_visibility: data.strictAssigneeVisibility ?? false }
        : {}),
      ...(canManageTeamTaskEditing
        ? { team_edit_all_tasks: data.teamEditAllTasks ?? false }
        : {}),
    });
    await ensureSmartChipBindings(editingProject.id, data.smartChipColumns);
    if (data.reassignExistingTasks) {
      const projectTasks = tasks.filter((t) => String(t.project_id ?? "") === editingProject.id);
      await reassignExistingProjectTasks({
        data,
        projectTasks,
        effectiveAssignedEmails,
        userEmail,
        updateTaskOptimistic,
        saveTask,
      });
    }
    return;
  }

  const projectId = await createProject({
    name: data.name,
    description: data.description,
    status: data.status,
    assigned_emails: effectiveAssignedEmails.length ? effectiveAssignedEmails : undefined,
    due_date: data.due_date ?? undefined,
    priority: data.priority ?? undefined,
    strict_assignee_visibility: isAdmin ? (data.strictAssigneeVisibility ?? false) : false,
    team_edit_all_tasks: canManageTeamTaskEditing ? (data.teamEditAllTasks ?? false) : false,
    extra_column_keys:
      data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : undefined,
    title_column: data.titleColumn ?? null,
    subtitle_columns: data.subtitleColumns ?? null,
    wip_in_progress_limit: data.wipInProgressLimit ?? null,
    workflow_enabled: data.workflowEnabled ?? false,
    lock_on_approval: (data.workflowEnabled ?? false) ? (data.lockOnApproval ?? false) : false,
  });
  if (projectId) {
    await ensureSmartChipBindings(projectId, data.smartChipColumns);
  }
  if (data.importFile && projectId) {
    const tasksToInsert = await buildProjectImportTasks(data, projectId, effectiveAssignedEmails);
    if (tasksToInsert.length > 0) {
      await createTasksBulk(tasksToInsert);
    }
  }
}
