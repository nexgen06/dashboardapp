"use client";

import { useEffect, useState } from "react";
import { Download, File, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteTaskFile, getTaskFileSignedUrl, listTaskFiles, uploadTaskFile, type TaskFile } from "@/lib/taskFiles";
import { cn } from "@/lib/utils";

export function TaskFilesPanel({
  taskId,
  projectId,
  canEdit,
  userId,
  userEmail,
  className,
}: {
  taskId: string;
  projectId?: string | null;
  canEdit: boolean;
  userId?: string | null;
  userEmail?: string | null;
  className?: string;
}) {
  const toast = useToast();
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setFiles(await listTaskFiles(taskId));
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadTaskFile({ taskId, projectId, file, userId, userEmail });
      toast.success("Dosya yüklendi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (file: TaskFile) => {
    try {
      const url = await getTaskFileSignedUrl(file.filePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya açılamadı.");
    }
  };

  const removeFile = async (file: TaskFile) => {
    try {
      await deleteTaskFile(file);
      toast.success("Dosya silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya silinemedi.");
    }
  };

  return (
    <section className={cn("rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-700 dark:bg-slate-800/40", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <File className="h-3 w-3" aria-hidden />
          Dosyalar
          {files.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[10px] dark:bg-slate-700">{files.length}</span>}
        </h3>
        {canEdit && (
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Yükle
            <input type="file" className="hidden" disabled={uploading} onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Yükleniyor…</p>
      ) : files.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
          Bu satırda dosya yok.
        </p>
      ) : (
        <div className="space-y-1.5">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/60">
              <File className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <button type="button" onClick={() => void openFile(file)} className="min-w-0 flex-1 truncate text-left text-xs font-medium text-slate-700 hover:underline dark:text-slate-200">
                {file.fileName}
              </button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => void openFile(file)} aria-label="Dosyayı aç">
                <Download className="h-3.5 w-3.5" />
              </Button>
              {canEdit && (
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => void removeFile(file)} aria-label="Dosyayı sil">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

