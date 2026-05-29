import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const LIVE_TABLE_DENSITY_KEY = "live_table_density";
const PII_POLICY_MODE_KEY = "pii_policy_mode";
const PII_SENSITIVE_DISPLAY_MODE_KEY = "pii_sensitive_display_mode";
const SPOTLIGHT_ENABLED_KEY = "spotlight_enabled";

/** `contexts/settings-context` ile aynı değer kümesi (döngüsel import önlenir). */
export type ServerLiveTableDensity = "compact" | "normal" | "comfortable";
export type ServerPiiPolicyMode = "shadow" | "enforce";
export type ServerPiiSensitiveDisplayMode = "hidden_copy" | "masked_copy";
export type ServerSpotlightEnabled = boolean;

function coerceLiveTableDensity(v: unknown): ServerLiveTableDensity {
  if (v === "compact" || v === "normal" || v === "comfortable") return v;
  return "normal";
}

function coercePiiPolicyMode(v: unknown): ServerPiiPolicyMode {
  return v === "enforce" ? "enforce" : "shadow";
}

function coercePiiSensitiveDisplayMode(v: unknown): ServerPiiSensitiveDisplayMode {
  return v === "masked_copy" ? "masked_copy" : "hidden_copy";
}

function coerceSpotlightEnabled(v: unknown): ServerSpotlightEnabled {
  return v === true || v === "true" || v === 1 || v === "1";
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

/** Sunucudaki PII policy modu (tüm üyeler ortak). */
export async function fetchPiiPolicyModeFromServer(): Promise<ServerPiiPolicyMode | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PII_POLICY_MODE_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[app_settings] fetch pii_policy_mode:", error.message);
    return null;
  }
  if (!data?.value) return null;
  return coercePiiPolicyMode(data.value);
}

/** PII policy modunu kaydet (tek merkez, tüm üyeler etkilenir). */
export async function persistPiiPolicyModeToServer(mode: ServerPiiPolicyMode): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session) return false;
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: PII_POLICY_MODE_KEY,
      value: mode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) {
    console.warn("[app_settings] upsert pii_policy_mode:", error.message);
    return false;
  }
  return true;
}

export const PII_POLICY_MODE_APP_SETTINGS_KEY = PII_POLICY_MODE_KEY;

/** Hassas hücre görünüm modu (tüm üyeler ortak). */
export async function fetchPiiSensitiveDisplayModeFromServer(): Promise<ServerPiiSensitiveDisplayMode | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PII_SENSITIVE_DISPLAY_MODE_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[app_settings] fetch pii_sensitive_display_mode:", error.message);
    return null;
  }
  if (!data?.value) return null;
  return coercePiiSensitiveDisplayMode(data.value);
}

/** Hassas hücre görünüm modunu kaydet (tek merkez, tüm üyeler etkilenir). */
export async function persistPiiSensitiveDisplayModeToServer(mode: ServerPiiSensitiveDisplayMode): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session) return false;
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: PII_SENSITIVE_DISPLAY_MODE_KEY,
      value: mode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) {
    console.warn("[app_settings] upsert pii_sensitive_display_mode:", error.message);
    return false;
  }
  return true;
}

export const PII_SENSITIVE_DISPLAY_MODE_APP_SETTINGS_KEY = PII_SENSITIVE_DISPLAY_MODE_KEY;

/** Merkezi spotlight modu (tüm üyeler ortak). */
export async function fetchSpotlightEnabledFromServer(): Promise<ServerSpotlightEnabled | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SPOTLIGHT_ENABLED_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[app_settings] fetch spotlight_enabled:", error.message);
    return null;
  }
  if (data == null || !Object.prototype.hasOwnProperty.call(data, "value")) return null;
  return coerceSpotlightEnabled(data.value);
}

/** Merkezi spotlight modunu kaydet (tek merkez, tüm üyeler etkilenir). */
export async function persistSpotlightEnabledToServer(enabled: ServerSpotlightEnabled): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data: auth } = await supabase.auth.getSession();
  if (!auth?.session) return false;
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: SPOTLIGHT_ENABLED_KEY,
      value: Boolean(enabled),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) {
    console.warn("[app_settings] upsert spotlight_enabled:", error.message);
    return false;
  }
  return true;
}

export const SPOTLIGHT_ENABLED_APP_SETTINGS_KEY = SPOTLIGHT_ENABLED_KEY;

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
