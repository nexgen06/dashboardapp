"use client";

import { supabase } from "@/lib/supabaseClient";

export type TaskFile = {
  id: string;
  taskId: string;
  projectId: string | null;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
};

type TaskFileRow = {
  id: string;
  task_id: string;
  project_id: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  created_at: string;
};

function mapTaskFile(row: TaskFileRow): TaskFile {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    fileName: row.file_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    uploadedByEmail: row.uploaded_by_email,
    createdAt: row.created_at,
  };
}

function friendlyFileError(err: unknown): Error {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "42P01" || /task_files/i.test(e?.message ?? "")) {
    return new Error("Dosya tablosu yok. scripts/task-files.sql dosyasını Supabase SQL Editor'da çalıştırın.");
  }
  if (e?.code === "42501" || /row-level security|permission denied/i.test(e?.message ?? "")) {
    return new Error("Bu dosya işlemi için yetkiniz yok.");
  }
  return new Error(e?.message ?? "Dosya işlemi başarısız.");
}

export async function listTaskFiles(taskId: string): Promise<TaskFile[]> {
  const { data, error } = await supabase
    .from("task_files")
    .select("id,task_id,project_id,file_name,file_path,mime_type,size_bytes,uploaded_by,uploaded_by_email,created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw friendlyFileError(error);
  return ((data ?? []) as TaskFileRow[]).map(mapTaskFile);
}

export async function uploadTaskFile(input: {
  taskId: string;
  projectId?: string | null;
  file: File;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<TaskFile> {
  const safeName = input.file.name.replace(/[^\w.\-ğüşöçıİĞÜŞÖÇ ]+/gi, "_").slice(0, 160);
  const path = `${input.taskId}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from("task-files").upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upload.error) throw friendlyFileError(upload.error);

  const { data, error } = await supabase
    .from("task_files")
    .insert({
      task_id: input.taskId,
      project_id: input.projectId ?? null,
      file_name: input.file.name,
      file_path: path,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
      uploaded_by: input.userId ?? null,
      uploaded_by_email: input.userEmail ?? null,
    })
    .select("id,task_id,project_id,file_name,file_path,mime_type,size_bytes,uploaded_by,uploaded_by_email,created_at")
    .single();
  if (error) throw friendlyFileError(error);
  return mapTaskFile(data as TaskFileRow);
}

export async function getTaskFileSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("task-files").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw friendlyFileError(error);
  return data.signedUrl;
}

export async function deleteTaskFile(file: TaskFile): Promise<void> {
  const remove = await supabase.storage.from("task-files").remove([file.filePath]);
  if (remove.error) throw friendlyFileError(remove.error);
  const { error } = await supabase.from("task_files").delete().eq("id", file.id);
  if (error) throw friendlyFileError(error);
}

