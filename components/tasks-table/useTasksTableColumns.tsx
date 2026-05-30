"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/tasks";
import type { Project } from "@/types/project";
import type { LiveTableDensity, LiveTableTemplate } from "@/contexts/settings-context";
import type { EditingUser } from "@/hooks/usePresence";
import type { ReferenceSource } from "@/lib/referenceSources";
import type { ProjectColumn } from "@/lib/projectColumns";
import type { ChipCatalog, RowChipValue } from "@/lib/chipSystem";
import type { SpotlightDescriptor } from "@/components/tasks-table/spotlight";
import { SelectAllCheckbox } from "@/components/tasks-table/SelectAllCheckbox";
import { LiveTableRowRail } from "@/components/tasks-table/LiveTableRowRail";
import { EditableCell } from "@/components/tasks-table/EditableCell";
import { StatusCell } from "@/components/tasks-table/StatusCell";
import { ReferenceSelectCell } from "@/components/tasks-table/ReferenceSelectCell";
import { ExtraCellCopyButton } from "@/components/tasks-table/ExtraCellCopyButton";
import { ChipSelectCell } from "@/components/chips/ChipBadge";
import {
  LIVE_TABLE_SELECT_COLUMN_WIDTH,
  REFERENCE_WARNINGS_KEY,
} from "@/components/tasks-table/constants";
import { EXTRA_DATA_LINK_KEY, isSafeUrl } from "@/components/tasks-table/taskFormHelpers";
import { normalizeSortText } from "@/components/tasks-table/sortText";
import { isSpotlightCellMatch } from "@/components/tasks-table/spotlight";
import {
  PRIORITY_STYLES,
  getStatusDisplay,
  isTaskCompleted,
  rawStatusIsCompleted,
  resolveRestoreStatus,
} from "@/components/tasks-table/statusHelpers";
import { isSensitiveExtraColumnKey, maskSensitiveExtraValue } from "@/lib/extraColumnSensitiveDisplay";
import { presenceEditorLines } from "@/lib/userDisplayName";
import { formatDate } from "@/lib/formatDate";
import { getRelativeTime } from "@/lib/relativeTime";
import { isUrgentPriorityValue } from "@/lib/urgentTaskPriority";
import { getDueUrgency, URGENCY_LABEL, URGENCY_BADGE_CLASS } from "@/lib/dueUrgency";
import { getStatusKind } from "@/lib/statusKind";
import {
  referenceWarningsFromRecord,
  resolveReferenceTargetKey,
  valuesMatch,
} from "@/lib/referenceExtraDataEnrichment";
import {
  findPersistableChipOption,
  getChipOptionsForColumn,
  isLocalChipOptionId,
  matchChipOptionIdFromCellValue,
  resolveExtraColumnChip,
  setRowChipValue,
  upsertTableChipBinding,
} from "@/lib/chipSystem";
import {
  normalizeWorkflowStatus,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_STATUS_CLASS,
  WORKFLOW_STATUS_LABELS,
  type TaskWorkflowAction,
} from "@/lib/taskWorkflow";
import {
  ChevronDown,
  Lock,
  Unlock,
  ExternalLink,
  ListTodo,
  AlertTriangle,
  MoreVertical,
  MoreHorizontal,
  MessageSquare,
  Flame,
  Calendar,
  CalendarClock,
  Pencil,
  Copy as CopyIcon,
  Trash2,
} from "lucide-react";

const columnHelper = createColumnHelper<Task>();

export type UseTasksTableColumnsParams = {
  handleSave: (id: string, patch: Partial<Task>) => void | Promise<{ ok: boolean; message?: string }>;
  statusOptions: string[];
  tableDensity: LiveTableDensity;
  tableTemplate: LiveTableTemplate;
  dui: {
    rowCheckbox: string;
    selectHeaderSpan: string;
    table: string;
    th: string;
    td: string;
    sortIcon: string;
    actionsBtn: string;
  };
  extraDataKeys: string[];
  handleDynamicCellSave: (taskId: string, key: string, value: string) => void;
  handleReferenceCellSave: (taskId: string, key: string, value: string, column: ProjectColumn | null) => void;
  activateEditableCell: (taskId: string, field: string) => void;
  isActiveEditableCell: (taskId: string, field: string) => boolean;
  scheduleEditableCellBlur: (taskId: string, field: string) => void;
  focusNextEditableCell: (taskId: string, columnId: string) => void;
  handleQuickAddRow: () => void;
  quickAddFocusId: string | null;
  deletingIds: Set<string>;
  editorsByRowId: Map<string, EditingUser[]>;
  canEditRow: (task: Task) => boolean;
  getWorkflowActionsForTask: (task: Task) => TaskWorkflowAction[];
  handleWorkflowAction: (task: Task, action: TaskWorkflowAction) => void | Promise<void>;
  isProjectWorkflowEnabled: (task: Task) => boolean;
  isRowLockedByApproval: (task: Task) => boolean;
  canCopyRow: (task: Task) => boolean;
  canCreateTask: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  handleCopyTask: (task: Task) => void;
  handleDeleteTask: (id: string) => void;
  setEditingRow: (id: string | null) => void;
  setEditTask: (task: Task | null) => void;
  setDetailTask: (task: Task | null) => void;
  settings: {
    defaultTaskStatus: string;
    piiSensitiveDisplayMode: string;
    dateFormat: import("@/contexts/settings-context").DateFormat;
  };
  projectById: Map<string, Project>;
  projectColumnsByProjectId: Record<string, ProjectColumn[]>;
  projectFilter: string[];
  chipCatalog: ChipCatalog;
  rowChipValues: RowChipValue[];
  setRowChipValues: Dispatch<SetStateAction<RowChipValue[]>>;
  canManageSensitiveChips: boolean;
  canViewSensitiveCells: boolean;
  toast: ReturnType<typeof import("@/components/ui/toast").useToast>;
  user: { id?: string; roleId?: string; email?: string } | null;
  spotlightMatchByTaskId: Map<string, { descriptor: SpotlightDescriptor; ruleId: string }>;
  spotlightActive: boolean;
  spotlightTaskIds: Set<string>;
  trackSensitiveViewShadow: (task: Task, fieldKey: string) => void;
  referenceSources: ReferenceSource[];
};

export function useTasksTableColumns(params: UseTasksTableColumnsParams) {
  const {
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
    setDetailTask,
    settings,
    projectById,
    projectColumnsByProjectId,
    projectFilter,
    chipCatalog,
    rowChipValues,
    setRowChipValues,
    canManageSensitiveChips,
    canViewSensitiveCells,
    toast,
    tableTemplate,
    user,
    spotlightMatchByTaskId,
    spotlightActive,
    spotlightTaskIds,
    trackSensitiveViewShadow,
    referenceSources,
    isRowLockedByApproval,
  } = params;

  return useMemo(
    () => [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <span className="flex items-center justify-center">
          <SelectAllCheckbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className={dui.rowCheckbox}
          />
        </span>
      ),
      cell: ({ row }) => {
        const editors = editorsByRowId.get(row.original.id) ?? [];
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
          <LiveTableRowRail
            task={row.original}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onToggle={row.getToggleSelectedHandler()}
            checkboxClassName={dui.rowCheckbox}
            editors={editors.map((e) => presenceEditorLines(e))}
            editorsTooltip={editorsTooltip}
          />
        );
      },
      size: LIVE_TABLE_SELECT_COLUMN_WIDTH,
      minSize: 36,
      maxSize: 52,
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
            dueDate={task.due_date ?? null}
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

          const normalizedExtraKey = key.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
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
                    binding.columnKey.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr") === normalizedExtraKey
                )
              )
              .find(Boolean) ?? null;
          const resolvedChip = resolveExtraColumnChip(
            chipCatalog,
            candidateProjectIds,
            key,
            typedOptions.length > 0 ? typedOptions.map(String) : undefined
          );
          if (resolvedChip) {
            const { template: chipTemplate, options: chipOptions } = resolvedChip;
            const chipRow = rowChipValues.find(
              (item) => item.taskId === taskId && item.templateId === chipTemplate.id
            );
            const selectedOptionId = matchChipOptionIdFromCellValue(value, chipOptions, chipRow);
            if (chipOptions.length > 0) {
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
                    value={selectedOptionId}
                    disabled={chipDisabled}
                    spotlight={spotlightActive && spotlightTaskIds.has(taskId)}
                    onChange={(optionId) => {
                      void (async () => {
                        try {
                          const option = chipOptions.find((item) => item.id === optionId);
                          if (!option) return;

                          const persistable =
                            isLocalChipOptionId(optionId)
                              ? findPersistableChipOption(chipCatalog, chipTemplate.id, option.label)
                              : option;

                          if (persistable && !isLocalChipOptionId(persistable.id)) {
                            const next = await setRowChipValue({
                              taskId,
                              templateId: chipTemplate.id,
                              optionId: persistable.id,
                              source: "manual",
                            });
                            setRowChipValues((prev) => [
                              ...prev.filter(
                                (item) => !(item.taskId === taskId && item.templateId === chipTemplate.id)
                              ),
                              next,
                            ]);
                          }

                          handleDynamicCellSave(taskId, key, option.label);

                          const projectId = task.project_id ? String(task.project_id) : candidateProjectIds[0];
                          if (projectId && !resolvedChip.binding && !chipBinding) {
                            await upsertTableChipBinding({
                              projectId,
                              columnKey: key,
                              templateId: chipTemplate.id,
                            });
                          }
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
        const canShowCopy = rowCanEdit && canCreateTask && canCopyRow(task);
        const canShowDelete = rowCanEdit && canDeleteTask;
        // Notion/Linear pattern: hover quick actions — sadece satır hover'da görünür
        // group/row class'ı zaten <tr>'e ekli (TasksTableDataPanel.tsx)
        const iconClass = "h-3.5 w-3.5";
        return (
          <div className="relative flex items-center justify-end">
            {/* Hover quick actions — desktop'ta absolute overlay (alan kaplamaz),
                mobilde inline ve her zaman görünür (hover yok). */}
            <div
              className={cn(
                "flex items-center gap-0.5 transition-opacity duration-150",
                // Mobile (< sm): inline, her zaman görünür
                "opacity-100",
                // Desktop (>= sm): absolute overlay, hover'da görünür
                "sm:absolute sm:right-9 sm:top-1/2 sm:-translate-y-1/2",
                "sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-within:opacity-100",
                "sm:rounded-md sm:border sm:border-slate-200 sm:bg-white sm:px-0.5 sm:py-0.5 sm:shadow-sm",
                "dark:sm:border-slate-700 dark:sm:bg-slate-800",
              )}
              aria-label="Hızlı işlemler"
            >
              {rowCanEdit && (
                <button
                  type="button"
                  onClick={() => setDetailTask(task)}
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                  aria-label="Detay ve yorumlar"
                  title="Detay ve yorumlar"
                >
                  <MessageSquare className={iconClass} aria-hidden />
                </button>
              )}
              {rowCanEdit && (
                <button
                  type="button"
                  onClick={() => setEditTask(task)}
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                  aria-label="Düzenle"
                  title="Düzenle"
                >
                  <Pencil className={iconClass} aria-hidden />
                </button>
              )}
              {canShowCopy && (
                <button
                  type="button"
                  onClick={() => handleCopyTask(task)}
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                  aria-label="Kopyala"
                  title="Kopyala"
                >
                  <CopyIcon className={iconClass} aria-hidden />
                </button>
              )}
              {canShowDelete && (
                <button
                  type="button"
                  onClick={() => handleDeleteTask(task.id)}
                  disabled={isDeleting}
                  className="rounded p-1 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                  aria-label="Sil"
                  title="Sil"
                >
                  <Trash2 className={iconClass} aria-hidden />
                </button>
              )}
            </div>

            {/* Diğer/Workflow menüsü — her zaman görünür (workflow yetkisi vs için) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={cn(dui.actionsBtn, "shrink-0")} aria-label="Diğer işlemler">
                  <MoreHorizontal className={cn(dui.sortIcon, "shrink-0")} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Mobile/küçük ekran fallback — hover quick actions burada da var */}
                {rowCanEdit && (
                  <DropdownMenuItem onClick={() => setDetailTask(task)}>
                    <MessageSquare className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Detay / Yorumlar
                  </DropdownMenuItem>
                )}
                {rowCanEdit && (
                  <DropdownMenuItem onClick={() => setEditTask(task)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Düzenle
                  </DropdownMenuItem>
                )}
                {canShowCopy && (
                  <DropdownMenuItem onClick={() => handleCopyTask(task)}>
                    <CopyIcon className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Kopyala
                  </DropdownMenuItem>
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
                {canShowDelete && (canShowCopy || rowCanEdit) && <DropdownMenuSeparator />}
                {canShowDelete && (
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => handleDeleteTask(task.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Sil
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 52, // Hover ikonları desktop'ta absolute overlay; column dar kalır
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
      setDetailTask,
      settings,
      projectById,
      projectColumnsByProjectId,
      projectFilter,
      chipCatalog,
      rowChipValues,
      setRowChipValues,
      canManageSensitiveChips,
      canViewSensitiveCells,
      toast,
      tableTemplate,
      user,
      spotlightMatchByTaskId,
      spotlightActive,
      spotlightTaskIds,
      trackSensitiveViewShadow,
      referenceSources,
      isRowLockedByApproval,
    ]
  );
}
