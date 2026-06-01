"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardList, FileUp, Upload } from "lucide-react";
import type { ProjectColumn } from "@/lib/projectColumns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
import { getExtraColumnFormatKind, normalizeExtraDataBySmartRules } from "@/lib/extraColumnFormatRules";
import { enrichExtraDataFromReferenceRecords } from "@/lib/referenceExtraDataEnrichment";
import { isSensitiveExtraColumnKey } from "@/lib/extraColumnSensitiveDisplay";
import { cn } from "@/lib/utils";

/**
 * Hassas sütunlarda (TCKN/Sicil/Personel No/Kimlik No) "•" veya "·" gibi mask
 * karakterleri tespit eder. Daha önce yaşanan veri bozulması: kullanıcı
 * `unmaskSensitive: false` ile CSV export edip aynı CSV'yi re-import edince
 * DB'ye masked değerler kalıcı olarak yazılmıştı. Bu detector import preview'da
 * uyarı + onay isteyerek aynı senaryoyu engeller.
 */
const MASK_CHAR_RE = /[•·]/;
function detectMaskedSensitiveInTasks(
  tasks: Array<{ extra_data?: Record<string, string> | null }>
): { count: number; columns: string[] } {
  const columns = new Set<string>();
  let count = 0;
  for (const task of tasks) {
    const ed = task.extra_data;
    if (!ed) continue;
    for (const [key, val] of Object.entries(ed)) {
      if (!isSensitiveExtraColumnKey(key)) continue;
      if (typeof val !== "string" || val.length === 0) continue;
      if (MASK_CHAR_RE.test(val)) {
        count++;
        columns.add(key);
      }
    }
  }
  return { count, columns: Array.from(columns) };
}

type ColumnMapKey = "content" | "status" | "assignee" | "priority";
const COLUMN_MAP_LABELS: Record<ColumnMapKey, string> = {
  content: "İçerik",
  status: "Durum",
  assignee: "Atanan",
  priority: "Öncelik",
};

export function CSVImportDialog({
  open,
  onOpenChange,
  onImport,
  referenceColumns = [],
  referenceKnownKeys = [],
  defaultStatus = "Yapılacak",
  defaultPriority = "Medium",
  replaceTargetProjectName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (tasks: Array<{ content: string; status: string; assignee: string | null; priority?: string | null; extra_data?: Record<string, string> | null }>, replaceExisting: boolean) => Promise<void>;
  referenceColumns?: ProjectColumn[];
  referenceKnownKeys?: string[];
  defaultStatus?: string;
  defaultPriority?: string;
  replaceTargetProjectName?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerAliases, setHeaderAliases] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<ColumnMapKey, number | null>>({
    content: null,
    status: null,
    assignee: null,
    priority: null,
  });
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  /**
   * "Hassas sütunda maskeli karakter saptandı" uyarısını kullanıcının
   * bilerek görmezden geldiğini gösterir. False kalırsa import butonu kilitli.
   */
  const [acknowledgedMasked, setAcknowledgedMasked] = useState(false);

  const reset = useCallback(() => {
    setHeaders([]);
    setHeaderAliases([]);
    setRows([]);
    setColumnMap({ content: null, status: null, assignee: null, priority: null });
    setReplaceExisting(false);
    setReplaceConfirmText("");
    setError(null);
    setPasteText("");
    setAcknowledgedMasked(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const autoMapHeaders = useCallback((h: string[]) => {
    const map: Record<ColumnMapKey, number | null> = { content: null, status: null, assignee: null, priority: null };
    const lower = (s: string) => s.trim().toLowerCase();
    // Açıklama (content) kaynaktan hiç doldurulmaz; tabloda kullanıcı notu için ayrıldığından eşleme yapılmaz
    h.forEach((header, i) => {
      const l = lower(header);
      if (l === "durum" || l === "status") map.status = i;
      else if (l === "atanan" || l === "assignee" || l === "atanan kişi" || l === "ünvan" || l === "unvan" || l === "aktif_unvan_ad" || l === "adı" || l === "adi") map.assignee = i;
      else if (l === "öncelik" || l === "priority") map.priority = i;
    });
    setColumnMap(map);
  }, []);

  const processFileContent = useCallback(
    (text: string, fileName: string) => {
      setError(null);
      const lower = (fileName ?? "").toLowerCase();
      try {
        if (lower.endsWith(".json")) {
          const { headers: h, rows: jsonRows } = parseJSON(text);
          if (h.length === 0) {
            setError("JSON dosyası boş veya geçersiz (nesne dizisi beklenir).");
            return;
          }
          const r = jsonRows.map((row) => h.map((key) => row[key] ?? ""));
          setHeaders(h);
          setHeaderAliases(h);
          setRows(r);
          autoMapHeaders(h);
        } else {
          const { headers: h, rows: r } = parseCSV(text);
          if (h.length === 0) {
            setError("CSV dosyası boş veya geçersiz.");
            return;
          }
          setHeaders(h);
          setHeaderAliases(h);
          setRows(r);
          autoMapHeaders(h);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dosya okunamadı.");
      }
    },
    [autoMapHeaders]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => processFileContent(String(reader.result ?? ""), file.name);
      reader.readAsText(file, "UTF-8");
    },
    [processFileContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const name = (file.name ?? "").toLowerCase();
      if (!name.endsWith(".csv") && !name.endsWith(".json")) {
        setError("Sadece CSV veya JSON dosyası bırakın.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => processFileContent(String(reader.result ?? ""), file.name);
      reader.readAsText(file, "UTF-8");
    },
    [processFileContent]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const buildTasks = useCallback(() => {
    if (rows.length === 0) return [];
    return rows.map((row) => {
      const get = (i: number) => (row[i] != null ? String(row[i]).trim() : "");
      const extra_data: Record<string, string> = {};
      headerAliases.forEach((h, i) => {
        const key = h?.trim() || `Sütun ${i + 1}`;
        extra_data[key] = get(i);
      });
      // Açıklama (content) kaynak dosyadan hiç doldurulmaz; tabloda kullanıcının ek notu için ayrıldı
      const content = "";
      const status = columnMap.status != null ? get(columnMap.status) || "Yapılacak" : "Yapılacak";
      const assignee = columnMap.assignee != null ? get(columnMap.assignee) || null : null;
      const priority = columnMap.priority != null ? get(columnMap.priority) || null : null;
      const hasAnyData = Object.values(extra_data).some((v) => v !== "");
      if (!hasAnyData) return null;
      return {
        content,
        status,
        assignee,
        priority: priority ?? null,
        extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
      };
    }).filter((t): t is NonNullable<typeof t> => t !== null);
  }, [rows, headerAliases, columnMap]);

  const applySmartHeaderFixes = useCallback(() => {
    setHeaderAliases((prev) =>
      prev.map((header) => {
        const n = header.trim().toLocaleLowerCase("tr");
        if (
          /(^|\s)(e-?posta|email|mail)\s*durum(u)?($|\s)/i.test(n) ||
          /(^|\s)mail\s*gonderim\s*durum(u)?($|\s)/i.test(n)
        ) {
          return "İleti Durumu";
        }
        return header;
      })
    );
  }, []);

  const pasteLines = useMemo(() => {
    if (!pasteText.trim()) return [];
    return pasteText.split(/\n/).map((s) => s.trim()).filter(Boolean);
  }, [pasteText]);

  const buildTasksFromPaste = useCallback(() => {
    // Açıklama (content) boş bırakılır; yapıştırılan metin extra_data.Görev ile saklanır
    return pasteLines.map((line) => ({
      content: "",
      status: defaultStatus,
      assignee: null as string | null,
      priority: defaultPriority as string | null,
      extra_data: line ? { Görev: line } : null,
    }));
  }, [pasteLines, defaultStatus, defaultPriority]);

  const handleImport = useCallback(async () => {
    if (replaceExisting && !replaceTargetProjectName) {
      setError("Mevcut veriyi değiştirmek için önce tek bir proje filtresi seçin.");
      return;
    }
    if (replaceExisting && replaceConfirmText.trim() !== replaceTargetProjectName) {
      setError(`Güvenlik onayı için proje adını birebir yazın: ${replaceTargetProjectName}`);
      return;
    }
    const tasks = importMode === "paste" ? buildTasksFromPaste() : buildTasks();
    if (tasks.length === 0) {
      setError(importMode === "paste" ? "En az bir satır metin girin (boş satırlar yok sayılır)." : "Dosyada geçerli veri bulunamadı (en az bir satırda veri olmalı).");
      return;
    }
    if (importMode === "file") {
      const normalized = headerAliases
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => h.toLocaleLowerCase("tr"));
      const duplicates = normalized.filter((h, i) => normalized.indexOf(h) !== i);
      if (duplicates.length > 0) {
        setError(`İçe aktarma durduruldu. Aynı sütun adı birden fazla kez kullanılmış: ${Array.from(new Set(duplicates)).join(", ")}`);
        return;
      }
    }
    const formatErrors: string[] = [];
    const formattedTasks = tasks.map((task, index) => {
      const formattedExtraData = normalizeExtraDataBySmartRules(task.extra_data);
      if (formattedExtraData.errors.length > 0) {
        for (const err of formattedExtraData.errors) {
          formatErrors.push(`Satır ${index + 1} · ${err.message}`);
        }
      }
      const enrichedExtraData = enrichExtraDataFromReferenceRecords(
        formattedExtraData.data,
        referenceColumns,
        referenceKnownKeys
      );
      return { ...task, extra_data: enrichedExtraData };
    });
    if (formatErrors.length > 0) {
      setError(
        [
          "İçe aktarma durduruldu. Aşağıdaki akıllı sütun formatlarını düzeltin:",
          ...formatErrors.slice(0, 8),
          formatErrors.length > 8 ? `+${formatErrors.length - 8} hata daha` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      return;
    }
    setImporting(true);
    setError(null);
    try {
      await onImport(formattedTasks, replaceExisting);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err != null && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : err instanceof Error
            ? err.message
            : "İçe aktarma başarısız.";
      setError(msg);
    } finally {
      setImporting(false);
    }
  }, [
    importMode,
    buildTasksFromPaste,
    buildTasks,
    headerAliases,
    referenceColumns,
    referenceKnownKeys,
    replaceExisting,
    replaceTargetProjectName,
    replaceConfirmText,
    onImport,
    onOpenChange,
  ]);

  const canImport = importMode === "paste" ? pasteLines.length > 0 : rows.length > 0;
  const replaceConfirmationOk =
    !replaceExisting || (!!replaceTargetProjectName && replaceConfirmText.trim() === replaceTargetProjectName);

  // KVKK savunma: import preview'da hassas kolon değerleri "•" karakteri içeriyorsa
  // muhtemelen `unmaskSensitive: false` CSV export'unun re-import'u — onay iste.
  // Paste modunda extra_data sadece `Görev` anahtarı içerir, sensitive değil; yine de
  // tek tek kontrol et (ileride paste kaynaklı sensitive kolon eklenirse korumalı).
  const maskedSensitiveFinding = useMemo(() => {
    if (!canImport) return { count: 0, columns: [] as string[] };
    const previewTasks = importMode === "paste" ? buildTasksFromPaste() : buildTasks();
    return detectMaskedSensitiveInTasks(previewTasks);
  }, [canImport, importMode, buildTasks, buildTasksFromPaste]);
  const requiresMaskedAck = maskedSensitiveFinding.count > 0;
  const maskedAckOk = !requiresMaskedAck || acknowledgedMasked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Toplu görev ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
            <button
              type="button"
              onClick={() => setImportMode("file")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                importMode === "file"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
            >
              <FileUp className="h-4 w-4" />
              Dosya (CSV/JSON)
            </button>
            <button
              type="button"
              onClick={() => setImportMode("paste")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                importMode === "paste"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              Metin yapıştır
            </button>
          </div>
          {importMode === "paste" ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Her satır bir görev olacak şekilde metin yapıştırın. Boş satırlar yok sayılır. Tüm görevlere varsayılan durum ve öncelik uygulanır.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Her satır bir görev\nGörev 1\nGörev 2\nGörev 3"}
                rows={8}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 font-mono"
              />
              {pasteLines.length > 0 && (
                <div className="rounded border border-emerald-200 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 p-3">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    {pasteLines.length} görev eklenecek
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    Durum: {defaultStatus} · Öncelik: {defaultPriority}
                  </p>
                  <div className="mt-2 max-h-32 overflow-y-auto rounded border border-slate-200 bg-white/80 dark:border-slate-600 dark:bg-slate-800/80 p-2 text-xs text-slate-700 dark:text-slate-300">
                    {pasteLines.slice(0, 15).map((line, i) => (
                      <div key={i} className="truncate py-0.5" title={line}>{i + 1}. {line}</div>
                    ))}
                    {pasteLines.length > 15 && <div className="py-0.5 text-slate-500">… +{pasteLines.length - 15} satır daha</div>}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  disabled={!replaceTargetProjectName}
                  onChange={(e) => {
                    setReplaceExisting(e.target.checked);
                    setReplaceConfirmText("");
                    setError(null);
                  }}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
                />
                Mevcut veriyi sil ve yeni görevlerle değiştir
              </label>
              {replaceExisting && replaceTargetProjectName && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/35 dark:text-red-100">
                  <p className="font-semibold">Riskli işlem: mevcut proje görevleri silinecek.</p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-200">
                    Devam etmek için proje adını birebir yazın: <strong>{replaceTargetProjectName}</strong>
                  </p>
                  <input
                    value={replaceConfirmText}
                    onChange={(e) => setReplaceConfirmText(e.target.value)}
                    placeholder={replaceTargetProjectName}
                    className="mt-2 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-950 placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-800 dark:bg-slate-950 dark:text-red-100"
                  />
                </div>
              )}
              {!replaceTargetProjectName && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Mevcut veriyi değiştirmek için önce Canlı Tablo’da tek bir proje filtresi seçilmeli.
                </p>
              )}
            </>
          ) : (
            <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            CSV veya JSON dosyası yükleyin veya bu alana sürükleyip bırakın. CSV’de ilk satır başlık kabul edilir. <strong>Tüm sütunlar olduğu gibi tabloya yansır.</strong> Tablodaki <strong>Açıklama</strong> sütunu kaynak dosyadan hiç doldurulmaz; tablo üzerinde çalışırken ek not girmek için ayrılmıştır.
          </p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "rounded-lg border-2 border-dashed p-4 transition-colors",
              isDragOver
                ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20"
                : "border-slate-200 bg-slate-50/30 dark:border-slate-600 dark:bg-slate-800/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Dosya seç veya sürükleyip bırak
            </Button>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">CSV veya JSON</p>
          </div>
          {headers.length > 0 && (
            <>
              <div className="rounded border border-emerald-200 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 p-3 mb-3">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  ✓ {headers.length} sütun, {rows.length} satır tespit edildi
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Tüm sütunlar tabloya eklenecek: {headers.slice(0, 5).join(", ")}{headers.length > 5 ? ` +${headers.length - 5} daha` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={applySmartHeaderFixes}
                  >
                    Başlık düzeltmelerini uygula
                  </Button>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Excel/CSV açmadan sütun adını burada düzenleyebilirsiniz.
                  </span>
                </div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-700 p-3 mb-3">
                <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Sütun başlıklarını düzenle (import öncesi)</p>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {headers.map((original, idx) => {
                    const alias = headerAliases[idx] ?? original;
                    const detected = getExtraColumnFormatKind(alias);
                    return (
                      <div key={`${original}-${idx}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                        <div className="truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={original}>
                          {original}
                        </div>
                        <input
                          value={alias}
                          onChange={(e) =>
                            setHeaderAliases((prev) => {
                              const next = [...prev];
                              next[idx] = e.target.value;
                              return next;
                            })
                          }
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {detected ? `tip:${detected}` : "tip:yok"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-2 bg-slate-50 dark:bg-slate-800">
                  Önizleme (ilk 5 satır)
                </p>
                <div className="overflow-x-auto max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        {(Object.keys(COLUMN_MAP_LABELS) as ColumnMapKey[]).map((k) => (
                          <th key={k} className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-400">
                            {COLUMN_MAP_LABELS[k]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, ri) => (
                        <tr key={ri} className="border-b border-slate-100 dark:border-slate-700">
                          {(Object.keys(COLUMN_MAP_LABELS) as ColumnMapKey[]).map((k) => (
                            <td key={k} className="px-2 py-1 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                              {columnMap[k] != null ? row[columnMap[k]!] ?? "—" : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  disabled={!replaceTargetProjectName}
                  onChange={(e) => {
                    setReplaceExisting(e.target.checked);
                    setReplaceConfirmText("");
                    setError(null);
                  }}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
                />
                Mevcut veriyi sil ve CSV ile değiştir
              </label>
              {replaceExisting && replaceTargetProjectName && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/35 dark:text-red-100">
                  <p className="font-semibold">Riskli işlem: mevcut proje görevleri silinecek.</p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-200">
                    Devam etmek için proje adını birebir yazın: <strong>{replaceTargetProjectName}</strong>
                  </p>
                  <input
                    value={replaceConfirmText}
                    onChange={(e) => setReplaceConfirmText(e.target.value)}
                    placeholder={replaceTargetProjectName}
                    className="mt-2 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-950 placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-800 dark:bg-slate-950 dark:text-red-100"
                  />
                </div>
              )}
              {!replaceTargetProjectName && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Mevcut veriyi değiştirmek için önce Canlı Tablo’da tek bir proje filtresi seçilmeli.
                </p>
              )}
            </>
          )}
            </>
          )}
          {requiresMaskedAck && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Hassas sütunda maskeli değer saptandı
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    {maskedSensitiveFinding.count} satırda hassas sütunlar
                    (<span className="font-mono">{maskedSensitiveFinding.columns.join(", ")}</span>)
                    {" "}<span className="font-mono">•</span> karakteri içeriyor. Bu, &quot;Maskeli olarak dışa aktar&quot; ile
                    indirilmiş bir CSV&apos;yi tekrar yüklediğinizi gösterebilir. İçe aktarırsanız
                    DB&apos;ye maskeli (geri alınamaz) değerler kalıcı olarak yazılır ve raw veri kaybolur.
                  </p>
                  <label className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <input
                      type="checkbox"
                      checked={acknowledgedMasked}
                      onChange={(e) => setAcknowledgedMasked(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-amber-300 text-amber-600 focus:ring-amber-500 dark:border-amber-600"
                    />
                    <span>Bilerek devam etmek istiyorum (veri kaybı riski farkındayım)</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          {error && <p className="whitespace-pre-line text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="button"
            variant={replaceExisting ? "destructive" : "default"}
            onClick={handleImport}
            disabled={!canImport || importing || !replaceConfirmationOk || !maskedAckOk}
          >
            {importing
              ? "Aktarılıyor…"
              : replaceExisting
                ? importMode === "paste"
                  ? `${pasteLines.length} görevle değiştir`
                  : `${rows.length} satırla değiştir`
                : importMode === "paste"
                  ? `${pasteLines.length} görev ekle`
                  : `${rows.length} satır içe aktar`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
