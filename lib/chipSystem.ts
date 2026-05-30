"use client";

import { supabase } from "@/lib/supabaseClient";
import { SMART_CHIP_COLUMN_PRESETS } from "@/lib/projectFormHelpers";

export type ChipCategory =
  | "date"
  | "status"
  | "email"
  | "payment"
  | "approval"
  | "risk"
  | "document"
  | "privacy"
  | "system";

export type ChipTemplate = {
  id: string;
  name: string;
  category: ChipCategory;
  description: string | null;
  icon: string | null;
  color: string;
  isSystem: boolean;
  managerOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChipOption = {
  id: string;
  templateId: string;
  label: string;
  value: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  isTerminal: boolean;
};

export type TableChipBinding = {
  id: string;
  projectId: string;
  columnKey: string;
  templateId: string;
  allowMultiple: boolean;
  required: boolean;
};

export type RowChipValue = {
  id: string;
  taskId: string;
  templateId: string;
  optionId: string;
  source: "manual" | "automation" | "system" | "import";
  updatedBy: string | null;
  updatedAt: string;
};

export type ChipCatalog = {
  templates: ChipTemplate[];
  options: ChipOption[];
  bindings: TableChipBinding[];
};

export const CHIP_CATEGORY_LABELS: Record<ChipCategory, string> = {
  date: "Tarih",
  status: "Durum",
  email: "E-posta",
  payment: "Ödeme",
  approval: "Onay",
  risk: "Risk",
  document: "Evrak",
  privacy: "Gizlilik",
  system: "Sistem",
};

export const CHIP_COLORS = ["slate", "blue", "emerald", "amber", "red", "violet", "cyan"] as const;

type TemplateRow = {
  id: string;
  name: string;
  category: ChipCategory;
  description: string | null;
  icon: string | null;
  color: string;
  is_system: boolean;
  manager_only: boolean;
  created_at: string;
  updated_at: string;
};

type OptionRow = {
  id: string;
  template_id: string;
  label: string;
  value: string;
  color: string;
  icon: string | null;
  sort_order: number;
  is_terminal: boolean;
};

type BindingRow = {
  id: string;
  project_id: string;
  column_key: string;
  template_id: string;
  allow_multiple: boolean;
  required: boolean;
};

type RowChipRow = {
  id: string;
  task_id: string;
  template_id: string;
  option_id: string;
  source: RowChipValue["source"];
  updated_by: string | null;
  updated_at: string;
};

function friendlyChipError(err: unknown): Error {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "42P01" || /chip_templates|chip_options|table_chip_bindings|row_chip_values/i.test(e?.message ?? "")) {
    return new Error("Çip sistemi tabloları yok. scripts/chip-system.sql dosyasını Supabase SQL Editor'da çalıştırın.");
  }
  if (e?.code === "42501" || /row-level security|permission denied/i.test(e?.message ?? "")) {
    return new Error("Bu çip işlemi için yetkiniz yok.");
  }
  return new Error(e?.message ?? "Çip işlemi başarısız.");
}

function mapTemplate(row: TemplateRow): ChipTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    icon: row.icon,
    color: row.color,
    isSystem: row.is_system,
    managerOnly: row.manager_only,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOption(row: OptionRow): ChipOption {
  return {
    id: row.id,
    templateId: row.template_id,
    label: row.label,
    value: row.value,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    isTerminal: row.is_terminal,
  };
}

function mapBinding(row: BindingRow): TableChipBinding {
  return {
    id: row.id,
    projectId: row.project_id,
    columnKey: row.column_key,
    templateId: row.template_id,
    allowMultiple: row.allow_multiple,
    required: row.required,
  };
}

function mapRowChip(row: RowChipRow): RowChipValue {
  return {
    id: row.id,
    taskId: row.task_id,
    templateId: row.template_id,
    optionId: row.option_id,
    source: row.source,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function listChipCatalog(projectIds: string[] = []): Promise<ChipCatalog> {
  const [templatesRes, optionsRes, bindingsRes] = await Promise.all([
    supabase
      .from("chip_templates")
      .select("id,name,category,description,icon,color,is_system,manager_only,created_at,updated_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("chip_options")
      .select("id,template_id,label,value,color,icon,sort_order,is_terminal")
      .order("sort_order", { ascending: true }),
    projectIds.length > 0
      ? supabase
          .from("table_chip_bindings")
          .select("id,project_id,column_key,template_id,allow_multiple,required")
          .in("project_id", projectIds)
      : supabase
          .from("table_chip_bindings")
          .select("id,project_id,column_key,template_id,allow_multiple,required")
          .limit(500),
  ]);
  if (templatesRes.error) throw friendlyChipError(templatesRes.error);
  if (optionsRes.error) throw friendlyChipError(optionsRes.error);
  if (bindingsRes.error) throw friendlyChipError(bindingsRes.error);
  return {
    templates: ((templatesRes.data ?? []) as TemplateRow[]).map(mapTemplate),
    options: ((optionsRes.data ?? []) as OptionRow[]).map(mapOption),
    bindings: ((bindingsRes.data ?? []) as BindingRow[]).map(mapBinding),
  };
}

export async function listRowChipValues(taskIds: string[]): Promise<RowChipValue[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("row_chip_values")
    .select("id,task_id,template_id,option_id,source,updated_by,updated_at")
    .in("task_id", taskIds);
  if (error) throw friendlyChipError(error);
  return ((data ?? []) as RowChipRow[]).map(mapRowChip);
}

export async function createChipTemplate(input: {
  name: string;
  category: ChipCategory;
  description?: string | null;
  icon?: string | null;
  color?: string;
  isSystem?: boolean;
  managerOnly?: boolean;
}): Promise<ChipTemplate> {
  const { data, error } = await supabase
    .from("chip_templates")
    .insert({
      name: input.name.trim(),
      category: input.category,
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
      color: input.color || "slate",
      is_system: input.isSystem ?? false,
      manager_only: input.managerOnly ?? false,
    })
    .select("id,name,category,description,icon,color,is_system,manager_only,created_at,updated_at")
    .single();
  if (error) throw friendlyChipError(error);
  return mapTemplate(data as TemplateRow);
}

export async function createChipOption(input: {
  templateId: string;
  label: string;
  value?: string;
  color?: string;
  icon?: string | null;
  sortOrder?: number;
  isTerminal?: boolean;
}): Promise<ChipOption> {
  const value = (input.value?.trim() || input.label.trim().toLowerCase().replace(/\s+/g, "_")).slice(0, 120);
  const { data, error } = await supabase
    .from("chip_options")
    .insert({
      template_id: input.templateId,
      label: input.label.trim(),
      value,
      color: input.color || "slate",
      icon: input.icon?.trim() || null,
      sort_order: input.sortOrder ?? 0,
      is_terminal: input.isTerminal ?? false,
    })
    .select("id,template_id,label,value,color,icon,sort_order,is_terminal")
    .single();
  if (error) throw friendlyChipError(error);
  return mapOption(data as OptionRow);
}

export async function upsertTableChipBinding(input: {
  projectId: string;
  columnKey: string;
  templateId: string;
  allowMultiple?: boolean;
  required?: boolean;
}): Promise<TableChipBinding> {
  const { data, error } = await supabase
    .from("table_chip_bindings")
    .upsert(
      {
        project_id: input.projectId,
        column_key: input.columnKey.trim(),
        template_id: input.templateId,
        allow_multiple: input.allowMultiple ?? false,
        required: input.required ?? false,
      },
      { onConflict: "project_id,column_key,template_id" }
    )
    .select("id,project_id,column_key,template_id,allow_multiple,required")
    .single();
  if (error) throw friendlyChipError(error);
  return mapBinding(data as BindingRow);
}

export async function deleteTableChipBinding(id: string): Promise<void> {
  const { error } = await supabase.from("table_chip_bindings").delete().eq("id", id);
  if (error) throw friendlyChipError(error);
}

export async function updateChipTemplate(
  id: string,
  patch: Partial<{
    name: string;
    category: ChipCategory;
    description: string | null;
    icon: string | null;
    color: string;
    managerOnly: boolean;
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.description !== undefined) payload.description = patch.description?.trim() || null;
  if (patch.icon !== undefined) payload.icon = patch.icon?.trim() || null;
  if (patch.color !== undefined) payload.color = patch.color;
  if (patch.managerOnly !== undefined) payload.manager_only = patch.managerOnly;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("chip_templates").update(payload).eq("id", id);
  if (error) throw friendlyChipError(error);
}

export async function deleteChipTemplate(id: string): Promise<void> {
  // Bağlı opsiyonlar + binding'ler cascade ile silinir (DB schema'da on delete cascade).
  const { error } = await supabase.from("chip_templates").delete().eq("id", id);
  if (error) throw friendlyChipError(error);
}

export async function updateChipOption(
  id: string,
  patch: Partial<{ label: string; value: string; color: string; icon: string | null; sortOrder: number; isTerminal: boolean }>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.label !== undefined) payload.label = patch.label.trim();
  if (patch.value !== undefined) payload.value = patch.value.trim();
  if (patch.color !== undefined) payload.color = patch.color;
  if (patch.icon !== undefined) payload.icon = patch.icon?.trim() || null;
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;
  if (patch.isTerminal !== undefined) payload.is_terminal = patch.isTerminal;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("chip_options").update(payload).eq("id", id);
  if (error) throw friendlyChipError(error);
}

export async function deleteChipOption(id: string): Promise<void> {
  const { error } = await supabase.from("chip_options").delete().eq("id", id);
  if (error) throw friendlyChipError(error);
}

/**
 * Seçenekleri verilen ID sırasına göre yeniden sıralar.
 * Her seçeneğin sort_order'ı dizideki index ile günceller.
 */
export async function reorderChipOptions(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  // Sıra ile tek tek update — küçük listeler için yeterli (her şablon <50 seçenek).
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await supabase
      .from("chip_options")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) throw friendlyChipError(error);
  }
}

/**
 * Bir şablonu (seçenekleriyle birlikte) kopyalar.
 * Yeni şablonun adı "<orijinal> (kopya)" olur, is_system=false ile başlar.
 */
export async function duplicateChipTemplate(sourceId: string): Promise<string> {
  // 1) Kaynak şablonu çek
  const { data: src, error: srcErr } = await supabase
    .from("chip_templates")
    .select("name,category,description,icon,color,manager_only")
    .eq("id", sourceId)
    .single();
  if (srcErr || !src) throw friendlyChipError(srcErr ?? new Error("Kaynak şablon bulunamadı"));

  // 2) Yeni şablon oluştur
  const { data: created, error: createErr } = await supabase
    .from("chip_templates")
    .insert({
      name: `${src.name} (kopya)`,
      category: src.category,
      description: src.description,
      icon: src.icon,
      color: src.color,
      manager_only: src.manager_only,
      is_system: false,
    })
    .select("id")
    .single();
  if (createErr || !created) throw friendlyChipError(createErr ?? new Error("Şablon kopyalanamadı"));
  const newId = String(created.id);

  // 3) Kaynak seçenekleri çek + yeni şablona ekle
  const { data: opts, error: optsErr } = await supabase
    .from("chip_options")
    .select("label,value,color,icon,sort_order,is_terminal")
    .eq("template_id", sourceId)
    .order("sort_order", { ascending: true });
  if (optsErr) throw friendlyChipError(optsErr);
  if (opts && opts.length > 0) {
    const { error: insErr } = await supabase
      .from("chip_options")
      .insert(opts.map((o) => ({ ...o, template_id: newId })));
    if (insErr) throw friendlyChipError(insErr);
  }
  return newId;
}

/**
 * Bir projenin tüm çip bağlamalarını başka projeye kopyalar.
 * Hedef projede zaten aynı (columnKey, templateId) varsa atlanır (idempotent).
 * Geri: kopyalanan + atlanan sayıları.
 */
export async function copyChipBindingsBetweenProjects(input: {
  sourceProjectId: string;
  targetProjectId: string;
}): Promise<{ copied: number; skipped: number }> {
  if (input.sourceProjectId === input.targetProjectId) {
    return { copied: 0, skipped: 0 };
  }
  const { data: src, error: srcErr } = await supabase
    .from("table_chip_bindings")
    .select("column_key,template_id,allow_multiple,required")
    .eq("project_id", input.sourceProjectId);
  if (srcErr) throw friendlyChipError(srcErr);
  const { data: existing, error: tgtErr } = await supabase
    .from("table_chip_bindings")
    .select("column_key,template_id")
    .eq("project_id", input.targetProjectId);
  if (tgtErr) throw friendlyChipError(tgtErr);
  const existingKeys = new Set(
    (existing ?? []).map((b) => `${String(b.column_key).trim().toLowerCase()}::${b.template_id}`)
  );
  const toInsert: Array<{
    project_id: string;
    column_key: string;
    template_id: string;
    allow_multiple: boolean;
    required: boolean;
  }> = [];
  let skipped = 0;
  for (const row of src ?? []) {
    const key = `${String(row.column_key).trim().toLowerCase()}::${row.template_id}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    toInsert.push({
      project_id: input.targetProjectId,
      column_key: row.column_key,
      template_id: row.template_id,
      allow_multiple: row.allow_multiple,
      required: row.required,
    });
  }
  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("table_chip_bindings").insert(toInsert);
    if (insErr) throw friendlyChipError(insErr);
  }
  return { copied: toInsert.length, skipped };
}

export async function setRowChipValue(input: {
  taskId: string;
  templateId: string;
  optionId: string;
  source?: RowChipValue["source"];
}): Promise<RowChipValue> {
  await supabase
    .from("row_chip_values")
    .delete()
    .eq("task_id", input.taskId)
    .eq("template_id", input.templateId);

  const { data, error } = await supabase
    .from("row_chip_values")
    .insert({
      task_id: input.taskId,
      template_id: input.templateId,
      option_id: input.optionId,
      source: input.source ?? "manual",
    })
    .select("id,task_id,template_id,option_id,source,updated_by,updated_at")
    .single();
  if (error) throw friendlyChipError(error);
  return mapRowChip(data as RowChipRow);
}

export async function clearRowChipValue(taskId: string, templateId: string): Promise<void> {
  const { error } = await supabase
    .from("row_chip_values")
    .delete()
    .eq("task_id", taskId)
    .eq("template_id", templateId);
  if (error) throw friendlyChipError(error);
}

export function optionForRowChip(row: RowChipValue, options: ChipOption[]): ChipOption | null {
  return options.find((option) => option.id === row.optionId) ?? null;
}

export function templateForRowChip(row: RowChipValue, templates: ChipTemplate[]): ChipTemplate | null {
  return templates.find((template) => template.id === row.templateId) ?? null;
}

/**
 * Resolver — bir görev + extra_data kolon anahtarı verildiğinde, eğer o kolon
 * bu projede bir chip template'e bağlıysa görevin aktif chip option label'ını döner.
 * Bağlı değilse veya henüz değer atanmamışsa null döner.
 *
 * Kullanım yerleri:
 *  - Global arama: ham extra_data yerine chip label aranır (örn "Mail Gönderildi")
 *  - Dışa aktarım (CSV/Excel/PDF/email): chip-bound hücreler boş değil, option label gösterir
 *  - Sütun filtresi: chip-bound sütunda filter listesine label'lar düşer
 *
 * Performans: tüm lookup'lar Map ile O(1). 10k görev × 5 chip kolon için sorunsuz.
 */
export type ChipValueResolver = (
  task: { id: string; project_id?: string | null },
  columnKey: string
) => string | null;

export function buildChipValueResolver(
  rowChipValues: RowChipValue[],
  catalog: ChipCatalog
): ChipValueResolver {
  // taskId:templateId → optionId
  const valueIndex = new Map<string, string>();
  for (const v of rowChipValues) {
    valueIndex.set(`${v.taskId}:${v.templateId}`, v.optionId);
  }
  // optionId → label
  const optionLabelById = new Map<string, string>();
  for (const o of catalog.options) {
    optionLabelById.set(o.id, o.label);
  }
  // projectId:normalizedKey → templateId
  const bindingsByProjectColumn = new Map<string, string>();
  for (const b of catalog.bindings) {
    const key = `${b.projectId}:${b.columnKey.trim().toLocaleLowerCase("tr")}`;
    bindingsByProjectColumn.set(key, b.templateId);
  }

  return (task, columnKey) => {
    const projectId = task.project_id != null ? String(task.project_id).trim() : "";
    if (!projectId) return null;
    const normalizedKey = (columnKey ?? "").trim().toLocaleLowerCase("tr");
    if (!normalizedKey) return null;
    const templateId = bindingsByProjectColumn.get(`${projectId}:${normalizedKey}`);
    if (!templateId) return null;
    const optionId = valueIndex.get(`${task.id}:${templateId}`);
    if (!optionId) return null;
    return optionLabelById.get(optionId) ?? null;
  };
}

/**
 * Bir görevin TÜM aktif chip option label'larını döner (tüm chip-bound kolonlardan).
 * Global aramada extra_data'da bulunmayan chip-only değerleri yakalamak için kullanılır.
 *
 * Örnek: "Risk" kolonu chip-bound ve extra_data'da yok ama row_chip_values'da
 * "Orta Risk" var → ["Orta Risk"] döner. Global arama "orta" sorgusu eşleşir.
 */
export function getAllChipLabelsForTask(
  task: { id: string; project_id?: string | null },
  rowChipValues: RowChipValue[],
  catalog: ChipCatalog
): string[] {
  const projectId = task.project_id != null ? String(task.project_id).trim() : "";
  if (!projectId) return [];
  // Bu projeye ait binding'ler
  const projectBindings = catalog.bindings.filter((b) => b.projectId === projectId);
  if (projectBindings.length === 0) return [];
  // optionId → label index
  const optionLabelById = new Map<string, string>();
  for (const o of catalog.options) optionLabelById.set(o.id, o.label);
  // Görevin chip değerlerini topla
  const labels: string[] = [];
  for (const binding of projectBindings) {
    const row = rowChipValues.find((v) => v.taskId === task.id && v.templateId === binding.templateId);
    if (!row) continue;
    const label = optionLabelById.get(row.optionId);
    if (label) labels.push(label);
  }
  return labels;
}

/**
 * Bir proje + kolon kombinasyonu için tüm mümkün chip option label'larını döner.
 * Sütun filtresi (column filter) dropdown'unda chip-bound kolona "Orta Risk",
 * "Kritik Risk" gibi tüm seçenekleri göstermek için kullanılır.
 *
 * Görev verisinde o option kullanılmamış olsa bile listede görünür — kullanıcı
 * "henüz kullanılmamış" değerleri de seçip filtre koyabilir.
 */
export function getChipOptionsForColumn(
  projectId: string | null | undefined,
  columnKey: string,
  catalog: ChipCatalog
): ChipOption[] {
  const resolved = resolveExtraColumnChip(catalog, projectId ? [projectId] : [], columnKey);
  return resolved?.options ?? [];
}

export type ResolvedExtraColumnChip = {
  template: ChipTemplate;
  options: ChipOption[];
  binding: TableChipBinding | null;
};

function normalizeExtraColumnKey(key: string): string {
  return key.trim().toLocaleLowerCase("tr");
}

function chipTemplateByName(catalog: ChipCatalog, templateName: string): ChipTemplate | null {
  const normalized = templateName.trim().toLocaleLowerCase("tr");
  return (
    catalog.templates.find((template) => template.name.trim().toLocaleLowerCase("tr") === normalized) ??
    null
  );
}

function chipOptionsForTemplate(catalog: ChipCatalog, templateId: string): ChipOption[] {
  return catalog.options
    .filter((option) => option.templateId === templateId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function resolveChipBySelectOptions(
  catalog: ChipCatalog,
  selectOptions: string[]
): { template: ChipTemplate; options: ChipOption[] } | null {
  const normalizedSelect = new Set(
    selectOptions.map((option) => option.trim().toLocaleLowerCase("tr")).filter(Boolean)
  );
  if (normalizedSelect.size < 2) return null;

  let best: { template: ChipTemplate; options: ChipOption[]; score: number } | null = null;
  for (const template of catalog.templates) {
    const options = chipOptionsForTemplate(catalog, template.id);
    const score = options.filter((option) =>
      normalizedSelect.has(option.label.trim().toLocaleLowerCase("tr"))
    ).length;
    if (score >= 2 && (!best || score > best.score)) {
      best = { template, options, score };
    }
  }
  return best ? { template: best.template, options: best.options } : null;
}

/** Canlı tablo ek sütunu için çip şablonu — explicit binding, preset veya select seçenek eşleşmesi. */
export function resolveExtraColumnChip(
  catalog: ChipCatalog,
  projectIds: string[],
  columnKey: string,
  selectOptions?: string[]
): ResolvedExtraColumnChip | null {
  const normalizedKey = normalizeExtraColumnKey(columnKey);
  if (!normalizedKey) return null;

  const uniqueProjectIds = Array.from(new Set(projectIds.map((id) => String(id).trim()).filter(Boolean)));

  for (const projectId of uniqueProjectIds) {
    const binding = catalog.bindings.find(
      (item) =>
        item.projectId === projectId && normalizeExtraColumnKey(item.columnKey) === normalizedKey
    );
    if (!binding) continue;
    const template = catalog.templates.find((item) => item.id === binding.templateId) ?? null;
    const options = template ? chipOptionsForTemplate(catalog, template.id) : [];
    if (template && options.length > 0) {
      return { template, options, binding };
    }
  }

  const preset = SMART_CHIP_COLUMN_PRESETS.find(
    (item) => normalizeExtraColumnKey(item.label) === normalizedKey
  );
  if (preset) {
    const template = chipTemplateByName(catalog, preset.templateName);
    const options = template ? chipOptionsForTemplate(catalog, template.id) : [];
    if (template && options.length > 0) {
      const binding =
        catalog.bindings.find(
          (item) =>
            uniqueProjectIds.includes(item.projectId) &&
            item.templateId === template.id &&
            normalizeExtraColumnKey(item.columnKey) === normalizedKey
        ) ?? null;
      return { template, options, binding };
    }
  }

  const matchedByOptions = resolveChipBySelectOptions(catalog, selectOptions ?? []);
  if (matchedByOptions) {
    const binding =
      catalog.bindings.find(
        (item) =>
          uniqueProjectIds.includes(item.projectId) &&
          item.templateId === matchedByOptions.template.id &&
          normalizeExtraColumnKey(item.columnKey) === normalizedKey
      ) ?? null;
    return { ...matchedByOptions, binding };
  }

  return null;
}

/** row_chip_values yoksa extra_data metninden seçili çip option id'si. */
export function matchChipOptionIdFromCellValue(
  extraValue: string | null | undefined,
  chipOptions: ChipOption[],
  rowChipValue?: RowChipValue | null
): string {
  if (rowChipValue?.optionId) return rowChipValue.optionId;
  const trimmed = String(extraValue ?? "").trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLocaleLowerCase("tr");
  const matched = chipOptions.find(
    (option) =>
      option.label.trim().toLocaleLowerCase("tr") === normalized ||
      option.value.trim().toLocaleLowerCase("tr") === normalized
  );
  return matched?.id ?? "";
}

