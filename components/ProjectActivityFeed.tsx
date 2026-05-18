"use client";

/**
 * Proje aktivite zaman çizelgesi — audit log proje-filtreli görünümü.
 * Mount'ta fetch + Supabase realtime ile audit_log INSERT'lere abone.
 *
 * Bu sayfaya özel: projenin kendi değişiklikleri + bu projeye bağlı görevlerin
 * değişiklikleri tek listede, en yeni üstte.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchProjectActivity,
  fieldLabel,
  formatAuditValue,
  type AuditLogEntry,
  type AuditFieldDiff,
} from "@/lib/auditLog";
import { supabase } from "@/lib/supabaseClient";
import { getRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Activity,
  User,
} from "lucide-react";

const ACTION_META = {
  insert: {
    label: "ekledi",
    Icon: Plus,
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  update: {
    label: "güncelledi",
    Icon: Pencil,
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  delete: {
    label: "sildi",
    Icon: Trash2,
    cls: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
} as const;

function TargetLabel({ entry }: { entry: AuditLogEntry }) {
  if (entry.tableName === "projects") return <span className="font-medium">proje ayarları</span>;
  return <span className="font-medium">bir görev</span>;
}

function FieldDiff({ field, diff }: { field: string; diff: AuditFieldDiff }) {
  return (
    <div className="text-xs text-slate-600 dark:text-slate-400">
      <span className="font-medium text-slate-700 dark:text-slate-300">{fieldLabel(field)}:</span>{" "}
      <span className="text-slate-500 line-through decoration-slate-400/60">
        {formatAuditValue(diff.before)}
      </span>{" "}
      →{" "}
      <span className="text-slate-700 dark:text-slate-200">{formatAuditValue(diff.after)}</span>
    </div>
  );
}

function EntryLine({ entry, now }: { entry: AuditLogEntry; now: Date }) {
  const meta = ACTION_META[entry.action];
  const Icon = meta.Icon;
  const actor = entry.actorEmail || "Sistem";
  // UPDATE değişen alanları (en fazla 3 alan; üzeri "+N alan daha")
  const updateFields = useMemo(() => {
    if (entry.action !== "update") return [];
    return Object.entries(entry.changedFields).filter(
      ([k, v]) =>
        k !== "_full" &&
        v !== null &&
        typeof v === "object" &&
        "before" in (v as object) &&
        "after" in (v as object)
    ) as Array<[string, AuditFieldDiff]>;
  }, [entry]);

  return (
    <li className="flex gap-3 px-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          meta.cls
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <span className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-100">
            <User className="h-3 w-3 opacity-60" aria-hidden />
            {actor}
          </span>{" "}
          <TargetLabel entry={entry} /> {meta.label}.
        </p>
        {updateFields.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {updateFields.slice(0, 3).map(([f, d]) => (
              <FieldDiff key={f} field={f} diff={d} />
            ))}
            {updateFields.length > 3 && (
              <p className="text-xs italic text-slate-500 dark:text-slate-400">
                +{updateFields.length - 3} alan daha
              </p>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {getRelativeTime(entry.at, now)}
        </p>
      </div>
    </li>
  );
}

export function ProjectActivityFeed({
  projectId,
  taskIds,
}: {
  projectId: string;
  /** Mevcut belleğe yüklenmiş projeye ait görev ID'leri */
  taskIds: string[];
}) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  // Realtime tick için saatte 1 dk'lık yenileme (relative time için)
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const taskIdsKey = useMemo(() => [...taskIds].sort().join("|"), [taskIds]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectActivity(projectId, taskIds, 30);
      setEntries(data);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, taskIdsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // Audit log INSERT'lere realtime abone — yeni satır gelince refetch (basit & güvenli)
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`audit_project_${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [projectId, load]);

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Aktivite yükleniyor…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-6 text-center dark:border-slate-700 dark:bg-slate-800/30">
        <Activity className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" aria-hidden />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Henüz aktivite kaydı yok. Görev eklendiğinde, güncellendiğinde ya da silindiğinde burada görünür.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/40">
      {entries.map((e) => (
        <EntryLine key={e.id} entry={e} now={now} />
      ))}
    </ul>
  );
}
