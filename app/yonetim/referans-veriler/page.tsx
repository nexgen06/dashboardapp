"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Database, FileJson, Loader2, RefreshCw, Shield, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import {
  createReferenceSource,
  deleteReferenceSource,
  guessReferenceKeyField,
  guessReferenceLabelField,
  listReferenceSources,
  parseReferenceJson,
  type ReferenceSource,
} from "@/lib/referenceSources";

export default function ReferansVerilerPage() {
  const { isLoaded, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canView = hasPermission("userManagement.view");
  const canEdit = hasPermission("userManagement.edit") || hasPermission("projects.edit");
  const [sources, setSources] = useState<ReferenceSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [labelField, setLabelField] = useState("");
  const [keyField, setKeyField] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      setSources(await listReferenceSources());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Referans kaynakları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const previewRows = useMemo(() => records.slice(0, 3), [records]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseReferenceJson(text);
      setFileName(file.name);
      setFields(parsed.fields);
      setRecords(parsed.records);
      setLabelField(guessReferenceLabelField(parsed.fields));
      setKeyField(guessReferenceKeyField(parsed.fields));
      if (!name.trim()) setName(file.name.replace(/\.json$/i, "").replace(/[-_]+/g, " "));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "JSON okunamadı.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Kaynak adı girin.");
      return;
    }
    if (records.length === 0 || fields.length === 0) {
      toast.error("Önce JSON dosyası seçin.");
      return;
    }
    if (!labelField) {
      toast.error("Etiket alanı seçin.");
      return;
    }
    setSaving(true);
    try {
      await createReferenceSource({
        name,
        description,
        fileName,
        fields,
        records,
        labelField,
        keyField,
        searchFields: Array.from(new Set([labelField, keyField].filter(Boolean))),
      });
      toast.success("Referans kaynak kaydedildi");
      setName("");
      setDescription("");
      setFileName("");
      setFields([]);
      setRecords([]);
      setLabelField("");
      setKeyField("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (source: ReferenceSource) => {
    const ok = await confirm({
      title: "Referans kaynağı sil",
      message: `"${source.name}" silinsin mi? Mevcut proje sütunlarına daha önce aktarılmış seçenekler silinmez.`,
      confirmLabel: "Sil",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteReferenceSource(source.id);
      toast.success("Referans kaynak silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi.");
    }
  };

  if (!isLoaded) {
    return <div className="container max-w-5xl py-10 text-slate-500">Yükleniyor…</div>;
  }

  if (!canView) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-700 dark:bg-amber-950/30">
          <Shield className="mx-auto mb-3 h-10 w-10 text-amber-600" />
          <p className="font-medium text-slate-800 dark:text-slate-100">Bu sayfaya erişim yetkiniz yok.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            <Database className="h-6 w-6 text-blue-600" aria-hidden />
            Referans Veriler
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            JSON kaynaklarını merkezi kaydet; projelerde dropdown, otomatik doldurma ve import zenginleştirme için kullan.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Yenile
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      )}

      {canEdit && (
        <form onSubmit={handleSave} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kaynak adı</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sağlık Kurumları"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Kurum seçimi ve satır zenginleştirme için ana referans."
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                <Upload className="h-4 w-4" aria-hidden />
                JSON dosyası seç
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0] ?? null)} />
              </label>
              {fileName && <p className="text-xs text-slate-500">{fileName} · {records.length} kayıt · {fields.length} alan</p>}
            </div>

            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Etiket alanı
                  <select value={labelField} onChange={(e) => setLabelField(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="">Seçin</option>
                    {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Anahtar alanı
                  <select value={keyField} onChange={(e) => setKeyField(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                    <option value="">Opsiyonel</option>
                    {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
                <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Önizleme</p>
                {previewRows.length === 0 ? (
                  <p className="text-sm text-slate-500">JSON seçilince ilk kayıtlar burada görünür.</p>
                ) : (
                  <div className="max-h-44 overflow-auto text-xs">
                    {previewRows.map((row, idx) => (
                      <pre key={idx} className="mb-2 rounded bg-white p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {JSON.stringify(row, null, 2)}
                      </pre>
                    ))}
                  </div>
                )}
              </div>
              <Button type="submit" disabled={saving || records.length === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
                Kaynağı kaydet
              </Button>
            </div>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">Kayıtlı kaynaklar</h2>
        </div>
        {loading && sources.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>
        ) : sources.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Henüz kayıtlı referans kaynak yok.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {sources.map((source) => (
              <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{source.name}</p>
                    <Badge variant="outline">{source.recordCount} kayıt</Badge>
                    {source.labelField && <Badge>{source.labelField}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {source.fileName ?? "Dosya adı yok"} · Alanlar: {source.fields.slice(0, 6).join(", ")}{source.fields.length > 6 ? ` +${source.fields.length - 6}` : ""}
                  </p>
                  {source.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{source.description}</p>}
                </div>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => void handleDelete(source)} aria-label="Kaynağı sil">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

