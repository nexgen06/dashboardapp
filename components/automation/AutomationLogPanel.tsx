"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { listAutomationLogs, type AutomationLog } from "@/lib/automationRules";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";

export function AutomationLogPanel({ taskId, className }: { taskId: string; className?: string }) {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listAutomationLogs(taskId)
      .then((items) => {
        if (!cancelled) setLogs(items);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return (
    <section className={cn("rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/40", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Bot className="h-3 w-3" aria-hidden />
          Otomasyon logları
        </h3>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>
      {logs.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Bu satırda otomasyon çalışması yok.
        </p>
      ) : (
        <ol className="space-y-2">
          {logs.map((log) => {
            const ok = log.status === "applied";
            const failed = log.status === "failed";
            return (
              <li key={log.id} className="flex gap-2 text-xs">
                <span className={cn("mt-0.5", ok ? "text-emerald-500" : failed ? "text-red-500" : "text-slate-400")}>
                  {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="break-words text-slate-700 dark:text-slate-200">{log.message ?? log.status}</p>
                  <p className="text-[10px] text-slate-400">{getRelativeTime(new Date(log.createdAt))}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

