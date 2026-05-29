"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shield, Loader2, Copy as CopyIcon, EyeOff, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listPiiAccessLog,
  type PiiAccessLogEntry,
  type PiiAccessAction,
} from "@/lib/piiAccessLog";
import {
  listSensitiveFieldPolicies,
  listPiiPolicyShadowLog,
  listPiiAccessValidationIssues,
  createSensitiveFieldPolicy,
  updateSensitiveFieldPolicy,
  deleteSensitiveFieldPolicy,
  type SensitiveFieldPolicyInput,
  type SensitiveFieldPolicyRow,
  type SensitivePolicyShadowRow,
  type PiiAccessValidationIssue,
} from "@/lib/sensitivePolicyAdmin";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

const ACTION_META: Record<
  PiiAccessAction,
  { label: string; icon: typeof CopyIcon; bg: string; text: string }
> = {
  copy: { label: "Kopya", icon: CopyIcon, bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  unmask: { label: "Göster", icon: EyeOff, bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  export: { label: "İndirme", icon: Download, bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300" },
};

type DateRange = "24h" | "7d" | "30d" | "all";
type EnforcedFilter = "all" | "enforced" | "not_enforced";
const POLICY_ACTION_OPTIONS = ["view", "edit", "copy", "export_masked", "export_unmasked"] as const;
const POLICY_MATCH_OPTIONS = ["exact", "contains", "regex"] as const;
const POLICY_DECISION_OPTIONS = ["allow", "deny"] as const;
const POLICY_ROLE_OPTIONS = ["admin", "project_manager", "member", "viewer"] as const;
const RANGE_LABELS: Record<DateRange, string> = {
  "24h": "Son 24 saat",
  "7d": "Son 7 gün",
  "30d": "Son 30 gün",
  all: "Tümü",
};

function rangeStartIso(range: DateRange): string | null {
  if (range === "all") return null;
  const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export default function PiiAccessPage() {
  const { hasPermission, isAdmin, isLoaded } = useAuth();
  const canView = hasPermission("area.piiAccess") && hasPermission("piiAccess.view");
  const canManagePolicies = isAdmin;
  const [entries, setEntries] = useState<PiiAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>("7d");
  const [actionFilter, setActionFilter] = useState<PiiAccessAction | "all">("all");
  const [userFilter, setUserFilter] = useState<string>("");
  const [enforcedFilter, setEnforcedFilter] = useState<EnforcedFilter>("all");
  const [policies, setPolicies] = useState<SensitiveFieldPolicyRow[]>([]);
  const [shadowRows, setShadowRows] = useState<SensitivePolicyShadowRow[]>([]);
  const [auditIssues, setAuditIssues] = useState<PiiAccessValidationIssue[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<SensitiveFieldPolicyInput | null>(null);
  const [newPolicy, setNewPolicy] = useState<SensitiveFieldPolicyInput>({
    name: "",
    field_pattern: "",
    match_type: "contains",
    action: "copy",
    role_scope: ["member"],
    decision: "deny",
    reason_required: false,
    priority: 100,
    enabled: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listPiiAccessLog({
        action: actionFilter === "all" ? null : actionFilter,
        since: rangeStartIso(range),
        limit: 500,
      });
      const [nextPolicies, nextShadowRows, nextAuditIssues] = await Promise.all([
        listSensitiveFieldPolicies(120),
        listPiiPolicyShadowLog(200),
        listPiiAccessValidationIssues(120),
      ]);
      setEntries(rows);
      setPolicies(nextPolicies);
      setShadowRows(nextShadowRows);
      setAuditIssues(nextAuditIssues);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, range, actionFilter]);

  const filtered = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.user_email.toLowerCase().includes(q));
  }, [entries, userFilter]);

  // Kullanıcı bazında özet — anomali tespiti için
  const summary = useMemo(() => {
    const byUser = new Map<string, { total: number; copy: number; unmask: number; export: number }>();
    for (const e of entries) {
      const u = byUser.get(e.user_email) ?? { total: 0, copy: 0, unmask: 0, export: 0 };
      u.total += e.record_count;
      u[e.action] += e.record_count;
      byUser.set(e.user_email, u);
    }
    return Array.from(byUser.entries())
      .map(([email, s]) => ({ email, ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [entries]);
  const shadowMismatchCount = useMemo(
    () => shadowRows.filter((row) => row.legacy_decision !== row.policy_decision).length,
    [shadowRows]
  );
  const filteredShadowRows = useMemo(() => {
    if (enforcedFilter === "all") return shadowRows;
    if (enforcedFilter === "enforced") return shadowRows.filter((row) => row.enforced);
    return shadowRows.filter((row) => !row.enforced);
  }, [shadowRows, enforcedFilter]);

  const beginEditPolicy = (policy: SensitiveFieldPolicyRow) => {
    setEditingPolicyId(policy.id);
    setEditingPolicy({
      name: policy.name,
      field_pattern: policy.field_pattern,
      match_type: policy.match_type,
      action: policy.action,
      role_scope: policy.role_scope,
      decision: policy.decision,
      reason_required: policy.reason_required,
      priority: policy.priority,
      enabled: policy.enabled,
    });
  };

  const cancelEditPolicy = () => {
    setEditingPolicyId(null);
    setEditingPolicy(null);
  };

  const toggleRole = (current: string[], role: string): string[] => {
    if (current.includes(role)) return current.filter((item) => item !== role);
    return [...current, role];
  };

  const validatePolicy = (value: SensitiveFieldPolicyInput): string | null => {
    if (!value.name.trim()) return "Policy adı zorunlu.";
    if (!value.field_pattern.trim()) return "Alan eşleme zorunlu.";
    if (value.role_scope.length === 0) return "En az bir rol seçilmeli.";
    return null;
  };

  const handleCreatePolicy = async () => {
    const validation = validatePolicy(newPolicy);
    if (validation) {
      setError(validation);
      return;
    }
    setSavingPolicy(true);
    try {
      await createSensitiveFieldPolicy(newPolicy);
      setNewPolicy({
        name: "",
        field_pattern: "",
        match_type: "contains",
        action: "copy",
        role_scope: ["member"],
        decision: "deny",
        reason_required: false,
        priority: 100,
        enabled: true,
      });
      await load();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Policy kaydedilemedi");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleSavePolicy = async () => {
    if (!editingPolicyId || !editingPolicy) return;
    const validation = validatePolicy(editingPolicy);
    if (validation) {
      setError(validation);
      return;
    }
    setSavingPolicy(true);
    try {
      await updateSensitiveFieldPolicy(editingPolicyId, editingPolicy);
      cancelEditPolicy();
      await load();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Policy güncellenemedi");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!window.confirm("Bu policy silinsin mi?")) return;
    setSavingPolicy(true);
    try {
      await deleteSensitiveFieldPolicy(id);
      if (editingPolicyId === id) cancelEditPolicy();
      await load();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Policy silinemedi");
    } finally {
      setSavingPolicy(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="container flex max-w-2xl flex-col items-center justify-center gap-4 py-16">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="container max-w-2xl py-16">
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-12 w-12 text-amber-600 dark:text-amber-400" />
          <p className="font-medium text-slate-800 dark:text-slate-200">PII erişim kayıtlarına yetkiniz yok.</p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/">{`Dashboard'a dön`}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Yönetim" }, { label: "PII erişim" }]} />

      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            PII erişim kayıtları
          </h1>
          <span className="text-xs text-slate-500 dark:text-slate-400">· {entries.length} kayıt</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Yenile
        </Button>
      </header>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        TCKN / Sicil gibi hassas alanlara <strong>kopyala / unmask / export</strong> ile erişim her olduğunda burada görünür.
        Kayıtlar değiştirilemez (immutable). KVKK denetim talebinde delil olarak kullanılır.
      </p>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Aktif policy</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {policies.filter((p) => p.enabled).length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Toplam {policies.length} kayıt</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Shadow farklı karar</p>
          <p className="mt-1 text-xl font-semibold text-amber-700 dark:text-amber-300">{shadowMismatchCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Son {shadowRows.length} olay içinde</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Audit uyarısı</p>
          <p className={cn("mt-1 text-xl font-semibold", auditIssues.length > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>
            {auditIssues.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">PII log doğrulama bulgusu</p>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Hassas alan policy yönetimi
          </h2>
          {!canManagePolicies && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Sadece admin düzenleyebilir
            </span>
          )}
        </div>
        {canManagePolicies && (
          <div className="mb-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/40 md:grid-cols-7">
            <input
              value={newPolicy.name}
              onChange={(e) => setNewPolicy((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Policy adı"
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              value={newPolicy.field_pattern}
              onChange={(e) => setNewPolicy((prev) => ({ ...prev, field_pattern: e.target.value }))}
              placeholder="field pattern"
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
            />
            <select
              value={newPolicy.match_type}
              onChange={(e) => setNewPolicy((prev) => ({ ...prev, match_type: e.target.value as SensitiveFieldPolicyInput["match_type"] }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
            >
              {POLICY_MATCH_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              value={newPolicy.action}
              onChange={(e) => setNewPolicy((prev) => ({ ...prev, action: e.target.value as SensitiveFieldPolicyInput["action"] }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
            >
              {POLICY_ACTION_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              value={newPolicy.decision}
              onChange={(e) => setNewPolicy((prev) => ({ ...prev, decision: e.target.value as SensitiveFieldPolicyInput["decision"] }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
            >
              {POLICY_DECISION_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <input
              type="number"
              min={0}
              max={10000}
              value={newPolicy.priority}
              onChange={(e) => setNewPolicy((prev) => ({ ...prev, priority: Number(e.target.value) || 0 }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
            />
            <Button size="sm" onClick={() => void handleCreatePolicy()} disabled={savingPolicy}>
              Ekle
            </Button>
            <div className="md:col-span-7 flex flex-wrap items-center gap-2">
              {POLICY_ROLE_OPTIONS.map((role) => (
                <label key={role} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={newPolicy.role_scope.includes(role)}
                    onChange={() => setNewPolicy((prev) => ({ ...prev, role_scope: toggleRole(prev.role_scope, role) }))}
                  />
                  <span>{role}</span>
                </label>
              ))}
              <label className="ml-2 inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={newPolicy.reason_required}
                  onChange={(e) => setNewPolicy((prev) => ({ ...prev, reason_required: e.target.checked }))}
                />
                <span>reason zorunlu</span>
              </label>
            </div>
          </div>
        )}
        {policies.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Policy tablosu boş veya henüz deploy edilmedi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-2 py-1">Policy</th>
                  <th className="px-2 py-1">Alan eşleme</th>
                  <th className="px-2 py-1">Aksiyon</th>
                  <th className="px-2 py-1">Karar</th>
                  <th className="px-2 py-1">Roller</th>
                  <th className="px-2 py-1">Öncelik</th>
                  <th className="px-2 py-1">Reason</th>
                  <th className="px-2 py-1">Durum</th>
                  {canManagePolicies && <th className="px-2 py-1 text-right">İşlem</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {policies.slice(0, 20).map((policy) => (
                  <tr key={policy.id}>
                    <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <input
                          value={editingPolicy.name}
                          onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                        />
                      ) : policy.name}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <div className="flex gap-1">
                          <select
                            value={editingPolicy.match_type}
                            onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, match_type: e.target.value as SensitiveFieldPolicyInput["match_type"] } : prev))}
                            className="rounded border border-slate-300 bg-white px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
                          >
                            {POLICY_MATCH_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <input
                            value={editingPolicy.field_pattern}
                            onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, field_pattern: e.target.value } : prev))}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                          />
                        </div>
                      ) : (
                        <>
                          {policy.match_type}:{` `}
                          <code>{policy.field_pattern}</code>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <select
                          value={editingPolicy.action}
                          onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, action: e.target.value as SensitiveFieldPolicyInput["action"] } : prev))}
                          className="rounded border border-slate-300 bg-white px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
                        >
                          {POLICY_ACTION_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : policy.action}
                    </td>
                    <td className={cn("px-2 py-1.5 font-medium", policy.decision === "deny" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <select
                          value={editingPolicy.decision}
                          onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, decision: e.target.value as SensitiveFieldPolicyInput["decision"] } : prev))}
                          className="rounded border border-slate-300 bg-white px-1 py-1 text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          {POLICY_DECISION_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : policy.decision}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <div className="flex flex-wrap gap-1">
                          {POLICY_ROLE_OPTIONS.map((role) => (
                            <label key={role} className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={editingPolicy.role_scope.includes(role)}
                                onChange={() => setEditingPolicy((prev) => (prev ? { ...prev, role_scope: toggleRole(prev.role_scope, role) } : prev))}
                              />
                              <span>{role}</span>
                            </label>
                          ))}
                        </div>
                      ) : policy.role_scope.join(", ")}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600 dark:text-slate-300">
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          value={editingPolicy.priority}
                          onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, priority: Number(e.target.value) || 0 } : prev))}
                          className="w-20 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                        />
                      ) : policy.priority}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={editingPolicy.reason_required}
                            onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, reason_required: e.target.checked } : prev))}
                          />
                          <span>zorunlu</span>
                        </label>
                      ) : (
                        <span className={cn("rounded px-1 py-0.5", policy.reason_required ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300")}>
                          {policy.reason_required ? "zorunlu" : "opsiyonel"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                      {editingPolicyId === policy.id && editingPolicy ? (
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={editingPolicy.enabled}
                            onChange={(e) => setEditingPolicy((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))}
                          />
                          <span>{editingPolicy.enabled ? "aktif" : "pasif"}</span>
                        </label>
                      ) : (
                        <span className={cn("rounded px-1 py-0.5", policy.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300")}>
                          {policy.enabled ? "aktif" : "pasif"}
                        </span>
                      )}
                    </td>
                    {canManagePolicies && (
                      <td className="px-2 py-1.5 text-right">
                        {editingPolicyId === policy.id ? (
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => void handleSavePolicy()} disabled={savingPolicy}>Kaydet</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditPolicy} disabled={savingPolicy}>İptal</Button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => beginEditPolicy(policy)} disabled={savingPolicy}>Düzenle</Button>
                            <Button size="sm" variant="ghost" onClick={() => void handleDeletePolicy(policy.id)} disabled={savingPolicy}>Sil</Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Audit doğrulama uyarıları
        </h2>
        {auditIssues.length === 0 ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">Doğrulama uyarısı yok.</p>
        ) : (
          <ul className="space-y-1.5">
            {auditIssues.slice(0, 12).map((issue) => (
              <li key={issue.id} className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                <strong>{issue.field_name || "alan-yok"}</strong> · {issue.user_email || "kullanıcı-yok"} · {issue.issues.join(", ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Shadow karşılaştırma (son olaylar)
          </h2>
          <select
            value={enforcedFilter}
            onChange={(e) => setEnforcedFilter(e.target.value as EnforcedFilter)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Shadow enforced filtresi"
          >
            <option value="all">Tümü</option>
            <option value="enforced">Sadece enforced</option>
            <option value="not_enforced">Sadece non-enforced</option>
          </select>
        </div>
        {filteredShadowRows.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Shadow telemetry kaydı yok.</p>
        ) : (
          <div className="space-y-1">
            {filteredShadowRows.slice(0, 12).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-300">{row.user_email}</span>
                <span className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-700">{row.action}</span>
                <span className="text-slate-600 dark:text-slate-300">{row.field_name}</span>
                <span
                  className={cn(
                    "rounded px-1 py-0.5 font-medium",
                    row.enforced
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  )}
                >
                  {row.enforced ? "enforced" : "shadow"}
                </span>
                <span className={cn("font-medium", row.legacy_decision === "deny" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>
                  legacy:{row.legacy_decision}
                </span>
                <span className={cn("font-medium", row.policy_decision === "deny" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300")}>
                  policy:{row.policy_decision}
                </span>
                <span className="ml-auto text-slate-500 dark:text-slate-400">{getRelativeTime(new Date(row.at), new Date())}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* En aktif 5 kullanıcı — anomali için */}
      {summary.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            Bu aralıkta en aktif 5 kullanıcı
          </h2>
          <ul className="space-y-1.5">
            {summary.map((u) => (
              <li key={u.email} className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setUserFilter(u.email)}
                  className="truncate text-left text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                >
                  {u.email}
                </button>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {u.total} · <span className="text-blue-600 dark:text-blue-400">{u.copy} kopya</span>
                  {u.export > 0 && <span className="text-purple-600 dark:text-purple-400"> · {u.export} export</span>}
                  {u.unmask > 0 && <span className="text-amber-600 dark:text-amber-400"> · {u.unmask} göster</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/50">
          {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                range === r
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as PiiAccessAction | "all")}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="all">Tüm eylemler</option>
          <option value="copy">Kopya</option>
          <option value="unmask">Göster</option>
          <option value="export">İndirme</option>
        </select>
        <input
          type="text"
          placeholder="Kullanıcı e-posta filtresi…"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Liste */}
      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="text-sm">Yükleniyor…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-10 w-10" />}
          title="Bu aralıkta erişim kaydı yok"
          description="Filtreleri değiştirmeyi deneyin."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Zaman</th>
                <th className="px-3 py-2">Kullanıcı</th>
                <th className="px-3 py-2">Eylem</th>
                <th className="px-3 py-2">Alan</th>
                <th className="px-3 py-2 text-right">Sayı</th>
                <th className="px-3 py-2">Kayıt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filtered.map((e) => {
                const meta = ACTION_META[e.action];
                const Icon = meta.icon;
                return (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400" title={new Date(e.at).toLocaleString("tr-TR")}>
                      {getRelativeTime(new Date(e.at), new Date())}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{e.user_email}</td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", meta.bg, meta.text)}>
                        <Icon className="h-2.5 w-2.5" aria-hidden />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">{e.field_name}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700 dark:text-slate-200">
                      {e.record_count}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {e.record_id ? (
                        <code className="text-[10px]">{e.record_id.slice(0, 8)}…</code>
                      ) : (
                        <span className="italic">toplu</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
