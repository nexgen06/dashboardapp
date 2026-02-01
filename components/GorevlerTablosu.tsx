"use client";

import { useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getRelativeTime } from "@/lib/relativeTime";
import { formatDate } from "@/lib/formatDate";
import { useSettings } from "@/contexts/settings-context";
import { useGorevlerFirestore, type GorevLive, type StatusKind, type PriorityKind } from "@/hooks/useGorevlerFirestore";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  GripVertical,
  Maximize2,
  Minimize2,
  MoreVertical,
  PlusCircle,
  Pencil,
  Trash2,
  Loader2,
  Radio,
} from "lucide-react";

type GorevDemo = GorevLive;

const STATUS_CONFIG: Record<
  StatusKind,
  { label: string; dotClass: string; badgeClass: string }
> = {
  Yapıldı: { label: "Yapıldı", dotClass: "bg-emerald-500", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700" },
  Sürüyor: { label: "Sürüyor", dotClass: "bg-amber-500", badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700" },
  Beklemede: { label: "Beklemede", dotClass: "bg-slate-400", badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600" },
  İptal: { label: "İptal", dotClass: "bg-red-500", badgeClass: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700" },
};

const PRIORITY_CONFIG: Record<PriorityKind, { label: string; className: string }> = {
  High: { label: "High", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700" },
  Medium: { label: "Medium", className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700" },
  Low: { label: "Low", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600" },
};

function StatusCell({ status }: { status: StatusKind }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", config.dotClass)} aria-hidden />
      <Badge variant="outline" className={cn("font-normal border", config.badgeClass)}>{config.label}</Badge>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: PriorityKind }) {
  const config = PRIORITY_CONFIG[priority];
  return <Badge variant="outline" className={cn("font-normal", config.className)}>{config.label}</Badge>;
}

const STATUS_OPTIONS: StatusKind[] = ["Yapıldı", "Sürüyor", "Beklemede", "İptal"];
const PRIORITY_OPTIONS: PriorityKind[] = ["High", "Medium", "Low"];

const COLUMN_IDS_BASE = ["status", "taskName", "assignee", "priority", "updatedAt", "presence"] as const;

export function GorevlerTablosu() {
  const now = new Date();
  const { settings } = useSettings();
  const firebaseEnabled = isFirebaseConfigured();
  const {
    tasks: liveTasks,
    isLoading: liveLoading,
    isLive,
    enabled: liveEnabled,
    addTask,
    updateTask,
    deleteTask,
  } = useGorevlerFirestore();

  const data = liveEnabled ? liveTasks : [];
  const columnIds = firebaseEnabled
    ? ([...COLUMN_IDS_BASE, "actions"] as const)
    : COLUMN_IDS_BASE;

  const [isFullWidth, setIsFullWidth] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(columnIds as unknown as ColumnOrderState);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({
    status: 140,
    taskName: 220,
    assignee: 180,
    priority: 100,
    updatedAt: 180,
    presence: 120,
    actions: 80,
  });
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<GorevDemo | null>(null);
  const [formTaskName, setFormTaskName] = useState("");
  const [formStatus, setFormStatus] = useState<StatusKind>("Beklemede");
  const [formAssigneeName, setFormAssigneeName] = useState("");
  const [formPriority, setFormPriority] = useState<PriorityKind>("Medium");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<GorevDemo | null>(null);

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

  const handleDragEnd = useCallback(() => {
    setDraggedColumnId(null);
  }, []);

  const pinColumn = useCallback((columnId: string, side: "left" | "right" | "unpin") => {
    setColumnPinning((prev) => {
      const left = (prev.left ?? []).filter((id) => id !== columnId);
      const right = (prev.right ?? []).filter((id) => id !== columnId);
      if (side === "left") return { left: [...left, columnId], right };
      if (side === "right") return { left, right: [...right, columnId] };
      return { left, right };
    });
  }, []);

  const openAddForm = useCallback(() => {
    setEditingRow(null);
    setFormTaskName("");
    setFormStatus("Beklemede");
    setFormAssigneeName("");
    setFormPriority("Medium");
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((row: GorevDemo) => {
    setEditingRow(row);
    setFormTaskName(row.taskName);
    setFormStatus(row.status);
    setFormAssigneeName(row.assigneeName);
    setFormPriority(row.priority);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(async () => {
    if (!liveEnabled) return;
    setFormSubmitting(true);
    try {
      if (editingRow) {
        await updateTask(editingRow.id, {
          taskName: formTaskName.trim(),
          status: formStatus,
          assigneeName: formAssigneeName.trim(),
          priority: formPriority,
        });
      } else {
        await addTask({
          taskName: formTaskName.trim() || "İsimsiz görev",
          status: formStatus,
          assigneeName: formAssigneeName.trim(),
          priority: formPriority,
        });
      }
      setFormOpen(false);
      setEditingRow(null);
    } catch (e) {
      console.error("[GorevlerTablosu] Form submit error:", e);
    } finally {
      setFormSubmitting(false);
    }
  }, [liveEnabled, editingRow, formTaskName, formStatus, formAssigneeName, formPriority, addTask, updateTask]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm || !liveEnabled) return;
    try {
      await deleteTask(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (e) {
      console.error("[GorevlerTablosu] Delete error:", e);
    }
  }, [deleteConfirm, liveEnabled, deleteTask]);

  const columnHelper = createColumnHelper<GorevDemo>();
  const columns = useMemo(() => [
    columnHelper.display({
      id: "status",
      header: "Durum",
      cell: ({ row }) => <StatusCell status={row.original.status} />,
      size: 140,
      minSize: 80,
      maxSize: 300,
      enableResizing: true,
    }),
    columnHelper.accessor("taskName", {
      id: "taskName",
      header: "Görev Adı",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">{row.original.taskName}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{row.original.id}</p>
        </div>
      ),
      size: 220,
      minSize: 120,
      maxSize: 500,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "assignee",
      header: "Atanan Kişi",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt={row.original.assigneeName} />
            <AvatarFallback className="bg-slate-200 text-slate-600 text-xs dark:bg-slate-600 dark:text-slate-200">{row.original.assigneeInitials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.original.assigneeName}</span>
        </div>
      ),
      size: 180,
      minSize: 100,
      maxSize: 350,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "priority",
      header: "Öncelik",
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      size: 100,
      minSize: 70,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "updatedAt",
      header: "Son Güncelleme",
      cell: ({ row }) => (
        <span className="text-sm text-slate-500 dark:text-slate-400" title={formatDate(row.original.updatedAt, settings.dateFormat)}>
          {getRelativeTime(row.original.updatedAt, now)}
          <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">({formatDate(row.original.updatedAt, settings.dateFormat)})</span>
        </span>
      ),
      size: 180,
      minSize: 100,
      maxSize: 280,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "presence",
      header: "",
      cell: ({ row }) =>
        row.original.editedBy ? (
          <span className="inline-flex rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white shadow-sm" title="Başka biri düzenliyor">
            {row.original.editedBy} düzenliyor…
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        ),
      size: 120,
      minSize: 60,
      maxSize: 180,
      enableResizing: true,
    }),
    ...(firebaseEnabled && liveEnabled
      ? [
          columnHelper.display({
            id: "actions",
            header: "",
            cell: ({ row }) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="İşlemler">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditForm(row.original)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Düzenle
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => setDeleteConfirm(row.original)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
            size: 80,
            minSize: 60,
            maxSize: 100,
            enableResizing: true,
          }),
        ]
      : []),
  ] as ColumnDef<GorevDemo, unknown>[], [settings.dateFormat, firebaseEnabled, liveEnabled, openEditForm]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnOrder,
      columnPinning,
      columnSizing,
    },
    onColumnOrderChange: setColumnOrder,
    onColumnPinningChange: setColumnPinning,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    enablePinning: true,
  });

  // İstatistikler
  const stats = useMemo(() => {
    const yapildi = data.filter((t) => t.status === "Yapıldı").length;
    const suruyor = data.filter((t) => t.status === "Sürüyor").length;
    const beklemede = data.filter((t) => t.status === "Beklemede").length;
    const iptal = data.filter((t) => t.status === "İptal").length;
    const total = data.length;
    const highPriority = data.filter((t) => t.priority === "High").length;
    const completionRate = total > 0 ? Math.round((yapildi / total) * 100) : 0;
    return { yapildi, suruyor, beklemede, iptal, total, highPriority, completionRate };
  }, [data]);

  return (
    <>
      {isFullWidth && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" aria-hidden />
      )}
      <div
        className={cn(
          "flex flex-col gap-3",
          isFullWidth && "fixed inset-6 z-50 flex flex-col rounded-xl border-2 border-slate-300 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        )}
      >
      {/* İstatistik Kartları */}
      {liveEnabled && data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 px-1">
          {/* Tamamlandı */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 p-3 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <span className="text-sm font-bold">✓</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Tamamlandı</p>
                  <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{stats.yapildi}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Devam Ediyor */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-3 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
                  <span className="text-sm font-bold">⏳</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Devam Ediyor</p>
                  <p className="text-xl font-bold text-amber-900 dark:text-amber-100">{stats.suruyor}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Beklemede */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/30 p-3 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-400 text-white">
                  <span className="text-sm font-bold">⏸</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Beklemede</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.beklemede}</p>
                </div>
              </div>
            </div>
          </div>

          {/* İptal */}
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20 p-3 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
                  <span className="text-sm font-bold">✕</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-red-700 dark:text-red-300">İptal</p>
                  <p className="text-xl font-bold text-red-900 dark:text-red-100">{stats.iptal}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Yüksek Öncelik */}
          <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20 p-3 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-white">
                  <span className="text-sm font-bold">🔥</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Yüksek Öncelik</p>
                  <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{stats.highPriority}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tamamlanma Oranı */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 p-3 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
                  <span className="text-sm font-bold">📊</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Tamamlanma</p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{stats.completionRate}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Sütunları sürükleyerek sıralayın, kenardan genişletin; menü ile sabitleyin.
          </span>
          {firebaseEnabled && (
            <>
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                  <Radio className="h-3 w-3" />
                  Canlı
                </span>
              )}
              {liveEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openAddForm}
                  className="shrink-0"
                >
                  <PlusCircle className="mr-2 h-3.5 w-3.5" />
                  Yeni görev
                </Button>
              )}
            </>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsFullWidth((p) => !p)}
          className="text-slate-700 dark:text-slate-300 shrink-0"
        >
          {isFullWidth ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
          {isFullWidth ? "Daralt" : "Tablo genişlet"}
        </Button>
      </div>

      <div className={cn("w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800", isFullWidth && "min-h-0 flex-1")}>
        {!firebaseEnabled ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 p-8 text-center text-slate-500 dark:text-slate-400">
            <p className="text-sm font-medium">Canlı veri için Firebase yapılandırın</p>
            <p className="text-xs">.env.local ve Firestore kurulumu yapıldığında Görevler Tablosu gerçek zamanlı veri ile çalışır.</p>
          </div>
        ) : liveEnabled && liveLoading ? (
          <div className="flex min-h-[200px] items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
        <Table
          className="w-full min-w-full"
          style={{
            width: "100%",
            minWidth: "100%",
            tableLayout: "fixed",
          }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => {
              const headers = headerGroup.headers;
              const lastColIndex = headers.length - 1;
              return (
              <TableRow key={headerGroup.id} className="border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-700/50">
                {headers.map((header, headerIndex) => {
                  const col = header.column;
                  const isPinnedLeft = col.getIsPinned() === "left";
                  const isPinnedRight = col.getIsPinned() === "right";
                  const resizeHandler = typeof header.getResizeHandler === "function" ? header.getResizeHandler() : undefined;
                  const isLastColumn = headerIndex === lastColIndex;
                  const baseSize = header.getSize();
                  return (
                    <TableHead
                      key={header.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "relative select-none border-r border-slate-200 dark:border-slate-600",
                        draggedColumnId === col.id && "opacity-50",
                        isPinnedLeft && "sticky left-0 z-10 bg-slate-100 dark:bg-slate-700/80 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]",
                        isPinnedRight && "sticky right-0 z-10 bg-slate-100 dark:bg-slate-700/80 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]"
                      )}
                      style={
                        isLastColumn
                          ? { minWidth: baseSize }
                          : { width: baseSize, minWidth: baseSize, maxWidth: baseSize }
                      }
                    >
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400 active:cursor-grabbing" aria-hidden />
                        <span className="text-slate-700 dark:text-slate-300">{header.column.columnDef.header as string}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-500" aria-label="Sütun menüsü">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "left")}>Sol tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "right")}>Sağ tarafa sabitle</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => pinColumn(col.id, "unpin")}>Sabitlemeyi kaldır</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {col.getCanResize?.() && resizeHandler && (
                        <div
                          onMouseDown={resizeHandler}
                          onTouchStart={resizeHandler}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none resize-x",
                            "hover:bg-blue-400 hover:w-0.5 hover:right-[-1px]",
                            col.getIsResizing?.() && "bg-blue-500 w-0.5"
                          )}
                          title="Genişliği değiştirmek için sürükleyin"
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
              );
            })}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const visibleCells = row.getVisibleCells();
              const lastCellIndex = visibleCells.length - 1;
              return (
              <TableRow
                key={row.id}
                className={cn(
                  "border-slate-200 transition-colors hover:bg-slate-50/50 dark:border-slate-700 dark:hover:bg-slate-700/30",
                  row.original.editedBy && "border-l-2 border-l-blue-400 bg-blue-50/30 dark:bg-blue-900/20 dark:border-blue-500"
                )}
              >
                {visibleCells.map((cell, cellIndex) => {
                  const isPinnedLeft = cell.column.getIsPinned() === "left";
                  const isPinnedRight = cell.column.getIsPinned() === "right";
                  const isLastColumn = cellIndex === lastCellIndex;
                  const baseSize = cell.column.getSize();
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "border-r border-slate-100 dark:border-slate-700",
                        isPinnedLeft && "sticky left-0 z-10 bg-white dark:bg-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.2)]",
                        isPinnedRight && "sticky right-0 z-10 bg-white dark:bg-slate-800 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.2)]"
                      )}
                      style={
                        isLastColumn
                          ? { minWidth: baseSize }
                          : { width: baseSize, minWidth: baseSize, maxWidth: baseSize }
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </div>

      {firebaseEnabled && liveEnabled && (
        <>
          <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingRow(null); }}>
            <DialogContent showClose={true}>
              <DialogHeader>
                <DialogTitle>{editingRow ? "Görevi düzenle" : "Yeni görev"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Görev adı</label>
                  <input
                    type="text"
                    value={formTaskName}
                    onChange={(e) => setFormTaskName(e.target.value)}
                    placeholder="Görev adı"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Durum</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as StatusKind)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Atanan kişi</label>
                  <input
                    type="text"
                    value={formAssigneeName}
                    onChange={(e) => setFormAssigneeName(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Öncelik</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as PriorityKind)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>İptal</Button>
                <Button type="button" onClick={handleFormSubmit} disabled={formSubmitting}>
                  {formSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRow ? "Kaydet" : "Ekle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
            <DialogContent showClose={true}>
              <DialogHeader>
                <DialogTitle className="text-red-700 dark:text-red-300">Görevi sil</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                &quot;{deleteConfirm?.taskName}&quot; görevi kalıcı olarak silinecek. Bu işlem geri alınamaz.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button>
                <Button type="button" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
                  Sil
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
    </>
  );
}
