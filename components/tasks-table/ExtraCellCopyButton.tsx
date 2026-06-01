"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveTableDensity } from "@/contexts/settings-context";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { logPiiAccess, countPiiAccessLastHour } from "@/lib/piiAccessLog";
import { evaluateSensitivePolicy, logSensitivePolicyShadow } from "@/lib/sensitiveFieldPolicy";

/**
 * Dinamik (extra) sütunlarda: hover ile panoya — hassas sütunlarda tam değer kopyalanır.
 *
 * Hassas alan (isSensitive=true) kopyalanırsa:
 *   - pii_access_log'a kayıt düşer (KVKK denetim)
 *   - settings.piiCopyHourlyLimit aşılmışsa kopya engellenir
 *   - kullanıcı "Bu işlem kaydedildi" toast'u görür (caydırıcı)
 */
export function ExtraCellCopyButton({
  text,
  density,
  isSensitive,
  fieldName,
  recordId,
  projectId,
  roleId,
}: {
  text: string;
  density: LiveTableDensity;
  isSensitive?: boolean;
  fieldName?: string;
  recordId?: string;
  projectId?: string | null;
  roleId?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const iconClass = density === "comfortable" ? "h-4 w-4" : "h-3.5 w-3.5";
  const toast = useToast();
  const { user } = useAuth();
  const { settings } = useSettings();

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const t = text.trim();
      if (!t || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
      // DEBUG (geçici): "maskeli kopyalanıyor" bug teşhisi için.
      // KVKK güvenliği: gerçek değer loglanmaz — sadece "maskeli karakter var mı?",
      // uzunluk ve ilk/son karakter önizlemesi. Sebep belli olunca bu log silinecek.
      if (typeof window !== "undefined") {
        const hasMaskChars = /[*•·•]/.test(t);
        const isAllDigits = /^\d+$/.test(t);
        const preview =
          t.length > 4 ? `${t.slice(0, 2)}…${t.slice(-2)}` : "(short)";
        // eslint-disable-next-line no-console
        console.log("[pii-copy-debug]", {
          fieldName: fieldName ?? "(none)",
          isSensitive: isSensitive ?? false,
          textLength: t.length,
          hasMaskChars,
          isAllDigits,
          preview,
        });
      }
      const shouldHandleSensitiveCopy = Boolean(isSensitive && user?.email && fieldName);
      const effectivePolicyMode: "shadow" | "enforce" = settings.piiPolicyMode;
      let shouldLogSensitiveCopy = false;
      let shadowPayload:
        | {
            decision: "allow" | "deny";
            policyId: string | null;
            reasonRequired: boolean;
            priority: number;
            mode: "shadow" | "enforce";
            enforced: boolean;
          }
        | null = null;

      if (shouldHandleSensitiveCopy && effectivePolicyMode === "shadow") {
        try {
          let copiedWithFallback = false;
          try {
            await navigator.clipboard.writeText(t);
            copiedWithFallback = true;
          } catch {
            if (typeof document !== "undefined") {
              const ta = document.createElement("textarea");
              ta.value = t;
              ta.setAttribute("readonly", "");
              ta.style.position = "fixed";
              ta.style.opacity = "0";
              ta.style.pointerEvents = "none";
              document.body.appendChild(ta);
              ta.focus();
              ta.select();
              try {
                copiedWithFallback = document.execCommand("copy");
              } catch {
                copiedWithFallback = false;
              } finally {
                document.body.removeChild(ta);
              }
            }
          }
          if (!copiedWithFallback) throw new Error("clipboard-copy-failed");
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
          toast.success("Kopyalandı", { durationMs: 1400 });

          if (user?.id) {
            void (async () => {
              const policy = await evaluateSensitivePolicy({
                fieldKey: fieldName!,
                action: "copy",
                roleId: roleId ?? user?.roleId ?? "member",
                projectId: projectId ?? null,
              });
              await logSensitivePolicyShadow({
                userId: user.id,
                userEmail: user.email ?? "",
                fieldName: fieldName!,
                action: "copy",
                legacyDecision: "allow",
                policyDecision: policy.decision,
                policyId: policy.policyId,
                enforced: false,
                context: {
                  recordId: recordId ?? null,
                  reasonRequired: policy.reasonRequired,
                  policyPriority: policy.priority,
                  mode: "shadow",
                },
              });
            })();
          }

          if (user?.email) {
            void logPiiAccess({
              userEmail: user.email,
              action: "copy",
              fieldName: fieldName!,
              recordId: recordId ?? null,
            });
          }
          toast.info("Bu işlem kaydedildi", { durationMs: 2000 });
          return;
        } catch {
          setCopied(false);
          toast.error("Kopyalama başarısız oldu");
          return;
        }
      }

      if (effectivePolicyMode === "enforce" && isSensitive && user?.id && settings.piiCopyHourlyLimit > 0) {
        try {
          const count = await countPiiAccessLastHour(user.id, "copy");
          if (count >= settings.piiCopyHourlyLimit) {
            toast.error(
              `Saatlik hassas alan kopyalama limiti aşıldı (${settings.piiCopyHourlyLimit}). Bu eylem geçici olarak engellendi.`
            );
            return;
          }
        } catch {
          // Sayım başarısız — eylemi engellemek yerine devam et
        }
      }

      if (shouldHandleSensitiveCopy && effectivePolicyMode === "enforce") {
        try {
          const policy = await evaluateSensitivePolicy({
            fieldKey: fieldName!,
            action: "copy",
            roleId: roleId ?? user?.roleId ?? "member",
            projectId: projectId ?? null,
          });
          const enforceDenied = policy.decision === "deny";
          shadowPayload = {
            decision: policy.decision,
            policyId: policy.policyId,
            reasonRequired: policy.reasonRequired,
            priority: policy.priority,
            mode: "enforce",
            enforced: enforceDenied,
          };
          if (enforceDenied) {
            if (user?.id) {
              await logSensitivePolicyShadow({
                userId: user.id,
                userEmail: user.email ?? "",
                fieldName: fieldName!,
                action: "copy",
                legacyDecision: "allow",
                policyDecision: policy.decision,
                policyId: policy.policyId,
                enforced: true,
                context: {
                  recordId: recordId ?? null,
                  reasonRequired: policy.reasonRequired,
                  policyPriority: policy.priority,
                  mode: effectivePolicyMode,
                },
              });
            }
            toast.error("Bu hassas alan için kopyalama policy tarafından engellendi.");
            return;
          }
        } catch (err) {
          console.warn("[sensitive copy] enforce precheck failed", err);
        }
      }

      try {
        let copiedWithFallback = false;
        try {
          await navigator.clipboard.writeText(t);
          copiedWithFallback = true;
        } catch {
          if (typeof document !== "undefined") {
            const ta = document.createElement("textarea");
            ta.value = t;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            ta.style.pointerEvents = "none";
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try {
              copiedWithFallback = document.execCommand("copy");
            } catch {
              copiedWithFallback = false;
            } finally {
              document.body.removeChild(ta);
            }
          }
        }
        if (!copiedWithFallback) throw new Error("clipboard-copy-failed");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
        toast.success("Kopyalandı", { durationMs: 1400 });

        if (shouldHandleSensitiveCopy && user?.email && fieldName) {
          if (effectivePolicyMode === "shadow") {
            void (async () => {
              const policy = await evaluateSensitivePolicy({
                fieldKey: fieldName,
                action: "copy",
                roleId: roleId ?? user?.roleId ?? "member",
                projectId: projectId ?? null,
              });
              if (!user?.id) return;
              await logSensitivePolicyShadow({
                userId: user.id,
                userEmail: user.email,
                fieldName,
                action: "copy",
                legacyDecision: "allow",
                policyDecision: policy.decision,
                policyId: policy.policyId,
                enforced: false,
                context: {
                  recordId: recordId ?? null,
                  reasonRequired: policy.reasonRequired,
                  policyPriority: policy.priority,
                  mode: effectivePolicyMode,
                },
              });
            })();
          } else if (shadowPayload && user?.id) {
            void logSensitivePolicyShadow({
              userId: user.id,
              userEmail: user.email,
              fieldName,
              action: "copy",
              legacyDecision: "allow",
              policyDecision: shadowPayload.decision,
              policyId: shadowPayload.policyId,
              enforced: shadowPayload.enforced,
              context: {
                recordId: recordId ?? null,
                reasonRequired: shadowPayload.reasonRequired,
                policyPriority: shadowPayload.priority,
                mode: shadowPayload.mode,
              },
            });
          }
          shouldLogSensitiveCopy = true;
        }
        if (shouldLogSensitiveCopy && user?.email && fieldName) {
          void logPiiAccess({
            userEmail: user.email,
            action: "copy",
            fieldName,
            recordId: recordId ?? null,
          });
          toast.info("Bu işlem kaydedildi", { durationMs: 2000 });
        }
      } catch {
        setCopied(false);
        toast.error("Kopyalama başarısız oldu");
      }
    },
    [
      text,
      isSensitive,
      fieldName,
      recordId,
      user,
      settings.piiCopyHourlyLimit,
      settings.piiPolicyMode,
      toast,
      projectId,
      roleId,
    ]
  );

  return (
    <button
      type="button"
      onClick={(e) => void handleCopy(e)}
      title={copied ? "Kopyalandı" : "Panoya kopyala"}
      aria-label={copied ? "Kopyalandı" : "Panoya kopyala"}
      className={cn(
        "shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity group-hover/extra-cell:opacity-100 hover:bg-slate-200 hover:text-slate-800 focus:opacity-100 dark:text-slate-500 dark:hover:bg-slate-600 dark:hover:text-slate-100",
        copied && "text-emerald-600 opacity-100 hover:text-emerald-600 dark:text-emerald-400"
      )}
    >
      {copied ? <Check className={iconClass} strokeWidth={2.5} /> : <Copy className={iconClass} />}
    </button>
  );
}
