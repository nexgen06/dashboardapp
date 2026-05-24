"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { useTaskCountByProject } from "@/hooks/useTaskCountByProject";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useConfirm, usePrompt } from "@/components/ui/modals";
import { useToast } from "@/components/ui/toast";
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
import {
  assigneeForRowRange,
  collectColumnValues,
  parseRowRangeAssignments,
  type ImportAssignmentMode,
} from "@/lib/importAssignment";
import { offsetToDateIso, type ProjectTemplate } from "@/lib/projectTemplates";
import { listDirectoryUsers, type DirectoryUserProfile } from "@/lib/listDirectoryUsers";
import {
  defaultProjectMemberPermission,
  listProjectMemberPermissions,
  upsertProjectMemberPermissions,
  type ProjectMemberPermission,
  type ProjectMemberRole,
} from "@/lib/projectMemberPermissions";
import { SaveTemplateDialog, TemplateListDialog } from "@/components/ProjectTemplateDialogs";
import { isSensitiveExtraColumnKey } from "@/lib/extraColumnSensitiveDisplay";
import { isStatusDone } from "@/lib/statusKind";
import { normalizeWorkflowStatus } from "@/lib/taskWorkflow";
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
import { Search, PlusCircle, MoreVertical, Pencil, Archive, Trash2, RotateCw, Upload, FileText, UserPlus, X, Calendar, Flag, FolderKanban, Check, Bookmark, ShieldCheck, Loader2, Crown } from "lucide-react";
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
  /** Proje ekibi bu projedeki tüm görev satırlarını düzenleyebilir. */
  teamEditAllTasks?: boolean;
  /** Canlı tabloda bu proje için önceden gösterilecek ek sütun adları (`extra_data` anahtarları). */
  extraColumnKeys?: string[];
  /** Görev başlığı (Kanban/Özet) için kullanılacak extra_data anahtarı. Boş → otomatik. */
  titleColumn?: string | null;
  /** Görev kartı altında gösterilecek alt başlık anahtarları (en fazla 3). */
  subtitleColumns?: string[] | null;
  /** Kanban "Devam ediyor" kolonu için yumuşak WIP limiti. null/0 → limit yok. */
  wipInProgressLimit?: number | null;
  /** Görev satırları için onay workflow sistemi. */
  workflowEnabled?: boolean;
  /** Yeni proje + dosya: atanan e-posta listesine round-robin (en az 2 e-posta). */
  importRoundRobin?: boolean;
  importAssignmentMode?: ImportAssignmentMode;
  importGroupByColumn?: string;
  importGroupAssignments?: Record<string, string>;
  importRowRangesText?: string;
  /**
   * İçe aktarılacak sütunların whitelist'i. undefined / boş → dosyadaki tüm sütunlar dahil
   * (geriye dönük uyumluluk). Kullanıcı önizleme üzerinden bazı sütunları kapattıysa
   * burada yalnızca tutulanlar gelir.
   */
  selectedImportColumns?: string[];
  reassignExistingTasks?: boolean;
  reassignExistingTaskScope?: "unassigned" | "all";
  reassignExistingTaskMode?: "unassigned" | "single" | "roundRobin" | "groupByColumn" | "rowRanges";
  reassignExistingTaskAssignee?: string;
  reassignExistingGroupByColumn?: string;
  reassignExistingGroupAssignments?: Record<string, string>;
  reassignExistingRowRangesText?: string;
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

const SMART_EXTRA_COLUMN_CHIPS = [
  { label: "Sicil", group: "Kimlik" },
  { label: "TCKN", group: "Kimlik" },
  { label: "Personel No", group: "Kimlik" },
  { label: "Ad Soyad", group: "Kimlik" },
  { label: "Telefon", group: "İletişim" },
  { label: "E-posta", group: "İletişim" },
  { label: "Departman", group: "Organizasyon" },
  { label: "Bölge", group: "Organizasyon" },
  { label: "Şube", group: "Organizasyon" },
  { label: "İl", group: "Organizasyon" },
  { label: "Ekip", group: "Operasyon" },
  { label: "Uzmanlık", group: "Operasyon" },
  { label: "Durum Notu", group: "Operasyon" },
  { label: "Son İşlem Tarihi", group: "Tarih" },
] as const;

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
  canManageTeamTaskEditing,
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
  canManageTeamTaskEditing: boolean;
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
  const [teamEditAllTasks, setTeamEditAllTasks] = useState(false);
  const [importRoundRobin, setImportRoundRobin] = useState(false);
  const [importAssignmentMode, setImportAssignmentMode] = useState<ImportAssignmentMode>("unassigned");
  const [importColumnValueOptions, setImportColumnValueOptions] = useState<Record<string, string[]>>({});
  const [importGroupByColumn, setImportGroupByColumn] = useState("");
  const [importGroupAssignments, setImportGroupAssignments] = useState<Record<string, string>>({});
  const [importRowRangesText, setImportRowRangesText] = useState("");
  const [reassignExistingTasks, setReassignExistingTasks] = useState(false);
  const [reassignExistingTaskScope, setReassignExistingTaskScope] = useState<"unassigned" | "all">("unassigned");
  const [reassignExistingTaskMode, setReassignExistingTaskMode] = useState<"unassigned" | "single" | "roundRobin" | "groupByColumn" | "rowRanges">("roundRobin");
  const [reassignExistingTaskAssignee, setReassignExistingTaskAssignee] = useState("");
  const [reassignExistingGroupByColumn, setReassignExistingGroupByColumn] = useState("");
  const [reassignExistingGroupAssignments, setReassignExistingGroupAssignments] = useState<Record<string, string>>({});
  const [reassignExistingRowRangesText, setReassignExistingRowRangesText] = useState("");
  const [extraColumnKeysText, setExtraColumnKeysText] = useState("");
  const [titleColumn, setTitleColumn] = useState<string>("");
  const [subtitleColumns, setSubtitleColumns] = useState<string[]>([]);
  const [wipInProgressLimit, setWipInProgressLimit] = useState<string>("");
  const [workflowEnabled, setWorkflowEnabled] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUserProfile[]>([]);
  const [memberPermissions, setMemberPermissions] = useState<Record<string, ProjectMemberPermission>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsMissingTable, setPermissionsMissingTable] = useState(false);
  const toast = useToast();
  /** 2-adım sihirbazı: 1 = proje bilgileri, 2 = opsiyonel görev içe aktarma. Edit modunda kullanılmaz. */
  const [step, setStep] = useState<1 | 2>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!project;
  const title = isEdit ? "Projeyi düzenle" : step === 1 ? "Yeni proje · Bilgiler" : "Yeni proje · Görev içe aktarma (opsiyonel)";
  const isStep1Valid = name.trim().length > 0;
  const directoryByEmail = useMemo(() => {
    const map = new Map<string, DirectoryUserProfile>();
    for (const u of directoryUsers) {
      const email = u.email.trim().toLowerCase();
      if (email) map.set(email, u);
    }
    return map;
  }, [directoryUsers]);

  const assignedPermissionRows = useMemo(() => {
    if (!project) return [];
    return assignedEmails.map((rawEmail) => {
      const email = rawEmail.trim().toLowerCase();
      const profile = directoryByEmail.get(email) ?? null;
      const existing = profile ? memberPermissions[profile.uid] : null;
      const permission =
        existing ??
        (profile
          ? defaultProjectMemberPermission({
              projectId: project.id,
              userId: profile.uid,
              userEmail: email,
              role: "member",
            })
          : null);
      return { email, profile, permission };
    });
  }, [assignedEmails, directoryByEmail, memberPermissions, project]);

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
      setTeamEditAllTasks(project.team_edit_all_tasks ?? false);
      setImportRoundRobin(false);
      setImportAssignmentMode("unassigned");
      setImportColumnValueOptions({});
      setImportGroupByColumn("");
      setImportGroupAssignments({});
      setImportRowRangesText("");
      setReassignExistingTasks(false);
      setReassignExistingTaskScope("unassigned");
      setReassignExistingTaskMode("roundRobin");
      setReassignExistingTaskAssignee("");
      setReassignExistingGroupByColumn("");
      setReassignExistingGroupAssignments({});
      setReassignExistingRowRangesText("");
      setExtraColumnKeysText((project.extra_column_keys ?? []).join("\n"));
      setTitleColumn(project.title_column ?? "");
      setSubtitleColumns(project.subtitle_columns ?? []);
      setWipInProgressLimit(
        project.wip_in_progress_limit != null && project.wip_in_progress_limit > 0
          ? String(project.wip_in_progress_limit)
          : ""
      );
      setWorkflowEnabled(project.workflow_enabled === true);
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
      setTeamEditAllTasks(false);
      setImportRoundRobin(false);
      setImportAssignmentMode("unassigned");
      setImportColumnValueOptions({});
      setImportGroupByColumn("");
      setImportGroupAssignments({});
      setImportRowRangesText("");
      setReassignExistingTasks(false);
      setReassignExistingTaskScope("unassigned");
      setReassignExistingTaskMode("roundRobin");
      setReassignExistingTaskAssignee("");
      setReassignExistingGroupByColumn("");
      setReassignExistingGroupAssignments({});
      setReassignExistingRowRangesText("");
      setExtraColumnKeysText("");
      setTitleColumn("");
      setSubtitleColumns([]);
      setWipInProgressLimit("");
      setWorkflowEnabled(false);
      setStep(1);
    }
  }, [open, project]);

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    setPermissionsLoading(true);
    setPermissionsMissingTable(false);
    void (async () => {
      const [users, perms] = await Promise.all([
        listDirectoryUsers(),
        listProjectMemberPermissions(project.id),
      ]);
      if (cancelled) return;
      setDirectoryUsers(users);
      if (perms.ok) {
        const next: Record<string, ProjectMemberPermission> = {};
        for (const row of perms.data) next[row.user_id] = row;
        setMemberPermissions(next);
        setPermissionsMissingTable(false);
      } else {
        setMemberPermissions({});
        setPermissionsMissingTable(perms.missingTable);
      }
      setPermissionsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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
      setImportColumnValueOptions({});
      setImportGroupByColumn("");
      setImportGroupAssignments({});
      setImportRowRangesText("");
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
          const valueOptions: Record<string, string[]> = {};
          for (const h of headers) {
            const key = (h ?? "").trim() || h;
            valueOptions[key] = collectColumnValues(headers, rows, key);
          }
          setImportColumnValueOptions(valueOptions);
          setImportGroupByColumn("");
          setImportGroupAssignments({});
          setImportRowRangesText("");
          setImportAssignmentMode(findAssigneeColumnIndex(headers) != null ? "file" : "unassigned");
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

  const importHasAssigneeColumn = useMemo(
    () => (importPreview ? findAssigneeColumnIndex(importPreview.headers) != null : false),
    [importPreview]
  );

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

  const addExtraColumnKey = (key: string) => {
    const nextKey = key.trim();
    if (!nextKey) return;
    const existing = parseExtraColumnKeysFromForm(extraColumnKeysText);
    if (existing.some((k) => k.toLowerCase() === nextKey.toLowerCase())) return;
    setExtraColumnKeysText([...existing, nextKey].join("\n"));
  };

  const removeExtraColumnKeyFromForm = (key: string) => {
    const target = key.trim().toLowerCase();
    if (!target) return;
    const next = parseExtraColumnKeysFromForm(extraColumnKeysText).filter(
      (k) => k.trim().toLowerCase() !== target
    );
    setExtraColumnKeysText(next.join("\n"));
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

  const patchMemberPermission = (
    userId: string,
    patch: Partial<Omit<ProjectMemberPermission, "project_id" | "user_id" | "user_email">>
  ) => {
    if (!project) return;
    const row = assignedPermissionRows.find((item) => item.profile?.uid === userId);
    if (!row?.profile) return;
    setMemberPermissions((prev) => {
      const current =
        prev[userId] ??
        defaultProjectMemberPermission({
          projectId: project.id,
          userId,
          userEmail: row.profile!.email,
        });
      return {
        ...prev,
        [userId]: { ...current, ...patch },
      };
    });
  };

  const buildPermissionPatchForRole = (
    role: ProjectMemberRole,
    current: ProjectMemberPermission
  ): Partial<Omit<ProjectMemberPermission, "project_id" | "user_id" | "user_email">> => {
    if (role === "viewer") {
      return {
        project_role: role,
        can_view: true,
        can_edit: false,
        can_comment: false,
        can_copy: false,
        can_export: false,
        can_export_unmasked: false,
        can_bulk_update: false,
        can_bulk_delete: false,
      };
    }
    if (role === "member") {
      return {
        project_role: role,
        can_view: true,
        can_edit: true,
        can_comment: true,
        can_copy: true,
        can_export: false,
        can_export_unmasked: false,
        can_bulk_update: false,
        can_bulk_delete: false,
      };
    }
    return {
      project_role: role,
      can_view: true,
      can_edit: true,
      can_comment: true,
      can_copy: true,
      can_export: true,
      can_export_unmasked: isAdmin ? current.can_export_unmasked : false,
      can_bulk_update: true,
      can_bulk_delete: isAdmin ? current.can_bulk_delete : false,
    };
  };

  const buildPermissionPatchForToggle = (
    key: keyof Pick<
      ProjectMemberPermission,
      | "can_view"
      | "can_edit"
      | "can_comment"
      | "can_copy"
      | "can_export"
      | "can_export_unmasked"
      | "can_bulk_update"
      | "can_bulk_delete"
    >,
    checked: boolean
  ): Partial<Omit<ProjectMemberPermission, "project_id" | "user_id" | "user_email">> => {
    if (key === "can_view" && !checked) {
      return {
        can_view: false,
        can_edit: false,
        can_comment: false,
        can_copy: false,
        can_export: false,
        can_export_unmasked: false,
        can_bulk_update: false,
        can_bulk_delete: false,
      };
    }
    return checked ? { can_view: true, [key]: true } : { [key]: false };
  };

  const saveMemberPermissions = async () => {
    if (!project) return;
    const rows = assignedPermissionRows
      .filter((row): row is typeof row & { profile: DirectoryUserProfile; permission: ProjectMemberPermission } => !!row.profile && !!row.permission)
      .map((row) => ({
        project_id: project.id,
        user_id: row.profile.uid,
        user_email: row.email,
        project_role: row.permission.project_role,
        can_view: row.permission.can_view,
        can_edit: row.permission.can_edit,
        can_comment: row.permission.can_comment,
        can_copy: row.permission.can_copy,
        can_export: row.permission.can_export,
        can_export_unmasked: isAdmin ? row.permission.can_export_unmasked : false,
        can_bulk_update: row.permission.can_bulk_update,
        can_bulk_delete: isAdmin ? row.permission.can_bulk_delete : false,
      }));
    if (rows.length === 0) {
      toast.warning("Kaydedilecek proje yetkisi bulunamadı.");
      return;
    }
    setPermissionsSaving(true);
    try {
      const result = await upsertProjectMemberPermissions(rows);
      if (!result.ok) {
        setPermissionsMissingTable(result.missingTable);
        toast.error("Proje yetkileri kaydedilemedi", { description: result.message });
        return;
      }
      setPermissionsMissingTable(false);
      toast.success("Proje bazlı yetkiler kaydedildi", {
        description: `${rows.length} kullanıcı için yetki matrisi güncellendi.`,
      });
    } finally {
      setPermissionsSaving(false);
    }
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
        assignee: !isEdit && importAssignmentMode === "single" ? (assignee.trim() || undefined) : undefined,
        // Boş dizi de göndermeli ki "tüm atananları kaldır" işlemi kaydedilebilsin
        assignedEmails: assignedEmails,
        strictAssigneeVisibility: isAdmin ? strictAssigneeVisibility : undefined,
        teamEditAllTasks: canManageTeamTaskEditing ? teamEditAllTasks : undefined,
        importRoundRobin: !isEdit ? importAssignmentMode === "roundRobin" : undefined,
        importAssignmentMode: !isEdit ? importAssignmentMode : undefined,
        importGroupByColumn: !isEdit ? importGroupByColumn : undefined,
        importGroupAssignments: !isEdit ? importGroupAssignments : undefined,
        importRowRangesText: !isEdit ? importRowRangesText : undefined,
        extraColumnKeys: extraColumnKeys.length > 0 ? extraColumnKeys : undefined,
        titleColumn: titleColumn.trim() || null,
        subtitleColumns: subtitleColumns.length > 0 ? subtitleColumns : null,
        wipInProgressLimit: (() => {
          const n = Number(wipInProgressLimit);
          return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        })(),
        workflowEnabled,
        selectedImportColumns:
          !isEdit && importFile && importPreview
            ? importPreview.headers.filter((h) =>
                selectedImportColumns.has((h ?? "").trim() || h)
              )
            : undefined,
        reassignExistingTasks: isEdit ? reassignExistingTasks : undefined,
        reassignExistingTaskScope: isEdit ? reassignExistingTaskScope : undefined,
        reassignExistingTaskMode: isEdit ? reassignExistingTaskMode : undefined,
        reassignExistingTaskAssignee: isEdit ? reassignExistingTaskAssignee.trim() : undefined,
        reassignExistingGroupByColumn: isEdit ? reassignExistingGroupByColumn : undefined,
        reassignExistingGroupAssignments: isEdit ? reassignExistingGroupAssignments : undefined,
        reassignExistingRowRangesText: isEdit ? reassignExistingRowRangesText : undefined,
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
    setImportAssignmentMode("unassigned");
    setImportColumnValueOptions({});
    setImportGroupByColumn("");
    setImportGroupAssignments({});
    setImportRowRangesText("");
    setReassignExistingTasks(false);
    setReassignExistingTaskScope("unassigned");
    setReassignExistingTaskMode("roundRobin");
    setReassignExistingTaskAssignee("");
    setReassignExistingGroupByColumn("");
    setReassignExistingGroupAssignments({});
    setReassignExistingRowRangesText("");
    setExtraColumnKeysText("");
    setSubtitleColumns([]);
    setWorkflowEnabled(false);
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
      <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-950/25">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            checked={workflowEnabled}
            onChange={(e) => setWorkflowEnabled(e.target.checked)}
          />
          <span className="text-sm text-slate-800 dark:text-slate-200">
            <span className="font-medium">Onay workflow sistemi</span>
            <span className="mt-1 block text-xs font-normal text-slate-600 dark:text-slate-400">
              Üye satırı kontrole gönderir; proje yetkilisi/admin onaylar, reddeder veya revize ister.
            </span>
          </span>
        </label>
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
    const schemaKeySet = new Set(schemaKeys.map((k) => k.trim().toLowerCase()));
    return (
      <div className="grid gap-4">
        <div>
          <label htmlFor="project-extra-columns" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Canlı tablo ek sütunları
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SMART_EXTRA_COLUMN_CHIPS.map((chip) => {
              const selected = schemaKeySet.has(chip.label.toLowerCase());
              const sensitive = isSensitiveExtraColumnKey(chip.label);
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() =>
                    selected ? removeExtraColumnKeyFromForm(chip.label) : addExtraColumnKey(chip.label)
                  }
                  aria-pressed={selected}
                  title={`${chip.group}${sensitive ? " · hassas veri olabilir" : ""}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/45 dark:text-blue-200"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
                    sensitive && !selected && "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
                  )}
                >
                  {selected ? <Check className="h-3 w-3" aria-hidden /> : <PlusCircle className="h-3 w-3" aria-hidden />}
                  <span>{chip.label}</span>
                  {sensitive && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      hassas
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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

  const reassignColumnOptions = useMemo(() => {
    const merged = new Set<string>();
    for (const k of parseExtraColumnKeysFromForm(extraColumnKeysText)) if (k.trim()) merged.add(k.trim());
    for (const k of observedExtraKeys ?? []) if (k && k.trim()) merged.add(k.trim());
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
  }, [extraColumnKeysText, observedExtraKeys]);

  const reassignGroupValues = useMemo(() => {
    if (!reassignExistingGroupByColumn) return [];
    return Array.from(new Set((observedSampleValues?.[reassignExistingGroupByColumn] ?? []).map((v) => String(v ?? "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base", numeric: true }));
  }, [observedSampleValues, reassignExistingGroupByColumn]);

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

      {canManageTeamTaskEditing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={teamEditAllTasks}
              onChange={(e) => setTeamEditAllTasks(e.target.checked)}
            />
            <span className="text-sm text-slate-800 dark:text-slate-200">
              <span className="font-medium">Ekip tüm satırları düzenleyebilir</span>
              <span className="mt-1 block text-xs font-normal text-slate-600 dark:text-slate-400">
                Kapalıyken ekip üyeleri tüm listeyi görür; yalnızca kendilerine atanmış veya atanmamış satırları düzenler.
                Admin ve proje yöneticisi her zaman tüm satırları düzenleyebilir.
              </span>
            </span>
          </label>
        </div>
      )}

      {isEdit && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={reassignExistingTasks}
              onChange={(e) => setReassignExistingTasks(e.target.checked)}
            />
            <span className="text-sm text-slate-800 dark:text-slate-200">
              <span className="font-medium">Mevcut görevleri yeniden ata</span>
              <span className="mt-1 block text-xs font-normal text-slate-600 dark:text-slate-400">
                Kaydet dediğinde bu projedeki görev satırlarının ataması seçilen yönteme göre güncellenir.
              </span>
            </span>
          </label>
          {reassignExistingTasks && (
            <div className="mt-3 grid gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Kapsam
                  <select
                    value={reassignExistingTaskScope}
                    onChange={(e) => setReassignExistingTaskScope(e.target.value as "unassigned" | "all")}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="unassigned">Sadece atanmamış görevler</option>
                    <option value="all">Tüm görevler</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Yöntem
                  <select
                    value={reassignExistingTaskMode}
                    onChange={(e) => {
                      setReassignExistingTaskMode(e.target.value as "unassigned" | "single" | "roundRobin" | "groupByColumn" | "rowRanges");
                      setReassignExistingGroupAssignments({});
                      setReassignExistingRowRangesText("");
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="roundRobin">Eşit dağıt</option>
                    <option value="single">Tek kişiye ata</option>
                    <option value="groupByColumn">Sütuna göre dağıt</option>
                    <option value="rowRanges">Satır aralığına göre dağıt</option>
                    <option value="unassigned">Atanmamış bırak</option>
                  </select>
                </label>
              </div>
              {reassignExistingTaskMode === "single" && (
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Atanacak kişi
                  <input
                    type="email"
                    value={reassignExistingTaskAssignee}
                    onChange={(e) => setReassignExistingTaskAssignee(e.target.value)}
                    placeholder="atanan@ornek.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </label>
              )}
              {reassignExistingTaskMode === "roundRobin" && assignedEmails.length < 2 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.
                </p>
              )}
              {reassignExistingTaskMode === "groupByColumn" && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/70">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Gruplanacak sütun
                    <select
                      value={reassignExistingGroupByColumn}
                      onChange={(e) => {
                        setReassignExistingGroupByColumn(e.target.value);
                        setReassignExistingGroupAssignments({});
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    >
                      <option value="">Sütun seç</option>
                      {reassignColumnOptions.map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </label>
                  {reassignExistingGroupByColumn && (
                    <div className="mt-3 space-y-2">
                      {reassignGroupValues.length > 0 ? (
                        reassignGroupValues.map((value) => (
                          <label key={value} className="grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-[minmax(0,1fr)_minmax(180px,1.2fr)] sm:items-center">
                            <span className="truncate rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-700/60" title={value}>
                              {value}
                            </span>
                            <input
                              type="email"
                              value={reassignExistingGroupAssignments[value] ?? ""}
                              onChange={(e) =>
                                setReassignExistingGroupAssignments((prev) => ({ ...prev, [value]: e.target.value.trim().toLowerCase() }))
                              }
                              placeholder="atanan@ornek.com"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                            />
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Bu sütunda mevcut görevlerden okunabilen değer yok.
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        E-posta girilmeyen grup değerleri atanmamış kalır.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {reassignExistingTaskMode === "rowRanges" && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/70">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Satır aralıkları
                    <textarea
                      value={reassignExistingRowRangesText}
                      onChange={(e) => setReassignExistingRowRangesText(e.target.value)}
                      rows={4}
                      placeholder={"1-25 ugur@example.com\n26-50 ayse@example.com\n51-100 mehmet@example.com"}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </label>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Aralıklar mevcut görev listesinin kayıt sırasına göre uygulanır. Aralık dışında kalan satırlar atanmamış kalır.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const fieldsAdvanced = isEdit && project ? (() => {
    const schemaKeys = parseExtraColumnKeysFromForm(extraColumnKeysText);
    const mergedKeys = Array.from(new Set([...(observedExtraKeys ?? []), ...schemaKeys].map((k) => k.trim()).filter(Boolean)));
    return (
      <ProjectColumnManager
        projectId={project.id}
        observedKeys={mergedKeys}
        sampleValuesByKey={observedSampleValues ?? {}}
      />
    );
  })() : null;

  const fieldsProjectPermissions = isEdit && project ? (
    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Proje bazlı yetkiler
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Bu panel proje ekibindeki kullanıcılar için yorum, kopya, export ve toplu işlem izinlerini hazırlar.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void saveMemberPermissions()}
          disabled={permissionsSaving || permissionsLoading || assignedPermissionRows.every((row) => !row.profile)}
        >
          {permissionsSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
          Yetkileri kaydet
        </Button>
      </div>
      {permissionsMissingTable && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          Supabase&apos;de <code>scripts/project-member-permissions.sql</code> henüz uygulanmamış görünüyor. SQL çalışana kadar bu panel kayıt yapmaz.
        </div>
      )}
      {permissionsLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/35 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Proje yetkileri yükleniyor...
        </div>
      ) : assignedPermissionRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Önce Ekip sekmesinden proje kullanıcısı ekleyin.
        </p>
      ) : (
        <div className="space-y-2">
          {assignedPermissionRows.map(({ email, profile, permission }) => (
            <div key={email} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {profile?.displayName || email}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {email}{!profile && " · profil kaydı yok"}
                  </p>
                </div>
                {profile && permission && (
                  <select
                    value={permission.project_role}
                    onChange={(e) => {
                      const role = e.target.value as ProjectMemberRole;
                      patchMemberPermission(profile.uid, buildPermissionPatchForRole(role, permission));
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="project_owner">Proje sahibi</option>
                    <option value="project_manager">Proje yetkilisi</option>
                    <option value="member">Üye</option>
                    <option value="viewer">İzleyici</option>
                  </select>
                )}
              </div>
              {profile && permission ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {([
                    ["can_view", "Görür"],
                    ["can_edit", "Düzenler"],
                    ["can_comment", "Yorum"],
                    ["can_copy", "Kopya"],
                    ["can_export", "Export"],
                    ["can_export_unmasked", "Maskesiz export"],
                    ["can_bulk_update", "Toplu güncelle"],
                    ["can_bulk_delete", "Toplu silme"],
                  ] as const).map(([key, label]) => {
                    const restricted = (key === "can_export_unmasked" || key === "can_bulk_delete") && !isAdmin;
                    return (
                      <label key={key} className={cn("flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300", restricted && "opacity-50")}>
                        <input
                          type="checkbox"
                          checked={Boolean(permission[key])}
                          disabled={restricted}
                          onChange={(e) => patchMemberPermission(profile.uid, buildPermissionPatchForToggle(key, e.target.checked))}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Bu e-posta henüz sisteme giriş yapmadığı için proje bazlı izin kaydı oluşturulamıyor.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  const newProjectStepOne = (
    <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="general">Genel</TabsTrigger>
        <TabsTrigger value="table">Tablo/Görünüm</TabsTrigger>
        <TabsTrigger value="people">Ekip</TabsTrigger>
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
      </div>
    </Tabs>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={true}
        className={cn(
          "max-w-2xl",
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
              </TabsList>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                <TabsContent value="general" className="m-0 data-[state=inactive]:hidden">
                  {fieldsGeneral}
                </TabsContent>
                <TabsContent value="table" className="m-0 data-[state=inactive]:hidden">
                  {fieldsTableView}
                  {fieldsAdvanced && (
                    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                      {fieldsAdvanced}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="people" className="m-0 data-[state=inactive]:hidden">
                  {fieldsAssignees}
                  {fieldsProjectPermissions}
                </TabsContent>
              </div>
            </Tabs>
          ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {/* Step 1 — Proje bilgileri (yeni proje akışı) */}
          {step === 1 && newProjectStepOne}
          {step === 1 && (
          <div className="hidden">
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
                      bu projeye CSV/Excel&apos;den görev içe aktar; ondan sonra burada listelenir.
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

          {canManageTeamTaskEditing && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={teamEditAllTasks}
                  onChange={(e) => setTeamEditAllTasks(e.target.checked)}
                />
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-medium">Ekip tüm satırları düzenleyebilir</span>
                  <span className="mt-1 block text-xs font-normal text-slate-600 dark:text-slate-400">
                    Kapalıyken proje ekibi listeyi görür; normal üyeler sadece kendi veya atanmamış satırları düzenler.
                    Açıkken ekipteki herkes satırları düzenleyebilir.
                  </span>
                </span>
              </label>
            </div>
          )}

          </div>
          )}
          {/* /Step 1 */}

          {/* Step 2 — Opsiyonel görev içe aktarma (yalnızca yeni proje akışı) */}
          {!isEdit && step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Bu adım <strong>opsiyonel</strong>. Hemen &quot;Oluştur&quot;a basabilir veya bir dosyadan toplu görev ekleyebilirsiniz.
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
                {importFile && importPreview && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/70">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Atama yöntemi</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {importHasAssigneeColumn
                            ? "Dosyada atanan sütunu bulundu; istersen farklı bir dağıtım seçebilirsin."
                            : "Dosyada atanan sütunu bulunamadı; satırların nasıl atanacağını seç."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {importHasAssigneeColumn && (
                        <label className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs",
                          importAssignmentMode === "file" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                        )}>
                          <input
                            type="radio"
                            name="import-assignment-mode"
                            checked={importAssignmentMode === "file"}
                            onChange={() => setImportAssignmentMode("file")}
                            className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span><strong>Dosyadaki atananı kullan</strong><br />Her satır kendi e-posta sütunundan atanır.</span>
                        </label>
                      )}
                      <label className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs",
                        importAssignmentMode === "unassigned" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      )}>
                        <input
                          type="radio"
                          name="import-assignment-mode"
                          checked={importAssignmentMode === "unassigned"}
                          onChange={() => setImportAssignmentMode("unassigned")}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span><strong>Atanmamış bırak</strong><br />Satırlar sonradan filtrelenip atanabilir.</span>
                      </label>
                      <label className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs",
                        importAssignmentMode === "single" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      )}>
                        <input
                          type="radio"
                          name="import-assignment-mode"
                          checked={importAssignmentMode === "single"}
                          onChange={() => setImportAssignmentMode("single")}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span><strong>Tek kişiye ata</strong><br />Tüm satırlar seçilen e-postaya gider.</span>
                      </label>
                      <label className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs",
                        importAssignmentMode === "roundRobin" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300",
                        assignedEmails.length < 2 && "cursor-not-allowed opacity-60"
                      )}>
                        <input
                          type="radio"
                          name="import-assignment-mode"
                          checked={importAssignmentMode === "roundRobin"}
                          disabled={assignedEmails.length < 2}
                          onChange={() => setImportAssignmentMode("roundRobin")}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span><strong>Eşit dağıt</strong><br />Proje ekibine sırayla paylaştırılır.</span>
                      </label>
                      <label className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs",
                        importAssignmentMode === "groupByColumn" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      )}>
                        <input
                          type="radio"
                          name="import-assignment-mode"
                          checked={importAssignmentMode === "groupByColumn"}
                          onChange={() => setImportAssignmentMode("groupByColumn")}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span><strong>Sütuna göre dağıt</strong><br />Bölge, şube veya ekip değerlerini kişilere bağlar.</span>
                      </label>
                      <label className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs",
                        importAssignmentMode === "rowRanges" ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100" : "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      )}>
                        <input
                          type="radio"
                          name="import-assignment-mode"
                          checked={importAssignmentMode === "rowRanges"}
                          onChange={() => setImportAssignmentMode("rowRanges")}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span><strong>Satır aralığına göre dağıt</strong><br />1-25, 26-50 gibi blokları kişilere atar.</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {importFile && importAssignmentMode === "single" && (
                <div>
                  <label htmlFor="project-assignee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Atanacak kişi
                  </label>
                  <input
                    id="project-assignee"
                    type="email"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="atanan@ornek.com"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Bu e-posta içe aktarılan tüm görev satırlarına yazılır.
                  </p>
                </div>
              )}
              {importFile && importPreview && importAssignmentMode === "groupByColumn" && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/70">
                  <label htmlFor="import-group-column" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Gruplanacak sütun
                  </label>
                  <select
                    id="import-group-column"
                    value={importGroupByColumn}
                    onChange={(e) => {
                      setImportGroupByColumn(e.target.value);
                      setImportGroupAssignments({});
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">Sütun seç</option>
                    {importPreview.headers.map((h, idx) => {
                      const key = (h ?? "").trim() || h;
                      const label = key || `Sütun ${idx + 1}`;
                      return (
                        <option key={`${idx}-${key}`} value={key}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  {importGroupByColumn && (
                    <div className="mt-3 space-y-2">
                      {(importColumnValueOptions[importGroupByColumn] ?? []).length > 0 ? (
                        (importColumnValueOptions[importGroupByColumn] ?? []).map((value) => (
                          <label key={value} className="grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-[minmax(0,1fr)_minmax(180px,1.2fr)] sm:items-center">
                            <span className="truncate rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-700/60" title={value}>
                              {value}
                            </span>
                            <input
                              type="email"
                              value={importGroupAssignments[value] ?? ""}
                              onChange={(e) =>
                                setImportGroupAssignments((prev) => ({ ...prev, [value]: e.target.value.trim().toLowerCase() }))
                              }
                              placeholder="atanan@ornek.com"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                            />
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Bu sütunda önizlenebilir değer bulunamadı.</p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        E-posta girilmeyen grup değerleri atanmamış kalır.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {importFile && importAssignmentMode === "rowRanges" && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/70">
                  <label htmlFor="import-row-ranges" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Satır aralıkları
                  </label>
                  <textarea
                    id="import-row-ranges"
                    value={importRowRangesText}
                    onChange={(e) => setImportRowRangesText(e.target.value)}
                    rows={4}
                    placeholder={"1-25 ugur@example.com\n26-50 ayse@example.com\n51-100 mehmet@example.com"}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Her satıra bir aralık ve e-posta yaz. Aralık dışında kalan satırlar atanmamış kalır.
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
  const canManageTeamTaskEditing = isAdmin || user?.roleId === "project_manager";
  const canDeleteProject = hasPermission("projects.delete");
  const canArchiveProject = hasPermission("projects.archive");
  const [showArchived, setShowArchived] = useState(false);
  const {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
  } = useProjects({ includeArchived: showArchived });
  const { createTasksBulk, tasks, saveTask, updateTaskOptimistic } = useTasksWithRealtime();
  const promptUser = usePrompt();
  const confirmDialog = useConfirm();
  const toast = useToast();

  const handleArchiveProject = useCallback(
    async (project: Project) => {
      const ok = await confirmDialog({
        title: "Projeyi arşivle",
        message: `"${project.name}" projesi arşivlenecek. Liste ve dashboard'da gizlenir ancak silinmez; istediğinizde geri getirebilirsiniz.`,
        confirmLabel: "Arşivle",
        variant: "default",
      });
      if (!ok) return;
      try {
        await archiveProject(project.id);
        toast.success(`"${project.name}" arşivlendi`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Proje arşivlenemedi");
      }
    },
    [archiveProject, confirmDialog, toast]
  );

  const handleUnarchiveProject = useCallback(
    async (project: Project) => {
      try {
        await unarchiveProject(project.id);
        toast.success(`"${project.name}" arşivden çıkarıldı`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Arşivden çıkarılamadı");
      }
    },
    [unarchiveProject, toast]
  );
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
  // Şablon dialogları
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [saveTemplateProject, setSaveTemplateProject] = useState<Project | null>(null);

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

  const taskCompletionByProject = useMemo(() => {
    const map: Record<string, { total: number; done: number; approved: number }> = {};
    for (const task of tasks) {
      const projectId = String(task.project_id ?? "").trim();
      if (!projectId) continue;
      if (!map[projectId]) map[projectId] = { total: 0, done: 0, approved: 0 };
      map[projectId].total += 1;
      if (isStatusDone(task.status)) map[projectId].done += 1;
      if (normalizeWorkflowStatus(task.workflow_status) === "approved") {
        map[projectId].approved += 1;
      }
    }
    return map;
  }, [tasks]);

  const handleFormSubmit = async (data: NewProjectSubmitData) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      const effectiveAssignedEmails = (() => {
        const list = (data.assignedEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
        if (!isAdmin && currentUserEmail && !list.includes(currentUserEmail)) {
          list.push(currentUserEmail);
        }
        return Array.from(new Set(list));
      })();
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: data.name,
          description: data.description,
          status: data.status,
          assigned_emails: effectiveAssignedEmails,
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          extra_column_keys:
            data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : [],
          title_column: data.titleColumn ?? null,
          subtitle_columns: data.subtitleColumns ?? null,
          wip_in_progress_limit: data.wipInProgressLimit ?? null,
          workflow_enabled: data.workflowEnabled ?? false,
          ...(isAdmin
            ? { strict_assignee_visibility: data.strictAssigneeVisibility ?? false }
            : {}),
          ...(canManageTeamTaskEditing
            ? { team_edit_all_tasks: data.teamEditAllTasks ?? false }
            : {}),
        });
        if (data.reassignExistingTasks) {
          const projectTasks = tasks.filter((t) => String(t.project_id ?? "") === editingProject.id);
          const targetTasks =
            data.reassignExistingTaskScope === "all"
              ? projectTasks
              : projectTasks.filter((t) => !t.assignee || t.assignee.trim() === "");
          const recipients = effectiveAssignedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
          const mode = data.reassignExistingTaskMode ?? "unassigned";
          const singleRaw = data.reassignExistingTaskAssignee?.trim() ?? "";
          const singleAssignee = normalizeTaskAssigneeEmail(singleRaw) ?? (singleRaw || null);
          const rangeAssignments =
            mode === "rowRanges" ? parseRowRangeAssignments(data.reassignExistingRowRangesText ?? "") : [];
          if (mode === "roundRobin" && recipients.length < 2) {
            throw new Error("Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.");
          }
          if (mode === "single" && !singleAssignee) {
            throw new Error("Tek kişiye atama için e-posta girilmeli.");
          }
          if (mode === "groupByColumn" && !(data.reassignExistingGroupByColumn ?? "").trim()) {
            throw new Error("Sütuna göre dağıtım için bir sütun seçilmeli.");
          }
          if (mode === "rowRanges" && rangeAssignments.length === 0) {
            throw new Error("Satır aralığına göre dağıtım için en az bir aralık girilmeli.");
          }
          for (let i = 0; i < targetTasks.length; i += 1) {
            const task = targetTasks[i];
            const groupValue =
              mode === "groupByColumn"
                ? String(task.extra_data?.[data.reassignExistingGroupByColumn ?? ""] ?? "").trim()
                : "";
            const groupAssignee =
              mode === "groupByColumn"
                ? normalizeTaskAssigneeEmail(data.reassignExistingGroupAssignments?.[groupValue])
                : null;
            const rangeAssignee =
              mode === "rowRanges" ? assigneeForRowRange(i + 1, rangeAssignments) : null;
            const nextAssignee =
              mode === "roundRobin"
                ? pickRoundRobinAssignee(recipients, i)
                : mode === "single"
                  ? singleAssignee
                  : mode === "groupByColumn"
                    ? groupAssignee
                    : mode === "rowRanges"
                      ? rangeAssignee
                      : null;
            updateTaskOptimistic(task.id, {
              assignee: nextAssignee,
              last_updated_by: user?.email ?? "anon",
            });
            const result = await saveTask(task.id, {
              assignee: nextAssignee,
              last_updated_by: user?.email ?? "anon",
            });
            if (!result.ok) throw new Error(result.message);
          }
        }
        setFormOpen(false);
        setEditingProject(null);
        setFormError(null);
        return;
      }
      const projectId = await createProject({
        name: data.name,
        description: data.description,
        status: data.status,
        assigned_emails: effectiveAssignedEmails.length ? effectiveAssignedEmails : undefined,
        due_date: data.due_date ?? undefined,
        priority: data.priority ?? undefined,
        strict_assignee_visibility: isAdmin ? (data.strictAssigneeVisibility ?? false) : false,
        team_edit_all_tasks: canManageTeamTaskEditing ? (data.teamEditAllTasks ?? false) : false,
        extra_column_keys:
          data.extraColumnKeys && data.extraColumnKeys.length > 0 ? data.extraColumnKeys : undefined,
        title_column: data.titleColumn ?? null,
        subtitle_columns: data.subtitleColumns ?? null,
        wip_in_progress_limit: data.wipInProgressLimit ?? null,
        workflow_enabled: data.workflowEnabled ?? false,
      });
      if (data.importFile && projectId) {
        const text = await data.importFile.text();
        const fileName = (data.importFile.name || "").toLowerCase();
        const isJson = fileName.endsWith(".json");
        const recipients = effectiveAssignedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
        const importMode = data.importAssignmentMode ?? "unassigned";
        const roundRobin = importMode === "roundRobin" && recipients.length >= 2;
        const defaultRaw = (data.assignee ?? "").trim();
        const defaultAssignee =
          importMode === "single" ? normalizeTaskAssigneeEmail(defaultRaw) ?? (defaultRaw || null) : null;
        if (importMode === "single" && !defaultAssignee) {
          throw new Error("Tek kişiye atama için e-posta girilmeli.");
        }
        if (importMode === "roundRobin" && recipients.length < 2) {
          throw new Error("Eşit dağıtım için proje ekibinde en az 2 e-posta olmalı.");
        }
        const rangeAssignments =
          importMode === "rowRanges" ? parseRowRangeAssignments(data.importRowRangesText ?? "") : [];
        if (importMode === "rowRanges" && rangeAssignments.length === 0) {
          throw new Error("Satır aralığına göre dağıtım için en az bir aralık girilmeli.");
        }
        if (importMode === "groupByColumn" && !(data.importGroupByColumn ?? "").trim()) {
          throw new Error("Sütuna göre dağıtım için bir sütun seçilmeli.");
        }
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
          const assigneeKey = importMode === "file" && !roundRobin ? findAssigneeJsonKey(headers) : null;
          const groupJsonKey =
            importMode === "groupByColumn" && data.importGroupByColumn
              ? headers.find((h) => ((h ?? "").trim() || h) === data.importGroupByColumn) ?? data.importGroupByColumn
              : null;
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
                const groupValue = groupJsonKey != null ? String(row[groupJsonKey] ?? "").trim() : "";
                const fromGroup =
                  importMode === "groupByColumn"
                    ? normalizeTaskAssigneeEmail(data.importGroupAssignments?.[groupValue])
                    : null;
                const fromRange =
                  importMode === "rowRanges" ? assigneeForRowRange(distributeIndex + 1, rangeAssignments) : null;
                const assignee = roundRobin
                  ? pickRoundRobinAssignee(recipients, distributeIndex)
                  : importMode === "groupByColumn"
                    ? fromGroup
                    : importMode === "rowRanges"
                      ? fromRange
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
          const assigneeCol = importMode === "file" && !roundRobin ? findAssigneeColumnIndex(headers) : null;
          const groupCol =
            importMode === "groupByColumn" && data.importGroupByColumn
              ? headers.findIndex((h) => ((h ?? "").trim() || h) === data.importGroupByColumn)
              : -1;
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
                const groupValue = groupCol >= 0 ? String(row[groupCol] ?? "").trim() : "";
                const fromGroup =
                  importMode === "groupByColumn"
                    ? normalizeTaskAssigneeEmail(data.importGroupAssignments?.[groupValue])
                    : null;
                const fromRange =
                  importMode === "rowRanges" ? assigneeForRowRange(distributeIndex + 1, rangeAssignments) : null;
                const assignee = roundRobin
                  ? pickRoundRobinAssignee(recipients, distributeIndex)
                  : importMode === "groupByColumn"
                    ? fromGroup
                    : importMode === "rowRanges"
                      ? fromRange
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

  /**
   * Şablondan yeni proje oluştur: şablon proje şeması + opsiyonel görev seti.
   * Görevlerin due_offset_days değerleri bugünden tarihe çevrilir.
   */
  const handleUseTemplate = async (template: ProjectTemplate) => {
    try {
      const td = template.template_data ?? {};
      const newName = await promptUser({
        title: `Şablondan yeni proje`,
        message: `"${template.name}" şablonundan oluşturulacak projenin adını gir:`,
        defaultValue: template.name.replace(/\s+—\s+şablonu$/i, ""),
        placeholder: "Yeni proje adı",
        confirmLabel: "Oluştur",
      });
      if (!newName || !newName.trim()) return;
      const templateAssignedEmails = (() => {
        const list = (td.assigned_emails ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
        if (!isAdmin && currentUserEmail && !list.includes(currentUserEmail)) {
          list.push(currentUserEmail);
        }
        return Array.from(new Set(list));
      })();
      const projectId = await createProject({
        name: newName.trim(),
        description: template.description || "",
        status: td.status ?? "Aktif",
        priority: td.priority ?? undefined,
        due_date: offsetToDateIso(td.due_offset_days ?? null) ?? undefined,
        assigned_emails: templateAssignedEmails.length > 0 ? templateAssignedEmails : undefined,
        strict_assignee_visibility: isAdmin ? (td.strict_assignee_visibility ?? false) : false,
        team_edit_all_tasks: canManageTeamTaskEditing ? (td.team_edit_all_tasks ?? false) : false,
        extra_column_keys: td.extra_column_keys ?? undefined,
        title_column: td.title_column ?? null,
        subtitle_columns: td.subtitle_columns ?? null,
        wip_in_progress_limit: td.wip_in_progress_limit ?? null,
      });
      if (projectId && template.tasks.length > 0) {
        // Görevleri toplu olarak ekle (createTasksBulk mevcut)
        const taskRows = template.tasks.map((t) => ({
          content: t.content,
          status: t.status ?? "Yapılacak",
          priority: t.priority ?? null,
          assignee: t.assignee ?? null,
          due_date: offsetToDateIso(t.due_offset_days ?? null) ?? null,
          extra_data: t.extra_data ?? null,
          project_id: projectId,
        }));
        await createTasksBulk(taskRows);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Şablondan oluşturulamadı");
    }
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
          <label
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors",
              showArchived
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            )}
            title="Arşivlenmiş projeleri de listele"
          >
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <Archive className="h-4 w-4" />
            Arşivlenenleri göster
          </label>
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
          {canCreateProject && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTemplateListOpen(true)}
              className="shrink-0 gap-1.5"
              title="Şablondan yeni proje oluştur veya kayıtlı şablonları yönet"
            >
              <Bookmark className="h-4 w-4" />
              Şablonlar
            </Button>
          )}
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
              const completionStats = taskCompletionByProject[project.id] ?? {
                total: taskStats.total,
                done: taskStats.done,
                approved: 0,
              };
              const taskCount = completionStats.total;
              const taskDone = project.workflow_enabled ? completionStats.approved : completionStats.done;
              const taskProgressPct = taskCount > 0 ? Math.round((taskDone / taskCount) * 100) : 0;
              const isProjectCompleted = taskCount > 0 && taskDone === taskCount;
              const completionLabel = project.workflow_enabled ? "Tüm görevler onaylandı" : "Proje tamamlandı";
              const progressTitle = project.workflow_enabled
                ? `${taskDone} / ${taskCount} görev onaylandı (${taskProgressPct}%)`
                : `${taskDone} / ${taskCount} görev tamamlandı (${taskProgressPct}%)`;
              const chatUnread = unreadByProjectId[project.id] ?? 0;
              const isArchived = !!project.archived_at;
              return (
                <article
                  key={project.id}
                  className={cn(
                    "group relative flex flex-col rounded-lg border p-4 transition-all",
                    isArchived
                      ? "border-slate-300 bg-slate-100/70 opacity-75 grayscale-[40%] dark:border-slate-600 dark:bg-slate-800/40"
                      : isProjectCompleted
                        ? "border-amber-300 bg-amber-50/70 shadow-sm dark:border-amber-500/60 dark:bg-amber-950/20"
                        : isPageVariant
                          ? "border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-blue-600"
                          : "border-slate-200 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-blue-600",
                    !isArchived && isProjectCompleted && "hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-amber-400",
                    !isArchived && project.status === "Beklemede" && "opacity-80"
                  )}
                >
                  {isArchived && (
                    <span
                      className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-slate-400 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm dark:border-slate-500 dark:bg-slate-900 dark:text-slate-300"
                      title={`Arşivlendi: ${project.archived_at ? new Date(project.archived_at).toLocaleDateString("tr-TR") : ""}`}
                    >
                      <Archive className="h-3 w-3" aria-hidden />
                      Arşivli
                    </span>
                  )}
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
                        {isProjectCompleted && (
                          <span
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700 shadow-sm dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-200"
                            title={completionLabel}
                          >
                            <Crown className="h-3.5 w-3.5" aria-hidden />
                          </span>
                        )}
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
                        {canCreateProject && (
                          <DropdownMenuItem onClick={() => setSaveTemplateProject(project)}>
                            <Bookmark className="mr-2 h-3.5 w-3.5" />
                            Şablon olarak kaydet
                          </DropdownMenuItem>
                        )}
                        {canArchiveProject && (project.archived_at
                          ? (
                            <DropdownMenuItem onClick={() => void handleUnarchiveProject(project)}>
                              <RotateCw className="mr-2 h-3.5 w-3.5" />
                              Arşivden çıkar
                            </DropdownMenuItem>
                          )
                          : (
                            <DropdownMenuItem onClick={() => void handleArchiveProject(project)}>
                              <Archive className="mr-2 h-3.5 w-3.5" />
                              Arşivle
                            </DropdownMenuItem>
                          )
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
                    {isProjectCompleted && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-300 bg-amber-100 text-xs font-medium text-amber-800 dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-200"
                      >
                        <Crown className="h-3 w-3" aria-hidden />
                        {completionLabel}
                      </Badge>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                        isPageVariant
                          ? "border-slate-300 bg-white text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200"
                          : "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      )}
                      title={taskCount > 0 ? progressTitle : "Görev yok"}
                    >
                      {taskCount === 0
                        ? "0 görev"
                        : <>{taskDone}<span className="opacity-60">/{taskCount}</span> {project.workflow_enabled ? "onay" : "görev"}</>}
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
                        <span>{project.workflow_enabled ? "Onay ilerlemesi" : "İlerleme"}</span>
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
        canManageTeamTaskEditing={canManageTeamTaskEditing}
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

      {/* Şablon dialogları */}
      <TemplateListDialog
        open={templateListOpen}
        onOpenChange={setTemplateListOpen}
        isAdmin={isAdmin}
        currentUserId={user?.id ?? null}
        onUseTemplate={(t) => void handleUseTemplate(t)}
      />
      <SaveTemplateDialog
        open={!!saveTemplateProject}
        onOpenChange={(o) => !o && setSaveTemplateProject(null)}
        project={saveTemplateProject}
        tasks={saveTemplateProject ? tasks.filter((t) => String(t.project_id ?? "") === saveTemplateProject.id) : []}
        isAdmin={isAdmin}
        onSaved={() => setSaveTemplateProject(null)}
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
