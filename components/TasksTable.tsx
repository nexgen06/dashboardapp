"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useRef, useState, useCallback, useEffect, useMemo, useLayoutEffect, useId, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import { useTasksWithRealtime } from "@/hooks/useTasksWithRealtime";
import { useProjects } from "@/hooks/useProjects";
import { usePresence } from "@/hooks/usePresence";
import {
  useSettings,
  getStatusOptions,
  getPriorityOptions,
  type DateFormat,
  type LiveTableDensity,
  type LiveTableTemplate,
} from "@/contexts/settings-context";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OnlineUsersPanel } from "@/components/OnlineUsersPanel";
import { ExportFormatButton, ExportToggleSwitch } from "@/components/tasks-table/ExportModalControls";
import {
  STATUS_OPTIONS,
  STATUS_FILTER_OPTIONS,
  PAGE_SIZE_OPTIONS,
  REFERENCE_WARNINGS_KEY,
  INTERNAL_EXTRA_DATA_KEYS,
  EMPTY_CHIP_CATALOG,
  COLUMN_LABELS,
  COLUMN_VISIBILITY_LABELS,
  CANLI_TABLO_COLUMN_ORDER,
  BASE_COLUMN_ORDER_STABLE,
  DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY,
  LIVE_TABLE_DENSITY_UI,
  LIVE_TABLE_TEMPLATE_UI,
  MODERN_DENSITY_UI,
  builtinReportTemplateSelection,
  customReportTemplateSelection,
  managedReportTemplateSelection,
  type ReportTemplateSelection,
} from "@/components/tasks-table/constants";
import { computeBalancedColumnSizing, measureIntrinsicColumnWidths } from "@/components/tasks-table/columnSizing";
import {
  parseSpotlightDescriptor,
  isSpotlightDescriptorActive,
  taskValueForSpotlight,
  isSpotlightCellMatch,
  normalizeSpotlightToken,
  type SpotlightDescriptor,
} from "@/components/tasks-table/spotlight";
import { normalizeSortText } from "@/components/tasks-table/sortText";
import {
  STATUS_DOT_CLASS,
  STATUS_BADGE_STYLES,
  STATUS_BADGE_STYLES_MODERN,
  PRIORITY_STYLES,
  getStatusDisplay,
  isTaskCompleted,
  rawStatusIsCompleted,
  resolveRestoreStatus,
} from "@/components/tasks-table/statusHelpers";
import { TaskStats } from "@/components/tasks-table/TaskStats";
import { SelectAllCheckbox } from "@/components/tasks-table/SelectAllCheckbox";
import { EditableCell, cssAttrValue } from "@/components/tasks-table/EditableCell";
import { StatusCell } from "@/components/tasks-table/StatusCell";
import { TaskFormDialog } from "@/components/tasks-table/TaskFormDialog";
import { CSVImportDialog } from "@/components/tasks-table/CSVImportDialog";
import {
  EXTRA_DATA_LINK_KEY,
  isSafeUrl,
  type TaskFormData,
} from "@/components/tasks-table/taskFormHelpers";
import type { TasksTableProps, ActiveEditableCell } from "@/components/tasks-table/types";
import { presenceEditorLines } from "@/lib/userDisplayName";
import { formatDate } from "@/lib/formatDate";
import { getRelativeTime } from "@/lib/relativeTime";
import { parseCSV } from "@/lib/csvParser";
import { parseJSON } from "@/lib/jsonParser";
import { supabase } from "@/lib/supabaseClient";
import { isSensitiveExtraColumnKey, maskSensitiveExtraValue } from "@/lib/extraColumnSensitiveDisplay";
import { normalizeExtraDataBySmartRules, getExtraColumnFormatKind } from "@/lib/extraColumnFormatRules";
import { logPiiAccess, countPiiAccessLastHour } from "@/lib/piiAccessLog";
import { evaluateSensitivePolicy, logSensitivePolicyShadow } from "@/lib/sensitiveFieldPolicy";
import { isStatusDone, isStatusInProgress, getStatusKind } from "@/lib/statusKind";
import {
  getDueUrgency,
  URGENCY_LABEL,
  URGENCY_BADGE_CLASS,
} from "@/lib/dueUrgency";
import {
  loadLiveTablePrefs,
  mergeColumnOrderWithDynamics,
  saveLiveTablePrefs,
  type LiveTablePersistedPrefs,
} from "@/lib/liveTableColumnPersistence";
import {
  ADVANCED_FILTER_OP_OPTIONS,
  advancedFilterRuleIsActive,
  generateAdvancedFilterRuleId,
  type AdvancedFilterRule,
} from "@/lib/liveTableAdvancedFilters";
import {
  countActiveLiveTableFilters,
  filterLiveTableTasks,
  getSmartFilterCounts,
} from "@/lib/liveTableFilters";
import {
  REPORT_TEMPLATES,
  createEmailTemplate,
  createPDFPreviewUrl,
  downloadCSV,
  downloadExcel,
  downloadPDF,
  buildExportColumnIds,
  type EmailTemplateMode,
  type PdfExportMetadata,
  type PdfExportScope,
  type PdfRenderOptions,
  type ReportTemplateId,
} from "@/lib/liveTableExport";
import {
  fetchOrgBranding,
  fetchSpotlightEnabledFromServer,
  DEFAULT_ORG_BRANDING,
  SPOTLIGHT_ENABLED_APP_SETTINGS_KEY,
  type OrgBranding,
} from "@/lib/appSettingsSupabase";
import { FILTER_PRESET_LABELS, filterPresetsToConfig } from "@/lib/reportTemplates";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { RestrictedButton } from "@/components/ui/permission-gate";
import { TaskCardMobile } from "@/components/TaskCardMobile";
import { TaskDetailSheet } from "@/components/TaskDetailSheet";
import { ChipSelectCell } from "@/components/chips/ChipBadge";
import { SavedViewsControl } from "@/components/SavedViewsControl";
import { listSavedViews, getProjectDefaultSavedView, type SavedView, type SavedViewConfig } from "@/lib/savedViews";
import { urgentPrioritySetFromCsv, isUrgentPriorityValue } from "@/lib/urgentTaskPriority";
import { canEditTaskRow } from "@/lib/taskRowPermissions";
import { listProjectColumns, type ProjectColumn } from "@/lib/projectColumns";
import { listReferenceSources, type ReferenceSource } from "@/lib/referenceSources";
import {
  referenceWarningsFromRecord,
  resolveReferenceTargetKey,
  valuesMatch,
} from "@/lib/referenceExtraDataEnrichment";
import {
  buildChipValueResolver,
  getChipOptionsForColumn,
  listChipCatalog,
  listRowChipValues,
  setRowChipValue,
  type ChipCatalog,
  type RowChipValue,
} from "@/lib/chipSystem";
import {
  applyAutomationRulesForTasks,
  applyBuiltInOperationalRules,
  listAutomationRules,
  ruleMatchesTask,
  type AutomationRule,
} from "@/lib/automationRules";
import {
  listTaskAutomationStates,
  type TaskAutomationState,
} from "@/lib/taskAutomationState";
import {
  listMyProjectMemberPermissions,
  type ProjectMemberPermission,
} from "@/lib/projectMemberPermissions";
import {
  logTaskWorkflowEvent,
  nextWorkflowStatus,
  normalizeWorkflowStatus,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_STATUS_CLASS,
  WORKFLOW_STATUS_LABELS,
  type TaskWorkflowAction,
} from "@/lib/taskWorkflow";
import {
  loadSavedReportTemplates,
  makeSavedReportTemplateId,
  persistSavedReportTemplates,
  type SavedReportTemplate,
} from "@/lib/reportTemplateStorage";
import {
  listManagedReportTemplates,
  type ManagedReportTemplate,
} from "@/lib/reportTemplates";
import { usePrompt } from "@/components/ui/modals";
import { notifyWorkflowEvent } from "@/lib/notifications";
import { Plus, PlusCircle, MoreVertical, MoreHorizontal, Trash2, Download, Columns3, Upload, GripVertical, Maximize2, Minimize2, Search, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, User, Loader2, ListTodo, RotateCw, RotateCcw, Filter, Shrink, Expand, AlertTriangle, Calendar, CalendarDays, CalendarClock, CalendarRange, Flame, UserCheck, UserX, ChevronDown, Circle, CheckCircle2, SlidersHorizontal, ExternalLink, ClipboardList, FileUp, Rows3, Copy, Check, ListFilter, FolderKanban, Eye, Mail, MessageSquare, Printer, Activity, Table2, Lock, LockKeyhole, Unlock, Sunrise, History, ArrowRight, Zap, FileText } from "lucide-react";

const columnHelper = createColumnHelper<Task>();



function ReferenceSelectCell({
  value,
  options,
  disabled,
  density,
  title,
  onSave,
}: {
  value: string;
  options: string[];
  disabled: boolean;
  density: LiveTableDensity;
  title?: string;
  onSave: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [open, setOpen] = useState(false);
  // Kullanıcı açtıktan sonra yeni bir şey yazdı mı? Yazmadıysa mevcut değer
  // arama sorgusu sayılmaz → tüm seçenekler listelenir (diğer seçenekler gizlenmesin).
  const [hasTyped, setHasTyped] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 260 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Focus durumunu ref'te tut — render'a yansımaz, useEffect tetiklemez.
  const isFocusedRef = useRef(false);
  // Önceki value prop'unu hatırla — sadece gerçek değişimde sync yap.
  const prevValueRef = useRef(value);

  // value prop değişimi → localValue sync. AMA kullanıcı şu an inputa odaklıysa
  // sync etme (yazdığı şeyi silmesin, imlecini kaybetmesin).
  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    if (isFocusedRef.current) return;
    setLocalValue(value);
  }, [value]);

  const MAX_DROPDOWN = 40;
  const LARGE_LIST_THRESHOLD = 200;

  // React 18 useDeferredValue — yazma sırasında düşük öncelikle filter güncellemesi.
  // Input asla bloklanmaz; filter biraz geç gelir ama focus korunur.
  const deferredLocalValue = useDeferredValue(localValue);
  // Sadece kullanıcı yazdıysa filtrele; aksi halde (mevcut değerle açıldıysa) boş
  // sorgu → tüm seçenekler görünür ve başka seçeneğe geçilebilir.
  const normalizedQuery = hasTyped ? deferredLocalValue.trim().toLocaleLowerCase("tr") : "";
  const isLargeList = options.length >= LARGE_LIST_THRESHOLD;

  const filteredOptions = useMemo(() => {
    if (isLargeList && !normalizedQuery) {
      return options.slice(0, 20);
    }
    if (!normalizedQuery) {
      return options.slice(0, MAX_DROPDOWN);
    }
    // Erken bail — 40 match toplanınca dur
    const out: string[] = [];
    for (const opt of options) {
      if (opt.toLocaleLowerCase("tr").includes(normalizedQuery)) {
        out.push(opt);
        if (out.length >= MAX_DROPDOWN) break;
      }
    }
    return out;
  }, [isLargeList, normalizedQuery, options]);

  // Toplam eşleşme sadece filter sonuçları aksiyon listesini doldururken hesaplanır;
  // küçük listede ya da yazma yokken atla (performans).
  const totalMatches = useMemo(() => {
    if (!normalizedQuery) return options.length;
    if (options.length < LARGE_LIST_THRESHOLD) return filteredOptions.length;
    // Büyük listede tam tarama yerine "40+" diyebiliriz; ama kullanıcı feedback için
    // tam sayım faydalı. Düşük öncelikle çalışır (deferredLocalValue zaten geç).
    let count = 0;
    for (const opt of options) {
      if (opt.toLocaleLowerCase("tr").includes(normalizedQuery)) count += 1;
    }
    return count;
  }, [normalizedQuery, options, filteredOptions.length]);

  const commitValue = useCallback(
    (nextValue = localValue) => {
      const trimmed = nextValue.trim();
      setOpen(false);
      if (trimmed !== value) {
        onSave(trimmed);
      }
    },
    [localValue, onSave, value]
  );

  const cellText =
    density === "compact" ? "text-xs" : density === "comfortable" ? "text-base" : "text-sm";
  const inputPad =
    density === "compact"
      ? "px-1.5 py-0.5"
      : density === "comfortable"
        ? "px-2.5 py-2"
        : "px-2 py-1";

  const updateMenuPos = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 428)),
      width: Math.max(240, Math.min(420, Math.max(rect.width, 280))),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPos();
    window.addEventListener("scroll", updateMenuPos, true);
    window.addEventListener("resize", updateMenuPos);
    return () => {
      window.removeEventListener("scroll", updateMenuPos, true);
      window.removeEventListener("resize", updateMenuPos);
    };
  }, [open, updateMenuPos]);

  if (disabled) {
    return (
      <span className={cn("block w-full min-w-0 truncate text-slate-500 dark:text-slate-400", cellText)} title={value || undefined}>
        {value || "—"}
      </span>
    );
  }

  // Hibrit: resting state'te düz metin (tablo cell ile uyumlu).
  // Click veya focus ile editing moduna geçer → input + dropdown açılır.
  const isEditing = open;

  return (
    <div ref={wrapperRef} className="relative w-full min-w-0 max-w-full">
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        // İlk tıklamada cell'in tüm alanı tıklanabilir hissetsin diye placeholder
        // yerine display value göster. Boşken küçük bir hint metni gösterelim.
        onFocus={(e) => {
          isFocusedRef.current = true;
          // Açılışta mevcut değeri sorgu sayma → tüm seçenekler görünür.
          setHasTyped(false);
          if (!open) setOpen(true);
          updateMenuPos();
          // Excel/Notion davranışı: ilk focus'ta tüm metni seç → kullanıcı
          // yazmaya başlarsa üzerine yazılır, ok tuşuyla sonuna geçer
          if (localValue) {
            // Async ki render sonrası select çalışsın
            requestAnimationFrame(() => e.target.select?.());
          }
        }}
        onChange={(e) => {
          setLocalValue(e.target.value);
          setHasTyped(true);
          if (!open) setOpen(true);
        }}
        onClick={() => {
          // Zaten odaktayken (örn. seçim sonrası) tekrar tıklayınca menü yeniden
          // açılsın ve tüm seçenekler görünsün.
          if (!open) {
            setHasTyped(false);
            setOpen(true);
            updateMenuPos();
          }
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          window.setTimeout(() => {
            if (!wrapperRef.current?.contains(document.activeElement)) {
              commitValue();
            }
          }, 0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitValue();
          }
          if (e.key === "Escape") {
            setLocalValue(value);
            setHasTyped(false);
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={
          isEditing
            ? (isLargeList ? `${options.length} kayıt — aramak için yazın` : "Ara ve seç")
            : (value ? "" : "—")
        }
        title={title || value || undefined}
        // Resting state: input görünmez border + transparent bg → düz metin gibi
        // Editing/focus: border + bg → input "aktif" görünür
        // Hover: hafif bg + border ipucu → tıklanabilir affordance
        className={cn(
          "w-full min-w-0 rounded pr-6 outline-none transition-colors",
          cellText,
          inputPad,
          isEditing
            ? "border border-blue-400 bg-white text-slate-800 ring-1 ring-blue-400 dark:border-blue-500 dark:bg-slate-700 dark:text-slate-100"
            : "cursor-pointer border border-slate-200 bg-white/60 text-slate-800 shadow-sm hover:border-blue-300 hover:bg-white dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-100 dark:hover:border-blue-500/60 dark:hover:bg-slate-700/60",
          !value && !isEditing && "text-slate-400 dark:text-slate-500"
        )}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors",
          isEditing ? "text-blue-500 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
        )}
      />
      {open && filteredOptions.length > 0 && createPortal(
        <div
          className="fixed z-[9999] max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
        >
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              tabIndex={-1}
              // Seçimi mousedown'da yap: input blur'undan ÖNCE çalışır, böylece
              // commit/blur yarışı seçimi boşa düşürmez.
              onMouseDown={(e) => {
                e.preventDefault();
                setLocalValue(opt);
                setHasTyped(false);
                commitValue(opt);
              }}
              className={cn(
                "block w-full truncate rounded px-2 py-1.5 text-left text-xs hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-200",
                opt === value
                  ? "bg-blue-50/60 font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"
                  : "text-slate-700 dark:text-slate-200"
              )}
              title={opt}
            >
              {opt}
            </button>
          ))}
          {totalMatches > filteredOptions.length && (
            <p className="px-2 py-1 text-[10px] text-slate-500 dark:text-slate-400">
              {normalizedQuery
                ? `${filteredOptions.length} / ${totalMatches} eşleşme — daha sınırlamak için yazmaya devam edin.`
                : `İlk ${filteredOptions.length} kayıt — aramak için yazmaya başlayın (${options.length} toplam).`}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * Dinamik (extra) sütunlarda: hover ile panoya — hassas sütunlarda tam değer kopyalanır.
 *
 * Hassas alan (isSensitive=true) kopyalanırsa:
 *   - pii_access_log'a kayıt düşer (KVKK denetim)
 *   - settings.piiCopyHourlyLimit aşılmışsa kopya engellenir
 *   - kullanıcı "Bu işlem kaydedildi" toast'u görür (caydırıcı)
 */
function ExtraCellCopyButton({
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

      // Shadow mod: copy eylemini await zincirinden once calistir (user gesture kaybi olmasin).
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

      // Hassas alan rate-limit kontrolü
      if (effectivePolicyMode === "enforce" && isSensitive && user?.id && settings.piiCopyHourlyLimit > 0) {
        try {
          const count = await countPiiAccessLastHour(user.id, "copy");
          if (count >= settings.piiCopyHourlyLimit) {
            toast.error(`Saatlik hassas alan kopyalama limiti aşıldı (${settings.piiCopyHourlyLimit}). Bu eylem geçici olarak engellendi.`);
            return;
          }
        } catch {
          // Sayım başarısız — eylemi engellemek yerine devam et
        }
      }

      // Enforce modda deny karari clipboard oncesi kontrol edilmeli.
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
          // Clipboard API user-gesture/permission nedeniyle başarısız olursa legacy fallback.
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

        // Hassas alan: denetim logu + caydırıcı toast
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
    [text, isSensitive, fieldName, recordId, user, settings.piiCopyHourlyLimit, settings.piiPolicyMode, toast, projectId, roleId]
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



export function TasksTable({
  projectFilter: extProjectFilter,
  onProjectFilterChange,
  viewTabs,
  initialOpenTaskId,
}: TasksTableProps = {}) {
  const {
    tasks,
    updateTaskOptimistic,
    saveTask,
    createTask,
    createTasksBulk,
    deleteTask,
    deleteTasks,
    fetchTasks,
    isLoading,
    error,
    realtimeConnection,
    recentlyUpdatedIds,
  } = useTasksWithRealtime();
  const { projects, updateProject } = useProjects();
  const { user, hasPermission, isAdmin } = useAuth();
  const { editorsByRowId, onlineUsers, setEditingRow } = usePresence({
    userEmail: user?.email ?? undefined,
    userName: user?.displayName ?? user?.email ?? undefined,
    userId: user?.id ?? undefined,
  });
  const [presenceHoverRowId, setPresenceHoverRowId] = useState<string | null>(null);

  const { settings, updateSetting } = useSettings();
  const tableDensity = settings.liveTableDensity;
  const tableTemplate = settings.liveTableTemplate ?? "classic";
  const isModernTemplate = tableTemplate === "modern";
  const tableSkin = LIVE_TABLE_TEMPLATE_UI[tableTemplate];
  const dui = LIVE_TABLE_DENSITY_UI[tableDensity];
  const statusOptions = useMemo(() => getStatusOptions(settings), [settings.customStatusList]);
  const priorityOptions = getPriorityOptions(settings);
  const urgentPrioritySetForTable = useMemo(
    () => urgentPrioritySetFromCsv(settings.urgentPriorityTokens),
    [settings.urgentPriorityTokens]
  );
  const currentUserEmail = (user?.email ?? "").trim().toLowerCase();
  const canCreateTask = hasPermission("liveTable.createTask");
  const canEditTask = hasPermission("liveTable.editTask");
  const canDeleteTask = hasPermission("liveTable.deleteTask");
  const canCommentTask = hasPermission("liveTable.commentTask");
  const canCopyCell = hasPermission("liveTable.copyCell");
  const canBulkUpdate = hasPermission("liveTable.bulkUpdate");
  const canBulkDelete = hasPermission("liveTable.bulkDelete");
  const canImportCsv = hasPermission("liveTable.importCsv");
  const canExportCsv = hasPermission("liveTable.exportCsv");
  const canExportAllRows = hasPermission("liveTable.exportAllRows");
  const canExportSensitiveUnmasked = hasPermission("liveTable.exportSensitiveUnmasked");
  const canManageColumns = hasPermission("liveTable.manageColumns");
  const canAutoSizeColumns = hasPermission("liveTable.autoSizeColumns");
  const canEditProject = hasPermission("projects.edit");
  const canViewSensitiveCells = isAdmin;
  const canManageSensitiveChips =
    hasPermission("sensitiveChips.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const canRunClientAutomations =
    hasPermission("automation.manage") || user?.roleId === "admin" || user?.roleId === "project_manager";
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  /** Hızlı satır ekleme zinciri: id verilirse content sütunundaki EditableCell mount'ta edit moduna geçer. */
  const [quickAddFocusId, setQuickAddFocusId] = useState<string | null>(null);
  const [activeEditableCell, setActiveEditableCell] = useState<ActiveEditableCell | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(BASE_COLUMN_ORDER_STABLE);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({
    select: 56,
    status: 140,
    content: 260,
    actions: 52,
  });
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  /** J/K gezinmesi için son odak görev (sheet kapalıyken satır seçimi). */
  const navAnchorTaskIdRef = useRef<string | null>(null);
  const [isFullWidth, setIsFullWidth] = useState(false);

  useEffect(() => {
    if (!initialOpenTaskId || isLoading) return;
    const match = tasks.find((t) => t.id === initialOpenTaskId);
    if (match) setDetailTask(match);
  }, [initialOpenTaskId, isLoading, tasks]);

  useEffect(() => {
    if (detailTask) navAnchorTaskIdRef.current = detailTask.id;
  }, [detailTask]);

  /** Dar ekranda hızlı filtre satırı varsayılan kapalı */
  const [quickFiltersOpen, setQuickFiltersOpen] = useState(true);
  /** Hangi hızlı filtre şu anda aktif (chip görsel state için).
   *  null = hiçbiri. clearFilters ve filtre değişiklikleri otomatik sıfırlar. */
  const [activeSmartFilter, setActiveSmartFilter] = useState<
    "overdue" | "thisWeek" | "priority" | "mine" | "unassigned" | null
  >(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [reportTemplateSelection, setReportTemplateSelection] = useState<ReportTemplateSelection>(builtinReportTemplateSelection("operations"));
  const [savedReportTemplates, setSavedReportTemplates] = useState<SavedReportTemplate[]>([]);
  const [managedReportTemplates, setManagedReportTemplates] = useState<ManagedReportTemplate[]>([]);
  const [reportSavedViews, setReportSavedViews] = useState<SavedView[]>([]);
  /** Kurumsal kimlik (logo/orgName/footerText) — app_settings.org_branding */
  const [orgBranding, setOrgBranding] = useState<OrgBranding>(DEFAULT_ORG_BRANDING);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pdfDialogScope, setPdfDialogScope] = useState<PdfExportScope>("current");
  const [pdfTitleInput, setPdfTitleInput] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  /** PDF önizleme iframe'i — Yazdır butonu için contentWindow.print() çağrısında kullanılır. */
  const pdfPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfDownloadLoading, setPdfDownloadLoading] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubjectInput, setEmailSubjectInput] = useState("Canlı Tablo Görev Raporu");
  const [emailTemplateMode, setEmailTemplateMode] = useState<EmailTemplateMode>("mobile");
  const [emailCopied, setEmailCopied] = useState(false);
  /** SÜPERADMIN-only: hassas sütunları (TCKN/sicil) export'ta ham mı yazsın?
   *  Varsayılan false (maskeli) — admin bilinçli onayla aktif eder. */
  const [exportUnmaskSensitive, setExportUnmaskSensitive] = useState(false);
  const [exportIncludeAutoRowNumber, setExportIncludeAutoRowNumber] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  /** Ek sütun silme onay diyaloğu: hedef anahtar adı (extra:KEY -> KEY) veya null */
  const [removeExtraColumnKey, setRemoveExtraColumnKey] = useState<string | null>(null);
  const [removingExtraColumn, setRemovingExtraColumn] = useState(false);
  const [projectColumnsByProjectId, setProjectColumnsByProjectId] = useState<Record<string, ProjectColumn[]>>({});
  /** Referans kaynakları — extra column dropdown'ları için canlı veri kaynağı (config.reference.sourceId ile lookup). */
  const [referenceSources, setReferenceSources] = useState<ReferenceSource[]>([]);
  const [projectPermissionsByProjectId, setProjectPermissionsByProjectId] = useState<Record<string, ProjectMemberPermission>>({});
  const [projectPermissionsAvailable, setProjectPermissionsAvailable] = useState(false);
  const [chipCatalog, setChipCatalog] = useState<ChipCatalog>(EMPTY_CHIP_CATALOG);
  const [rowChipValues, setRowChipValues] = useState<RowChipValue[]>([]);
  const [rowAutomationStates, setRowAutomationStates] = useState<TaskAutomationState[]>([]);
  /**
   * Çip değer çözücü — global arama + dışa aktarımda chip-bound kolonların
   * gerçek option label'ını döner. Hem extra_data'nın boş kaldığı satırlar
   * için export çıktısı doğru gelir, hem de "Mail Gönderildi" gibi label
   * aramada bulunur. rowChipValues veya catalog değişince yeniden inşa olur.
   */
  const chipResolver = useMemo(
    () => buildChipValueResolver(rowChipValues, chipCatalog),
    [rowChipValues, chipCatalog]
  );
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [spotlightEnabled, setSpotlightEnabled] = useState(true);
  const [spotlightNowMs, setSpotlightNowMs] = useState(() => Date.now());
  const automationApplyingRef = useRef(false);
  const automationRunKeyRef = useRef("");
  const toast = useToast();
  const promptUser = usePrompt();
  const sensitiveViewShadowSeenAtRef = useRef<Map<string, number>>(new Map());
  const [globalSearch, setGlobalSearch] = useState("");
  /** Varsayılan: sadece projeye bağlı görevler (standart tablo verisi gösterilmez) */
  const [projectLinkedFilter, setProjectLinkedFilter] = useState<"proje" | "tümü">("proje");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  /** Çoklu proje filtresi (görev hangi projeye bağlı): proje id listesi.
   *  Controlled: dışarıdan prop verilirse onu kullan, değilse internal state. */
  const [internalProjectFilter, setInternalProjectFilter] = useState<string[]>([]);
  const projectFilter = extProjectFilter ?? internalProjectFilter;
  const setProjectFilter = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      const value = typeof next === "function" ? next(projectFilter) : next;
      if (onProjectFilterChange) onProjectFilterChange(value);
      else setInternalProjectFilter(value);
    },
    [projectFilter, onProjectFilterChange]
  );
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Excel tarzı sütun filtreleri
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnFilterOpen, setColumnFilterOpen] = useState<string | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  const [datePreset, setDatePreset] = useState<string>("custom");
  // Default sort: status (Yapılacak/Devam/Tamamlandı gruplaması).
  // Eskiden "updated" idi ama o kolon kaldırıldı; kayıtlı kullanıcılar için
  // hydration aşamasında geçersiz sort id'leri normalleştiriliyor.
  const [sorting, setSorting] = useState<SortingState>([{ id: "status", desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  /** Sütun görünürlüğü — çoklu seçim ve tek seferde uygulama için taslak */
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [columnPickerSearch, setColumnPickerSearch] = useState("");
  const [advancedFilterRules, setAdvancedFilterRules] = useState<AdvancedFilterRule[]>([]);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const now = new Date();

  /**
   * `projects` ve `tasks` artık Supabase RLS tarafından sunucu tarafında filtrelenmiş geliyor
   * (scripts/supabase-rls-policies.sql). Bu yüzden burada ek istemci filtresi gerekmez.
   * Aşağıdaki memo'lar doğrudan tüm fetch sonucu üzerinde çalışır.
   */

  /** Proje id -> proje (Proje sütununda isim göstermek ve filtre etiketleri için). */
  const projectById = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  useEffect(() => {
    let cancelled = false;
    const ids = projects.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) {
      setProjectColumnsByProjectId({});
      return;
    }
    void (async () => {
      const entries = await Promise.all(ids.map(async (id) => [id, await listProjectColumns(id)] as const));
      if (cancelled) return;
      setProjectColumnsByProjectId(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  /** Referans kaynaklarını yükle (extra column dropdown'larında canlı bağlantı için). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const refs = await listReferenceSources();
        if (!cancelled) setReferenceSources(refs);
      } catch {
        // Sessiz başarısızlık — tablo yoksa boş referans listesi
        if (!cancelled) setReferenceSources([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const projectIds = useMemo(
    () => Array.from(new Set(projects.map((project) => String(project.id ?? "")).filter(Boolean))),
    [projects]
  );
  const projectIdsKey = useMemo(() => projectIds.join(","), [projectIds]);
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const taskIdsKey = useMemo(() => taskIds.join(","), [taskIds]);
  const rowAutomationStateByTaskId = useMemo(
    () => new Map(rowAutomationStates.map((state) => [state.taskId, state])),
    [rowAutomationStates]
  );
  const hasTimedSpotlightRules = useMemo(
    () =>
      automationRules.some((rule) =>
        rule.enabled &&
        rule.actions.some((action) => {
          if (action.actionType !== "color_row") return false;
          if (!Boolean(action.payload?.spotlight)) return false;
          return Boolean(String(action.payload?.spotlightStartsAt ?? "").trim()) ||
            Boolean(String(action.payload?.spotlightEndsAt ?? "").trim());
        })
      ),
    [automationRules]
  );

  useEffect(() => {
    let cancelled = false;
    if (projectIds.length === 0) {
      setChipCatalog(EMPTY_CHIP_CATALOG);
      setAutomationRules([]);
      return;
    }
    void (async () => {
      try {
        const [nextCatalog, nextRules] = await Promise.all([
          listChipCatalog(projectIds),
          listAutomationRules(projectIds),
        ]);
        if (cancelled) return;
        setChipCatalog(nextCatalog);
        setAutomationRules(nextRules);
      } catch (err) {
        if (!cancelled) {
          console.warn("[live table operations]", err instanceof Error ? err.message : err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectIds]);

  useEffect(() => {
    let cancelled = false;
    const settingKey = SPOTLIGHT_ENABLED_APP_SETTINGS_KEY;
    void (async () => {
      const enabled = await fetchSpotlightEnabledFromServer().catch(() => null);
      if (cancelled || enabled == null) return;
      setSpotlightEnabled(Boolean(enabled));
    })();
    const channel = supabase
      .channel(`app_settings_${settingKey}_live_table`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: `key=eq.${settingKey}`,
        },
        (payload) => {
          const row = payload.new as { value?: unknown } | null;
          if (!row) return;
          setSpotlightEnabled(row.value === true || row.value === "true" || row.value === 1 || row.value === "1");
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (projectIds.length === 0) return;
    const refreshRules = async () => {
      const nextRules = await listAutomationRules(projectIds);
      setAutomationRules(nextRules);
    };
    const channel = supabase
      .channel(`automation_rules_live_table_${projectIdsKey}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_rules" }, () => {
        void refreshRules().catch((err) => console.warn("[live table automation rules]", err instanceof Error ? err.message : err));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_actions" }, () => {
        void refreshRules().catch((err) => console.warn("[live table automation actions]", err instanceof Error ? err.message : err));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectIds, projectIdsKey]);

  useEffect(() => {
    let cancelled = false;
    if (taskIds.length === 0) {
      setRowChipValues([]);
      setRowAutomationStates([]);
      return;
    }
    void (async () => {
      try {
        const [rows, states] = await Promise.all([
          listRowChipValues(taskIds),
          listTaskAutomationStates(taskIds),
        ]);
        if (!cancelled) {
          setRowChipValues(rows);
          setRowAutomationStates(states);
        }
      } catch (err) {
        if (!cancelled) console.warn("[live table chips]", err instanceof Error ? err.message : err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskIds]);

  useEffect(() => {
    if (taskIds.length === 0) return;
    const refreshRowsAndStates = async () => {
      const [rows, states] = await Promise.all([listRowChipValues(taskIds), listTaskAutomationStates(taskIds)]);
      setRowChipValues(rows);
      setRowAutomationStates(states);
    };
    const channel = supabase
      .channel(`row_state_live_table_${taskIdsKey}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "row_chip_values" }, () => {
        void refreshRowsAndStates().catch((err) => console.warn("[live table row chips]", err instanceof Error ? err.message : err));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_automation_state" }, () => {
        void refreshRowsAndStates().catch((err) => console.warn("[live table task automation state]", err instanceof Error ? err.message : err));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [taskIds, taskIdsKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setSpotlightNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canRunClientAutomations || automationApplyingRef.current || tasks.length === 0 || chipCatalog.templates.length === 0) return;
    const spotlightTick = hasTimedSpotlightRules ? Math.floor(spotlightNowMs / 30000) : 0;
    const runKey = JSON.stringify({
      tasks: tasks.map((task) => [
        task.id,
        task.status,
        task.due_date,
        task.updated_at,
        task.extra_data,
      ]),
      chips: rowChipValues.map((value) => [
        value.taskId,
        value.templateId,
        value.optionId,
        value.updatedAt,
      ]),
      rules: automationRules.map((rule) => [rule.id, rule.enabled, rule.updatedAt]),
      spotlightTick,
    });
    if (automationRunKeyRef.current === runKey) return;
    automationRunKeyRef.current = runKey;

    let cancelled = false;
    automationApplyingRef.current = true;
    void (async () => {
      try {
        const builtInCount = await applyBuiltInOperationalRules(tasks, rowChipValues, chipCatalog);
        const customCount = await applyAutomationRulesForTasks(tasks, automationRules, chipCatalog);
        if (!cancelled && builtInCount + customCount > 0) {
          const [nextChipValues, nextAutomationStates] = await Promise.all([
            listRowChipValues(taskIds),
            listTaskAutomationStates(taskIds),
          ]);
          setRowChipValues(nextChipValues);
          setRowAutomationStates(nextAutomationStates);
        }
      } catch (err) {
        if (!cancelled) console.warn("[live table automation]", err instanceof Error ? err.message : err);
      } finally {
        automationApplyingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    automationRules,
    canRunClientAutomations,
    chipCatalog,
    hasTimedSpotlightRules,
    rowChipValues,
    spotlightNowMs,
    taskIds,
    tasks,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setProjectPermissionsByProjectId({});
      setProjectPermissionsAvailable(false);
      return;
    }

    const loadPermissions = async () => {
      const result = await listMyProjectMemberPermissions();
      if (cancelled) return;
      if (!result.ok) {
        setProjectPermissionsByProjectId({});
        setProjectPermissionsAvailable(false);
        return;
      }
      setProjectPermissionsByProjectId(
        Object.fromEntries(result.data.map((permission) => [String(permission.project_id), permission]))
      );
      setProjectPermissionsAvailable(true);
    };

    void loadPermissions();
    const interval = window.setInterval(() => {
      void loadPermissions();
    }, 15000);
    const onFocus = () => {
      void loadPermissions();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadPermissions();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.id]);

  const getProjectPermissionForTask = useCallback(
    (task: Task) => {
      const projectId = task.project_id ? String(task.project_id) : "";
      if (!projectId) return null;
      return projectPermissionsByProjectId[projectId] ?? null;
    },
    [projectPermissionsByProjectId]
  );

  /** Workflow onay kilidi: satır approved + proje lock_on_approval açık + kullanıcı yetkili değilse true. */
  const isRowLockedByApproval = useCallback(
    (task: Task) => {
      const project = task.project_id ? projectById.get(String(task.project_id)) ?? null : null;
      if (!project?.workflow_enabled || !project?.lock_on_approval) return false;
      const ws = normalizeWorkflowStatus(task.workflow_status);
      if (ws !== "approved") return false;
      if (isAdmin || user?.roleId === "project_manager") return false;
      const projectPermission = getProjectPermissionForTask(task);
      const isReviewer = projectPermission
        ? projectPermission.project_role === "project_owner" || projectPermission.project_role === "project_manager"
        : false;
      return !isReviewer;
    },
    [getProjectPermissionForTask, isAdmin, projectById, user?.roleId]
  );

  const canEditRow = useCallback(
    (task: Task) => {
      const baseAllowed = canEditTaskRow({
        hasBaseEditPermission: canEditTask,
        task,
        project: task.project_id ? projectById.get(String(task.project_id)) ?? null : null,
        viewerEmail: currentUserEmail,
        viewerRoleId: user?.roleId ?? null,
      });
      if (!baseAllowed) return false;
      if (isAdmin) return true;
      // Onay sonrası kilit: yetkili olmayan kullanıcı approved satırı düzenleyemez.
      if (isRowLockedByApproval(task)) return false;
      const automationState = rowAutomationStateByTaskId.get(task.id);
      if (automationState?.locked && user?.roleId !== "project_manager") return false;

      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_edit : baseAllowed;
    },
    [canEditTask, currentUserEmail, getProjectPermissionForTask, isAdmin, isRowLockedByApproval, projectById, rowAutomationStateByTaskId, user?.roleId]
  );

  const canCommentRow = useCallback(
    (task: Task) => {
      if (!canCommentTask || !canEditRow(task)) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_comment : true;
    },
    [canCommentTask, canEditRow, getProjectPermissionForTask, isAdmin]
  );

  const canCopyRow = useCallback(
    (task: Task) => {
      if (!canCopyCell) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_copy : true;
    },
    [canCopyCell, getProjectPermissionForTask, isAdmin]
  );

  const canBulkUpdateRow = useCallback(
    (task: Task) => {
      if (!canBulkUpdate || !canEditRow(task)) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_bulk_update : true;
    },
    [canBulkUpdate, canEditRow, getProjectPermissionForTask, isAdmin]
  );

  const canBulkDeleteRow = useCallback(
    (task: Task) => {
      if (!canBulkDelete || !canEditRow(task)) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_bulk_delete : true;
    },
    [canBulkDelete, canEditRow, getProjectPermissionForTask, isAdmin]
  );

  const canExportRow = useCallback(
    (task: Task) => {
      if (!canExportCsv) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      if (projectPermission) return projectPermission.can_view && projectPermission.can_export;
      return canExportAllRows ? true : canEditRow(task);
    },
    [canEditRow, canExportAllRows, canExportCsv, getProjectPermissionForTask, isAdmin]
  );

  const canExportUnmaskedRow = useCallback(
    (task: Task) => {
      if (!canExportSensitiveUnmasked) return false;
      if (isAdmin) return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.can_view && projectPermission.can_export_unmasked : true;
    },
    [canExportSensitiveUnmasked, getProjectPermissionForTask, isAdmin]
  );

  const logSensitivePolicyDecision = useCallback(
    async ({
      fieldKey,
      action,
      legacyDecision,
      task,
      context,
      projectId,
    }: {
      fieldKey: string;
      action: "view" | "edit" | "copy" | "export_masked" | "export_unmasked";
      legacyDecision: "allow" | "deny";
      task?: Task | null;
      context?: Record<string, unknown>;
      projectId?: string | null;
    }) => {
      if (!user?.id || !user?.email) return;
      const resolvedProjectId =
        projectId != null
          ? projectId
          : task?.project_id
            ? String(task.project_id)
            : null;
      const policy = await evaluateSensitivePolicy({
        fieldKey,
        action,
        roleId: user?.roleId ?? "member",
        projectId: resolvedProjectId,
      });
      await logSensitivePolicyShadow({
        userId: user.id,
        userEmail: user.email,
        fieldName: fieldKey,
        action,
        legacyDecision,
        policyDecision: policy.decision,
        policyId: policy.policyId,
        enforced: false,
        context: {
          ...(context ?? {}),
          projectId: resolvedProjectId,
          reasonRequired: policy.reasonRequired,
          policyPriority: policy.priority,
        },
      });
    },
    [user?.id, user?.email, user?.roleId]
  );

  const trackSensitiveViewShadow = useCallback(
    (task: Task, fieldKey: string) => {
      const nowMs = Date.now();
      const dedupeKey = `${task.id}:${fieldKey}:${user?.id ?? "anon"}`;
      const lastSeenAt = sensitiveViewShadowSeenAtRef.current.get(dedupeKey) ?? 0;
      if (nowMs - lastSeenAt < 30000) return;
      sensitiveViewShadowSeenAtRef.current.set(dedupeKey, nowMs);
      void logSensitivePolicyDecision({
        fieldKey,
        action: "view",
        legacyDecision: canViewSensitiveCells ? "allow" : "deny",
        task,
        context: { source: "table-hover-view" },
      });
    },
    [canViewSensitiveCells, logSensitivePolicyDecision, user?.id]
  );

  const isProjectWorkflowEnabled = useCallback(
    (task: Task) => {
      const project = task.project_id ? projectById.get(String(task.project_id)) ?? null : null;
      return project?.workflow_enabled === true;
    },
    [projectById]
  );

  const canReviewWorkflowRow = useCallback(
    (task: Task) => {
      if (!isProjectWorkflowEnabled(task)) return false;
      if (isAdmin || user?.roleId === "project_manager") return true;
      const projectPermission = getProjectPermissionForTask(task);
      return projectPermission ? projectPermission.project_role === "project_owner" || projectPermission.project_role === "project_manager" : false;
    },
    [getProjectPermissionForTask, isAdmin, isProjectWorkflowEnabled, user?.roleId]
  );

  const getWorkflowActionsForTask = useCallback(
    (task: Task): TaskWorkflowAction[] => {
      if (!isProjectWorkflowEnabled(task)) return [];
      const workflowStatus = normalizeWorkflowStatus(task.workflow_status);
      const project = task.project_id ? projectById.get(String(task.project_id)) ?? null : null;
      const lockActive = project?.lock_on_approval === true && workflowStatus === "approved";
      const rowCanEdit = canEditRow(task);
      const canReview = canReviewWorkflowRow(task);
      const actions: TaskWorkflowAction[] = [];
      // "Kontrole gönder" yalnızca iş başlamışsa görünür (status kind != "todo").
      // Yapılacak statüsündeki bir satır kontrole gönderilemez — önce "Devam"a alınmalı.
      const statusKind = getStatusKind(task.status ?? null);
      const submitGateOpen = statusKind !== "todo";
      if (
        rowCanEdit &&
        submitGateOpen &&
        (workflowStatus === "draft" || workflowStatus === "revision_requested" || workflowStatus === "rejected")
      ) {
        actions.push("submit");
      }
      if (canReview && workflowStatus === "submitted") {
        actions.push("approve", "request_revision", "reject");
      }
      // Approved + lock_on_approval:
      //   - Yetkili (reviewer) "Kilidi aç" görür.
      //   - Yetkisi olmayan (üye dahil) "Kilit açma talep et" görür.
      if (lockActive && canReview) {
        actions.push("unlock");
      } else if (lockActive && !canReview) {
        actions.push("unlock_request");
      }
      // 'reset' (Taslağa al): kilitli durumda gizlenir; kilit kapalıyken edit/review yetkili görür.
      if (!lockActive && (rowCanEdit || canReview) && workflowStatus !== "draft") {
        actions.push("reset");
      }
      return actions;
    },
    [canEditRow, canReviewWorkflowRow, isProjectWorkflowEnabled, projectById]
  );

  const handleWorkflowAction = useCallback(
    async (task: Task, action: TaskWorkflowAction) => {
      if (!isProjectWorkflowEnabled(task)) return;

      // Revize iste / Reddet / Kilit açma talep et aksiyonlarında zorunlu açıklama notu al.
      let note: string | null = null;
      if (action === "request_revision" || action === "reject" || action === "unlock_request") {
        const titleByAction =
          action === "reject" ? "Reddet" :
          action === "request_revision" ? "Revize İste" :
          "Kilit Açma Talep Et";
        const messageByAction =
          action === "reject"
            ? "Ret nedenini ve düzeltilmesi gereken noktaları yazın. Bu not satırı gönderen üyeye iletilecek."
            : action === "request_revision"
              ? "Revize nedenini ve düzeltilmesi gerekenleri yazın. Bu not satırı gönderen üyeye iletilecek."
              : "Kilidin neden açılması gerektiğini yazın. Bu talep proje yetkilisine iletilecek; kilidi onlar açacaktır.";
        const placeholderByAction =
          action === "reject"
            ? "Örn. Eksik belge — fatura kopyası eklenmemiş."
            : action === "request_revision"
              ? "Örn. Tarih alanı yanlış; lütfen güncelleyip tekrar gönderin."
              : "Örn. Tutar bilgisi hatalı, satırı tekrar düzenlemem gerekiyor.";
        const confirmLabelByAction =
          action === "reject" ? "Reddet" :
          action === "request_revision" ? "Revize iste" :
          "Talep gönder";
        const result = await promptUser({
          title: titleByAction,
          message: messageByAction,
          placeholder: placeholderByAction,
          confirmLabel: confirmLabelByAction,
          required: true,
          multiline: true,
          rows: 4,
        });
        if (result == null || !result.trim()) {
          // Kullanıcı vazgeçti — hiçbir değişiklik uygulanmaz.
          return;
        }
        note = result.trim();
      }

      // Kilit açma talebi: satır statüsü DEĞİŞMEZ — sadece event log + bildirim.
      if (action === "unlock_request") {
        const fromStatus = normalizeWorkflowStatus(task.workflow_status);
        void logTaskWorkflowEvent({
          taskId: task.id,
          projectId: task.project_id ?? null,
          fromStatus,
          toStatus: fromStatus, // statü aynı kalır (approved)
          action: "unlock_request",
          actorEmail: user?.email ?? null,
          note,
        });
        void notifyWorkflowEvent({
          taskId: task.id,
          action: "unlock_request",
          toStatus: fromStatus,
          note,
        }).then((res) => {
          if (res === "error") {
            toast.warning("Bildirim gönderilemedi");
          }
        });
        toast.success("Kilit açma talebi gönderildi");
        return;
      }

      const fromStatus = normalizeWorkflowStatus(task.workflow_status);
      const toStatus = nextWorkflowStatus(action);
      const nowIso = new Date().toISOString();
      const patch: Partial<Task> = {
        workflow_status: toStatus,
        last_updated_by: user?.email ?? "anon",
      };
      if (action === "submit") {
        patch.workflow_submitted_at = nowIso;
        patch.workflow_reviewed_at = null;
        patch.workflow_reviewed_by = null;
      } else if (action === "approve" || action === "request_revision" || action === "reject") {
        patch.workflow_reviewed_at = nowIso;
        patch.workflow_reviewed_by = user?.email ?? null;
        // Onay/durum bağlama: onaylandığında satır resmen tamamlanmış sayılır;
        // reddedildiğinde / revize istendiğinde üye işine devam etmeli.
        // Eğer mevcut status zaten doğru "kind"deyse dokunma (kullanıcı özel
        // status etiketi kullanıyor olabilir).
        if (action === "approve" && !isStatusDone(task.status ?? null)) {
          patch.status = "Tamamlandı";
        } else if (
          (action === "request_revision" || action === "reject") &&
          !isStatusInProgress(task.status ?? null)
        ) {
          patch.status = "Devam";
        }
      } else if (action === "reset") {
        patch.workflow_submitted_at = null;
        patch.workflow_reviewed_at = null;
        patch.workflow_reviewed_by = null;
      } else if (action === "unlock") {
        // Kilidi aç: satır draft'a döner, gönderim/inceleme zaman damgaları sıfırlanır.
        // Denetim için workflow_reviewed_by'a kilidi açanın e-postası yazılır.
        patch.workflow_submitted_at = null;
        patch.workflow_reviewed_at = nowIso;
        patch.workflow_reviewed_by = user?.email ?? null;
      }
      updateTaskOptimistic(task.id, patch);
      const result = await saveTask(task.id, patch);
      if (!result.ok) {
        toast.error(result.message);
        await fetchTasks();
        return;
      }
      void logTaskWorkflowEvent({
        taskId: task.id,
        projectId: task.project_id ?? null,
        fromStatus,
        toStatus,
        action,
        actorEmail: user?.email ?? null,
        note,
      });

      // Bildirim: submit/approve/request_revision/reject/unlock. 'reset' için bildirim yok.
      if (
        action === "submit" ||
        action === "approve" ||
        action === "request_revision" ||
        action === "reject" ||
        action === "unlock"
      ) {
        void notifyWorkflowEvent({
          taskId: task.id,
          action,
          toStatus,
          note,
        }).then((result) => {
          // "missing_rpc" → migration uygulanmamış; sessizce geç (workflow geçişi yine de tamam).
          // "error" → gerçek bir hata; kullanıcıyı uyar ama workflow geri alma yok.
          if (result === "error") {
            toast.warning("Bildirim gönderilemedi");
          }
        });
      }

      toast.success(WORKFLOW_ACTION_LABELS[action]);
    },
    [fetchTasks, isProjectWorkflowEnabled, promptUser, saveTask, toast, updateTaskOptimistic, user?.email]
  );

  useEffect(() => {
    if (!canExportSensitiveUnmasked && exportUnmaskSensitive) {
      setExportUnmaskSensitive(false);
    }
  }, [canExportSensitiveUnmasked, exportUnmaskSensitive]);

  useEffect(() => {
    setSavedReportTemplates(loadSavedReportTemplates(currentUserEmail));
  }, [currentUserEmail]);

  useEffect(() => {
    let cancelled = false;
    void listManagedReportTemplates()
      .then((templates) => {
        if (!cancelled) setManagedReportTemplates(templates);
      })
      .catch(() => {
        if (!cancelled) setManagedReportTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listSavedViews("live_table")
      .then((views) => {
        if (!cancelled) setReportSavedViews(views);
      })
      .catch(() => {
        if (!cancelled) setReportSavedViews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Kurumsal kimlik (logo / kurum adı / footer) — şablonlarda kullanılır
  useEffect(() => {
    let cancelled = false;
    void fetchOrgBranding().then((value) => {
      if (!cancelled) setOrgBranding(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Proje filtresi seçenekleri: RLS'ten gelen tüm görünür projeler, ada göre sıralı. */
  const projectFilterOptions = useMemo(() => {
    return projects
      .map((p) => ({ id: p.id, name: (p.name ?? "").trim() || "(adsız proje)" }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [projects]);
  const hasProjectLinkedTasks = tasks.some(
    (task) => task.project_id != null && String(task.project_id).trim() !== ""
  );
  const requiresSingleProjectSelection =
    projectFilter.length !== 1 && (projectFilterOptions.length > 0 || hasProjectLinkedTasks);
  const projectSelectionTitle =
    projectFilter.length === 0 ? "Canlı tablo için proje seçin" : "Tek proje seçin";
  const projectSelectionDescription =
    projectFilter.length === 0
      ? "Farklı proje tablolarının kolonları birbirine karışmasın diye doğrudan açılışta tablo birleştirilmiyor. Bir proje seçtiğinizde sadece o projenin satırları ve kolonları gösterilir."
      : "Seçili projelerin kolon yapıları farklı olabilir. Veri karışmasını önlemek için Canlı Tablo özel kolonları tek proje seçildiğinde açılır.";

  /** Görünmez olan projelerin filtre seçimini temizle (proje silinirse vb.).
   *  ÖNEMLİ: projects henüz yüklenmediyse (projectFilterOptions boş) bu
   *  cleanup'ı ÇALIŞTIRMA — yoksa localStorage'tan hydrate edilen filtre,
   *  proje listesi gelmeden "geçersiz" sayılıp silinir ve kalıcılık bozulur. */
  useEffect(() => {
    if (projectFilter.length === 0) return;
    if (projectFilterOptions.length === 0) return; // projeler hâlâ yükleniyor olabilir
    const validIds = new Set(projectFilterOptions.map((p) => p.id));
    const valid = projectFilter.filter((id) => validIds.has(id));
    if (valid.length !== projectFilter.length) setProjectFilter(valid);
  }, [projectFilter, projectFilterOptions]);

  /** Atanan dropdown: tüm görünür projelerdeki atananlar. */
  const assigneeFilterOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      (p.assigned_emails ?? []).forEach((e) => {
        const v = String(e).trim();
        if (v) set.add(v);
      });
    });
    return Array.from(set).sort();
  }, [projects]);

  useEffect(() => {
    if (Array.isArray(assigneeFilter) && assigneeFilter.length > 0 && assigneeFilterOptions.length > 0) {
      const valid = assigneeFilter.filter((a) => assigneeFilterOptions.includes(a));
      if (valid.length !== assigneeFilter.length) {
        setAssigneeFilter(valid);
      }
    }
  }, [assigneeFilter, assigneeFilterOptions]);

  /**
   * Extra (dinamik) sütun kapsamı — Canlı Tablo karmaşası fix'i:
   *
   *  - Proje filtresi aktifse, sütun seti seçili projelerin görev verilerinden
   *    + seçili projelerin schema'larından (extra_column_keys) oluşur:
   *    kullanıcı bilinçli olarak o projeye odaklanmıştır, schema'sını proaktif
   *    görmek faydalıdır (Öneri 1 + #4).
   *  - Filtre yokken: yalnızca en az bir görevde değeri olan anahtarlar
   *    görünür (Öneri 2: schema-only kalabalık küresel tabloyu kirletmesin).
   *
   *  Sonuç: yeni bir projenin schema tanımı diğer projeleri kirletmez, ama
   *  o projeyi filtreleyince schema'sı görünür.
   */
  const scopedProjectIdSet = useMemo(
    () => (projectFilter.length === 1 ? new Set(projectFilter) : null),
    [projectFilter]
  );

  const scopedTasksForSchema = useMemo(() => {
    if (scopedProjectIdSet == null) return tasks;
    return tasks.filter(
      (t) => t.project_id != null && scopedProjectIdSet.has(String(t.project_id))
    );
  }, [tasks, scopedProjectIdSet]);

  /** Filtre aktifken seçili projelerin schema'sı (proje formundaki "Canlı tablo ek sütunları"). */
  const scopedProjectSchemaKeys = useMemo(() => {
    if (scopedProjectIdSet == null) return new Set<string>();
    const out = new Set<string>();
    projects.forEach((p) => {
      if (!scopedProjectIdSet.has(p.id)) return;
      for (const k of p.extra_column_keys ?? []) {
        const key = String(k ?? "").trim();
        if (key) out.add(key);
      }
    });
    return out;
  }, [projects, scopedProjectIdSet]);

  const extraDataKeys = useMemo(() => {
    if (requiresSingleProjectSelection) return [];
    const keys = new Set<string>(scopedProjectSchemaKeys);
    scopedTasksForSchema.forEach((t) => {
      if (t.extra_data && typeof t.extra_data === "object") {
        for (const [k, v] of Object.entries(t.extra_data)) {
          if (k == null || String(k).trim() === "") continue;
          if (INTERNAL_EXTRA_DATA_KEYS.has(k)) continue;
          // Filtre yoksa: sadece değer içeren anahtarlar (küresel tablo temizliği)
          // Filtre varsa: tüm anahtarlar dahil (kullanıcı projeye odaklı)
          if (scopedProjectIdSet != null || String(v ?? "").trim() !== "") {
            keys.add(k);
          }
        }
      }
    });
    return Array.from(keys).sort();
  }, [requiresSingleProjectSelection, scopedTasksForSchema, scopedProjectSchemaKeys, scopedProjectIdSet]);

  const activeReferenceColumns = useMemo(() => {
    const source =
      Array.isArray(projectFilter) && projectFilter.length === 1
        ? projectColumnsByProjectId[projectFilter[0]] ?? []
        : Object.values(projectColumnsByProjectId).flat();
    return source.filter((col) => (col.config.reference?.records?.length ?? 0) > 0);
  }, [projectColumnsByProjectId, projectFilter]);

  const advancedFilterFieldOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [
      { id: "content", label: COLUMN_VISIBILITY_LABELS.content ?? "Açıklama" },
      { id: "status", label: COLUMN_VISIBILITY_LABELS.status ?? "Durum" },
      { id: "workflow", label: COLUMN_VISIBILITY_LABELS.workflow ?? "Onay" },
      { id: "assignee", label: "Atanan" },
      { id: "priority", label: "Öncelik" },
      { id: "due_date", label: "Son tarih" },
    ];
    for (const k of extraDataKeys) {
      opts.push({ id: `extra:${k}`, label: k });
    }
    return opts;
  }, [extraDataKeys]);

  const activeAdvancedFilterRuleCount = useMemo(
    () => advancedFilterRules.filter(advancedFilterRuleIsActive).length,
    [advancedFilterRules]
  );

  /**
   * Gelişmiş filtrede tek bir aktif kural varsa, o alana göre otomatik A-Z sırala.
   * Aynı değere sahip satırlar yan yana gelir (ör. İl başlar A → Adana, Adana, Ankara…).
   * Kullanıcı manuel sort yaparsa veya farklı bir alana geçerse buradaki ref takip eder
   * ve aynı alanı tekrar tekrar uygulamaz; başka alan seçildiğinde ya da rule eklenince
   * yeniden uygulanır.
   */
  const autoSortedFieldRef = useRef<string | null>(null);
  useEffect(() => {
    const active = advancedFilterRules.filter(advancedFilterRuleIsActive);
    if (active.length === 1) {
      const field = active[0].field;
      if (field !== autoSortedFieldRef.current) {
        autoSortedFieldRef.current = field;
        setSorting([{ id: field, desc: false }]);
      }
    } else {
      autoSortedFieldRef.current = null;
    }
  }, [advancedFilterRules]);

  /** Aynı commit içinde önce varsayılan state ile kayıt tetiklenmesin (localStorage'ı silmesin). */
  const skipNextLiveTablePersistRef = useRef(false);
  const liveTableHydratedUserRef = useRef<string | null>(null);
  /** Sürükleyerek genişletilen sütunlar: bunlar veri değişince otomatik ölçeklenmez */
  const userSizedColumnsRef = useRef<Set<string>>(new Set());
  const liveTableScrollRef = useRef<HTMLDivElement>(null);
  /** Mobil kart listesi scroll konteyneri — sayfa değişiminde başa sarmak için. */
  const mobileListScrollRef = useRef<HTMLDivElement>(null);
  const [liveTableViewportWidth, setLiveTableViewportWidth] = useState(0);
  const userIdForPrefs = user?.id ?? null;

  useEffect(() => {
    const dynamicIds = extraDataKeys.map((k) => `extra:${k}`);

    if (!userIdForPrefs) {
      liveTableHydratedUserRef.current = null;
      userSizedColumnsRef.current.clear();
      setColumnOrder((prev) => mergeColumnOrderWithDynamics(prev, dynamicIds));
      return;
    }

    if (liveTableHydratedUserRef.current !== userIdForPrefs) {
      liveTableHydratedUserRef.current = userIdForPrefs;
      userSizedColumnsRef.current.clear();
      skipNextLiveTablePersistRef.current = true;
      const saved = loadLiveTablePrefs(userIdForPrefs);
      setColumnOrder(mergeColumnOrderWithDynamics(saved?.columnOrder, dynamicIds));
      setColumnVisibility(
        saved != null ? (saved.columnVisibility ?? {}) : DEFAULT_LIVE_TABLE_COLUMN_VISIBILITY
      );
      setColumnPinning(saved?.columnPinning ?? { left: [], right: [] });
      if (saved?.columnSizing && Object.keys(saved.columnSizing).length > 0) {
        for (const id of Object.keys(saved.columnSizing)) {
          userSizedColumnsRef.current.add(id);
        }
        setColumnSizing((prev) => ({ ...prev, ...saved.columnSizing }));
      }
      if (saved?.sorting && saved.sorting.length > 0) {
        setSorting(saved.sorting);
      }
      // Filtre state'lerini hydrate et (sayfa yenileme sonrası korunsun).
      // projectFilter parent component tarafından ayrı bir localStorage
      // anahtarıyla yönetiliyor; buradan dokunmuyoruz.
      const f = saved?.filters;
      if (f) {
        setGlobalSearch(f.globalSearch);
        setProjectLinkedFilter(f.projectLinkedFilter);
        setStatusFilter(f.statusFilter);
        setAssigneeFilter(f.assigneeFilter);
        setDateFrom(f.dateFrom);
        setDateTo(f.dateTo);
        setDatePreset(f.datePreset);
        setColumnFilters(f.columnFilters);
        setAdvancedFilterRules(f.advancedFilterRules as AdvancedFilterRule[]);
      }
      return;
    }

    setColumnOrder((prev) => mergeColumnOrderWithDynamics(prev, dynamicIds));
  }, [userIdForPrefs, extraDataKeys]);

  /**
   * Tüm prefs'i tek dosyada tutmak için ortak helper: mevcut bütünsel
   * snapshot'ı döndür. NOT: projectFilter parent component tarafından
   * ayrı bir localStorage anahtarıyla yönetiliyor; burada yer almaz.
   */
  const buildCurrentPrefs = useCallback((): LiveTablePersistedPrefs => ({
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    sorting,
    filters: {
      globalSearch,
      projectLinkedFilter,
      statusFilter,
      assigneeFilter,
      projectFilter: [],
      dateFrom,
      dateTo,
      datePreset,
      columnFilters,
      advancedFilterRules,
    },
  }), [
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    sorting,
    globalSearch,
    projectLinkedFilter,
    statusFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
  ]);

  /**
   * Filtre değişiklikleri ANINDA yazılır (debounce yok).
   */
  useEffect(() => {
    if (!userIdForPrefs) return;
    if (skipNextLiveTablePersistRef.current) {
      skipNextLiveTablePersistRef.current = false;
      return;
    }
    saveLiveTablePrefs(userIdForPrefs, buildCurrentPrefs());
  }, [
    userIdForPrefs,
    globalSearch,
    projectLinkedFilter,
    statusFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    buildCurrentPrefs,
  ]);

  /**
   * Kolon yerleşim/sıralama gibi rapid-fire (resize sırasında onlarca event)
   * değişiklikler 250ms debounce ile yazılır. Bekleyen kayıt unmount'ta flush
   * edilir (aşağıdaki useEffect).
   */
  const pendingPrefsSaveRef = useRef<{ userId: string; payload: LiveTablePersistedPrefs } | null>(null);
  useEffect(() => {
    if (!userIdForPrefs) return;
    if (skipNextLiveTablePersistRef.current) return;
    const payload = buildCurrentPrefs();
    pendingPrefsSaveRef.current = { userId: userIdForPrefs, payload };
    const t = window.setTimeout(() => {
      saveLiveTablePrefs(userIdForPrefs, payload);
      pendingPrefsSaveRef.current = null;
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    userIdForPrefs,
    columnVisibility,
    columnOrder,
    columnPinning,
    columnSizing,
    sorting,
    buildCurrentPrefs,
  ]);

  /**
   * Bileşen unmount edildiğinde veya tarayıcı sekmesi kapatılırken bekleyen
   * debounced kayıt iptal edilirdi; bunun yerine son hesaplanan paketi
   * senkron olarak localStorage'a yaz. Böylece "filtre seç → hızlıca sayfayı
   * değiştir / yenile" senaryosunda da kayıt kaybolmaz.
   */
  useEffect(() => {
    const flush = () => {
      const pending = pendingPrefsSaveRef.current;
      if (pending) {
        saveLiveTablePrefs(pending.userId, pending.payload);
        pendingPrefsSaveRef.current = null;
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", flush);
      window.addEventListener("pagehide", flush);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", flush);
        window.removeEventListener("pagehide", flush);
      }
      flush();
    };
  }, []);

  const filteredData = useMemo(
    () => {
      if (requiresSingleProjectSelection) return [];
      return filterLiveTableTasks({
        tasks,
        projectLinkedFilter,
        projectFilter,
        globalSearch,
        statusFilter,
        assigneeFilter,
        dateFrom,
        dateTo,
        columnFilters,
        advancedFilterRules,
        chipResolver,
        rowChipValues,
        chipCatalog,
      });
    },
    [
      tasks,
      projectLinkedFilter,
      projectFilter,
      requiresSingleProjectSelection,
      globalSearch,
      statusFilter,
      assigneeFilter,
      dateFrom,
      dateTo,
      chipResolver,
      rowChipValues,
      chipCatalog,
      columnFilters,
      advancedFilterRules,
    ]
  );

  const spotlightRules = useMemo(
    () => automationRules.filter((rule) => rule.enabled && parseSpotlightDescriptor(rule).length > 0),
    [automationRules]
  );
  const spotlightRulesByPriority = useMemo(
    () =>
      [...spotlightRules].sort((a, b) => {
        const byPriority = (a.priority ?? 0) - (b.priority ?? 0);
        if (byPriority !== 0) return byPriority;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [spotlightRules]
  );
  const spotlightMatchByTaskId = useMemo(() => {
    const matches = new Map<string, {
      ruleId: string;
      ruleName: string;
      priority: number;
      descriptor: SpotlightDescriptor;
    }>();
    if (!spotlightEnabled || spotlightRulesByPriority.length === 0) return matches;
    for (const task of filteredData) {
      for (const rule of spotlightRulesByPriority) {
        if (!ruleMatchesTask(rule, task, { rowChipValues, catalog: chipCatalog })) continue;
        const descriptors = parseSpotlightDescriptor(rule).filter((descriptor) =>
          isSpotlightDescriptorActive(descriptor, spotlightNowMs)
        );
        if (descriptors.length === 0) continue;
        const matchedDescriptor = descriptors.find((descriptor) => {
          const value = normalizeSpotlightToken(taskValueForSpotlight(task, descriptor.columnKey));
          if (!value) return false;
          return descriptor.values.some((candidate) => normalizeSpotlightToken(candidate) === value);
        });
        if (!matchedDescriptor) continue;
        matches.set(task.id, {
          ruleId: rule.id,
          ruleName: rule.name,
          priority: rule.priority ?? 0,
          descriptor: matchedDescriptor,
        });
        break;
      }
    }
    return matches;
  }, [chipCatalog, filteredData, rowChipValues, spotlightEnabled, spotlightNowMs, spotlightRulesByPriority]);
  const spotlightTaskIds = useMemo(
    () => new Set(Array.from(spotlightMatchByTaskId.keys())),
    [spotlightMatchByTaskId]
  );

  const spotlightActive = spotlightEnabled && spotlightTaskIds.size > 0;
  const spotlightRuleHitSummary = useMemo(() => {
    const counts = new Map<string, { ruleId: string; ruleName: string; priority: number; count: number }>();
    for (const match of Array.from(spotlightMatchByTaskId.values())) {
      const current = counts.get(match.ruleId);
      if (current) current.count += 1;
      else counts.set(match.ruleId, { ruleId: match.ruleId, ruleName: match.ruleName, priority: match.priority, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => {
      const byPriority = a.priority - b.priority;
      if (byPriority !== 0) return byPriority;
      return b.count - a.count;
    });
  }, [spotlightMatchByTaskId]);
  const spotlightSummary = useMemo(() => {
    if (!spotlightActive || spotlightRuleHitSummary.length === 0) return null;
    const dominantRule = spotlightRuleHitSummary[0];
    const dominantMatch = Array.from(spotlightMatchByTaskId.values()).find((match) => match.ruleId === dominantRule.ruleId) ?? null;
    if (!dominantMatch) return null;
    const first = dominantMatch.descriptor;
    let remainingLabel: string | null = null;
    if (first.endsAt) {
      const remainMs = new Date(first.endsAt).getTime() - spotlightNowMs;
      if (Number.isFinite(remainMs) && remainMs > 0) {
        const remainMin = Math.max(1, Math.ceil(remainMs / 60000));
        remainingLabel = remainMin >= 60
          ? `${Math.floor(remainMin / 60)}s ${remainMin % 60}dk`
          : `${remainMin}dk`;
      }
    }
    return {
      label: `${first.columnKey}: ${first.values.join(", ")}`,
      ruleName: dominantRule.ruleName,
      additionalRuleCount: Math.max(0, spotlightRuleHitSummary.length - 1),
      highlightedCount: spotlightTaskIds.size,
      remainingLabel,
    };
  }, [spotlightActive, spotlightMatchByTaskId, spotlightNowMs, spotlightRuleHitSummary, spotlightTaskIds.size]);

  const getExportRows = useCallback(
    (scope: PdfExportScope) => {
      const baseRows = scope === "all" ? tasks : filteredData;
      return baseRows.filter((task) => canExportRow(task));
    },
    [canExportRow, filteredData, tasks]
  );

  /** Satır güncellemesi `data` referansını değiştirir; TanStack varsayılanında sayfa 0'a sıçrar — kapatıyoruz. */
  const maxPageIndex = useMemo(
    () => Math.max(0, Math.ceil(filteredData.length / pagination.pageSize) - 1),
    [filteredData.length, pagination.pageSize]
  );

  useEffect(() => {
    if (pagination.pageIndex > maxPageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
    }
  }, [maxPageIndex, pagination.pageIndex]);

  /**
   * Sayfa değişiminde liste konteynerini başa sar — kullanıcı yeni sayfayı en üstten
   * okur (önceki sayfanın son satırına yapışık kalmasın). Hem mobil hem desktop.
   * pageSize değişiminde de baş döndürür çünkü görünür satırlar değişir.
   */
  useEffect(() => {
    const opts: ScrollToOptions = { top: 0, behavior: "smooth" };
    liveTableScrollRef.current?.scrollTo(opts);
    mobileListScrollRef.current?.scrollTo(opts);
  }, [pagination.pageIndex, pagination.pageSize]);

  /** Kullanıcının açıkça seçtiği filtre sayısı (varsayılan "projeye bağlı göster" sayılmaz) */
  const activeFilterCount = useMemo(
    () =>
      countActiveLiveTableFilters({
        globalSearch,
        statusFilter,
        assigneeFilter,
        projectFilter,
        dateFrom,
        dateTo,
        datePreset,
        columnFilters,
        activeAdvancedFilterRuleCount,
      }),
    [
      globalSearch,
      statusFilter,
      assigneeFilter,
      projectFilter,
      dateFrom,
      dateTo,
      datePreset,
      columnFilters,
      activeAdvancedFilterRuleCount,
    ]
  );

  const resolveProjectContextFromSavedFilters = useCallback(
    (savedProjectFilter: unknown): string[] => {
      if (!Array.isArray(savedProjectFilter)) return projectFilter;
      const validSavedProjects = savedProjectFilter.filter(
        (id): id is string => typeof id === "string" && id.trim() !== ""
      );
      if (validSavedProjects.length > 0) return validSavedProjects;
      return projectFilter;
    },
    [projectFilter]
  );

  const clearFilters = useCallback(() => {
    setProjectLinkedFilter("tümü");
    setGlobalSearch("");
    setStatusFilter([]);
    setAssigneeFilter([]);
    setDateFrom("");
    setDateTo("");
    setDatePreset("custom");
    setColumnFilters({});
    setAdvancedFilterRules([]);
    setActiveSmartFilter(null);
  }, []);

  /**
   * SavedViews entegrasyonu:
   * - getCurrentViewConfig: mevcut filtre+sıralama+kolon görünümünü snapshot olarak ver
   * - applyViewConfig: kaydedilmiş bir görünümü uygula (state setter'larını çağırır)
   */
  const getCurrentViewConfig = useCallback((): SavedViewConfig => {
    return {
      version: 1,
      filters: {
        globalSearch,
        projectLinkedFilter,
        statusFilter,
        assigneeFilter,
        projectFilter,
        dateFrom,
        dateTo,
        datePreset,
        columnFilters,
        advancedFilterRules,
      },
      sort: sorting.map((s) => ({ id: s.id, desc: s.desc })),
      columns: {
        visibility: { ...columnVisibility } as Record<string, boolean>,
        order: [...columnOrder],
        pinning: {
          left: columnPinning.left ?? [],
          right: columnPinning.right ?? [],
        },
      },
    };
  }, [
    globalSearch,
    projectLinkedFilter,
    statusFilter,
    assigneeFilter,
    projectFilter,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    sorting,
    columnVisibility,
    columnOrder,
    columnPinning,
  ]);

  const applyViewConfig = useCallback((config: SavedViewConfig) => {
    const f = config.filters ?? {};
    setGlobalSearch(typeof f.globalSearch === "string" ? f.globalSearch : "");
    setProjectLinkedFilter(f.projectLinkedFilter === "proje" ? "proje" : "tümü");
    setStatusFilter(Array.isArray(f.statusFilter) ? f.statusFilter : []);
    setAssigneeFilter(Array.isArray(f.assigneeFilter) ? f.assigneeFilter : []);
    setProjectFilter(resolveProjectContextFromSavedFilters(f.projectFilter));
    setDateFrom(typeof f.dateFrom === "string" ? f.dateFrom : "");
    setDateTo(typeof f.dateTo === "string" ? f.dateTo : "");
    setDatePreset(typeof f.datePreset === "string" ? f.datePreset : "custom");
    setColumnFilters(f.columnFilters && typeof f.columnFilters === "object" ? f.columnFilters : {});
    setAdvancedFilterRules(Array.isArray(f.advancedFilterRules) ? (f.advancedFilterRules as AdvancedFilterRule[]) : []);
    if (Array.isArray(config.sort) && config.sort.length > 0) {
      setSorting(config.sort);
    }
    const c = config.columns;
    if (c?.visibility) setColumnVisibility(c.visibility);
    if (Array.isArray(c?.order) && c.order.length > 0) setColumnOrder(c.order);
    if (c?.pinning) {
      setColumnPinning({
        left: c.pinning.left ?? [],
        right: c.pinning.right ?? [],
      });
    }
  }, [resolveProjectContextFromSavedFilters, setProjectFilter]);

  const lastAppliedProjectDefaultRef = useRef<string | null>(null);
  const [syncActiveViewId, setSyncActiveViewId] = useState<string | null>(null);

  /** Tek proje seçildiğinde proje varsayılan görünümünü otomatik uygula. */
  useEffect(() => {
    const projectId = projectFilter.length === 1 ? projectFilter[0] : null;
    if (!projectId) {
      lastAppliedProjectDefaultRef.current = null;
      return;
    }
    if (lastAppliedProjectDefaultRef.current === projectId) return;

    let cancelled = false;
    void getProjectDefaultSavedView(projectId).then((view) => {
      if (cancelled) return;
      lastAppliedProjectDefaultRef.current = projectId;
      if (!view) return;
      applyViewConfig(view.config);
      setSyncActiveViewId(view.id);
      toast.info(`"${view.name}" proje varsayılan görünümü uygulandı`);
    });
    return () => {
      cancelled = true;
    };
  }, [projectFilter, applyViewConfig, toast]);

  const applyFilterConfigPatch = useCallback((filters?: SavedViewConfig["filters"]) => {
    if (!filters) return;
    const has = (key: keyof NonNullable<SavedViewConfig["filters"]>) =>
      Object.prototype.hasOwnProperty.call(filters, key);

    if (has("globalSearch")) setGlobalSearch(typeof filters.globalSearch === "string" ? filters.globalSearch : "");
    if (has("projectLinkedFilter")) setProjectLinkedFilter(filters.projectLinkedFilter === "proje" ? "proje" : "tümü");
    if (has("statusFilter")) setStatusFilter(Array.isArray(filters.statusFilter) ? filters.statusFilter : []);
    if (has("assigneeFilter")) setAssigneeFilter(Array.isArray(filters.assigneeFilter) ? filters.assigneeFilter : []);
    if (has("projectFilter")) setProjectFilter(resolveProjectContextFromSavedFilters(filters.projectFilter));
    if (has("dateFrom")) setDateFrom(typeof filters.dateFrom === "string" ? filters.dateFrom : "");
    if (has("dateTo")) setDateTo(typeof filters.dateTo === "string" ? filters.dateTo : "");
    if (has("datePreset")) setDatePreset(typeof filters.datePreset === "string" ? filters.datePreset : "custom");
    if (has("columnFilters")) {
      const patch = filters.columnFilters && typeof filters.columnFilters === "object" ? filters.columnFilters : {};
      setColumnFilters((prev) => ({ ...prev, ...patch }));
    }
    if (has("advancedFilterRules")) {
      setAdvancedFilterRules(Array.isArray(filters.advancedFilterRules) ? (filters.advancedFilterRules as AdvancedFilterRule[]) : []);
    }
  }, [resolveProjectContextFromSavedFilters, setProjectFilter]);

  /** Komut paleti eylemlerini dinle */
  useEffect(() => {
    const openNew = () => {
      if (canCreateTask) setNewTaskOpen(true);
    };
    const clear = () => clearFilters();
    window.addEventListener("commandpalette:newTask", openNew);
    window.addEventListener("commandpalette:clearFilters", clear);
    return () => {
      window.removeEventListener("commandpalette:newTask", openNew);
      window.removeEventListener("commandpalette:clearFilters", clear);
    };
  }, [canCreateTask, clearFilters]);

  // Sütun için benzersiz değerleri hesapla
  const getUniqueValuesForColumn = useCallback((columnId: string): string[] => {
    const values = new Set<string>();
    // 1) Görevlerden gerçek değerleri topla — chip-bound kolonlarda resolved label kullanılır
    tasks.forEach((t) => {
      let cellValue: string = "";
      if (columnId === "content") cellValue = t.content ?? "";
      else if (columnId === "status") cellValue = t.status ?? "";
      else if (columnId === "assignee") cellValue = t.assignee ?? "";
      else if (columnId === "priority") cellValue = t.priority ?? "";
      else if (columnId === "due_date") cellValue = t.due_date ?? "";
      else if (columnId.startsWith("extra:")) {
        const extraKey = columnId.replace("extra:", "");
        // Chip-bound override: resolved label varsa onu kullan
        const chipLabel = chipResolver(t, extraKey);
        if (chipLabel != null) {
          cellValue = chipLabel;
        } else if (t.extra_data) {
          cellValue = String(t.extra_data[extraKey] ?? "");
        }
      }
      if (cellValue && cellValue.trim()) {
        values.add(cellValue.trim());
      }
    });
    // 2) Chip-bound bir kolonsa, henüz hiç görevde kullanılmamış option'ları da ekle
    //    (kullanıcı "Kritik Risk" gibi var ama atanmamış olanları seçip filtre koyabilsin)
    if (columnId.startsWith("extra:")) {
      const extraKey = columnId.replace("extra:", "");
      // Görünen görevlerin proje ID'leri (her projede ayrı binding olabilir)
      const projectIds = new Set<string>();
      for (const t of tasks) {
        if (t.project_id) projectIds.add(String(t.project_id));
      }
      Array.from(projectIds).forEach((projectId) => {
        const options = getChipOptionsForColumn(projectId, extraKey, chipCatalog);
        options.forEach((opt) => values.add(opt.label));
      });
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, "tr"));
  }, [tasks, chipResolver, chipCatalog]);

  // Sütun filtresi toggle
  const toggleColumnFilterValue = useCallback((columnId: string, value: string) => {
    setColumnFilters((prev) => {
      const current = prev[columnId] || [];
      if (current.includes(value)) {
        return { ...prev, [columnId]: current.filter((v) => v !== value) };
      } else {
        return { ...prev, [columnId]: [...current, value] };
      }
    });
  }, []);

  // Sütun filtresini temizle
  const clearColumnFilter = useCallback((columnId: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  }, []);

  // Gelişmiş Tarih Filtreleri
  const applyDatePreset = useCallback((preset: string) => {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    
    setDatePreset(preset);
    
    switch (preset) {
      case "today":
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "tomorrow":
        const yarin = new Date(bugun);
        yarin.setDate(yarin.getDate() + 1);
        setDateFrom(yarin.toISOString().split("T")[0]);
        setDateTo(yarin.toISOString().split("T")[0]);
        break;
      case "thisWeek":
        const haftaSonu = new Date(bugun);
        haftaSonu.setDate(bugun.getDate() + 7);
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(haftaSonu.toISOString().split("T")[0]);
        break;
      case "nextWeek":
        const gelecekHaftaBas = new Date(bugun);
        gelecekHaftaBas.setDate(bugun.getDate() + 7);
        const gelecekHaftaSon = new Date(bugun);
        gelecekHaftaSon.setDate(bugun.getDate() + 14);
        setDateFrom(gelecekHaftaBas.toISOString().split("T")[0]);
        setDateTo(gelecekHaftaSon.toISOString().split("T")[0]);
        break;
      case "thisMonth":
        const ayBas = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
        const aySon = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 0);
        setDateFrom(ayBas.toISOString().split("T")[0]);
        setDateTo(aySon.toISOString().split("T")[0]);
        break;
      case "nextMonth":
        const gelecekAyBas = new Date(bugun.getFullYear(), bugun.getMonth() + 1, 1);
        const gelecekAySon = new Date(bugun.getFullYear(), bugun.getMonth() + 2, 0);
        setDateFrom(gelecekAyBas.toISOString().split("T")[0]);
        setDateTo(gelecekAySon.toISOString().split("T")[0]);
        break;
      case "last7days":
        const yediGunOnce = new Date(bugun);
        yediGunOnce.setDate(bugun.getDate() - 7);
        setDateFrom(yediGunOnce.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "last30days":
        const otuzGunOnce = new Date(bugun);
        otuzGunOnce.setDate(bugun.getDate() - 30);
        setDateFrom(otuzGunOnce.toISOString().split("T")[0]);
        setDateTo(bugun.toISOString().split("T")[0]);
        break;
      case "custom":
        // Manuel tarih seçimi için boş bırak
        setDateFrom("");
        setDateTo("");
        break;
      default:
        setDateFrom("");
        setDateTo("");
    }
  }, []);

  // Akıllı Filtreler
  const applySmartFilter = useCallback((filterType: "overdue" | "thisWeek" | "priority" | "mine" | "unassigned") => {
    // Aynı filtreye tekrar tıklanırsa toggle (kapat)
    if (activeSmartFilter === filterType) {
      clearFilters();
      return;
    }
    clearFilters();
    setActiveSmartFilter(filterType);
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const haftaSonu = new Date(bugun);
    haftaSonu.setDate(bugun.getDate() + 7);

    switch (filterType) {
      case "overdue":
        // Gecikmiş: bitiş tarihi bugünden önce
        const dun = new Date(bugun);
        dun.setDate(dun.getDate() - 1);
        setDateTo(dun.toISOString().split("T")[0]);
        break;
      case "thisWeek":
        // Bu hafta bitenler
        setDateFrom(bugun.toISOString().split("T")[0]);
        setDateTo(haftaSonu.toISOString().split("T")[0]);
        break;
      case "priority": {
        // Öncelikli = projenin önceliği acil set'inde olan projeleri filtrele
        // (Görev Özeti'ndeki "Acil öncelik" KPI'ı ile aynı kural).
        const urgentProjectIds = projects
          .filter((p) => isUrgentPriorityValue(p.priority, urgentPrioritySetForTable))
          .map((p) => p.id);
        if (urgentProjectIds.length > 0) {
          setProjectFilter(urgentProjectIds);
        }
        break;
      }
      case "mine":
        // Bana atanan
        if (currentUserEmail) {
          setAssigneeFilter([currentUserEmail]);
        }
        break;
      case "unassigned":
        // Atanmamış (boş assignee) - özel değer
        setAssigneeFilter(["__unassigned__"]);
        break;
    }
  }, [activeSmartFilter, clearFilters, currentUserEmail, projects, urgentPrioritySetForTable, setProjectFilter]);

  // Akıllı filtre sayıları
  // Kapsam: Görev Özeti ile aynı sabit kural — projesi olmayan ("orphan") görevler
  // HER ZAMAN hariç + aktif proje filtresi. Toolbar'daki `projectLinkedFilter` ("Tümü")
  // moduna bağlanmaz; aksi halde Görev Özeti ile sayılar tutmaz (kullanıcı toolbar'da
  // "Tümü"ye geçtiğinde orphan görevler özette görünmez ama hızlı filtrelerde sayılırdı).
  const smartFilterCounts = useMemo(
    () =>
      getSmartFilterCounts({
        tasks,
        projectFilter,
        projectById,
        urgentPrioritySet: urgentPrioritySetForTable,
        currentUserEmail,
      }),
    [tasks, currentUserEmail, projectById, urgentPrioritySetForTable, projectFilter]
  );

  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    setDraggedColumnId(columnId);
    e.dataTransfer.setData("text/plain", columnId);
    e.dataTransfer.effectAllowed = "move";
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetId) return;
    setColumnOrder((prev) => {
      const order = [...prev];
      const from = order.indexOf(draggedColumnId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to, 0, draggedColumnId);
      return order;
    });
    setDraggedColumnId(null);
  }, [draggedColumnId]);
  const handleDragEnd = useCallback(() => setDraggedColumnId(null), []);
  const pinColumn = useCallback((columnId: string, side: "left" | "right" | "unpin") => {
    setColumnPinning((prev) => {
      const left = (prev.left ?? []).filter((id) => id !== columnId);
      const right = (prev.right ?? []).filter((id) => id !== columnId);
      if (side === "left") return { left: [...left, columnId], right };
      if (side === "right") return { left, right: [...right, columnId] };
      return { left, right };
    });
  }, []);

  const handleSave = useCallback(
    (taskId: string, patch: Partial<Task>) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !canEditRow(task)) {
        toast.error("Bu satırı düzenleme yetkiniz yok.");
        return;
      }
      updateTaskOptimistic(taskId, patch);
      void saveTask(taskId, patch).then((r) => {
        if (!r.ok) toast.error(r.message);
      });
    },
    [canEditRow, tasks, updateTaskOptimistic, saveTask, toast]
  );

  const handleNewTask = useCallback(
    async (data: TaskFormData) => {
      const formattedExtraData = normalizeExtraDataBySmartRules(data.extra_data);
      if (formattedExtraData.errors.length > 0) {
        toast.error(formattedExtraData.errors[0].message);
        throw new Error(formattedExtraData.errors[0].message);
      }
      await createTask({
        content: data.content,
        status: data.status,
        assignee: data.assignee || null,
        priority: data.priority ?? null,
        extra_data: formattedExtraData.data,
      });
    },
    [createTask, toast]
  );

  /**
   * "Boş satır" kriteri — kullanıcının doldurmadan bıraktığı hızlı-ekleme satırlarını yakalar.
   * Sadece TÜM kullanıcı alanları boşsa true (yanlışlıkla gerçek görev silmemek için sıkı).
   */
  const isEmptyTaskRow = useCallback((t: Task): boolean => {
    if ((t.content ?? "").trim() !== "") return false;
    if ((t.assignee ?? "").trim() !== "") return false;
    if ((t.priority ?? "").trim() !== "") return false;
    if ((t.due_date ?? "").trim() !== "") return false;
    const ex = t.extra_data;
    if (ex && typeof ex === "object") {
      for (const v of Object.values(ex)) {
        if (String(v ?? "").trim() !== "") return false;
      }
    }
    return true;
  }, []);

  const handleDeleteEmptyRows = useCallback(async () => {
    const emptyTasks = filteredData.filter((task) => isEmptyTaskRow(task) && canBulkDeleteRow(task));
    if (emptyTasks.length === 0) {
      toast.info("Mevcut görünümde silme yetkili boş satır yok.");
      return;
    }
    const ids = emptyTasks.map((t) => t.id);
    const backups = emptyTasks.map((t) => ({ ...t }));
    setDeletingIds((prev) => new Set([...Array.from(prev), ...ids]));
    try {
      await deleteTasks(ids);
      toast.success(`${ids.length} boş satır silindi`, {
        action: {
          label: "Geri al",
          onClick: async () => {
            try {
              await createTasksBulk(
                backups.map((b) => ({
                  content: b.content,
                  status: b.status,
                  assignee: b.assignee,
                  priority: b.priority,
                  project_id: b.project_id,
                  due_date: b.due_date,
                  extra_data: b.extra_data,
                }))
              );
              toast.success(`${backups.length} satır geri yüklendi`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Geri alınamadı");
            }
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Boş satırlar silinemedi");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [filteredData, isEmptyTaskRow, canBulkDeleteRow, deleteTasks, createTasksBulk, toast]);

  /**
   * Hızlı satır ekleme: boş içerikli görev yaratır, content hücresini odakla.
   * Tek proje filtreliyse o projenin altına bağlar; yoksa serbest (project_id=null).
   * Enter ile zincir devam eder.
   */
  const handleQuickAddRow = useCallback(async () => {
    if (!canCreateTask) return;
    try {
      const scopedProject =
        Array.isArray(projectFilter) && projectFilter.length === 1 ? projectFilter[0] : null;
      const newId = await createTask({
        content: "",
        status: "Yapılacak",
        assignee: null,
        priority: null,
        project_id: scopedProject,
      });
      if (newId) {
        setQuickAddFocusId(newId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Satır oluşturulamadı");
    }
  }, [canCreateTask, createTask, projectFilter, toast]);

  const activateEditableCell = useCallback((taskId: string, columnId: string) => {
    setActiveEditableCell((prev) =>
      prev?.taskId === taskId && prev.columnId === columnId ? prev : { taskId, columnId }
    );
    setEditingRow(taskId);
  }, [setEditingRow]);

  const isActiveEditableCell = useCallback(
    (taskId: string, columnId: string) =>
      activeEditableCell?.taskId === taskId && activeEditableCell.columnId === columnId,
    [activeEditableCell]
  );

  const scheduleEditableCellBlur = useCallback((taskId: string, columnId: string) => {
    window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('[data-live-editable-cell="true"]')) return;
      setActiveEditableCell((prev) =>
        prev?.taskId === taskId && prev.columnId === columnId ? null : prev
      );
      setEditingRow(null);
      if (quickAddFocusId === taskId) setQuickAddFocusId(null);
    }, 0);
  }, [quickAddFocusId, setEditingRow]);

  const focusNextEditableCell = useCallback((taskId: string, columnId: string) => {
    requestAnimationFrame(() => {
      if (columnId === "content" && quickAddFocusId === taskId) setQuickAddFocusId(null);
      const rowSelector = cssAttrValue(taskId);
      const columnSelector = cssAttrValue(columnId);
      const current = document.querySelector<HTMLElement>(
        `[data-live-editable-cell="true"][data-row-id="${rowSelector}"][data-col-id="${columnSelector}"]`
      );
      const row = current?.closest("tr");
      if (!row) return;

      const editableCells = Array.from(
        row.querySelectorAll<HTMLElement>('[data-live-editable-cell="true"]:not([data-disabled="true"])')
      );
      const currentIndex = editableCells.findIndex((el) => el.dataset.colId === columnId);
      const next = editableCells.slice(currentIndex + 1).find((el) => el.offsetParent !== null);
      if (!next) return;

      const nextColumnId = next.dataset.colId;
      if (nextColumnId) activateEditableCell(taskId, nextColumnId);
      next.focus();
      if (next instanceof HTMLButtonElement) next.click();
      if (next instanceof HTMLInputElement) next.select();
    });
  }, [activateEditableCell, quickAddFocusId]);

  const handleCSVImport = useCallback(
    async (
      imported: Array<{ content: string; status: string; assignee: string | null; priority?: string | null; extra_data?: Record<string, string> | null }>,
      replaceExisting: boolean
    ) => {
      if (replaceExisting && tasks.length > 0) {
        await deleteTasks(tasks.map((t) => t.id));
      }
      await createTasksBulk(imported);
    },
    [tasks, deleteTasks, createTasksBulk]
  );

  const handleEditSubmit = useCallback(
    async (data: TaskFormData) => {
      if (!editTask) return;
      if (!canEditRow(editTask)) {
        toast.error("Bu satırı düzenleme yetkiniz yok.");
        setEditTask(null);
        return;
      }
      const formattedExtraData = normalizeExtraDataBySmartRules(data.extra_data);
      if (formattedExtraData.errors.length > 0) {
        toast.error(formattedExtraData.errors[0].message);
        throw new Error(formattedExtraData.errors[0].message);
      }
      const patch = {
        content: data.content,
        status: data.status,
        assignee: data.assignee || null,
        priority: data.priority ?? null,
        extra_data: formattedExtraData.data,
      };
      updateTaskOptimistic(editTask.id, patch);
      const r = await saveTask(editTask.id, patch);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setEditTask(null);
      toast.success("Görev güncellendi");
    },
    [editTask, canEditRow, saveTask, updateTaskOptimistic, toast]
  );

  const handleCopyTask = useCallback(
    async (task: Task) => {
      await createTask({
        content: task.content + " (kopya)",
        status: task.status,
        assignee: task.assignee,
      });
    },
    [createTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      // Undo için önce mevcut görev verisini yakala
      const backup = tasks.find((t) => t.id === taskId);
      setDeletingIds((prev) => new Set(prev).add(taskId));
      try {
        await deleteTask(taskId);
        toast.success("Görev silindi", {
          action: backup
            ? {
                label: "Geri al",
                onClick: async () => {
                  try {
                    await createTask({
                      content: backup.content,
                      status: backup.status,
                      assignee: backup.assignee,
                      priority: backup.priority,
                      project_id: backup.project_id,
                      due_date: backup.due_date,
                      extra_data: backup.extra_data,
                    });
                    toast.success("Görev geri yüklendi");
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Geri alınamadı";
                    toast.error(msg);
                  }
                },
              }
            : undefined,
        });
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : typeof e === "object" && e !== null && "message" in e
              ? String((e as { message: unknown }).message)
              : "Görev silinemedi.";
        toast.error(msg);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [deleteTask, createTask, tasks, toast]
  );

  // Dinamik hücre düzenleme handler'ı
  const handleDynamicCellSave = useCallback((taskId: string, key: string, value: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (isSensitiveExtraColumnKey(key) && !isAdmin) {
      void logSensitivePolicyDecision({
        fieldKey: key,
        action: "edit",
        legacyDecision: "deny",
        task,
        context: { source: "dynamic-cell-save", reason: "non-admin-sensitive-block" },
      });
      toast.warning("Hassas alanlar sadece kopyalanabilir; düzenleme kapalı.");
      return;
    }
    if (isSensitiveExtraColumnKey(key)) {
      void logSensitivePolicyDecision({
        fieldKey: key,
        action: "edit",
        legacyDecision: "allow",
        task,
        context: { source: "dynamic-cell-save" },
      });
    }
    const formattedExtraData = normalizeExtraDataBySmartRules({ [key]: value });
    if (formattedExtraData.errors.length > 0) {
      toast.error(formattedExtraData.errors[0].message);
      return;
    }
    const nextValue = formattedExtraData.data?.[key] ?? "";
    const newExtraData = { ...(task.extra_data ?? {}), [key]: nextValue };
    handleSave(taskId, { extra_data: newExtraData });
  }, [tasks, handleSave, isAdmin, toast, logSensitivePolicyDecision]);

  const handleReferenceCellSave = useCallback(
    (taskId: string, key: string, value: string, column: ProjectColumn | null) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (isSensitiveExtraColumnKey(key) && !isAdmin) {
        void logSensitivePolicyDecision({
          fieldKey: key,
          action: "edit",
          legacyDecision: "deny",
          task,
          context: { source: "reference-cell-save", reason: "non-admin-sensitive-block" },
        });
        toast.warning("Hassas alanlar sadece kopyalanabilir; düzenleme kapalı.");
        return;
      }
      if (isSensitiveExtraColumnKey(key)) {
        void logSensitivePolicyDecision({
          fieldKey: key,
          action: "edit",
          legacyDecision: "allow",
          task,
          context: { source: "reference-cell-save" },
        });
      }
      const formattedExtraData = normalizeExtraDataBySmartRules({ [key]: value });
      if (formattedExtraData.errors.length > 0) {
        toast.error(formattedExtraData.errors[0].message);
        return;
      }

      const nextValue = formattedExtraData.data?.[key] ?? value.trim();
      const nextExtraData: Record<string, string> = { ...(task.extra_data ?? {}), [key]: nextValue };
      delete nextExtraData[REFERENCE_WARNINGS_KEY];
      const reference = column?.config.reference;
      const labelField = reference?.labelField;
      const records = reference?.records ?? [];
      const matchedRecord =
        labelField && nextValue
          ? records.find((record) => String(record[labelField] ?? "").trim() === nextValue)
          : null;

      if (matchedRecord) {
        const availableKeys = Array.from(new Set([...extraDataKeys, ...Object.keys(nextExtraData), key]));
        const warnings = referenceWarningsFromRecord(nextExtraData, matchedRecord, availableKeys, labelField);
        for (const [field, raw] of Object.entries(matchedRecord)) {
          const cellValue = String(raw ?? "").trim();
          if (!cellValue || field === labelField) continue;
          const targetKey = resolveReferenceTargetKey(field, availableKeys);
          if (!targetKey || targetKey === key) continue;
          nextExtraData[targetKey] = cellValue;
        }
        if (warnings.length > 0) {
          nextExtraData[REFERENCE_WARNINGS_KEY] = warnings.join(" | ");
          toast.warning("Referans kaydı bulundu ama satırda çelişen alanlar vardı; sistem değerleri referansa göre güncelledi.");
        }
      } else if (reference && nextValue) {
        toast.info("Seçilen değer için referans satırı bulunamadı. Sadece bu hücre kaydedildi.");
      }

      handleSave(taskId, { extra_data: nextExtraData });
    },
    [extraDataKeys, handleSave, isAdmin, tasks, toast, logSensitivePolicyDecision]
  );

  const columns = useMemo(
    () => [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <span className="flex items-center gap-1.5">
          <SelectAllCheckbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className={dui.rowCheckbox}
          />
          <span className={cn("font-medium text-slate-600 dark:text-slate-400", dui.selectHeaderSpan)}>Seçim</span>
        </span>
      ),
      cell: ({ row }) => {
        const editors = editorsByRowId.get(row.original.id) ?? [];
        const first = editors[0];
        const line =
          editors.length === 0
            ? null
            : editors.length === 1
              ? presenceEditorLines(first).primary
              : `${presenceEditorLines(first).primary} +${editors.length - 1}`;
        const editorsTooltip =
          editors.length === 0
            ? ""
            : editors
                .map((e) => {
                  const { primary, emailLine } = presenceEditorLines(e);
                  return emailLine ? `${primary} — ${emailLine}` : primary;
                })
                .join("\n");
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
              className={dui.rowCheckbox}
              aria-label="Satırı seç"
            />
            {line != null && (
              <Tooltip delayDuration={160}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex max-w-full cursor-default items-center gap-0.5 rounded px-0.5 text-left text-[10px] font-medium leading-tight text-violet-700 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-violet-400 dark:text-violet-300"
                    aria-label={`Düzenleyen: ${editors.map((e) => presenceEditorLines(e).primary).join(", ")}`}
                  >
                    <User className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                    <span className="min-w-0 truncate">{line}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={10}
                  className="z-[400] max-w-[min(20rem,calc(100vw-2rem))] border-2 border-violet-500 bg-violet-100 px-3 py-2.5 text-sm font-semibold text-violet-950 shadow-[0_8px_32px_rgba(0,0,0,0.18)] dark:border-violet-400 dark:bg-violet-900/95 dark:text-violet-50 md:text-base"
                >
                  <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                    Bu satırda düzenleme
                  </span>
                  <span className="mt-1.5 block whitespace-pre-line break-words text-[13px] font-semibold leading-snug md:text-sm">
                    {editorsTooltip}
                  </span>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
      size: 56,
      minSize: 48,
      maxSize: 140,
      enableResizing: false,
      enableHiding: false,
    }),
    columnHelper.display({
      id: "status",
      header: "Durum",
      sortingFn: (a, b) =>
        String(a.original.status ?? "").localeCompare(String(b.original.status ?? ""), "tr", {
          sensitivity: "base",
        }),
      cell: ({ row }) => {
        const task = row.original;
        const rowCanEdit = canEditRow(task);
        return (
          <StatusCell
            value={task.status ?? ""}
            taskId={task.id}
            onSave={handleSave}
            onFocus={() => rowCanEdit && setEditingRow(task.id)}
            onBlur={() => setEditingRow(null)}
            statusOptions={statusOptions}
            defaultTaskStatus={settings.defaultTaskStatus}
            density={tableDensity}
            template={tableTemplate}
            disabled={!rowCanEdit}
          />
        );
      },
      size: 140,
      minSize: 100,
      maxSize: 220,
      enableResizing: true,
      enableSorting: true,
    }),
    columnHelper.display({
      id: "workflow",
      header: "Onay",
      cell: ({ row }) => {
        const task = row.original;
        if (!isProjectWorkflowEnabled(task)) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
        }
        const workflowStatus = normalizeWorkflowStatus(task.workflow_status);
        const workflowActions = getWorkflowActionsForTask(task);
        const project = task.project_id ? projectById.get(String(task.project_id)) ?? null : null;
        const lockActive =
          project?.workflow_enabled === true &&
          project?.lock_on_approval === true &&
          workflowStatus === "approved";
        const isLockedForViewer = isRowLockedByApproval(task);
        // "Kontrole gönder" gizlendi mi (status="Yapılacak" yüzünden)?
        // Bu durumda kullanıcıya tooltip ile nedenini anlat.
        const rowCanEditForBadge = canEditRow(task);
        const submitWouldBeAllowed =
          rowCanEditForBadge &&
          (workflowStatus === "draft" || workflowStatus === "revision_requested" || workflowStatus === "rejected");
        const submitBlockedByStatus =
          submitWouldBeAllowed && getStatusKind(task.status ?? null) === "todo";
        const badge = (
          <span
            className={cn(
              "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm dark:font-bold",
              WORKFLOW_STATUS_CLASS[workflowStatus],
              workflowActions.length > 0 && "gap-1 cursor-pointer",
              lockActive && "gap-1"
            )}
            title={
              isLockedForViewer
                ? "Satır onaylandı ve kilitli — düzenlemek için proje yetkilisinin kilidi açması gerekir."
                : lockActive
                  ? `Onaylandı (kilitli). Son karar: ${task.workflow_reviewed_by ?? "—"}`
                  : submitBlockedByStatus
                    ? "Kontrole göndermek için önce durumu 'Devam'a alın (Yapılacak satır kontrole gönderilemez)."
                    : task.workflow_reviewed_by
                      ? `Son karar: ${task.workflow_reviewed_by}`
                      : task.workflow_submitted_at
                        ? `Kontrole gönderildi: ${new Date(task.workflow_submitted_at).toLocaleString("tr-TR")}`
                        : undefined
            }
          >
            {lockActive && <Lock className="h-3 w-3" aria-hidden />}
            {WORKFLOW_STATUS_LABELS[workflowStatus]}
            {workflowActions.length > 0 && <ChevronDown className="h-3 w-3" aria-hidden />}
          </span>
        );
        if (workflowActions.length === 0) return badge;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="max-w-full text-left">
                {badge}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {workflowActions.map((action) => (
                <DropdownMenuItem
                  key={action}
                  onClick={() => void handleWorkflowAction(task, action)}
                  className={cn(
                    action === "approve" && "text-emerald-700 focus:text-emerald-700 dark:text-emerald-300 dark:focus:text-emerald-300",
                    action === "reject" && "text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300",
                    action === "unlock" && "text-amber-700 focus:text-amber-700 dark:text-amber-300 dark:focus:text-amber-300",
                    action === "unlock_request" && "text-sky-700 focus:text-sky-700 dark:text-sky-300 dark:focus:text-sky-300"
                  )}
                >
                  {action === "unlock" && <Unlock className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                  {action === "unlock_request" && <Lock className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
                  {WORKFLOW_ACTION_LABELS[action]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 150,
      minSize: 120,
      maxSize: 220,
      enableResizing: true,
      enableSorting: true,
      sortingFn: (a, b) =>
        WORKFLOW_STATUS_LABELS[normalizeWorkflowStatus(a.original.workflow_status)].localeCompare(
          WORKFLOW_STATUS_LABELS[normalizeWorkflowStatus(b.original.workflow_status)],
          "tr",
          { sensitivity: "base" }
        ),
    }),
    columnHelper.display({
      id: "content",
      header: "Açıklama",
      sortingFn: (a, b) =>
        String(a.original.content ?? "").localeCompare(String(b.original.content ?? ""), "tr", {
          sensitivity: "base",
          numeric: true,
        }),
      cell: ({ row }) => {
        const task = row.original;
        const value = task.content ?? "";
        const link = task.extra_data?.[EXTRA_DATA_LINK_KEY];
        const showLink = link && isSafeUrl(link);
        const rowCanEdit = canEditRow(task);
        return (
          <div className="min-w-0 flex items-center gap-1.5" title={value || undefined}>
            <span className="min-w-0 flex-1">
              <EditableCell
                value={value}
                taskId={task.id}
                field="content"
                navigationColumnId="content"
                activeEdit={isActiveEditableCell(task.id, "content")}
                onSave={(id, patch) => {
                  if ("content" in patch) handleSave(id, patch);
                }}
                onFocus={() => rowCanEdit && activateEditableCell(task.id, "content")}
                onBlur={() => scheduleEditableCellBlur(task.id, "content")}
                density={tableDensity}
                autoEdit={rowCanEdit && quickAddFocusId === task.id}
                onChainEnter={
                  quickAddFocusId === task.id ? handleQuickAddRow : undefined
                }
                onNavigateNext={focusNextEditableCell}
                disabled={!rowCanEdit}
              />
            </span>
            {showLink && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                title={link}
                aria-label="Linki aç"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        );
      },
      size: 260,
      minSize: 180,
      maxSize: 480,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "project",
      header: "Proje",
      sortingFn: (a, b) => {
        const an = (projectById.get(String(a.original.project_id ?? ""))?.name ?? "").trim();
        const bn = (projectById.get(String(b.original.project_id ?? ""))?.name ?? "").trim();
        if (!an && !bn) return 0;
        if (!an) return 1;
        if (!bn) return -1;
        return an.localeCompare(bn, "tr", { sensitivity: "base" });
      },
      cell: ({ row }) => {
        const pid = row.original.project_id;
        if (!pid) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
        }
        const p = projectById.get(String(pid));
        const name = (p?.name ?? "").trim() || "(adsız proje)";
        return (
          <Link
            href={`/projeler/${pid}`}
            className="inline-flex max-w-full items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-50 hover:underline dark:text-blue-300 dark:hover:bg-blue-900/30"
            title={name}
          >
            <ListTodo className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{name}</span>
          </Link>
        );
      },
      size: 160,
      minSize: 120,
      maxSize: 280,
      enableResizing: true,
      enableSorting: true,
    }),
    ...extraDataKeys.map((key) =>
      columnHelper.accessor((row) => String(row.extra_data?.[key] ?? ""), {
        id: `extra:${key}`,
        header: key,
        /**
         * Display sütunları varsayılan olarak sıralanamaz; extra_data[key]
         * değerine bakan Türkçe-aware sortingFn ekliyoruz.
         * Adana, Adıyaman, Ağrı, Ankara, Antalya... gibi doğru alfabetik sıra.
         */
        sortingFn: (rowA, rowB) => {
          const a = String(rowA.original.extra_data?.[key] ?? "").trim();
          const b = String(rowB.original.extra_data?.[key] ?? "").trim();
          // Boşlar her zaman en sonda
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          const na = normalizeSortText(a);
          const nb = normalizeSortText(b);
          if (na !== nb) {
            return na.localeCompare(nb, "tr", { sensitivity: "base", numeric: true });
          }
          return a.localeCompare(b, "tr", { sensitivity: "base", numeric: true });
        },
        enableSorting: true,
        cell: ({ row }) => {
          const task = row.original;
          const value = task.extra_data?.[key] ?? "";
          const referenceWarning = String(task.extra_data?.[REFERENCE_WARNINGS_KEY] ?? "").trim();
          const taskId = task.id;
          const rowCanEdit = canEditRow(task);
          const sensitive = isSensitiveExtraColumnKey(key);
          const rowCanEditCell = rowCanEdit && (!sensitive || canViewSensitiveCells);
          const raw = String(value ?? "");
          const showCopy = raw.trim() !== "";
          const spotlightMatch = spotlightMatchByTaskId.get(taskId);
          const spotlightBadgeForCell = Boolean(
            spotlightActive &&
              spotlightMatch &&
              isSpotlightCellMatch(spotlightMatch.descriptor, key, raw)
          );
          const spotlightBadgeTone =
            spotlightMatch?.descriptor.badgeColor === "red"
              ? "red"
              : spotlightMatch?.descriptor.badgeColor === "amber"
                ? "amber"
                : spotlightMatch?.descriptor.badgeColor === "emerald"
                  ? "emerald"
                  : spotlightMatch?.descriptor.badgeColor === "blue"
                    ? "blue"
                    : spotlightMatch?.descriptor.badgeColor === "slate"
                      ? "slate"
                      : "purple";

          if (sensitive && !canViewSensitiveCells) {
            const restrictedDisplayValue =
              settings.piiSensitiveDisplayMode === "masked_copy"
                ? maskSensitiveExtraValue(raw)
                : "Gizli (kopyala)";
            return (
              <div
                className="group/extra-cell flex min-w-0 items-center gap-0.5"
                onMouseEnter={() => trackSensitiveViewShadow(task, key)}
              >
                {referenceWarning && (
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0 text-amber-500"
                    aria-label="Referans veri uyarısı"
                  >
                    <title>{referenceWarning}</title>
                  </AlertTriangle>
                )}
                <div className="min-w-0 flex-1">
                  <EditableCell
                    value={raw}
                    displayValue={restrictedDisplayValue}
                  highlightAsBadge={spotlightBadgeForCell}
                  highlightBadgeTone={spotlightBadgeTone}
                    taskId={taskId}
                    field={key}
                    navigationColumnId={`extra:${key}`}
                    activeEdit={false}
                    onSave={() => {}}
                    onFocus={() => {}}
                    onBlur={() => {}}
                    density={tableDensity}
                    onNavigateNext={focusNextEditableCell}
                    disabled
                  />
                </div>
                {showCopy && canCopyRow(task) && (
                  <ExtraCellCopyButton
                    text={raw}
                    density={tableDensity}
                    isSensitive
                    fieldName={key}
                    recordId={taskId}
                    projectId={task.project_id ? String(task.project_id) : null}
                    roleId={user?.roleId ?? null}
                  />
                )}
              </div>
            );
          }

          const normalizedExtraKey = key.trim().toLocaleLowerCase("tr");
          const candidateProjectIds = [
            task.project_id ? String(task.project_id) : "",
            ...(Array.isArray(projectFilter) && projectFilter.length === 1 ? [projectFilter[0]] : []),
          ].filter(Boolean);
          const typedColumn =
            candidateProjectIds
              .map((projectId) =>
                projectColumnsByProjectId[projectId]?.find(
                  (col) => col.key.trim().toLocaleLowerCase("tr") === normalizedExtraKey
                )
              )
              .find(Boolean) ??
            Object.values(projectColumnsByProjectId)
              .flat()
              .find((col) => col.key.trim().toLocaleLowerCase("tr") === normalizedExtraKey) ??
            null;
          const typedReference = typedColumn?.config.reference;
          // Canlı bağlantı: sourceId varsa referenceSources'tan en güncel kayıtları al;
          // yoksa eski snapshot (config.reference.records) fallback.
          const liveReferenceSource = typedReference?.sourceId
            ? referenceSources.find((s) => s.id === typedReference.sourceId)
            : null;
          const typedRecords = liveReferenceSource
            ? liveReferenceSource.records
            : typedReference?.records ?? [];

          // Büyük referans listelerde cross-ref filter çok pahalı (her hücre × her render).
          // 500+ kayıt varsa filter'ı atla; kullanıcı dropdown'a yazarak kendi filtreyi yapsın.
          const LARGE_REF_THRESHOLD = 500;
          const skipCrossRefFilter = typedRecords.length >= LARGE_REF_THRESHOLD;

          const filteredReferenceRecords =
            typedReference?.labelField && typedRecords.length > 0
              ? skipCrossRefFilter
                ? typedRecords
                : typedRecords.filter((record) => {
                    for (const [field, recordValue] of Object.entries(record)) {
                      if (field === typedReference.labelField) continue;
                      const targetKey = resolveReferenceTargetKey(field, extraDataKeys);
                      if (!targetKey || targetKey === key) continue;
                      const currentValue = String(task.extra_data?.[targetKey] ?? "").trim();
                      if (currentValue && !valuesMatch(currentValue, recordValue)) return false;
                    }
                    return true;
                  })
              : [];

          // Büyük listede sort + Set + sort pahalı; sadece label'ları toplayıp ham veriyle dön.
          // ReferenceSelectCell zaten kendi içinde filter + slice yapıyor.
          const typedOptions =
            typedReference?.labelField && filteredReferenceRecords.length > 0
              ? skipCrossRefFilter
                ? // Büyük liste: dedup ve sort atla — string array olarak ver, cell içinde gerekiyorsa filtrelenir
                  filteredReferenceRecords
                    .map((record) => String(record[typedReference.labelField] ?? "").trim())
                    .filter(Boolean)
                : Array.from(
                    new Set(
                      filteredReferenceRecords
                        .map((record) => String(record[typedReference.labelField] ?? "").trim())
                        .filter(Boolean)
                    )
                  ).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }))
              : typedColumn?.config.options?.filter(Boolean) ?? [];
          const chipBinding =
            candidateProjectIds
              .map((projectId) =>
                chipCatalog.bindings.find(
                  (binding) =>
                    binding.projectId === projectId &&
                    binding.columnKey.trim().toLocaleLowerCase("tr") === normalizedExtraKey
                )
              )
              .find(Boolean) ?? null;
          if (chipBinding) {
            const chipTemplate = chipCatalog.templates.find((template) => template.id === chipBinding.templateId) ?? null;
            const chipOptions = chipCatalog.options.filter((option) => option.templateId === chipBinding.templateId);
            const chipRow = rowChipValues.find(
              (item) => item.taskId === taskId && item.templateId === chipBinding.templateId
            );
            if (chipTemplate && chipOptions.length > 0) {
              const chipDisabled = !rowCanEdit || (chipTemplate.managerOnly && !canManageSensitiveChips);
              return (
                <div className="flex min-w-0 items-center gap-1">
                  {referenceWarning && (
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0 text-amber-500"
                      aria-label="Referans veri uyarısı"
                    >
                      <title>{referenceWarning}</title>
                    </AlertTriangle>
                  )}
                  <ChipSelectCell
                    template={chipTemplate}
                    options={chipOptions}
                    value={chipRow?.optionId ?? ""}
                    disabled={chipDisabled}
                    spotlight={spotlightActive && spotlightTaskIds.has(taskId)}
                    onChange={(optionId) => {
                      void (async () => {
                        try {
                          const next = await setRowChipValue({
                            taskId,
                            templateId: chipTemplate.id,
                            optionId,
                            source: "manual",
                          });
                          setRowChipValues((prev) => [
                            ...prev.filter(
                              (item) => !(item.taskId === taskId && item.templateId === chipTemplate.id)
                            ),
                            next,
                          ]);
                          toast.success("Çip güncellendi");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Çip güncellenemedi.");
                        }
                      })();
                    }}
                  />
                </div>
              );
            }
          }
          // Checkbox için: "yapıldı", "tamamlandı", "done", "completed", "ok", "✓"
          const isCheckbox = /^(yapıldı|yapildi|tamamlandı|tamamlandi|done|completed|ok|✓|x|check)$/i.test(key);
          if (isCheckbox) {
            const checked = /^(1|true|yes|evet|✓|x)$/i.test(value);
            return (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!rowCanEditCell}
                  onChange={(e) => handleDynamicCellSave(taskId, key, e.target.checked ? "✓" : "")}
                  className={dui.rowCheckbox}
                />
              </label>
            );
          }
          // Dropdown için: "durum", "status", "öncelik", "priority"
          const isDropdown = /^(durum|status|öncelik|oncelik|priority)$/i.test(key);
          if (isDropdown) {
            const options = /öncelik|priority/i.test(key) 
              ? ["High", "Medium", "Low"] 
              : ["Yapılacak", "Devam ediyor", "Tamamlandı"];
            return (
              <select
                value={value}
                disabled={!rowCanEditCell}
                onChange={(e) => handleDynamicCellSave(taskId, key, e.target.value)}
                className={cn(
                  "w-full rounded border border-slate-200 bg-white px-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100",
                  tableDensity === "compact" && "py-0.5 text-xs",
                  tableDensity === "normal" && "py-1 text-sm",
                  tableDensity === "comfortable" && "py-2 text-base"
                )}
              >
                <option value="">—</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            );
          }
          if (typedColumn && (typedColumn.type === "select" || typedColumn.type === "multi_select") && typedOptions.length > 0) {
            return (
              <div className="flex min-w-0 items-center gap-1">
                {referenceWarning && (
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0 text-amber-500"
                    aria-label="Referans veri uyarısı"
                  >
                    <title>{referenceWarning}</title>
                  </AlertTriangle>
                )}
                <ReferenceSelectCell
                  value={String(value ?? "")}
                  options={typedOptions}
                  disabled={!rowCanEditCell}
                  density={tableDensity}
                  title={typedColumn.config.reference ? `${typedColumn.config.reference.sourceName} kaynağından` : undefined}
                  onSave={(nextValue) => handleReferenceCellSave(taskId, key, nextValue, typedColumn)}
                />
              </div>
            );
          }
          // Inline editable text + hover ile kopyala (TCKN/sicil: maskeli gösterim)
          const masked = sensitive ? maskSensitiveExtraValue(raw) : raw;

          return (
            <div
              className="group/extra-cell flex min-w-0 items-center gap-0.5"
              onMouseEnter={() => {
                if (sensitive) trackSensitiveViewShadow(task, key);
              }}
            >
              {referenceWarning && (
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0 text-amber-500"
                  aria-label="Referans veri uyarısı"
                >
                  <title>{referenceWarning}</title>
                </AlertTriangle>
              )}
              <div className="min-w-0 flex-1">
                <EditableCell
                  value={raw}
                  displayValue={sensitive ? masked : undefined}
                  highlightAsBadge={spotlightBadgeForCell}
                  highlightBadgeTone={spotlightBadgeTone}
                  taskId={taskId}
                  field={key}
                  navigationColumnId={`extra:${key}`}
                  activeEdit={isActiveEditableCell(taskId, `extra:${key}`)}
                  onSave={(id, patch) => {
                    if (key in patch) {
                      handleDynamicCellSave(id, key, String(patch[key] ?? ""));
                    }
                  }}
                  onFocus={() => rowCanEditCell && activateEditableCell(taskId, `extra:${key}`)}
                  onBlur={() => scheduleEditableCellBlur(taskId, `extra:${key}`)}
                  density={tableDensity}
                  onNavigateNext={focusNextEditableCell}
                  disabled={!rowCanEditCell}
                />
              </div>
              {showCopy && canCopyRow(task) && (
                <ExtraCellCopyButton
                  text={raw}
                  density={tableDensity}
                  isSensitive={sensitive}
                  fieldName={key}
                  recordId={taskId}
                  projectId={task.project_id ? String(task.project_id) : null}
                  roleId={user?.roleId ?? null}
                />
              )}
            </div>
          );
        },
        size: 150,
        minSize: 80,
        maxSize: 400,
        enableResizing: true,
      })
    ),
    columnHelper.display({
      id: "actions",
      header: "İşlemler",
      cell: ({ row }) => {
        const task = row.original;
        const isDeleting = deletingIds.has(task.id);
        const rowCanEdit = canEditRow(task);
        const workflowActions = getWorkflowActionsForTask(task);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className={cn(dui.actionsBtn, "shrink-0")} aria-label="Menü">
                <MoreHorizontal className={cn(dui.sortIcon, "shrink-0")} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {rowCanEdit && (
                <DropdownMenuItem onClick={() => setDetailTask(task)}>
                  <MessageSquare className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Detay / Yorumlar
                </DropdownMenuItem>
              )}
              {rowCanEdit && (
                <DropdownMenuItem onClick={() => setEditTask(task)}>Düzenle</DropdownMenuItem>
              )}
              {rowCanEdit && canCreateTask && canCopyRow(task) && (
                <DropdownMenuItem onClick={() => handleCopyTask(task)}>Kopyala</DropdownMenuItem>
              )}
              {workflowActions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {workflowActions.map((action) => (
                    <DropdownMenuItem
                      key={action}
                      onClick={() => void handleWorkflowAction(task, action)}
                      className={cn(
                        action === "approve" && "text-emerald-700 focus:text-emerald-700 dark:text-emerald-300 dark:focus:text-emerald-300",
                        action === "reject" && "text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300"
                      )}
                    >
                      {WORKFLOW_ACTION_LABELS[action]}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {rowCanEdit && (canCreateTask || canEditTask) && canDeleteTask && <DropdownMenuSeparator />}
              {rowCanEdit && canDeleteTask && (
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => handleDeleteTask(task.id)}
                  disabled={isDeleting}
                >
                  Sil
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 52,
      minSize: 44,
      maxSize: 80,
      enableResizing: false,
    }),
    ],
    [
      handleSave,
      statusOptions,
      tableDensity,
      dui,
      extraDataKeys,
      handleDynamicCellSave,
      handleReferenceCellSave,
      activateEditableCell,
      isActiveEditableCell,
      scheduleEditableCellBlur,
      focusNextEditableCell,
      handleQuickAddRow,
      quickAddFocusId,
      deletingIds,
      editorsByRowId,
      canEditRow,
      getWorkflowActionsForTask,
      handleWorkflowAction,
      isProjectWorkflowEnabled,
      canCopyRow,
      canCreateTask,
      canEditTask,
      canDeleteTask,
      handleCopyTask,
      handleDeleteTask,
      setEditingRow,
      setEditTask,
      settings.defaultTaskStatus,
      projectById,
      projectColumnsByProjectId,
      projectFilter,
      chipCatalog,
      rowChipValues,
      canManageSensitiveChips,
      canViewSensitiveCells,
      toast,
    ]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        for (const key of Object.keys(next)) {
          if (next[key] !== old[key]) userSizedColumnsRef.current.add(key);
        }
        return next;
      });
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { rowSelection, columnVisibility, columnOrder, columnPinning, columnSizing, sorting, pagination },
    enableRowSelection: true,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enablePinning: true,
    enableSorting: true,
    autoResetPageIndex: false,
    manualPagination: false,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
  });

  // Klavye sayfa navigasyonu — global event'leri dinleyip table API'sini çağır
  useEffect(() => {
    const prev = () => {
      if (table.getCanPreviousPage()) table.previousPage();
    };
    const next = () => {
      if (table.getCanNextPage()) table.nextPage();
    };
    const first = () => table.setPageIndex(0);
    const last = () => table.setPageIndex(Math.max(0, table.getPageCount() - 1));
    window.addEventListener("taskstable:prevPage", prev);
    window.addEventListener("taskstable:nextPage", next);
    window.addEventListener("taskstable:firstPage", first);
    window.addEventListener("taskstable:lastPage", last);
    return () => {
      window.removeEventListener("taskstable:prevPage", prev);
      window.removeEventListener("taskstable:nextPage", next);
      window.removeEventListener("taskstable:firstPage", first);
      window.removeEventListener("taskstable:lastPage", last);
    };
  }, [table]);

  /**
   * Canlı Tablo klavye kısayolları (Sprint 3.3):
   *  E → dışa aktar · F → hızlı filtre paneli · Shift+F → genişlet/daralt
   *  J/K → sonraki/önceki görev (sheet kapalıyken; açıkken TaskDetailSheet devralır)
   *  [ ] Home End → sayfa gezinmesi · Esc (genişletilmişken) → daralt
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable === true;
      const noMod = !e.metaKey && !e.ctrlKey && !e.altKey;

      if (e.key === "Escape" && isFullWidth) {
        e.preventDefault();
        setIsFullWidth(false);
        return;
      }

      const modalOpen =
        exportDialogOpen ||
        pdfDialogOpen ||
        emailDialogOpen ||
        importOpen ||
        newTaskOpen ||
        !!editTask ||
        advancedFilterOpen ||
        bulkDeleteConfirmOpen;
      if (modalOpen) return;
      if (isTyping) return;

      if (noMod && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setIsFullWidth((p) => !p);
        return;
      }

      if (noMod && !e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setQuickFiltersOpen((p) => !p);
        return;
      }

      if (noMod && !e.shiftKey && (e.key === "e" || e.key === "E") && canExportCsv) {
        e.preventDefault();
        setExportDialogOpen(true);
        return;
      }

      if (noMod && !e.shiftKey && !detailTask && (e.key === "j" || e.key === "J" || e.key === "k" || e.key === "K")) {
        const orderedTasks = table.getSortedRowModel().rows.map((r) => r.original);
        if (orderedTasks.length === 0) return;
        const selectedIds = table.getSelectedRowModel().rows.map((r) => r.id);
        const anchorId =
          navAnchorTaskIdRef.current ??
          (selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null);
        const idx = anchorId ? orderedTasks.findIndex((task) => task.id === anchorId) : -1;
        const isNext = e.key === "j" || e.key === "J";
        const nextIdx =
          idx < 0
            ? isNext
              ? 0
              : orderedTasks.length - 1
            : isNext
              ? Math.min(idx + 1, orderedTasks.length - 1)
              : Math.max(idx - 1, 0);
        if (nextIdx === idx && idx >= 0) return;
        const target = orderedTasks[nextIdx];
        if (!target) return;
        e.preventDefault();
        navAnchorTaskIdRef.current = target.id;
        setDetailTask(target);
        return;
      }

      if (noMod) {
        if (e.key === "[" || e.key === ",") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:prevPage"));
          return;
        }
        if (e.key === "]" || e.key === ".") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:nextPage"));
          return;
        }
        if (e.key === "Home") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:firstPage"));
          return;
        }
        if (e.key === "End") {
          e.preventDefault();
          window.dispatchEvent(new Event("taskstable:lastPage"));
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    table,
    isFullWidth,
    exportDialogOpen,
    pdfDialogOpen,
    emailDialogOpen,
    importOpen,
    newTaskOpen,
    editTask,
    advancedFilterOpen,
    bulkDeleteConfirmOpen,
    canExportCsv,
    detailTask,
  ]);

  const liveTableVisibleKey = useMemo(() => {
    const vis = Object.keys(columnVisibility)
      .sort()
      .map((k) => `${k}:${columnVisibility[k] === false ? "0" : "1"}`)
      .join(",");
    return `${columnOrder.join(",")}|${vis}|${extraDataKeys.join(",")}`;
  }, [columnOrder, columnVisibility, extraDataKeys]);

  useLayoutEffect(() => {
    if (isLoading || error) return;
    const el = liveTableScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect.width ?? 0;
      setLiveTableViewportWidth(Math.floor(cr));
    });
    ro.observe(el);
    setLiveTableViewportWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [isLoading, error, isFullWidth]);

  /**
   * "İçeriğe göre ölçeklendir" toggle:
   *  - KAPALI → AÇIK: Görünür sütunlar her birinin en uzun metnine göre genişler (viewport'a sığması
   *    zorlanmaz — gerekiyorsa yatay scroll çıkar). Sütunlar "user-sized" işaretlenir ki otomatik
   *    yeniden dengeleme effect'i bu manuel boyutları ezmesin.
   *  - AÇIK → KAPALI: Manuel boyutlar sıfırlanır, mevcut dengeli (viewport'a sığdır) davranış uygulanır.
   */
  const [fitToContent, setFitToContent] = useState(false);
  const handleAutoSizeColumns = useCallback(() => {
    const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
    if (!fitToContent) {
      // AÇ — gerçek içerik genişlikleri (viewport bağımsız)
      const intrinsic = measureIntrinsicColumnWidths(filteredData, visibleIds, tableDensity);
      // Her sütunu kullanıcı-boyutlandırılmış say (auto-balance effect'i ezmesin)
      for (const id of visibleIds) userSizedColumnsRef.current.add(id);
      setColumnSizing((prev) => ({ ...prev, ...intrinsic }));
      setFitToContent(true);
      return;
    }
    // KAPAT — manuel işaretleri temizle, viewport'a sığdır
    userSizedColumnsRef.current.clear();
    const vw =
      liveTableScrollRef.current?.clientWidth ??
      liveTableViewportWidth ??
      (typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.88) : 1200);
    const next = computeBalancedColumnSizing(
      filteredData,
      visibleIds,
      Math.max(0, Math.floor(vw)),
      tableDensity
    );
    setColumnSizing((prev) => ({ ...prev, ...next }));
    setFitToContent(false);
  }, [table, filteredData, tableDensity, liveTableViewportWidth, fitToContent]);

  /** Veri, sütun görünümü veya genişlik değişince otomatik orantı (elle boyutlanan sütunlar hariç) */
  useEffect(() => {
    if (isLoading || error) return;
    const visibleIds = table.getVisibleLeafColumns().map((c) => c.id);
    const vw =
      liveTableViewportWidth > 0
        ? liveTableViewportWidth
        : typeof window !== "undefined"
          ? Math.floor(window.innerWidth * 0.85)
          : 0;
    const sized = computeBalancedColumnSizing(filteredData, visibleIds, vw, tableDensity);
    setColumnSizing((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(sized)) {
        if (userSizedColumnsRef.current.has(id)) continue;
        const v = sized[id];
        if (v !== undefined && next[id] !== v) {
          next[id] = v;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [filteredData, liveTableVisibleKey, liveTableViewportWidth, tableDensity, isLoading, error, table]);

  const visibleColumnIds = table.getVisibleLeafColumns().map((c) => (c.id ?? (c as { accessorKey?: string }).accessorKey ?? "").toString()).filter(Boolean);
  const exportColumnIds = useMemo(
    () => buildExportColumnIds(visibleColumnIds, exportIncludeAutoRowNumber),
    [visibleColumnIds, exportIncludeAutoRowNumber]
  );
  /** Export sırasında hassas sütunların ham olarak yazılıp yazılmayacağı.
   *  Ayrı izin yoksa toggle görünse bile ham veri yazılmaz.
   */
  const selectedPdfRows = useMemo(
    () => getExportRows(pdfDialogScope),
    [getExportRows, pdfDialogScope]
  );
  const exportCurrentRows = useMemo(() => getExportRows("current"), [getExportRows]);
  const exportAllRows = useMemo(() => getExportRows("all"), [getExportRows]);
  const canUnmaskExportRows = useCallback(
    (rows: Task[]) => canExportSensitiveUnmasked && exportUnmaskSensitive && rows.every((task) => canExportUnmaskedRow(task)),
    [canExportSensitiveUnmasked, canExportUnmaskedRow, exportUnmaskSensitive]
  );
  const effectiveUnmaskSensitive = canUnmaskExportRows(selectedPdfRows);
  const exportScopeLabel = projectPermissionsAvailable
    ? "Proje bazlı izin verilen satırlar"
    : canExportAllRows
      ? "Tüm erişilebilir satırlar"
      : "Sadece düzenleyebildiğin satırlar";
  const exportSensitivityLabel = effectiveUnmaskSensitive ? "Hassas veri açık" : "Hassas veri maskeli";
  const availableManagedReportTemplates = useMemo(() => {
    const isStaff = isAdmin || user?.roleId === "project_manager";
    return managedReportTemplates.filter((template) => {
      if (template.template_config.unmaskSensitive && !canExportSensitiveUnmasked) return false;
      if (template.user_id && user?.id === template.user_id) return true;
      if (isStaff) return true;
      if (template.access_mode === "all") return true;
      if (template.access_mode === "admin_pm") return false;
      if (template.access_mode === "email_list") {
        return !!currentUserEmail && template.allowed_emails.includes(currentUserEmail);
      }
      if (template.access_mode === "project_team") {
        const project = template.project_id ? projectById.get(template.project_id) : null;
        return !!project && (project.assigned_emails ?? []).some((email) => email.trim().toLowerCase() === currentUserEmail);
      }
      return false;
    });
  }, [canExportSensitiveUnmasked, currentUserEmail, isAdmin, managedReportTemplates, projectById, user?.id, user?.roleId]);
  const selectedCustomReportTemplate = reportTemplateSelection.startsWith("custom:")
    ? savedReportTemplates.find((template) => customReportTemplateSelection(template.id) === reportTemplateSelection) ?? null
    : null;
  const selectedManagedReportTemplate = reportTemplateSelection.startsWith("managed:")
    ? availableManagedReportTemplates.find((template) => managedReportTemplateSelection(template.id) === reportTemplateSelection) ?? null
    : null;
  const selectedBaseReportTemplateId: ReportTemplateId = reportTemplateSelection.startsWith("builtin:")
    ? (reportTemplateSelection.replace("builtin:", "") as ReportTemplateId)
    : selectedCustomReportTemplate?.baseTemplateId ?? selectedManagedReportTemplate?.template_config.baseTemplateId ?? "operations";
  const selectedBuiltInReportTemplate = REPORT_TEMPLATES[selectedBaseReportTemplateId] ?? REPORT_TEMPLATES.operations;
  const selectedReportTemplate = selectedCustomReportTemplate || selectedManagedReportTemplate
    ? {
        label: selectedCustomReportTemplate?.name ?? selectedManagedReportTemplate?.name ?? selectedBuiltInReportTemplate.label,
        description: selectedCustomReportTemplate
          ? `Kayıtlı özel şablon · ${selectedBuiltInReportTemplate.label} tabanlı`
          : `Kurumsal şablon · ${selectedBuiltInReportTemplate.label} tabanlı`,
      }
    : selectedBuiltInReportTemplate;
  const selectedPdfTitle = pdfTitleInput.trim() || null;

  /**
   * Yönetilen şablonun sunum/marka/PDF görünüm ayarlarını ve org_branding'i
   * tek bir PdfRenderOptions objesine birleştirir. Builtin/custom şablonlarda
   * yalnızca org_branding (logo gerekirse) etkili olur.
   */
  const pdfRenderOptions = useMemo<PdfRenderOptions>(() => {
    const config = selectedManagedReportTemplate?.template_config ?? selectedCustomReportTemplate;
    const includeLogo = config?.showLogo === true;
    const brandingForRender = includeLogo
      ? {
          logoUrl: orgBranding.logoUrl || undefined,
          orgName: orgBranding.orgName || undefined,
          footerText: orgBranding.pdfFooterText || undefined,
        }
      : {
          // Logo gösterilmese de footer metni kurumsal olarak kalır
          footerText: orgBranding.pdfFooterText || undefined,
        };
    return {
      orientation: config?.pdfOrientation,
      pageSize: config?.pdfPageSize,
      showFilterSummary: config?.pdfShowFilterSummary,
      showStatusSummary: config?.pdfShowStatusSummary,
      branding: brandingForRender,
      coverNote: config?.coverNote || undefined,
      summaryBullets: config?.summaryBullets,
    };
  }, [selectedCustomReportTemplate, selectedManagedReportTemplate, orgBranding]);
  const pdfExportMetadata = useMemo<PdfExportMetadata>(() => {
    const generatedAt = new Date().toLocaleString("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const exportedBy = (user?.displayName || user?.email || "Bilinmeyen kullanıcı").trim();
    const doneCount = selectedPdfRows.filter((task) => isStatusDone(task.status)).length;
    const inProgressCount = selectedPdfRows.filter((task) => isStatusInProgress(task.status)).length;
    const todoCount = Math.max(0, selectedPdfRows.length - doneCount - inProgressCount);
    const statusSummary = `Yapılacak: ${todoCount}, Devam ediyor: ${inProgressCount}, Tamamlandı: ${doneCount}`;

    const datePresetLabels: Record<string, string> = {
      today: "Bugün",
      tomorrow: "Yarın",
      thisWeek: "Bu hafta",
      nextWeek: "Gelecek hafta",
      thisMonth: "Bu ay",
      nextMonth: "Gelecek ay",
      last7days: "Son 7 gün",
      last30days: "Son 30 gün",
    };

    const filterSummary: string[] = [];
    if (pdfDialogScope === "all") {
      filterSummary.push(
        canExportAllRows
          ? "Tüm erişilebilir veri dışa aktarıldı; ekrandaki filtreler uygulanmadı."
          : "Tüm veri isteği, yetki nedeniyle sadece düzenleyebildiğiniz satırlarla sınırlandı."
      );
    } else {
      filterSummary.push(
        projectLinkedFilter === "proje"
          ? "Görev kapsamı: Sadece proje görevleri"
          : "Görev kapsamı: Tüm görevler"
      );
      if (globalSearch.trim()) filterSummary.push(`Arama: ${globalSearch.trim()}`);
      if (statusFilter.length > 0) filterSummary.push(`Durum: ${statusFilter.join(", ")}`);
      if (assigneeFilter.length > 0) {
        filterSummary.push(
          `Atanan: ${assigneeFilter.map((value) => (value === "__unassigned__" ? "Atanmamış" : value)).join(", ")}`
        );
      }
      if (projectFilter.length > 0) {
        filterSummary.push(
          `Proje: ${projectFilter
            .map((id) => (projectById.get(id)?.name ?? id).trim() || "(adsız proje)")
            .join(", ")}`
        );
      }
      if (dateFrom || dateTo || datePreset !== "custom") {
        const dateLabel =
          datePreset !== "custom"
            ? `${datePresetLabels[datePreset] ?? datePreset}${dateFrom || dateTo ? ` (${dateFrom || "..."} → ${dateTo || "..."})` : ""}`
            : dateFrom && dateTo
              ? `${dateFrom} → ${dateTo}`
              : dateFrom
                ? `${dateFrom}'den itibaren`
                : `${dateTo}'e kadar`;
        filterSummary.push(`Tarih aralığı: ${dateLabel}`);
      }
      const activeColumnFilters = Object.entries(columnFilters).filter(([, values]) => values.length > 0);
      if (activeColumnFilters.length > 0) {
        filterSummary.push(
          `Sütun filtreleri: ${activeColumnFilters
            .map(([id, values]) => {
              const label = COLUMN_LABELS[id] ?? (id.startsWith("extra:") ? id.replace(/^extra:/, "") : id);
              return `${label} (${values.length})`;
            })
            .join(", ")}`
        );
      }
      const activeAdvancedCount = advancedFilterRules.filter(advancedFilterRuleIsActive).length;
      if (activeAdvancedCount > 0) filterSummary.push(`Gelişmiş filtre kuralları: ${activeAdvancedCount}`);
      if (filterSummary.length === 1) filterSummary.push("Ek filtre uygulanmadı.");
    }
    if (!canExportAllRows) {
      filterSummary.push("Yetki kapsamı: sadece düzenleyebildiğiniz satırlar dışa aktarılır.");
    }

    return {
      generatedAt,
      scopeLabel: pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm",
      exportedBy,
      reportTemplateLabel: selectedReportTemplate.label,
      sensitivityLabel: effectiveUnmaskSensitive ? "Ham hassas veriler dahil" : "Hassas veriler maskeli",
      filterSummary,
      statusSummary,
    };
  }, [
    selectedPdfRows,
    user,
    pdfDialogScope,
    projectLinkedFilter,
    globalSearch,
    statusFilter,
    assigneeFilter,
    projectFilter,
    projectById,
    dateFrom,
    dateTo,
    datePreset,
    columnFilters,
    advancedFilterRules,
    effectiveUnmaskSensitive,
    selectedReportTemplate.label,
    canExportAllRows,
  ]);
  const emailTemplate = useMemo(
    () =>
      createEmailTemplate(
        selectedPdfRows,
        exportColumnIds,
        settings.dateFormat,
        projectById,
        effectiveUnmaskSensitive,
        emailSubjectInput,
        pdfExportMetadata,
        emailTemplateMode,
        pdfRenderOptions,
        chipResolver
      ),
    [
      selectedPdfRows,
      exportColumnIds,
      settings.dateFormat,
      projectById,
      effectiveUnmaskSensitive,
      emailSubjectInput,
      pdfExportMetadata,
      emailTemplateMode,
      pdfRenderOptions,
      chipResolver,
    ]
  );

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  /**
   * Export sonrası shadow policy logu (masked/unmasked) + unmasked ise PII denetim logu.
   */
  const logSensitiveExport = useCallback(
    async (rows: Task[], unmasked: boolean, scope: "current" | "all") => {
      if (!user?.id || !user?.email) return;
      const sensitiveKeys = new Set<string>();
      for (const id of visibleColumnIds) {
        if (id.startsWith("extra:")) {
          const k = id.replace(/^extra:/, "");
          if (isSensitiveExtraColumnKey(k)) sensitiveKeys.add(k);
        }
      }
      if (sensitiveKeys.size === 0) return;
      const projectIds = Array.from(
        new Set(rows.map((row) => (row.project_id ? String(row.project_id) : "")).filter(Boolean))
      );
      const resolvedProjectId = projectIds.length === 1 ? projectIds[0] : null;
      const action = unmasked ? "export_unmasked" : "export_masked";
      await Promise.all(
        Array.from(sensitiveKeys).map(async (key) => {
          await logSensitivePolicyDecision({
            fieldKey: key,
            action,
            legacyDecision: "allow",
            projectId: resolvedProjectId,
            context: {
              source: "export",
              scope,
              rowCount: rows.length,
              projectIds,
            },
          });
          if (!unmasked || !user?.email) return;
          await logPiiAccess({
            userEmail: user.email,
            action: "export",
            fieldName: key,
            recordCount: rows.length,
          });
        })
      );
      if (unmasked) {
        toast.info("Hassas alanlar denetim kayıtlarına yazıldı", { durationMs: 2500 });
      }
    },
    [user, visibleColumnIds, toast, logSensitivePolicyDecision]
  );

  const handleExportCSV = useCallback(
    (scope: "current" | "all") => {
      const rows = getExportRows(scope);
      if (rows.length === 0) {
        toast.error("Dışa aktarılacak yetkili satır bulunamadı.");
        return;
      }
      const unmaskSensitive = canUnmaskExportRows(rows);
      downloadCSV(
        rows,
        exportColumnIds,
        settings.dateFormat,
        `gorevler-${scope === "all" ? "tum" : "gorunum"}${unmaskSensitive ? "-ham" : ""}-${Date.now()}.csv`,
        projectById,
        unmaskSensitive,
        chipResolver
      );
      void logSensitiveExport(rows, unmaskSensitive, scope);
      if (unmaskSensitive) {
        toast.success("Hassas veriler AÇIK olarak indirildi (yetkili onay)");
      }
    },
    [getExportRows, canUnmaskExportRows, exportColumnIds, settings.dateFormat, projectById, chipResolver, toast, logSensitiveExport]
  );
  const handleExportExcel = useCallback(
    (scope: "current" | "all") => {
      const rows = getExportRows(scope);
      if (rows.length === 0) {
        toast.error("Dışa aktarılacak yetkili satır bulunamadı.");
        return;
      }
      const unmaskSensitive = canUnmaskExportRows(rows);
      downloadExcel(
        rows,
        exportColumnIds,
        settings.dateFormat,
        `gorevler-${scope === "all" ? "tum" : "gorunum"}${unmaskSensitive ? "-ham" : ""}-${Date.now()}.xlsx`,
        projectById,
        unmaskSensitive,
        chipResolver
      );
      void logSensitiveExport(rows, unmaskSensitive, scope);
      if (unmaskSensitive) {
        toast.success("Hassas veriler AÇIK olarak indirildi (yetkili onay)");
      }
    },
    [getExportRows, canUnmaskExportRows, exportColumnIds, settings.dateFormat, projectById, chipResolver, toast, logSensitiveExport]
  );
  const applyReportTemplate = useCallback((selection: ReportTemplateSelection) => {
    const isCustom = selection.startsWith("custom:");
    const customTemplate = isCustom
      ? savedReportTemplates.find((template) => customReportTemplateSelection(template.id) === selection) ?? null
      : null;
    const managedTemplate = selection.startsWith("managed:")
      ? availableManagedReportTemplates.find((template) => managedReportTemplateSelection(template.id) === selection) ?? null
      : null;
    const managedConfig = managedTemplate?.template_config;
    const builtinId = selection.startsWith("builtin:")
      ? (selection.replace("builtin:", "") as ReportTemplateId)
      : customTemplate?.baseTemplateId ?? managedConfig?.baseTemplateId ?? "operations";
    const template = REPORT_TEMPLATES[builtinId] ?? REPORT_TEMPLATES.operations;

    setReportTemplateSelection(selection);
    setPdfTitleInput(customTemplate?.pdfTitle || managedConfig?.pdfTitle || template.pdfTitle);
    setEmailSubjectInput(customTemplate?.emailSubject || managedConfig?.emailSubject || template.emailSubject);
    setEmailTemplateMode(customTemplate?.emailMode ?? managedConfig?.emailMode ?? template.emailMode);
    setEmailCopied(false);

    const reusableConfig = customTemplate
      ? {
          exportScope: customTemplate.scope,
          visibleColumnIds: customTemplate.visibleColumnIds,
          unmaskSensitive: customTemplate.unmaskSensitive,
          defaultSavedViewId: customTemplate.defaultSavedViewId,
          defaultFilterPresets: customTemplate.defaultFilterPresets,
        }
      : managedConfig;

    if (reusableConfig) {
      setPdfDialogScope(reusableConfig.exportScope);
      setExportUnmaskSensitive(canExportSensitiveUnmasked && reusableConfig.unmaskSensitive);
      setExportIncludeAutoRowNumber(
        customTemplate?.includeAutoRowNumber === true ||
          (managedConfig != null && managedConfig.includeAutoRowNumber === true)
      );
      const savedVisible = new Set(reusableConfig.visibleColumnIds);
      if (savedVisible.size > 0) {
        const allColumnIds = table
          .getAllLeafColumns()
          .map((column) => (column.id ?? (column as { accessorKey?: string }).accessorKey ?? "").toString())
          .filter(Boolean);
        setColumnVisibility((prev) => {
          const next = { ...prev };
          for (const id of allColumnIds) {
            if (savedVisible.has(id)) delete next[id];
            else next[id] = false;
          }
          return next;
        });
      }

      const savedViewId = reusableConfig.defaultSavedViewId;
      if (savedViewId) {
        const savedView = reportSavedViews.find((view) => view.id === savedViewId);
        if (savedView) {
          applyViewConfig(savedView.config);
        } else {
          toast.warning("Şablona bağlı kayıtlı görünüm bulunamadı.");
        }
      }
      const presetFilters = filterPresetsToConfig(reusableConfig.defaultFilterPresets ?? []);
      if (presetFilters) {
        applyFilterConfigPatch(presetFilters);
      }
    }

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  }, [
    applyFilterConfigPatch,
    applyViewConfig,
    availableManagedReportTemplates,
    canExportSensitiveUnmasked,
    pdfPreviewUrl,
    reportSavedViews,
    savedReportTemplates,
    table,
    toast,
  ]);

  const saveCurrentReportTemplate = useCallback(async () => {
    const name = await promptUser({
      title: "Rapor şablonu kaydet",
      message: "Mevcut export ayarlarını tekrar kullanmak için bir şablon adı gir:",
      defaultValue: selectedReportTemplate.label,
      placeholder: "Örn. Haftalık yönetici özeti",
      confirmLabel: "Kaydet",
    });
    const cleanName = name?.trim();
    if (!cleanName) return;
    const id = makeSavedReportTemplateId();
    const presentationConfig = selectedManagedReportTemplate?.template_config ?? selectedCustomReportTemplate;
    const template: SavedReportTemplate = {
      id,
      name: cleanName,
      baseTemplateId: selectedBaseReportTemplateId,
      pdfTitle: pdfTitleInput.trim() || selectedBuiltInReportTemplate.pdfTitle,
      emailSubject: emailSubjectInput.trim() || selectedBuiltInReportTemplate.emailSubject,
      emailMode: emailTemplateMode,
      scope: pdfDialogScope,
      visibleColumnIds,
      unmaskSensitive: effectiveUnmaskSensitive,
      showLogo: presentationConfig?.showLogo ?? false,
      coverNote: presentationConfig?.coverNote ?? "",
      summaryBullets: presentationConfig?.summaryBullets ?? [],
      defaultFilterPresets: presentationConfig?.defaultFilterPresets ?? [],
      defaultSavedViewId: presentationConfig?.defaultSavedViewId ?? null,
      pdfOrientation: presentationConfig?.pdfOrientation ?? "landscape",
      pdfPageSize: presentationConfig?.pdfPageSize ?? "A4",
      pdfShowFilterSummary: presentationConfig?.pdfShowFilterSummary ?? true,
      pdfShowStatusSummary: presentationConfig?.pdfShowStatusSummary ?? true,
      includeAutoRowNumber: exportIncludeAutoRowNumber,
      updatedAt: new Date().toISOString(),
    };
    const next = [template, ...savedReportTemplates].slice(0, 30);
    setSavedReportTemplates(next);
    persistSavedReportTemplates(currentUserEmail, next);
    setReportTemplateSelection(customReportTemplateSelection(id));
    toast.success("Rapor şablonu kaydedildi");
  }, [
    currentUserEmail,
    effectiveUnmaskSensitive,
    emailSubjectInput,
    emailTemplateMode,
    pdfDialogScope,
    pdfTitleInput,
    promptUser,
    savedReportTemplates,
    selectedBaseReportTemplateId,
    selectedBuiltInReportTemplate.emailSubject,
    selectedBuiltInReportTemplate.pdfTitle,
    selectedCustomReportTemplate,
    selectedManagedReportTemplate,
    selectedReportTemplate.label,
    toast,
    exportIncludeAutoRowNumber,
    visibleColumnIds,
  ]);

  const deleteSelectedReportTemplate = useCallback(() => {
    if (!selectedCustomReportTemplate) return;
    const next = savedReportTemplates.filter((template) => template.id !== selectedCustomReportTemplate.id);
    setSavedReportTemplates(next);
    persistSavedReportTemplates(currentUserEmail, next);
    setReportTemplateSelection(builtinReportTemplateSelection(selectedCustomReportTemplate.baseTemplateId));
    toast.success("Rapor şablonu silindi");
  }, [currentUserEmail, savedReportTemplates, selectedCustomReportTemplate, toast]);

  const getDefaultManagedReportTemplate = useCallback(() => {
    const selectedProjectId = projectFilter.length === 1 ? projectFilter[0] : null;
    if (selectedProjectId) {
      const projectDefault = availableManagedReportTemplates.find(
        (template) =>
          template.is_default &&
          template.assignment_scope === "project" &&
          template.project_id === selectedProjectId
      );
      if (projectDefault) return projectDefault;
    }
    return availableManagedReportTemplates.find(
      (template) =>
        template.is_default &&
        template.assignment_scope === "system"
    ) ?? null;
  }, [availableManagedReportTemplates, projectFilter]);

  const openPdfDialog = useCallback((scope: PdfExportScope) => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    const defaultTemplate = getDefaultManagedReportTemplate();
    if (defaultTemplate) {
      applyReportTemplate(managedReportTemplateSelection(defaultTemplate.id));
    } else {
      setReportTemplateSelection(builtinReportTemplateSelection("operations"));
      setPdfTitleInput(REPORT_TEMPLATES.operations.pdfTitle);
      setEmailSubjectInput(REPORT_TEMPLATES.operations.emailSubject);
      setEmailTemplateMode(REPORT_TEMPLATES.operations.emailMode);
      setPdfDialogScope(scope);
    }
    setPdfDialogOpen(true);
  }, [applyReportTemplate, getDefaultManagedReportTemplate, pdfPreviewUrl]);

  const openEmailDialog = useCallback((scope: PdfExportScope) => {
    const template = scope === "all" ? REPORT_TEMPLATES.fullTable : REPORT_TEMPLATES.mobileBrief;
    const templateId: ReportTemplateId = scope === "all" ? "fullTable" : "mobileBrief";
    const defaultTemplate = getDefaultManagedReportTemplate();
    if (defaultTemplate) {
      applyReportTemplate(managedReportTemplateSelection(defaultTemplate.id));
    } else {
      setPdfDialogScope(scope);
      setReportTemplateSelection(builtinReportTemplateSelection(templateId));
      setPdfTitleInput(template.pdfTitle);
      setEmailSubjectInput(template.emailSubject);
      setEmailTemplateMode(template.emailMode);
    }
    setEmailCopied(false);
    setEmailDialogOpen(true);
  }, [applyReportTemplate, getDefaultManagedReportTemplate]);

  const copyEmailTemplate = useCallback(async () => {
    if (selectedPdfRows.length === 0) {
      toast.error("Kopyalanacak yetkili satır bulunamadı.");
      return;
    }
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([emailTemplate.html], { type: "text/html" }),
            "text/plain": new Blob([emailTemplate.text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(emailTemplate.text);
      }
      setEmailCopied(true);
      toast.success("E-posta şablonu panoya kopyalandı");
    } catch (e) {
      console.error("[Export] E-posta şablonu kopyalanamadı:", e);
      toast.error("E-posta şablonu kopyalanamadı");
    }
  }, [emailTemplate, selectedPdfRows.length, toast]);

  const handlePdfDialogOpenChange = useCallback((open: boolean) => {
    setPdfDialogOpen(open);
    if (open) return;
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
    setPdfPreviewLoading(false);
    setPdfDownloadLoading(false);
  }, [pdfPreviewUrl]);

  /**
   * PDF önizleme iframe'ini yazdır.
   * Same-origin blob URL olduğu için contentWindow.print() çalışmalı; başarısız
   * olursa (örn. tarayıcı PDF viewer'ı izin vermezse) URL yeni sekmede açılır.
   */
  const printPdfPreview = useCallback(() => {
    if (!pdfPreviewUrl) {
      toast.error("Önce önizleme oluşturun.");
      return;
    }
    const iframe = pdfPreviewIframeRef.current;
    try {
      if (iframe?.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      }
    } catch (err) {
      console.warn("[Export] iframe.print() başarısız, yeni sekme deneniyor:", err);
    }
    // Fallback — yeni sekmede aç, kullanıcı oradan yazdırır
    const opened = window.open(pdfPreviewUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.error("Yazdırma penceresi açılamadı (pop-up engellenmiş olabilir).");
    }
  }, [pdfPreviewUrl, toast]);

  /**
   * E-posta şablonu HTML'ini yeni pencerede aç ve yazdırma diyaloğunu tetikle.
   * Bu sayede kullanıcı şablonu yazıcıya gönderebilir veya "PDF olarak kaydet" seçeneğiyle PDF üretebilir.
   */
  const printEmailTemplate = useCallback(() => {
    if (!emailTemplate?.html) {
      toast.error("Yazdırılacak şablon yok.");
      return;
    }
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) {
      toast.error("Yazdırma penceresi açılamadı (pop-up engellenmiş olabilir).");
      return;
    }
    const safeTitle = (emailTemplate.subject || "E-posta şablonu").replace(/[<>]/g, "");
    w.document.open();
    w.document.write(`<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    @page { margin: 16mm; }
    body { margin: 0; padding: 20px; background: white; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
${emailTemplate.html}
<script>
  (function(){
    function startPrint(){
      try { window.focus(); window.print(); } catch (e) {}
    }
    if (document.readyState === "complete") {
      setTimeout(startPrint, 250);
    } else {
      window.addEventListener("load", function(){ setTimeout(startPrint, 250); });
    }
  })();
</script>
</body>
</html>`);
    w.document.close();
  }, [emailTemplate, toast]);

  const previewExportPDF = useCallback(async () => {
    if (selectedPdfRows.length === 0) {
      toast.error("Önizlenecek yetkili satır bulunamadı.");
      return;
    }
    setPdfPreviewLoading(true);
    try {
      const nextUrl = await createPDFPreviewUrl(
        selectedPdfRows,
        exportColumnIds,
        settings.dateFormat,
        projectById,
        effectiveUnmaskSensitive,
        selectedPdfTitle,
        pdfExportMetadata,
        pdfRenderOptions,
        chipResolver
      );
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch (e) {
      console.error("[Export] PDF önizleme oluşturulamadı:", e);
      toast.error("PDF önizleme oluşturulamadı");
    } finally {
      setPdfPreviewLoading(false);
    }
  }, [selectedPdfRows, exportColumnIds, settings.dateFormat, projectById, effectiveUnmaskSensitive, selectedPdfTitle, pdfExportMetadata, pdfRenderOptions, chipResolver, toast]);

  const confirmExportPDF = useCallback(
    async () => {
      if (selectedPdfRows.length === 0) {
        toast.error("Dışa aktarılacak yetkili satır bulunamadı.");
        return;
      }
      setPdfDownloadLoading(true);
      try {
        await downloadPDF(
          selectedPdfRows,
          exportColumnIds,
          settings.dateFormat,
          `gorevler-${pdfDialogScope === "all" ? "tum" : "gorunum"}${effectiveUnmaskSensitive ? "-ham" : ""}-${Date.now()}.pdf`,
          projectById,
          effectiveUnmaskSensitive,
          selectedPdfTitle,
          pdfExportMetadata,
          pdfRenderOptions,
          chipResolver
        );
        void logSensitiveExport(selectedPdfRows, effectiveUnmaskSensitive, pdfDialogScope);
        if (effectiveUnmaskSensitive) {
          toast.success("Hassas veriler AÇIK olarak indirildi (yetkili onay)");
        }
      } catch (e) {
        console.error("[Export] PDF oluşturulamadı:", e);
        toast.error("PDF oluşturulamadı");
      } finally {
        setPdfDownloadLoading(false);
        handlePdfDialogOpenChange(false);
      }
    },
    [selectedPdfRows, exportColumnIds, settings.dateFormat, pdfDialogScope, effectiveUnmaskSensitive, projectById, selectedPdfTitle, pdfExportMetadata, pdfRenderOptions, chipResolver, toast, logSensitiveExport, handlePdfDialogOpenChange]
  );

  const openColumnPicker = useCallback(() => {
    setColumnPickerSearch("");
    setColumnPickerOpen(true);
  }, []);

  /** Tek sütunun görünürlüğünü anında değiştir (draft yok, Uygula yok). */
  const toggleColumnVisibilityInstant = useCallback((columnId: string, show: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev };
      if (show) delete next[columnId];
      else next[columnId] = false;
      return next;
    });
  }, []);

  /** Birden fazla sütunu birlikte göster veya gizle. */
  const setManyColumnVisibilityInstant = useCallback(
    (columnIds: string[], show: boolean) => {
      setColumnVisibility((prev) => {
        const next = { ...prev };
        for (const id of columnIds) {
          if (show) delete next[id];
          else next[id] = false;
        }
        return next;
      });
    },
    []
  );

  /** Sürüklenen sütun sırası ve sol/sağ sabitlemeleri varsayılana döner (görünürlük ve genişlik aynı kalır). */
  const resetColumnOrderToDefault = useCallback(() => {
    const dynamicIds = extraDataKeys.map((k) => `extra:${k}`);
    setColumnOrder(mergeColumnOrderWithDynamics(undefined, dynamicIds));
    setColumnPinning({ left: [], right: [] });
  }, [extraDataKeys]);

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedTasks = selectedRows.map((r) => r.original);
  const selectedIds = selectedTasks.map((t) => t.id);
  const selectedCanBulkUpdate = selectedTasks.some((task) => canBulkUpdateRow(task));
  const selectedCanBulkDelete = selectedTasks.some((task) => canBulkDeleteRow(task));

  const executeBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0 || !canBulkDelete) return;
    const deletableTasks = selectedTasks.filter((task) => canBulkDeleteRow(task));
    if (deletableTasks.length === 0) {
      toast.error("Seçili satırlarda toplu silme yetkiniz yok.");
      return;
    }
    const deletableIds = deletableTasks.map((task) => task.id);
    setBulkDeleteConfirmOpen(false);
    // Undo için seçili görevlerin tamamını yakala
    const backups = deletableTasks.map((t) => ({ ...t }));
    setDeletingIds((prev) => new Set([...Array.from(prev), ...deletableIds]));
    try {
      await deleteTasks(deletableIds);
      setRowSelection({});
      toast.success(`${deletableIds.length} görev silindi`, {
        action:
          backups.length > 0
            ? {
                label: "Geri al",
                onClick: async () => {
                  try {
                    await createTasksBulk(
                      backups.map((b) => ({
                        content: b.content,
                        status: b.status,
                        assignee: b.assignee,
                        priority: b.priority,
                        project_id: b.project_id,
                        due_date: b.due_date,
                        extra_data: b.extra_data,
                      }))
                    );
                    toast.success(`${backups.length} görev geri yüklendi`);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : "Geri alınamadı";
                    toast.error(msg);
                  }
                },
              }
            : undefined,
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Toplu silme başarısız.";
      toast.error(msg);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        deletableIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [selectedIds.length, selectedTasks, canBulkDelete, canBulkDeleteRow, deleteTasks, createTasksBulk, toast]);

  /**
   * Ek sütun silme etkisi: kaç projenin şeması ve kaç görevin verisi etkilenecek.
   * Kapsam: proje filtresi aktifse o projeler; değilse anahtarın bulunduğu tüm projeler.
   */
  const removeExtraColumnImpact = useMemo(() => {
    if (!removeExtraColumnKey) return { projects: [] as typeof projects, taskCount: 0 };
    const key = removeExtraColumnKey;
    const scopeProjectIds = scopedProjectIdSet;
    const affectedProjects = projects.filter((p) => {
      if (scopeProjectIds != null && !scopeProjectIds.has(p.id)) return false;
      return (p.extra_column_keys ?? []).some((k) => String(k ?? "").trim() === key);
    });
    const affectedProjectIdSet = new Set(affectedProjects.map((p) => p.id));
    const taskCount = tasks.reduce((acc, t) => {
      if (t.extra_data == null || typeof t.extra_data !== "object") return acc;
      if (!(key in t.extra_data)) return acc;
      // Görev kapsamı: filtre varsa sadece filtredeki projeler;
      // filtre yoksa: etkilenen projelerden birine bağlı veya projesiz görevler dahil
      if (scopeProjectIds != null) {
        if (t.project_id == null) return acc;
        if (!scopeProjectIds.has(String(t.project_id))) return acc;
      } else {
        if (t.project_id != null && !affectedProjectIdSet.has(String(t.project_id))) return acc;
      }
      return acc + 1;
    }, 0);
    return { projects: affectedProjects, taskCount };
  }, [removeExtraColumnKey, projects, tasks, scopedProjectIdSet]);

  const executeRemoveExtraColumn = useCallback(async () => {
    if (!removeExtraColumnKey) return;
    const key = removeExtraColumnKey;
    const { projects: affectedProjects, taskCount } = removeExtraColumnImpact;
    setRemovingExtraColumn(true);
    try {
      // 1) Projelerin extra_column_keys şemasından anahtarı çıkar
      for (const p of affectedProjects) {
        const next = (p.extra_column_keys ?? []).filter((k) => String(k ?? "").trim() !== key);
        await updateProject(p.id, { extra_column_keys: next });
      }
      // 2) Kapsamdaki görevlerin extra_data'sından anahtarı temizle
      const affectedProjectIdSet = new Set(affectedProjects.map((p) => p.id));
      const scopeProjectIds = scopedProjectIdSet;
      const tasksToClear = tasks.filter((t) => {
        if (t.extra_data == null || typeof t.extra_data !== "object") return false;
        if (!(key in t.extra_data)) return false;
        if (scopeProjectIds != null) {
          return t.project_id != null && scopeProjectIds.has(String(t.project_id));
        }
        return t.project_id == null || affectedProjectIdSet.has(String(t.project_id));
      });
      for (const t of tasksToClear) {
        const nextExtra = { ...(t.extra_data ?? {}) };
        delete nextExtra[key];
        const nextValue = Object.keys(nextExtra).length > 0 ? nextExtra : null;
        await saveTask(t.id, { extra_data: nextValue });
        updateTaskOptimistic(t.id, { extra_data: nextValue });
      }
      setRemoveExtraColumnKey(null);
      const projCount = affectedProjects.length;
      toast.success(
        `“${key}” sütunu kaldırıldı` +
          (projCount > 0 || taskCount > 0
            ? ` (${projCount} proje şeması, ${taskCount} görev verisi)`
            : "")
      );
      await fetchTasks();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Sütun kaldırılamadı.";
      toast.error(msg);
    } finally {
      setRemovingExtraColumn(false);
    }
  }, [
    removeExtraColumnKey,
    removeExtraColumnImpact,
    tasks,
    scopedProjectIdSet,
    updateProject,
    saveTask,
    updateTaskOptimistic,
    fetchTasks,
    toast,
  ]);

  const handleBulkStatusUpdate = useCallback(
    async (status: string) => {
      if (!canBulkUpdate) {
        setBulkStatusOpen(false);
        toast.error("Toplu durum güncelleme yetkiniz yok.");
        return;
      }
      setBulkStatusOpen(false);
      let fail = 0;
      let skipped = 0;
      for (const t of selectedTasks) {
        if (!canBulkUpdateRow(t)) {
          skipped += 1;
          continue;
        }
        updateTaskOptimistic(t.id, { status, last_updated_by: "anon" });
        const r = await saveTask(t.id, { status, last_updated_by: "anon" });
        if (!r.ok) fail += 1;
      }
      if (fail > 0) {
        toast.error(
          `${fail} görev güncellenemedi${fail < selectedTasks.length ? ` (${selectedTasks.length - fail} güncellendi)` : ""}`
        );
      } else if (selectedTasks.length - skipped > 0) {
        toast.success(`${selectedTasks.length - skipped} görevin durumu güncellendi`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} görev atama yetkisi nedeniyle atlandı.`);
      }
      setRowSelection({});
    },
    [selectedTasks, canBulkUpdate, canBulkUpdateRow, saveTask, updateTaskOptimistic, toast]
  );

  /* ─── TopStrip useMemo'ları — KRİTİK: hooks rules için early return'lerden ÖNCE ───
       Sabit kapsam: proje TOPLAMINI gösterir (filtreden bağımsız). Filtre değiştikçe
       footer'daki "X / N kayıt" zaten anlık değişir. Burada proje kimliği vurgulanır. */
  const topStripMetrics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => isStatusDone(t.status)).length;
    const inProgress = tasks.filter((t) => isStatusInProgress(t.status)).length;
    // Aktif filtre var mı? filteredData ≠ tasks ise "filtreli" durumdayız
    const isFiltered = filteredData.length !== tasks.length;
    return { total, done, inProgress, filteredCount: filteredData.length, isFiltered };
  }, [tasks, filteredData]);

  const topStripActiveProject = useMemo(() => {
    if (projectFilter.length !== 1) return null;
    return projects.find((p) => p.id === projectFilter[0]) ?? null;
  }, [projectFilter, projects]);

  if (isLoading) {
    const skeletonRows = 5;
    return (
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 min-h-[280px]">
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-4" aria-busy="true">
          <Loader2 className="h-10 w-10 animate-spin text-slate-400 dark:text-slate-500" aria-hidden />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Veriler yükleniyor…</p>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="space-y-2">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-4 w-12 shrink-0 rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
                <div className="h-4 flex-1 max-w-[60%] rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
                <div className="h-4 w-24 shrink-0 rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
                <div className="h-4 w-20 shrink-0 rounded bg-slate-200 dark:bg-slate-600 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-600 dark:bg-red-950/50 dark:text-red-200">
        <p className="font-medium">{error}</p>
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          Supabase bağlantısını ve <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">tasks</code> tablosunu kontrol edin.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fetchTasks()}
          className="mt-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/50"
        >
          <RotateCw className="mr-2 h-4 w-4" />
          Yeniden dene
        </Button>
      </div>
    );
  }

  const liveTableHeaderGroup = table.getHeaderGroups()[0];
  const liveTableSumPx =
    liveTableHeaderGroup?.headers.reduce((s, h) => s + Math.max(h.getSize(), 40), 0) ?? 0;
  const liveTableNeedsHorizontalScroll =
    liveTableViewportWidth > 0 && liveTableSumPx > liveTableViewportWidth + 2;

  const liveTableBody = (
    <>
      <Dialog open={advancedFilterOpen} onOpenChange={setAdvancedFilterOpen}>
        <DialogContent className="max-h-[min(92vh,40rem)] max-w-lg overflow-y-auto border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle>Gelişmiş filtre</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Kuralların hepsi birlikte uygulanır (hepsi doğru olmalı — VE). Tablo yapısı değişse de aynı pencereden ek sütunları seçebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-ui-caption text-blue-900 dark:border-blue-700/60 dark:bg-blue-950/40 dark:text-blue-100">
            <strong>İpucu:</strong> Tek bir kural eklediğinizde tablo o alana göre <em>otomatik A-Z</em> sıralanır; aynı değere sahip satırlar yan yana gelir. Manuel değiştirmek için sütun başlığına tıklayabilirsiniz.
          </div>
          <div className="space-y-3 py-1">
            {advancedFilterRules.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Henüz kural yok. Aşağıdan «Kural ekle» ile koşul ekleyin.</p>
            )}
            {advancedFilterRules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-600 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Alan</span>
                    <select
                      value={rule.field}
                      onChange={(e) =>
                        setAdvancedFilterRules((prev) =>
                          prev.map((r) => (r.id === rule.id ? { ...r, field: e.target.value } : r))
                        )
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {advancedFilterFieldOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Koşul</span>
                    <select
                      value={rule.op}
                      onChange={(e) =>
                        setAdvancedFilterRules((prev) =>
                          prev.map((r) =>
                            r.id === rule.id ? { ...r, op: e.target.value as AdvancedFilterRule["op"] } : r
                          )
                        )
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {ADVANCED_FILTER_OP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className={cn(
                      "min-w-0 sm:col-span-2",
                      (rule.op === "is_empty" || rule.op === "is_not_empty") && "opacity-60"
                    )}
                  >
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Değer</span>
                    <input
                      type="text"
                      disabled={rule.op === "is_empty" || rule.op === "is_not_empty"}
                      value={rule.value}
                      onChange={(e) =>
                        setAdvancedFilterRules((prev) =>
                          prev.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r))
                        )
                      }
                      placeholder="Metin (büyük/küçük harf duyarsız)"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                  onClick={() => setAdvancedFilterRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  aria-label="Kuralı sil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setAdvancedFilterRules((prev) => [
                  ...prev,
                  {
                    id: generateAdvancedFilterRuleId(),
                    field: advancedFilterFieldOptions[0]?.id ?? "content",
                    op: "contains",
                    value: "",
                  },
                ])
              }
            >
              <Plus className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
              Kural ekle
            </Button>
            {advancedFilterRules.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => setAdvancedFilterRules([])}
              >
                Tüm kuralları sil
              </Button>
            )}
          </div>
          <DialogFooter className="sm:justify-end">
            <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700" onClick={() => setAdvancedFilterOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {canCreateTask && (
        <TaskFormDialog
          open={newTaskOpen}
          onOpenChange={setNewTaskOpen}
          initialTask={null}
          onSubmit={handleNewTask}
          submitLabel="Oluştur"
          title="Yeni görev"
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          defaultStatus={settings.defaultTaskStatus}
          defaultPriority={settings.defaultTaskPriority}
        />
      )}
      {editTask && canEditRow(editTask) && (
        <TaskFormDialog
          open={!!editTask}
          onOpenChange={(open) => !open && setEditTask(null)}
          initialTask={editTask ?? undefined}
          onSubmit={handleEditSubmit}
          submitLabel="Kaydet"
          title="Görevi düzenle"
          statusOptions={statusOptions}
          priorityOptions={priorityOptions}
          defaultStatus={settings.defaultTaskStatus}
          defaultPriority={settings.defaultTaskPriority}
        />
      )}
      {canImportCsv && (
        <CSVImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={handleCSVImport}
          referenceColumns={activeReferenceColumns}
          referenceKnownKeys={extraDataKeys}
          defaultStatus={settings.defaultTaskStatus}
          defaultPriority={settings.defaultTaskPriority}
          replaceTargetProjectName={projectFilter.length === 1 ? projectById.get(projectFilter[0])?.name ?? null : null}
        />
      )}
      {(() => {
        if (!detailTask) return null;
        // Sıralı + filtreli (paginate ÖNCESI) görev sırası — j/k tüm sayfalar arası gezer.
        const orderedTasks = table.getSortedRowModel().rows.map((r) => r.original);
        const idx = orderedTasks.findIndex((t) => t.id === detailTask.id);
        const prevTask = idx > 0 ? orderedTasks[idx - 1] : null;
        const nextTask = idx >= 0 && idx < orderedTasks.length - 1 ? orderedTasks[idx + 1] : null;
        const positionLabel =
          idx >= 0 ? `${idx + 1} / ${orderedTasks.length}` : undefined;
        const proj = detailTask.project_id ? projectById.get(String(detailTask.project_id)) : null;
        const detailCanEdit = canEditRow(detailTask);
        return (
          <TaskDetailSheet
            task={detailTask}
            onClose={() => setDetailTask(null)}
            onPrev={prevTask ? () => setDetailTask(prevTask) : undefined}
            onNext={nextTask ? () => setDetailTask(nextTask) : undefined}
            canPrev={!!prevTask}
            canNext={!!nextTask}
            positionLabel={positionLabel}
            projectName={proj?.name ?? null}
            dateFormat={settings.dateFormat}
            urgentPrioritySet={urgentPrioritySetForTable}
            canEdit={detailCanEdit}
            canComment={canCommentRow(detailTask)}
            onEdit={() => {
              if (!detailCanEdit) return;
              setEditTask(detailTask);
              setDetailTask(null);
            }}
          />
        );
      })()}
      {/* Mutation feedback artık <Toaster /> üzerinden sağ-altta gösteriliyor. */}
      <div className="order-[-1] flex shrink-0 flex-col gap-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        {/* Akıllı filtreler */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <button
            type="button"
            aria-expanded={quickFiltersOpen}
            onClick={() => setQuickFiltersOpen((o) => !o)}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100/80 dark:text-slate-500 dark:hover:bg-slate-900"
          >
            Hızlı filtre
            <ChevronDown
              className={cn("h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform dark:text-slate-400", quickFiltersOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {/* ─── SmartRail — Claude Design "Hızlı filtre" chip stili ───
              Rounded-full chip + ikon + label + count rozeti.
              Aktif state: doygun bg + ring. Tekrar tıklayınca toggle. */}
          <div className={cn("flex flex-wrap items-center gap-1.5", !quickFiltersOpen && "hidden")} role="toolbar" aria-label="Hızlı filtreler">
            {[
              { id: "overdue" as const,    icon: AlertTriangle, label: "Gecikmiş",     count: smartFilterCounts.overdue,    tone: "rose" as const },
              { id: "thisWeek" as const,   icon: Calendar,      label: "Bu hafta",     count: smartFilterCounts.thisWeek,   tone: "indigo" as const },
              { id: "priority" as const,   icon: Flame,         label: "Öncelikli",    count: smartFilterCounts.priority,   tone: "amber" as const },
              ...(currentUserEmail ? [{ id: "mine" as const, icon: UserCheck, label: "Bana atanan", count: smartFilterCounts.mine, tone: "emerald" as const }] : []),
              { id: "unassigned" as const, icon: UserX,         label: "Atanmamış",    count: smartFilterCounts.unassigned, tone: "slate" as const },
            ].map((chip) => {
              const Ic = chip.icon;
              const isActive = activeSmartFilter === chip.id;
              const isEmpty = chip.count === 0;
              // Tone bazlı renk paleti — aktif/pasif/empty
              const toneMap = isModernTemplate
                ? {
                    rose: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    indigo: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    amber: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    emerald: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                    slate: {
                      active:
                        "border-slate-400 bg-slate-700 text-white ring-slate-300/50 dark:ring-slate-500/40 shadow-slate-700/20",
                      idle:
                        "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-200 dark:hover:bg-slate-800/85",
                      badge: "bg-slate-600 text-white dark:bg-slate-500",
                    },
                  }
                : {
                rose:    { active: "border-rose-500 bg-rose-500 text-white ring-rose-300/50 dark:ring-rose-400/40 shadow-rose-500/20",       idle: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70",                badge: "bg-rose-600 text-white dark:bg-rose-500" },
                indigo:  { active: "border-indigo-500 bg-indigo-500 text-white ring-indigo-300/50 dark:ring-indigo-400/40 shadow-indigo-500/20", idle: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70", badge: "bg-indigo-600 text-white dark:bg-indigo-500" },
                amber:   { active: "border-amber-500 bg-amber-500 text-white ring-amber-300/50 dark:ring-amber-400/40 shadow-amber-500/20",    idle: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70",            badge: "bg-amber-600 text-white dark:bg-amber-500" },
                emerald: { active: "border-emerald-500 bg-emerald-500 text-white ring-emerald-300/50 dark:ring-emerald-400/40 shadow-emerald-500/20", idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70", badge: "bg-emerald-600 text-white dark:bg-emerald-500" },
                slate:   { active: "border-slate-600 bg-slate-700 text-white ring-slate-400/50 dark:ring-slate-500/40 shadow-slate-700/20",   idle: "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-800/70",          badge: "bg-slate-600 text-white dark:bg-slate-500" },
                };
              const tone = toneMap[chip.tone];
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => applySmartFilter(chip.id)}
                  disabled={isEmpty && !isActive}
                  aria-pressed={isActive}
                  data-tk-focus="true"
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all",
                    isActive
                      ? cn("shadow-sm ring-2 ring-offset-1 dark:ring-offset-slate-900", tone.active)
                      : tone.idle,
                    isEmpty && !isActive && "cursor-not-allowed opacity-50"
                  )}
                >
                  <Ic className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{chip.label}</span>
                  {chip.count > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                        isActive ? "bg-white/25 text-white" : tone.badge
                      )}
                    >
                      {chip.count > 99 ? "99+" : chip.count}
                    </span>
                  )}
                </button>
              );
            })}
            {activeSmartFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium",
                  isModernTemplate
                    ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900/75 dark:text-slate-300 dark:hover:bg-slate-800"
                    : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                )}
                title="Hızlı filtreyi kapat"
              >
                <X className="h-3 w-3" aria-hidden />
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Filtreler — arama, kapsam ve alan filtreleri tek sakin bantta */}
        <div className={cn("px-3 py-2", isModernTemplate && "live-table-modern-toolbar")}>
        <div className="sr-only mb-2 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filtreler
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Grup A — Arama (h-8 toolbar standardı) */}
          <div className="relative w-full max-w-sm flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="text"
              placeholder="Görev veya kişi ara…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Grup B — Kapsam + Gelişmiş filtre (h-8 toolbar standardı) */}
          <select
            value={projectLinkedFilter}
            onChange={(e) => setProjectLinkedFilter(e.target.value as "proje" | "tümü")}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 pr-7 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            title="Canlı tabloda varsayılan olarak sadece projeye bağlı görevler gösterilir"
          >
            <option value="proje">Proje görevleri</option>
            <option value="tümü">Tüm görevler</option>
          </select>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
              activeAdvancedFilterRuleCount > 0
                ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
            onClick={() => setAdvancedFilterOpen(true)}
            title="Tüm alanlarda metin koşulları (VE ile birleşir)"
          >
            <ListFilter className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Gelişmiş filtre
            {activeAdvancedFilterRuleCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-blue-500">
                {activeAdvancedFilterRuleCount}
              </span>
            )}
          </button>
          {/* /Grup B */}

          {/* Hızlı filtre dropdownları (Durum / Atanan / Öncelik / Tarih) — aynı flex row */}
          {/* Çoklu Durum Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                Array.isArray(statusFilter) && statusFilter.length > 0
                  ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <ListTodo className="h-4 w-4" />
              {!Array.isArray(statusFilter) || statusFilter.length === 0 ? "Durum" : `Durum (${statusFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setStatusDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Durum seç</span>
                    {Array.isArray(statusFilter) && statusFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {statusOptions.map((status) => (
                    <label
                      key={status}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Array.isArray(statusFilter) && statusFilter.includes(status)}
                        onChange={(e) => {
                          const current = Array.isArray(statusFilter) ? statusFilter : [];
                          if (e.target.checked) {
                            setStatusFilter([...current, status]);
                          } else {
                            setStatusFilter(current.filter((s) => s !== status));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={cn(
                        "flex items-center gap-1.5",
                        /yapılacak|yapilacak|todo/i.test(status) && "text-slate-600 dark:text-slate-300",
                        /devam|sürüyor|progress/i.test(status) && "text-blue-600 dark:text-blue-400",
                        /tamamlandı|tamamlandi|done|completed/i.test(status) && "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {/yapılacak|yapilacak|todo/i.test(status) && <Circle className="h-3.5 w-3.5" />}
                        {/devam|sürüyor|progress/i.test(status) && <Loader2 className="h-3.5 w-3.5" />}
                        {/tamamlandı|tamamlandi|done|completed/i.test(status) && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {status}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Çoklu Atanan Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                Array.isArray(assigneeFilter) && assigneeFilter.length > 0
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <User className="h-4 w-4" />
              {!Array.isArray(assigneeFilter) || assigneeFilter.length === 0 ? "Atanan" : `Atanan (${assigneeFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {assigneeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAssigneeDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[300px] min-w-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Kişi seç</span>
                    {Array.isArray(assigneeFilter) && assigneeFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAssigneeFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {/* Atanmamış seçeneği */}
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={Array.isArray(assigneeFilter) && assigneeFilter.includes("__unassigned__")}
                      onChange={(e) => {
                        const current = Array.isArray(assigneeFilter) ? assigneeFilter : [];
                        if (e.target.checked) {
                          setAssigneeFilter([...current, "__unassigned__"]);
                        } else {
                          setAssigneeFilter(current.filter((a) => a !== "__unassigned__"));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <UserX className="h-3.5 w-3.5" />
                      Atanmamış
                    </span>
                  </label>
                  {/* Kişiler */}
                  {assigneeFilterOptions.map((assignee) => (
                    <label
                      key={assignee}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={Array.isArray(assigneeFilter) && assigneeFilter.includes(assignee)}
                        onChange={(e) => {
                          const current = Array.isArray(assigneeFilter) ? assigneeFilter : [];
                          if (e.target.checked) {
                            setAssigneeFilter([...current, assignee]);
                          } else {
                            setAssigneeFilter(current.filter((a) => a !== assignee));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <User className="h-3.5 w-3.5" />
                        {assignee.length > 25 ? assignee.slice(0, 25) + "..." : assignee}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Çoklu Proje Seçimi */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                Array.isArray(projectFilter) && projectFilter.length > 0
                  ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-900/30 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
              title="Görevleri ait oldukları projeye göre filtrele"
            >
              <FolderKanban className="h-4 w-4" />
              {!Array.isArray(projectFilter) || projectFilter.length === 0 ? "Proje" : `Proje (${projectFilter.length})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {projectDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProjectDropdownOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[320px] min-w-[240px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Proje seç</span>
                    {Array.isArray(projectFilter) && projectFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProjectFilter([])}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  {projectFilterOptions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                      Görüntülenebilir proje yok.
                    </div>
                  ) : (
                    projectFilterOptions.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={Array.isArray(projectFilter) && projectFilter.includes(p.id)}
                          onChange={(e) => {
                            const current = Array.isArray(projectFilter) ? projectFilter : [];
                            if (e.target.checked) {
                              setProjectFilter([...current, p.id]);
                            } else {
                              setProjectFilter(current.filter((id) => id !== p.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <FolderKanban className="h-3.5 w-3.5" />
                          {p.name.length > 28 ? p.name.slice(0, 28) + "..." : p.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Tarih kontrolü — modern dropdown + custom range kapsülü */}
          {(() => {
            // Preset etiketleri ve ikonları — modern lucide ile
            const datePresetMeta: Record<string, { label: string; icon: typeof Calendar; tint: string }> = {
              custom: { label: "Tarih aralığı", icon: CalendarRange, tint: "text-slate-500" },
              today: { label: "Bugün", icon: CalendarClock, tint: "text-blue-600" },
              tomorrow: { label: "Yarın", icon: Sunrise, tint: "text-amber-600" },
              thisWeek: { label: "Bu hafta", icon: CalendarDays, tint: "text-indigo-600" },
              nextWeek: { label: "Gelecek hafta", icon: CalendarDays, tint: "text-indigo-600" },
              thisMonth: { label: "Bu ay", icon: Calendar, tint: "text-violet-600" },
              nextMonth: { label: "Gelecek ay", icon: Calendar, tint: "text-violet-600" },
              last7days: { label: "Son 7 gün", icon: History, tint: "text-slate-600" },
              last30days: { label: "Son 30 gün", icon: History, tint: "text-slate-600" },
            };
            const meta = datePresetMeta[datePreset] ?? datePresetMeta.custom;
            const PresetIcon = meta.icon;
            const isActive = Boolean(dateFrom || dateTo);

            const presetButton = (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                      "bg-white dark:bg-slate-900",
                      isActive
                        ? "border-indigo-300 text-indigo-800 hover:border-indigo-400 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/60"
                    )}
                    aria-label="Tarih aralığı seç"
                  >
                    <PresetIcon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : meta.tint)} aria-hidden />
                    <span>{meta.label}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => applyDatePreset("custom")} className="gap-2">
                    <CalendarRange className="h-4 w-4 text-slate-500" aria-hidden />
                    <span className="flex-1">Özel aralık</span>
                    {datePreset === "custom" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Gelecek</div>
                  <DropdownMenuItem onClick={() => applyDatePreset("today")} className="gap-2">
                    <CalendarClock className="h-4 w-4 text-blue-600" aria-hidden />
                    <span className="flex-1">Bugün</span>
                    {datePreset === "today" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("tomorrow")} className="gap-2">
                    <Sunrise className="h-4 w-4 text-amber-600" aria-hidden />
                    <span className="flex-1">Yarın</span>
                    {datePreset === "tomorrow" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("thisWeek")} className="gap-2">
                    <CalendarDays className="h-4 w-4 text-indigo-600" aria-hidden />
                    <span className="flex-1">Bu hafta (7 gün)</span>
                    {datePreset === "thisWeek" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("nextWeek")} className="gap-2">
                    <CalendarDays className="h-4 w-4 text-indigo-600" aria-hidden />
                    <span className="flex-1">Gelecek hafta</span>
                    {datePreset === "nextWeek" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("thisMonth")} className="gap-2">
                    <Calendar className="h-4 w-4 text-violet-600" aria-hidden />
                    <span className="flex-1">Bu ay</span>
                    {datePreset === "thisMonth" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("nextMonth")} className="gap-2">
                    <Calendar className="h-4 w-4 text-violet-600" aria-hidden />
                    <span className="flex-1">Gelecek ay</span>
                    {datePreset === "nextMonth" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Geçmiş</div>
                  <DropdownMenuItem onClick={() => applyDatePreset("last7days")} className="gap-2">
                    <History className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
                    <span className="flex-1">Son 7 gün</span>
                    {datePreset === "last7days" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyDatePreset("last30days")} className="gap-2">
                    <History className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
                    <span className="flex-1">Son 30 gün</span>
                    {datePreset === "last30days" && <Check className="h-3.5 w-3.5 text-indigo-600" aria-hidden />}
                  </DropdownMenuItem>
                  {isActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                          setDatePreset("custom");
                        }}
                        className="gap-2 text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
                      >
                        <X className="h-4 w-4" aria-hidden />
                        <span className="flex-1">Temizle</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );

            // Custom range kapsülü — modern kompozit input
            const customRangeCapsule = datePreset === "custom" ? (
              <div
                className={cn(
                  "inline-flex h-8 items-center overflow-hidden rounded-md border bg-white text-xs shadow-sm transition-colors dark:bg-slate-900",
                  isActive
                    ? "border-indigo-300 ring-1 ring-indigo-200/60 dark:border-indigo-700 dark:ring-indigo-900/40"
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                <div className="flex items-center gap-1 border-r border-slate-200 px-2 dark:border-slate-700">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="w-[120px] border-0 bg-transparent px-1 text-slate-700 outline-none focus:outline-none focus:ring-0 dark:text-slate-200 [color-scheme:light] dark:[color-scheme:dark]"
                    aria-label="Başlangıç tarihi"
                    placeholder="Başlangıç"
                  />
                </div>
                <ArrowRight className="mx-1.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                <div className="flex items-center gap-1 border-l border-slate-200 px-2 dark:border-slate-700">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="w-[120px] border-0 bg-transparent px-1 text-slate-700 outline-none focus:outline-none focus:ring-0 dark:text-slate-200 [color-scheme:light] dark:[color-scheme:dark]"
                    aria-label="Bitiş tarihi"
                    placeholder="Bitiş"
                  />
                </div>
                {isActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="flex h-full items-center border-l border-slate-200 px-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-950/30"
                    title="Tarih aralığını temizle"
                    aria-label="Temizle"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </div>
            ) : null;

            // Preset seçildi + aktif aralık — özet rozeti
            const activePresetBadge = datePreset !== "custom" && isActive ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span>{dateFrom}</span>
                <ArrowRight className="h-2.5 w-2.5 opacity-60" aria-hidden />
                <span>{dateTo}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setDatePreset("custom");
                  }}
                  className="ml-1 -mr-1 rounded p-0.5 text-indigo-600/70 transition-colors hover:bg-indigo-100 hover:text-indigo-800 dark:text-indigo-300/70 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-100"
                  title="Tarih aralığını temizle"
                  aria-label="Temizle"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ) : null;

            return (
              <>
                {presetButton}
                {customRangeCapsule}
                {activePresetBadge}
              </>
            );
          })()}
          {/* /Hızlı filtre dropdownları */}

          {/* Görünüm kontrolleri — sağa hizalı */}
          <div
            className={cn(
              "ml-auto flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1",
              isModernTemplate
                ? "rounded-xl border-slate-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
            )}
            onDoubleClick={(e) => {
              const tag = (e.target as HTMLElement).tagName;
              if (["BUTTON", "INPUT", "SELECT", "TEXTAREA", "LABEL"].includes(tag)) return;
              if ((e.target as HTMLElement).closest("button, input, select, textarea, [role=button]")) return;
              setIsFullWidth((p) => !p);
            }}
            title="Çift tık ile tabloyu genişlet/daralt · F ile kısayol"
          >
            <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:inline">
              Görünüm
            </span>
            {canAutoSizeColumns && (
              <Button
                type="button"
                variant={fitToContent ? "default" : "outline"}
                size="icon"
                onClick={handleAutoSizeColumns}
                aria-pressed={fitToContent}
                className="h-8 w-8"
                aria-label={fitToContent ? "Varsayılan sütun genişliğine dön" : "Sütunları içeriğe göre genişlet"}
                title={
                  fitToContent
                    ? "Aktif: tüm sütunlar içerik genişliğinde · tıkla, varsayılana dön"
                    : "Sütunları metin uzunluğuna açar (yatay scroll çıkabilir)"
                }
              >
                {fitToContent ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              </Button>
            )}
            <label htmlFor="live-table-density" className="sr-only">
              Görünüm yoğunluğu
            </label>
            <select
              id="live-table-density"
              value={tableDensity}
              onChange={(e) => updateSetting("liveTableDensity", e.target.value as LiveTableDensity)}
              title="Satır aralığı ve yazı boyutu"
              className={cn(
                "h-8 rounded-md border px-2 text-xs focus:outline-none",
                isModernTemplate
                  ? "border-slate-300 bg-slate-50 text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-slate-500 dark:focus:ring-slate-600/40"
                  : "border-slate-300 bg-white text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <option value="compact">Yoğun</option>
              <option value="normal">Normal</option>
              <option value="comfortable">Büyük</option>
            </select>
            <label htmlFor="live-table-template" className="sr-only">
              Canlı Tablo şablonu
            </label>
            <select
              id="live-table-template"
              value={tableTemplate}
              onChange={(e) => updateSetting("liveTableTemplate", e.target.value as LiveTableTemplate)}
              title="Tablo şablonu"
              className={cn(
                "h-8 rounded-md border px-2 text-xs focus:outline-none",
                isModernTemplate
                  ? "border-slate-300 bg-slate-50 text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-slate-500 dark:focus:ring-slate-600/40"
                  : "border-slate-300 bg-white text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              <option value="classic">Klasik</option>
              <option value="modern">Modern</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsFullWidth((p) => !p)}
              className={cn(
                "h-8 w-8",
                isModernTemplate
                  ? "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  : "text-slate-700 dark:text-slate-300"
              )}
              aria-label={isFullWidth ? "Daralt (Esc)" : "Tabloyu genişlet (Shift+F)"}
              title={isFullWidth ? "Daralt — Esc" : "Tabloyu genişlet — Shift+F · çift tık"}
              aria-pressed={isFullWidth}
            >
              {isFullWidth ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              isModernTemplate
                ? "rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {table.getFilteredRowModel().rows.length} / {tasks.length} kayıt
          </span>
        </div>
        </div>
        {/* Aktif filtre özeti — sadece varsa gösterilir, minimum yer kaplar */}
        {activeFilterCount > 0 && (
          <div className={cn("flex flex-wrap items-center gap-1.5 px-0.5", isModernTemplate && "live-table-modern-active-filters")}>
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Aktif filtreler:
            </span>
            
            {/* Arama Filtresi */}
            {globalSearch.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                <Search className="h-3 w-3" />
                &quot;{globalSearch.length > 15 ? globalSearch.slice(0, 15) + "..." : globalSearch}&quot;
                <button
                  type="button"
                  onClick={() => setGlobalSearch("")}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-800"
                  title="Aramayı temizle"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Durum Filtreleri - Çoklu */}
            {(Array.isArray(statusFilter) ? statusFilter : []).map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              >
                {status === "Yapılacak" && <Circle className="h-3 w-3" />}
                {status === "Devam ediyor" && <Loader2 className="h-3 w-3" />}
                {status === "Tamamlandı" && <CheckCircle2 className="h-3 w-3" />}
                {status}
                <button
                  type="button"
                  onClick={() => setStatusFilter((Array.isArray(statusFilter) ? statusFilter : []).filter((s) => s !== status))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800"
                  title={`"${status}" filtresini kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Atanan Filtreleri - Çoklu */}
            {(Array.isArray(assigneeFilter) ? assigneeFilter : []).map((assignee) => (
              <span
                key={assignee}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                {assignee === "__unassigned__" ? <UserX className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {assignee === "__unassigned__" ? "Atanmamış" : (assignee.length > 15 ? assignee.slice(0, 15) + "..." : assignee)}
                <button
                  type="button"
                  onClick={() => setAssigneeFilter((Array.isArray(assigneeFilter) ? assigneeFilter : []).filter((a) => a !== assignee))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800"
                  title={`"${assignee === "__unassigned__" ? "Atanmamış" : assignee}" filtresini kaldır`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Proje Filtreleri - Çoklu */}
            {(Array.isArray(projectFilter) ? projectFilter : []).map((pid) => {
              const p = projectById.get(pid);
              const name = (p?.name ?? "").trim() || "(adsız proje)";
              return (
                <span
                  key={pid}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                >
                  <FolderKanban className="h-3 w-3" />
                  {name.length > 18 ? name.slice(0, 18) + "..." : name}
                  <button
                    type="button"
                    onClick={() => setProjectFilter((Array.isArray(projectFilter) ? projectFilter : []).filter((id) => id !== pid))}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-sky-200 dark:hover:bg-sky-800"
                    title={`"${name}" projesini filtre dışı bırak`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

            {/* Tarih Filtresi */}
            {(dateFrom || dateTo || datePreset !== "custom") && (
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                <Calendar className="h-3 w-3" />
                {datePreset === "today" && "Bugün"}
                {datePreset === "tomorrow" && "Yarın"}
                {datePreset === "thisWeek" && "Bu hafta"}
                {datePreset === "nextWeek" && "Gelecek hafta"}
                {datePreset === "thisMonth" && "Bu ay"}
                {datePreset === "nextMonth" && "Gelecek ay"}
                {datePreset === "last7days" && "Son 7 gün"}
                {datePreset === "last30days" && "Son 30 gün"}
                {datePreset === "custom" && dateFrom && dateTo && `${dateFrom} → ${dateTo}`}
                {datePreset === "custom" && dateFrom && !dateTo && `${dateFrom}'den itibaren`}
                {datePreset === "custom" && !dateFrom && dateTo && `${dateTo}'e kadar`}
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setDatePreset("custom");
                  }}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800"
                  title="Tarih filtresini kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Gelişmiş filtre özeti */}
            {activeAdvancedFilterRuleCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-200">
                <ListFilter className="h-3 w-3 shrink-0" aria-hidden />
                Gelişmiş ({activeAdvancedFilterRuleCount} kural)
                <button
                  type="button"
                  onClick={() => setAdvancedFilterRules([])}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                  title="Gelişmiş kuralları kaldır"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {/* Sütun Filtreleri - Excel tarzı */}
            {Object.entries(columnFilters).filter(([, values]) => values.length > 0).map(([colId, values]) => {
              const colLabel = colId.startsWith("extra:") 
                ? colId.replace("extra:", "") 
                : colId === "content" ? "Görev" 
                : colId === "status" ? "Durum" 
                : colId === "assignee" ? "Atanan" 
                : colId === "priority" ? "Öncelik"
                : colId === "due_date" ? "Bitiş"
                : colId;
              const displayValues = values.map(v => 
                v === "__empty__" ? "(Boş)" : v === "__filled__" ? "(Dolu)" : v
              ).join(", ");
              return (
                <span
                  key={colId}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800 dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  <span className="font-semibold">{colLabel}:</span>
                  <span className="max-w-[150px] truncate" title={displayValues}>
                    {displayValues.length > 25 ? displayValues.slice(0, 25) + "..." : displayValues}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter(colId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-cyan-200 dark:hover:bg-cyan-800"
                    title={`"${colLabel}" filtresini kaldır`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

            {/* Ayırıcı ve Tümünü Temizle */}
            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
              title="Tüm filtreleri temizle"
            >
              <X className="h-3.5 w-3.5" />
              Tümünü temizle
            </button>
          </div>
        )}
      </div>
      <div
        className={cn(
          "order-[-2] sticky z-20 flex shrink-0 flex-col gap-0 border-b border-slate-200 bg-white shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-950 supports-[backdrop-filter]:bg-white/90 dark:supports-[backdrop-filter]:bg-slate-950/90",
          "top-0"
        )}
      >
        {/* Eski "internal title row" — Sprint X3a TopStrip eklendiğinde duplikasyon
            oluşturuyordu. Tüm içerik (Canlı Tablo + realtime chip + TaskStats +
            Proje odaklı pill + OnlineUsersPanel) artık TopStrip'te. Burası kalmaz. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          {viewTabs && <div className="mr-auto shrink-0">{viewTabs}</div>}
          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
            Görünümler
          </span>
          <SavedViewsControl
            getCurrentConfig={getCurrentViewConfig}
            onApplyConfig={applyViewConfig}
            isAdmin={isAdmin}
            userId={user?.id ?? null}
            projectId={projectFilter.length === 1 ? projectFilter[0] : null}
            syncActiveViewId={syncActiveViewId}
          />
          {canManageColumns && (
            <>
            <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
              Kolonlar
            </span>
            <Dialog open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-slate-700 dark:text-slate-300"
                onClick={openColumnPicker}
              >
                <Columns3 className="mr-1.5 h-3.5 w-3.5" />
                Kolonlar
              </Button>
              <DialogContent
                className="flex max-h-[min(90dvh,36rem)] max-w-md flex-col gap-0 overflow-hidden rounded-xl border-slate-200/80 p-0 shadow-2xl shadow-slate-900/10 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-100 dark:shadow-black/30 sm:max-w-md"
                showClose
              >
                <div className="shrink-0 space-y-3 border-b border-slate-200/80 bg-slate-50/40 px-5 pb-3 pt-5 dark:border-slate-700/80 dark:bg-slate-900/30">
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 ring-1 ring-blue-600/20 dark:bg-blue-500/15 dark:ring-blue-500/30">
                        <Columns3 className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" aria-hidden />
                      </span>
                      Sütun görünürlüğü
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
                      Bir rozete tıkla; sütun anında gösterilir veya gizlenir. Dolu = görünür, soluk = gizli.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const ids = table
                          .getAllLeafColumns()
                          .filter((c) => c.getCanHide())
                          .map((c) => c.id);
                        setManyColumnVisibilityInstant(ids, true);
                      }}
                    >
                      Tümünü göster
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        const ids = table
                          .getAllLeafColumns()
                          .filter((c) => c.getCanHide())
                          .map((c) => c.id);
                        setManyColumnVisibilityInstant(ids, false);
                      }}
                    >
                      Hepsini gizle
                    </Button>
                    <div className="relative ml-auto flex-1 min-w-[140px]">
                      <Search
                        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                        aria-hidden
                      />
                      <input
                        type="search"
                        autoComplete="off"
                        placeholder="Sütun ara…"
                        value={columnPickerSearch}
                        onChange={(e) => setColumnPickerSearch(e.target.value)}
                        className="h-7 w-full rounded-md border border-slate-200 bg-white py-1 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  {(() => {
                    const q = columnPickerSearch.trim().toLowerCase();
                    const allCols = table.getAllLeafColumns();
                    const matches = allCols.filter((col) => {
                      const label =
                        COLUMN_VISIBILITY_LABELS[col.id] ??
                        (String(col.id).startsWith("extra:")
                          ? String(col.id).replace(/^extra:/, "")
                          : col.id);
                      return q === "" || label.toLowerCase().includes(q);
                    });
                    const baseCols = matches.filter((c) => !c.id.startsWith("extra:"));
                    const extraCols = matches.filter((c) => c.id.startsWith("extra:"));

                    const renderChip = (col: (typeof matches)[number]) => {
                      const label =
                        COLUMN_VISIBILITY_LABELS[col.id] ??
                        (String(col.id).startsWith("extra:")
                          ? String(col.id).replace(/^extra:/, "")
                          : col.id);
                      const canHide = col.getCanHide();
                      const visible = col.getIsVisible();
                      return (
                        <button
                          key={col.id}
                          type="button"
                          disabled={!canHide}
                          onClick={() => {
                            if (!canHide) return;
                            toggleColumnVisibilityInstant(col.id, !visible);
                          }}
                          aria-pressed={visible}
                          title={
                            !canHide
                              ? "Bu sütun zorunlu — gizlenemez"
                              : visible
                                ? "Tıkla: gizle"
                                : "Tıkla: göster"
                          }
                          className={cn(
                            "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                            visible
                              ? "border-blue-300 bg-blue-100 text-blue-800 shadow-sm hover:bg-blue-200 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-900/60"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200",
                            !canHide && "cursor-not-allowed opacity-70 hover:bg-white dark:hover:bg-slate-800"
                          )}
                        >
                          {visible ? (
                            <Check className="h-3 w-3 shrink-0" aria-hidden />
                          ) : (
                            <Circle className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                          )}
                          <span className="truncate max-w-[160px]">{label}</span>
                          {!canHide && (
                            <span className="ml-0.5 rounded-sm bg-slate-200 px-1 text-[9px] uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              zorunlu
                            </span>
                          )}
                        </button>
                      );
                    };

                    if (matches.length === 0) {
                      return (
                        <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                          “{columnPickerSearch}” için sütun bulunamadı
                        </div>
                      );
                    }

                    return (
                      <>
                        {baseCols.length > 0 && (
                          <section>
                            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Sabit sütunlar ({baseCols.filter((c) => c.getIsVisible()).length}/{baseCols.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">{baseCols.map(renderChip)}</div>
                          </section>
                        )}
                        {extraCols.length > 0 && (
                          <section>
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Ek sütunlar ({extraCols.filter((c) => c.getIsVisible()).length}/{extraCols.length})
                              </h4>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="text-[10px] font-medium uppercase tracking-wide text-blue-600 hover:underline dark:text-blue-400"
                                  onClick={() =>
                                    setManyColumnVisibilityInstant(
                                      extraCols.map((c) => c.id),
                                      true
                                    )
                                  }
                                >
                                  Tümü
                                </button>
                                <span className="text-[10px] text-slate-400">·</span>
                                <button
                                  type="button"
                                  className="text-[10px] font-medium uppercase tracking-wide text-slate-500 hover:underline dark:text-slate-400"
                                  onClick={() =>
                                    setManyColumnVisibilityInstant(
                                      extraCols.map((c) => c.id),
                                      false
                                    )
                                  }
                                >
                                  Hiçbiri
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">{extraCols.map(renderChip)}</div>
                          </section>
                        )}
                      </>
                    );
                  })()}
                </div>
                <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex w-full items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {table.getAllLeafColumns().filter((c) => c.getIsVisible()).length} /{" "}
                      {table.getAllLeafColumns().length} sütun görünür
                    </span>
                    <Button type="button" size="sm" onClick={() => setColumnPickerOpen(false)}>
                      Kapat
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-slate-700 dark:text-slate-300"
              onClick={resetColumnOrderToDefault}
              title="Sütun sırasını ve sabitlemeleri varsayılan düzene alır (görünürlük / genişlik değişmez)"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">Sütun sırasını varsayılana al</span>
            </Button>
            </>
          )}
          {(canImportCsv || canCreateTask) && (
            <>
              <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
                Veri
              </span>
            </>
          )}
          {canImportCsv && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="text-slate-700 dark:text-slate-300"
              title="CSV içe aktar"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">CSV içe aktar</span>
            </Button>
          )}
          {canExportCsv && (
            <>
              <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 lg:inline-block" />
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 lg:inline">
                Paylaşım
              </span>
            </>
          )}
          {canExportCsv && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-slate-700 dark:text-slate-300"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Dışa aktar
            </Button>
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogContent
                className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-0 shadow-[0_24px_64px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95"
                showClose
              >
                <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-white/80 to-blue-50/40 px-6 py-5 dark:border-slate-700/80 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-blue-950/20">
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                      Dışa aktar
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                      Verileri güvenli kapsamınız içinde indirin veya paylaşın.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Yetki kapsamı
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{exportScopeLabel}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{exportSensitivityLabel}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100">
                      {exportCurrentRows.length} satır
                    </span>
                  </div>
                </div>

                <div className="space-y-4 px-6 py-5">
                  {canExportSensitiveUnmasked && (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm backdrop-blur-sm",
                        exportUnmaskSensitive
                          ? "border-amber-300/80 bg-amber-50/90 dark:border-amber-700/60 dark:bg-amber-950/35"
                          : "border-slate-200/80 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          exportUnmaskSensitive
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                            : "bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400"
                        )}
                      >
                        <LockKeyhole className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              Hassas verileri AÇIK indir
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                              TCKN/sicil/personel no maskeli yerine ham yazılır.{" "}
                              <span className="font-medium text-amber-700 dark:text-amber-300">Özel yetki gerekir.</span>
                            </p>
                          </div>
                          <ExportToggleSwitch
                            id="export-unmask-toggle"
                            checked={exportUnmaskSensitive}
                            onChange={setExportUnmaskSensitive}
                            aria-label="Hassas verileri açık indir"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {!canExportAllRows && (
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                      Üye export kapsamı yalnızca düzenleyebildiğiniz satırlarla sınırlıdır.
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Otomatik Sıra</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Dışa aktarılan her satıra 1&apos;den başlayan sıra numarası ekler.
                      </p>
                    </div>
                    <ExportToggleSwitch
                      id="export-auto-row-toggle"
                      checked={exportIncludeAutoRowNumber}
                      onChange={setExportIncludeAutoRowNumber}
                      aria-label="Otomatik sıra numarası ekle"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white/90 to-slate-50/50 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-950/40">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            Mevcut görünüm
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Filtre ve sıralama uygulanmış</p>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          {exportCurrentRows.length}
                        </span>
                      </div>
                      <div className="grid gap-2">
                        <ExportFormatButton
                          label="CSV"
                          sublabel=".csv indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportCSV("current");
                          }}
                        />
                        <ExportFormatButton
                          label="Excel"
                          sublabel=".xlsx indir"
                          icon={<Table2 className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportExcel("current");
                          }}
                        />
                        <ExportFormatButton
                          label="PDF"
                          sublabel="Önizleme ile indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            openPdfDialog("current");
                          }}
                        />
                        <ExportFormatButton
                          label="E-posta şablonu"
                          sublabel="HTML kopyala"
                          icon={<Mail className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"
                          onClick={() => {
                            setExportDialogOpen(false);
                            openEmailDialog("current");
                          }}
                        />
                      </div>
                    </section>

                    <section
                      className={cn(
                        "rounded-xl border p-4 shadow-sm",
                        canExportAllRows
                          ? "border-slate-200/80 bg-gradient-to-b from-white/90 to-slate-50/50 dark:border-slate-700 dark:from-slate-900/80 dark:to-slate-950/40"
                          : "border-dashed border-slate-200 bg-slate-50/40 opacity-70 dark:border-slate-700 dark:bg-slate-900/30"
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            Tüm veri
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Ham / yetkili tam kapsam</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {exportAllRows.length}
                        </span>
                      </div>
                      <div className="grid gap-2">
                        <ExportFormatButton
                          label="CSV"
                          sublabel=".csv indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportCSV("all");
                          }}
                        />
                        <ExportFormatButton
                          label="Excel"
                          sublabel=".xlsx indir"
                          icon={<Table2 className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            handleExportExcel("all");
                          }}
                        />
                        <ExportFormatButton
                          label="PDF"
                          sublabel="Önizleme ile indir"
                          icon={<FileText className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            openPdfDialog("all");
                          }}
                        />
                        <ExportFormatButton
                          label="E-posta şablonu"
                          sublabel="HTML kopyala"
                          icon={<Mail className="h-5 w-5" aria-hidden />}
                          iconWrapClass="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"
                          disabled={!canExportAllRows}
                          onClick={() => {
                            setExportDialogOpen(false);
                            openEmailDialog("all");
                          }}
                        />
                      </div>
                    </section>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
          )}
          <RestrictedButton
            permission="liveTable.createTask"
            type="button"
            size="sm"
            onClick={() => setNewTaskOpen(true)}
            aria-label="Yeni görev"
            className="bg-orange-500 text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 focus-visible:ring-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400 dark:focus-visible:ring-orange-400"
          >
            <PlusCircle className="h-4 w-4 shrink-0 sm:mr-2" aria-hidden />
            <span className="hidden sm:inline">Yeni görev</span>
          </RestrictedButton>
        </div>
      </div>
      {/* ─── SelectionBar — fixed slide-up panel ───
          Önceden satır arası inline'dı; artık alt orta noktada sabit kart olarak çıkar.
          Mobil için MobileBottomNav (≈4rem) üzerinde, safe-area uyumlu.
          Çoklu eylem: sayım + Durumu güncelle + Sil + Kapat (X).
          animate-in slide-in-from-bottom-2 ile yumuşak giriş. */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Toplu işlemler"
          className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)",
          }}
        >
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-black/30 md:bottom-4 sm:gap-3 sm:px-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-100">
              <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold tabular-nums text-white">
                {selectedIds.length}
              </span>
              <span className="hidden sm:inline">kayıt seçili</span>
              <span className="sm:hidden">seçili</span>
            </span>
            <span className="mx-1 hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            {selectedCanBulkUpdate && (
              <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
                    <Activity className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Durumu güncelle</span>
                    <span className="sm:hidden">Durum</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" sideOffset={8}>
                  {statusOptions.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => handleBulkStatusUpdate(s)}>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {selectedCanBulkDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                onClick={() => setBulkDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Seçilenleri sil</span>
                <span className="sm:hidden">Sil</span>
              </Button>
            )}
            <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={() => setRowSelection({})}
              aria-label="Seçimi temizle"
              title="Seçimi temizle"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Temizle</span>
            </Button>
          </div>
        </div>
      )}
      <Dialog open={pdfDialogOpen} onOpenChange={handlePdfDialogOpenChange}>
        <DialogContent className="h-[min(92vh,920px)] max-w-[min(96vw,1440px)] overflow-hidden border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" showClose>
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="shrink-0 border-b border-slate-200 px-5 py-4 text-left dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div>
                  <DialogTitle>PDF İndir</DialogTitle>
                  <DialogDescription>
                    {pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm"} için indirilecek PDF&apos;i geniş önizleme alanında kontrol edin.
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {selectedPdfRows.length} satır
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm"}
                  </span>
                  {selectedManagedReportTemplate && (
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                      {selectedManagedReportTemplate.template_config.pdfPageSize} · {selectedManagedReportTemplate.template_config.pdfOrientation === "portrait" ? "Dikey" : "Yatay"}
                    </span>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 bg-slate-100 dark:bg-slate-950 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                <div>
                  <label htmlFor="pdf-report-template" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Rapor şablonu
                  </label>
                  <select
                    id="pdf-report-template"
                    value={reportTemplateSelection}
                    onChange={(e) => applyReportTemplate(e.target.value as ReportTemplateSelection)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {Object.entries(REPORT_TEMPLATES).map(([id, template]) => (
                      <option key={id} value={builtinReportTemplateSelection(id as ReportTemplateId)}>
                        {template.label}
                      </option>
                    ))}
                    {savedReportTemplates.length > 0 && (
                      <optgroup label="Kayıtlı özel şablonlar">
                        {savedReportTemplates.map((template) => (
                          <option key={template.id} value={customReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {availableManagedReportTemplates.length > 0 && (
                      <optgroup label="Kurumsal şablonlar">
                        {availableManagedReportTemplates.map((template) => (
                          <option key={template.id} value={managedReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedReportTemplate.description}
                  </p>
                  {selectedManagedReportTemplate &&
                    (selectedManagedReportTemplate.template_config.defaultFilterPresets.length > 0 ||
                      selectedManagedReportTemplate.template_config.defaultSavedViewId ||
                      selectedManagedReportTemplate.template_config.showLogo ||
                      selectedManagedReportTemplate.template_config.coverNote ||
                      selectedManagedReportTemplate.template_config.summaryBullets.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1.5 dark:border-blue-800 dark:bg-blue-950/30">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Şablon ayarları:
                        </span>
                        {selectedManagedReportTemplate.template_config.showLogo && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            🏷 Logo bandı
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.coverNote && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            📝 Kapak notu
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.summaryBullets.length > 0 && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            ✦ Özet ({selectedManagedReportTemplate.template_config.summaryBullets.length})
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.defaultFilterPresets.map((id) => (
                          <span key={id} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            ⚡ {FILTER_PRESET_LABELS[id]}
                          </span>
                        ))}
                        {selectedManagedReportTemplate.template_config.defaultSavedViewId && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            📌 Kayıtlı görünüm
                          </span>
                        )}
                      </div>
                    )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void saveCurrentReportTemplate()}>
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Kaydet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deleteSelectedReportTemplate}
                      disabled={!selectedCustomReportTemplate}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Sil
                    </Button>
                  </div>
                </div>
                <div>
                  <label htmlFor="pdf-title-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Belge Başlığı
                  </label>
                  <input
                    id="pdf-title-input"
                    type="text"
                    value={pdfTitleInput}
                    onChange={(e) => {
                      setPdfTitleInput(e.target.value);
                      if (pdfPreviewUrl) {
                        URL.revokeObjectURL(pdfPreviewUrl);
                        setPdfPreviewUrl(null);
                      }
                    }}
                    placeholder="Görev Listesi"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void previewExportPDF();
                      }
                    }}
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {selectedPdfRows.length} satır PDF&apos;e eklenecek
                  </div>
                  <div className="mt-1">
                    Sütunlar canlı tablodaki görünür kolonlardan alınır.
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                  <input
                    type="checkbox"
                    checked={exportIncludeAutoRowNumber}
                    onChange={(e) => {
                      setExportIncludeAutoRowNumber(e.target.checked);
                      if (pdfPreviewUrl) {
                        URL.revokeObjectURL(pdfPreviewUrl);
                        setPdfPreviewUrl(null);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500"
                  />
                  <span className="leading-snug text-slate-700 dark:text-slate-200">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Otomatik Sıra</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                      İlk sütuna 1..{selectedPdfRows.length || "N"} arası sıra numarası ekler.
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void previewExportPDF()}
                  disabled={pdfPreviewLoading || pdfDownloadLoading}
                  className="w-full justify-center"
                >
                  {pdfPreviewLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Önizle
                </Button>
              </div>
              </aside>

              <section className="flex min-h-0 flex-col p-3 sm:p-4">
                <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {selectedPdfTitle || "Görev Listesi"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {pdfPreviewUrl ? "Önizleme hazır. İçeriği kontrol edip indirebilirsiniz." : "Önizleme oluşturulmadı."}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void previewExportPDF()}
                    disabled={pdfPreviewLoading || pdfDownloadLoading}
                  >
                    {pdfPreviewLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    Önizle
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-300 bg-slate-200 shadow-inner dark:border-slate-700 dark:bg-slate-950">
                  {pdfPreviewUrl ? (
                    <iframe
                      ref={pdfPreviewIframeRef}
                      title="PDF önizleme"
                      src={pdfPreviewUrl}
                      className="h-full w-full bg-white"
                    />
                  ) : (
                    <div className="flex h-full min-h-[34rem] items-center justify-center p-6">
                      <div className="max-w-sm rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                          <Eye className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">PDF önizlemesi hazır değil</div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          Şablon, başlık ve kapsamı kontrol ettikten sonra Önizle butonuna basın. PDF burada geniş görüntüleyici olarak açılır.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => handlePdfDialogOpenChange(false)} disabled={pdfDownloadLoading}>
                İptal
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={printPdfPreview}
                disabled={!pdfPreviewUrl || pdfPreviewLoading || pdfDownloadLoading}
                title={pdfPreviewUrl ? "Önizlemeyi yazıcıya gönder" : "Önce önizleme oluşturun"}
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden />
                Yazdır
              </Button>
              <Button type="button" onClick={() => void confirmExportPDF()} disabled={pdfDownloadLoading || pdfPreviewLoading}>
                {pdfDownloadLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                )}
                PDF indir
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" showClose>
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-slate-200 px-5 py-4 text-left dark:border-slate-700">
              <DialogTitle>E-posta şablonu</DialogTitle>
              <DialogDescription>
                {pdfDialogScope === "all" ? "Tüm veri" : "Mevcut görünüm"} için e-postaya yapıştırılabilir HTML şablonu oluşturulur.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[18rem_1fr]">
              <div className="space-y-4">
                <div>
                  <label htmlFor="email-report-template" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Rapor şablonu
                  </label>
                  <select
                    id="email-report-template"
                    value={reportTemplateSelection}
                    onChange={(e) => applyReportTemplate(e.target.value as ReportTemplateSelection)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {Object.entries(REPORT_TEMPLATES).map(([id, template]) => (
                      <option key={id} value={builtinReportTemplateSelection(id as ReportTemplateId)}>
                        {template.label}
                      </option>
                    ))}
                    {savedReportTemplates.length > 0 && (
                      <optgroup label="Kayıtlı özel şablonlar">
                        {savedReportTemplates.map((template) => (
                          <option key={template.id} value={customReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {availableManagedReportTemplates.length > 0 && (
                      <optgroup label="Kurumsal şablonlar">
                        {availableManagedReportTemplates.map((template) => (
                          <option key={template.id} value={managedReportTemplateSelection(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedReportTemplate.description}
                  </p>
                  {selectedManagedReportTemplate &&
                    (selectedManagedReportTemplate.template_config.defaultFilterPresets.length > 0 ||
                      selectedManagedReportTemplate.template_config.defaultSavedViewId ||
                      selectedManagedReportTemplate.template_config.showLogo ||
                      selectedManagedReportTemplate.template_config.coverNote ||
                      selectedManagedReportTemplate.template_config.summaryBullets.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1.5 dark:border-blue-800 dark:bg-blue-950/30">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Şablon ayarları:
                        </span>
                        {selectedManagedReportTemplate.template_config.showLogo && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            🏷 Logo bandı
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.coverNote && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            📝 Kapak notu
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.summaryBullets.length > 0 && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-blue-700">
                            ✦ Özet ({selectedManagedReportTemplate.template_config.summaryBullets.length})
                          </span>
                        )}
                        {selectedManagedReportTemplate.template_config.defaultFilterPresets.map((id) => (
                          <span key={id} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            ⚡ {FILTER_PRESET_LABELS[id]}
                          </span>
                        ))}
                        {selectedManagedReportTemplate.template_config.defaultSavedViewId && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700">
                            📌 Kayıtlı görünüm
                          </span>
                        )}
                      </div>
                    )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void saveCurrentReportTemplate()}>
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Kaydet
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deleteSelectedReportTemplate}
                      disabled={!selectedCustomReportTemplate}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Sil
                    </Button>
                  </div>
                </div>
                <div>
                  <label htmlFor="email-subject-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    E-posta konusu
                  </label>
                  <input
                    id="email-subject-input"
                    type="text"
                    value={emailSubjectInput}
                    onChange={(e) => {
                      setEmailSubjectInput(e.target.value);
                      setEmailCopied(false);
                    }}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {selectedPdfRows.length} satır e-posta şablonuna eklenecek
                  </div>
                  <div className="mt-1">
                    Mobil uyumlu mod ilk 30 kaydı kart olarak gösterir; tam liste için detaylı tabloyu seçin.
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Şablon tipi</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={emailTemplateMode === "mobile" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setEmailTemplateMode("mobile");
                        setEmailCopied(false);
                      }}
                    >
                      Mobil uyumlu
                    </Button>
                    <Button
                      type="button"
                      variant={emailTemplateMode === "table" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setEmailTemplateMode("table");
                        setEmailCopied(false);
                      }}
                    >
                      Detaylı tablo
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Düz metin önizleme</div>
                  <textarea
                    readOnly
                    value={emailTemplate.text}
                    className="h-56 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="min-h-[28rem] overflow-auto rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700">
                <div dangerouslySetInnerHTML={{ __html: emailTemplate.html }} />
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/80 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)}>
                Kapat
              </Button>
              <Button type="button" variant="outline" onClick={() => void copyEmailTemplate()}>
                {emailCopied ? (
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="mr-2 h-4 w-4" aria-hidden />
                )}
                {emailCopied ? "Kopyalandı" : "Şablonu kopyala"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={printEmailTemplate}
                title="Şablonu yazıcıya gönder veya PDF olarak kaydet"
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden />
                Yazdır
              </Button>
              <Button
                type="button"
                onClick={() => {
                  window.location.href = `mailto:?subject=${encodeURIComponent(emailTemplate.subject)}&body=${encodeURIComponent(emailTemplate.text)}`;
                }}
              >
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                Mailde aç
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md" showClose>
          <DialogHeader>
            <DialogTitle>Seçilen görevleri sil</DialogTitle>
            <DialogDescription>
              <strong>{selectedIds.length}</strong> görev kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setBulkDeleteConfirmOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void executeBulkDelete()}
              disabled={selectedIds.length === 0}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removeExtraColumnKey != null}
        onOpenChange={(open) => {
          if (!open && !removingExtraColumn) setRemoveExtraColumnKey(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showClose>
          <DialogHeader>
            <DialogTitle>Sütunu kaldır: “{removeExtraColumnKey}”</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                {removeExtraColumnImpact.projects.length === 0 && removeExtraColumnImpact.taskCount === 0 ? (
                  <p>Bu sütun aktif kapsamda görünmüyor; kaldıracak bir şey yok.</p>
                ) : (
                  <>
                    <p>
                      Aşağıdaki değişiklikler uygulanacak. <strong>Bu işlem geri alınamaz.</strong>
                    </p>
                    <ul className="ml-4 list-disc space-y-1">
                      <li>
                        <strong>{removeExtraColumnImpact.projects.length}</strong> projenin şemasından
                        (“Canlı tablo ek sütunları”) kaldırılacak.
                      </li>
                      <li>
                        <strong>{removeExtraColumnImpact.taskCount}</strong> görevdeki bu alanın verisi
                        silinecek.
                      </li>
                    </ul>
                    {removeExtraColumnImpact.projects.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Etkilenen projeler:{" "}
                        {removeExtraColumnImpact.projects
                          .slice(0, 3)
                          .map((p) => p.name)
                          .join(", ")}
                        {removeExtraColumnImpact.projects.length > 3
                          ? ` +${removeExtraColumnImpact.projects.length - 3} daha`
                          : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveExtraColumnKey(null)}
              disabled={removingExtraColumn}
            >
              İptal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void executeRemoveExtraColumn()}
              disabled={
                removingExtraColumn ||
                (removeExtraColumnImpact.projects.length === 0 &&
                  removeExtraColumnImpact.taskCount === 0)
              }
            >
              {removingExtraColumn ? "Kaldırılıyor…" : "Sütunu kaldır"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TooltipProvider delayDuration={200} skipDelayDuration={120}>
      {/* MOBİL — kart listesi (md altı). Boşsa hiç render etme; EmptyState aşağıda zaten gösterilir. */}
      {table.getRowModel().rows.length > 0 && (
      <div
        ref={mobileListScrollRef}
        className={cn(
          "flex-1 min-h-0 w-full overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/30 md:hidden",
          !isFullWidth && "max-h-[calc(100dvh-22rem)] sm:max-h-[calc(100dvh-20rem)]"
        )}
      >
        <ul className="flex flex-col gap-2" aria-label="Görev listesi">
            {table.getRowModel().rows.map((row) => {
              const t = row.original;
              const pName = t.project_id ? projectById.get(String(t.project_id))?.name ?? null : null;
              const rowCanEdit = canEditRow(t);
              return (
                <li key={row.id}>
                  <TaskCardMobile
                    task={t}
                    projectId={t.project_id ?? null}
                    projectName={pName}
                    extraKeys={extraDataKeys}
                    selected={row.getIsSelected()}
                    onToggleSelect={() => row.toggleSelected(!row.getIsSelected())}
                    dateFormat={settings.dateFormat}
                    urgentPrioritySet={urgentPrioritySetForTable}
                    now={now}
                    canEdit={rowCanEdit}
                    canDelete={rowCanEdit && canDeleteTask}
                    canCreate={rowCanEdit && canCreateTask && canCopyRow(t)}
                    onEdit={() => rowCanEdit && setEditTask(t)}
                    onCopy={() => canCopyRow(t) && handleCopyTask(t)}
                    onDelete={() => rowCanEdit && handleDeleteTask(t.id)}
                    onOpenDetail={() => {
                      if (!rowCanEdit) {
                        toast.info("Bu satır sana atanmadığı için detay ve yorum kapalı.");
                        return;
                      }
                      setDetailTask(t);
                    }}
                    isDeleting={deletingIds.has(t.id)}
                  />
                </li>
              );
            })}
          </ul>
      </div>
      )}
      {/* MASAÜSTÜ — tablo (md ve üstü) */}
      <div
        ref={liveTableScrollRef}
        className={cn(
          "hidden md:flex flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-auto isolate [overflow-anchor:none]",
          tableSkin.shell,
          requiresSingleProjectSelection && "!hidden",
          /* Sayfa düzeni flex’te bazen yükseklik sınırlanmıyor; viewport tavanı iç scroll + thead sticky’yi garanti eder (genişlet modunda portal zaten sınırlı). */
          !isFullWidth &&
            "md:max-h-[calc(100dvh-20rem)] lg:max-h-[calc(100dvh-18rem)] xl:max-h-[calc(100dvh-16rem)]",
          isFullWidth && "min-h-0 max-h-none flex-1",
          tasks.length > 0 && "min-h-[200px]"
        )}
      >
        <table
          className={cn("border-separate border-spacing-0 min-w-full", tableSkin.table, dui.table)}
          aria-describedby="live-table-caption"
          style={{
            tableLayout: "fixed",
            width:
              liveTableSumPx > 0 ? (liveTableNeedsHorizontalScroll ? `${liveTableSumPx}px` : "100%") : "100%",
            minWidth:
              liveTableSumPx > 0 ? (liveTableNeedsHorizontalScroll ? `${liveTableSumPx}px` : "100%") : "100%",
          }}
        >
          <caption id="live-table-caption" className="sr-only">
            Canlı görev tablosu. Sütun başlıklarını sürükleyerek sırayı değiştirebilir, kenardan genişletebilirsiniz. Sütun menüsü ile sabitleme ve sıfırlama yapılabilir.
          </caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => {
              const headers = headerGroup.headers;
              return (
              <tr key={headerGroup.id}>
                {headers.map((header) => {
                  const col = header.column;
                  const isPinnedLeft = col.getIsPinned() === "left";
                  const isPinnedRight = col.getIsPinned() === "right";
                  const resizeHandler = typeof header.getResizeHandler === "function" ? header.getResizeHandler() : undefined;
                  const wPx = Math.max(header.getSize(), 40);
                  return (
                    <th
                      key={header.id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      aria-sort={
                        col.getCanSort?.() && col.getIsSorted() === "asc"
                          ? "ascending"
                          : col.getCanSort?.() && col.getIsSorted() === "desc"
                            ? "descending"
                            : col.getCanSort?.()
                              ? "none"
                              : undefined
                      }
                      className={cn(
                        "relative sticky top-0 z-[15] select-none text-left backdrop-blur",
                        tableSkin.headCell,
                        dui.th,
                        isModernTemplate && MODERN_DENSITY_UI[tableDensity].th,
                        draggedColumnId === col.id && "opacity-50",
                        isPinnedLeft &&
                          "left-0 z-[25] shadow-[4px_0_10px_-4px_rgba(15,23,42,0.22),0_2px_8px_-5px_rgba(15,23,42,0.35)] dark:shadow-[4px_0_12px_-5px_rgba(0,0,0,0.75),0_2px_10px_-6px_rgba(0,0,0,0.8)]",
                        isPinnedRight &&
                          "right-0 z-[25] shadow-[-4px_0_10px_-4px_rgba(15,23,42,0.22),0_2px_8px_-5px_rgba(15,23,42,0.35)] dark:shadow-[-4px_0_12px_-5px_rgba(0,0,0,0.75),0_2px_10px_-6px_rgba(0,0,0,0.8)]",
                        (isPinnedLeft || isPinnedRight) && tableSkin.pinnedCell
                      )}
                      style={{
                        width: wPx,
                        minWidth: wPx,
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-1">
                        <span
                          draggable
                          onDragStart={(e) => handleDragStart(e, col.id)}
                          onDragEnd={handleDragEnd}
                          className="inline-flex shrink-0 cursor-grab items-center active:cursor-grabbing"
                          title="Sütunu sürükleyerek taşı"
                          aria-label="Sütunu sürükle"
                        >
                          <GripVertical className={cn(dui.grip, "text-slate-400/80 dark:text-slate-500")} aria-hidden />
                        </span>
                        {col.getCanSort?.() ? (
                          <button
                            type="button"
                            onClick={col.getToggleSortingHandler()}
                            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left hover:text-slate-950 dark:hover:text-white"
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {col.getIsSorted() === "asc" ? (
                              <ArrowUp className={cn(dui.sortIcon, "shrink-0 text-blue-600")} />
                            ) : col.getIsSorted() === "desc" ? (
                              <ArrowDown className={cn(dui.sortIcon, "shrink-0 text-blue-600")} />
                            ) : (
                              <ArrowUpDown className={cn(dui.sortIcon, "shrink-0 text-slate-400")} />
                            )}
                          </button>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-left">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        )}
                        {/* Excel tarzı sütun filtresi */}
                        {col.id !== "actions" && col.id !== "select" && (
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                dui.colFilterBtn,
                                "shrink-0",
                                columnFilters[col.id]?.length > 0
                                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
                                  : "text-slate-400 hover:text-slate-600"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setColumnFilterOpen(columnFilterOpen === col.id ? null : col.id);
                                setColumnFilterSearch("");
                              }}
                              aria-label="Sütun filtresi"
                              title={columnFilters[col.id]?.length > 0 ? `${columnFilters[col.id].length} filtre aktif` : "Filtrele"}
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              {columnFilters[col.id]?.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                                  {columnFilters[col.id].length}
                                </span>
                              )}
                            </Button>
                            {columnFilterOpen === col.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setColumnFilterOpen(null)} />
                                <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] max-h-[350px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                                  <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                      </span>
                                      {columnFilters[col.id]?.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => clearColumnFilter(col.id)}
                                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                          Temizle
                                        </button>
                                      )}
                                    </div>
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                      <input
                                        type="text"
                                        placeholder="Ara..."
                                        value={columnFilterSearch}
                                        onChange={(e) => setColumnFilterSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full rounded border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-[250px] overflow-y-auto p-2">
                                    {/* Özel seçenekler */}
                                    <div className="mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={columnFilters[col.id]?.includes("__empty__") || false}
                                          onChange={() => toggleColumnFilterValue(col.id, "__empty__")}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 italic">(Boş)</span>
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={columnFilters[col.id]?.includes("__filled__") || false}
                                          onChange={() => toggleColumnFilterValue(col.id, "__filled__")}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 italic">(Dolu)</span>
                                      </label>
                                    </div>
                                    {/* Benzersiz değerler */}
                                    {getUniqueValuesForColumn(col.id)
                                      .filter((v) => !columnFilterSearch || v.toLowerCase().includes(columnFilterSearch.toLowerCase()))
                                      .map((value) => (
                                        <label
                                          key={value}
                                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={columnFilters[col.id]?.includes(value) || false}
                                            onChange={() => toggleColumnFilterValue(col.id, value)}
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                                          />
                                          <span className="text-slate-700 dark:text-slate-300 truncate" title={value}>
                                            {value.length > 30 ? value.slice(0, 30) + "..." : value}
                                          </span>
                                        </label>
                                      ))}
                                    {getUniqueValuesForColumn(col.id).filter((v) => !columnFilterSearch || v.toLowerCase().includes(columnFilterSearch.toLowerCase())).length === 0 && (
                                      <div className="px-2 py-3 text-xs text-slate-400 text-center">
                                        {columnFilterSearch ? "Sonuç bulunamadı" : "Değer yok"}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className={cn(dui.colMenuBtn, "shrink-0 text-slate-500")} aria-label="Sütun menüsü">
                              <MoreVertical className={cn(dui.sortIcon)} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "left")}>Sol tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "right")}>Sağ tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "unpin")}>Sabitlemeyi kaldır</DropdownMenuItem>
                            {col.id.startsWith("extra:") && canEditProject && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                  onClick={() => setRemoveExtraColumnKey(col.id.slice("extra:".length))}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                                  Bu sütunu projeden kaldır…
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {col.getCanResize?.() && resizeHandler && (
                        <div
                          onMouseDown={resizeHandler}
                          onTouchStart={resizeHandler}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none",
                            "hover:bg-blue-400 hover:w-0.5 hover:right-[-1px]",
                            col.getIsResizing?.() && "bg-blue-500 w-0.5"
                          )}
                          title="Genişliği değiştirmek için sürükleyin"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
              );
            })}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rowEditors = editorsByRowId.get(row.original.id) ?? [];
              const rowCanEdit = canEditRow(row.original);
              const isEditedByOthers = rowEditors.length > 0;
              const isSelected = row.getIsSelected();
              const isSpotlightHit = spotlightActive && spotlightTaskIds.has(row.original.id);
              const automationState = rowAutomationStateByTaskId.get(row.original.id);
              const visibleCells = row.getVisibleCells();
              let rowTooltipBody: ReactNode | undefined;
              if (isEditedByOthers) {
                if (rowEditors.length === 1) {
                  const { primary, emailLine } = presenceEditorLines(rowEditors[0]);
                  rowTooltipBody = (
                    <>
                      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        Bu satırda düzenleme
                      </span>
                      <span className="mt-1.5 block text-base font-semibold leading-snug">{primary}</span>
                      {emailLine && (
                        <span className="mt-1 block break-all text-xs font-medium leading-snug opacity-90">
                          {emailLine}
                        </span>
                      )}
                    </>
                  );
                } else {
                  rowTooltipBody = (
                    <>
                      <span className="block text-[0.65rem] font-bold uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        Bu satırda düzenleme ({rowEditors.length})
                      </span>
                      <ul className="mt-2 max-h-40 list-none space-y-2 overflow-y-auto text-left text-sm font-semibold">
                        {rowEditors.map((e, i) => {
                          const { primary, emailLine } = presenceEditorLines(e);
                          return (
                            <li
                              key={i}
                              className="border-b border-violet-200/60 pb-2 last:border-0 last:pb-0 dark:border-violet-600/50"
                            >
                              <span className="block">{primary}</span>
                              {emailLine && (
                                <span className="mt-0.5 block break-all text-xs font-normal opacity-90">
                                  {emailLine}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  );
                }
              }
              const rowLockedByOthersBg = "";
              const pinnedDefaultBg = "bg-white dark:bg-slate-900";
              const pinnedBg = isEditedByOthers
                ? rowLockedByOthersBg
                : pinnedDefaultBg;
              const isRecentlyUpdated = recentlyUpdatedIds.has(row.original.id);
              /** Satır hover'ında "Son güncelleyen: X · Y önce" göstergesi (native tooltip) */
              const lastEditorTitle = (() => {
                const who = row.original.last_updated_by;
                const when = row.original.updated_at;
                if (!who && !when) return undefined;
                const whoLabel = who ? `Son güncelleyen: ${who}` : "";
                let whenLabel = "";
                if (when) {
                  try {
                    whenLabel = `${getRelativeTime(new Date(when))}`;
                  } catch {
                    whenLabel = "";
                  }
                }
                const lockLabel = automationState?.locked
                  ? `Otomasyon kilidi${automationState.lockedReason ? `: ${automationState.lockedReason}` : ""}`
                  : "";
                return [lockLabel, whoLabel, whenLabel].filter(Boolean).join(" · ");
              })();
              const rowClassName = cn(
                "group/row transition-[background-color,box-shadow,border-color] duration-150",
                tableSkin.row,
                isModernTemplate && "live-table-modern-row",
                rowCanEdit ? "cursor-default" : "cursor-default select-none",
                isRecentlyUpdated && "animate-[pulse_1.5s_ease-in-out_2]",
                automationState?.locked &&
                  !isEditedByOthers &&
                  "border-l-4 border-l-slate-500 shadow-[inset_0_0_0_1px_rgba(100,116,139,0.18)] dark:border-l-slate-400 dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]",
                isSelected && !isEditedByOthers && "border-l-4 border-l-blue-500 dark:border-l-blue-400",
                isEditedByOthers &&
                  "relative z-[1] cursor-default border-l-4 border-l-violet-500 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.16)] dark:border-l-violet-400 dark:shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2)]",
                isSpotlightHit && ""
              );
              const rowTooltipClass =
                "z-[400] max-w-[min(22rem,calc(100vw-2rem))] border-2 border-violet-500 bg-violet-100 px-3 py-2.5 text-sm font-semibold leading-snug text-violet-950 shadow-[0_8px_32px_rgba(0,0,0,0.18)] animate-in fade-in-0 zoom-in-95 dark:border-violet-400 dark:bg-violet-900/95 dark:text-violet-50 md:text-base";
              const rowCells = visibleCells.map((cell) => {
                const isPinnedLeft = cell.column.getIsPinned() === "left";
                const isPinnedRight = cell.column.getIsPinned() === "right";
                const wPx = Math.max(cell.column.getSize(), 40);
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      "align-middle transition-colors",
                      tableSkin.bodyCell,
                      dui.td,
                      isModernTemplate && MODERN_DENSITY_UI[tableDensity].td,
                      !rowCanEdit && "select-none",
                      isEditedByOthers && rowLockedByOthersBg,
                      isPinnedLeft && "sticky left-0 z-10 shadow-[4px_0_10px_-5px_rgba(15,23,42,0.18)] dark:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.75)]",
                      isPinnedRight && "sticky right-0 z-10 shadow-[-4px_0_10px_-5px_rgba(15,23,42,0.18)] dark:shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.75)]",
                      (isPinnedLeft || isPinnedRight) && cn(pinnedBg, tableSkin.pinnedCell)
                    )}
                    style={{
                      width: wPx,
                      minWidth: wPx,
                    }}
                  >
                    <div className="min-w-0 overflow-hidden text-slate-700 dark:text-slate-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </td>
                );
              });

              const claimRowPresence = () => setEditingRow(row.original.id);
              const rowPointerHandlers = {
                onPointerDown: claimRowPresence,
                title: lastEditorTitle,
              };

              if (rowTooltipBody != null && isEditedByOthers) {
                return (
                  <Tooltip
                    key={row.id}
                    delayDuration={80}
                    disableHoverableContent
                    open={presenceHoverRowId === row.id}
                    onOpenChange={(open) => {
                      if (!open) setPresenceHoverRowId((cur) => (cur === row.id ? null : cur));
                    }}
                  >
                    <TooltipTrigger asChild>
                      <tr
                        className={rowClassName}
                        data-selected={isSelected ? "true" : undefined}
                        data-spotlight-row={isSpotlightHit ? "true" : undefined}
                        {...rowPointerHandlers}
                        onPointerEnter={() => setPresenceHoverRowId(row.id)}
                        onPointerLeave={() =>
                          setPresenceHoverRowId((cur) => (cur === row.id ? null : cur))
                        }
                      >
                        {rowCells}
                      </tr>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10} className={rowTooltipClass}>
                      {rowTooltipBody}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return (
                <tr
                  key={row.id}
                  className={rowClassName}
                  data-selected={isSelected ? "true" : undefined}
                  data-spotlight-row={isSpotlightHit ? "true" : undefined}
                  {...rowPointerHandlers}
                >
                  {rowCells}
                </tr>
              );
            })}
            {canCreateTask && !requiresSingleProjectSelection && (
              <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80">
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="p-0"
                >
                  <div className="flex w-full items-stretch">
                    <button
                      type="button"
                      onClick={handleQuickAddRow}
                      className="group flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-500 transition-colors hover:bg-blue-50/80 hover:text-blue-700 focus:bg-blue-50/80 focus:text-blue-700 focus:outline-none dark:text-slate-400 dark:hover:bg-blue-950/35 dark:hover:text-blue-200 dark:focus:bg-blue-950/35 dark:focus:text-blue-200"
                      aria-label="Yeni satır ekle (Enter ile zincirleme)"
                    >
                      <PlusCircle className="h-4 w-4 shrink-0 opacity-75 group-hover:opacity-100" aria-hidden />
                      <span>Yeni satır</span>
                      <span className="ml-2 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Enter ile zincirle
                      </span>
                    </button>
                    {canBulkDelete && (
                      <button
                        type="button"
                        onClick={handleDeleteEmptyRows}
                        className="flex shrink-0 items-center gap-1.5 border-l border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-red-50/80 hover:text-red-700 focus:bg-red-50/80 focus:text-red-700 focus:outline-none dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/35 dark:hover:text-red-300 dark:focus:bg-red-950/35 dark:focus:text-red-300"
                        title="Mevcut görünümdeki içeriksiz/boş satırları sil — geri alınabilir"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="hidden sm:inline">Boş satırları sil</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </TooltipProvider>
      {filteredData.length > 0 && (
        /* Minimalist footer — Claude Design referans:
           Satır N ▼ | SIK ORTA GENİŞ | 32 kayıt · sayfa 1/1 ◀ ▶
           Tek satır, küçük font, soft border, inline metin pagination. */
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t px-4 py-1.5 text-[11px] backdrop-blur",
            isModernTemplate
              ? "live-table-modern-footer border-slate-200 bg-slate-50/80 text-slate-600 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-300"
              : "border-slate-200/80 bg-white/60 text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-400"
          )}
        >
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5">
              <span>Satır</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className={cn(
                  "h-6 rounded-md border px-1.5 pr-5 text-[11px] focus:outline-none",
                  isModernTemplate
                    ? "border-slate-300 bg-white text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-slate-500 dark:focus:ring-slate-600/40"
                    : "border-slate-200 bg-white text-slate-700 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                )}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <span className="hidden h-3 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
            {/* Density inline pill toggle — SIK / ORTA / GENİŞ */}
            <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 dark:bg-slate-800/80" role="radiogroup" aria-label="Tablo yoğunluğu">
              {(["compact", "normal", "comfortable"] as const).map((d) => {
                const label = d === "compact" ? "Sık" : d === "normal" ? "Orta" : "Geniş";
                const active = settings.liveTableDensity === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateSetting("liveTableDensity", d)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-all",
                      active
                        ? isModernTemplate
                          ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-600"
                          : "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              <span
                className={cn(
                  "font-semibold text-slate-700 dark:text-slate-200",
                  isModernTemplate && "live-table-modern-metric-primary"
                )}
              >
                {filteredData.length}
              </span>{" "}
              <span className={cn(isModernTemplate && "live-table-modern-metric-label")}>kayıt</span>
              <span className="mx-1.5 opacity-50">·</span>
              <span className={cn(isModernTemplate && "live-table-modern-metric-label")}>sayfa</span>{" "}
              <span
                className={cn(
                  "font-semibold text-slate-700 dark:text-slate-200",
                  isModernTemplate && "live-table-modern-metric-primary"
                )}
              >
                {table.getState().pagination.pageIndex + 1}
              </span>
              <span className={cn("opacity-60", isModernTemplate && "live-table-modern-metric-secondary")}>
                {" "}
                / {table.getPageCount() || 1}
              </span>
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30",
                  isModernTemplate
                    ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
                aria-label="Önceki sayfa"
                title="Önceki sayfa ( [ veya , )"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-30",
                  isModernTemplate
                    ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
                aria-label="Sonraki sayfa"
                title="Sonraki sayfa ( ] veya . )"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
      {filteredData.length === 0 && (
        requiresSingleProjectSelection ? (
          <div className="flex min-h-[18rem] flex-1 items-center justify-center px-4 py-8">
            <EmptyState
              icon={<FolderKanban className="h-10 w-10" />}
              title={projectSelectionTitle}
              description={projectSelectionDescription}
              action={
                projectFilterOptions.length > 0 ? (
                  <div className="flex max-w-3xl flex-wrap items-center justify-center gap-2">
                    {projectFilterOptions.slice(0, 8).map((project) => (
                      <Button
                        key={project.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setProjectFilter([project.id])}
                        className="max-w-[14rem] justify-start"
                        title={project.name}
                      >
                        <FolderKanban className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{project.name}</span>
                      </Button>
                    ))}
                    {projectFilterOptions.length > 8 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        +{projectFilterOptions.length - 8} proje daha; üstteki Proje filtresinden seçebilirsiniz.
                      </span>
                    )}
                  </div>
                ) : undefined
              }
              secondaryAction={
                projectFilter.length > 1 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setProjectFilter([])}>
                    Çoklu seçimi temizle
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-10 w-10" />}
            title="Henüz görev yok"
            description="İlk görevinizi ekleyerek ya da CSV ile toplu içe aktararak başlayın."
            action={
              canCreateTask ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setNewTaskOpen(true)}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  <PlusCircle className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                  Yeni görev ekle
                </Button>
              ) : undefined
            }
            secondaryAction={
              canImportCsv ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  CSV içe aktar
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            variant="compact"
            icon={<Search className="h-8 w-8" />}
            title="Filtreye uyan görev yok"
            description="Arama, durum veya proje filtrelerinizi değiştirerek tekrar deneyin."
            action={
              activeFilterCount > 0 ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Filtreleri temizle
                </Button>
              ) : undefined
            }
          />
        )
      )}
      </div>
    </>
  );

  /* ─── TopStrip JSX ─── (useMemo'lar yukarıda, early return'lerden önce tanımlandı) */
  const realtimeChipMeta =
    realtimeConnection === "live"
      ? { dot: "bg-emerald-500", ring: "ring-emerald-400/30", label: "Canlı", textColor: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", pulse: true }
      : realtimeConnection === "connecting"
        ? { dot: "bg-amber-500", ring: "ring-amber-400/30", label: "Bağlanıyor", textColor: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", pulse: true }
        : { dot: "bg-rose-500", ring: "ring-rose-400/30", label: "Bağlantı yok", textColor: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", pulse: false };

  const jumpToSpotlightRows = () => {
    const target = document.querySelector('tr[data-spotlight-row="true"]');
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    toast.info("Mevcut görünümde spotlight satırı bulunamadı.");
  };

  const topStrip = (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-200/80 bg-white/60 px-3 py-2 backdrop-blur sm:px-4 dark:border-slate-700/80 dark:bg-slate-900/40">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/10 ring-1 ring-blue-600/20 dark:bg-blue-500/15 dark:ring-blue-500/30">
          <Table2 className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" aria-hidden />
        </span>
        <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Canlı Tablo
        </h1>
        {/* Realtime chip */}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            realtimeChipMeta.bg,
            realtimeChipMeta.border,
            realtimeChipMeta.textColor
          )}
          title={`Realtime: ${realtimeChipMeta.label}`}
        >
          <span className="relative inline-flex h-1.5 w-1.5">
            {realtimeChipMeta.pulse && (
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", realtimeChipMeta.dot)} aria-hidden />
            )}
            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full ring-2", realtimeChipMeta.dot, realtimeChipMeta.ring)} aria-hidden />
          </span>
          {realtimeChipMeta.label}
        </span>
      </div>

      <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

      {/* 3 metric chip — filtered tasks bazlı */}
      <span className="inline-flex items-baseline gap-1.5 text-sm">
        <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
          {topStripMetrics.total.toLocaleString("tr-TR")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">görev</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5 text-sm">
        <span className="self-center h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          {topStripMetrics.done.toLocaleString("tr-TR")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">tamamlandı</span>
      </span>
      <span className="inline-flex items-baseline gap-1.5 text-sm">
        <span className="self-center h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">
          {topStripMetrics.inProgress.toLocaleString("tr-TR")}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">devam ediyor</span>
      </span>

      {/* Filtre aktif badge — TOTAL view'a ek olarak filtered count'ı subtle olarak gösterir */}
      {topStripMetrics.isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/30 dark:text-blue-300" title={`Aktif filtre: ${topStripMetrics.filteredCount} / ${topStripMetrics.total} kayıt`}>
          <Filter className="h-2.5 w-2.5" aria-hidden />
          {topStripMetrics.filteredCount.toLocaleString("tr-TR")}
        </span>
      )}

      {spotlightSummary && (
        <button
          type="button"
          onClick={jumpToSpotlightRows}
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold text-violet-800 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/35 dark:text-violet-200 dark:hover:bg-violet-900/40"
          title="Spotlight satırlarına kaydır"
        >
          <Zap className="h-3 w-3" aria-hidden />
          Spotlight aktif · {spotlightSummary.highlightedCount} satır
          <span className="hidden max-w-[14rem] truncate rounded bg-violet-100/80 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/45 dark:text-violet-200 sm:inline">
            {spotlightSummary.ruleName}
          </span>
          {spotlightSummary.additionalRuleCount > 0 ? (
            <span className="hidden text-[9px] font-bold uppercase tracking-wide sm:inline">
              +{spotlightSummary.additionalRuleCount} kural
            </span>
          ) : null}
          {spotlightSummary.remainingLabel ? (
            <span className="hidden rounded bg-violet-100/80 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-900/45 dark:text-violet-200 sm:inline">
              kalan {spotlightSummary.remainingLabel}
            </span>
          ) : null}
          <span className="hidden max-w-[18rem] truncate sm:inline">({spotlightSummary.label})</span>
        </button>
      )}

      {/* Aktif proje rozeti (tek proje filtreliyse) */}
      {topStripActiveProject && (
        <>
          <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700/70">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
            <span className="max-w-[14rem] truncate">{topStripActiveProject.name || "İsimsiz proje"}</span>
            {topStripActiveProject.workflow_enabled && (
              <span
                className="rounded bg-violet-100 px-1 text-[9px] font-semibold uppercase text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"
                title="Onay akışı açık"
              >
                onay
              </span>
            )}
          </span>
        </>
      )}

      {/* Aktif kullanıcılar paneli — Sprint X3a sonrası TopStrip'e taşındı (önce internal duplicate header'daydı) */}
      {onlineUsers.length > 0 && (
        <div className="ml-auto">
          <OnlineUsersPanel
            onlineUsers={onlineUsers}
            editorsByRowId={editorsByRowId}
            currentUserEmail={currentUserEmail}
            tasks={tasks}
            label={projectFilter.length === 1 ? "Aktif ekip" : "Aktif kullanıcılar"}
          />
        </div>
      )}
    </header>
  );

  if (isFullWidth && typeof document !== "undefined") {
    return createPortal(
      <>
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" aria-hidden />
        <div className="fixed inset-6 z-50 flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border-2 border-slate-300 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800">
          {topStrip}
          {liveTableBody}
        </div>
      </>,
      document.body
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border-0 bg-transparent shadow-none">
      {topStrip}
      {liveTableBody}
    </div>
  );
}
