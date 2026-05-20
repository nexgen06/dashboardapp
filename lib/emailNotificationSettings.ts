"use client";

import { supabase } from "@/lib/supabaseClient";

export type EmailNotificationEvent =
  | "announcement_new"
  | "task_assigned"
  | "project_assigned"
  | "task_overdue"
  | "comment_new"
  | "feedback_reply"
  | "daily_digest";

export type EmailNotificationSetting = {
  event_key: EmailNotificationEvent;
  enabled: boolean;
  display_name: string;
  description: string | null;
  recipient: string;
  updated_by: string | null;
  updated_at: string;
};

function rowToSetting(row: Record<string, unknown>): EmailNotificationSetting {
  return {
    event_key: row.event_key as EmailNotificationEvent,
    enabled: row.enabled === true,
    display_name: String(row.display_name ?? ""),
    description: row.description != null ? String(row.description) : null,
    recipient: String(row.recipient ?? ""),
    updated_by: row.updated_by != null ? String(row.updated_by) : null,
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listEmailSettings(): Promise<EmailNotificationSetting[]> {
  const { data, error } = await supabase
    .from("email_notification_settings")
    .select("*")
    .order("event_key", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToSetting);
}

export async function updateEmailSetting(
  eventKey: EmailNotificationEvent,
  enabled: boolean
): Promise<void> {
  const { data: authUser } = await supabase.auth.getUser();
  const updatedBy = authUser?.user?.id ?? null;
  const { error } = await supabase
    .from("email_notification_settings")
    .update({ enabled, updated_by: updatedBy })
    .eq("event_key", eventKey);
  if (error) throw error;
}

/** İleride email gönderim fonksiyonları çağırmadan önce bunu kontrol eder. */
export async function isEmailEventEnabled(eventKey: EmailNotificationEvent): Promise<boolean> {
  const { data, error } = await supabase
    .from("email_notification_settings")
    .select("enabled")
    .eq("event_key", eventKey)
    .maybeSingle();
  if (error) {
    if (typeof console !== "undefined") console.warn("[emailSettings] check failed:", error);
    return false;
  }
  return (data?.enabled as boolean | undefined) ?? false;
}
