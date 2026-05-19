"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { useTaskCountByProject } from "@/hooks/useTaskCountByProject";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useSettings } from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { useProjectChatUnread } from "@/contexts/project-chat-unread-context";
import { formatDate } from "@/lib/formatDate";
import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
import {
  findAssigneeColumnIndex,
  findAssigneeJsonKey,
  normalizeTaskAssigneeEmail,
  pickRoundRobinAssignee,
} from "@/lib/projectImportAssignee";
import type { Project, ProjectStatus, ProjectPriority } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { RestrictedButton } from "@/components/ui/permission-gate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, PlusCircle, MoreVertical, Pencil, Archive, Trash2, RotateCw, Upload, FileText, UserPlus, X, Calendar, Flag, FolderKanban, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectColumnManager } from "@/components/ProjectColumnManager";

export type NewProjectSubmitData = {
  name: string;
  description: string;
  status: ProjectStatus;
  importFile?: File | null;
  assignee?: string;
  /** Projede çalışabilecek kullanıcıların e-postaları. Bu kişiler oturum açıp projeyi açtığında canlı tablo verisini görüntüleyip çalışabilir. */
  assignedEmails?: string[];
  /** Proje hedef / bitiş tarihi (ISO date string). */
  due_date?: string | null;
  /** Proje önceliği (High / Medium / Low). */
  priority?: ProjectPriority | null;
  /** Yalnızca yönetici: katı atanan görünürlüğü (RLS). */
  strictAssigneeVisibility?: boolean;
  /** Canlı tabloda bu proje için önceden gösterilecek ek sütun adları (`extra_data` anahtarları). */
  extraColumnKeys?: string[];
  /** Görev başlığı (Kanban/Özet) için kullanılacak extra_data anahtarı. Boş → otomatik. */
  titleColumn?: string | null;
  /** Görev kartı altında gösterilecek alt başlık anahtarları (en fazla 3). */
  subtitleColumns?: string[] | null;
  /** Kanban "Devam ediyor" kolonu için yumuşak WIP limiti. null/0 → limit yok. */
  wipInProgressLimit?: number | null;
  /** Yeni proje + dosya: atanan e-posta listesine round-robin (en az 2 e-posta). */
  importRoundRobin?: boolean;
  /**
   * İçe aktarılacak sütunların whitelist'i. undefined / boş → dosyadaki tüm sütunlar dahil
   * (geriye dönük uyumluluk). Kullanıcı önizleme üzerinden bazı sütunları kapattıysa
   * burada yalnızca tutulanlar gelir.
   */
  selectedImportColumns?: string[];
};

const STATUS_OPTIONS: ProjectStatus[] = ["Aktif", "Tamamlandı", "Beklemede"];
const STATUS_STYLES: Record<ProjectStatus, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  Tamamlandı: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
  Beklemede: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
};

const PRIORITY_OPTIONS: ProjectPriority[] = ["High", "Medium", "Low"];
const PRIORITY_STYLES: Record<ProjectPriority, string> = {
  High: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  Medium: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  Low: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

/** Form/API'den gelen önceliği "High" | "Medium" | "Low" olarak normalleştirir; JSON/CSV importta görevlere yansıtılır. */
function normalizeProjectPriority(v: string | ProjectPriority | null | undefined): ProjectPriority | null {
  const s = (v != null ? String(v).trim() : "").toLowerCase();
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return null;
}

/** Form metninden ek sütun anahtarları: satır veya virgül ile ayrılmış. */
function parseExtraColumnKeysFromForm(text: string): string[] {
  const set = new Set<string>();
  for (const part of text.split(/[\n,]+/)) {
    const t = part.trim();
    if (t !== "") set.add(t);
  }
  return Array.from(set);
}

/** Proje hedef tarihine göre "Gecikmiş" veya "Yaklaşan" etiketi. */
function getProjectDueLabel(project: Project): "Gecikmiş" | "Yaklaşan" | null {
  const d = project.due_date?.trim();
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() < today.getTime()) return "Gecikmiş";
  const inDays = Math.ceil((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (inDays <= 30) return "Yaklaşan";
  return null;
}

/**
 * Alt başlık sütunları seçici — kart başlığının altında küçük gri satırda gösterilecek
 * en fazla 3 anahtar. Başlık sütunuyla aynı olan adaylar listelenmez.
 */
function SubtitleColumnsPicker({
  availableKeys,
  titleColumn,
  value,
  onChange,
}: {
  availableKeys: string[];
  titleColumn: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const titleNorm = titleColumn.trim().toLowerCase();
  // Aday listesi: başlık sütunu hariç + zaten seçili olanları kalıcı tutmak için onları da ekle
  const candidatePool = new Set<string>();
  for (const k of availableKeys) {
    if (!k) continue;
    if (titleNorm && k.trim().toLowerCase() === titleNorm) continue;
    candidatePool.add(k);
  }
  for (const k of value) {
    if (k && (!titleNorm || k.trim().toLowerCase() !== titleNorm)) candidatePool.add(k);
  }
  const candidates = Array.from(candidatePool).sort((a, b) =>
    a.localeCompare(b, "tr", { sensitivity: "base" })
  );
  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
      return;
    }
    if (value.length >= 3) return;
    onChange([...value, key]);
  };
  return (
    <div className="mt-3">
      <p className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Alt başlık sütunları (en fazla 3)
      </p>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Kart başlığının altında küçük gri satırda gösterilir — &quot;Ahmet Yılmaz · 12345 · Ankara&quot; gibi
        görevi ayırt etmeye yardım eder. Sıralama seçim sırasına göre.
      </p>
      {candidates.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs italic text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Henüz sütun yok — önce &quot;Görev başlığı sütunu&quot; için liste oluşsun.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((k) => {
            const selected = value.includes(k);
            const order = selected ? value.indexOf(k) + 1 : 0;
            const disabled = !selected && value.length >= 3;
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                disabled={disabled}
                className={
                  selected
                    ? "inline-flex items-center gap-1 rounded-full border border-blue-500 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-200"
                    : disabled
                    ? "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-400 opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                    : "inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-950/30"
                }
              >
                {selected && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {order}
                  </span>
                )}
                {k}
              </button>
            );
          })}
        </div>
      )}
      {value.length > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Seçili: {value.join(" · ")} · {value.length}/3
        </p>
      )}
    </div>
  );
}

function ProjectFormModal({
  open,
  onOpenChange,
  project,
  onSubmit,
  isSubmitting,
  formError,
  isAdmin,
  observedExtraKeys = [],
  observedSampleValues = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSubmit: (data: NewProjectSubmitData) => Promise<void>;
  isSubmitting: boolean;
  formError?: string | null;
  isAdmin: boolean;
  /** Edit mode: bu projeye bağlı görevlerin extra_data'sında gerçekten kullanılan anahtarlar.
   *  "Görev başlığı sütunu" dropdown'ı şema + bunları birleşik gösterir. */
  observedExtraKeys?: string[];
  /** Edit mode: bu projeye bağlı görevlerin extra_data örnek değerleri (anahtar başına).
   *  Otomatik tip tahmini için ProjectColumnManager'a beslenir. */
  observedSampleValues?: Record<string, string[]>;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "Aktif");
  const [dueDate, setDueDate] = useState(project?.due_date?.slice(0, 10) ?? "");
  const [priority, setPriority] = useState<ProjectPriority | "">(project?.priority ?? "");
  const [importFile, setImportFile] = useState<File | null>(null);
  /** Önizleme verisi: dosya seçilince anlık parse edilir, kullanıcı sütun seçimi yapar. */
  const [importPreview, setImportPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  /** İçe aktarılacak sütunlar — varsayılan: tümü. Toggle ile kullanıcı çıkarabilir. */
  const [selectedImportColumns, setSelectedImportColumns] = useState<Set<string>>(new Set());
  const [assignee, setAssignee] = useState("");
  const [assignedEmails, setAssignedEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [strictAssigneeVisibility, setStrictAssigneeVisibility] = useState(false);
  const [importRoundRobin, setImportRoundRobin] = useState(false);
  const [extraColumnKeysText, setExtraColumnKeysText] = useState("");
  const [titleColumn, setTitleColumn] = useState<string>("");
  const [subtitleColumns, setSubtitleColumns] = useState<string[]>([]);
  const [wipInProgressLimit, setWipInProgressLimit] = useState<string>("");
  /** 2-adım sihirbazı: 1 = proje bilgileri, 2 = opsiyonel görev içe aktarma. Edit modunda kullanılmaz. */
  const [step, setStep] = useState<1 | 2>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!project;
  const title = isEdit ? "Projeyi düzenle" : step === 1 ? "Yeni proje · Bilgiler" : "Yeni proje · Görev içe aktarma (opsiyonel)";
  const isStep1Valid = name.trim().length > 0;

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description);
      setStatus(project.status);
      setDueDate(project.due_date?.slice(0, 10) ?? "");
      setPriority(project.priority ?? "");
      setImportFile(null);
      setImportPreview(null);
      setImportPreviewError(null);
      setImportPreviewLoading(false);
      setSelectedImportColumns(new Set());
      setAssignee("");
      setAssignedEmails(project.assigned_emails ?? []);
      setEmailInput("");
      setStrictAssigneeVisibility(project.strict_assignee_visibility ?? false);
      setImportRoundRobin(false);
      setExtraColumnKeysText((project.extra_column_keys ?? []).join("\n"));
      setTitleColumn(project.title_column ?? "");
      setSubtitleColumns(project.subtitle_columns ?? []);
      setWipInProgressLimit(
        project.wip_in_progress_limit != null && project.wip_in_progress_limit > 0
          ? String(project.wip_in_progress_limit)
          : ""
      );
      setStep(1);
    } else if (open && !project) {
      setName("");
      setDescription("");
      setStatus("Aktif");
      setDueDate("");
      setPriority("");
      setImportFile(null);
      setImportPreview(null);
      setImportPreviewError(null);
      setImportPreviewLoading(false);
      setSelectedImportColumns(new Set());
      setAssignee("");
      setAssignedEmails([]);
      setEmailInput("");
      setStrictAssigneeVisibility(false);
      setImportRoundRobin(false);
      setExtraColumnKeysText("");
      setTitleColumn("");
      setSubtitleColumns([]);
      setWipInProgressLimit("");
      setStep(1);
    }
  }, [open, project]);

  /**
   * Dosya seçilince anında parse et — önizleme + sütun seçici için.
   * CSV için string[][] doğrudan kullanılır; JSON için header sırasına göre değer dizilir.
   */
  useEffect(() => {
    let cancelled = false;
    if (!importFile) {
      setImportPreview(null);
      setImportPreviewError(null);
      setImportPreviewLoading(false);
      setSelectedImportColumns(new Set());
      return;
    }
    setImportPreviewLoading(true);
    setImportPreviewError(null);
    importFile
      .text()
      .then((text) => {
        if (cancelled) return;
        const fileName = (importFile.name || "").toLowerCase();
        const isJson = fileName.endsWith(".json");
        try {
          let headers: string[];
          let rows: string[][];
          if (isJson) {
            const parsed = parseJSON(text);
            headers = parsed.headers;
            rows = parsed.rows.map((rec) => headers.map((h) => String(rec[h] ?? "")));
          } else {
            const parsed = parseCSV(text);
            headers = parsed.headers;
            rows = parsed.rows.map((r) => r.map((v) => String(v ?? "")));
          }
          if (headers.length === 0) {
            setImportPreviewError("Dosyada sütun başlığı bulunamadı.");
            setImportPreview(null);
            return;
          }
          setImportPreview({ headers, rows: rows.slice(0, 8) });
          // Varsayılan: tüm sütunlar seçili
          setSelectedImportColumns(new Set(headers.map((h) => (h ?? "").trim() || h)));
        } catch (err) {
          setImportPreviewError(
            err instanceof Error ? err.message : "Dosya okunamadı veya geçersiz format."
          );
          setImportPreview(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setImportPreviewError(err instanceof Error ? err.message : "Dosya okunamadı.");
        setImportPreview(null);
      })
      .finally(() => {
        if (!cancelled) setImportPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [importFile]);

  const toggleImportColumn = (header: string) => {
    setSelectedImportColumns((prev) => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });
  };

  const setAllImportColumns = (selected: boolean) => {
    if (!importPreview) return;
    setSelectedImportColumns(
      selected ? new Set(importPreview.headers.map((h) => (h ?? "").trim() || h)) : new Set()
    );
  };

  const addAssignedEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (assignedEmails.includes(email)) return;
    setAssignedEmails((prev) => [...prev, email]);
    setEmailInput("");
  };

  const removeAssignedEmail = (email: string) => {
    setAssignedEmails((prev) => prev.filter((e) => e !== email));
  };

  /**
   * Step 1 → Step 2 geçişinde stray submit'i yakala:
   * Kullanıcı "İleri" tıkladığında setStep(2) çalışır, buton aynı slot'ta "Oluştur"
   * (type=submit) ile değişir, click event yeni butona iner ve form submit edilir.
   * Bu ref ile "İleri ile geçildi" sinyalini bir microtask için tutarız ve o aralıkta
   * gelen submit'leri reddederiz.
   */
  const justAdvancedRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (justAdvancedRef.current) {
      // İleri'den hemen sonra gelen stray submit — yut
      justAdvancedRef.current = false;
      return;
    }
    // 2-adım sihirbazı: input'tan Enter ile submit ederse proje hemen oluşturulup
    // pencere kapanmasın — sadece step 2'ye ilerle.
    if (!isEdit && step === 1) {
      if (isStep1Valid) setStep(2);
      return;
    }
    const extraColumnKeys = parseExtraColumnKeysFromForm(extraColumnKeysText);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        status,
        due_date: dueDate.trim() || undefined,
        priority: priority ? (priority as ProjectPriority) : undefined,
        importFile: isEdit ? undefined : importFile ?? undefined,
        assignee: isEdit ? undefined : (assignee.trim() || undefined),
        // Boş dizi de göndermeli ki "tüm atananları kaldır" işlemi kaydedilebilsin
        assignedEmails: assignedEmails,
        strictAssigneeVisibility: isAdmin ? strictAssigneeVisibility : undefined,
        importRoundRobin: !isEdit ? importRoundRobin : undefined,
        extraColumnKeys: extraColumnKeys.length > 0 ? extraColumnKeys : undefined,
        titleColumn: titleColumn.trim() || null,
        subtitleColumns: subtitleColumns.length > 0 ? subtitleColumns : null,
        wipInProgressLimit: (() => {
          const n = Number(wipInProgressLimit);
          return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        })(),
        selectedImportColumns:
          !isEdit && importFile && importPreview
            ? importPreview.headers.filter((h) =>
                selectedImportColumns.has((h ?? "").trim() || h)
              )
            : undefined,
      });
    } catch {
      // onSubmit içinde formError zaten set ediliyor; modal kapanmasın.
      return;
    }
    onOpenChange(false);
    setName("");
    setDescription("");
    setStatus("Aktif");
    setDueDate("");
    setPriority("");
    setImportFile(null);
    setAssignee("");
    setAssignedEmails([]);
    setEmailInput("");
    setStrictAssigneeVisibility(false);
    setImportRoundRobin(false);
    setExtraColumnKeysText("");
    setSubtitleColumns([]);
  };

  // ───────────────────────────────────────────────────────────────
  // Field grupları — edit modunda Tabs içine, yeni projede dikey stack'e konur
  // ───────────────────────────────────────────────────────────────
  const fieldsGeneral = (
    <div className="grid gap-4">
      <div>
        <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Ad
        </label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Proje adı"
          required
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
      </div>
      <div>
        <label htmlFor="project-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Açıklama
        </label>
        <textarea
          id="project-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kısa açıklama"
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 resize-none"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="project-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Durum
          </label>
          <select
            id="project-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="project-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            <Flag className="inline h-3.5 w-3.5 mr-1" />
            Öncelik
          </label>
          <select
            id="project-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as ProjectPriority | "")}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">Seçin</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="project-due-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          <Calendar className="inline h-3.5 w-3.5 mr-1" />
          Hedef tarih
        </label>
        <input
          id="project-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Proje hedef / bitiş tarihi. Kartlarda &quot;Yaklaşan&quot; / &quot;Gecikmiş&quot; etiketi için kullanılır.
        </p>
      </div>
    </div>
  );

  const fieldsTableView = (() => {
    const schemaKeys = parseExtraColumnKeysFromForm(extraColumnKeysText);
    const merged = new Set<string>();
    for (const k of schemaKeys) if (k.trim()) merged.add(k.trim());
    for (const k of observedExtraKeys ?? []) if (k && k.trim()) merged.add(k.trim());
    const availableKeys = Array.from(merged).sort((a, b) =>
      a.localeCompare(b, "tr", { sensitivity: "base" })
    );
    return (
      <div className="grid gap-4">
        <div>
          <label htmlFor="project-extra-columns" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Canlı tablo ek sütunları
          </label>
          <textarea
            id="project-extra-columns"
            value={extraColumnKeysText}
            onChange={(e) => setExtraColumnKeysText(e.target.value)}
            placeholder={"Her satıra bir sütun adı\nÖrn: Sicil\nÖrn: Departman"}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 resize-y font-mono"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            CSV olmadan görünmesini istediğin <code className="text-[0.7rem]">extra_data</code> sütunları.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="project-title-column"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Görev başlığı sütunu
            </label>
            <select
              id="project-title-column"
              value={titleColumn}
              onChange={(e) => setTitleColumn(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">— Otomatik —</option>
              {availableKeys.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
              {titleColumn && !availableKeys.includes(titleColumn) && (
                <option value={titleColumn}>{titleColumn} (eski)</option>
              )}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              <code className="text-[0.7rem]">content</code> boşsa Kanban/Özet kartlarında bu değer başlık olur.
            </p>
            <SubtitleColumnsPicker
              availableKeys={availableKeys}
              titleColumn={titleColumn}
              value={subtitleColumns}
              onChange={setSubtitleColumns}
            />
          </div>
          <div>
            <label
              htmlFor="project-wip-limit"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Kanban WIP limiti
            </label>
            <input
              id="project-wip-limit"
              type="number"
              min={1}
              max={999}
              value={wipInProgressLimit}
              onChange={(e) => setWipInProgressLimit(e.target.value)}
              placeholder="örn. 5"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              &quot;Devam ediyor&quot; kolonu için soft limit. Boş = limitsiz.
            </p>
          </div>
        </div>
        {availableKeys.length === 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Henüz tanımlı sütun yok — yukarıya ekle ya da bu projeye CSV/Excel ile görev içe aktar.
          </p>
        )}
      </div>
    );
  })();

  const fieldsAssignees = (
    <div className="grid gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          <UserPlus className="inline h-3.5 w-3.5 mr-1" />
          Atanan kullanıcılar (e-posta)
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Bu kişiler projeyi açıp canlı tablo verisini görüp düzenleyebilir.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAssignedEmail(); } }}
            placeholder="ornek@email.com"
            className="flex-1 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAssignedEmail}
            disabled={!emailInput.trim()}
          >
            Ekle
          </Button>
        </div>
        {assignedEmails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {assignedEmails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs text-slate-700 dark:text-slate-200"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeAssignedEmail(email)}
                  className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
                  aria-label={`${email} kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              checked={strictAssigneeVisibility}
              onChange={(e) => setStrictAssigneeVisibility(e.target.checked)}
            />
            <span className="text-sm text-slate-800 dark:text-slate-200">
              <span className="font-medium">Katı atanan görünürlüğü</span>
              <span className="mt-1 block text-xs font-normal text-slate-600 dark:text-slate-400">
                Üye/izleyici roller yalnızca kendilerine atanmış ve atanmamış görevleri görür.
                Admin ve PM her şeyi görür. (RLS bağımlı — SQL betiği çalışmış olmalı.)
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );

  const fieldsAdvanced = isEdit && project ? (
    <div className="grid gap-4">
      <div>
        <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100">Sütun tipi yönetimi</h4>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Her sütuna tip ata: metin, sayı, tarih, seçenek, vb. Tipli render &amp; filtre için kullanılır.
        </p>
      </div>
      <ProjectColumnManager
        projectId={project.id}
        observedKeys={observedExtraKeys ?? []}
        sampleValuesByKey={observedSampleValues ?? {}}
      />
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={true}
        className={cn(
          isEdit ? "max-w-2xl" : "max-w-lg",
          "max-h-[min(90vh,720px)] overflow-hidden flex flex-col"
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? "Proje bilgilerini düzenleyin."
              : step === 1
                ? "Yeni proje için ad, açıklama, durum ve atanan kişileri belirleyin."
                : "Opsiyonel olarak CSV veya JSON dosyasından görev içe aktarın."}
          </DialogDescription>
        </DialogHeader>
        {/* Stepper indicator — yalnızca yeni proje oluşturma akışında */}
        {!isEdit && (
          <div className="flex items-center gap-3 px-1 pt-1" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={2}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                step >= 1 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              )}>1</span>
              <span className={cn("text-sm font-medium", step === 1 ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")}>Bilgiler</span>
            </div>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden />
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                step >= 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
              )}>2</span>
              <span className={cn("text-sm font-medium", step === 2 ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400")}>Görev içe aktar <span className="text-xs font-normal text-slate-500">(opsiyonel)</span></span>
            </div>
          </div>
        )}
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3 py-2">
          {isEdit ? (
            <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="self-start">
                <TabsTrigger value="general">Genel</TabsTrigger>
                <TabsTrigger value="table">Tablo &amp; Görünüm</TabsTrigger>
                <TabsTrigger value="people">Atananlar</TabsTrigger>
                {fieldsAdvanced && <TabsTrigger value="advanced">Gelişmiş</TabsTrigger>}
              </TabsList>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                <TabsContent value="general" className="m-0 data-[state=inactive]:hidden">
                  {fieldsGeneral}
                </TabsContent>
                <TabsContent value="table" className="m-0 data-[state=inactive]:hidden">
                  {fieldsTableView}
                </TabsContent>
                <TabsContent value="people" className="m-0 data-[state=inactive]:hidden">
                  {fieldsAssignees}
                </TabsContent>
                {fieldsAdvanced && (
                  <TabsContent value="advanced" className="m-0 data-[state=inactive]:hidden">
                    {fieldsAdvanced}
                  </TabsContent>
                )}
              </div>
            </Tabs>
          ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {/* Step 1 — Proje bilgileri (yeni proje akışı) */}
          {step === 1 && (
          <>
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Ad
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Proje adı"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="project-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Açıklama
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kısa açıklama"
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 resize-none"
            />
          </div>
          <div>
            <label htmlFor="project-status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Durum
            </label>
            <select
              id="project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="project-due-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Calendar className="inline h-3.5 w-3.5 mr-1" />
              Hedef tarih
            </label>
            <input
              id="project-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Proje hedef / bitiş tarihi. Kartlarda &quot;Yaklaşan&quot; / &quot;Gecikmiş&quot; etiketi için kullanılır.
            </p>
          </div>
          <div>
            <label htmlFor="project-priority" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <Flag className="inline h-3.5 w-3.5 mr-1" />
              Öncelik
            </label>
            <select
              id="project-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriority | "")}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">Seçin</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="project-extra-columns" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Canlı tablo ek sütunları (opsiyonel)
            </label>
            <textarea
              id="project-extra-columns"
              value={extraColumnKeysText}
              onChange={(e) => setExtraColumnKeysText(e.target.value)}
              placeholder={"Her satıra bir sütun adı\nÖrn: Sicil\nÖrn: Departman"}
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 resize-y font-mono"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              CSV olmadan bu projeyle görünen görevlerde <code className="text-[0.7rem]">extra_data</code> sütunlarını önceden listelemek için. Supabase&apos;de{" "}
              <code className="text-[0.7rem]">extra_column_keys</code> sütunu gerekir.
            </p>
          </div>

          {/* Başlık sütunu — Kanban kartı, Görev Özeti vb. için */}
          {(() => {
            // Adaylar: (1) form'daki şema, (2) mevcut görevlerden gözlemlenen extra_data
            // anahtarları. İkisi birleştirilir, tekrarlar elenir, alfabetik sıralanır.
            const schemaKeys = parseExtraColumnKeysFromForm(extraColumnKeysText);
            const merged = new Set<string>();
            for (const k of schemaKeys) if (k.trim()) merged.add(k.trim());
            for (const k of observedExtraKeys ?? []) if (k && k.trim()) merged.add(k.trim());
            const availableKeys = Array.from(merged).sort((a, b) =>
              a.localeCompare(b, "tr", { sensitivity: "base" })
            );
            return (
              <div>
                <label
                  htmlFor="project-title-column"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Görev başlığı sütunu (opsiyonel)
                </label>
                <select
                  id="project-title-column"
                  value={titleColumn}
                  onChange={(e) => setTitleColumn(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">— Otomatik (Başlık / Görev / Ad…) —</option>
                  {availableKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                  {/* Mevcut seçim listede yoksa yine göster (eski/silinmiş sütun olabilir) */}
                  {titleColumn && !availableKeys.includes(titleColumn) && (
                    <option value={titleColumn}>{titleColumn} (eski seçim)</option>
                  )}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Görevin <strong>content</strong> alanı boşsa Kanban kartı, Görev Özeti ve
                  mobil kart için <strong>bu sütundaki değer</strong> başlık olarak kullanılır.
                  {availableKeys.length === 0 ? (
                    <span className="mt-1 block italic text-amber-700 dark:text-amber-400">
                      Henüz sütun yok — &quot;Canlı tablo ek sütunları&quot; alanına ekle veya
                      bu projeye CSV/Excel'den görev içe aktar; ondan sonra burada listelenir.
                    </span>
                  ) : (
                    <> Boş bırakırsan otomatik fallback uygulanır.</>
                  )}
                </p>
                <SubtitleColumnsPicker
                  availableKeys={availableKeys}
                  titleColumn={titleColumn}
                  value={subtitleColumns}
                  onChange={setSubtitleColumns}
                />
              </div>
            );
          })()}

          {/* Kanban WIP limiti — yumuşak uyarı */}
          <div>
            <label
              htmlFor="project-wip-limit"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Kanban WIP limiti — &quot;Devam ediyor&quot; (opsiyonel)
            </label>
            <input
              id="project-wip-limit"
              type="number"
              min={1}
              max={999}
              value={wipInProgressLimit}
              onChange={(e) => setWipInProgressLimit(e.target.value)}
              placeholder="örn. 5"
              className="w-full max-w-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Kanban &quot;Devam ediyor&quot; kolonunda aynı anda kaç görev olabilir?
              Limit aşılırsa kolon başlığı amber/kırmızı yanar — sürükleyi engellemez,
              sadece ekip tıkanma sinyali alır. Boş bırakırsan limit yok.
            </p>
          </div>

          {/* Sütun tipi yönetimi edit modunda Tabs > Gelişmiş'te gösteriliyor */}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <UserPlus className="inline h-3.5 w-3.5 mr-1" />
              Atanan kullanıcılar (e-posta)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Bu kişiler oturum açtığında proje kartını açıp canlı tablo verisini görüntüleyip çalışabilir. E-posta yazıp Ekle ile ekleyin.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAssignedEmail(); } }}
                placeholder="ornek@email.com"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 w-48"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAssignedEmail}
                disabled={!emailInput.trim()}
              >
                Ekle
              </Button>
            </div>
            {assignedEmails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {assignedEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs text-slate-700 dark:text-slate-200"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeAssignedEmail(email)}
                      className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
                      aria-label={`${email} kaldır`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  checked={strictAssigneeVisibility}
                  onChange={(e) => setStrictAssigneeVisibility(e.target.checked)}
                />
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-medium">Katı atanan görünürlüğü</span>
                  <span className="mt-1 block text-xs font-normal text-slate-600 dark:text-slate-400">
                    Açıkken üye ve izleyici rolleri bu projede yalnızca kendilerine atanmış ve atanmamış görevleri görür;
                    yönetici ve proje yöneticisi tüm görevleri görür. Veritabanı RLS ile uygulanır (SQL betiğini çalıştırmış olmalısınız).
                  </span>
                </span>
              </label>
            </div>
          )}

          </>
          )}
          {/* /Step 1 */}

          {/* Step 2 — Opsiyonel görev içe aktarma (yalnızca yeni proje akışı) */}
          {!isEdit && step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Bu adım <strong>opsiyonel</strong>. Hemen "Oluştur"a basabilir veya bir dosyadan toplu görev ekleyebilirsiniz.
              </p>

              <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 p-3 space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  CSV / JSON ile görev aktar
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Proje oluşturulduktan sonra dosyadaki her satır canlı tabloda bir görev olarak eklenir. Sütun başlıkları korunur.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  aria-hidden
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importFile ? importFile.name : "CSV veya JSON dosyası seç"}
                </Button>
                {importFile && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{importFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setImportFile(null)}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      aria-label="Dosyayı kaldır"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Önizleme ve sütun seçici */}
                {importPreviewLoading && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                    Dosya okunuyor…
                  </div>
                )}
                {importPreviewError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                    {importPreviewError}
                  </div>
                )}
                {importPreview && importPreview.headers.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/60">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Sütun seçimi
                        <span className="ml-2 text-slate-500 dark:text-slate-400">
                          ({selectedImportColumns.size} / {importPreview.headers.length} seçili
                          {importPreview.rows.length > 0 && ` · ${importPreview.rows.length}+ satır`})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAllImportColumns(true)}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        >
                          Tümü
                        </button>
                        <span className="text-[11px] text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => setAllImportColumns(false)}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                          Hiçbiri
                        </button>
                      </div>
                    </div>
                    {/* Chip toggleları */}
                    <div className="flex flex-wrap gap-1.5 px-3 py-2">
                      {importPreview.headers.map((h, idx) => {
                        const label = (h ?? "").trim() || `Sütun ${idx + 1}`;
                        const key = (h ?? "").trim() || h;
                        const selected = selectedImportColumns.has(key);
                        return (
                          <button
                            key={`${idx}-${label}`}
                            type="button"
                            onClick={() => toggleImportColumn(key)}
                            aria-pressed={selected}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                              selected
                                ? "border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                                : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                            )}
                          >
                            {selected ? (
                              <Check className="h-3 w-3 shrink-0" aria-hidden />
                            ) : (
                              <X className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                            )}
                            <span className="truncate max-w-[140px]">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Önizleme tablosu */}
                    {importPreview.rows.length > 0 && (
                      <div className="border-t border-slate-200 dark:border-slate-700">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/80">
                              <tr>
                                {importPreview.headers.map((h, idx) => {
                                  const label = (h ?? "").trim() || `Sütun ${idx + 1}`;
                                  const key = (h ?? "").trim() || h;
                                  const selected = selectedImportColumns.has(key);
                                  return (
                                    <th
                                      key={`th-${idx}`}
                                      className={cn(
                                        "border-b border-slate-200 px-2 py-1.5 text-left font-medium dark:border-slate-700",
                                        selected
                                          ? "text-slate-700 dark:text-slate-300"
                                          : "text-slate-400 line-through dark:text-slate-500"
                                      )}
                                      title={selected ? "Bu sütun içe aktarılacak" : "Bu sütun atlanacak"}
                                    >
                                      <span className="block max-w-[140px] truncate">{label}</span>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {importPreview.rows.map((row, ri) => (
                                <tr
                                  key={`tr-${ri}`}
                                  className="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                                >
                                  {importPreview.headers.map((h, ci) => {
                                    const key = (h ?? "").trim() || h;
                                    const selected = selectedImportColumns.has(key);
                                    const cell = row[ci] ?? "";
                                    return (
                                      <td
                                        key={`td-${ri}-${ci}`}
                                        className={cn(
                                          "border-r border-slate-100 px-2 py-1 align-top dark:border-slate-700/60",
                                          selected
                                            ? "text-slate-700 dark:text-slate-200"
                                            : "text-slate-300 line-through dark:text-slate-600"
                                        )}
                                      >
                                        <span className="block max-w-[160px] truncate">
                                          {String(cell).trim() === "" ? "—" : cell}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-800/40">
                          <span className="text-slate-500 dark:text-slate-400">
                            İlk {importPreview.rows.length} satır gösteriliyor. Soluk + üstü çizili sütunlar içe aktarılmaz.
                          </span>
                          {selectedImportColumns.size === 0 && (
                            <span className="font-medium text-amber-700 dark:text-amber-400">
                              ⚠ Hiçbir sütun seçili değil — görev içe aktarılmayacak.
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {importFile && assignedEmails.length >= 2 && (
                  <label className="flex cursor-pointer items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={importRoundRobin}
                      onChange={(e) => setImportRoundRobin(e.target.checked)}
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      <strong>Eşit dağıt (round-robin):</strong> Her satır, atanan e-posta listesine sırayla paylaştırılır.
                      İşaretliyken CSV&apos;deki &quot;Atanan&quot; sütunu yok sayılır.
                    </span>
                  </label>
                )}
              </div>

              {importFile && (
                <div>
                  <label htmlFor="project-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Varsayılan atanan
                  </label>
                  <input
                    id="project-assignee"
                    type="text"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Dosyadan eklenen görevlere atanacak kişi"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Dosyada &quot;Atanan&quot; / &quot;assignee&quot; sütunu varsa satır bazında kullanılır. Yoksa burada yazan değer tüm satırlara uygulanır.
                    Round-robin işaretliyse bu alan ve dosyadaki sütun yok sayılır.
                  </p>
                </div>
              )}
            </div>
          )}
          {/* /Step 2 */}
          </div>
          )}

          <DialogFooter className="mt-2 shrink-0 border-t border-slate-200 pt-3 dark:border-slate-700">
            {/* Sol: İptal veya Geri */}
            {!isEdit && step === 2 ? (
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                ← Geri
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
            )}
            {/* Sağ: İleri / Oluştur / Kaydet */}
            {!isEdit && step === 1 ? (
              <Button
                type="button"
                disabled={!isStep1Valid}
                onClick={() => {
                  // Step değişimi sırasında DialogFooter slot'undaki buton "Oluştur"
                  // (type=submit) ile değişiyor ve aynı click event'i yeni butona inip
                  // form submit'i tetikliyor. Bu ref bir sonraki submit'i yutar.
                  justAdvancedRef.current = true;
                  setStep(2);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                İleri →
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || (!isEdit && !isStep1Valid)} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isEdit ? "Kaydet" : importFile ? "Oluştur ve içe aktar" : "Oluştur"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type ProjectsSectionVariant = "default" | "page";

export function ProjectsSection({ variant = "default" }: { variant?: ProjectsSectionVariant }) {
  const { settings } = useSettings();
  const { user, hasPermission, isAdmin } = useAuth();
  const canCreateProject = hasPermission("projects.create");
  const currentUserEmail = (user?.email ?? "").toLowerCase();
  const isPageVariant = variant === "page";
  const canEditProject = hasPermission("projects.edit");
  const canDeleteProject = hasPermission("projects.delete");
  const canArchiveProject = hasPermission("projects.archive");
  const {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
  } = useProjects();
  const { createTasksBulk, tasks } = useTasksWithRealtime();
  const taskCountByProject = useTaskCountByProject();
  const { unreadByProjectId } = useProjectChatUnread();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Tümü");
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Komut paletinden "Yeni proje" tetiklendiğinde formu aç */
  useEffect(() => {
    const openNew = () => {
      if (canCreateProject) {
        setEditingProject(null);
        setFormOpen(true);
      }
    };
    window.addEventListener("commandpalette:newProject", openNew);
    return () => window.removeEventListener("commandpalette:newProject", openNew);
  }, [canCreateProject]);

  const filteredProjects = useMemo(() => {
    // `projects` Supabase RLS tarafından sunucuda filtrelenmiş geliyor.
    let result = projects;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "Tümü") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (assignedToMeOnly && currentUserEmail) {
      result = result.filter((p) =>
        (p.assigned_emails ?? []).some((e) => e.toLowerCase() === currentUserEmail)
      );
    }
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom).getTime() : 0;
      const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Number.MAX_SAFE_INTEGER;
      result = result.filter((p) => {
        const ts = p.updated_at ? new Date(p.updated_at).getTime() : (p.created_at ? new Date(p.created_at).getTime() : 0);
        return ts >= from && ts <= to;
      });
    }
    return result;
  }, [projects, search, statusFilter, assignedToMeOnly, currentUserEmail, dateFrom, dateTo]);

  const handleFormSubmit = async (data: NewProjectSubmitData) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: data.name,
          description: data.description,
          status: data.status,
          assigned_emails: data.assignedEmails ?? [],
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          extra_column_keys:
            data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : [],
          title_column: data.titleColumn ?? null,
          subtitle_columns: data.subtitleColumns ?? null,
          wip_in_progress_limit: data.wipInProgressLimit ?? null,
          ...(isAdmin
            ? { strict_assignee_visibility: data.strictAssigneeVisibility ?? false }
            : {}),
        });
        setFormOpen(false);
        setEditingProject(null);
        setFormError(null);
        return;
      }
      const projectId = await createProject({
        name: data.name,
        description: data.description,
        status: data.status,
        assigned_emails: data.assignedEmails?.length ? data.assignedEmails : undefined,
        due_date: data.due_date ?? undefined,
        priority: data.priority ?? undefined,
        strict_assignee_visibility: isAdmin ? (data.strictAssigneeVisibility ?? false) : false,
        extra_column_keys:
          data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : undefined,
        title_column: data.titleColumn ?? null,
        subtitle_columns: data.subtitleColumns ?? null,
        wip_in_progress_limit: data.wipInProgressLimit ?? null,
      });
      if (data.importFile && projectId) {
        const text = await data.importFile.text();
        const fileName = (data.importFile.name || "").toLowerCase();
        const isJson = fileName.endsWith(".json");
        const recipients = (data.assignedEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
        const roundRobin = !!(data.importRoundRobin && recipients.length >= 2);
        const defaultRaw = (data.assignee ?? "").trim();
        const defaultAssignee =
          normalizeTaskAssigneeEmail(defaultRaw) ?? (defaultRaw || null);
        const projectPriority = normalizeProjectPriority(data.priority);
        /**
         * Kullanıcı önizleme üzerinden bazı sütunları kapatmış olabilir.
         * Whitelist (trimlenmiş başlık adı). Undefined → tüm sütunlar dahil (geriye uyumluluk).
         */
        const columnWhitelist = data.selectedImportColumns
          ? new Set(data.selectedImportColumns.map((s) => (s ?? "").trim()))
          : null;
        const isColumnIncluded = (rawKey: string) =>
          columnWhitelist == null || columnWhitelist.has(rawKey.trim());
        type TaskInsert = { content: string; status: string; assignee: string | null; project_id: string; extra_data: Record<string, string> | null; priority?: string | null };
        const tasksToInsert: TaskInsert[] = [];
        let distributeIndex = 0;
        if (isJson) {
          const { headers, rows } = parseJSON(text);
          const assigneeKey = roundRobin ? null : findAssigneeJsonKey(headers);
          if (headers.length > 0 && rows.length > 0) {
            for (const row of rows) {
              const extra_data: Record<string, string> = {};
              headers.forEach((h) => {
                const key = (h ?? "").trim() || "Sütun";
                if (!isColumnIncluded(key)) return;
                extra_data[key] = row[key] ?? "";
              });
              const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
              if (hasAnyData) {
                const fromCol =
                  assigneeKey != null ? normalizeTaskAssigneeEmail(row[assigneeKey]) : null;
                const assignee = roundRobin
                  ? pickRoundRobinAssignee(recipients, distributeIndex)
                  : (fromCol ?? defaultAssignee);
                distributeIndex += 1;
                tasksToInsert.push({
                  content: "",
                  status: "Yapılacak",
                  assignee,
                  project_id: projectId,
                  extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                  priority: projectPriority ?? undefined,
                });
              }
            }
          }
        } else {
          const { headers, rows } = parseCSV(text);
          const assigneeCol = roundRobin ? null : findAssigneeColumnIndex(headers);
          if (headers.length > 0 && rows.length > 0) {
            for (const row of rows) {
              const extra_data: Record<string, string> = {};
              headers.forEach((h, i) => {
                const key = (h ?? "").trim() || `Sütun ${i + 1}`;
                if (!isColumnIncluded(key)) return;
                extra_data[key] = (row[i] != null ? String(row[i]).trim() : "") ?? "";
              });
              const hasAnyData = Object.values(extra_data).some((v) => String(v ?? "").trim() !== "");
              if (hasAnyData) {
                const fromCol =
                  assigneeCol != null ? normalizeTaskAssigneeEmail(row[assigneeCol]) : null;
                const assignee = roundRobin
                  ? pickRoundRobinAssignee(recipients, distributeIndex)
                  : (fromCol ?? defaultAssignee);
                distributeIndex += 1;
                tasksToInsert.push({
                  content: "",
                  status: "Yapılacak",
                  assignee,
                  project_id: projectId,
                  extra_data: Object.keys(extra_data).length > 0 ? extra_data : null,
                  priority: projectPriority ?? undefined,
                });
              }
            }
          }
        }
        if (tasksToInsert.length > 0) {
          await createTasksBulk(tasksToInsert);
        }
      }
      setFormOpen(false);
      setEditingProject(null);
      setFormError(null);
    } catch (e) {
      console.error("[Projects] Form submit failed:", e);
      // Supabase hatası genelde { code, message, details, hint } yapısındadır.
      const supaErr = e as { code?: string; message?: string; details?: string; hint?: string };
      const parts = [supaErr?.message, supaErr?.details, supaErr?.hint, supaErr?.code]
        .filter((x) => x != null && String(x).trim() !== "");
      const message = parts.length > 0
        ? parts.join(" — ")
        : e instanceof Error
          ? e.message
          : String(e);
      setFormError(message || "Proje oluşturulurken veya güncellenirken bir hata oluştu.");
      // Form'un yakalayıp modal'ı açık tutması için re-throw et
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (e) {
      console.error("[Projects] Delete failed:", e);
    }
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Projeler yükleniyor">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton variant="circle" className="h-6 w-6" />
            </div>
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
            <div className="mt-4 flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50 p-6 text-center">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          Supabase&apos;de <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">projects</code> tablosunu oluşturun. <code className="text-xs">scripts/create-projects-table.sql</code> dosyasını kullanabilirsiniz.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={fetchProjects} className="mt-4">
          <RotateCw className="mr-2 h-4 w-4" />
          Yeniden dene
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm",
      isPageVariant && "border-slate-200/80 dark:border-slate-600/80"
    )}>
      {!isPageVariant && (
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">Projeler</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Proje listesi. Yeni proje ekleyin, arama ve filtre ile listeleyin.
          </p>
        </div>
      )}
      <div className={cn(isPageVariant ? "pt-4 px-4 pb-4" : "p-4", "space-y-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              placeholder="Projede ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <option value="Tümü">Durum: Tümü</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {currentUserEmail && (
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={assignedToMeOnly}
                onChange={(e) => setAssignedToMeOnly(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <UserPlus className="h-4 w-4 text-slate-500" />
              Bana atananlar
            </label>
          )}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Başlangıç"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Bitiş"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          />
          <RestrictedButton
            permission="projects.create"
            type="button"
            size="sm"
            onClick={() => { setEditingProject(null); setFormOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Yeni proje
          </RestrictedButton>
        </div>

        {filteredProjects.length === 0 ? (
          projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-10 w-10" />}
              title="Henüz proje yok"
              description={
                canCreateProject
                  ? "İlk projenizi oluşturarak başlayın. Aynı modal'dan CSV/JSON ile toplu görev de aktarabilirsiniz."
                  : "Bir yöneticinizden size proje atanmasını isteyebilirsiniz."
              }
              action={
                canCreateProject ? (
                  <Button type="button" size="sm" onClick={() => setFormOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Yeni proje
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              variant="compact"
              icon={<Search className="h-8 w-8" />}
              title="Eşleşen proje yok"
              description="Arama veya filtre kriterlerinize uyan proje bulunamadı."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("Tümü");
                    setAssignedToMeOnly(false);
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Filtreleri temizle
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const taskStats = taskCountByProject[project.id] ?? { total: 0, done: 0 };
              const taskCount = taskStats.total;
              const taskDone = taskStats.done;
              const taskProgressPct = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
              const chatUnread = unreadByProjectId[project.id] ?? 0;
              return (
                <article
                  key={project.id}
                  className={cn(
                    "group relative flex flex-col rounded-lg border p-4 transition-all",
                    isPageVariant
                      ? "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-blue-600"
                      : "border-slate-200 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-blue-600",
                    project.status === "Beklemede" && "opacity-80"
                  )}
                >
                  {/* Stretched link: tüm kart tıklanabilir; içeride z-10'lu elementler kendi davranışlarını korur. */}
                  <Link
                    href={`/projeler/${project.id}`}
                    aria-label={`${project.name || "İsimsiz proje"} projesine git`}
                    className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  />
                  <div className="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex min-w-0 items-center gap-1.5",
                          isPageVariant
                            ? "font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                            : "font-medium text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                        )}
                      >
                        <span className="truncate">{project.name || "İsimsiz proje"}</span>
                        {chatUnread > 0 && (
                          <span
                            className="inline-flex h-5 shrink-0 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white"
                            title="Okunmamış sohbet"
                          >
                            {chatUnread > 99 ? "99+" : chatUnread}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{project.description || "—"}</p>
                    </div>
                    <div className="pointer-events-auto flex shrink-0 items-center gap-0.5">
                      {/* Hover/odak ile beliren hızlı eylemler — Düzenle + Detay */}
                      {canEditProject && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEdit(project);
                          }}
                          aria-label="Projeyi düzenle"
                          title="Düzenle"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
                        aria-label="Proje detayı"
                        title="Detay"
                      >
                        <Link
                          href={`/projeler/${project.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FolderKanban className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Proje menüsü">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEditProject && (
                          <DropdownMenuItem onClick={() => openEdit(project)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Düzenle
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/projeler/${project.id}`}>
                            Proje detayı / görevler
                          </Link>
                        </DropdownMenuItem>
                        {canArchiveProject && (
                          <DropdownMenuItem onClick={() => archiveProject(project.id)} disabled={project.status === "Beklemede"}>
                            <Archive className="mr-2 h-3.5 w-3.5" />
                            Arşivle
                          </DropdownMenuItem>
                        )}
                        {(canEditProject || canArchiveProject) && canDeleteProject && <DropdownMenuSeparator />}
                        {canDeleteProject && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteConfirm(project)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Sil
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                  <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 pointer-events-none">
                    <Badge variant="outline" className={cn("text-xs font-normal", STATUS_STYLES[project.status])}>
                      {project.status}
                    </Badge>
                    {project.priority && (
                      <Badge variant="outline" className={cn("text-xs font-normal", PRIORITY_STYLES[project.priority])}>
                        {project.priority}
                      </Badge>
                    )}
                    {project.due_date && (
                      <span className="text-xs text-slate-600 dark:text-slate-400" title="Hedef tarih">
                        Hedef: {formatDate(new Date(project.due_date), settings.dateFormat)}
                      </span>
                    )}
                    {getProjectDueLabel(project) === "Gecikmiş" && (
                      <Badge variant="outline" className="text-xs font-normal bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700">
                        Gecikmiş
                      </Badge>
                    )}
                    {getProjectDueLabel(project) === "Yaklaşan" && (
                      <Badge variant="outline" className="text-xs font-normal bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                        Yaklaşan
                      </Badge>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                        isPageVariant
                          ? "border-slate-300 bg-white text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200"
                          : "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      )}
                      title={taskCount > 0 ? `${taskDone} / ${taskCount} görev tamamlandı (${taskProgressPct}%)` : "Görev yok"}
                    >
                      {taskCount === 0
                        ? "0 görev"
                        : <>{taskDone}<span className="opacity-60">/{taskCount}</span> görev</>}
                    </span>
                    {(project.assigned_emails?.length ?? 0) > 0 && (
                      <AvatarStack
                        emails={project.assigned_emails ?? []}
                        highlightEmail={currentUserEmail}
                        max={4}
                        size={24}
                        className="pointer-events-auto"
                      />
                    )}
                    {(project.updated_at || project.created_at) && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDate(new Date(project.updated_at || project.created_at!), settings.dateFormat)}
                      </span>
                    )}
                  </div>
                  {/* Tamamlanma progress bar — sıfır görev yoksa görünür */}
                  {taskCount > 0 && (
                    <div className="relative z-10 mt-3 pointer-events-none">
                      <div className="flex items-center justify-between text-ui-caption text-slate-500 dark:text-slate-400">
                        <span>İlerleme</span>
                        <span className={cn(
                          "font-medium",
                          taskProgressPct === 100 && "text-emerald-700 dark:text-emerald-300",
                          taskProgressPct > 0 && taskProgressPct < 100 && "text-amber-700 dark:text-amber-300",
                          taskProgressPct === 0 && "text-slate-500 dark:text-slate-400"
                        )}>
                          %{taskProgressPct}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            taskProgressPct === 100
                              ? "bg-emerald-500 dark:bg-emerald-400"
                              : taskProgressPct >= 50
                                ? "bg-blue-500 dark:bg-blue-400"
                                : taskProgressPct > 0
                                  ? "bg-amber-500 dark:bg-amber-400"
                                  : "bg-slate-300 dark:bg-slate-600"
                          )}
                          style={{ width: `${Math.max(2, taskProgressPct)}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ProjectFormModal
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (open) setFormError(null); else setEditingProject(null); }}
        project={editingProject}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
        formError={formError}
        isAdmin={isAdmin}
        observedExtraKeys={
          editingProject
            ? (() => {
                const out = new Set<string>();
                for (const t of tasks) {
                  if (String(t.project_id ?? "") !== editingProject.id) continue;
                  if (t.extra_data && typeof t.extra_data === "object") {
                    for (const k of Object.keys(t.extra_data)) {
                      const key = String(k).trim();
                      if (key) out.add(key);
                    }
                  }
                }
                return Array.from(out);
              })()
            : []
        }
        observedSampleValues={
          editingProject
            ? (() => {
                const out: Record<string, string[]> = {};
                for (const t of tasks) {
                  if (String(t.project_id ?? "") !== editingProject.id) continue;
                  if (!t.extra_data || typeof t.extra_data !== "object") continue;
                  for (const [k, v] of Object.entries(t.extra_data)) {
                    const key = String(k).trim();
                    const value = String(v ?? "").trim();
                    if (!key || !value) continue;
                    if (!out[key]) out[key] = [];
                    if (out[key].length < 20) out[key].push(value);
                  }
                }
                return out;
              })()
            : {}
        }
      />
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle className="text-red-700 dark:text-red-300">Projeyi sil</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              &quot;{deleteConfirm?.name}&quot; projesi kalıcı olarak silinecek. Bu projeye bağlı tüm görevler canlı tablodan da silinecektir. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
