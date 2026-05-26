"use client";

import { useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { usePrompt } from "@/components/ui/modals";
import {
  logTaskWorkflowEvent,
  normalizeWorkflowStatus,
  nextWorkflowStatus,
  type TaskWorkflowAction,
} from "@/lib/taskWorkflow";
import { notifyWorkflowEvent, type WorkflowNotificationAction } from "@/lib/notifications";
import { isStatusDone, isStatusInProgress } from "@/lib/statusKind";

/**
 * Bildirim çanından (veya başka kompakt arayüzlerden) tek tık workflow aksiyonu
 * tetiklemek için ortak hook.
 *
 * Akış:
 *   1) Reddet / Revize için zorunlu açıklama modali aç
 *   2) Mevcut task durumunu DB'den çek (undo için snapshot)
 *   3) Patch'i hesapla (workflow_status + auto status bağlama)
 *   4) `tasks.update().select()` (RLS sessiz blok yakalama)
 *   5) `task_workflow_events` log + `create_workflow_notification` RPC
 *   6) Varsa bildirimi okundu işaretle (`onMarkRead`)
 *   7) Başarılı toast + "Geri al" aksiyonu (6sn)
 *
 * "Geri al" snapshot'tan workflow_status / status / timestamp'leri restore eder
 * ve `task_workflow_events`'a `reset` aksiyonu yazarak audit izini bozmaz.
 */

export type QuickWorkflowAction = "approve" | "request_revision" | "reject" | "unlock";

const ACTION_LABELS: Record<QuickWorkflowAction, string> = {
  approve: "Onaylandı",
  request_revision: "Revize istendi",
  reject: "Reddedildi",
  unlock: "Kilit açıldı",
};

type TaskSnapshot = {
  workflow_status: string | null;
  workflow_submitted_at: string | null;
  workflow_reviewed_at: string | null;
  workflow_reviewed_by: string | null;
  status: string | null;
};

export function useWorkflowQuickAction() {
  const { user } = useAuth();
  const toast = useToast();
  const promptUser = usePrompt();

  return useCallback(
    async (input: {
      taskId: string;
      action: QuickWorkflowAction;
      notificationSourceKey?: string;
      onMarkRead?: (sourceKey: string) => void | Promise<void>;
    }): Promise<boolean> => {
      if (!isSupabaseConfigured()) {
        toast.error("Sistem bağlantısı yok");
        return false;
      }
      const { taskId, action } = input;

      // 1) Zorunlu açıklama (reddet / revize)
      let note: string | null = null;
      if (action === "request_revision" || action === "reject") {
        const isReject = action === "reject";
        const noteResult = await promptUser({
          title: isReject ? "Reddet" : "Revize İste",
          message: isReject
            ? "Ret nedenini ve düzeltilmesi gereken noktaları yazın. Bu not satırı gönderen üyeye iletilecek."
            : "Revize nedenini ve düzeltilmesi gerekenleri yazın. Bu not satırı gönderen üyeye iletilecek.",
          placeholder: isReject
            ? "Örn. Eksik belge — fatura kopyası eklenmemiş."
            : "Örn. Tarih alanı yanlış; lütfen güncelleyip tekrar gönderin.",
          confirmLabel: isReject ? "Reddet" : "Revize iste",
          required: true,
          multiline: true,
          rows: 4,
        });
        if (!noteResult || !noteResult.trim()) return false;
        note = noteResult.trim();
      }

      // 2) Mevcut durumu çek
      const { data: taskRow, error: fetchError } = await supabase
        .from("tasks")
        .select(
          "id,project_id,workflow_status,workflow_submitted_at,workflow_reviewed_at,workflow_reviewed_by,status,content"
        )
        .eq("id", taskId)
        .maybeSingle();
      if (fetchError) {
        toast.error("Görev okunamadı: " + fetchError.message);
        return false;
      }
      if (!taskRow) {
        toast.error("Görev bulunamadı");
        return false;
      }

      const snapshot: TaskSnapshot = {
        workflow_status: taskRow.workflow_status,
        workflow_submitted_at: taskRow.workflow_submitted_at,
        workflow_reviewed_at: taskRow.workflow_reviewed_at,
        workflow_reviewed_by: taskRow.workflow_reviewed_by,
        status: taskRow.status,
      };

      // 3) Patch
      const fromStatus = normalizeWorkflowStatus(taskRow.workflow_status);
      const toStatus = nextWorkflowStatus(action as TaskWorkflowAction);
      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = {
        workflow_status: toStatus,
        last_updated_by: user?.email ?? "anon",
      };
      if (action === "approve" || action === "request_revision" || action === "reject") {
        patch.workflow_reviewed_at = nowIso;
        patch.workflow_reviewed_by = user?.email ?? null;
        if (action === "approve" && !isStatusDone(taskRow.status ?? null)) {
          patch.status = "Tamamlandı";
        } else if (
          (action === "request_revision" || action === "reject") &&
          !isStatusInProgress(taskRow.status ?? null)
        ) {
          patch.status = "Devam";
        }
      } else if (action === "unlock") {
        patch.workflow_submitted_at = null;
        patch.workflow_reviewed_at = nowIso;
        patch.workflow_reviewed_by = user?.email ?? null;
      }

      // 4) Update + RLS sessiz blok kontrolü
      const { data: updated, error: updateError } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", taskId)
        .select("id");
      if (updateError) {
        toast.error(updateError.message || "Güncelleme başarısız");
        return false;
      }
      if (!updated || updated.length === 0) {
        toast.error("Bu satırı güncelleme yetkiniz yok (RLS engelledi).");
        return false;
      }

      // 5) Audit + bildirim
      void logTaskWorkflowEvent({
        taskId,
        projectId: taskRow.project_id ?? null,
        fromStatus,
        toStatus,
        action: action as TaskWorkflowAction,
        actorEmail: user?.email ?? null,
        note,
      });
      void notifyWorkflowEvent({
        taskId,
        action: action as WorkflowNotificationAction,
        toStatus,
        note,
      }).then((res) => {
        if (res === "error") toast.warning("Bildirim gönderilemedi");
      });

      // 6) İlgili çan bildirimini okundu yap
      if (input.notificationSourceKey && input.onMarkRead) {
        void input.onMarkRead(input.notificationSourceKey);
      }

      // 7) Başarılı toast + Geri al (6sn)
      const summary =
        typeof taskRow.content === "string" && taskRow.content.trim().length > 0
          ? taskRow.content.slice(0, 80)
          : undefined;

      toast.success(ACTION_LABELS[action], {
        description: summary,
        durationMs: 6000,
        action: {
          label: "Geri al",
          onClick: () => {
            void (async () => {
              const revertPatch: Record<string, unknown> = {
                workflow_status: snapshot.workflow_status,
                workflow_submitted_at: snapshot.workflow_submitted_at,
                workflow_reviewed_at: snapshot.workflow_reviewed_at,
                workflow_reviewed_by: snapshot.workflow_reviewed_by,
                status: snapshot.status,
                last_updated_by: user?.email ?? "anon",
              };
              const { data: revertRows, error: revertError } = await supabase
                .from("tasks")
                .update(revertPatch)
                .eq("id", taskId)
                .select("id");
              if (revertError) {
                toast.error("Geri alma başarısız: " + revertError.message);
                return;
              }
              if (!revertRows || revertRows.length === 0) {
                toast.error("Geri alma engellendi (RLS).");
                return;
              }
              // Audit kaydı — undo (action = 'reset' olarak loglanır)
              void logTaskWorkflowEvent({
                taskId,
                projectId: taskRow.project_id ?? null,
                fromStatus: toStatus,
                toStatus: normalizeWorkflowStatus(
                  snapshot.workflow_status as Parameters<typeof normalizeWorkflowStatus>[0]
                ),
                action: "reset",
                actorEmail: user?.email ?? null,
                note: `"${ACTION_LABELS[action]}" aksiyonu geri alındı`,
              });
              toast.info("Aksiyon geri alındı");
            })();
          },
        },
      });

      return true;
    },
    [promptUser, toast, user?.email]
  );
}
