"use client";

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { SensitivePolicyAction, SensitivePolicyDecision } from "@/lib/sensitiveFieldPolicy";

export type SensitiveFieldPolicyRow = {
  id: string;
  name: string;
  field_pattern: string;
  match_type: "exact" | "contains" | "regex";
  action: SensitivePolicyAction;
  role_scope: string[];
  project_scope: string | null;
  decision: SensitivePolicyDecision;
  reason_required: boolean;
  priority: number;
  enabled: boolean;
  updated_at: string;
};

export type SensitivePolicyShadowRow = {
  id: string;
  user_email: string;
  field_name: string;
  action: SensitivePolicyAction;
  legacy_decision: SensitivePolicyDecision;
  policy_decision: SensitivePolicyDecision;
  policy_id: string | null;
  enforced: boolean;
  context: Record<string, unknown>;
  at: string;
};

export type PiiAccessValidationIssue = {
  id: string;
  user_email: string;
  action: string;
  field_name: string;
  record_count: number;
  at: string;
  issues: string[];
};

export type SensitiveFieldPolicyInput = {
  name: string;
  field_pattern: string;
  match_type: "exact" | "contains" | "regex";
  action: SensitivePolicyAction;
  role_scope: string[];
  decision: SensitivePolicyDecision;
  reason_required: boolean;
  priority: number;
  enabled: boolean;
};

function isMissingObject(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42883" ||
    message.includes("sensitive_field_policies") ||
    message.includes("pii_policy_shadow_log") ||
    message.includes("pii_access_log_validation_issues")
  );
}

export async function listSensitiveFieldPolicies(limit = 200): Promise<SensitiveFieldPolicyRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from("sensitive_field_policies")
    .select("*")
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!isMissingObject(error)) throw error;
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    field_pattern: String(row.field_pattern ?? ""),
    match_type: String(row.match_type ?? "contains") as SensitiveFieldPolicyRow["match_type"],
    action: String(row.action ?? "view") as SensitivePolicyAction,
    role_scope: Array.isArray(row.role_scope) ? row.role_scope.map((v: unknown) => String(v)) : [],
    project_scope: row.project_scope ? String(row.project_scope) : null,
    decision: String(row.decision ?? "allow") === "deny" ? "deny" : "allow",
    reason_required: row.reason_required === true,
    priority: Number(row.priority ?? 10000),
    enabled: row.enabled !== false,
    updated_at: String(row.updated_at ?? ""),
  }));
}

export async function listPiiPolicyShadowLog(limit = 300): Promise<SensitivePolicyShadowRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from("pii_policy_shadow_log")
    .select("*")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!isMissingObject(error)) throw error;
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_email: String(row.user_email ?? ""),
    field_name: String(row.field_name ?? ""),
    action: String(row.action ?? "copy") as SensitivePolicyAction,
    legacy_decision: String(row.legacy_decision ?? "allow") === "deny" ? "deny" : "allow",
    policy_decision: String(row.policy_decision ?? "allow") === "deny" ? "deny" : "allow",
    policy_id: row.policy_id ? String(row.policy_id) : null,
    enforced: row.enforced === true,
    context: row.context && typeof row.context === "object" ? (row.context as Record<string, unknown>) : {},
    at: String(row.at ?? ""),
  }));
}

export async function listPiiAccessValidationIssues(limit = 300): Promise<PiiAccessValidationIssue[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from("pii_access_log_validation_issues")
    .select("*")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) {
    if (!isMissingObject(error)) throw error;
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    user_email: String(row.user_email ?? ""),
    action: String(row.action ?? ""),
    field_name: String(row.field_name ?? ""),
    record_count: Number(row.record_count ?? 0),
    at: String(row.at ?? ""),
    issues: Array.isArray(row.issues) ? row.issues.map((x: unknown) => String(x)) : [],
  }));
}

function normalizePolicyInput(input: SensitiveFieldPolicyInput): SensitiveFieldPolicyInput {
  return {
    name: input.name.trim(),
    field_pattern: input.field_pattern.trim(),
    match_type: input.match_type,
    action: input.action,
    role_scope: Array.from(new Set(input.role_scope.map((x) => x.trim()).filter(Boolean))),
    decision: input.decision,
    reason_required: input.reason_required,
    priority: Number.isFinite(input.priority) ? Math.max(0, Math.min(10000, Math.floor(input.priority))) : 100,
    enabled: input.enabled,
  };
}

export async function createSensitiveFieldPolicy(input: SensitiveFieldPolicyInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const normalized = normalizePolicyInput(input);
  const { error } = await supabase.from("sensitive_field_policies").insert({
    name: normalized.name,
    field_pattern: normalized.field_pattern,
    match_type: normalized.match_type,
    action: normalized.action,
    role_scope: normalized.role_scope,
    decision: normalized.decision,
    reason_required: normalized.reason_required,
    priority: normalized.priority,
    enabled: normalized.enabled,
  });
  if (error) throw error;
}

export async function updateSensitiveFieldPolicy(id: string, input: SensitiveFieldPolicyInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const normalized = normalizePolicyInput(input);
  const { error } = await supabase
    .from("sensitive_field_policies")
    .update({
      name: normalized.name,
      field_pattern: normalized.field_pattern,
      match_type: normalized.match_type,
      action: normalized.action,
      role_scope: normalized.role_scope,
      decision: normalized.decision,
      reason_required: normalized.reason_required,
      priority: normalized.priority,
      enabled: normalized.enabled,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSensitiveFieldPolicy(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from("sensitive_field_policies")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
