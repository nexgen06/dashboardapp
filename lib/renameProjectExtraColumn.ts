"use client";

import { supabase } from "@/lib/supabaseClient";
import { listProjectColumns, updateProjectColumn } from "@/lib/projectColumns";

export function columnKeysEqual(a: string, b: string): boolean {
  return (
    String(a ?? "").trim().toLocaleLowerCase("tr") === String(b ?? "").trim().toLocaleLowerCase("tr")
  );
}

/** extra_column_keys / subtitle_columns listesinde tek eşleşmeyi yeniden adlandırır. */
export function renameKeyInStringList(keys: string[], oldKey: string, newKey: string): string[] {
  const trimmedNew = newKey.trim();
  let replaced = false;
  const next: string[] = [];
  for (const raw of keys) {
    const k = String(raw ?? "").trim();
    if (!k) continue;
    if (columnKeysEqual(k, oldKey)) {
      if (!replaced) {
        next.push(trimmedNew);
        replaced = true;
      }
      continue;
    }
    if (columnKeysEqual(k, trimmedNew)) {
      throw new Error(`"${trimmedNew}" adında bir sütun zaten var.`);
    }
    next.push(k);
  }
  if (!replaced) {
    if (next.some((k) => columnKeysEqual(k, trimmedNew))) {
      throw new Error(`"${trimmedNew}" adında bir sütun zaten var.`);
    }
    next.push(trimmedNew);
  }
  return next;
}

export type RenameProjectExtraColumnResult = {
  tasksUpdated: number;
  chipBindingsUpdated: number;
  extraColumnKeys: string[];
  titleColumn: string | null;
  subtitleColumns: string[] | null;
};

export async function renameProjectExtraColumn(input: {
  projectId: string;
  oldKey: string;
  newKey: string;
}): Promise<RenameProjectExtraColumnResult> {
  const oldKey = input.oldKey.trim();
  const newKey = input.newKey.trim();
  if (!oldKey || !newKey) {
    throw new Error("Eski ve yeni sütun adı gerekli.");
  }
  if (columnKeysEqual(oldKey, newKey)) {
    throw new Error("Yeni ad eski adla aynı.");
  }

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, extra_column_keys, title_column, subtitle_columns")
    .eq("id", input.projectId)
    .single();
  if (projectErr || !project) {
    throw new Error("Proje bulunamadı.");
  }

  const columns = await listProjectColumns(input.projectId);
  const schemaKeys = ((project.extra_column_keys as string[] | null) ?? [])
    .map((k) => String(k).trim())
    .filter(Boolean);

  const conflictInSchema = schemaKeys.some(
    (k) => columnKeysEqual(k, newKey) && !columnKeysEqual(k, oldKey)
  );
  const conflictInColumns = columns.some(
    (c) => columnKeysEqual(c.key, newKey) && !columnKeysEqual(c.key, oldKey)
  );
  if (conflictInSchema || conflictInColumns) {
    throw new Error(`"${newKey}" adında bir sütun zaten var.`);
  }

  const nextExtraKeys = renameKeyInStringList(schemaKeys, oldKey, newKey);

  let nextTitle = project.title_column as string | null;
  if (nextTitle && columnKeysEqual(nextTitle, oldKey)) {
    nextTitle = newKey;
  }

  const rawSubtitles = ((project.subtitle_columns as string[] | null) ?? [])
    .map((k) => String(k).trim())
    .filter(Boolean);
  const nextSubtitles = rawSubtitles.some((k) => columnKeysEqual(k, oldKey))
    ? renameKeyInStringList(rawSubtitles, oldKey, newKey)
    : rawSubtitles;

  const { error: projectUpdateErr } = await supabase
    .from("projects")
    .update({
      extra_column_keys: nextExtraKeys,
      title_column: nextTitle,
      subtitle_columns: nextSubtitles.length > 0 ? nextSubtitles : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.projectId);
  if (projectUpdateErr) {
    throw new Error(projectUpdateErr.message || "Proje şeması güncellenemedi.");
  }

  const colToRename = columns.find((c) => columnKeysEqual(c.key, oldKey));
  if (colToRename) {
    await updateProjectColumn(colToRename.id, { key: newKey });
  }

  const { data: bindings, error: bindingsErr } = await supabase
    .from("table_chip_bindings")
    .select("id, column_key, template_id")
    .eq("project_id", input.projectId);
  if (bindingsErr) {
    throw new Error(bindingsErr.message || "Çip bağlantıları okunamadı.");
  }

  let chipBindingsUpdated = 0;
  for (const binding of bindings ?? []) {
    if (!columnKeysEqual(String(binding.column_key), oldKey)) continue;
    const duplicate = (bindings ?? []).some(
      (other) =>
        other.id !== binding.id &&
        other.template_id === binding.template_id &&
        columnKeysEqual(String(other.column_key), newKey)
    );
    if (duplicate) {
      throw new Error(`"${newKey}" için aynı çip şablonu zaten bağlı.`);
    }
    const { error } = await supabase
      .from("table_chip_bindings")
      .update({ column_key: newKey, updated_at: new Date().toISOString() })
      .eq("id", binding.id);
    if (error) {
      throw new Error(error.message || "Çip bağlantısı güncellenemedi.");
    }
    chipBindingsUpdated += 1;
  }

  const { data: taskRows, error: tasksErr } = await supabase
    .from("tasks")
    .select("id, extra_data")
    .eq("project_id", input.projectId);
  if (tasksErr) {
    throw new Error(tasksErr.message || "Görevler okunamadı.");
  }

  const pendingUpdates: { id: string; extra_data: Record<string, string> | null }[] = [];
  for (const row of taskRows ?? []) {
    const extra = row.extra_data as Record<string, string> | null;
    if (!extra || typeof extra !== "object") continue;
    const actualKey = Object.keys(extra).find((k) => columnKeysEqual(k, oldKey));
    if (!actualKey) continue;
    const nextExtra = { ...extra };
    nextExtra[newKey] = nextExtra[actualKey];
    delete nextExtra[actualKey];
    pendingUpdates.push({
      id: String(row.id),
      extra_data: Object.keys(nextExtra).length > 0 ? nextExtra : null,
    });
  }

  const batchSize = 25;
  for (let i = 0; i < pendingUpdates.length; i += batchSize) {
    const chunk = pendingUpdates.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async ({ id, extra_data }) => {
        const { error } = await supabase.from("tasks").update({ extra_data }).eq("id", id);
        if (error) {
          throw new Error(error.message || "Görev verisi güncellenemedi.");
        }
      })
    );
  }

  return {
    tasksUpdated: pendingUpdates.length,
    chipBindingsUpdated,
    extraColumnKeys: nextExtraKeys,
    titleColumn: nextTitle,
    subtitleColumns: nextSubtitles.length > 0 ? nextSubtitles : null,
  };
}
