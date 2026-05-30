"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Database,
  Edit3,
  FileJson,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { YonetimAccessDenied } from "@/components/yonetim/YonetimAccessDenied";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/modals";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createReferenceSource,
  countReferenceUsage,
  deleteReferenceSource,
  guessReferenceKeyField,
  guessReferenceLabelField,
  listReferenceSources,
  parseReferenceFile,
  updateReferenceSource,
  type ReferenceSource,
} from "@/lib/referenceSources";
import { cn } from "@/lib/utils";

type EditorState = {
  source: ReferenceSource;
  name: string;
  description: string;
  category: string;
  labelField: string;
  keyField: string;
  fields: string[];
  records: Record<string, string>[];
} | null;

export default function ReferansVerilerPage() {
  const { isLoaded, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canView = hasPermission("area.userManagement") || hasPermission("projects.edit");
  const canEdit = hasPermission("userManagement.edit") || hasPermission("projects.edit");
  const [sources, setSources] = useState<ReferenceSource[]>([]);
  const [usageBySourceId, setUsageBySourceId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [fileName, setFileName] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [labelField, setLabelField] = useState("");
  const [keyField, setKeyField] = useState("");
  const [saving, setSaving] = useState(false);

  // Filtre state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Inline editor
  const [editor, setEditor] = useState<EditorState>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorSearch, setEditorSearch] = useState("");
  const [editorVisibleLimit, setEditorVisibleLimit] = useState(100);

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listReferenceSources();
      setSources(list);
      // Her kaynak için kullanım sayımı paralel
      const usagePairs = await Promise.all(
        list.map(async (s) => [s.id, await countReferenceUsage(s.id, s.name).catch(() => 0)] as const)
      );
      setUsageBySourceId(Object.fromEntries(usagePairs));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Referans kaynakları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of sources) {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
  }, [sources]);

  const filteredSources = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return sources.filter((s) => {
      if (categoryFilter !== "all") {
        if (categoryFilter === "__uncategorized__") {
          if (s.category && s.category.trim()) return false;
        } else if (s.category !== categoryFilter) return false;
      }
      if (q) {
        const hay = `${s.name} ${s.description ?? ""} ${s.category ?? ""} ${s.fields.join(" ")}`.toLocaleLowerCase("tr");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sources, search, categoryFilter]);

  const previewRows = useMemo(() => records.slice(0, 3), [records]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseReferenceFile(file.name, text);
      setFileName(file.name);
      setFields(parsed.fields);
      setRecords(parsed.records);
      setLabelField(guessReferenceLabelField(parsed.fields));
      setKeyField(guessReferenceKeyField(parsed.fields));
      if (!name.trim()) {
        setName(file.name.replace(/\.(json|csv|tsv)$/i, "").replace(/[-_]+/g, " "));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Kaynak adı girin.");
      return;
    }
    if (records.length === 0 || fields.length === 0) {
      toast.error("Önce JSON veya CSV dosyası seçin.");
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
        category: category.trim() || null,
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
      setCategory("");
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
    const usage = usageBySourceId[source.id] ?? 0;
    const ok = await confirm({
      title: "Referans kaynağı sil",
      message:
        usage > 0
          ? `"${source.name}" şu an ${usage} proje sütununda kullanılıyor. Silinince o sütunlarda dropdown bağı kopar (önceden atanmış değerler kalır). Devam edilsin mi?`
          : `"${source.name}" silinsin mi? Bu işlem geri alınamaz.`,
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

  // === Inline editor ===
  const openEditor = (source: ReferenceSource) => {
    setEditor({
      source,
      name: source.name,
      description: source.description ?? "",
      category: source.category ?? "",
      labelField: source.labelField ?? "",
      keyField: source.keyField ?? "",
      fields: [...source.fields],
      records: source.records.map((r) => ({ ...r })),
    });
    setEditorSearch("");
    setEditorVisibleLimit(100);
  };

  const closeEditor = () => {
    setEditor(null);
    setEditorSearch("");
    setEditorVisibleLimit(100);
  };

  /**
   * Filtrelenmiş + sayfalı kayıtlar.
   * 1000+ kayıtlık dosyalarda tüm satırları render etmek tarayıcıyı kasar;
   * arama input'u ile süzme + max 100 satır göster + "daha fazla yükle" butonu.
   */
  const editorVisibleRecords = useMemo(() => {
    if (!editor) return { rows: [] as Array<{ record: Record<string, string>; originalIndex: number }>, total: 0 };
    const q = editorSearch.trim().toLocaleLowerCase("tr");
    let filteredIndices: number[];
    if (!q) {
      filteredIndices = editor.records.map((_, i) => i);
    } else {
      filteredIndices = [];
      for (let i = 0; i < editor.records.length; i += 1) {
        const rec = editor.records[i];
        let match = false;
        for (const field of editor.fields) {
          const v = String(rec[field] ?? "").toLocaleLowerCase("tr");
          if (v.includes(q)) {
            match = true;
            break;
          }
        }
        if (match) filteredIndices.push(i);
      }
    }
    const visible = filteredIndices.slice(0, editorVisibleLimit);
    return {
      rows: visible.map((originalIndex) => ({ record: editor.records[originalIndex], originalIndex })),
      total: filteredIndices.length,
    };
  }, [editor, editorSearch, editorVisibleLimit]);

  const updateEditorRecord = (index: number, field: string, value: string) => {
    setEditor((curr) => {
      if (!curr) return curr;
      const next = curr.records.map((r) => ({ ...r }));
      next[index] = { ...next[index], [field]: value };
      return { ...curr, records: next };
    });
  };

  const addEditorRow = () => {
    setEditor((curr) => {
      if (!curr) return curr;
      const blank = Object.fromEntries(curr.fields.map((f) => [f, ""]));
      return { ...curr, records: [...curr.records, blank] };
    });
  };

  const deleteEditorRow = (index: number) => {
    setEditor((curr) => {
      if (!curr) return curr;
      return { ...curr, records: curr.records.filter((_, i) => i !== index) };
    });
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      toast.error("Kaynak adı boş olamaz.");
      return;
    }
    setEditorSaving(true);
    try {
      await updateReferenceSource(editor.source.id, {
        name: editor.name,
        description: editor.description,
        category: editor.category,
        labelField: editor.labelField,
        keyField: editor.keyField,
        records: editor.records,
        fields: editor.fields,
        searchFields: Array.from(new Set([editor.labelField, editor.keyField].filter(Boolean))),
      });
      toast.success("Kaynak güncellendi");
      setEditor(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi.");
    } finally {
      setEditorSaving(false);
    }
  };

  if (!isLoaded) {
    return <div className="container max-w-5xl py-10 text-slate-500">Yükleniyor…</div>;
  }

  if (!canView) {
    return <YonetimAccessDenied />;
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
            JSON / CSV kaynaklarını merkezi kaydet; projelerde dropdown, otomatik doldurma ve import zenginleştirme için kullan.
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
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Yeni kaynak</h2>
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
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori (opsiyonel)</label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    list="reference-category-suggestions"
                    placeholder="Sağlık, Ödeme, Müşteri..."
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <datalist id="reference-category-suggestions">
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Dosya seç</label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                    <Upload className="h-4 w-4" aria-hidden />
                    JSON veya CSV
                    <input
                      type="file"
                      accept=".json,.csv,.tsv,application/json,text/csv"
                      className="hidden"
                      onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Kurum seçimi ve satır zenginleştirme için ana referans."
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              {fileName && (
                <p className="text-xs text-slate-500">
                  {fileName} · {records.length.toLocaleString("tr-TR")} kayıt · {fields.length} alan
                  {records.length >= 1000 && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">
                      · büyük dosya — canlı tabloda dropdown otomatik arama-ile-filtre moduna geçer
                    </span>
                  )}
                </p>
              )}
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
                  <p className="text-sm text-slate-500">JSON / CSV seçilince ilk kayıtlar burada görünür.</p>
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

      {/* Arama + kategori filtresi */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kaynak, açıklama veya alan adı ara..."
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-7 text-xs text-slate-700 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600"
              title="Aramayı temizle"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="all">Tüm kategoriler</option>
            <option value="__uncategorized__">Kategorisiz</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <span className="text-xs text-slate-400">
          {filteredSources.length} / {sources.length} kaynak
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">Kayıtlı kaynaklar</h2>
        </div>
        {loading && sources.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
          </div>
        ) : filteredSources.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            {sources.length === 0 ? "Henüz kayıtlı referans kaynak yok." : "Bu kriterlere uyan kaynak yok."}
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredSources.map((source) => {
              const usage = usageBySourceId[source.id] ?? 0;
              return (
                <div key={source.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{source.name}</p>
                      <Badge variant="outline">{source.recordCount} kayıt</Badge>
                      {source.labelField && <Badge>{source.labelField}</Badge>}
                      {source.category && (
                        <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200">
                          <Tag className="h-3 w-3" />
                          {source.category}
                        </Badge>
                      )}
                      {usage > 0 && (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                          {usage} sütunda kullanılıyor
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {source.fileName ?? "Dosya adı yok"} · Alanlar: {source.fields.slice(0, 6).join(", ")}{source.fields.length > 6 ? ` +${source.fields.length - 6}` : ""}
                    </p>
                    {source.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{source.description}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditor(source)}
                        title="Kaynağı düzenle (içerik + meta)"
                      >
                        <Edit3 className="mr-1 h-3.5 w-3.5" />
                        Düzenle
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(source)}
                        aria-label="Kaynağı sil"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Editor Dialog */}
      <Dialog
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Kaynağı düzenle</DialogTitle>
            <DialogDescription className="text-xs">
              Kayıtları satır bazında düzenle, ekle veya sil. Alan listesi (kolon yapısı) değiştirilmez — yeni alan eklemek için yeniden yükleme yapın.
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="flex flex-col gap-3 overflow-hidden">
              {/* Meta alanları */}
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Ad
                  <input
                    value={editor.name}
                    onChange={(e) => setEditor((c) => (c ? { ...c, name: e.target.value } : c))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Kategori
                  <input
                    value={editor.category}
                    onChange={(e) => setEditor((c) => (c ? { ...c, category: e.target.value } : c))}
                    list="reference-category-suggestions"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Etiket alanı
                  <select
                    value={editor.labelField}
                    onChange={(e) => setEditor((c) => (c ? { ...c, labelField: e.target.value } : c))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">Seçin</option>
                    {editor.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Anahtar alanı
                  <select
                    value={editor.keyField}
                    onChange={(e) => setEditor((c) => (c ? { ...c, keyField: e.target.value } : c))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">Opsiyonel</option>
                    {editor.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="col-span-2 grid gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                  Açıklama
                  <textarea
                    value={editor.description}
                    onChange={(e) => setEditor((c) => (c ? { ...c, description: e.target.value } : c))}
                    rows={2}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </label>
              </div>

              {/* Kayıtlar — arama + sayfalı liste */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Kayıtlar ({editor.records.length}{editorSearch && ` · ${editorVisibleRecords.total} eşleşme`})
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" aria-hidden />
                    <input
                      type="text"
                      value={editorSearch}
                      onChange={(e) => {
                        setEditorSearch(e.target.value);
                        setEditorVisibleLimit(100);
                      }}
                      placeholder="Kayıtlarda ara..."
                      className="w-56 rounded border border-slate-200 bg-white py-1 pl-6 pr-6 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                    {editorSearch && (
                      <button
                        type="button"
                        onClick={() => setEditorSearch("")}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600"
                        title="Temizle"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addEditorRow}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Satır ekle
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="w-8 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500">#</th>
                      {editor.fields.map((f) => (
                        <th key={f} className="px-2 py-1.5 text-left text-[10px] font-semibold text-slate-500">
                          {f}
                          {f === editor.labelField && <span className="ml-1 text-blue-500">★</span>}
                        </th>
                      ))}
                      <th className="w-8 px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editorVisibleRecords.rows.map(({ record: rec, originalIndex: idx }) => (
                      <tr key={idx} className={cn("border-t border-slate-100 dark:border-slate-700/50", idx % 2 === 1 && "bg-slate-50/40 dark:bg-slate-900/20")}>
                        <td className="px-2 py-1 text-[10px] text-slate-400">{idx + 1}</td>
                        {editor.fields.map((f) => (
                          <td key={f} className="px-1 py-0.5">
                            <input
                              value={rec[f] ?? ""}
                              onChange={(e) => updateEditorRecord(idx, f, e.target.value)}
                              className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-none dark:hover:border-slate-600 dark:focus:bg-slate-700"
                            />
                          </td>
                        ))}
                        <td className="px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => deleteEditorRow(idx)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                            title="Satırı sil"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {editorVisibleRecords.total === 0 && (
                      <tr>
                        <td colSpan={editor.fields.length + 2} className="px-3 py-4 text-center text-slate-500">
                          {editorSearch ? "Eşleşen kayıt yok." : "Kayıt yok."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {editorVisibleRecords.total > editorVisibleRecords.rows.length && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                  <span className="text-slate-500 dark:text-slate-400">
                    {editorVisibleRecords.rows.length} / {editorVisibleRecords.total} kayıt gösteriliyor
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditorVisibleLimit((curr) => curr + 200)}
                  >
                    Daha fazla yükle (+200)
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditor} disabled={editorSaving}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void saveEditor()} disabled={editorSaving}>
              {editorSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Değişiklikleri kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
