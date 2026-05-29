"use client";

import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type SensitivePolicyAction =
  | "view"
  | "edit"
  | "copy"
  | "export_masked"
  | "export_unmasked";

export type SensitivePolicyDecision = "allow" | "deny";

export type EvaluatedSensitivePolicy = {
  decision: SensitivePolicyDecision;
  policyId: string | null;
  reasonRequired: boolean;
  priority: number;
};

function isMissingPolicyObjects(error: { code?: string; message?: string } | null | undefined): boolean {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42883" ||
    message.includes("evaluate_sensitive_policy") ||
    message.includes("sensitive_field_policies") ||
    message.includes("pii_policy_shadow_log")
  );
}

export async function evaluateSensitivePolicy(input: {
  fieldKey: string;
  action: SensitivePolicyAction;
  roleId: string;
  projectId?: string | null;
}): Promise<EvaluatedSensitivePolicy> {
  if (!isSupabaseConfigured()) {
    return { decision: "allow", policyId: null, reasonRequired: false, priority: 10000 };
  }
  const { data, error } = await supabase.rpc("evaluate_sensitive_policy", {
    p_field_key: input.fieldKey,
    p_action: input.action,
    p_role_id: input.roleId,
    p_project_id: input.projectId ?? null,
  });
  if (error) {
    if (!isMissingPolicyObjects(error)) {
      console.warn("[sensitiveFieldPolicy] evaluate:", error.message);
    }
    return { decision: "allow", policyId: null, reasonRequired: false, priority: 10000 };
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { decision: "allow", policyId: null, reasonRequired: false, priority: 10000 };
  }
  const decision = String(row.decision ?? "allow") === "deny" ? "deny" : "allow";
  return {
    decision,
    policyId: row.policy_id ? String(row.policy_id) : null,
    reasonRequired: row.reason_required === true,
    priority: Number(row.priority ?? 10000),
  };
}

export async function logSensitivePolicyShadow(input: {
  userId: string;
  userEmail: string;
  fieldName: string;
  action: SensitivePolicyAction;
  legacyDecision: SensitivePolicyDecision;
  policyDecision: SensitivePolicyDecision;
  policyId?: string | null;
  enforced?: boolean;
  context?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from("pii_policy_shadow_log").insert({
    user_id: input.userId,
    user_email: input.userEmail.trim().toLowerCase(),
    field_name: input.fieldName,
    action: input.action,
    legacy_decision: input.legacyDecision,
    policy_decision: input.policyDecision,
    policy_id: input.policyId ?? null,
    enforced: input.enforced === true,
    context: input.context ?? {},
  });
  if (error && !isMissingPolicyObjects(error)) {
    console.warn("[sensitiveFieldPolicy] shadow log:", error.message);
  }
}
