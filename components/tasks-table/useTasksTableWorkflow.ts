"use client";

import { useCallback } from "react";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import type { ProjectMemberPermission } from "@/lib/projectMemberPermissions";
import {
  logTaskWorkflowEvent,
  nextWorkflowStatus,
  normalizeWorkflowStatus,
  WORKFLOW_ACTION_LABELS,
  type TaskWorkflowAction,
} from "@/lib/taskWorkflow";
import { isStatusDone, isStatusInProgress, getStatusKind } from "@/lib/statusKind";
import { notifyWorkflowEvent } from "@/lib/notifications";

type AuthUser = { email?: string | null; roleId?: string | null };
type ToastApi = {
  error: (msg: string) => void;
  success: (msg: string) => void;
  warning: (msg: string) => void;
};

export type UseTasksTableWorkflowOptions = {
  projectById: Map<string, Project>;
  user: AuthUser | null;
  isAdmin: boolean;
  canEditRow: (task: Task) => boolean;
  getProjectPermissionForTask: (task: Task) => ProjectMemberPermission | null;
  saveTask: (id: string, patch: Partial<Task>) => Promise<{ ok: boolean; message?: string }>;
  updateTaskOptimistic: (id: string, patch: Partial<Task>) => void;
  fetchTasks: () => Promise<void>;
  toast: ToastApi;
  promptUser: (args: {
    title: string;
    message: string;
    placeholder?: string;
    confirmLabel?: string;
    required?: boolean;
    multiline?: boolean;
    rows?: number;
  }) => Promise<string | null | undefined>;
};

export function useTasksTableWorkflow({
  projectById,
  user,
  isAdmin,
  canEditRow,
  getProjectPermissionForTask,
  saveTask,
  updateTaskOptimistic,
  fetchTasks,
  toast,
  promptUser,
}: UseTasksTableWorkflowOptions) {
  const isProjectWorkflowEnabled = useCallback(
    (task: Task) => {
      const project = task.project_id ? projectById.get(String(task.project_id)) ?? null : null;
      return project?.workflow_enabled === true;
    },
    [projectById]
  );

  const canReviewWorkflowRow = useCallback(
    (task: Task) => {
      if (!isProjectWorkflowEnabled(task)) return false;
      if (isAdmin || user?.roleId === "project_manager") return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.project_role === "project_owner" || projectPermission.project_role === "project_manager" : false;
    },
    [getProjectPermissionForTask, isAdmin, isProjectWorkflowEnabled, user?.roleId]
  );

  const getWorkflowActionsForTask = useCallback(
    (task: Task): TaskWorkflowAction[] => {
      if (!isProjectWorkflowEnabled(task)) return [];
      const workflowStatus = normalizeWorkflowStatus(task.workflow_status);
      const project = task.project_id ? projectById.get(String(task.project_id)) ?? null : null;
      const lockActive = project?.lock_on_approval === true && workflowStatus === "approved";
      const rowCanEdit = canEditRow(task);
      const canReview = canReviewWorkflowRow(task);
      const actions: TaskWorkflowAction[] = [];
      // "Kontrole gönder" yalnızca iş başlamışsa görünür (status kind != "todo").
      // Yapılacak statüsündeki bir satır kontrole gönderilemez — önce "Devam"a alınmalı.
      const statusKind = getStatusKind(task.status ?? null);
      const submitGateOpen = statusKind !== "todo";
      if (
        rowCanEdit &&
        submitGateOpen &&
        (workflowStatus === "draft" || workflowStatus === "revision_requested" || workflowStatus === "rejected")
      ) {
        actions.push("submit");
      }
      if (canReview && workflowStatus === "submitted") {
        actions.push("approve", "request_revision", "reject");
      }
      // Approved + lock_on_approval:
      //   - Yetkili (reviewer) "Kilidi aç" görür.
      //   - Yetkisi olmayan (üye dahil) "Kilit açma talep et" görür.
      if (lockActive && canReview) {
        actions.push("unlock");
      } else if (lockActive && !canReview) {
        actions.push("unlock_request");
      }
      // 'reset' (Taslağa al): kilitli durumda gizlenir; kilit kapalıyken edit/review yetkili görür.
      if (!lockActive && (rowCanEdit || canReview) && workflowStatus !== "draft") {
        actions.push("reset");
      }
      return actions;
    },
    [canEditRow, canReviewWorkflowRow, isProjectWorkflowEnabled, projectById]
  );

  const handleWorkflowAction = useCallback(
    async (task: Task, action: TaskWorkflowAction) => {
      if (!isProjectWorkflowEnabled(task)) return;

      // Revize iste / Reddet / Kilit açma talep et aksiyonlarında zorunlu açıklama notu al.
      let note: string | null = null;
      if (action === "request_revision" || action === "reject" || action === "unlock_request") {
        const titleByAction =
          action === "reject" ? "Reddet" :
          action === "request_revision" ? "Revize İste" :
          "Kilit Açma Talep Et";
        const messageByAction =
          action === "reject"
            ? "Ret nedenini ve düzeltilmesi gereken noktaları yazın. Bu not satırı gönderen üyeye iletilecek."
            : action === "request_revision"
              ? "Revize nedenini ve düzeltilmesi gerekenleri yazın. Bu not satırı gönderen üyeye iletilecek."
              : "Kilidin neden açılması gerektiğini yazın. Bu talep proje yetkilisine iletilecek; kilidi onlar açacaktır.";
        const placeholderByAction =
          action === "reject"
            ? "Örn. Eksik belge — fatura kopyası eklenmemiş."
            : action === "request_revision"
              ? "Örn. Tarih alanı yanlış; lütfen güncelleyip tekrar gönderin."
              : "Örn. Tutar bilgisi hatalı, satırı tekrar düzenlemem gerekiyor.";
        const confirmLabelByAction =
          action === "reject" ? "Reddet" :
          action === "request_revision" ? "Revize iste" :
          "Talep gönder";
        const result = await promptUser({
          title: titleByAction,
          message: messageByAction,
          placeholder: placeholderByAction,
          confirmLabel: confirmLabelByAction,
          required: true,
          multiline: true,
          rows: 4,
        });
        if (result == null || !result.trim()) {
          // Kullanıcı vazgeçti — hiçbir değişiklik uygulanmaz.
          return;
        }
        note = result.trim();
      }

      // Kilit açma talebi: satır statüsü DEĞİŞMEZ — sadece event log + bildirim.
      if (action === "unlock_request") {
        const fromStatus = normalizeWorkflowStatus(task.workflow_status);
        void logTaskWorkflowEvent({
          taskId: task.id,
          projectId: task.project_id ?? null,
          fromStatus,
          toStatus: fromStatus, // statü aynı kalır (approved)
          action: "unlock_request",
          actorEmail: user?.email ?? null,
          note,
        });
        void notifyWorkflowEvent({
          taskId: task.id,
          action: "unlock_request",
          toStatus: fromStatus,
          note,
        }).then((res) => {
          if (res === "error") {
            toast.warning("Bildirim gönderilemedi");
          }
        });
        toast.success("Kilit açma talebi gönderildi");
        return;
      }

      const fromStatus = normalizeWorkflowStatus(task.workflow_status);
      const toStatus = nextWorkflowStatus(action);
      const nowIso = new Date().toISOString();
      const patch: Partial<Task> = {
        workflow_status: toStatus,
        last_updated_by: user?.email ?? "anon",
      };
      if (action === "submit") {
        patch.workflow_submitted_at = nowIso;
        patch.workflow_reviewed_at = null;
        patch.workflow_reviewed_by = null;
      } else if (action === "approve" || action === "request_revision" || action === "reject") {
        patch.workflow_reviewed_at = nowIso;
        patch.workflow_reviewed_by = user?.email ?? null;
        // Onay/durum bağlama: onaylandığında satır resmen tamamlanmış sayılır;
        // reddedildiğinde / revize istendiğinde üye işine devam etmeli.
        // Eğer mevcut status zaten doğru "kind"deyse dokunma (kullanıcı özel
        // status etiketi kullanıyor olabilir).
        if (action === "approve" && !isStatusDone(task.status ?? null)) {
          patch.status = "Tamamlandı";
        } else if (
          (action === "request_revision" || action === "reject") &&
          !isStatusInProgress(task.status ?? null)
        ) {
          patch.status = "Devam";
        }
      } else if (action === "reset") {
        patch.workflow_submitted_at = null;
        patch.workflow_reviewed_at = null;
        patch.workflow_reviewed_by = null;
      } else if (action === "unlock") {
        // Kilidi aç: satır draft'a döner, gönderim/inceleme zaman damgaları sıfırlanır.
        // Denetim için workflow_reviewed_by'a kilidi açanın e-postası yazılır.
        patch.workflow_submitted_at = null;
        patch.workflow_reviewed_at = nowIso;
        patch.workflow_reviewed_by = user?.email ?? null;
      }
      updateTaskOptimistic(task.id, patch);
      const result = await saveTask(task.id, patch);
      if (!result.ok) {
        toast.error(result.message ?? "Kaydedilemedi");
        await fetchTasks();
        return;
      }
      void logTaskWorkflowEvent({
        taskId: task.id,
        projectId: task.project_id ?? null,
        fromStatus,
        toStatus,
        action,
        actorEmail: user?.email ?? null,
        note,
      });

      // Bildirim: submit/approve/request_revision/reject/unlock. 'reset' için bildirim yok.
      if (
        action === "submit" ||
        action === "approve" ||
        action === "request_revision" ||
        action === "reject" ||
        action === "unlock"
      ) {
        void notifyWorkflowEvent({
          taskId: task.id,
          action,
          toStatus,
          note,
        }).then((result) => {
          // "missing_rpc" → migration uygulanmamış; sessizce geç (workflow geçişi yine de tamam).
          // "error" → gerçek bir hata; kullanıcıyı uyar ama workflow geri alma yok.
          if (result === "error") {
            toast.warning("Bildirim gönderilemedi");
          }
        });
      }

      toast.success(WORKFLOW_ACTION_LABELS[action]);
    },
    [fetchTasks, isProjectWorkflowEnabled, promptUser, saveTask, toast, updateTaskOptimistic, user?.email]
  );

  return {
    isProjectWorkflowEnabled,
    getWorkflowActionsForTask,
    handleWorkflowAction,
  };
}
