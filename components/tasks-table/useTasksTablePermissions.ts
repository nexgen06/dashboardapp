"use client";

import { useCallback, useRef } from "react";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import { canEditTaskRow } from "@/lib/taskRowPermissions";
import { evaluateSensitivePolicy, logSensitivePolicyShadow } from "@/lib/sensitiveFieldPolicy";
import type { TaskAutomationState } from "@/lib/taskAutomationState";
import type { ProjectMemberPermission } from "@/lib/projectMemberPermissions";
import { normalizeWorkflowStatus } from "@/lib/taskWorkflow";

import type { RoleId } from "@/types/permissions";

type AuthUser = {
  id?: string;
  email?: string | null;
  roleId?: RoleId | null;
};

export type UseTasksTablePermissionsOptions = {
  projectById: Map<string, Project>;
  projectPermissionsByProjectId: Record<string, ProjectMemberPermission>;
  rowAutomationStateByTaskId: Map<string, TaskAutomationState>;
  user: AuthUser | null;
  isAdmin: boolean;
  currentUserEmail: string;
  canEditTask: boolean;
  canCommentTask: boolean;
  canCopyCell: boolean;
  canBulkUpdate: boolean;
  canBulkDelete: boolean;
  canExportCsv: boolean;
  canExportAllRows: boolean;
  canExportSensitiveUnmasked: boolean;
  canViewSensitiveCells: boolean;
};

export function useTasksTablePermissions({
  projectById,
  projectPermissionsByProjectId,
  rowAutomationStateByTaskId,
  user,
  isAdmin,
  currentUserEmail,
  canEditTask,
  canCommentTask,
  canCopyCell,
  canBulkUpdate,
  canBulkDelete,
  canExportCsv,
  canExportAllRows,
  canExportSensitiveUnmasked,
  canViewSensitiveCells,
}: UseTasksTablePermissionsOptions) {
  const sensitiveViewShadowSeenAtRef = useRef<Map<string, number>>(new Map());

  const getProjectPermissionForTask = useCallback(
    (task: Task) => {
      const projectId = task.project_id ? String(task.project_id) : "";
      if (!projectId) return null;
      return projectPermissionsByProjectId[projectId] ?? null;
    },
    [projectPermissionsByProjectId]
  );

  /** Workflow onay kilidi: satır approved + proje lock_on_approval açık + kullanıcı yetkili değilse true. */
  const isRowLockedByApproval = useCallback(
    (task: Task) => {
      const project = task.project_id ? projectById.get(String(task.project_id)) ?? null : null;
      if (!project?.workflow_enabled || !project?.lock_on_approval) return false;
      const ws = normalizeWorkflowStatus(task.workflow_status);
      if (ws !== "approved") return false;
      if (isAdmin || user?.roleId === "project_manager") return false;
      const projectPermission = getProjectPermissionForTask(task);
      const isReviewer = projectPermission
        ? projectPermission.project_role === "project_owner" || projectPermission.project_role === "project_manager"
        : false;
      return !isReviewer;
    },
    [getProjectPermissionForTask, isAdmin, projectById, user?.roleId]
  );

  const canEditRow = useCallback(
    (task: Task) => {
      const baseAllowed = canEditTaskRow({
        hasBaseEditPermission: canEditTask,
        task,
        project: task.project_id ? projectById.get(String(task.project_id)) ?? null : null,
        viewerEmail: currentUserEmail,
        viewerRoleId: user?.roleId ?? null,
      });
      if (!baseAllowed) return false;
      if (isAdmin) return true;
      // Onay sonrası kilit: yetkili olmayan kullanıcı approved satırı düzenleyemez.
      if (isRowLockedByApproval(task)) return false;
      const automationState = rowAutomationStateByTaskId.get(task.id);
      if (automationState?.locked && user?.roleId !== "project_manager") return false;

      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_edit : baseAllowed;
    },
    [canEditTask, currentUserEmail, getProjectPermissionForTask, isAdmin, isRowLockedByApproval, projectById, rowAutomationStateByTaskId, user?.roleId]
  );

  const canCommentRow = useCallback(
    (task: Task) => {
      if (!canCommentTask || !canEditRow(task)) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_comment : true;
    },
    [canCommentTask, canEditRow, getProjectPermissionForTask, isAdmin]
  );

  const canCopyRow = useCallback(
    (task: Task) => {
      if (!canCopyCell) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_copy : true;
    },
    [canCopyCell, getProjectPermissionForTask, isAdmin]
  );

  const canBulkUpdateRow = useCallback(
    (task: Task) => {
      if (!canBulkUpdate || !canEditRow(task)) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_bulk_update : true;
    },
    [canBulkUpdate, canEditRow, getProjectPermissionForTask, isAdmin]
  );

  const canBulkDeleteRow = useCallback(
    (task: Task) => {
      if (!canBulkDelete || !canEditRow(task)) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_bulk_delete : true;
    },
    [canBulkDelete, canEditRow, getProjectPermissionForTask, isAdmin]
  );

  const canExportRow = useCallback(
    (task: Task) => {
      if (!canExportCsv) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      if (projectPermission) return projectPermission.can_view && projectPermission.can_export;
      return canExportAllRows ? true : canEditRow(task);
    },
    [canEditRow, canExportAllRows, canExportCsv, getProjectPermissionForTask, isAdmin]
  );

  const canExportUnmaskedRow = useCallback(
    (task: Task) => {
      if (!canExportSensitiveUnmasked) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_export_unmasked : true;
    },
    [canExportSensitiveUnmasked, getProjectPermissionForTask, isAdmin]
  );

  const logSensitivePolicyDecision = useCallback(
    async ({
      fieldKey,
      action,
      legacyDecision,
      task,
      context,
      projectId,
    }: {
      fieldKey: string;
      action: "view" | "edit" | "copy" | "export_masked" | "export_unmasked";
      legacyDecision: "allow" | "deny";
      task?: Task | null;
      context?: Record<string, unknown>;
      projectId?: string | null;
    }) => {
      if (!user?.id || !user?.email) return;
      const resolvedProjectId =
        projectId != null
          ? projectId
          : task?.project_id
            ? String(task.project_id)
            : null;
      const policy = await evaluateSensitivePolicy({
        fieldKey,
        action,
        roleId: user?.roleId ?? "member",
        projectId: resolvedProjectId,
      });
      await logSensitivePolicyShadow({
        userId: user.id,
        userEmail: user.email,
        fieldName: fieldKey,
        action,
        legacyDecision,
        policyDecision: policy.decision,
        policyId: policy.policyId,
        enforced: false,
        context: {
          ...(context ?? {}),
          projectId: resolvedProjectId,
          reasonRequired: policy.reasonRequired,
          policyPriority: policy.priority,
        },
      });
    },
    [user?.id, user?.email, user?.roleId]
  );

  const trackSensitiveViewShadow = useCallback(
    (task: Task, fieldKey: string) => {
      const nowMs = Date.now();
      const dedupeKey = `${task.id}:${fieldKey}:${user?.id ?? "anon"}`;
      const lastSeenAt = sensitiveViewShadowSeenAtRef.current.get(dedupeKey) ?? 0;
      if (nowMs - lastSeenAt < 30000) return;
      sensitiveViewShadowSeenAtRef.current.set(dedupeKey, nowMs);
      void logSensitivePolicyDecision({
        fieldKey,
        action: "view",
        legacyDecision: canViewSensitiveCells ? "allow" : "deny",
        task,
        context: { source: "table-hover-view" },
      });
    },
    [canViewSensitiveCells, logSensitivePolicyDecision, user?.id]
  );

  return {
    getProjectPermissionForTask,
    isRowLockedByApproval,
    canEditRow,
    canCommentRow,
    canCopyRow,
    canBulkUpdateRow,
    canBulkDeleteRow,
    canExportRow,
    canExportUnmaskedRow,
    logSensitivePolicyDecision,
    trackSensitiveViewShadow,
  };
}
