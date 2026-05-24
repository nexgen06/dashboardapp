"use client";

import { supabase } from "@/lib/supabaseClient";
import type { EmailTemplateMode, PdfExportScope, ReportTemplateId } from "@/lib/liveTableExport";

export type ReportTemplateScope = "private" | "shared";

export type ReportTemplateConfig = {
  baseTemplateId: ReportTemplateId;
  pdfTitle: string;
  emailSubject: string;
  emailMode: EmailTemplateMode;
  exportScope: PdfExportScope;
  visibleColumnIds: string[];
  unmaskSensitive: boolean;
};

export type ManagedReportTemplate = {
  id: string;
  user_id: string;
  scope: ReportTemplateScope;
  name: string;
  description: string;
  template_config: ReportTemplateConfig;
  created_at: string;
  updated_at: string;
};

export type SaveManagedReportTemplateInput = {
  name: string;
  description?: string;
  scope: ReportTemplateScope;
  template_config: ReportTemplateConfig;
};

export function defaultReportTemplateConfig(): ReportTemplateConfig {
  return {
    baseTemplateId: "operations",
    pdfTitle: "Canlı Tablo Operasyon Özeti",
    emailSubject: "Canlı Tablo Operasyon Özeti",
    emailMode: "mobile",
    exportScope: "current",
    visibleColumnIds: [],
    unmaskSensitive: false,
  };
}

function normalizeConfig(raw: unknown): ReportTemplateConfig {
  const base = defaultReportTemplateConfig();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  return {
    baseTemplateId: String(row.baseTemplateId ?? base.baseTemplateId) as ReportTemplateId,
    pdfTitle: String(row.pdfTitle ?? base.pdfTitle),
    emailSubject: String(row.emailSubject ?? base.emailSubject),
    emailMode: row.emailMode === "table" ? "table" : "mobile",
    exportScope: row.exportScope === "all" ? "all" : "current",
    visibleColumnIds: Array.isArray(row.visibleColumnIds)
      ? row.visibleColumnIds.map((v) => String(v).trim()).filter(Boolean)
      : [],
    unmaskSensitive: row.unmaskSensitive === true,
  };
}

function rowToTemplate(row: Record<string, unknown>): ManagedReportTemplate {
  return {
    id: String(row.id),
    user_id: String(row.user_id ?? ""),
    scope: row.scope === "shared" ? "shared" : "private",
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    template_config: normalizeConfig(row.template_config),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function friendlyReportTemplateError(error: { code?: string; message?: string } | null): Error {
  const raw = error?.message ?? "";
  if (error?.code === "42P01" || /report_templates/i.test(raw)) {
    return new Error("report_templates tablosu yok. scripts/report-templates.sql dosyasını Supabase SQL Editor'da çalıştırın.");
  }
  if (error?.code === "42501") {
    return new Error("Rapor şablonları için yetki yok. SQL RLS politikalarını ve kullanıcı rolünü kontrol edin.");
  }
  return new Error(raw || "Rapor şablonu işlemi tamamlanamadı.");
}

export async function listManagedReportTemplates(): Promise<ManagedReportTemplate[]> {
  const { data, error } = await supabase
    .from("report_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw friendlyReportTemplateError(error);
  return (data ?? []).map(rowToTemplate);
}

export async function createManagedReportTemplate(input: SaveManagedReportTemplateInput): Promise<string> {
  const { data: authUser } = await supabase.auth.getUser();
  const uid = authUser?.user?.id;
  if (!uid) throw new Error("Oturum açık değil.");
  const { data, error } = await supabase
    .from("report_templates")
    .insert({
      user_id: uid,
      scope: input.scope,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      template_config: input.template_config,
    })
    .select("id")
    .single();
  if (error) throw friendlyReportTemplateError(error);
  return String(data.id);
}

export async function updateManagedReportTemplate(
  id: string,
  input: SaveManagedReportTemplateInput
): Promise<void> {
  const { error } = await supabase
    .from("report_templates")
    .update({
      scope: input.scope,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      template_config: input.template_config,
    })
    .eq("id", id);
  if (error) throw friendlyReportTemplateError(error);
}

export async function deleteManagedReportTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("report_templates").delete().eq("id", id);
  if (error) throw friendlyReportTemplateError(error);
}
