import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const LIVE_TABLE_DENSITY_KEY = "live_table_density";

/** `contexts/settings-context` ile aynı değer kümesi (döngüsel import önlenir). */
export type ServerLiveTableDensity = "compact" | "normal" | "comfortable";

function coerceLiveTableDensity(v: unknown): ServerLiveTableDensity {
  if (v === "compact" || v === "normal" || v === "comfortable") return v;
  return "normal";
}

/** Sunucudaki canlı tablo yoğunluğu (tüm üyeler ortak). */
export async function fetchLiveTableDensityFromServer(): Promise<ServerLiveTableDensity | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LIVE_TABLE_DENSITY_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[app_settings] fetch live_table_density:", error.message);
    return null;
  }
  if (!data?.value) return null;
  return coerceLiveTableDensity(data.value);
}

/** Yoğunluk değişince tüm istemcilerde güncellenmesi için (RLS: giriş yapmış kullanıcı). */
export async function persistLiveTableDensityToServer(density: ServerLiveTableDensity): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session) return false;
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LIVE_TABLE_DENSITY_KEY,
      value: density,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) {
    console.warn("[app_settings] upsert live_table_density:", error.message);
    return false;
  }
  return true;
}

export const LIVE_TABLE_DENSITY_APP_SETTINGS_KEY = LIVE_TABLE_DENSITY_KEY;

/* -------------------------------------------------------------------------- */
/* Kurumsal kimlik (org_branding) — rapor şablonlarında kullanılan logo/ad     */
/* -------------------------------------------------------------------------- */

const ORG_BRANDING_KEY = "org_branding";

export type OrgBranding = {
  /** Tam URL — https başlamalı. Boş ise logo gösterilmez. */
  logoUrl: string;
  /** Görünür kurum adı (rapor başlığı yanında). */
  orgName: string;
  /** PDF footer'da görünecek metin (varsayılan: "DashboardApp"). */
  pdfFooterText: string;
};

export const DEFAULT_ORG_BRANDING: OrgBranding = {
  logoUrl: "",
  orgName: "",
  pdfFooterText: "DashboardApp",
};

function coerceOrgBranding(v: unknown): OrgBranding {
  if (!v || typeof v !== "object") return { ...DEFAULT_ORG_BRANDING };
  const row = v as Record<string, unknown>;
  return {
    logoUrl: typeof row.logoUrl === "string" ? row.logoUrl.trim() : "",
    orgName: typeof row.orgName === "string" ? row.orgName.trim() : "",
    pdfFooterText:
      typeof row.pdfFooterText === "string" && row.pdfFooterText.trim()
        ? row.pdfFooterText.trim()
        : DEFAULT_ORG_BRANDING.pdfFooterText,
  };
}

/** Kurumsal kimlik bilgilerini al (tüm üyeler ortak okur). */
export async function fetchOrgBranding(): Promise<OrgBranding> {
  if (!isSupabaseConfigured()) return { ...DEFAULT_ORG_BRANDING };
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ORG_BRANDING_KEY)
    .maybeSingle();
  if (error) {
    if (error.code !== "42P01") console.warn("[app_settings] fetch org_branding:", error.message);
    return { ...DEFAULT_ORG_BRANDING };
  }
  return coerceOrgBranding(data?.value);
}

/** Kurumsal kimlik bilgilerini kaydet (RLS: admin/PM). */
export async function persistOrgBranding(value: OrgBranding): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session) return false;
  const normalized = coerceOrgBranding(value);
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: ORG_BRANDING_KEY,
      value: normalized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) {
    console.warn("[app_settings] upsert org_branding:", error.message);
    return false;
  }
  return true;
}

export const ORG_BRANDING_APP_SETTINGS_KEY = ORG_BRANDING_KEY;
