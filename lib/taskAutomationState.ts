"use client";

import { supabase } from "@/lib/supabaseClient";

export type AutomationRowColor = "red" | "amber" | "emerald" | "blue" | "purple" | "slate";

export type TaskAutomationState = {
  taskId: string;
  rowColor: AutomationRowColor | null;
  locked: boolean;
  lockedReason: string | null;
  updatedAt: string;
};

type TaskAutomationStateRow = {
  task_id: string;
  row_color: AutomationRowColor | null;
  locked: boolean | null;
  locked_reason: string | null;
  updated_at: string;
};

export type TaskAutomationStatePatch = {
  rowColor?: AutomationRowColor | null;
  locked?: boolean;
  lockedReason?: string | null;
};

function isMissingStateTable(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  return error?.code === "42P01" || message.includes("task_automation_state");
}

function mapTaskAutomationState(row: TaskAutomationStateRow): TaskAutomationState {
  return {
    taskId: row.task_id,
    rowColor: row.row_color,
    locked: Boolean(row.locked),
    lockedReason: row.locked_reason,
    updatedAt: row.updated_at,
  };
}

export async function listTaskAutomationStates(taskIds: string[]): Promise<TaskAutomationState[]> {
  const ids = Array.from(new Set(taskIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("task_automation_state")
    .select("task_id,row_color,locked,locked_reason,updated_at")
    .in("task_id", ids);
  if (error) {
    if (isMissingStateTable(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as TaskAutomationStateRow[]).map(mapTaskAutomationState);
}

export async function upsertTaskAutomationState(taskId: string, patch: TaskAutomationStatePatch): Promise<boolean> {
  const row = {
    task_id: taskId,
    ...(Object.prototype.hasOwnProperty.call(patch, "rowColor") ? { row_color: patch.rowColor ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "locked") ? { locked: Boolean(patch.locked) } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "lockedReason") ? { locked_reason: patch.lockedReason ?? null } : {}),
  };
  const { error } = await supabase
    .from("task_automation_state")
    .upsert(row, { onConflict: "task_id" });
  if (error) {
    if (isMissingStateTable(error)) return false;
    throw new Error(error.message);
  }
  return true;
}
