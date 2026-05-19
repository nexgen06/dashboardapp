"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Trash2, GripVertical, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import {
  PROJECT_COLUMN_TYPE_HINTS,
  PROJECT_COLUMN_TYPE_LABELS,
  deleteProjectColumn,
  inferColumnType,
  listProjectColumns,
  updateProjectColumn,
  upsertProjectColumn,
  type ProjectColumn,
  type ProjectColumnType,
} from "@/lib/projectColumns";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  /** Bu projede gözlemlenen extra_data anahtarları (görevlerden). Otomatik tip
   *  tahmini ve "henüz tiplenmemiş" satırların önerilmesi için. */
  observedKeys: string[];
  /** Görevlerin extra_data değerleri — tip tahmini için sample */
  sampleValuesByKey?: Record<string, string[]>;
};

/**
 * Proje düzenleme formunda görünen "Sütun yönetimi" bölümü.
 * Mevcut UI render'ını (Tablo / Kanban) bozmaz — sadece metadata kaydeder.
 * A.3.2'de bu metadata type-aware render'a beslenecek.
 */
export function ProjectColumnManager({ projectId, observedKeys, sampleValuesByKey = {} }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Yerel düzenleme tamponu: kullanıcı yazarken her tuşa DB'ye yazmayalım */
  const [drafts, setDrafts] = useState<Record<string, { type: ProjectColumnType; optionsText: string }>>({});
  const debounceRef = useRef<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const list = await listProjectColumns(projectId);
      setColumns(list);
      const next: typeof drafts = {};
      for (const c of list) {
        next[c.id] = {
          type: c.type,
          optionsText: (c.config.options ?? []).join(", "),
        };
      }
      setDrafts(next);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Henüz tiplenmemiş anahtarlar — görevde var ama project_columns'ta yok */
  const untyped = useMemo(() => {
    const typedKeys = new Set(columns.map((c) => c.key.trim().toLowerCase()));
    return observedKeys.filter((k) => k && !typedKeys.has(k.trim().toLowerCase()));
  }, [columns, observedKeys]);

  const handleAdd = async (key: string, suggestedType?: ProjectColumnType) => {
    const k = key.trim();
    if (!k) return;
    const samples = sampleValuesByKey[k] ?? [];
    const type = suggestedType ?? inferColumnType(k, samples);
    setBusyId("__new__");
    try {
      await upsertProjectColumn({
        projectId,
        key: k,
        type,
        position: columns.length,
      });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setBusyId(null);
    }
  };

  const handleTypeChange = (col: ProjectColumn, newType: ProjectColumnType) => {
    setDrafts((d) => ({ ...d, [col.id]: { ...d[col.id], type: newType } }));
    // Debounce: 600ms sonrası DB'ye yaz
    if (debounceRef.current[col.id]) window.clearTimeout(debounceRef.current[col.id]);
    debounceRef.current[col.id] = window.setTimeout(async () => {
      try {
        await updateProjectColumn(col.id, { type: newType });
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Güncellenemedi");
      }
    }, 600);
  };

  const handleOptionsChange = (col: ProjectColumn, text: string) => {
    setDrafts((d) => ({ ...d, [col.id]: { ...d[col.id], optionsText: text } }));
    if (debounceRef.current[col.id]) window.clearTimeout(debounceRef.current[col.id]);
    debounceRef.current[col.id] = window.setTimeout(async () => {
      const options = text
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      try {
        await updateProjectColumn(col.id, {
          config: { ...col.config, options },
        });
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Güncellenemedi");
      }
    }, 800);
  };

  const handleDelete = async (col: ProjectColumn) => {
    const ok = await confirm({
      title: "Sütun tanımını kaldır",
      message: `"${col.key}" sütun tanımı kaldırılsın mı? Görev verileri silinmez.`,
      confirmLabel: "Kaldır",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(col.id);
    try {
      await deleteProjectColumn(col.id);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setBusyId(null);
    }
  };

  const handleAutoDetectAll = async () => {
    if (untyped.length === 0) return;
    setBusyId("__auto__");
    try {
      for (let i = 0; i < untyped.length; i++) {
        const key = untyped[i];
        const samples = sampleValuesByKey[key] ?? [];
        const type = inferColumnType(key, samples);
        await upsertProjectColumn({
          projectId,
          key,
          type,
          position: columns.length + i,
        });
      }
      await refresh();
      toast.success(`${untyped.length} sütun otomatik tiplenmiş`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toplu ekleme başarısız");
    } finally {
      setBusyId(null);
    }
  };

  if (!projectId) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sütun yönetimi için önce projeyi kaydet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Sütun tipi yönetimi
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Her ek sütuna tip ata. (A.3.2&apos;de tablo bu tiplere göre render edilecek.)
          </p>
        </div>
        {untyped.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleAutoDetectAll()}
            disabled={busyId === "__auto__"}
            className="gap-1.5"
          >
            {busyId === "__auto__" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Otomatik tipla ({untyped.length})
          </Button>
        )}
      </div>

      {loading && columns.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yükleniyor…
        </div>
      ) : columns.length === 0 && untyped.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Henüz tiplenmiş sütun yok. Görev içe aktar veya &quot;Canlı tablo ek sütunları&quot; alanına
          giriş ekle; ardından buradan tipini ayarla.
        </p>
      ) : (
        <ul className="space-y-2">
          {columns.map((col) => {
            const draft = drafts[col.id] ?? { type: col.type, optionsText: "" };
            const showOptions = draft.type === "select" || draft.type === "multi_select";
            return (
              <li
                key={col.id}
                className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-600 dark:bg-slate-800/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-sm text-slate-800 dark:text-slate-100">
                    {col.key}
                  </span>
                  <select
                    value={draft.type}
                    onChange={(e) => handleTypeChange(col, e.target.value as ProjectColumnType)}
                    className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    aria-label={`${col.key} tipi`}
                  >
                    {(Object.keys(PROJECT_COLUMN_TYPE_LABELS) as ProjectColumnType[]).map((t) => (
                      <option key={t} value={t}>
                        {PROJECT_COLUMN_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleDelete(col)}
                    disabled={busyId === col.id}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    title="Tip atamasını kaldır"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <p className="ml-5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {PROJECT_COLUMN_TYPE_HINTS[draft.type]}
                </p>
                {showOptions && (
                  <div className="ml-5 mt-2">
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Seçenekler (virgülle veya satırla ayrı)
                    </label>
                    <input
                      type="text"
                      value={draft.optionsText}
                      onChange={(e) => handleOptionsChange(col, e.target.value)}
                      placeholder="Acil, Orta, Düşük"
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {untyped.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Tiplenmemiş sütunlar ({untyped.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {untyped.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => void handleAdd(k)}
                disabled={busyId === "__new__"}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/30",
                  busyId === "__new__" && "opacity-50"
                )}
              >
                <Plus className="h-3 w-3" aria-hidden />
                {k}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Bunlar görevlerde gözlemlenmiş ama henüz tip atanmamış. Tek tıkla otomatik tiple veya
            yukarıdaki &quot;Otomatik tipla&quot; butonuyla hepsini birden ekle.
          </p>
        </div>
      )}
    </div>
  );
}
