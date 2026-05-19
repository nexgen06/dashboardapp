"use client";

import { supabase } from "@/lib/supabaseClient";
import type { Project, ProjectStatus, ProjectPriority } from "@/types/project";
import type { Task } from "@/types/tasks";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TemplateScope = "private" | "shared";

/**
 * Bir görev şablon kaydı — gerçek görev oluşturmak için yeterli minimum.
 * due_offset_days: yeni görev oluşturulurken bugün + N gün olarak due_date hesaplanır.
 */
export type TemplateTask = {
  content: string;
  status?: string | null;
  priority?: string | null;
  assignee?: string | null;
  extra_data?: Record<string, string> | null;
  due_offset_days?: number | null;
};

/**
 * Şablonda saklanan proje şema verisi — name/description hariç (onlar üst seviye).
 */
export type TemplateProjectData = {
  status?: ProjectStatus;
  priority?: ProjectPriority | null;
  due_offset_days?: number | null;
  assigned_emails?: string[] | null;
  extra_column_keys?: string[] | null;
  title_column?: string | null;
  subtitle_columns?: string[] | null;
  wip_in_progress_limit?: number | null;
  strict_assignee_visibility?: boolean;
};

export type ProjectTemplate = {
  id: string;
  user_id: string;
  scope: TemplateScope;
  name: string;
  description: string;
  template_data: TemplateProjectData;
  tasks: TemplateTask[];
  created_at: string;
  updated_at: string;
};

function rowToTemplate(row: Record<string, unknown>): ProjectTemplate {
  const data = (row.template_data ?? {}) as TemplateProjectData;
  const tasksRaw = row.tasks;
  const tasks: TemplateTask[] = Array.isArray(tasksRaw)
    ? (tasksRaw as TemplateTask[])
    : [];
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? ""),
    scope: row.scope === "shared" ? "shared" : "private",
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    template_data: data,
    tasks,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Görünür şablonları listele (kendi private + tüm shared). */
export async function listProjectTemplates(): Promise<ProjectTemplate[]> {
  const { data, error } = await supabase
    .from("project_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTemplate);
}

/**
 * Mevcut proje + görev listesinden şablon oluştur.
 * due_date'leri "bugünden offset gün" hesabına çevirir.
 */
export async function saveProjectAsTemplate(input: {
  name: string;
  description?: string;
  scope?: TemplateScope;
  project: Project;
  /** Şablona dahil edilecek görevler (boş dizi → şablon sadece şema). */
  tasks?: Task[];
}): Promise<string> {
  const { name, scope = "private", project, tasks = [] } = input;
  const description = (input.description ?? project.description ?? "").trim();

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const dueOffsetFromDateString = (s?: string | null): number | null => {
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - startOfToday.getTime()) / DAY_MS);
  };

  const templateData: TemplateProjectData = {
    status: project.status,
    priority: project.priority ?? null,
    due_offset_days: dueOffsetFromDateString(project.due_date ?? null),
    assigned_emails: project.assigned_emails ?? null,
    extra_column_keys: project.extra_column_keys ?? null,
    title_column: project.title_column ?? null,
    subtitle_columns: project.subtitle_columns ?? null,
    wip_in_progress_limit: project.wip_in_progress_limit ?? null,
    strict_assignee_visibility: project.strict_assignee_visibility,
  };

  const templateTasks: TemplateTask[] = tasks.map((t) => ({
    content: (t.content ?? "").trim(),
    status: t.status ?? null,
    priority: t.priority ?? null,
    assignee: t.assignee ?? null,
    extra_data: (t.extra_data ?? null) as Record<string, string> | null,
    due_offset_days: dueOffsetFromDateString(t.due_date ?? null),
  }));

  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) throw new Error("Oturum açık değil.");

  const { data, error } = await supabase
    .from("project_templates")
    .insert({
      user_id: uid,
      scope,
      name: name.trim(),
      description,
      template_data: templateData,
      tasks: templateTasks,
    })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function deleteProjectTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("project_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function renameProjectTemplate(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("project_templates")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function setProjectTemplateScope(id: string, scope: TemplateScope): Promise<void> {
  const { error } = await supabase
    .from("project_templates")
    .update({ scope })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Şablondan due_offset_days değerini bugün baz alarak ISO date string'e çevirir.
 */
export function offsetToDateIso(offsetDays: number | null | undefined): string | null {
  if (offsetDays == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
